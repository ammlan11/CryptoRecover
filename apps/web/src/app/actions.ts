"use server";

/**
 * Server actions behind every lead form and the checker. Next.js checks the request's
 * Origin against the host for server actions, which blocks cross-site form posts.
 * Every input is validated here, rate-limited per IP, and emails are stored only
 * encrypted plus a keyed hash.
 */
import { cookies } from "next/headers";
import { z } from "zod";
import { normalizeIndicator } from "@kurotrace/core/indicators";
import { RateLimiter } from "@kurotrace/core/rate-limit";
import { prisma, type IndicatorKind, type LeadSource } from "@kurotrace/db";
import { ATTRIBUTION_COOKIE, parseAttribution } from "@/lib/attribution";
import { LOSS_BAND_OPTIONS, SCAM_TYPE_OPTIONS } from "@/lib/options";
import { clientIp } from "@/lib/request";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { sendLeadConversion } from "@/server/conversions";
import { checkThreatLists, listsUpdatedAt, type ListMatch } from "@kurotrace/services/threat-lists";
import { encryptText, protectEmail } from "@kurotrace/services/crypto";
import { sendEmail, templates } from "@kurotrace/services/email";
import { aad } from "@kurotrace/services/records";
import { normalizePhone, PhoneError } from "@/server/phone";
import { sendContinueReportLink } from "@/server/accounts";

export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string; eventId?: string }
  | { status: "error"; message: string; field?: string };

export type CheckState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "result";
      kind: IndicatorKind;
      value: string;
      count: number;
      since: string | null;
      /** Free public lists that name it (sanctions, scam sites). */
      lists: ListMatch[];
      listsUpdated: string | null;
    };

const leadLimiter = new RateLimiter(5, 10 * 60_000);
const checkLimiter = new RateLimiter(30, 60_000);

const email = z.email({ message: "Enter a valid email address" }).max(254);
const scamTypes = SCAM_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const lossBands = LOSS_BAND_OPTIONS.map((o) => o.value) as [string, ...string[]];
const DAY = 24 * 60 * 60_000;
const GENERIC_ERROR = "Something went wrong on our side. Please try again in a minute.";
const SLOW_DOWN = "Too many attempts. Please wait a few minutes and try again.";

/** Hidden "website" field: people never see it, bots fill it in. Pretend success. */
function isBot(form: FormData) {
  return typeof form.get("website") === "string" && (form.get("website") as string).length > 0;
}

async function attribution() {
  return parseAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
}

type LeadExtra = {
  scamType?: string;
  lossBand?: string;
  marketingConsent?: boolean;
  /** E.164, already validated. */
  phone?: string;
  whatsappOptIn?: boolean;
  contactOptIn?: boolean;
};

/** Phone and consents for a lead: the phone is encrypted, consents are time-stamped. */
function contactFields(extra: LeadExtra) {
  const consented = Boolean(extra.marketingConsent || extra.whatsappOptIn || extra.contactOptIn);
  return {
    ...(extra.phone ? { phoneEnc: encryptText(extra.phone, aad.leadPhone()) } : {}),
    ...(extra.whatsappOptIn ? { whatsappOptIn: true } : {}),
    ...(extra.contactOptIn ? { contactOptIn: true } : {}),
    ...(consented ? { consentAt: new Date() } : {}),
  };
}

async function saveLead(source: LeadSource, address: string, extra: LeadExtra): Promise<string> {
  const { emailHash, emailEnc } = protectEmail(address, "lead.email");
  const recent = await prisma.lead.findFirst({
    where: { emailHash, source, createdAt: { gt: new Date(Date.now() - DAY) } },
    select: { id: true },
  });
  if (recent) {
    // Same person, same form, within a day: don't duplicate, but keep a newly given phone or consent.
    const update = contactFields(extra);
    if (Object.keys(update).length) await prisma.lead.update({ where: { id: recent.id }, data: update });
    return recent.id;
  }
  const attr = await attribution();
  const lead = await prisma.lead.create({
    data: {
      source,
      emailHash,
      emailEnc,
      scamType: extra.scamType as never,
      lossBand: extra.lossBand as never,
      marketingConsent: extra.marketingConsent ?? false,
      ...contactFields(extra),
      landingPage: attr.landing,
      utmSource: attr.utm_source,
      utmMedium: attr.utm_medium,
      utmCampaign: attr.utm_campaign,
      utmContent: attr.utm_content,
      utmTerm: attr.utm_term,
      gclid: attr.gclid,
      fbclid: attr.fbclid,
    },
    select: { id: true },
  });
  return lead.id;
}

const startSchema = z.object({
  source: z.enum(["HERO_FORM", "CAMPAIGN_FORM"]),
  scamType: z.enum(scamTypes),
  lossBand: z.enum(lossBands).optional(),
  email,
});

/** Optional mobile number: undefined when empty, the E.164 number, or the error to show. */
function optionalPhone(form: FormData): string | undefined | PhoneError {
  const raw = String(form.get("phone") ?? "").trim().slice(0, 40);
  if (!raw) return undefined;
  try {
    return normalizePhone(raw, String(form.get("phoneCountry") ?? "").slice(0, 2));
  } catch (error) {
    return error instanceof PhoneError ? error : new PhoneError("Check your mobile number.");
  }
}

/**
 * "Keep me protected" on the ad landing pages: email (required), mobile (optional) and an
 * optional WhatsApp alerts opt-in. Sends the free checklist they asked for, and counts as a
 * lead for the ad platforms. We contact them only for what they ticked.
 */
export async function protectSignup(_prev: FormState, form: FormData): Promise<FormState> {
  const success: FormState = { status: "success", message: "Done. Your free checklist is on its way: check your inbox (and spam, just in case)." };
  if (isBot(form)) return success;
  if (!leadLimiter.check(`lead:${await clientIp()}`).allowed) return { status: "error", message: SLOW_DOWN };
  if (!(await passesBotCheck(form, "lead"))) return { status: "error", message: BOT_CHECK_FAILED };
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address", field: "email" };
  const phone = optionalPhone(form);
  if (phone instanceof PhoneError) return { status: "error", message: phone.message, field: "phone" };
  const whatsappOptIn = Boolean(phone) && form.get("whatsappOptIn") === "on";
  try {
    const leadId = await saveLead("LP_PROTECT", parsed.data, { phone, whatsappOptIn });
    await sendEmail({ to: parsed.data, ...templates.protectChecklist(whatsappOptIn) });
    const eventId = `protect-${leadId}`;
    const attr = await attribution();
    await sendLeadConversion({ eventId, email: parsed.data, phone, fbclid: attr.fbclid, landing: attr.landing, content: "protect" });
    return { ...success, eventId };
  } catch (error) {
    console.error("protectSignup failed", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** Hero and campaign forms: the first step of a report. */
export async function startReport(_prev: FormState, form: FormData): Promise<FormState> {
  const success: FormState = {
    status: "success",
    message: "Check your inbox: we've sent you a secure link to finish your report. It takes about 5 minutes.",
  };
  if (isBot(form)) return success;
  if (!leadLimiter.check(`lead:${await clientIp()}`).allowed) return { status: "error", message: SLOW_DOWN };
  if (!(await passesBotCheck(form, "lead"))) return { status: "error", message: BOT_CHECK_FAILED };

  const parsed = startSchema.safeParse({
    source: form.get("source"),
    scamType: form.get("scamType"),
    lossBand: form.get("lossBand") || undefined,
    email: form.get("email"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: issue?.message ?? "Please check the form", field: issue?.path[0]?.toString() };
  }
  if (parsed.data.source === "CAMPAIGN_FORM" && form.get("consent") !== "on") {
    return { status: "error", message: "Please agree to the research use of your report to continue.", field: "consent" };
  }
  const phone = optionalPhone(form);
  if (phone instanceof PhoneError) return { status: "error", message: phone.message, field: "phone" };
  try {
    const leadId = await saveLead(parsed.data.source, parsed.data.email, {
      scamType: parsed.data.scamType,
      lossBand: parsed.data.lossBand,
      phone,
      contactOptIn: form.get("contactOptIn") === "on",
    });
    await sendContinueReportLink(parsed.data.email, leadId);
    // Same id for the browser pixel and the server-side event, so the lead is counted once.
    const eventId = `lead-${leadId}`;
    const attr = await attribution();
    await sendLeadConversion({ eventId, email: parsed.data.email, phone, fbclid: attr.fbclid, landing: attr.landing, content: "report" });
    return { ...success, eventId };
  } catch (error) {
    console.error("startReport failed", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** Public checker: counts confirmed reports for a wallet, site or handle. */
export async function checkIndicator(_prev: CheckState, form: FormData): Promise<CheckState> {
  if (!checkLimiter.check(`check:${await clientIp()}`).allowed) return { status: "error", message: SLOW_DOWN };
  const raw = form.get("q");
  const indicator = typeof raw === "string" ? normalizeIndicator(raw) : null;
  if (!indicator) return { status: "error", message: "Paste a wallet address, website or @handle to check." };
  try {
    const [result, lists, updated] = await Promise.all([
      prisma.reportIndicator.aggregate({
        where: { kind: indicator.kind, normalizedValue: indicator.normalizedValue, confirmedAt: { not: null } },
        _count: { _all: true },
        _min: { createdAt: true },
      }),
      checkThreatLists(indicator, raw as string),
      listsUpdatedAt(),
    ]);
    return {
      status: "result",
      kind: indicator.kind,
      value: indicator.normalizedValue,
      count: result._count._all,
      since: result._min.createdAt?.toISOString() ?? null,
      lists,
      listsUpdated: updated?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("checkIndicator failed", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

const watchSchema = z.object({
  email,
  kind: z.enum(["WALLET", "TX_HASH", "DOMAIN", "TELEGRAM", "PHONE", "EMAIL", "OTHER"]),
  value: z.string().min(1).max(512),
});

/** "Email me if it's reported again" under a checker result. */
export async function watchIndicator(_prev: FormState, form: FormData): Promise<FormState> {
  const success: FormState = { status: "success", message: "Done. We'll email you if it's reported again." };
  if (isBot(form)) return success;
  if (!leadLimiter.check(`lead:${await clientIp()}`).allowed) return { status: "error", message: SLOW_DOWN };
  if (!(await passesBotCheck(form, "watch"))) return { status: "error", message: BOT_CHECK_FAILED };
  const parsed = watchSchema.safeParse({ email: form.get("email"), kind: form.get("kind"), value: form.get("value") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form" };
  // Re-normalise server-side; never trust the hidden fields as sent.
  const indicator = normalizeIndicator(parsed.data.value);
  if (!indicator) return { status: "error", message: "That address could not be read." };
  try {
    const { emailHash, emailEnc } = protectEmail(parsed.data.email, "watch.email");
    const existing = await prisma.indicatorWatch.findFirst({
      where: { emailHash, kind: indicator.kind, normalizedValue: indicator.normalizedValue, unsubscribedAt: null },
      select: { id: true },
    });
    if (!existing) {
      await prisma.indicatorWatch.create({
        data: { emailHash, emailEnc, kind: indicator.kind, normalizedValue: indicator.normalizedValue },
      });
    }
    await saveLead("CHECKER_WATCH", parsed.data.email, {});
    return success;
  } catch (error) {
    console.error("watchIndicator failed", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** Weekly scam alert sign-up. */
export async function subscribeNewsletter(_prev: FormState, form: FormData): Promise<FormState> {
  const success: FormState = { status: "success", message: "You're on the list. The next scam alert arrives this week." };
  if (isBot(form)) return success;
  if (!leadLimiter.check(`lead:${await clientIp()}`).allowed) return { status: "error", message: SLOW_DOWN };
  if (!(await passesBotCheck(form, "newsletter"))) return { status: "error", message: BOT_CHECK_FAILED };
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address" };
  try {
    const leadId = await saveLead("NEWSLETTER", parsed.data, { marketingConsent: true });
    // Counted as a lead in Meta/Google too (only where ad tracking is allowed), labelled "newsletter".
    const eventId = `newsletter-${leadId}`;
    const attr = await attribution();
    await sendLeadConversion({ eventId, email: parsed.data, fbclid: attr.fbclid, landing: attr.landing, content: "newsletter" });
    return { ...success, eventId };
  } catch (error) {
    console.error("subscribeNewsletter failed", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
