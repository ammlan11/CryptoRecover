"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@kurotrace/core/password";
import { RateLimiter } from "@kurotrace/core/rate-limit";
import { prisma } from "@kurotrace/db";
import { ipHashFor } from "@kurotrace/services/crypto";
import { clientIp } from "@/lib/request";
import { requireUser } from "@/lib/session";
import { confirmPhoneVerification, PhoneError, startPhoneVerification } from "@/server/phone";

export type PhoneState =
  | { status: "idle" }
  | { status: "error"; message: string; stage: "number" | "code" }
  | { status: "code"; masked: string; message?: string }
  | { status: "done"; message: string };

const limiter = new RateLimiter(20, 60 * 60_000);

/** Step 1: send a code to the number. Changing an already-confirmed number also needs the password. */
export async function sendPhoneCodeAction(_prev: PhoneState, form: FormData): Promise<PhoneState> {
  const session = await requireUser({ allowUnverifiedPhone: true });
  const ip = await clientIp();
  if (!limiter.check(`phone:${session.user.id}:${ip}`).allowed) return { status: "error", stage: "number", message: "Too many attempts. Please try again later." };
  const phone = z.string().max(40).safeParse(form.get("phone"));
  if (!phone.success || !phone.data.trim()) return { status: "error", stage: "number", message: "Enter your mobile number." };
  if (session.user.phoneVerifiedAt) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(user.passwordHash, String(form.get("password") ?? "").slice(0, 256)))) {
      return { status: "error", stage: "number", message: "Your password is not correct." };
    }
  }
  try {
    const masked = await startPhoneVerification(session.user.id, phone.data, ipHashFor(ip));
    return { status: "code", masked };
  } catch (error) {
    if (error instanceof PhoneError) return { status: "error", stage: "number", message: error.message };
    console.error("phone verification start failed", error instanceof Error ? error.message : error);
    return { status: "error", stage: "number", message: "Something went wrong on our side. Please try again." };
  }
}

/** Step 2: check the code and save the number. */
export async function confirmPhoneCodeAction(prev: PhoneState, form: FormData): Promise<PhoneState> {
  const session = await requireUser({ allowUnverifiedPhone: true });
  const masked = prev.status === "code" ? prev.masked : "";
  const result = await confirmPhoneVerification(session.user.id, String(form.get("code") ?? "").slice(0, 12));
  if (!result.ok) {
    return result.expired
      ? { status: "error", stage: "number", message: "That code expired or was tried too many times. Send a new one." }
      : { status: "code", masked, message: "That code isn't right. Check the text message and try again." };
  }
  if (!session.user.phoneVerifiedAt) redirect("/account/reports");
  return { status: "done", message: "Your mobile number was updated. We'll text sign-in codes to the new number." };
}

/** One entry point for the two-step form: "send" a code, then "confirm" it. */
export async function phoneAction(prev: PhoneState, form: FormData): Promise<PhoneState> {
  return form.get("intent") === "confirm" ? confirmPhoneCodeAction(prev, form) : sendPhoneCodeAction(prev, form);
}
