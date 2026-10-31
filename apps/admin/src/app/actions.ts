"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RateLimiter } from "@demo/core/rate-limit";
import { Forbidden } from "@/lib/permissions";
import { endCurrentStaffSession, requireRecentAuth, requireStaff, staffIp, startStaffSession } from "@/lib/session";
import {
  addNote,
  assign,
  CaseError,
  changeStatus,
  replyToUser,
  returnToInHouse,
  revealReporterEmail,
  setIndicatorConfirmed,
  setIndicatorConfirmedEverywhere,
  setPattern,
} from "@/server/cases";
import { setIssueStatus, verifyAuditLog } from "@/server/insights";
import {
  changeStaffPassword,
  completeInvite,
  inviteStaff,
  reauthenticate,
  resetStaff,
  setStaffDisabled,
  staffLogin,
  updateStaffAccess,
} from "@/server/staff-auth";

export type State = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string; secret?: string; link?: string };

const loginLimiter = new RateLimiter(10, 15 * 60_000);
const ref = z.string().regex(/^DM-[2-9A-HJ-NP-Z]{5}$/);
const role = z.enum(["OWNER", "REVIEWER", "INVESTIGATOR", "VIEWER"]);
const status = z.enum(["RECEIVED", "IN_HOUSE_REVIEW", "INFO_NEEDED", "WITH_INVESTIGATORS", "CLOSED"]);
const str = (f: FormData, k: string, max = 512) => String(f.get(k) ?? "").slice(0, max);

async function run(fn: () => Promise<void | State>, success?: string): Promise<State> {
  try {
    const result = await fn();
    if (result) return result;
    return success ? { status: "success", message: success } : { status: "idle" };
  } catch (error) {
    if (error instanceof CaseError || error instanceof Forbidden) return { status: "error", message: error.message };
    if (error instanceof Error && /^(Usernames|That username|You can't|Reset your own|Unsupported|Invalid CIDR)/.test(error.message)) return { status: "error", message: error.message };
    console.error("admin action failed", error instanceof Error ? error.message : error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const caseRef = (f: FormData) => {
  const parsed = ref.safeParse(f.get("ref"));
  if (!parsed.success) throw new CaseError("Report not found.");
  return parsed.data;
};
const refresh = (publicRef: string) => revalidatePath(`/reports/${publicRef}`);

// ─── Sign-in ─────────────────────────────────────────────────────

export async function loginAction(_prev: State, form: FormData): Promise<State> {
  const ip = await staffIp();
  if (!loginLimiter.check(`login:${ip}`).allowed) return { status: "error", message: "Too many attempts. Wait 15 minutes." };
  const result = await staffLogin(str(form, "username", 64), str(form, "password", 256), str(form, "code", 10), ip);
  if (!result.ok) {
    return { status: "error", message: result.reason === "locked" ? "This account is locked for 30 minutes after too many failed attempts." : "Those details are not correct." };
  }
  await startStaffSession(result.staffId);
  redirect("/");
}

export async function logoutAction() {
  await endCurrentStaffSession();
  redirect("/login");
}

export async function setupAction(_prev: State, form: FormData): Promise<State> {
  const ip = await staffIp();
  if (!loginLimiter.check(`setup:${ip}`).allowed) return { status: "error", message: "Too many attempts. Wait 15 minutes." };
  if (str(form, "password", 256) !== str(form, "confirm", 256)) return { status: "error", message: "The passwords don't match." };
  const result = await completeInvite(str(form, "token", 100), str(form, "password", 256), str(form, "code", 10), ip);
  if (!result.ok) return { status: "error", message: result.message };
  return { status: "success", message: "Your account is ready. You can sign in now." };
}

export async function reauthAction(_prev: State, form: FormData): Promise<State> {
  const { session, staff, ip } = await requireStaff();
  if (!loginLimiter.check(`reauth:${staff.id}`).allowed) return { status: "error", message: "Too many attempts. Wait 15 minutes." };
  const ok = await reauthenticate(session.id, staff.id, str(form, "password", 256), str(form, "code", 10), ip);
  if (!ok) return { status: "error", message: "Those details are not correct." };
  const next = str(form, "next", 200);
  redirect(/^\/[A-Za-z0-9/_?=&-]*$/.test(next) ? next : "/");
}

// ─── Cases ───────────────────────────────────────────────────────

export async function statusAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const publicRef = caseRef(form);
    const next = status.safeParse(form.get("status"));
    if (!next.success) throw new CaseError("Choose a status.");
    await changeStatus(staff, ip, publicRef, next.data);
    refresh(publicRef);
  }, "Status updated.");
}

export async function returnAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const publicRef = caseRef(form);
    await returnToInHouse(staff, ip, publicRef);
    refresh(publicRef);
  }, "Handed back to the in-house team.");
}

export async function assignAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const publicRef = caseRef(form);
    await assign(staff, ip, publicRef, str(form, "staffId", 40) || null);
    refresh(publicRef);
  }, "Assignment saved.");
}

export async function replyAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const publicRef = caseRef(form);
    await replyToUser(staff, ip, publicRef, str(form, "body", 6000));
    refresh(publicRef);
  }, "Sent. The reporter was notified by email (without the message text).");
}

export async function noteAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const publicRef = caseRef(form);
    await addNote(staff, ip, publicRef, str(form, "body", 6000));
    refresh(publicRef);
  }, "Note added.");
}

export async function patternAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const publicRef = caseRef(form);
    await setPattern(staff, ip, publicRef, str(form, "pattern", 80));
    refresh(publicRef);
  }, "Pattern saved.");
}

export async function indicatorAction(form: FormData) {
  const { staff, ip } = await requireStaff();
  const publicRef = caseRef(form);
  await setIndicatorConfirmed(staff, ip, publicRef, str(form, "indicatorId", 40), form.get("confirm") === "1").catch(() => {});
  refresh(publicRef);
}

export async function revealEmailAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireStaff();
  return run(async () => {
    const email = await revealReporterEmail(staff, ip, caseRef(form));
    return { status: "success", message: email ?? "This report has no account attached." };
  });
}

export async function confirmEverywhereAction(form: FormData) {
  const { staff, ip } = await requireStaff("viewIndicators");
  const kind = str(form, "kind", 20);
  const value = str(form, "value", 512);
  await setIndicatorConfirmedEverywhere(staff, ip, kind, value, form.get("confirm") === "1");
  revalidatePath("/indicators");
}

export async function issueStatusAction(form: FormData) {
  const { staff, ip } = await requireStaff("handleIssues");
  const next = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).safeParse(form.get("status"));
  if (next.success) await setIssueStatus(staff, ip, str(form, "issueId", 40), next.data);
  revalidatePath("/issues");
}

export async function verifyAuditAction(_prev: State): Promise<State> {
  const { staff, ip } = await requireStaff("viewAudit");
  return run(async () => {
    const result = await verifyAuditLog(staff, ip);
    return result.brokenAtId
      ? { status: "error", message: `Chain broken at entry #${result.brokenAtId}. Investigate immediately: a row was edited or deleted.` }
      : { status: "success", message: `All ${result.rows} entries verified. The chain is intact.` };
  });
}

// ─── Staff (owner, recent re-authentication required) ────────────

export async function inviteAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireRecentAuth("/staff", "manageStaff");
  return run(async () => {
    const r = role.safeParse(form.get("role"));
    if (!r.success) throw new CaseError("Choose a role.");
    const { token } = await inviteStaff(staff.id, ip, { username: str(form, "username", 64), role: r.data, organisation: str(form, "organisation", 120).trim() || null });
    revalidatePath("/staff");
    return { status: "success", message: "Invite created. Send this link through a secure channel; it works once, for 48 hours, and won't be shown again.", link: `/setup?token=${token}` };
  });
}

export async function resetStaffAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireRecentAuth("/staff", "manageStaff");
  return run(async () => {
    const token = await resetStaff(staff.id, ip, str(form, "staffId", 40));
    revalidatePath("/staff");
    return { status: "success", message: "Password and authenticator wiped. Send this new setup link securely:", link: `/setup?token=${token}` };
  });
}

export async function toggleStaffAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireRecentAuth("/staff", "manageStaff");
  return run(async () => {
    await setStaffDisabled(staff.id, ip, str(form, "staffId", 40), form.get("disable") === "1");
    revalidatePath("/staff");
  }, "Saved. Their sessions were ended.");
}

export async function staffAccessAction(_prev: State, form: FormData): Promise<State> {
  const { staff, ip } = await requireRecentAuth("/staff", "manageStaff");
  return run(async () => {
    const r = role.safeParse(form.get("role"));
    if (!r.success) throw new CaseError("Choose a role.");
    await updateStaffAccess(staff.id, ip, str(form, "staffId", 40), { role: r.data, organisation: str(form, "organisation", 120).trim() || null, allowedIps: str(form, "allowedIps", 1000).trim() || null });
    revalidatePath("/staff");
  }, "Access updated.");
}

export async function passwordAction(_prev: State, form: FormData): Promise<State> {
  const { session, staff, ip } = await requireStaff();
  if (str(form, "next", 256) !== str(form, "confirm", 256)) return { status: "error", message: "The new passwords don't match." };
  return run(async () => {
    const r = await changeStaffPassword(staff.id, session.id, ip, str(form, "current", 256), str(form, "next", 256));
    if (!r.ok) return { status: "error", message: r.message };
  }, "Password changed. Your other sessions were ended.");
}
