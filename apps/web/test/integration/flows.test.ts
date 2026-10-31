/**
 * End-to-end server flows against a real MySQL database (CI "integration" job).
 * Run locally with a disposable database:
 *   DATABASE_URL=mysql://root:root@127.0.0.1:3306/demo_test npm run test:integration -w @kurotrace/web
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAuditChain, type AuditRow } from "@kurotrace/core/audit";
import { totpAt } from "@kurotrace/core/totp";
import { prisma } from "@kurotrace/db";

process.env.EMAIL_PROVIDER = "memory";
process.env.EVIDENCE_STORAGE = "local";
process.env.EVIDENCE_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "evidence-"));

// No network in tests: the breach service answers "not breached" unless a test says otherwise.
let breachedSuffixes = "";
vi.stubGlobal("fetch", async () => ({ ok: true, text: async () => breachedSuffixes }));

const { outbox } = await import("@kurotrace/services/email");
const accounts = await import("@/server/accounts");
const sessions = await import("@/server/sessions");
const reports = await import("@/server/reports");
const { storage } = await import("@kurotrace/services/storage");
const { protectEmail } = await import("@kurotrace/services/crypto");

const PASSWORD = "correct horse battery staple";
const linkToken = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);

async function wipe() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.emailToken.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.report.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function verifiedUser(email: string) {
  await accounts.registerUser(email, PASSWORD);
  await accounts.verifyEmail(linkToken(outbox.at(-1)!.text));
  return prisma.user.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
}

beforeAll(wipe);
beforeEach(() => {
  outbox.length = 0;
  breachedSuffixes = "";
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("accounts", () => {
  it("registers, verifies once, and never creates a duplicate account", async () => {
    expect(await accounts.registerUser("Ana@Example.com", PASSWORD)).toEqual({ ok: true });
    const verify = outbox.at(-1)!;
    expect(verify.subject).toBe("Confirm your email");
    expect(await accounts.verifyEmail(linkToken(verify.text))).toBe(true);
    expect(await accounts.verifyEmail(linkToken(verify.text))).toBe(false); // single use

    const user = await prisma.user.findFirstOrThrow();
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.emailEnc).not.toContain("ana@example.com"); // stored encrypted
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);

    expect(await accounts.registerUser("ana@example.com", PASSWORD)).toEqual({ ok: true });
    expect(outbox.at(-1)!.subject).toBe("You already have a Kuro Trace account");
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses short and breached passwords", async () => {
    expect((await accounts.registerUser("b@example.com", "short")).ok).toBe(false);
    // SHA-1 suffix of PASSWORD is returned by the fake range API → breached
    const { createHash } = await import("node:crypto");
    breachedSuffixes = `${createHash("sha1").update("password1234").digest("hex").toUpperCase().slice(5)}:12`;
    expect((await accounts.registerUser("b@example.com", "password1234")).ok).toBe(false);
  });

  it("locks the account after 5 wrong passwords, with a generic error for unknown emails", async () => {
    expect(await accounts.authenticate("nobody@example.com", PASSWORD)).toEqual({ ok: false, reason: "invalid" });
    for (let i = 0; i < 4; i++) expect((await accounts.authenticate("ana@example.com", "wrong password!!")).ok).toBe(false);
    const locked = await accounts.authenticate("ana@example.com", "wrong password!!");
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    expect(await accounts.authenticate("ana@example.com", PASSWORD)).toMatchObject({ ok: false, reason: "locked" });
    await prisma.user.updateMany({ data: { lockedUntil: null } });
    expect(await accounts.authenticate("ana@example.com", PASSWORD)).toMatchObject({ ok: true });
  });

  it("creates, resolves and destroys sessions; only hashes are stored", async () => {
    const user = await prisma.user.findFirstOrThrow();
    const { token } = await sessions.createSession(user.id, { userAgent: "test" });
    expect(await prisma.userSession.count({ where: { tokenHash: token } })).toBe(0);
    expect((await sessions.resolveSession(token))?.userId).toBe(user.id);
    await prisma.userSession.updateMany({ data: { lastSeenAt: new Date(Date.now() - 8 * 86_400_000) } });
    expect(await sessions.resolveSession(token)).toBeNull(); // idle timeout
    const second = await sessions.createSession(user.id);
    await sessions.destroySession(second.token);
    expect(await sessions.resolveSession(second.token)).toBeNull();
  });

  it("turns on two-step sign-in, then accepts a code once and recovery codes once", async () => {
    const user = await prisma.user.findFirstOrThrow();
    const setup = (await accounts.beginTwoStepSetup(user.id))!;
    expect(await accounts.confirmTwoStep(user.id, "000000")).toEqual({ ok: false });
    const confirmed = await accounts.confirmTwoStep(user.id, totpAt(setup.secret, Date.now()));
    expect(confirmed.ok).toBe(true);
    const codes = confirmed.ok ? confirmed.recoveryCodes : [];
    expect(codes).toHaveLength(10);

    // Next login needs a second step
    await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: 0 } });
    const first = await accounts.authenticate("ana@example.com", PASSWORD);
    expect(first.ok).toBe("two_step");
    const challenge = first.ok === "two_step" ? first.challenge : "";
    const code = totpAt(setup.secret, Date.now());
    expect(await accounts.completeTwoStep(challenge, code)).toMatchObject({ ok: true });

    const again = await accounts.authenticate("ana@example.com", PASSWORD);
    const challenge2 = again.ok === "two_step" ? again.challenge : "";
    expect(await accounts.completeTwoStep(challenge2, code)).toEqual({ ok: false }); // replayed code
    expect(await accounts.completeTwoStep(challenge2, codes[0]!)).toMatchObject({ ok: true });

    const third = await accounts.authenticate("ana@example.com", PASSWORD);
    const challenge3 = third.ok === "two_step" ? third.challenge : "";
    expect(await accounts.completeTwoStep(challenge3, codes[0]!)).toEqual({ ok: false }); // recovery code used up

    expect(await accounts.disableTwoStep(user.id, "wrong password!!")).toBe(false);
    expect(await accounts.disableTwoStep(user.id, PASSWORD)).toBe(true);
    expect(await accounts.authenticate("ana@example.com", PASSWORD)).toMatchObject({ ok: true });
  });

  it("resets a password with a single-use link and signs other devices out", async () => {
    const user = await prisma.user.findFirstOrThrow();
    const { token: sessionToken } = await sessions.createSession(user.id);
    await accounts.requestPasswordReset("nobody@example.com");
    expect(outbox).toHaveLength(0); // no email, same response
    await accounts.requestPasswordReset("ana@example.com");
    const token = linkToken(outbox.at(-1)!.text);
    expect(await accounts.resetPassword(token, "a brand new passphrase")).toEqual({ ok: true });
    expect((await accounts.resetPassword(token, "another new passphrase")).ok).toBe(false);
    expect(await sessions.resolveSession(sessionToken)).toBeNull();
    expect(await accounts.authenticate("ana@example.com", "a brand new passphrase")).toMatchObject({ ok: true });
  });

  it("creates a verified account from a continue-report link", async () => {
    const { emailHash, emailEnc } = protectEmail("lead@example.com", "lead.email");
    const lead = await prisma.lead.create({ data: { source: "HERO_FORM", emailHash, emailEnc, scamType: "FAKE_TRADING_APP" } });
    await accounts.sendContinueReportLink("lead@example.com", lead.id);
    const token = linkToken(outbox.at(-1)!.text);
    expect(await accounts.inspectContinueLink(token)).toMatchObject({ email: "lead@example.com", hasAccount: false, scamType: "FAKE_TRADING_APP" });
    const created = await accounts.accountFromContinueLink(token, PASSWORD);
    expect(created.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.ok ? created.userId : "" } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect((await accounts.accountFromContinueLink(token, PASSWORD)).ok).toBe(false);
  });
});

describe("reports", () => {
  it("runs the whole report form and keeps every report private to its owner", async () => {
    const owner = await verifiedUser("owner@example.com");
    const other = await verifiedUser("other@example.com");
    const draft = await reports.createDraft(owner.id, "MESSAGING_BROKER");
    const ref = draft.publicRef;

    await reports.saveWhatHappened(owner.id, ref, { scamType: "MESSAGING_BROKER", narrative: "A mentor on Telegram asked for a release fee.", occurredAt: new Date("2026-09-01"), country: "GB", lossBand: "FROM_1K_TO_10K" });
    await reports.saveContact(owner.id, ref, { channel: "TELEGRAM", handle: "@Crypto_Mentor", website: "https://www.fake-app.com/login" });
    await reports.saveContact(owner.id, ref, { channel: "TELEGRAM", handle: "@Crypto_Mentor", website: "https://www.fake-app.com/login" }); // re-save replaces
    await reports.addPayment(owner.id, ref, { amount: "2500", asset: "USDT", network: "TRON (TRC-20)", toAddress: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", txHash: "", sentAt: null });
    await expect(reports.addPayment(owner.id, ref, { amount: null, asset: "USDT", network: null, toAddress: "not-a-wallet", txHash: "", sentAt: null })).rejects.toThrow(reports.ReportError);

    let full = (await reports.getUserReport(owner.id, ref))!;
    expect(full.indicators.map((i) => `${i.kind}:${i.normalizedValue}`).sort()).toEqual(["DOMAIN:fake-app.com", "TELEGRAM:crypto_mentor", "WALLET:TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"]);
    expect(reports.narrativeOf(full)).toContain("release fee");
    expect(full.narrativeEnc).not.toContain("release fee");

    // Evidence: content-checked, encrypted at rest, readable only by the owner
    await expect(reports.addEvidence(owner.id, ref, [new File([Buffer.from("MZ\x90\x00 evil")], "invoice.png")])).rejects.toThrow(/isn't a PNG/);
    await reports.addEvidence(owner.id, ref, [new File([PNG], "../../chat.png")]);
    full = (await reports.getUserReport(owner.id, ref))!;
    const file = full.evidence[0]!;
    expect(reports.evidenceName(file)).toBe("chat.png");
    const stored = await storage().get(file.storageKey);
    expect(stored.includes(PNG.subarray(0, 16))).toBe(false);
    expect((await reports.readUserEvidence(owner.id, ref, file.id))!.bytes.equals(PNG)).toBe(true);
    expect(await reports.readUserEvidence(other.id, ref, file.id)).toBeNull();
    expect(await reports.getUserReport(other.id, ref)).toBeNull();
    await expect(reports.saveContact(other.id, ref, { channel: null, handle: "", website: "" })).rejects.toThrow("Report not found.");

    // Removing a payment removes its wallet indicator
    await reports.removePayment(owner.id, ref, full.payments[0]!.id);
    expect((await reports.getUserReport(owner.id, ref))!.indicators.some((i) => i.kind === "WALLET")).toBe(false);

    // Messages only after sending; research consent required
    await expect(reports.addUserMessage(owner.id, ref, "hello")).rejects.toThrow(/Send the report first/);
    await expect(reports.submitReport(owner.id, ref, { researchConsent: false, publicAlertConsent: false })).rejects.toThrow(/research/);
    await reports.submitReport(owner.id, ref, { researchConsent: true, publicAlertConsent: true });
    const sent = (await reports.getUserReport(owner.id, ref))!;
    expect(sent.status).toBe("RECEIVED");
    expect(sent.researchConsentAt).not.toBeNull();
    await expect(reports.saveContact(owner.id, ref, { channel: null, handle: "", website: "" })).rejects.toThrow(/can no longer be edited/);
    await expect(reports.submitReport(owner.id, ref, { researchConsent: true, publicAlertConsent: false })).rejects.toThrow();

    await reports.addUserMessage(owner.id, ref, "I found the transaction ID.");
    const msg = (await reports.getUserReport(owner.id, ref))!.messages[0]!;
    expect(reports.messageText(msg)).toBe("I found the transaction ID.");

    // Erasure removes the stored file too
    await reports.deleteUserReport(owner.id, ref);
    expect(await reports.getUserReport(owner.id, ref)).toBeNull();
    await expect(storage().get(file.storageKey)).rejects.toThrow();
  });

  it("requires a confirmed email before a report can be sent", async () => {
    await accounts.registerUser("unverified@example.com", PASSWORD);
    const user = await prisma.user.findFirstOrThrow({ where: { emailVerifiedAt: null } });
    const draft = await reports.createDraft(user.id, "UNSURE");
    await expect(reports.submitReport(user.id, draft.publicRef, { researchConsent: true, publicAlertConsent: false })).rejects.toThrow(/confirm your email/);
  });

  it("deletes an account with its reports when the password is right", async () => {
    const user = await verifiedUser("leaving@example.com");
    const draft = await reports.createDraft(user.id, "UNSURE");
    await reports.addEvidence(user.id, draft.publicRef, [new File([PNG], "a.png")]);
    const key = (await reports.getUserReport(user.id, draft.publicRef))!.evidence[0]!.storageKey;
    expect(await accounts.deleteAccount(user.id, "wrong password!!")).toBe(false);
    expect(await accounts.deleteAccount(user.id, PASSWORD)).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.report.count({ where: { id: draft.id } })).toBe(0);
    await expect(storage().get(key)).rejects.toThrow();
  });
});

describe("audit log", () => {
  it("records security events in an intact hash chain", async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { id: "asc" } });
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["user.registered", "user.locked", "user.two_step_enabled", "report.submitted", "user.deleted"]));
    const chain: AuditRow[] = rows.map((r) => ({
      actorType: r.actorType as AuditRow["actorType"],
      actorId: r.actorId,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      ip: r.ip,
      at: r.at.toISOString(),
      ...(r.detail === null ? {} : { detail: r.detail as Record<string, unknown> }),
      prevHash: r.prevHash,
      hash: r.hash,
    }));
    expect(verifyAuditChain(chain)).toBe(-1);
  });
});
