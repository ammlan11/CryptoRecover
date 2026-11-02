import { prisma } from "@kurotrace/db";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { requireStaff } from "@/lib/session";
import { STAFF_IDLE_MINUTES } from "@/server/staff-auth";
import { logoutAction } from "../actions";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { staff, session } = await requireStaff();
  const role = staff.role;
  const unassigned = can(role, "viewQueue") ? await prisma.report.count({ where: { status: "RECEIVED", assignedStaffId: null } }) : 0;
  const mine = role === "INVESTIGATOR" ? await prisma.report.count({ where: { assignedStaffId: staff.id, status: "WITH_INVESTIGATORS" } }) : 0;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <Logo tone="white" height={26} />
        </div>
        <div className="side-tag">ADMIN TERMINAL</div>
        <nav aria-label="Admin">
          <NavLink href="/">Dashboard</NavLink>
          {can(role, "viewQueue") && <NavLink href="/reports" badge={unassigned || undefined}>Reports queue</NavLink>}
          {role === "INVESTIGATOR" && <NavLink href="/reports?assignee=me" badge={mine || undefined}>My cases</NavLink>}
          {can(role, "viewIndicators") && <NavLink href="/indicators">Indicators</NavLink>}
          {can(role, "viewLeads") && <NavLink href="/leads">Leads</NavLink>}
          {can(role, "handleIssues") && <NavLink href="/issues">Issues</NavLink>}
          {can(role, "manageStaff") && <NavLink href="/staff">Staff and roles</NavLink>}
          {can(role, "viewAudit") && <NavLink href="/audit">Audit log</NavLink>}
          <NavLink href="/account">My account</NavLink>
        </nav>
        <div className="side-foot">
          <div className="ok">● Authenticator verified</div>
          <div>IP {session.ip} on allow-list</div>
          <div>Signs out after {STAFF_IDLE_MINUTES / 60} h idle</div>
          <div style={{ marginTop: 8, color: "#fff" }}>{staff.username} · {ROLE_LABEL[role]}{staff.organisation ? ` · ${staff.organisation}` : ""}</div>
          <form action={logoutAction}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main id="main" className="main">{children}</main>
    </div>
  );
}
