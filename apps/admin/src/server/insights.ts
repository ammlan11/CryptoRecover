import "server-only";
import { prisma, type IssueStatus, type LeadSource, type Staff } from "@demo/db";
import { verifyAuditChain, type AuditRow } from "@demo/core/audit";
import { decryptText } from "@demo/services/crypto";
import { aad, issueText } from "@demo/services/records";
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

export async function listLeads(actor: Actor, filter: { source?: LeadSource; campaign?: string }) {
  if (!can(actor.role, "viewLeads")) throw new Forbidden();
  return prisma.lead.findMany({
    where: { ...(filter.source ? { source: filter.source } : {}), ...(filter.campaign ? { utmCampaign: filter.campaign } : {}) },
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
      createdAt: true,
      convertedReport: { select: { publicRef: true, status: true } },
    },
  });
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
  const header = ["created_at", "email", "source", "scam_type", "loss_band", "marketing_consent", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "landing_page", "converted_report"];
  const lines = leads.map((l) =>
    [l.createdAt, decryptText(l.emailEnc, aad.leadEmail()), l.source, l.scamType, l.lossBand, l.marketingConsent, l.utmSource, l.utmMedium, l.utmCampaign, l.utmContent, l.utmTerm, l.gclid, l.fbclid, l.landingPage, l.convertedReport?.publicRef]
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
