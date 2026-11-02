import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce, securityHeaders } from "@kurotrace/core/headers";
import { clientIpFromHeaders, isIpAllowed, parseAllowList } from "@kurotrace/core/ip";

/**
 * Gatekeeper for the admin terminal. Runs before every request, including static
 * files and API routes. Anyone outside the allow-list gets a plain 404, so the admin
 * app does not even reveal that it exists. Misconfiguration fails closed.
 */
let cachedRules: ReturnType<typeof parseAllowList> | null = null;
let configError = false;

function allowRules() {
  if (cachedRules || configError) return cachedRules;
  try {
    cachedRules = parseAllowList(process.env.ADMIN_ALLOWED_IPS);
  } catch (error) {
    configError = true;
    console.error("ADMIN_ALLOWED_IPS is invalid; admin access is blocked for everyone.", error);
  }
  return cachedRules;
}

function notFound(dev: boolean) {
  const res = new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  for (const [key, value] of Object.entries(securityHeaders({ admin: true, dev }))) res.headers.set(key, value);
  return res;
}

const STAFF_COOKIE = "__Host-staff";
const PUBLIC_PATHS = ["/login", "/setup"];
const STATIC_PREFIXES = ["/_next/static/", "/_next/image", "/brand/", "/icon", "/apple-icon", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const dev = process.env.NODE_ENV === "development";
  const ip = clientIpFromHeaders(request.headers, process.env.TRUSTED_IP_HEADER ?? "x-forwarded-for");
  const rules = allowRules();
  if (!rules || !isIpAllowed(ip, rules)) return notFound(dev);

  // Second lock: without a staff session cookie, only the sign-in and setup pages (and
  // their static files) load. Everything else goes to sign-in before any page code runs.
  // Each page and action still checks the session itself; this just keeps bookmarks,
  // typed URLs and guessed links from reaching them at all.
  const path = request.nextUrl.pathname;
  const open = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) || STATIC_PREFIXES.some((p) => path.startsWith(p));
  if (!open && !request.cookies.get(STAFF_COOKIE)?.value) {
    if (request.method !== "GET" && request.method !== "HEAD") return notFound(dev);
    const res = NextResponse.redirect(new URL("/login", request.url), 307);
    for (const [key, value] of Object.entries(securityHeaders({ admin: true, dev }))) res.headers.set(key, value);
    return res;
  }

  const nonce = generateNonce();
  const csp = buildCsp({ nonce, dev });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-client-ip", ip ?? "");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything, including /api and static assets.
  matcher: ["/:path*"],
};
