import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { currentStaff, staffIp } from "@/lib/session";
import { exportLeadsCsv } from "@/server/insights";
import { recentlyReauthenticated } from "@/server/staff-auth";

/** Owner-only, re-authenticated within 10 minutes, logged. */
export async function GET() {
  const session = await currentStaff();
  if (!session || !can(session.staff.role, "exportLeads")) return new Response("Not found", { status: 404 });
  if (!recentlyReauthenticated(session)) redirect("/reauth?next=/leads/export");
  const csv = await exportLeadsCsv(session.staff, await staffIp());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
