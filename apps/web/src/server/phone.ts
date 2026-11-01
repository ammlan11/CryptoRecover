import "server-only";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { prisma } from "@kurotrace/db";
import { userEvent } from "@kurotrace/services/audit";
import { decryptText, encryptText, indexFor } from "@kurotrace/services/crypto";
import { sendEmail, templates } from "@kurotrace/services/email";
import { aad } from "@kurotrace/services/records";
import { siteUrl } from "@/lib/site";

/**
 * The mobile number every account gives at sign-up, so the team can reach the reporter.
 * Stored encrypted, with a keyed hash for lookups. Not used for sign-in codes
 * (those go by email), so it isn't exposed to SIM-swap attacks.
 */
export class PhoneError extends Error {}

export const phoneHashFor = (e164: string) => indexFor(e164, "user.phone");

/** Accepts "+81 90 1234 5678", "0081 90 1234 5678" etc. Returns E.164, or an error people can act on. */
export function normalizePhone(raw: string): string {
  const input = raw.trim().replace(/^00/, "+");
  if (!input) throw new PhoneError("Enter your mobile number.");
  if (!input.startsWith("+")) throw new PhoneError("Start your mobile number with the country code, for example +81 for Japan.");
  const phone = parsePhoneNumberFromString(input);
  if (!phone || !phone.isValid()) throw new PhoneError("That doesn't look like a valid mobile number. Check the country code and digits.");
  const type = phone.getType();
  if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") throw new PhoneError("Please give a mobile number.");
  return phone.number;
}

/** Encrypted number plus its lookup hash, for a new or existing user. */
export function protectPhone(userId: string, e164: string) {
  return { phoneEnc: encryptText(e164, aad.userPhone(userId)), phoneHash: phoneHashFor(e164) };
}

/** "+81 ••• ••• 678": enough to recognise, not enough to reuse. */
export function maskPhone(e164: string) {
  const p = parsePhoneNumberFromString(e164);
  const last = e164.slice(-3);
  return p ? `+${p.countryCallingCode} ••• ••• ${last}` : `••• ${last}`;
}

export function userPhone(user: { id: string; phoneEnc: string | null }) {
  return user.phoneEnc ? decryptText(user.phoneEnc, aad.userPhone(user.id)) : null;
}

/** Adds or changes the number. A change emails the account owner. */
export async function savePhone(userId: string, raw: string) {
  const e164 = normalizePhone(raw);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phoneEnc: true, emailEnc: true } });
  await prisma.user.update({ where: { id: userId }, data: protectPhone(userId, e164) });
  await userEvent(userId, user.phoneEnc ? "user.phone_changed" : "user.phone_added");
  if (user.phoneEnc) {
    const email = decryptText(user.emailEnc, aad.userEmail());
    await sendEmail({ to: email, ...templates.phoneChanged(maskPhone(e164), `${siteUrl}/forgot-password`) }).catch(() => {});
  }
  return maskPhone(e164);
}
