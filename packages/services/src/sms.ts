import "server-only";
import { appendFileSync } from "node:fs";

/**
 * Text messages (one-time sign-in codes).
 *
 * Providers (SMS_PROVIDER):
 * - "twilio-verify": production. Twilio Verify creates, sends and checks the code itself,
 *   handles sender registration per country, and has built-in SMS-pumping fraud protection.
 * - "log":    development only; prints the code in the terminal, like dev emails.
 * - "file":   CI only (needs ALLOW_TEST_SMS=true); appends messages to SMS_OUTBOX_FILE.
 * - "memory": tests; messages go to `smsOutbox`.
 */
export type SmsProvider = "twilio-verify" | "log" | "file" | "memory";
export const smsOutbox: { to: string; code: string }[] = [];

export class SmsUnavailable extends Error {}

export function smsProvider(): SmsProvider {
  const p = (process.env.SMS_PROVIDER ?? (process.env.NODE_ENV === "production" ? "twilio-verify" : "log")) as SmsProvider;
  if (!["twilio-verify", "log", "file", "memory"].includes(p)) throw new SmsUnavailable(`Unknown SMS_PROVIDER "${p}"`);
  if (process.env.NODE_ENV === "production") {
    if (p === "log" || p === "memory") throw new SmsUnavailable(`SMS_PROVIDER=${p} is not allowed in production`);
    if (p === "file" && process.env.ALLOW_TEST_SMS !== "true") throw new SmsUnavailable("SMS_PROVIDER=file needs ALLOW_TEST_SMS=true (CI only)");
  }
  return p;
}

/** True when the provider generates and checks codes itself (no local code to store). */
export const providerOwnsCodes = () => smsProvider() === "twilio-verify";

function twilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid || !token || !service) throw new SmsUnavailable("Twilio Verify isn't configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID).");
  return { service, auth: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` };
}

async function twilioPost(path: string, body: Record<string, string>) {
  const { service, auth } = twilio();
  const res = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/${path}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
  return { ok: res.ok, httpStatus: res.status, ...data };
}

/** Sends a code. For local providers `code` is ours; for Twilio Verify it's ignored and Twilio makes one. */
export async function sendSmsCode(to: string, code: string): Promise<void> {
  const provider = smsProvider();
  if (provider === "twilio-verify") {
    const r = await twilioPost("Verifications", { To: to, Channel: "sms" });
    if (!r.ok) throw new SmsUnavailable(`Twilio Verify refused the request (${r.httpStatus}${r.code ? ` / ${r.code}` : ""})`);
    return;
  }
  const text = `Your Kuro Trace code is ${code}. It expires in 10 minutes. We will never call you to ask for it.`;
  if (provider === "memory") smsOutbox.push({ to, code });
  else if (provider === "file") appendFileSync(process.env.SMS_OUTBOX_FILE ?? "/tmp/kurotrace-sms.log", `${JSON.stringify({ to, code, at: new Date().toISOString() })}\n`);
  else console.info(`\n[sms] to=${to}\n${text}\n`);
}

/** Twilio Verify only: asks Twilio whether the code is right. */
export async function checkSmsCodeWithProvider(to: string, code: string): Promise<boolean> {
  const r = await twilioPost("VerificationCheck", { To: to, Code: code });
  if (r.httpStatus === 404) return false; // expired, used, or too many tries
  if (!r.ok) throw new SmsUnavailable(`Twilio Verify check failed (${r.httpStatus})`);
  return r.status === "approved";
}
