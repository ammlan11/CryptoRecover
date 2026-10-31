/**
 * Admin terminal flows against a real MySQL database (CI "integration" job).
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@demo/core/password";
import { generatePublicRef } from "@demo/core/tokens";
import { generateTotpSecret, totpAt } from "@demo/core/totp";
import { prisma, type StaffRole } from "@demo/db";

process.env.EMAIL_PROVIDER = "memory";
process.env.EVIDENCE_STORAGE = "local";
process.env.EVIDENCE_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), "admin-evidence-"));
vi.stubGlobal("fetch", async () => ({ ok: true, text: async () => "" })); // breach check: not breached

const { outbox } = await import("@demo/services/email");
const { encryptText } = await import("@demo/services/crypto");
const { aad, messageText } = await import("@demo/services/records");
const auth = await import("@/server/staff-auth");
const cases = await import("@/server/cases");
const insights = await import("@/server/insights");
const { Forbidden } = await import("@/lib/permissions");

const PASSWORD = "staff passphrase that is long";
const IP = "198.51.100.7";
const secrets = new Map<string, string>();

async function makeStaff(username: string, role: StaffRole, extra: { allowedIps?: string; organisation?: string } = {}) {
  const secret = generateTotpSecret();
  const s = await prisma.staff.create({ data: { username, role, passwordHash: await hashPassword(PASSWORD), activatedAt: new Date(), ...extra } });
  await prisma.staff.update({ where: { id: s.id }, data: { totpSecretEnc: encryptText(secret, aad.staffTotp(s.id)) } });
  secrets.set(s.id, secret);
  return s;
}

/** A valid, never-used code: clears the replay marker first. */
async function code(staffId: string) {
  await prisma.staff.update({ where: { id: staffId }, data: { totpLastStep: null } });
  return totpAt(secrets.get(staffId)!, Date.now());
}

async function makeReport(opts: { email?: string; status?: "RECEIVED" | "DRAFT"; wallet?: string } = {}) {
  const email = opts.email ?? `r${Math.random().toString(36).slice(2, 8)}@example.com`;
  const user = await prisma.user.create({
    data: { emailHash: `h-${email}`.padEnd(64, "0").slice(0, 64), emailEnc: encryptText(email, aad.userEmail()), passwordHash: "x", emailVerifiedAt: new Date() },
  });
  const report = await prisma.report.create({
    data: { publicRef: generatePublicRef(), userId: user.id, scamType: "MESSAGING_BROKER", status: opts.status ?? "RECEIVED", submittedAt: new Date(), researchConsentAt: new Date() },
  });
  await prisma.report.update({ where: { id: report.id }, data: { narrativeEnc: encryptText("Mentor asked for a release fee", aad.narrative(report.id)) } });
  const wallet = opts.wallet ?? "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE";
  await prisma.reportIndicator.create({ data: { reportId: report.id, kind: "WALLET", value: wallet, normalizedValue: wallet, chain: "tron" } });
  return { report, user, email };
}

beforeAll(async () => {
  await prisma.$transaction([prisma.auditLog.deleteMany(), prisma.lead.deleteMany(), prisma.report.deleteMany(), prisma.user.deleteMany(), prisma.staff.deleteMany()]);
});
beforeEach(() => {
  outbox.length = 0;
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("staff sign-in", () => {
  it("needs the right password and a fresh authenticator code, and locks after 5 failures", async () => {
    const owner = await makeStaff("owner", "OWNER");
    expect(await auth.staffLogin("owner", PASSWORD, await code(owner.id), IP)).toEqual({ ok: true, staffId: owner.id });
    expect(await auth.staffLogin("nobody", PASSWORD, "123456", IP)).toEqual({ ok: false, reason: "invalid" });
    expect(await auth.staffLogin("owner", PASSWORD, "000000", IP)).toEqual({ ok: false, reason: "invalid" });
    for (let i = 0; i < 3; i++) await auth.staffLogin("owner", "wrong password!!", "000000", IP);
    expect(await auth.staffLogin("owner", "wrong password!!", "000000", IP)).toEqual({ ok: false, reason: "locked" });
    expect(await auth.staffLogin("owner", PASSWORD, await code(owner.id), IP)).toEqual({ ok: false, reason: "locked" });
    await prisma.staff.update({ where: { id: owner.id }, data: { lockedUntil: null } });
  });

  it("refuses a replayed code and honours a per-person IP restriction", async () => {
    const owner = await prisma.staff.findUniqueOrThrow({ where: { username: "owner" } });
    const c = await code(owner.id);
    expect((await auth.staffLogin("owner", PASSWORD, c, IP)).ok).toBe(true);
    expect((await auth.staffLogin("owner", PASSWORD, c, IP)).ok).toBe(false);
    const fenced = await makeStaff("fenced", "REVIEWER", { allowedIps: "203.0.113.0/24" });
    expect((await auth.staffLogin("fenced", PASSWORD, await code(fenced.id), IP)).ok).toBe(false);
    expect((await auth.staffLogin("fenced", PASSWORD, await code(fenced.id), "203.0.113.20")).ok).toBe(true);
  });

  it("binds sessions to the IP they were created on and expires them when idle", async () => {
    const owner = await prisma.staff.findUniqueOrThrow({ where: { username: "owner" } });
    const token = await auth.createStaffSession(owner.id, IP, "test");
    expect((await auth.resolveStaffSession(token, IP))?.staffId).toBe(owner.id);
    expect(await auth.resolveStaffSession(token, "203.0.113.99")).toBeNull();
    expect(await auth.resolveStaffSession(token, IP)).toBeNull(); // the mismatch ended it
    const t2 = await auth.createStaffSession(owner.id, IP, "test");
    await prisma.staffSession.updateMany({ data: { lastSeenAt: new Date(Date.now() - 3 * 3_600_000) } });
    expect(await auth.resolveStaffSession(t2, IP)).toBeNull();
  });

  it("onboards invited staff with a one-time link: password plus authenticator", async () => {
    const owner = await prisma.staff.findUniqueOrThrow({ where: { username: "owner" } });
    const { staffId, token } = await auth.inviteStaff(owner.id, IP, { username: "Inv.Firm", role: "INVESTIGATOR", organisation: "Acme Investigations" });
    expect((await auth.staffLogin("inv.firm", PASSWORD, "000000", IP)).ok).toBe(false); // not active yet
    const setup = (await auth.inviteAuthenticator(token))!;
    expect(setup.username).toBe("inv.firm");
    expect((await auth.completeInvite(token, "short", totpAt(setup.secret, Date.now()), IP)).ok).toBe(false);
    expect(await auth.completeInvite(token, PASSWORD, totpAt(setup.secret, Date.now()), IP)).toEqual({ ok: true });
    expect((await auth.completeInvite(token, PASSWORD, totpAt(setup.secret, Date.now() + 30_000), IP)).ok).toBe(false);
    secrets.set(staffId, setup.secret);
    expect((await auth.staffLogin("inv.firm", PASSWORD, await code(staffId), IP)).ok).toBe(true);
  });

  it("re-authentication refreshes the session's confirmation time", async () => {
    const owner = await prisma.staff.findUniqueOrThrow({ where: { username: "owner" } });
    const token = await auth.createStaffSession(owner.id, IP, null);
    const session = (await auth.resolveStaffSession(token, IP))!;
    await prisma.staffSession.update({ where: { id: session.id }, data: { reauthenticatedAt: new Date(Date.now() - 3_600_000) } });
    expect(auth.recentlyReauthenticated((await auth.resolveStaffSession(token, IP))!)).toBe(false);
    expect(await auth.reauthenticate(session.id, owner.id, PASSWORD, await code(owner.id), IP)).toBe(true);
    expect(auth.recentlyReauthenticated((await auth.resolveStaffSession(token, IP))!)).toBe(true);
  });
});

describe("cases and roles", () => {
  it("keeps investigators to their assigned cases and away from reporter contact details", async () => {
    const reviewer = await makeStaff("reviewer", "REVIEWER");
    const investigator = await prisma.staff.findUniqueOrThrow({ where: { username: "inv.firm" } });
    const { report, email } = await makeReport({ email: "victim@example.com" });
    const { report: other } = await makeReport();
    const draft = await makeReport({ status: "DRAFT" });

    expect(await cases.openCase(investigator, IP, report.publicRef)).toBeNull();
    expect((await cases.listQueue(investigator, {})).total).toBe(0);
    expect(await cases.openCase(reviewer, IP, draft.report.publicRef)).toBeNull(); // drafts are private
    await expect(cases.revealReporterEmail(investigator, IP, report.publicRef)).rejects.toThrow(Forbidden);
    await expect(cases.changeStatus(investigator, IP, report.publicRef, "CLOSED")).rejects.toThrow(Forbidden);
    expect(await cases.revealReporterEmail(reviewer, IP, report.publicRef)).toBe(email);

    await expect(cases.changeStatus(reviewer, IP, report.publicRef, "WITH_INVESTIGATORS")).rejects.toThrow(/Assign the report to an investigator/);
    await cases.assign(reviewer, IP, report.publicRef, investigator.id);
    await cases.changeStatus(reviewer, IP, report.publicRef, "WITH_INVESTIGATORS");

    const opened = await cases.openCase(investigator, IP, report.publicRef);
    expect(opened?.id).toBe(report.id);
    expect(await cases.openCase(investigator, IP, other.publicRef)).toBeNull();
    expect((await cases.listQueue(investigator, {})).rows.map((r) => r.publicRef)).toEqual([report.publicRef]);
    await cases.addNote(investigator, IP, report.publicRef, "Same wallet as three other reports.");
    await cases.setPattern(investigator, IP, report.publicRef, "Fee To Withdraw!");
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).scamPattern).toBe("fee-to-withdraw");
    await expect(cases.replyToUser(investigator, IP, report.publicRef, "hi")).rejects.toThrow(Forbidden);
    await cases.returnToInHouse(investigator, IP, report.publicRef);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe("IN_HOUSE_REVIEW");
  });

  it("messages and status changes notify the reporter without revealing content", async () => {
    const reviewer = await prisma.staff.findUniqueOrThrow({ where: { username: "reviewer" } });
    const { report } = await makeReport({ email: "notify@example.com" });
    await cases.replyToUser(reviewer, IP, report.publicRef, "Could you share the transaction ID?");
    const stored = await prisma.message.findFirstOrThrow({ where: { reportId: report.id } });
    expect(stored.bodyEnc).not.toContain("transaction ID");
    expect(messageText(stored)).toBe("Could you share the transaction ID?");
    expect(outbox.at(-1)).toMatchObject({ to: "notify@example.com", subject: `New message about report ${report.publicRef}` });
    expect(outbox.at(-1)!.text).not.toContain("transaction ID");

    await cases.changeStatus(reviewer, IP, report.publicRef, "INFO_NEEDED");
    expect(outbox.at(-1)!.subject).toContain("We have a question");
    await cases.changeStatus(reviewer, IP, report.publicRef, "CLOSED");
    expect(outbox.at(-1)!.subject).toContain("is closed");
    await expect(cases.changeStatus(reviewer, IP, report.publicRef, "INFO_NEEDED")).rejects.toThrow(/isn't allowed/);
  });

  it("confirmed indicators are what the public checker counts", async () => {
    const reviewer = await prisma.staff.findUniqueOrThrow({ where: { username: "reviewer" } });
    const wallet = "0x" + "ab".repeat(20);
    await makeReport({ wallet });
    await makeReport({ wallet });
    const checker = () => prisma.reportIndicator.count({ where: { kind: "WALLET", normalizedValue: wallet, confirmedAt: { not: null } } });
    expect(await checker()).toBe(0);
    const row = (await cases.listIndicators(reviewer, { q: wallet }))[0]!;
    expect(row).toMatchObject({ reports: 2, confirmed: 0 });
    expect(await cases.setIndicatorConfirmedEverywhere(reviewer, IP, "WALLET", wallet, true)).toBe(2);
    expect(await checker()).toBe(2);
    expect(await cases.setIndicatorConfirmedEverywhere(reviewer, IP, "WALLET", wallet, false)).toBe(2);
    expect(await checker()).toBe(0);
  });

  it("lets only the owner export leads, with formulas neutralised", async () => {
    const owner = await prisma.staff.findUniqueOrThrow({ where: { username: "owner" } });
    const reviewer = await prisma.staff.findUniqueOrThrow({ where: { username: "reviewer" } });
    await prisma.lead.create({ data: { source: "CAMPAIGN_FORM", emailHash: "x".repeat(64), emailEnc: encryptText("lead@example.com", aad.leadEmail()), utmCampaign: "=HYPERLINK(\"evil\")", gclid: "abc" } });
    await expect(insights.exportLeadsCsv(reviewer, IP)).rejects.toThrow(Forbidden);
    const csv = await insights.exportLeadsCsv(owner, IP);
    expect(csv).toContain('"lead@example.com"');
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
  });

  it("writes staff actions with their IP into an intact audit chain", async () => {
    const owner = await prisma.staff.findUniqueOrThrow({ where: { username: "owner" } });
    const rows = await prisma.auditLog.findMany({ where: { actorType: "staff" } });
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["staff.login", "staff.login_failed", "staff.locked", "staff.session_ip_mismatch", "staff.invited", "staff.activated", "report.viewed", "report.assigned", "report.message_sent", "reporter.email_viewed", "leads.exported"]));
    expect(rows.filter((r) => r.action === "report.viewed").every((r) => r.ip === IP)).toBe(true);
    expect(await insights.verifyAuditLog(owner, IP)).toMatchObject({ brokenAtId: null });
  });
});
