/**
 * Ad measurement (Meta Pixel, Google tag) — on campaign landing pages (/lp/*) only,
 * never on report, account or other pages, and only after the visitor agrees.
 * IDs are public by nature and inlined at build time.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
export const GOOGLE_TAG_ID = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID ?? ""; // G-… or AW-…
/** Google Ads conversion for a started report, "AW-123456789/AbCdEfGh". */
export const GOOGLE_LEAD_SEND_TO = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO ?? "";
/** "banner" (default): ask first. "implied": load without asking — only where your legal adviser says that's allowed. */
export const ADS_CONSENT_MODE = process.env.NEXT_PUBLIC_ADS_CONSENT === "implied" ? "implied" : "banner";

export const ADS_ENABLED = Boolean(META_PIXEL_ID || GOOGLE_TAG_ID);
export const CONSENT_COOKIE = "kt_ads";
export const LEAD_EVENT = "kurotrace:lead";

export function isAdPage(pathname: string) {
  return pathname.startsWith("/lp/");
}

/** Extra CSP sources for the ad tags, added on landing pages only. */
export function adCspSources() {
  const script: string[] = [], connect: string[] = [], img: string[] = [], frame: string[] = [];
  if (META_PIXEL_ID) {
    script.push("https://connect.facebook.net");
    connect.push("https://www.facebook.com", "https://connect.facebook.net");
    img.push("https://www.facebook.com");
  }
  if (GOOGLE_TAG_ID) {
    script.push("https://www.googletagmanager.com", "https://www.google.com", "https://googleads.g.doubleclick.net");
    connect.push("https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com", "https://www.google.com", "https://googleads.g.doubleclick.net", "https://pagead2.googlesyndication.com");
    img.push("https://www.google-analytics.com", "https://*.google-analytics.com", "https://www.googletagmanager.com", "https://www.google.com", "https://googleads.g.doubleclick.net", "https://*.doubleclick.net");
    frame.push("https://td.doubleclick.net", "https://www.googletagmanager.com");
  }
  return { script, connect, img, frame };
}
