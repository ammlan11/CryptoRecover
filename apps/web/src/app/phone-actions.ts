"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@kurotrace/core/password";
import { RateLimiter } from "@kurotrace/core/rate-limit";
import { prisma } from "@kurotrace/db";
import { requireUser } from "@/lib/session";
import { PhoneError, savePhone } from "@/server/phone";

export type PhoneState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string };

const limiter = new RateLimiter(10, 60 * 60_000);
const raw = (form: FormData) => String(form.get("phone") ?? "").slice(0, 40);

/** First number, for accounts that don't have one yet. */
export async function addPhoneAction(_prev: PhoneState, form: FormData): Promise<PhoneState> {
  const session = await requireUser({ allowMissingPhone: true });
  if (session.user.phoneHash) redirect("/account/reports");
  try {
    await savePhone(session.user.id, raw(form));
  } catch (error) {
    if (error instanceof PhoneError) return { status: "error", message: error.message };
    throw error;
  }
  redirect("/account/reports");
}

/** Changing the number is a security change: it needs the password, and we email the owner. */
export async function changePhoneAction(_prev: PhoneState, form: FormData): Promise<PhoneState> {
  const session = await requireUser();
  if (!limiter.check(`phone:${session.user.id}`).allowed) return { status: "error", message: "Too many attempts. Please try again later." };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, String(form.get("password") ?? "").slice(0, 256)))) {
    return { status: "error", message: "Your password is not correct." };
  }
  try {
    const masked = await savePhone(session.user.id, raw(form));
    revalidatePath("/account/settings");
    return { status: "success", message: `Saved. Your mobile number is now ${masked}.` };
  } catch (error) {
    if (error instanceof PhoneError) return { status: "error", message: error.message };
    throw error;
  }
}
