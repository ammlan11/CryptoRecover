import "server-only";
import { verifyTurnstile } from "@kurotrace/core/turnstile";
import { clientIp } from "@/lib/request";

export type BotCheckAction = "signup" | "login" | "forgot" | "lead" | "watch" | "newsletter";

let warned = false;

/**
 * Bot check for public forms (Cloudflare Turnstile).
 * - Keys set: the token must verify for this form and this site's hostname.
 * - No keys outside production (dev, tests): skipped.
 * - No keys in production: forms are refused, unless BOT_CHECK=off is set on purpose.
 *   Fails closed, so a missing setting can't silently open the forms to bots.
 */
export async function passesBotCheck(form: FormData, action: BotCheckAction): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV !== "production" || process.env.BOT_CHECK === "off") return true;
    if (!warned) {
      warned = true;
      console.error("TURNSTILE_SECRET_KEY is not set: public forms are refused. Set the Turnstile keys, or BOT_CHECK=off to run without a bot check.");
    }
    return false;
  }
  const hosts = (process.env.TURNSTILE_HOSTNAMES ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  const result = await verifyTurnstile({
    token: form.get("cf-turnstile-response")?.toString(),
    secret,
    ip: await clientIp(),
    expectedAction: action,
    expectedHostnames: hosts,
  });
  if (!result.ok && result.reason !== "missing") console.warn(`bot check failed (${action}): ${result.reason}`);
  return result.ok;
}

export const BOT_CHECK_FAILED = "The security check didn't complete. Please wait a moment and try again.";
