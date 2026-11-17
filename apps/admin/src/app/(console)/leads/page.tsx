import Link from "next/link";
import type { LeadSource } from "@kurotrace/db";
import { can } from "@/lib/permissions";
import { fmt, LOSS, SCAM, SOURCE } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { listLeads } from "@/server/insights";

export const metadata = { title: "Leads" };

export default async function Leads({ searchParams }: { searchParams: Promise<{ source?: string; campaign?: string; email?: string }> }) {
  const { staff, ip } = await requireStaff("viewLeads");
  const sp = await searchParams;
  const source = (sp.source && sp.source in SOURCE ? sp.source : undefined) as LeadSource | undefined;
  const email = sp.email?.trim().slice(0, 254) || undefined;
  const leads = await listLeads(staff, ip, { source, campaign: sp.campaign?.slice(0, 150) || undefined, email });
  return (
    <>
      <div className="row">
        <h1 className="title">Leads</h1>
        {can(staff.role, "exportLeads") && <a className="btn btn-line" href="/leads/export">Export CSV (confirms it&rsquo;s you)</a>}
      </div>
      <p className="hint">
        Contact details are stored encrypted and shown only to staff allowed to see reporters&rsquo; details. Every view is recorded in the audit log.
        Only contact people for what they ticked: <strong>WhatsApp</strong> alerts, or <strong>Contact</strong> about their report.
      </p>
      <form className="card inline" style={{ marginTop: 12 }} method="get">
        <div><label className="label" htmlFor="source">Source</label>
          <select id="source" name="source" className="field" defaultValue={sp.source ?? ""}><option value="">All</option>{Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div><label className="label" htmlFor="campaign">Campaign (utm_campaign)</label><input id="campaign" name="campaign" className="field" defaultValue={sp.campaign} /></div>
        <div><label className="label" htmlFor="email">Find by email</label><input id="email" name="email" type="email" className="field" defaultValue={email} placeholder="exact address" /></div>
        <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Filter</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table>
            <thead><tr><th>When</th><th>Email</th><th>Mobile</th><th>Agreed to</th><th>Source</th><th>Scam type</th><th>Loss</th><th>Campaign</th><th>Click ID</th><th>Landing</th><th>Report</th></tr></thead>
            <tbody>
              {leads.length === 0 && <tr><td colSpan={11} className="hint">{email ? "No leads with that email." : "No leads yet."}</td></tr>}
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{fmt(l.createdAt)}</td>
                  <td className="code">{l.email}</td>
                  <td className="code">{l.phone ?? "—"}</td>
                  <td>{[l.whatsappOptIn && "WhatsApp", l.contactOptIn && "Contact", l.marketingConsent && "Weekly alert"].filter(Boolean).join(", ") || <span className="hint">—</span>}</td>
                  <td>{SOURCE[l.source]}</td>
                  <td>{l.scamType ? SCAM[l.scamType] : "—"}</td>
                  <td>{l.lossBand ? LOSS[l.lossBand] : "—"}</td>
                  <td>{[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="code">{l.gclid ? `gclid ${l.gclid.slice(0, 10)}…` : l.fbclid ? `fbclid ${l.fbclid.slice(0, 10)}…` : "—"}</td>
                  <td className="code">{l.landingPage ?? "—"}</td>
                  <td>
                    {!l.convertedReport ? (
                      <span className="hint">Not yet</span>
                    ) : l.convertedReport.status === "DRAFT" ? (
                      // Drafts aren't in the queue until the person submits them, so there's no page to open yet.
                      <span className="hint" title="The report is started but not submitted yet">Started, not submitted</span>
                    ) : (
                      <Link className="code" href={`/reports/${l.convertedReport.publicRef}`}>{l.convertedReport.publicRef}</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
