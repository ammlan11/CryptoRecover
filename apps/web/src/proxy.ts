import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@kurotrace/core/headers";
import { ATTRIBUTION_COOKIE, attributionFromUrl } from "@/lib/attribution";

/**
 * Runs before every page:
 * 1. Issues a fresh CSP nonce. Next.js reads it from the request's CSP header and
 *    applies it to its own scripts.
 * 2. Saves ad attribution (utm_*, gclid, fbclid) from the landing URL in a first-party
 *    cookie for 30 days, so lead forms can record which campaign brought the visitor.
 * Ad pixels (Phase 5) will be allowed on /lp/* only, never on account or report pages.
 */
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });

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
