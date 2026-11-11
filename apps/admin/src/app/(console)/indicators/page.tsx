import { prisma } from "@kurotrace/db";
import { SOURCE_INFO } from "@kurotrace/core/threat-lists";
import { fmt, fmtDay } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { listIndicators } from "@/server/cases";
import { confirmEverywhereAction } from "../../actions";

export const metadata = { title: "Indicators" };

export default async function Indicators({ searchParams }: { searchParams: Promise<{ q?: string; open?: string }> }) {
  const { staff } = await requireStaff("viewIndicators");
  const sp = await searchParams;
  const [rows, lists] = await Promise.all([
    listIndicators(staff, { q: sp.q, onlyUnconfirmed: sp.open === "1" }),
    prisma.threatListSync.findMany({ orderBy: { source: "asc" } }),
  ]);
  return (
    <>
      <div className="row">
        <h1 className="title">Indicators</h1>
        <span className="hint">Wallets, sites and handles named across reports. Confirmed ones power the public checker.</span>
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="sub" style={{ marginTop: 0 }}>Free threat lists used by the public checker</h2>
        {lists.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>Not downloaded yet. On the server they refresh every 12 hours; locally run <code>npm run sync-lists</code>.</p>
        ) : (
          <ul className="list">
            {lists.map((l) => (
              <li key={l.source}>
                <span>{SOURCE_INFO[l.source].name} <span className="hint">· {l.entries.toLocaleString()} entries</span></span>
                <span className={`pill ${l.ok ? "pill-ok" : "pill-danger"}`} title={l.error ?? ""}>{l.ok ? `Updated ${fmt(l.syncedAt)}` : "Last refresh failed: using previous list"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="card inline" style={{ marginTop: 16 }} method="get">
        <div style={{ flex: "3 1 260px" }}><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="field" placeholder="Wallet, domain or handle" /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, flex: "0 0 auto", minHeight: 44 }}><input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} /> Needs confirming</label>
        <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Filter</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table>
            <thead><tr><th>Kind</th><th>Value</th><th>Reports</th><th>Confirmed</th><th>Last reported</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="hint">Nothing found.</td></tr>}
              {rows.map((r) => (
                <tr key={`${r.kind}:${r.value}`}>
                  <td><span className="pill pill-neutral">{r.kind}</span></td>
                  <td className="code">{r.value}</td>
                  <td>{r.reports}</td>
                  <td>{r.confirmed === r.reports ? <span className="pill pill-ok">All</span> : r.confirmed ? `${r.confirmed} of ${r.reports}` : <span className="hint">No</span>}</td>
                  <td>{fmtDay(r.lastSeen)}</td>
                  <td>
                    <form action={confirmEverywhereAction}>
                      <input type="hidden" name="kind" value={r.kind} />
                      <input type="hidden" name="value" value={r.value} />
                      <input type="hidden" name="confirm" value={r.confirmed === r.reports ? "0" : "1"} />
                      <button type="submit" className={`btn btn-small ${r.confirmed === r.reports ? "btn-line" : "btn-primary"}`}>{r.confirmed === r.reports ? "Unconfirm all" : "Confirm on all reports"}</button>
                    </form>
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
