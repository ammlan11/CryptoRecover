import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/account/StatusPill";
import { formatDate, lossLabel, scamLabel } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { listUserReports } from "@/server/reports";

export const metadata: Metadata = { title: "My reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await requireUser();
  const reports = await listUserReports(session.userId);
  const { deleted } = await searchParams;

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">My reports</h1>
        <Link href="/account/reports/new" className="btn btn-navy">+ New report</Link>
      </div>
      {deleted && <p className="form-msg ok" role="status">The report and its files were deleted.</p>}
      {reports.length === 0 ? (
        <div className="panel" style={{ marginTop: 24, textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 20, margin: 0 }}>You haven&rsquo;t started a report yet.</p>
          <p style={{ color: "var(--ink-muted)", margin: "8px 0 20px" }}>It takes about 5 minutes. You can stop and finish later.</p>
          <Link href="/account/reports/new" className="btn btn-navy">Start a report</Link>
        </div>
      ) : (
        <ul className="report-list">
          {reports.map((r) => (
            <li key={r.publicRef}>
              <Link href={r.status === "DRAFT" ? `/account/reports/${r.publicRef}/edit` : `/account/reports/${r.publicRef}`} className="panel report-row">
                <div>
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{r.publicRef}</span>
                  <div style={{ fontSize: 18, fontWeight: 500, marginTop: 6 }}>{scamLabel(r.scamType)}</div>
                  <div style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 4 }}>
                    {r.submittedAt ? `Sent ${formatDate(r.submittedAt)}` : `Started ${formatDate(r.createdAt)}`} · {r._count.payments} {r._count.payments === 1 ? "payment" : "payments"} · {lossLabel(r.lossBand)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <StatusPill status={r.status} />
                  {r.status === "DRAFT" && <div className="more" style={{ marginTop: 10 }}>Continue →</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
