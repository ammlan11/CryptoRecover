import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce, securityHeaders } from "@kurotrace/core/headers";
import { clientIpFromHeaders } from "@kurotrace/core/ip";
import { RateLimiter } from "@kurotrace/core/rate-limit";
import { ATTRIBUTION_COOKIE, attributionFromUrl } from "@/lib/attribution";
import { adCspSources, ADS_ENABLED, isAdPage } from "@/lib/ads";

/**
 * Runs before every page:
 * 1. Issues a fresh CSP nonce. Next.js reads it from the request's CSP header and
 *    applies it to its own scripts.
 * 2. Saves ad attribution (utm_*, gclid, fbclid) from the landing URL in a first-party
 *    cookie for 30 days, so lead forms can record which campaign brought the visitor.
 * 3. Turns away floods from one address (429) before any page work happens.
 * 4. Allows the Cloudflare bot-check frame when it is configured, and the Meta/Google
 *    ad tags on campaign landing pages (/lp/*) only.
 */
/**
 * Per-address flood limit for page and form requests (static files don't count).
 * Generous for people, tight for bots hammering the site. Cloudflare's own rate
 * limits sit in front of this in production.
 */
const perMinute = Number(process.env.REQUESTS_PER_MINUTE ?? 300);
const flood = new RateLimiter(perMinute, 60_000);
const formFlood = new RateLimiter(Math.max(10, Math.round(perMinute / 5)), 60_000);

function tooMany(retryAfterMs: number) {
  const res = new NextResponse("Too many requests. Please wait a minute and try again.", {
    status: 429,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
  });
  for (const [key, value] of Object.entries(securityHeaders({ dev: process.env.NODE_ENV === "development" }))) res.headers.set(key, value);
  return res;
}

export function proxy(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers, process.env.TRUSTED_IP_HEADER ?? "x-forwarded-for") ?? "unknown";
  const hit = flood.check(ip);
  if (!hit.allowed) return tooMany(hit.retryAfterMs);
  if (request.method === "POST") {
    const post = formFlood.check(ip);
    if (!post.allowed) return tooMany(post.retryAfterMs);
  }
  const nonce = generateNonce();
  const botCheck = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? ["https://challenges.cloudflare.com"] : [];
  // Ad tags are allowed on campaign landing pages only.
  const ads = ADS_ENABLED && isAdPage(request.nextUrl.pathname) ? adCspSources() : { script: [], connect: [], img: [], frame: [] };
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    extraScriptSrc: [...botCheck, ...ads.script],
    extraConnectSrc: ads.connect,
    extraImgSrc: ads.img,
    extraFrameSrc: [...botCheck, ...ads.frame],
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const attribution = attributionFromUrl(request.nextUrl);
  if (attribution) {
    response.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify(attribution), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
