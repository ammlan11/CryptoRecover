import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { CONSENT_COOKIE, META_PIXEL_ID } from "@/lib/ads";
import { clientIp } from "@/lib/request";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/**
 * Server-side "Lead" event for Meta (Conversions API), so ad reporting survives ad
 * blockers and browser tracking limits. Sent only when the visitor allowed ad cookies
 * (or consent mode is "implied"), with the email hashed as Meta requires. Uses the same
 * event id as the browser pixel, so Meta counts the lead once. Never blocks the form.
 */
export async function sendLeadConversion(input: { eventId: string; email: string; fbclid?: string; landing?: string }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !META_PIXEL_ID) return;
  const jar = await cookies();
  const consent = process.env.NEXT_PUBLIC_ADS_CONSENT === "implied" || jar.get(CONSENT_COOKIE)?.value === "yes";
  if (!consent) return;
  const h = await headers();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const fbp = jar.get("_fbp")?.value;
  const fbc = jar.get("_fbc")?.value ?? (input.fbclid ? `fb.1.${Date.now()}.${input.fbclid}` : undefined);
  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.landing ? `${site}${input.landing}` : site,
        user_data: {
          em: [sha256(input.email)],
          client_ip_address: await clientIp(),
          client_user_agent: h.get("user-agent") ?? undefined,
          ...(fbp ? { fbp } : {}),
          ...(fbc ? { fbc } : {}),
        },
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(META_PIXEL_ID)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.warn(`Meta conversion not accepted: HTTP ${res.status}`);
  } catch (error) {
    console.warn("Meta conversion failed:", error instanceof Error ? error.message : error);
  }
}
