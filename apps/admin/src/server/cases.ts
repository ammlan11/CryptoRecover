import "server-only";
import { prisma, type Prisma, type ReportStatus, type ScamType, type Staff } from "@kurotrace/db";
import { decryptFile, decryptText, encryptText } from "@kurotrace/services/crypto";
import { sendEmail, templates } from "@kurotrace/services/email";
import { aad } from "@kurotrace/services/records";
import { staffMayOpen } from "@kurotrace/services/malware";
import { storage } from "@kurotrace/services/storage";
import { can, Forbidden } from "@/lib/permissions";
import { staffEvent } from "./staff-auth";

type Actor = Pick<Staff, "id" | "role">;
const MAX_TEXT = 5_000;
export const PAGE_SIZE = 25;
const DAY = 86_400_000;

export class CaseError extends Error {}

/** Investigators only see reports assigned to them. Drafts are never visible to staff. */
function visibleTo(actor: Actor): Prisma.ReportWhereInput {
  const base: Prisma.ReportWhereInput = { status: { not: "DRAFT" } };
  return can(actor.role, "viewAnyReport") ? base : { ...base, assignedStaffId: actor.id };
}

export interface QueueFilter {
  status?: ReportStatus | "OVERDUE";
  scamType?: ScamType;
  assignee?: "me" | "none" | string;
  q?: string;
  page?: number;
}

export async function listQueue(actor: Actor, filter: QueueFilter) {
  if (!can(actor.role, "viewQueue") && actor.role !== "INVESTIGATOR") throw new Forbidden();
  const where: Prisma.ReportWhereInput[] = [visibleTo(actor)];
  if (filter.status === "OVERDUE") where.push(overdueWhere());
  else if (filter.status) where.push({ status: filter.status });
  if (filter.scamType) where.push({ scamType: filter.scamType });
  if (filter.assignee === "me") where.push({ assignedStaffId: actor.id });
  else if (filter.assignee === "none") where.push({ assignedStaffId: null });
  else if (filter.assignee) where.push({ assignedStaffId: filter.assignee });
  const q = filter.q?.trim();
  if (q) {
    // Search by reference or by any wallet/site/handle named in a report.
    where.push({ OR: [{ publicRef: q.toUpperCase() }, { indicators: { some: { normalizedValue: { contains: q.toLowerCase().slice(0, 128) } } } }] });
  }
  const page = Math.max(1, filter.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where: { AND: where },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        publicRef: true,
        status: true,
        scamType: true,
        scamPattern: true,
        country: true,
        lossBand: true,
        submittedAt: true,
        assignedStaff: { select: { username: true } },
        indicators: { take: 1, orderBy: { createdAt: "asc" }, select: { value: true, normalizedValue: true, kind: true } },
        messages: { where: { authorType: "STAFF" }, take: 1, select: { id: true } },
      },
    }),
    prisma.report.count({ where: { AND: where } }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function overdueWhere(): Prisma.ReportWhereInput {
  return { status: { in: ["RECEIVED", "IN_HOUSE_REVIEW"] }, submittedAt: { lt: new Date(Date.now() - DAY) }, messages: { none: { authorType: "STAFF" } } };
}

/** Loads a case for a staff member, enforcing visibility, and writes a "viewed" audit entry. */
export async function openCase(actor: Actor, ip: string, publicRef: string) {
  if (!/^DM-[2-9A-HJ-NP-Z]{5}$/.test(publicRef)) return null;
  const report = await prisma.report.findFirst({
    where: { AND: [visibleTo(actor), { publicRef }] },
    include: {
      payments: { orderBy: { createdAt: "asc" } },
      indicators: { orderBy: { createdAt: "asc" }, include: { confirmedBy: { select: { username: true } } } },
      evidence: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" }, include: { staff: { select: { username: true } } } },
      notes: { orderBy: { createdAt: "asc" }, include: { staff: { select: { username: true } } } },
      assignedStaff: { select: { id: true, username: true, role: true } },
      user: { select: { id: true, emailVerifiedAt: true, createdAt: true } },
    },
  });
  if (!report) return null;
  await staffEvent(actor.id, ip, "report.viewed", "report", report.id);
  return report;
}

async function caseFor(actor: Actor, publicRef: string) {
  const report = await prisma.report.findFirst({ where: { AND: [visibleTo(actor), { publicRef }] }, include: { user: { select: { id: true, emailEnc: true, phoneEnc: true } } } });
  if (!report) throw new CaseError("Report not found.");
  return report;
}

async function notifyUser(report: { user: { emailEnc: string } | null }, mail: ReturnType<(typeof templates)["newMessage"]>) {
  if (!report.user) return;
  await sendEmail({ to: decryptText(report.user.emailEnc, aad.userEmail()), ...mail }).catch((e) => console.error("notify failed", e instanceof Error ? e.message : e));
}

const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT: [],
  RECEIVED: ["IN_HOUSE_REVIEW", "INFO_NEEDED", "WITH_INVESTIGATORS", "CLOSED"],
  IN_HOUSE_REVIEW: ["INFO_NEEDED", "WITH_INVESTIGATORS", "CLOSED"],
  INFO_NEEDED: ["IN_HOUSE_REVIEW", "WITH_INVESTIGATORS", "CLOSED"],
  WITH_INVESTIGATORS: ["IN_HOUSE_REVIEW", "INFO_NEEDED", "CLOSED"],
  CLOSED: ["IN_HOUSE_REVIEW"],
};

export async function changeStatus(actor: Actor, ip: string, publicRef: string, next: ReportStatus) {
  if (!can(actor.role, "changeStatus")) throw new Forbidden();
  const report = await caseFor(actor, publicRef);
  if (!TRANSITIONS[report.status].includes(next)) throw new CaseError("That status change isn't allowed from here.");
  if (next === "WITH_INVESTIGATORS") {
    const assignee = report.assignedStaffId ? await prisma.staff.findUnique({ where: { id: report.assignedStaffId } }) : null;
    if (assignee?.role !== "INVESTIGATOR") throw new CaseError("Assign the report to an investigator first.");
  }
  await prisma.report.update({ where: { id: report.id }, data: { status: next, closedAt: next === "CLOSED" ? new Date() : null } });
  await staffEvent(actor.id, ip, "report.status_changed", "report", report.id, { from: report.status, to: next });
  if (next === "INFO_NEEDED") await notifyUser(report, templates.infoNeeded(report.publicRef));
  if (next === "CLOSED") await notifyUser(report, templates.reportClosed(report.publicRef));
}

/** Investigators hand a case back to the in-house team when their analysis is done. */
export async function returnToInHouse(actor: Actor, ip: string, publicRef: string) {
  if (!can(actor.role, "analyse")) throw new Forbidden();
  const report = await caseFor(actor, publicRef);
  if (report.status !== "WITH_INVESTIGATORS") throw new CaseError("Only cases with investigators can be handed back.");
  await prisma.report.update({ where: { id: report.id }, data: { status: "IN_HOUSE_REVIEW" } });
  await staffEvent(actor.id, ip, "report.returned_to_in_house", "report", report.id);
}

export async function assign(actor: Actor, ip: string, publicRef: string, staffId: string | null) {
  if (!can(actor.role, "assign")) throw new Forbidden();
  const report = await caseFor(actor, publicRef);
  if (staffId) {
    const target = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!target || target.disabledAt || !target.activatedAt || target.role === "VIEWER") throw new CaseError("Choose an active reviewer or investigator.");
  }
  await prisma.report.update({ where: { id: report.id }, data: { assignedStaffId: staffId } });
  await staffEvent(actor.id, ip, "report.assigned", "report", report.id, { to: staffId });
}

export async function replyToUser(actor: Actor, ip: string, publicRef: string, body: string) {
  if (!can(actor.role, "messageUser")) throw new Forbidden();
  const text = body.trim();
  if (!text || text.length > MAX_TEXT) throw new CaseError(`Write a message of up to ${MAX_TEXT.toLocaleString()} characters.`);
  const report = await caseFor(actor, publicRef);
  await prisma.message.create({ data: { reportId: report.id, authorType: "STAFF", staffId: actor.id, bodyEnc: encryptText(text, aad.message(report.id)) } });
  await staffEvent(actor.id, ip, "report.message_sent", "report", report.id);
  await notifyUser(report, templates.newMessage(report.publicRef));
}

export async function addNote(actor: Actor, ip: string, publicRef: string, body: string) {
  if (!can(actor.role, "analyse")) throw new Forbidden();
  const text = body.trim();
  if (!text || text.length > MAX_TEXT) throw new CaseError(`Write a note of up to ${MAX_TEXT.toLocaleString()} characters.`);
  const report = await caseFor(actor, publicRef);
  await prisma.internalNote.create({ data: { reportId: report.id, staffId: actor.id, bodyEnc: encryptText(text, aad.note(report.id)) } });
  await staffEvent(actor.id, ip, "report.note_added", "report", report.id);
}

export async function setPattern(actor: Actor, ip: string, publicRef: string, pattern: string) {
  if (!can(actor.role, "analyse")) throw new Forbidden();
  const value = pattern.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const report = await caseFor(actor, publicRef);
  await prisma.report.update({ where: { id: report.id }, data: { scamPattern: value || null } });
  await staffEvent(actor.id, ip, "report.pattern_set", "report", report.id, { pattern: value || null });
}

/** Confirmed indicators are what the public checker counts. */
export async function setIndicatorConfirmed(actor: Actor, ip: string, publicRef: string, indicatorId: string, confirmed: boolean) {
  if (!can(actor.role, "analyse")) throw new Forbidden();
  const report = await caseFor(actor, publicRef);
  const { count } = await prisma.reportIndicator.updateMany({
    where: { id: indicatorId, reportId: report.id },
    data: confirmed ? { confirmedAt: new Date(), confirmedById: actor.id } : { confirmedAt: null, confirmedById: null },
  });
  if (count !== 1) throw new CaseError("Indicator not found.");
  await staffEvent(actor.id, ip, confirmed ? "indicator.confirmed" : "indicator.unconfirmed", "indicator", indicatorId, { report: report.id });
}

/** Reveals the reporter's email to in-house staff only, and records who looked. */
export async function revealReporterEmail(actor: Actor, ip: string, publicRef: string) {
  if (!can(actor.role, "viewReporterEmail")) throw new Forbidden();
  const report = await caseFor(actor, publicRef);
  if (!report.user) return null;
  await staffEvent(actor.id, ip, "reporter.email_viewed", "report", report.id);
  const email = decryptText(report.user.emailEnc, aad.userEmail());
  const phone = report.user.phoneEnc ? decryptText(report.user.phoneEnc, aad.userPhone(report.user.id)) : null;
  return phone ? `${email} · ${phone}` : email;
}

/** Evidence for staff: visibility checked, infected files refused, every download audited. */
export async function readCaseEvidence(actor: Actor, ip: string, publicRef: string, evidenceId: string) {
  const file = await prisma.evidence.findFirst({ where: { id: evidenceId, report: { AND: [visibleTo(actor), { publicRef }] } } });
  if (!file) return null;
  if (file.scanStatus === "INFECTED") throw new CaseError("This file was flagged as malware and can't be downloaded.");
  if (!staffMayOpen(file.scanStatus)) throw new CaseError("This file hasn't been virus-scanned yet. Try again shortly.");
  const bytes = decryptFile(await storage().get(file.storageKey), aad.file(file.storageKey));
  await staffEvent(actor.id, ip, "evidence.downloaded", "evidence", file.id, { report: file.reportId });
  return { bytes, mimeType: file.mimeType, name: decryptText(file.fileNameEnc, aad.fileName(file.storageKey)), scanStatus: file.scanStatus };
}

// ─── Indicators across reports ──────────────────────────────────

export async function listIndicators(actor: Actor, filter: { q?: string; onlyUnconfirmed?: boolean }) {
  if (!can(actor.role, "viewIndicators")) throw new Forbidden();
  const where: Prisma.ReportIndicatorWhereInput = { report: { status: { not: "DRAFT" } } };
  if (filter.q?.trim()) where.normalizedValue = { contains: filter.q.trim().toLowerCase().slice(0, 128) };
  const groups = await prisma.reportIndicator.groupBy({
    by: ["kind", "normalizedValue"],
    where,
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { normalizedValue: "desc" } },
    take: 100,
  });
  const confirmed = await prisma.reportIndicator.groupBy({
    by: ["kind", "normalizedValue"],
    where: { ...where, confirmedAt: { not: null } },
    _count: { _all: true },
  });
  const confirmedMap = new Map(confirmed.map((c) => [`${c.kind}:${c.normalizedValue}`, c._count._all]));
  const rows = groups.map((g) => ({ kind: g.kind, value: g.normalizedValue, reports: g._count._all, confirmed: confirmedMap.get(`${g.kind}:${g.normalizedValue}`) ?? 0, lastSeen: g._max.createdAt }));
  return filter.onlyUnconfirmed ? rows.filter((r) => r.confirmed < r.reports) : rows;
}

/** Confirms (or clears) a wallet/site/handle on every submitted report that names it. */
export async function setIndicatorConfirmedEverywhere(actor: Actor, ip: string, kind: string, value: string, confirmed: boolean) {
  if (!can(actor.role, "viewIndicators") || !can(actor.role, "analyse")) throw new Forbidden();
  const where = { kind: kind as never, normalizedValue: value, report: { status: { not: "DRAFT" as const } } };
  const { count } = await prisma.reportIndicator.updateMany({
    where,
    data: confirmed ? { confirmedAt: new Date(), confirmedById: actor.id } : { confirmedAt: null, confirmedById: null },
  });
  await staffEvent(actor.id, ip, confirmed ? "indicator.confirmed_all" : "indicator.unconfirmed_all", "indicator", null, { kind, value, count });
  return count;
}
