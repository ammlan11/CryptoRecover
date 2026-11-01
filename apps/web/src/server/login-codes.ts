import "server-only";
import { randomInt } from "node:crypto";
import { safeEqual } from "@kurotrace/core/tokens";
import { prisma } from "@kurotrace/db";
import { decryptText, indexFor } from "@kurotrace/services/crypto";
import { sendEmail, templates } from "@kurotrace/services/email";
import { aad } from "@kurotrace/services/records";

/**
 * Emailed one-time codes: the second step of every sign-in.
 * 6 digits, 10 minutes, 5 tries, only the newest works, single use, stored as a keyed hash.
 * Limits stop anyone using the form to flood someone's inbox.
 */
export const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;
const MAX_PER_ACCOUNT_HOUR = 6;
const MAX_PER_IP_HOUR = 20;
const HOUR = 60 * 60_000;

export class LoginCodeError extends Error {}

const digest = (userId: string, code: string) => indexFor(code, `login-code:${userId}`);

/** "a•••@gmail.com" */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

/** Emails a fresh code. Returns the masked address it went to. */
export async function sendLoginCode(userId: string, ipHash: string | null) {
  const now = Date.now();
  const last = await prisma.loginCode.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && last.createdAt.getTime() > now - RESEND_SECONDS * 1000) throw new LoginCodeError("We just sent a code. Please wait 30 seconds before asking for another.");
  const since = { gt: new Date(now - HOUR) };
  const [perAccount, perIp] = await Promise.all([
    prisma.loginCode.count({ where: { userId, createdAt: since } }),
    ipHash ? prisma.loginCode.count({ where: { ipHash, createdAt: since } }) : Promise.resolve(0),
  ]);
  if (perAccount >= MAX_PER_ACCOUNT_HOUR || perIp >= MAX_PER_IP_HOUR) throw new LoginCodeError("Too many codes requested. Please try again in an hour.");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailEnc: true } });
  const email = decryptText(user.emailEnc, aad.userEmail());
  await prisma.loginCode.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } }); // only the newest works
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await prisma.loginCode.create({
    data: { userId, codeHash: digest(userId, code), ipHash, expiresAt: new Date(now + CODE_MINUTES * 60_000) },
  });
  try {
    await sendEmail({ to: email, ...templates.loginCode(code, CODE_MINUTES) });
  } catch (error) {
    await prisma.loginCode.delete({ where: { id: row.id } }).catch(() => {});
    console.error("sign-in code email failed:", error instanceof Error ? error.message : error);
    throw new LoginCodeError("We couldn't send the email just now. Please try again in a minute.");
  }
  return maskEmail(email);
}

/** True once for the right, newest, unexpired code. A correct code also proves the email address. */
export async function loginCodeAccepted(userId: string, raw: string): Promise<boolean> {
  const code = raw.replace(/\D/g, "");
  const row = await prisma.loginCode.findFirst({ where: { userId, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date() || code.length !== 6) return false;
  // Count the try first, conditionally, so parallel guesses can't exceed the limit.
  const { count } = await prisma.loginCode.updateMany({ where: { id: row.id, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (count !== 1 || !safeEqual(row.codeHash, digest(userId, code))) return false;
  const used = await prisma.loginCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count !== 1) return false;
  await prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  return true;
}
