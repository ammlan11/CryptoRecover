import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cleanFileName, MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES, sniffEvidenceType } from "@kurotrace/core/files";
import { normalizeIndicator } from "@kurotrace/core/indicators";
import { generatePublicRef } from "@kurotrace/core/tokens";
import { prisma, type ContactChannel, type IndicatorKind, type LossBand, type Prisma, type ScamType } from "@kurotrace/db";
import { decryptFile, decryptText, encryptFile, encryptText } from "@kurotrace/services/crypto";
import { userEvent } from "@kurotrace/services/audit";
import { aad, evidenceName, messageText, narrativeOf } from "@kurotrace/services/records";
import { scanEvidence } from "@kurotrace/services/malware";
import { storage } from "@kurotrace/services/storage";

export { evidenceName, messageText, narrativeOf };

export const MAX_NARRATIVE = 20_000;
export const MAX_MESSAGE = 5_000;
export const MAX_PAYMENTS = 20;
export const MAX_OPEN_DRAFTS = 5;

export class ReportError extends Error {}

const narrativeAad = aad.narrative;
const messageAad = aad.message;
const fileAad = aad.file;
const fileNameAad = aad.fileName;

const fullInclude = {
  payments: { orderBy: { createdAt: "asc" }, include: { indicators: true } },
  indicators: { orderBy: { createdAt: "asc" } },
  evidence: { orderBy: { createdAt: "asc" } },
  messages: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.ReportInclude;

export type FullReport = Prisma.ReportGetPayload<{ include: typeof fullInclude }>;

/** Loads one of the user's own reports by its public reference. Anyone else's report is "not found". */
export async function getUserReport(userId: string, publicRef: string): Promise<FullReport | null> {
  if (!/^DM-[2-9A-HJ-NP-Z]{5}$/.test(publicRef)) return null;
  return prisma.report.findFirst({ where: { publicRef, userId }, include: fullInclude });
}

async function editableReport(userId: string, publicRef: string) {
  const report = await prisma.report.findFirst({ where: { publicRef, userId }, select: { id: true, status: true, lastStep: true } });
  if (!report) throw new ReportError("Report not found.");
  if (report.status !== "DRAFT") throw new ReportError("This report has been sent and can no longer be edited. Add anything new as a message.");
  return report;
}

const reachStep = (current: number, step: number) => Math.max(current, Math.min(step, 5));

export async function listUserReports(userId: string) {
  return prisma.report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { publicRef: true, status: true, scamType: true, createdAt: true, submittedAt: true, lossBand: true, _count: { select: { payments: true, messages: true } } },
  });
}

export async function createDraft(userId: string, scamType: ScamType, leadId?: string) {
  const open = await prisma.report.count({ where: { userId, status: "DRAFT" } });
  if (open >= MAX_OPEN_DRAFTS) throw new ReportError("You have several unfinished reports. Finish or delete one before starting another.");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const report = await prisma.report.create({ data: { userId, scamType, publicRef: generatePublicRef() } });
      if (leadId) await prisma.lead.updateMany({ where: { id: leadId, convertedReportId: null }, data: { convertedReportId: report.id } });
      await userEvent(userId, "report.created", "report", report.id);
      return report;
    } catch (error) {
      if (attempt === 4) throw error; // reference collision: try a new one
    }
  }
  throw new ReportError("Could not create the report.");
}

export async function saveWhatHappened(
  userId: string,
  publicRef: string,
  input: { scamType: ScamType; narrative: string; occurredAt: Date | null; country: string | null; lossBand: LossBand | null },
) {
  const report = await editableReport(userId, publicRef);
  if (input.narrative.length > MAX_NARRATIVE) throw new ReportError(`Please keep your description under ${MAX_NARRATIVE.toLocaleString()} characters.`);
  await prisma.report.update({
    where: { id: report.id },
    data: {
      scamType: input.scamType,
      narrativeEnc: input.narrative.trim() ? encryptText(input.narrative.trim(), narrativeAad(report.id)) : null,
      occurredAt: input.occurredAt,
      country: input.country,
      lossBand: input.lossBand,
      lastStep: reachStep(report.lastStep, 2),
    },
  });
}

/** Contact details become indicators (handle, phone, website). Saving again replaces them. */
export async function saveContact(userId: string, publicRef: string, input: { channel: ContactChannel | null; handle: string; website: string }) {
  const report = await editableReport(userId, publicRef);
  const indicators: { kind: IndicatorKind; value: string; normalizedValue: string; chain: string | null }[] = [];
  for (const raw of [input.handle, input.website]) {
    if (!raw.trim()) continue;
    const n = normalizeIndicator(raw);
    if (!n) throw new ReportError("One of the details could not be read. Check it and try again.");
    indicators.push({ kind: n.kind, value: raw.trim().slice(0, 512), normalizedValue: n.normalizedValue, chain: n.chain ?? null });
  }
  await prisma.$transaction([
    prisma.reportIndicator.deleteMany({ where: { reportId: report.id, paymentId: null } }),
    prisma.reportIndicator.createMany({ data: indicators.map((i) => ({ ...i, reportId: report.id })) }),
    prisma.report.update({ where: { id: report.id }, data: { contactChannel: input.channel, lastStep: reachStep(report.lastStep, 3) } }),
  ]);
}

export async function addPayment(
  userId: string,
  publicRef: string,
  input: { amount: string | null; asset: string; network: string | null; toAddress: string; txHash: string; sentAt: Date | null },
) {
  const report = await editableReport(userId, publicRef);
  if ((await prisma.reportPayment.count({ where: { reportId: report.id } })) >= MAX_PAYMENTS) throw new ReportError(`You can add up to ${MAX_PAYMENTS} payments.`);
  const indicators: Prisma.ReportIndicatorCreateWithoutPaymentInput[] = [];
  for (const [raw, expect] of [[input.toAddress, "WALLET"], [input.txHash, "TX_HASH"]] as const) {
    if (!raw.trim()) continue;
    const n = normalizeIndicator(raw);
    if (!n || n.kind !== expect) {
      throw new ReportError(expect === "WALLET" ? "That doesn't look like a wallet address. Check it and try again." : "That doesn't look like a transaction ID.");
    }
    indicators.push({ kind: n.kind, value: raw.trim(), normalizedValue: n.normalizedValue, chain: n.chain ?? null, report: { connect: { id: report.id } } });
  }
  await prisma.reportPayment.create({
    data: {
      reportId: report.id,
      amount: input.amount,
      asset: input.asset,
      network: input.network,
      sentAt: input.sentAt,
      indicators: { create: indicators },
    },
  });
}

export async function removePayment(userId: string, publicRef: string, paymentId: string) {
  const report = await editableReport(userId, publicRef);
  await prisma.reportPayment.deleteMany({ where: { id: paymentId, reportId: report.id } }); // its indicators cascade
}

export async function finishPayments(userId: string, publicRef: string) {
  const report = await editableReport(userId, publicRef);
  await prisma.report.update({ where: { id: report.id }, data: { lastStep: reachStep(report.lastStep, 4) } });
}

/** Validates by content, encrypts, stores privately. Files never touch a public URL. */
export async function addEvidence(userId: string, publicRef: string, files: File[]) {
  const report = await editableReport(userId, publicRef);
  const existing = await prisma.evidence.count({ where: { reportId: report.id } });
  const incoming = files.filter((f) => f.size > 0);
  if (incoming.length === 0) throw new ReportError("Choose at least one file.");
  if (existing + incoming.length > MAX_EVIDENCE_FILES) throw new ReportError(`You can attach up to ${MAX_EVIDENCE_FILES} files.`);
  // Check every file first, so one bad file means nothing from this batch is stored.
  const checked = [];
  for (const file of incoming) {
    if (file.size > MAX_EVIDENCE_BYTES) throw new ReportError(`"${cleanFileName(file.name)}" is larger than 10 MB.`);
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = sniffEvidenceType(bytes);
    if (!type) throw new ReportError(`"${cleanFileName(file.name)}" isn't a PNG, JPG, WebP or PDF file.`);
    const scan = await scanEvidence(bytes);
    if (scan.status === "INFECTED") {
      await userEvent(userId, "evidence.rejected_malware", "report", report.id, { signature: scan.signature, sha256: createHash("sha256").update(bytes).digest("hex") });
      throw new ReportError(`"${cleanFileName(file.name)}" was flagged by our virus scanner and wasn't uploaded. If it's a screenshot, try taking it again.`);
    }
    checked.push({ name: cleanFileName(file.name), bytes, mime: type.mime, scanStatus: scan.status });
  }
  for (const file of checked) {
    const storageKey = `evidence/${report.id}/${randomUUID()}`;
    await storage().put(storageKey, encryptFile(file.bytes, fileAad(storageKey)));
    await prisma.evidence.create({
      data: {
        reportId: report.id,
        storageKey,
        mimeType: file.mime,
        sizeBytes: file.bytes.length,
        sha256: createHash("sha256").update(file.bytes).digest("hex"),
        fileNameEnc: encryptText(file.name, fileNameAad(storageKey)),
        scanStatus: file.scanStatus,
      },
    });
  }
}

export async function removeEvidence(userId: string, publicRef: string, evidenceId: string) {
  const report = await editableReport(userId, publicRef);
  const file = await prisma.evidence.findFirst({ where: { id: evidenceId, reportId: report.id } });
  if (!file) return;
  await storage().remove(file.storageKey).catch(() => {});
  await prisma.evidence.delete({ where: { id: file.id } });
}

export async function finishEvidence(userId: string, publicRef: string) {
  const report = await editableReport(userId, publicRef);
  await prisma.report.update({ where: { id: report.id }, data: { lastStep: reachStep(report.lastStep, 5) } });
}

/** Downloads the owner's own file, decrypted. */
export async function readUserEvidence(userId: string, publicRef: string, evidenceId: string) {
  const file = await prisma.evidence.findFirst({ where: { id: evidenceId, report: { publicRef, userId } } });
  if (!file) return null;
  const bytes = decryptFile(await storage().get(file.storageKey), fileAad(file.storageKey));
  return { bytes, mimeType: file.mimeType, name: decryptText(file.fileNameEnc, fileNameAad(file.storageKey)) };
}



/** Sends the report for review. Research consent and a verified email are required. */
export async function submitReport(userId: string, publicRef: string, input: { researchConsent: boolean; publicAlertConsent: boolean }) {
  const report = await editableReport(userId, publicRef);
  if (!input.researchConsent) throw new ReportError("Please agree to the research use of your report to send it.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!user.emailVerifiedAt) throw new ReportError("Please confirm your email address first. We sent you a link when you signed up.");
  const now = new Date();
  const { count } = await prisma.report.updateMany({
    where: { id: report.id, status: "DRAFT" },
    data: { status: "RECEIVED", submittedAt: now, researchConsentAt: now, publicAlertConsentAt: input.publicAlertConsent ? now : null, lastStep: 5 },
  });
  if (count !== 1) throw new ReportError("This report was already sent.");
  await userEvent(userId, "report.submitted", "report", report.id, { publicAlertConsent: input.publicAlertConsent });
}

export async function addUserMessage(userId: string, publicRef: string, body: string) {
  const text = body.trim();
  if (!text) throw new ReportError("Write a message first.");
  if (text.length > MAX_MESSAGE) throw new ReportError(`Please keep messages under ${MAX_MESSAGE.toLocaleString()} characters.`);
  const report = await prisma.report.findFirst({ where: { publicRef, userId }, select: { id: true, status: true } });
  if (!report) throw new ReportError("Report not found.");
  if (report.status === "DRAFT") throw new ReportError("Send the report first; then you can message our team.");
  await prisma.message.create({ data: { reportId: report.id, authorType: "USER", bodyEnc: encryptText(text, messageAad(report.id)) } });
}


/** Marks staff messages as read when the owner opens the report. */
export async function markStaffMessagesRead(reportId: string) {
  await prisma.message.updateMany({ where: { reportId, authorType: "STAFF", readAt: null }, data: { readAt: new Date() } });
}

/** Deletes a report and its evidence files entirely (the owner's right to erasure). */
export async function deleteUserReport(userId: string, publicRef: string) {
  const report = await prisma.report.findFirst({ where: { publicRef, userId }, include: { evidence: true } });
  if (!report) return;
  for (const file of report.evidence) await storage().remove(file.storageKey).catch(() => {});
  await prisma.report.delete({ where: { id: report.id } });
  await userEvent(userId, "report.deleted", "report", report.id);
}

export async function createIssue(userId: string | null, category: "SITE_PROBLEM" | "COMPLAINT" | "DATA_REQUEST" | "OTHER", body: string) {
  const text = body.trim();
  if (text.length < 5) throw new ReportError("Tell us a little more so we can help.");
  if (text.length > MAX_MESSAGE) throw new ReportError(`Please keep it under ${MAX_MESSAGE.toLocaleString()} characters.`);
  const issue = await prisma.issue.create({ data: { userId, category, bodyEnc: encryptText(text, aad.issue()) } });
  if (userId) await userEvent(userId, "issue.created", "issue", issue.id, { category });
  return issue;
}
