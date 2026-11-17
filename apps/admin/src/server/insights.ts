import "server-only";
import { prisma, type IssueStatus, type LeadSource, type Staff } from "@kurotrace/db";
import { verifyAuditChain, type AuditRow } from "@kurotrace/core/audit";
import { decryptText, emailHashFor } from "@kurotrace/services/crypto";
import { EMAIL_LOG_CONTEXT } from "@kurotrace/services/email";
import { aad, issueText } from "@kurotrace/services/records";
import { can, Forbidden } from "@/lib/permissions";
import { overdueWhere } from "./cases";
import { staffEvent } from "./staff-auth";

type Actor = Pick<Staff, "id" | "role">;
const DAY = 86_400_000;

export async function dashboard(actor: Actor) {
  const since = new Date(Date.now() - 30 * DAY);
  const mine = actor.role === "INVESTIGATOR" ? { assignedStaffId: actor.id } : {};
  const [unassigned, waiting, withInvestigators, overdue, myCases, byType, byLoss, bySource, leads30, converted30, reports30] = await Promise.all([
    prisma.report.count({ where: { status: "RECEIVED", assignedStaffId: null } }),
    prisma.report.count({ where: { status: "INFO_NEEDED" } }),
    prisma.report.count({ where: { status: "WITH_INVESTIGATORS" } }),
    prisma.report.count({ where: overdueWhere() }),
    prisma.report.count({ where: { status: { notIn: ["DRAFT", "CLOSED"] }, assignedStaffId: actor.id } }),
    prisma.report.groupBy({ by: ["scamType"], where: { submittedAt: { gte: since }, ...mine }, _count: { _all: true } }),
    prisma.report.groupBy({ by: ["lossBand"], where: { submittedAt: { gte: since }, ...mine }, _count: { _all: true } }),
    can(actor.role, "viewLeads") ? prisma.lead.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { _all: true } }) : Promise.resolve([]),
    can(actor.role, "viewLeads") ? prisma.lead.count({ where: { createdAt: { gte: since } } }) : Promise.resolve(0),
    can(actor.role, "viewLeads") ? prisma.lead.count({ where: { createdAt: { gte: since }, convertedReportId: { not: null } } }) : Promise.resolve(0),
    prisma.report.count({ where: { submittedAt: { gte: since }, ...mine } }),
  ]);
  return {
    unassigned,
    waiting,
    withInvestigators,
    overdue,
    myCases,
    reports30,
    byType: byType.map((r) => ({ key: r.scamType, count: r._count._all })).sort((a, b) => b.count - a.count),
    byLoss: byLoss.map((r) => ({ key: r.lossBand ?? "NOT_GIVEN", count: r._count._all })),
    bySource: (bySource as { source: LeadSource; _count: { _all: number } }[]).map((r) => ({ key: r.source, count: r._count._all })),
    leads30,
    converted30,
  };
}

/** Emails sent by the site (type and outcome only), for the dashboard counter. */
export async function emailStats(actor: Actor) {
  if (!can(actor.role, "viewLeads")) return null;
  const now = Date.now();
  const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0));
  const week = new Date(now - 7 * DAY);
  const month = new Date(now - 30 * DAY);
  const [today, last7, last30, total, failed7, byKind] = await Promise.all([
    prisma.emailSend.count({ where: { ok: true, createdAt: { gte: startOfDay } } }),
    prisma.emailSend.count({ where: { ok: true, createdAt: { gte: week } } }),
    prisma.emailSend.count({ where: { ok: true, createdAt: { gte: month } } }),
    prisma.emailSend.count({ where: { ok: true } }),
    prisma.emailSend.count({ where: { ok: false, createdAt: { gte: week } } }),
    prisma.emailSend.groupBy({ by: ["kind"], where: { ok: true, createdAt: { gte: month } }, _count: { _all: true } }),
  ]);
  return {
    today,
    last7,
    last30,
    total,
    failed7,
    byKind: byKind.map((r) => ({ key: r.kind, count: r._count._all })).sort((a, b) => b.count - a.count),
  };
}

/**
 * Leads with their contact details. Staff who may see reporters' emails see them in full;
 * every such view is written to the audit log.
 */
export async function listLeads(actor: Actor, ip: string, filter: { source?: LeadSource; campaign?: string; email?: string }) {
  if (!can(actor.role, "viewLeads")) throw new Forbidden();
  const leads = await prisma.lead.findMany({
    where: {
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.campaign ? { utmCampaign: filter.campaign } : {}),
      ...(filter.email ? { emailHash: emailHashFor(filter.email, "lead.email") } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      source: true,
      scamType: true,
      lossBand: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      gclid: true,
      fbclid: true,
      landingPage: true,
      marketingConsent: true,
      whatsappOptIn: true,
      contactOptIn: true,
      emailEnc: true,
      phoneEnc: true,
      createdAt: true,
      convertedReport: { select: { publicRef: true, status: true } },
    },
  });
  const full = can(actor.role, "viewReporterEmail");
  if (full && leads.length) await staffEvent(actor.id, ip, "leads.viewed", "lead", null, { rows: leads.length, ...filter, email: filter.email ? "(searched)" : undefined });
  return leads.map(({ emailEnc, phoneEnc, ...l }) => {
    const email = decryptText(emailEnc, aad.leadEmail());
    const phone = phoneEnc ? decryptText(phoneEnc, aad.leadPhone()) : null;
    return { ...l, email: full ? email : maskEmail(email), phone: phone ? (full ? phone : maskPhone(phone)) : null };
  });
}

/** Emails the site sent, newest first: when, type, to whom, subject, outcome. Logged. */
export async function listEmails(actor: Actor, ip: string, filter: { kind?: string; to?: string; failed?: boolean }) {
  if (!can(actor.role, "viewReporterEmail")) throw new Forbidden();
  const rows = await prisma.emailSend.findMany({
    where: {
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.to ? { toHash: emailHashFor(filter.to, EMAIL_LOG_CONTEXT) } : {}),
      ...(filter.failed ? { ok: false } : {}),
    },
    orderBy: { id: "desc" },
    take: 300,
  });
  if (rows.length) await staffEvent(actor.id, ip, "emails.viewed", "email", null, { rows: rows.length, kind: filter.kind, to: filter.to ? "(searched)" : undefined });
  return rows.map((r) => ({
    id: r.id.toString(),
    kind: r.kind,
    ok: r.ok,
    subject: r.subject,
    createdAt: r.createdAt,
    to: r.toEnc ? safeDecrypt(r.toEnc, EMAIL_LOG_CONTEXT) : null,
  }));
}

function safeDecrypt(token: string, context: string) {
  try {
    return decryptText(token, context);
  } catch {
    return "(unreadable)";
  }
}

/** "a•••@gmail.com" */
function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

/** "+971 ••• 567" */
function maskPhone(e164: string) {
  return `${e164.slice(0, 4)} ••• ${e164.slice(-3)}`;
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formulas (CSV injection) and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Owner-only CSV including decrypted emails. Caller must enforce a recent re-authentication. */
export async function exportLeadsCsv(actor: Actor, ip: string) {
  if (!can(actor.role, "exportLeads")) throw new Forbidden();
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, include: { convertedReport: { select: { publicRef: true } } } });
  const header = ["created_at", "email", "phone", "whatsapp_opt_in", "contact_opt_in", "consent_at", "source", "scam_type", "loss_band", "marketing_consent", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "landing_page", "converted_report"];
  const lines = leads.map((l) =>
    [l.createdAt, decryptText(l.emailEnc, aad.leadEmail()), l.phoneEnc ? decryptText(l.phoneEnc, aad.leadPhone()) : "", l.whatsappOptIn, l.contactOptIn, l.consentAt, l.source, l.scamType, l.lossBand, l.marketingConsent, l.utmSource, l.utmMedium, l.utmCampaign, l.utmContent, l.utmTerm, l.gclid, l.fbclid, l.landingPage, l.convertedReport?.publicRef]
      .map(csvCell)
      .join(","),
  );
  await staffEvent(actor.id, ip, "leads.exported", "lead", null, { rows: leads.length });
  return [header.join(","), ...lines].join("\r\n");
}

export async function listIssues(actor: Actor, status?: IssueStatus) {
  if (!can(actor.role, "handleIssues")) throw new Forbidden();
  const issues = await prisma.issue.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 });
  return issues.map((i) => ({ ...i, body: issueText(i) }));
}

export async function setIssueStatus(actor: Actor, ip: string, issueId: string, status: IssueStatus) {
  if (!can(actor.role, "handleIssues")) throw new Forbidden();
  await prisma.issue.update({ where: { id: issueId }, data: { status } });
  await staffEvent(actor.id, ip, "issue.status_changed", "issue", issueId, { status });
}

export async function auditTrail(actor: Actor, filter: { actor?: string; entity?: string }) {
  if (!can(actor.role, "viewAudit")) throw new Forbidden();
  return prisma.auditLog.findMany({
    where: { ...(filter.actor ? { actorId: filter.actor } : {}), ...(filter.entity ? { entity: filter.entity } : {}) },
    orderBy: { id: "desc" },
    take: 200,
  });
}

/** Recomputes every hash in the log. Returns the id of the first broken row, if any. */
export async function verifyAuditLog(actor: Actor, ip: string) {
  if (!can(actor.role, "viewAudit")) throw new Forbidden();
  const rows = await prisma.auditLog.findMany({ orderBy: { id: "asc" } });
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
  const broken = verifyAuditChain(chain);
  await staffEvent(actor.id, ip, "audit.verified", "audit", null, { rows: rows.length, intact: broken === -1 });
  return { rows: rows.length, brokenAtId: broken === -1 ? null : rows[broken]!.id.toString() };
}
