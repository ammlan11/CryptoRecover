import { describe, expect, it } from "vitest";
import { buildAuditRow, verifyAuditChain, type AuditEntry } from "../src/audit";
import { buildCsp, generateNonce, securityHeaders } from "../src/headers";
import { clientIpFromHeaders, isIpAllowed, parseAllowList } from "../src/ip";
import { generatePublicRef, generateToken, hashToken, safeEqual } from "../src/tokens";

describe("tokens", () => {
  it("generates unique 256-bit tokens and hashes them", () => {
    const a = generateToken();
    expect(a).not.toBe(generateToken());
    expect(Buffer.from(a, "base64url").length).toBe(32);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });

  it("compares in constant time and refuses weak tokens", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(() => generateToken(8)).toThrow();
  });

  it("makes readable public references", () => {
    expect(generatePublicRef()).toMatch(/^DM-[2-9A-HJ-NP-Z]{5}$/);
  });
});

describe("admin IP allow-list", () => {
  const rules = parseAllowList("203.0.113.0/24, 198.51.100.7, 2001:db8::1");

  it("matches CIDR ranges, exact IPv4, exact IPv6 and mapped IPv4", () => {
    expect(isIpAllowed("203.0.113.55", rules)).toBe(true);
    expect(isIpAllowed("198.51.100.7", rules)).toBe(true);
    expect(isIpAllowed("2001:DB8::1", rules)).toBe(true);
    expect(isIpAllowed("::ffff:203.0.113.9", rules)).toBe(true);
  });

  it("rejects everything else, including missing IPs and empty lists", () => {
    expect(isIpAllowed("203.0.114.1", rules)).toBe(false);
    expect(isIpAllowed("198.51.100.8", rules)).toBe(false);
    expect(isIpAllowed(null, rules)).toBe(false);
    expect(isIpAllowed("203.0.113.55", [])).toBe(false);
  });

  it("refuses invalid entries", () => {
    expect(() => parseAllowList("10.0.0.0/40")).toThrow();
    expect(() => parseAllowList("2001:db8::/32")).toThrow();
    expect(() => parseAllowList("not-an-ip")).toThrow();
  });

  it("takes the proxy-appended (right-most) x-forwarded-for entry, not the spoofable left one", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 192.0.2.44" });
    expect(clientIpFromHeaders(h, "x-forwarded-for")).toBe("192.0.2.44");
    expect(clientIpFromHeaders(new Headers({ "cf-connecting-ip": " 192.0.2.9 " }), "cf-connecting-ip")).toBe("192.0.2.9");
    expect(clientIpFromHeaders(new Headers(), "cf-connecting-ip")).toBeNull();
  });
});

describe("security headers", () => {
  it("builds a strict nonce-based CSP", () => {
    const nonce = generateNonce();
    const csp = buildCsp({ nonce });
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(buildCsp({ nonce, dev: true })).toContain("unsafe-eval");
  });

  it("adds noindex and no-store for admin, HSTS outside dev", () => {
    const admin = securityHeaders({ admin: true });
    expect(admin["X-Robots-Tag"]).toContain("noindex");
    expect(admin["Cache-Control"]).toBe("no-store");
    expect(admin["Strict-Transport-Security"]).toContain("preload");
    expect(securityHeaders({ dev: true })["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("audit hash chain", () => {
  const entry = (action: string): AuditEntry => ({
    actorType: "staff",
    actorId: "7",
    action,
    entity: "report",
    entityId: "42",
    ip: "198.51.100.7",
    at: "2026-11-01T10:00:00.000Z",
  });

  it("verifies an intact chain and finds the first tampered row", () => {
    const a = buildAuditRow(null, entry("view"));
    const b = buildAuditRow(a, entry("status_change"));
    const c = buildAuditRow(b, entry("export"));
    expect(verifyAuditChain([a, b, c])).toBe(-1);
    expect(verifyAuditChain([a, { ...b, action: "view" }, c])).toBe(1);
    expect(verifyAuditChain([a, c])).toBe(1); // a deleted row breaks the chain
  });
});

describe("flood limit", () => {
  it("allows a burst up to the limit, then refuses until the window resets", async () => {
    const { RateLimiter } = await import("../src/rate-limit");
    let now = 0;
    const limiter = new RateLimiter(3, 60_000, () => now);
    expect([1, 2, 3].map(() => limiter.check("1.2.3.4").allowed)).toEqual([true, true, true]);
    expect(limiter.check("1.2.3.4")).toMatchObject({ allowed: false, retryAfterMs: 60_000 });
    expect(limiter.check("5.6.7.8").allowed).toBe(true); // other people unaffected
    now = 60_001;
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
  });
});
