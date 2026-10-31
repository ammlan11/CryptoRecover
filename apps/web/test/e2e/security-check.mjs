/**
 * Automated security checks against the running production builds (CI e2e job).
 * Headers, cookies, caching of private pages, the admin IP gate (including a spoofed
 * X-Forwarded-For), and files that must never be served.
 *
 *   WEB_URL=http://localhost:3000 ADMIN_URL=http://localhost:3001 node test/e2e/security-check.mjs
 */
import assert from "node:assert/strict";
import { request } from "node:http";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const ok = (name) => console.log(`✓ ${name}`);
const get = (url, init = {}) => fetch(url, { redirect: "manual", ...init });

function csp(res) {
  const raw = res.headers.get("content-security-policy") ?? "";
  return Object.fromEntries(raw.split(";").map((d) => d.trim().split(/\s+/)).filter((p) => p[0]).map(([k, ...v]) => [k, v]));
}

// ── Public site ────────────────────────────────────────────────────
{
  const [a, b] = await Promise.all([get(`${WEB}/`), get(`${WEB}/`)]);
  assert.equal(a.status, 200);
  const p = csp(a);
  assert.ok(p["script-src"].some((s) => s.startsWith("'nonce-")), "script nonce");
  assert.ok(p["script-src"].includes("'strict-dynamic'"));
  assert.ok(!p["script-src"].includes("'unsafe-inline'") && !p["script-src"].includes("'unsafe-eval'"), "no unsafe scripts");
  assert.deepEqual(p["frame-ancestors"], ["'none'"]);
  assert.deepEqual(p["object-src"], ["'none'"]);
  assert.deepEqual(p["base-uri"], ["'self'"]);
  assert.deepEqual(p["form-action"], ["'self'"]);
  assert.notEqual(csp(a)["script-src"][1], csp(b)["script-src"][1], "fresh nonce per response");
  assert.ok(!JSON.stringify(p).includes("facebook") && !JSON.stringify(p).includes("googletagmanager"), "no ad origins outside /lp");
  assert.match(a.headers.get("strict-transport-security") ?? "", /max-age=\d{8}; includeSubDomains/);
  assert.equal(a.headers.get("x-content-type-options"), "nosniff");
  assert.equal(a.headers.get("x-frame-options"), "DENY");
  assert.equal(a.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.ok(a.headers.get("permissions-policy")?.includes("camera=()"));
  assert.equal(a.headers.get("x-powered-by"), null);
  ok("public site: CSP with per-request nonce, HSTS, framing and sniffing blocked, no ad origins");
}

{
  const res = await get(`${WEB}/lp/broker-scams?utm_source=meta&fbclid=abc`);
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie") ?? "";
  assert.match(cookie, /__Host-attr=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(res.headers.get("x-robots-tag") ?? (await res.text()), /noindex/i);
  ok("landing page: attribution cookie is HttpOnly, Secure, SameSite; page not indexed");
}

for (const path of ["/account/reports", "/account/settings", "/account/reports/DM-ABCDE/evidence/x"]) {
  const res = await get(`${WEB}${path}`);
  assert.ok([302, 303, 307, 308, 404].includes(res.status), `${path} must not render without a session (got ${res.status})`);
  if (res.status !== 404) assert.match(res.headers.get("location") ?? "", /\/login/);
}
ok("private pages and evidence downloads require a session");

for (const path of ["/login", "/signup", "/forgot-password"]) {
  const res = await get(`${WEB}${path}`);
  assert.match(res.headers.get("cache-control") ?? "", /no-store/, `${path} no-store`);
}
ok("sign-in pages are never cached");

for (const path of ["/.env", "/.git/config", "/package.json", "/next.config.ts", "/prisma/schema.prisma", "/.evidence/x", "/_next/../package.json"]) {
  const res = await get(`${WEB}${path}`);
  assert.ok(res.status === 404 || res.status === 400, `${path} must not be served (got ${res.status})`);
}
{
  // fetch() refuses TRACE, so use a raw request.
  const status = await new Promise((resolve) => {
    const req = request(`${WEB}/`, { method: "TRACE" }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", () => resolve(0));
    req.end();
  });
  assert.notEqual(status, 200, "TRACE disabled");
}
ok("source, config and stored files are not reachable; TRACE disabled");

{
  const robots = await (await get(`${WEB}/robots.txt`)).text();
  if (process.env.SITE_INDEXABLE !== "true") assert.match(robots, /Disallow: \//);
  else assert.match(robots, /Disallow: \/account/);
  ok("robots.txt keeps private areas out of search engines");
}

// ── Admin terminal ─────────────────────────────────────────────────
{
  const outsider = await get(`${ADMIN}/login`, { headers: { "x-forwarded-for": "203.0.113.9" } });
  // Attacker puts an allowed IP first; the real client IP (added last by the proxy) still decides.
  const spoofed = await get(`${ADMIN}/login`, { headers: { "x-forwarded-for": "127.0.0.1, 203.0.113.9" } });
  // Even the admin's static files are hidden: take a real script URL from the sign-in page.
  const page = await (await get(`${ADMIN}/login`, { headers: { "x-forwarded-for": "127.0.0.1" } })).text();
  const script = /\/_next\/static\/[^"']+\.js/.exec(page)?.[0];
  assert.ok(script, "found an admin script URL");
  assert.equal((await get(`${ADMIN}${script}`, { headers: { "x-forwarded-for": "127.0.0.1" } })).status, 200);
  const asset = await get(`${ADMIN}${script}`, { headers: { "x-forwarded-for": "203.0.113.9" } });
  for (const [name, res] of [["outsider", outsider], ["spoofed", spoofed], ["static file", asset]]) {
    assert.equal(res.status, 404, `admin must 404 for ${name}`);
  }
  const body = await outsider.text();
  assert.ok(!/admin|kuro|sign in/i.test(body), "404 page reveals nothing");
  ok("admin: invisible outside the allow-list, spoofed X-Forwarded-For doesn't help");

  const inside = await get(`${ADMIN}/login`, { headers: { "x-forwarded-for": "127.0.0.1" } });
  assert.equal(inside.status, 200);
  assert.match(inside.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.match(inside.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(inside.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(csp(inside)["frame-ancestors"], ["'none'"]);
  const console_ = await get(`${ADMIN}/reports`, { headers: { "x-forwarded-for": "127.0.0.1" } });
  assert.ok([302, 303, 307].includes(console_.status) && /\/login/.test(console_.headers.get("location") ?? ""), "console needs sign-in");
  ok("admin: no-index, no-store, no-referrer, framing blocked, console requires sign-in");
}

console.log("\nAll security checks passed.");
