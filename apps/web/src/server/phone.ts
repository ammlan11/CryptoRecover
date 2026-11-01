import "server-only";
import { randomInt } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { safeEqual } from "@kurotrace/core/tokens";
import { prisma, type PhoneCodePurpose } from "@kurotrace/db";
import { userEvent } from "@kurotrace/services/audit";
import { decryptText, encryptText, indexFor } from "@kurotrace/services/crypto";
import { sendEmail, templates } from "@kurotrace/services/email";
import { aad } from "@kurotrace/services/records";
import { checkSmsCodeWithProvider, providerOwnsCodes, sendSmsCode, SmsUnavailable } from "@kurotrace/services/sms";
import { siteUrl } from "@/lib/site";

/**
 * Mobile number verification and the text-message step of every sign-in.
 *
 * Limits protect users and our SMS bill ("SMS pumping" fraud sends floods of codes to
 * premium numbers): a short wait between codes, per-account, per-number, per-IP and
 * site-wide daily caps, and an optional list of allowed countries.
 */
export const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;
const MAX_PER_ACCOUNT_HOUR = 5;
const MAX_PER_NUMBER_DAY = 10;
const MAX_PER_IP_HOUR = 10;
const HOUR = 60 * 60_000;

export class PhoneError extends Error {}

const PHONE_CONTEXT = "user.phone";
export const phoneHashFor = (e164: string) => indexFor(e164, PHONE_CONTEXT);
const codeDigest = (userId: string, purpose: PhoneCodePurpose, code: string) => indexFor(code, `phone-code:${userId}:${purpose}`);

/** Accepts "+94 77 123 4567", "0094771234567" etc. Returns E.164, or an error people can act on. */
export function normalizePhone(raw: string): { e164: string; country: string | undefined } {
  const input = raw.trim().replace(/^00/, "+");
  if (!input.startsWith("+")) throw new PhoneError("Start with your country code, for example +94 or +971.");
  const phone = parsePhoneNumberFromString(input);
  if (!phone || !phone.isValid()) throw new PhoneError("That doesn't look like a valid mobile number. Check the country code and digits.");
  const type = phone.getType();
  if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") throw new PhoneError("Please use a mobile number that can receive text messages.");
  const allowed = (process.env.SMS_ALLOWED_COUNTRIES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (allowed.length && (!phone.country || !allowed.includes(phone.country))) {
    throw new PhoneError("We can't send text messages to numbers in that country yet.");
  }
  return { e164: phone.number, country: phone.country };
}

/** "+94 ••• ••• 567": enough to recognise, not enough to reuse. */
export function maskPhone(e164: string) {
  const p = parsePhoneNumberFromString(e164);
  const last = e164.slice(-3);
  return p ? `+${p.countryCallingCode} ••• ••• ${last}` : `••• ${last}`;
}

export function userPhone(user: { id: string; phoneEnc: string | null }) {
  return user.phoneEnc ? decryptText(user.phoneEnc, aad.userPhone(user.id)) : null;
}

async function issueCode(userId: string, purpose: PhoneCodePurpose, e164: string, ipHash: string | null) {
  const now = Date.now();
  const phoneHash = phoneHashFor(e164);
  const last = await prisma.phoneCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && last.createdAt.getTime() > now - RESEND_SECONDS * 1000) throw new PhoneError("We just sent a code. Please wait 30 seconds before asking for another.");
  const since = (ms: number) => ({ gt: new Date(now - ms) });
  const [perAccount, perNumber, perIp, today] = await Promise.all([
    prisma.phoneCode.count({ where: { userId, createdAt: since(HOUR) } }),
    prisma.phoneCode.count({ where: { phoneHash, createdAt: since(24 * HOUR) } }),
    ipHash ? prisma.phoneCode.count({ where: { ipHash, createdAt: since(HOUR) } }) : Promise.resolve(0),
    prisma.phoneCode.count({ where: { createdAt: since(24 * HOUR) } }),
  ]);
  if (perAccount >= MAX_PER_ACCOUNT_HOUR || perIp >= MAX_PER_IP_HOUR) throw new PhoneError("Too many codes requested. Please try again in an hour.");
  if (perNumber >= MAX_PER_NUMBER_DAY) throw new PhoneError("Too many codes were sent to this number today. Please try again tomorrow.");
  if (today >= Number(process.env.SMS_DAILY_LIMIT ?? 2000)) {
    console.error("SMS daily limit reached: no more codes until the window rolls over (SMS_DAILY_LIMIT).");
    throw new PhoneError("Text messages are paused for a short while. Please try again later.");
  }

  // Only the newest code works.
  await prisma.phoneCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  const owns = providerOwnsCodes();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await prisma.phoneCode.create({
    data: {
      userId,
      purpose,
      phoneEnc: encryptText(e164, aad.phoneCode(userId)),
      phoneHash,
      codeHash: owns ? null : codeDigest(userId, purpose, code),
      ipHash,
      expiresAt: new Date(now + CODE_MINUTES * 60_000),
    },
  });
  try {
    await sendSmsCode(e164, code);
  } catch (error) {
    await prisma.phoneCode.delete({ where: { id: row.id } }).catch(() => {});
    if (error instanceof SmsUnavailable) {
      console.error("SMS send failed:", error.message);
      throw new PhoneError("We couldn't send a text message just now. Please try again in a minute.");
    }
    throw error;
  }
  return maskPhone(e164);
}

/** Checks the newest code for this purpose. Returns the number it was sent to when correct. */
async function checkCode(userId: string, purpose: PhoneCodePurpose, raw: string): Promise<{ ok: true; e164: string } | { ok: false; expired: boolean }> {
  const code = raw.replace(/\D/g, "");
  const row = await prisma.phoneCode.findFirst({ where: { userId, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date() || row.attempts >= MAX_ATTEMPTS) return { ok: false, expired: true };
  // Count the attempt first, conditionally, so parallel guesses can't exceed the limit.
  const { count } = await prisma.phoneCode.updateMany({ where: { id: row.id, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (count !== 1 || code.length !== 6) return { ok: false, expired: count !== 1 };
  const e164 = decryptText(row.phoneEnc, aad.phoneCode(userId));
  let right: boolean;
  try {
    right = row.codeHash ? safeEqual(row.codeHash, codeDigest(userId, purpose, code)) : await checkSmsCodeWithProvider(e164, code);
  } catch (error) {
    console.error("SMS code check failed:", error instanceof Error ? error.message : error);
    return { ok: false, expired: false };
  }
  if (!right) return { ok: false, expired: false };
  const used = await prisma.phoneCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return used.count === 1 ? { ok: true, e164 } : { ok: false, expired: true };
}

// ─── Confirming (or changing) the mobile number ──────────────────

export async function startPhoneVerification(userId: string, rawPhone: string, ipHash: string | null) {
  const { e164 } = normalizePhone(rawPhone);
  return issueCode(userId, "VERIFY", e164, ipHash);
}

export async function confirmPhoneVerification(userId: string, code: string): Promise<{ ok: true } | { ok: false; expired: boolean }> {
  const result = await checkCode(userId, "VERIFY", code);
  if (!result.ok) return result;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phoneVerifiedAt: true, emailEnc: true } });
  await prisma.user.update({
    where: { id: userId },
    data: { phoneEnc: encryptText(result.e164, aad.userPhone(userId)), phoneHash: phoneHashFor(result.e164), phoneVerifiedAt: new Date() },
  });
  const changed = Boolean(user.phoneVerifiedAt);
  await userEvent(userId, changed ? "user.phone_changed" : "user.phone_verified");
  if (changed) {
    const email = decryptText(user.emailEnc, aad.userEmail());
    await sendEmail({ to: email, ...templates.phoneChanged(maskPhone(result.e164), `${siteUrl}/forgot-password`) }).catch(() => {});
  }
  return { ok: true };
}

// ─── Sign-in ─────────────────────────────────────────────────────

export async function sendLoginCode(userId: string, ipHash: string | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, phoneEnc: true, phoneVerifiedAt: true } });
  const e164 = user.phoneVerifiedAt ? userPhone(user) : null;
  if (!e164) throw new PhoneError("This account has no confirmed mobile number.");
  return issueCode(userId, "LOGIN", e164, ipHash);
}

export async function loginCodeAccepted(userId: string, code: string) {
  const result = await checkCode(userId, "LOGIN", code);
  return result.ok;
}
