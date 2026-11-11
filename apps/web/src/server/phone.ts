import "server-only";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
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

/** Number types nobody can be reached on personally. Mobiles, landlines and VoIP are fine. */
const UNREACHABLE = new Set(["PREMIUM_RATE", "TOLL_FREE", "SHARED_COST", "PAGER", "VOICEMAIL", "UAN"]);

/**
 * The country picked in the form plus the number as typed ("077 123 4567"), or a full
 * international number ("+94 77 123 4567", "0094 …") which wins over the picked country.
 * Returns E.164, or an error people can act on.
 */
export function normalizePhone(raw: string, country?: string | null): string {
  const input = raw.trim().replace(/^00/, "+");
  if (!input) throw new PhoneError("Enter your mobile number.");
  const region = (country ?? "").trim().toUpperCase();
  let phone;
  if (input.startsWith("+")) {
    phone = parsePhoneNumberFromString(input);
  } else {
    if (!/^[A-Z]{2}$/.test(region)) throw new PhoneError("Choose your country, then enter your mobile number.");
    phone = parsePhoneNumberFromString(input, region as CountryCode);
  }
  if (!phone || !phone.isValid()) throw new PhoneError("That doesn't look like a valid number for this country. Check the country and the digits.");
  const type = phone.getType();
  if (type && UNREACHABLE.has(type)) throw new PhoneError("Please give a number we can call or message you on, not a toll-free or premium number.");
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
export async function savePhone(userId: string, raw: string, country?: string | null) {
  const e164 = normalizePhone(raw, country);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phoneEnc: true, emailEnc: true } });
  await prisma.user.update({ where: { id: userId }, data: protectPhone(userId, e164) });
  await userEvent(userId, user.phoneEnc ? "user.phone_changed" : "user.phone_added");
  if (user.phoneEnc) {
    const email = decryptText(user.emailEnc, aad.userEmail());
    await sendEmail({ to: email, ...templates.phoneChanged(maskPhone(e164), `${siteUrl}/forgot-password`) }).catch(() => {});
  }
  return maskPhone(e164);
}
