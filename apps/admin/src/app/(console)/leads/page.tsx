import Link from "next/link";
import type { LeadSource } from "@kurotrace/db";
import { can } from "@/lib/permissions";
import { fmt, LOSS, SCAM, SOURCE } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { listLeads } from "@/server/insights";

export const metadata = { title: "Leads" };

export default async function Leads({ searchParams }: { searchParams: Promise<{ source?: string; campaign?: string }> }) {
  const { staff } = await requireStaff("viewLeads");
  const sp = await searchParams;
  const source = (sp.source && sp.source in SOURCE ? sp.source : undefined) as LeadSource | undefined;
  const leads = await listLeads(staff, { source, campaign: sp.campaign?.slice(0, 150) || undefined });
  return (
    <>
      <div className="row">
        <h1 className="title">Leads</h1>
        {can(staff.role, "exportLeads") && <a className="btn btn-line" href="/leads/export">Export CSV (confirms it&rsquo;s you)</a>}
      </div>
      <p className="hint">Emails stay encrypted here. The owner&rsquo;s CSV export includes them and is logged.</p>
      <form className="card inline" style={{ marginTop: 12 }} method="get">
        <div><label className="label" htmlFor="source">Source</label>
          <select id="source" name="source" className="field" defaultValue={sp.source ?? ""}><option value="">All</option>{Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div><label className="label" htmlFor="campaign">Campaign (utm_campaign)</label><input id="campaign" name="campaign" className="field" defaultValue={sp.campaign} /></div>
        <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Filter</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table>
            <thead><tr><th>When</th><th>Source</th><th>Scam type</th><th>Loss</th><th>Campaign</th><th>Click ID</th><th>Landing</th><th>Report</th></tr></thead>
            <tbody>
              {leads.length === 0 && <tr><td colSpan={8} className="hint">No leads yet.</td></tr>}
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{fmt(l.createdAt)}</td>
                  <td>{SOURCE[l.source]}</td>
                  <td>{l.scamType ? SCAM[l.scamType] : "—"}</td>
                  <td>{l.lossBand ? LOSS[l.lossBand] : "—"}</td>
                  <td>{[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="code">{l.gclid ? `gclid ${l.gclid.slice(0, 10)}…` : l.fbclid ? `fbclid ${l.fbclid.slice(0, 10)}…` : "—"}</td>
                  <td className="code">{l.landingPage ?? "—"}</td>
                  <td>{l.convertedReport ? <Link className="code" href={`/reports/${l.convertedReport.publicRef}`}>{l.convertedReport.publicRef}</Link> : <span className="hint">Not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
