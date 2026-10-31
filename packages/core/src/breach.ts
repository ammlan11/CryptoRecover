/**
 * Checks a password against known breaches with the Pwned Passwords range API.
 * k-anonymity: only the first 5 hex characters of the SHA-1 hash leave the server,
 * and padding hides how many matches came back.
 */
import { createHash } from "node:crypto";

export interface BreachResult {
  /** True when the password appears in a known breach. */
  breached: boolean;
  /** False when the service could not be reached; callers decide whether to block. */
  checked: boolean;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "text">>;

export async function checkPasswordBreach(
  password: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 3000,
): Promise<BreachResult> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { breached: false, checked: false };
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count) > 0) return { breached: true, checked: true };
    }
    return { breached: false, checked: true };
  } catch {
    return { breached: false, checked: false };
  }
}
