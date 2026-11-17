import { EMAIL_KIND, fmt } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { listEmails } from "@/server/insights";

export const metadata = { title: "Emails sent" };

/** Every email the site sent in the last 90 days: when, type, to whom, subject, outcome. */
export default async function Emails({ searchParams }: { searchParams: Promise<{ kind?: string; to?: string; failed?: string }> }) {
  const { staff, ip } = await requireStaff("viewReporterEmail");
  const sp = await searchParams;
  const kind = sp.kind && sp.kind in EMAIL_KIND ? sp.kind : undefined;
  const to = sp.to?.trim().slice(0, 254) || undefined;
  const failed = sp.failed === "1";
  const rows = await listEmails(staff, ip, { kind, to, failed });
  return (
    <>
      <div className="row">
        <h1 className="title">Emails sent</h1>
        <span className="hint">Newest first, last 300 · kept for 90 days</span>
      </div>
      <p className="hint">
        Addresses are stored encrypted, and every view is recorded in the audit log. Email text isn&rsquo;t stored, and sign-in codes are blanked out of subjects.
      </p>
      <form className="card inline" style={{ marginTop: 12 }} method="get">
        <div><label className="label" htmlFor="kind">Type</label>
          <select id="kind" name="kind" className="field" defaultValue={kind ?? ""}><option value="">All</option>{Object.entries(EMAIL_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div><label className="label" htmlFor="to">To (exact address)</label><input id="to" name="to" type="email" className="field" defaultValue={to} /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 12, flex: "0 0 auto" }}><input type="checkbox" name="failed" value="1" defaultChecked={failed} /> Failed only</label>
        <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Filter</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table>
            <thead><tr><th>When</th><th>To</th><th>Type</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="hint">No emails match.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.createdAt)}</td>
                  <td className="code">{r.to ?? <span className="hint">not recorded</span>}</td>
                  <td>{EMAIL_KIND[r.kind] ?? r.kind}</td>
                  <td>{r.subject ?? "—"}</td>
                  <td>{r.ok ? <span className="pill pill-ok">Sent</span> : <span className="pill pill-danger">Failed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
