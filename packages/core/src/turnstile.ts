/**
 * Server-side check of a Cloudflare Turnstile token (the bot check on public forms).
 * Tokens are single-use and valid for 5 minutes; Cloudflare also tells us which
 * hostname and form ("action") the token was issued for, and we insist they match.
 */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileInput {
  token: string | null | undefined;
  secret: string;
  ip?: string;
  /** The form name the widget was rendered with, e.g. "signup". */
  expectedAction?: string;
  /** Production hostnames the widget may run on. Empty = don't check. */
  expectedHostnames?: string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type TurnstileResult = { ok: true } | { ok: false; reason: "missing" | "rejected" | "wrong-action" | "wrong-host" | "unavailable" };

export async function verifyTurnstile(input: TurnstileInput): Promise<TurnstileResult> {
  const token = (input.token ?? "").trim();
  if (!token || token.length > 2048) return { ok: false, reason: "missing" };
  const body = new URLSearchParams({ secret: input.secret, response: token });
  if (input.ip && input.ip !== "unknown") body.set("remoteip", input.ip);
  let data: { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[] };
  try {
    const res = await (input.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(input.timeoutMs ?? 5000),
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (data.success !== true) return { ok: false, reason: "rejected" };
  // Cloudflare's always-pass test keys return no action/hostname checks worth enforcing.
  if (input.expectedAction && data.action && data.action !== input.expectedAction) return { ok: false, reason: "wrong-action" };
  if (input.expectedHostnames?.length && data.hostname && !input.expectedHostnames.includes(data.hostname)) return { ok: false, reason: "wrong-host" };
  return { ok: true };
}
