import { Form } from "@/components/Form";
import { fmt } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { auditTrail } from "@/server/insights";
import { verifyAuditAction } from "../../actions";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ actor?: string; entity?: string }> }) {
  const { staff } = await requireStaff("viewAudit");
  const sp = await searchParams;
  const rows = await auditTrail(staff, { actor: sp.actor?.slice(0, 64) || undefined, entity: sp.entity?.slice(0, 64) || undefined });
  return (
    <>
      <div className="row">
        <h1 className="title">Audit log</h1>
        <Form action={verifyAuditAction}><button type="submit" className="btn btn-primary">Verify the whole chain</button></Form>
      </div>
      <p className="hint">Append-only. Each entry carries the hash of the one before it, so an edited or deleted entry breaks the chain.</p>
      <form className="card inline" method="get" style={{ marginTop: 12 }}>
        <div><label className="label" htmlFor="actor">Actor ID</label><input id="actor" name="actor" className="field" defaultValue={sp.actor} /></div>
        <div><label className="label" htmlFor="entity">Entity</label>
          <select id="entity" name="entity" className="field" defaultValue={sp.entity ?? ""}>
            <option value="">All</option>{["report", "staff", "user", "evidence", "indicator", "lead", "issue", "audit"].map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Filter</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table>
            <thead><tr><th>#</th><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id.toString()}>
                  <td className="code">{r.id.toString()}</td>
                  <td>{fmt(r.at)}</td>
                  <td>{r.actorType}{r.actorId ? <div className="code hint">{r.actorId}</div> : null}</td>
                  <td><span className={`pill ${/failed|locked|mismatch|blocked/.test(r.action) ? "pill-danger" : "pill-neutral"}`}>{r.action}</span></td>
                  <td>{r.entity}{r.entityId ? <div className="code hint">{r.entityId}</div> : null}</td>
                  <td className="code">{r.ip ?? "—"}</td>
                  <td className="code">{r.detail ? JSON.stringify(r.detail).slice(0, 120) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
