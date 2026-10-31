import type { IssueStatus } from "@kurotrace/db";
import { fmt } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { listIssues } from "@/server/insights";
import { issueStatusAction } from "../../actions";

export const metadata = { title: "Issues" };
const LABEL: Record<string, string> = { SITE_PROBLEM: "Site problem", COMPLAINT: "Complaint", DATA_REQUEST: "Data request", OTHER: "Other" };

export default async function Issues({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { staff } = await requireStaff("handleIssues");
  const { status } = await searchParams;
  const issues = await listIssues(staff, (["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status ?? "") ? status : undefined) as IssueStatus | undefined);
  return (
    <>
      <div className="row"><h1 className="title">Issues</h1><span className="hint">Data requests must be answered within the legal deadline (usually one month).</span></div>
      <div className="grid" style={{ marginTop: 20 }}>
        {issues.length === 0 && <p className="hint">No issues.</p>}
        {issues.map((i) => (
          <section key={i.id} className="card">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div>
                <span className={`pill ${i.category === "DATA_REQUEST" ? "pill-warn" : "pill-neutral"}`}>{LABEL[i.category]}</span>
                <span className="hint" style={{ marginLeft: 8 }}>{fmt(i.createdAt)}</span>
              </div>
              <form action={issueStatusAction} className="inline" style={{ flex: "0 0 auto" }}>
                <input type="hidden" name="issueId" value={i.id} />
                <select name="status" className="field" defaultValue={i.status} aria-label="Issue status" style={{ minWidth: 150 }}>
                  <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option>
                </select>
                <button type="submit" className="btn btn-line btn-small">Save</button>
              </form>
            </div>
            <p className="narrative" style={{ marginTop: 12 }}>{i.body}</p>
          </section>
        ))}
      </div>
    </>
  );
}
