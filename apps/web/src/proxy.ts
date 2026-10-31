import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@demo/core/headers";

/**
 * Runs before every page: issues a fresh CSP nonce per request. Next.js reads the
 * nonce from the request's CSP header and applies it to its own scripts.
 * Ad pixels (Phase 2) will be allowed on /lp/* campaign pages only, never on
 * account or report pages.
 */
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
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
