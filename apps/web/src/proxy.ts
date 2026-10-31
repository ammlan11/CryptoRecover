import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@kurotrace/core/headers";
import { ATTRIBUTION_COOKIE, attributionFromUrl } from "@/lib/attribution";
import { adCspSources, ADS_ENABLED, isAdPage } from "@/lib/ads";

/**
 * Runs before every page:
 * 1. Issues a fresh CSP nonce. Next.js reads it from the request's CSP header and
 *    applies it to its own scripts.
 * 2. Saves ad attribution (utm_*, gclid, fbclid) from the landing URL in a first-party
 *    cookie for 30 days, so lead forms can record which campaign brought the visitor.
 * 3. Allows the Cloudflare bot-check frame when it is configured, and the Meta/Google
 *    ad tags on campaign landing pages (/lp/*) only.
 */
export function proxy(request: NextRequest) {
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
