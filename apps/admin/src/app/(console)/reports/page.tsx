import Link from "next/link";
import { prisma, type ReportStatus, type ScamType } from "@kurotrace/db";
import { can } from "@/lib/permissions";
import { fmtDay, LOSS, Pill, SCAM, STATUS } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { listQueue } from "@/server/cases";

export const metadata = { title: "Reports" };

const STATUSES = ["RECEIVED", "IN_HOUSE_REVIEW", "INFO_NEEDED", "WITH_INVESTIGATORS", "CLOSED"];

export default async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { staff } = await requireStaff();
  if (!can(staff.role, "viewQueue") && staff.role !== "INVESTIGATOR") return <p className="msg error">No access.</p>;
  const sp = await searchParams;
  const status = (STATUSES.includes(sp.status ?? "") || sp.status === "OVERDUE" ? sp.status : undefined) as ReportStatus | "OVERDUE" | undefined;
  const scamType = (sp.type && sp.type in SCAM ? sp.type : undefined) as ScamType | undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listQueue(staff, { status, scamType, assignee: sp.assignee, q: sp.q, page });
  const assignees = can(staff.role, "assign") ? await prisma.staff.findMany({ where: { disabledAt: null, activatedAt: { not: null }, role: { not: "VIEWER" } }, select: { id: true, username: true } }) : [];
  const qs = (p: number) => new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <div className="row">
        <h1 className="title">{staff.role === "INVESTIGATOR" ? "My cases" : "Reports queue"}</h1>
        <span className="hint">Every report you open is written to the audit log</span>
      </div>
      <form className="card inline" style={{ marginTop: 20 }} method="get">
        <div style={{ flex: "3 1 260px" }}>
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={sp.q} className="field" placeholder="DM-XXXXX, wallet, domain or @handle" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="field" defaultValue={sp.status ?? ""}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]!.label}</option>)}
            <option value="OVERDUE">Over 24h, no reply</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="type">Scam type</label>
          <select id="type" name="type" className="field" defaultValue={sp.type ?? ""}>
            <option value="">All</option>
            {Object.entries(SCAM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {staff.role !== "INVESTIGATOR" && (
          <div>
            <label className="label" htmlFor="assignee">Assignee</label>
            <select id="assignee" name="assignee" className="field" defaultValue={sp.assignee ?? ""}>
              <option value="">Anyone</option>
              <option value="me">Me</option>
              <option value="none">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Filter</button>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table>
            <thead><tr><th>Ref</th><th>Scam type</th><th>Sent</th><th>Loss</th><th>First indicator</th><th>Pattern</th><th>Status</th><th>Assignee</th></tr></thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={8} className="hint">No reports match.</td></tr>}
              {data.rows.map((r) => {
                const overdue = (r.status === "RECEIVED" || r.status === "IN_HOUSE_REVIEW") && r.messages.length === 0 && r.submittedAt && r.submittedAt.getTime() < Date.now() - 86_400_000;
                return (
                  <tr key={r.id}>
                    <td><Link href={`/reports/${r.publicRef}`} className="code" style={{ fontWeight: 600 }}>{r.publicRef}</Link>{overdue && <div className="overdue">Over 24h, no reply</div>}</td>
                    <td>{SCAM[r.scamType]}</td>
                    <td>{fmtDay(r.submittedAt)}{r.country ? ` · ${r.country}` : ""}</td>
                    <td>{LOSS[r.lossBand ?? "NOT_GIVEN"]}</td>
                    <td>{r.indicators[0] ? <span className="code">{r.indicators[0].value.slice(0, 32)}</span> : <span className="hint">—</span>}</td>
                    <td>{r.scamPattern ? <span className="pill pill-cyan">{r.scamPattern}</span> : <span className="hint">—</span>}</td>
                    <td><Pill status={r.status} /></td>
                    <td>{r.assignedStaff?.username ?? <span className="hint">Unassigned</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>{data.total} reports · page {data.page} of {data.pages}</span>
          {data.page > 1 && <Link className="btn btn-line btn-small" href={`?${qs(data.page - 1)}`}>← Prev</Link>}
          {data.page < data.pages && <Link className="btn btn-line btn-small" href={`?${qs(data.page + 1)}`}>Next →</Link>}
        </div>
      </div>
    </>
  );
}
