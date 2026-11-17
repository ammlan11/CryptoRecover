import Link from "next/link";
import { can } from "@/lib/permissions";
import { EMAIL_KIND, LOSS, SCAM, SOURCE } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { dashboard, emailStats } from "@/server/insights";

export const metadata = { title: "Dashboard" };

function Bars({ rows, labels }: { rows: { key: string; count: number }[]; labels: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="hint">Nothing yet.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.key} className="bar">
          <span>{labels[r.key] ?? r.key}</span>
          <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ display: "block", width: `${(r.count / max) * 100}%` }} /></span>
          <span style={{ textAlign: "right" }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { staff } = await requireStaff();
  const [d, mail] = await Promise.all([dashboard(staff), emailStats(staff)]);
  const { denied } = await searchParams;
  const queue = can(staff.role, "viewQueue");
  const rate = d.leads30 ? Math.round((d.converted30 / d.leads30) * 100) : 0;

  return (
    <>
      <div className="row">
        <h1 className="title">Dashboard</h1>
        <span className="hint">Last 30 days · {d.reports30} reports sent</span>
      </div>
      {denied && <p className="msg error" role="alert">Your role doesn&rsquo;t have access to that page.</p>}
      <div className="kpis">
        {queue ? (
          <>
            <Link className="kpi" href="/reports?status=RECEIVED&assignee=none"><div className="label">New, unassigned</div><div className="value">{d.unassigned}</div></Link>
            <Link className="kpi" href="/reports?status=INFO_NEEDED"><div className="label">Waiting on reporter</div><div className="value">{d.waiting}</div></Link>
            <Link className="kpi" href="/reports?status=WITH_INVESTIGATORS"><div className="label">With investigators</div><div className="value">{d.withInvestigators}</div></Link>
            <Link className={`kpi${d.overdue ? " alert" : ""}`} href="/reports?status=OVERDUE"><div className="label">Over 24h, no reply</div><div className="value">{d.overdue}</div></Link>
          </>
        ) : (
          <Link className="kpi" href="/reports?assignee=me"><div className="label">My open cases</div><div className="value">{d.myCases}</div></Link>
        )}
        {can(staff.role, "viewLeads") && (
          <Link className="kpi" href="/leads"><div className="label">Leads · {rate}% became reports</div><div className="value">{d.leads30}</div></Link>
        )}
      </div>
      <div className="two">
        <section className="card"><h2 className="sub">Reports by scam type</h2><Bars rows={d.byType} labels={SCAM} /></section>
        <section className="card"><h2 className="sub">Reported losses</h2><Bars rows={d.byLoss} labels={LOSS} /></section>
        {can(staff.role, "viewLeads") && <section className="card"><h2 className="sub">Leads by source</h2><Bars rows={d.bySource} labels={SOURCE} /></section>}
      </div>
      {mail && (
        <>
          <div className="row" style={{ marginTop: 32 }}>
            <h2 className="title" style={{ fontSize: 22 }}>Emails sent</h2>
            <span className="hint">All emails the site sends: sign-in codes, report links, reminders and updates</span>
          </div>
          <div className="kpis">
            <div className="kpi"><div className="label">Today (UTC)</div><div className="value">{mail.today}</div></div>
            <div className="kpi"><div className="label">Last 7 days</div><div className="value">{mail.last7}</div></div>
            <div className="kpi"><div className="label">Last 30 days</div><div className="value">{mail.last30}</div></div>
            <div className="kpi"><div className="label">All time</div><div className="value">{mail.total}</div></div>
            <div className={`kpi${mail.failed7 ? " alert" : ""}`}><div className="label">Failed, last 7 days</div><div className="value">{mail.failed7}</div></div>
          </div>
          <section className="card"><h2 className="sub">By type, last 30 days</h2><Bars rows={mail.byKind} labels={EMAIL_KIND} /></section>
        </>
      )}
    </>
  );
}
