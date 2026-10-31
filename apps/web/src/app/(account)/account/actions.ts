"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RateLimiter } from "@kurotrace/core/rate-limit";
import { prisma } from "@kurotrace/db";
import { LOSS_BAND_OPTIONS, SCAM_TYPE_OPTIONS } from "@/lib/options";
import { clientIp } from "@/lib/request";
import { requireUser, signOut } from "@/lib/session";
import { changePassword, confirmTwoStep, deleteAccount, disableTwoStep, sendVerification, userEmail } from "@/server/accounts";
import { sendEmail, templates } from "@kurotrace/services/email";
import {
  addEvidence,
  addPayment,
  addUserMessage,
  createDraft,
  createIssue,
  deleteUserReport,
  finishEvidence,
  finishPayments,
  removeEvidence,
  removePayment,
  ReportError,
  saveContact,
  saveWhatHappened,
  submitReport,
} from "@/server/reports";
import { destroyOtherSessions } from "@/server/sessions";

export type ActionState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string; codes?: string[] };

const scamType = z.enum(SCAM_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]]);
const lossBand = z.enum(LOSS_BAND_OPTIONS.map((o) => o.value) as [string, ...string[]]);
const channel = z.enum(["TELEGRAM", "WHATSAPP", "SOCIAL_MEDIA", "DATING_APP", "PHONE", "EMAIL", "WEBSITE_AD", "OTHER"]);
const ref = z.string().regex(/^DM-[2-9A-HJ-NP-Z]{5}$/);
const sensitiveLimiter = new RateLimiter(10, 15 * 60_000);
const verifyLimiter = new RateLimiter(3, 60 * 60_000);

const str = (form: FormData, key: string, max = 512) => String(form.get(key) ?? "").slice(0, max);
const optional = (value: string) => (value.trim() ? value.trim() : null);
const dateOrNull = (value: string) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 2009 ? null : d;
};

/** Runs a mutation and turns expected failures into a message; anything else is logged, not shown. */
async function attempt(fn: () => Promise<void | ActionState>, success?: string): Promise<ActionState> {
  try {
    const result = await fn();
    if (result) return result;
    return success ? { status: "success", message: success } : { status: "idle" };
  } catch (error) {
    if (error instanceof ReportError) return { status: "error", message: error.message };
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    console.error("account action failed", error instanceof Error ? error.message : error);
    return { status: "error", message: "Something went wrong on our side. Please try again." };
  }
}

function reportRef(form: FormData) {
  const parsed = ref.safeParse(form.get("ref"));
  if (!parsed.success) throw new ReportError("Report not found.");
  return parsed.data;
}

// ─── Session ─────────────────────────────────────────────────────

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

export async function resendVerificationAction(_prev: ActionState): Promise<ActionState> {
  const session = await requireUser();
  if (!verifyLimiter.check(`verify:${session.userId}`).allowed) return { status: "error", message: "We've sent a few already. Check your spam folder or try again later." };
  return attempt(async () => {
    await sendVerification(session.userId, userEmail(session.user));
  }, "Sent. Check your inbox for the confirmation link.");
}

// ─── Report form ─────────────────────────────────────────────────

export async function newReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const type = scamType.safeParse(form.get("scamType"));
  let publicRef = "";
  const result = await attempt(async () => {
    publicRef = (await createDraft(session.userId, (type.success ? type.data : "UNSURE") as never)).publicRef;
  });
  if (result.status === "error") return result;
  redirect(`/account/reports/${publicRef}/edit`);
}

export async function saveStep1Action(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  const result = await attempt(async () => {
    const type = scamType.safeParse(form.get("scamType"));
    const band = lossBand.safeParse(form.get("lossBand"));
    const country = str(form, "country", 2).toUpperCase();
    await saveWhatHappened(session.userId, publicRef, {
      scamType: (type.success ? type.data : "UNSURE") as never,
      narrative: str(form, "narrative", 25_000),
      occurredAt: dateOrNull(str(form, "occurredAt", 10)),
      country: /^[A-Z]{2}$/.test(country) ? country : null,
      lossBand: band.success ? (band.data as never) : null,
    });
  });
  if (result.status === "error") return result;
  redirect(`/account/reports/${publicRef}/edit?step=2`);
}

export async function saveStep2Action(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  const result = await attempt(async () => {
    const ch = channel.safeParse(form.get("channel"));
    await saveContact(session.userId, publicRef, { channel: ch.success ? (ch.data as never) : null, handle: str(form, "handle"), website: str(form, "website") });
  });
  if (result.status === "error") return result;
  redirect(`/account/reports/${publicRef}/edit?step=3`);
}

export async function addPaymentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  return attempt(async () => {
    const amountRaw = str(form, "amount", 40).replace(/[,\s]/g, "");
    if (amountRaw && !/^\d{1,20}(\.\d{1,8})?$/.test(amountRaw)) throw new ReportError("Enter the amount as a number, for example 2500 or 0.05.");
    const asset = str(form, "asset", 16).toUpperCase();
    if (!/^[A-Z0-9]{2,16}$/.test(asset)) throw new ReportError("Choose the currency or coin.");
    await addPayment(session.userId, publicRef, {
      amount: amountRaw || null,
      asset,
      network: optional(str(form, "network", 32)),
      toAddress: str(form, "toAddress"),
      txHash: str(form, "txHash"),
      sentAt: dateOrNull(str(form, "sentAt", 10)),
    });
    revalidatePath(`/account/reports/${publicRef}/edit`);
  }, "Payment added.");
}

export async function removePaymentAction(form: FormData) {
  const session = await requireUser();
  const publicRef = reportRef(form);
  await removePayment(session.userId, publicRef, str(form, "paymentId", 40)).catch(() => {});
  revalidatePath(`/account/reports/${publicRef}/edit`);
}

export async function finishPaymentsAction(form: FormData) {
  const session = await requireUser();
  const publicRef = reportRef(form);
  await finishPayments(session.userId, publicRef);
  redirect(`/account/reports/${publicRef}/edit?step=4`);
}

export async function uploadEvidenceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  return attempt(async () => {
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    await addEvidence(session.userId, publicRef, files);
    revalidatePath(`/account/reports/${publicRef}/edit`);
  }, "Uploaded and encrypted.");
}

export async function removeEvidenceAction(form: FormData) {
  const session = await requireUser();
  const publicRef = reportRef(form);
  await removeEvidence(session.userId, publicRef, str(form, "evidenceId", 40)).catch(() => {});
  revalidatePath(`/account/reports/${publicRef}/edit`);
}

export async function finishEvidenceAction(form: FormData) {
  const session = await requireUser();
  const publicRef = reportRef(form);
  await finishEvidence(session.userId, publicRef);
  redirect(`/account/reports/${publicRef}/edit?step=5`);
}

export async function submitReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  const result = await attempt(async () => {
    if (form.get("accurate") !== "on") throw new ReportError("Please confirm the report is accurate to the best of your knowledge.");
    await submitReport(session.userId, publicRef, { researchConsent: form.get("research") === "on", publicAlertConsent: form.get("publicAlert") === "on" });
    await sendEmail({ to: userEmail(session.user), ...templates.reportReceived(publicRef) }).catch(() => {});
  });
  if (result.status === "error") return result;
  redirect(`/account/reports/${publicRef}?sent=1`);
}

export async function deleteReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  if (form.get("confirm") !== "on") return { status: "error", message: "Tick the box to confirm you want to delete this report." };
  await deleteUserReport(session.userId, publicRef);
  redirect("/account/reports?deleted=1");
}

export async function sendMessageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const publicRef = reportRef(form);
  return attempt(async () => {
    await addUserMessage(session.userId, publicRef, str(form, "body", 6000));
    revalidatePath(`/account/reports/${publicRef}`);
  }, "Sent.");
}

export async function createIssueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  const category = z.enum(["SITE_PROBLEM", "COMPLAINT", "DATA_REQUEST", "OTHER"]).safeParse(form.get("category"));
  return attempt(async () => {
    await createIssue(session.userId, category.success ? category.data : "OTHER", str(form, "body", 6000));
  }, "Thank you. We'll reply by email.");
}

// ─── Settings ────────────────────────────────────────────────────

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  if (!sensitiveLimiter.check(`pw:${session.userId}`).allowed) return { status: "error", message: "Too many attempts. Try again later." };
  if (str(form, "next", 256) !== str(form, "confirm", 256)) return { status: "error", message: "The new passwords don't match." };
  return attempt(async () => {
    const result = await changePassword(session.userId, session.id, str(form, "current", 256), str(form, "next", 256));
    if (!result.ok) return { status: "error", message: result.message };
  }, "Password changed. Other devices were signed out.");
}

export async function confirmTwoStepAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  if (!sensitiveLimiter.check(`2fa-setup:${session.userId}`).allowed) return { status: "error", message: "Too many attempts. Try again later." };
  return attempt(async () => {
    const result = await confirmTwoStep(session.userId, str(form, "code", 10));
    if (!result.ok) return { status: "error", message: "That code didn't match. Check the time on your phone and try the newest code." };
    return { status: "success", message: "Two-step sign-in is on.", codes: result.recoveryCodes };
  });
}

export async function disableTwoStepAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  if (!sensitiveLimiter.check(`2fa-off:${session.userId}`).allowed) return { status: "error", message: "Too many attempts. Try again later." };
  return attempt(async () => {
    if (!(await disableTwoStep(session.userId, str(form, "password", 256)))) return { status: "error", message: "Your password is not correct." };
    revalidatePath("/account/settings");
  }, "Two-step sign-in is off.");
}

export async function revokeSessionAction(form: FormData) {
  const session = await requireUser();
  await prisma.userSession.deleteMany({ where: { id: str(form, "sessionId", 40), userId: session.userId, NOT: { id: session.id } } });
  revalidatePath("/account/settings");
}

export async function signOutEverywhereAction() {
  const session = await requireUser();
  await destroyOtherSessions(session.userId, session.id);
  revalidatePath("/account/settings");
}

export async function deleteAccountAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireUser();
  if (!sensitiveLimiter.check(`delete:${session.userId}:${await clientIp()}`).allowed) return { status: "error", message: "Too many attempts. Try again later." };
  if (form.get("confirm") !== "on") return { status: "error", message: "Tick the box to confirm." };
  const ok = await deleteAccount(session.userId, str(form, "password", 256));
  if (!ok) return { status: "error", message: "Your password is not correct." };
  await signOut();
  redirect("/?account-deleted=1");
}
