"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { RateLimiter } from "@kurotrace/core/rate-limit";
import { clientIp } from "@/lib/request";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { clearChallengeCookie, setChallengeCookie, signIn, takeChallengeCookie } from "@/lib/session";
import {
  accountFromContinueLink,
  authenticate,
  completeTwoStep,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "@/server/accounts";
import { createDraft } from "@/server/reports";
import { prisma } from "@kurotrace/db";

export type AuthState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string };

const loginLimiter = new RateLimiter(10, 10 * 60_000);
const signupLimiter = new RateLimiter(5, 60 * 60_000);
const resetLimiter = new RateLimiter(5, 60 * 60_000);
const email = z.email().max(254);
const password = z.string().max(256);
const SLOW_DOWN: AuthState = { status: "error", message: "Too many attempts. Please wait a few minutes and try again." };
const GENERIC: AuthState = { status: "error", message: "Something went wrong on our side. Please try again." };

/** Only same-site account paths are allowed as post-login destinations. */
function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^\/account(\/[A-Za-z0-9/_-]*)?$/.test(value) ? value : "/account/reports";
}

async function limited(limiter: RateLimiter, key: string) {
  return !limiter.check(`${key}:${await clientIp()}`).allowed;
}

export async function signupAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited(signupLimiter, "signup")) return SLOW_DOWN;
  if (!(await passesBotCheck(form, "signup"))) return { status: "error", message: BOT_CHECK_FAILED };
  const parsed = z.object({ email, password }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email and password." };
  if (form.get("terms") !== "on") return { status: "error", message: "Please agree to the privacy notice to continue." };
  try {
    const result = await registerUser(parsed.data.email, parsed.data.password);
    if (!result.ok) return { status: "error", message: result.message };
    return { status: "success", message: "Check your inbox for a link to confirm your email. Then log in." };
  } catch (error) {
    console.error("signup failed", error instanceof Error ? error.message : error);
    return GENERIC;
  }
}

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited(loginLimiter, "login")) return SLOW_DOWN;
  if (!(await passesBotCheck(form, "login"))) return { status: "error", message: BOT_CHECK_FAILED };
  const parsed = z.object({ email, password }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { status: "error", message: "Email or password is not correct." };
  let result;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password);
  } catch (error) {
    console.error("login failed", error instanceof Error ? error.message : error);
    return GENERIC;
  }
  if (result.ok === false) {
    return result.reason === "locked"
      ? { status: "error", message: `Too many wrong attempts. Try again in ${result.retryMinutes} minutes, or reset your password.` }
      : { status: "error", message: "Email or password is not correct." };
  }
  const next = safeNext(form.get("next"));
  if (result.ok === "two_step") {
    await setChallengeCookie(result.challenge);
    redirect(`/login/two-step?next=${encodeURIComponent(next)}`);
  }
  await signIn(result.userId);
  redirect(next);
}

export async function twoStepAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited(loginLimiter, "2fa")) return SLOW_DOWN;
  const challenge = await takeChallengeCookie();
  const code = String(form.get("code") ?? "").slice(0, 20);
  if (!challenge) return { status: "error", message: "Your sign-in timed out. Please log in again." };
  const result = await completeTwoStep(challenge, code);
  if (!result.ok) {
    if (result.expired) {
      await clearChallengeCookie();
      return { status: "error", message: "Your sign-in timed out. Please log in again." };
    }
    return { status: "error", message: "That code didn't work. Check your authenticator app and try again." };
  }
  await clearChallengeCookie();
  await signIn(result.userId);
  redirect(safeNext(form.get("next")));
}

export async function forgotAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited(resetLimiter, "reset")) return SLOW_DOWN;
  if (!(await passesBotCheck(form, "forgot"))) return { status: "error", message: BOT_CHECK_FAILED };
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  try {
    await requestPasswordReset(parsed.data);
  } catch (error) {
    console.error("reset request failed", error instanceof Error ? error.message : error);
  }
  // Same answer whether or not the account exists.
  return { status: "success", message: "If an account uses that email, a reset link is on its way. It works for 1 hour." };
}

export async function resetAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited(resetLimiter, "reset-confirm")) return SLOW_DOWN;
  const token = String(form.get("token") ?? "");
  const pw = String(form.get("password") ?? "");
  if (pw !== String(form.get("confirm") ?? "")) return { status: "error", message: "The two passwords don't match." };
  const result = await resetPassword(token, pw);
  if (!result.ok) return { status: "error", message: result.message };
  return { status: "success", message: "Your password was changed and other devices were signed out. You can log in now." };
}

/** Continue-report link: creates the account, signs in and opens the report form. */
export async function continueAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited(signupLimiter, "continue")) return SLOW_DOWN;
  if (form.get("terms") !== "on") return { status: "error", message: "Please agree to the privacy notice to continue." };
  const result = await accountFromContinueLink(String(form.get("token") ?? ""), String(form.get("password") ?? ""));
  if (!result.ok) return { status: "error", message: result.message };
  await signIn(result.userId);
  const lead = await prisma.lead.findUnique({ where: { id: result.leadId }, select: { scamType: true } });
  const report = await createDraft(result.userId, lead?.scamType ?? "UNSURE", result.leadId);
  redirect(`/account/reports/${report.publicRef}/edit`);
}
