import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createStaffSession, endStaffSession, recentlyReauthenticated, resolveStaffSession } from "@/server/staff-auth";
import { can, type Capability } from "./permissions";

/**
 * Strict cookie: never sent on any cross-site request, including top-level links.
 * The admin is only ever opened directly, so nothing legitimate needs it cross-site.
 */
const COOKIE = "__Host-staff";

/** The proxy has already checked the global allow-list and passes the client IP on. */
export async function staffIp(): Promise<string> {
  return (await headers()).get("x-client-ip") || "unknown";
}

export const currentStaff = cache(async () => resolveStaffSession((await cookies()).get(COOKIE)?.value, await staffIp()));

export async function requireStaff(capability?: Capability) {
  const session = await currentStaff();
  if (!session) redirect("/login");
  if (capability && !can(session.staff.role, capability)) redirect("/?denied=1");
  return { session, staff: session.staff, ip: await staffIp() };
}

/** For exports and staff changes: sends the person to confirm password + code again. */
export async function requireRecentAuth(next: string, capability?: Capability) {
  const ctx = await requireStaff(capability);
  if (!recentlyReauthenticated(ctx.session)) redirect(`/reauth?next=${encodeURIComponent(next)}`);
  return ctx;
}

export async function startStaffSession(staffId: string) {
  const token = await createStaffSession(staffId, await staffIp(), (await headers()).get("user-agent"));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/" }); // session cookie: gone when the browser closes
}

export async function endCurrentStaffSession() {
  const jar = await cookies();
  await endStaffSession(jar.get(COOKIE)?.value);
  jar.delete(COOKIE);
}
