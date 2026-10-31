/**
 * Ad attribution. The proxy copies utm_*, gclid and fbclid from the landing URL into a
 * first-party cookie, so the lead form can record which campaign brought the visitor
 * even after they click around. No third-party scripts involved.
 */
import { z } from "zod";

export const ATTRIBUTION_COOKIE = "__Host-attr";
export const ATTRIBUTION_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"] as const;

const field = z.string().trim().max(255).optional();
const schema = z.object({
  utm_source: field,
  utm_medium: field,
  utm_campaign: field,
  utm_content: field,
  utm_term: field,
  gclid: field,
  fbclid: field,
  landing: z.string().max(255).optional(),
});

export type Attribution = z.infer<typeof schema>;

export function parseAttribution(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Reads attribution params from a URL; returns null when there are none. */
export function attributionFromUrl(url: URL): Attribution | null {
  const found: Record<string, string> = {};
  for (const key of ATTRIBUTION_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) found[key] = value.slice(0, 255);
  }
  if (Object.keys(found).length === 0) return null;
  return { ...found, landing: url.pathname.slice(0, 255) };
}
