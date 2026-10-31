import { prisma } from "@demo/db";
import { Form } from "@/components/Form";
import { ROLE_LABEL } from "@/lib/permissions";
import { fmt } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { inviteAction, resetStaffAction, staffAccessAction, toggleStaffAction } from "../../actions";

export const metadata = { title: "Staff and roles" };

export default async function StaffPage() {
  const { staff: me } = await requireStaff("manageStaff");
  const people = await prisma.staff.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <>
      <div className="row"><h1 className="title">Staff and roles</h1><span className="hint">Changes here ask you to confirm your password and code first.</span></div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="sub">Invite someone</h2>
        <Form action={inviteAction} className="inline" reset>
          <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" required pattern="[a-z0-9._\-]{3,64}" className="field" placeholder="e.g. j.smith" /></div>
          <div><label className="label" htmlFor="role">Role</label>
            <select id="role" name="role" className="field" defaultValue="REVIEWER">
              <option value="REVIEWER">Reviewer (in-house)</option>
              <option value="INVESTIGATOR">Investigator (assigned cases only)</option>
              <option value="VIEWER">Viewer (dashboard and queue)</option>
              <option value="OWNER">Owner (everything)</option>
            </select>
          </div>
          <div><label className="label" htmlFor="organisation">Organisation (optional)</label><input id="organisation" name="organisation" className="field" placeholder="e.g. investigation firm" /></div>
          <button type="submit" className="btn btn-primary" style={{ flex: "0 0 auto" }}>Create setup link</button>
        </Form>
      </section>
      <div className="grid" style={{ marginTop: 16 }}>
        {people.map((p) => (
          <section key={p.id} className="card">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div>
                <strong style={{ fontWeight: 600 }}>{p.username}</strong> <span className="pill pill-info">{ROLE_LABEL[p.role]}</span>{" "}
                {p.disabledAt ? <span className="pill pill-danger">Disabled</span> : p.activatedAt ? <span className="pill pill-ok">Active</span> : <span className="pill pill-warn">Setup pending</span>}
                <div className="hint" style={{ marginTop: 4 }}>{p.organisation ?? "In-house"} · last sign-in {fmt(p.lastLoginAt)}</div>
              </div>
              {p.id !== me.id && (
                <div className="inline" style={{ flex: "0 0 auto" }}>
                  <Form action={resetStaffAction}><input type="hidden" name="staffId" value={p.id} /><button type="submit" className="btn btn-line btn-small">Reset password + authenticator</button></Form>
                  <Form action={toggleStaffAction}><input type="hidden" name="staffId" value={p.id} /><input type="hidden" name="disable" value={p.disabledAt ? "0" : "1"} /><button type="submit" className={`btn btn-small ${p.disabledAt ? "btn-line" : "btn-danger"}`}>{p.disabledAt ? "Enable" : "Disable"}</button></Form>
                </div>
              )}
            </div>
            <Form action={staffAccessAction} className="inline">
              <input type="hidden" name="staffId" value={p.id} />
              <div><label className="label" htmlFor={`role-${p.id}`}>Role</label>
                <select id={`role-${p.id}`} name="role" className="field" defaultValue={p.role}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor={`org-${p.id}`}>Organisation</label><input id={`org-${p.id}`} name="organisation" className="field" defaultValue={p.organisation ?? ""} /></div>
              <div style={{ flex: "2 1 220px" }}><label className="label" htmlFor={`ips-${p.id}`}>Extra IP restriction (optional)</label><input id={`ips-${p.id}`} name="allowedIps" className="field" defaultValue={p.allowedIps ?? ""} placeholder="203.0.113.0/24, 198.51.100.7" /></div>
              <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Save access</button>
            </Form>
          </section>
        ))}
      </div>
    </>
  );
}
