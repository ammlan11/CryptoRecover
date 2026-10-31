import { describe, expect, it } from "vitest";
import { buildCsp } from "../src/headers";
import { verifyTurnstile } from "../src/turnstile";

const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("bot check (Turnstile)", () => {
  it("rejects a missing token without calling Cloudflare", async () => {
    let called = false;
    const r = await verifyTurnstile({ token: "", secret: "s", fetchImpl: (async () => { called = true; return new Response("{}"); }) as typeof fetch });
    expect(r).toEqual({ ok: false, reason: "missing" });
    expect(called).toBe(false);
  });

  it("passes a valid token for the right form and host, sending the client IP", async () => {
    let sent = "";
    const fetchImpl = (async (_url: string, init: RequestInit) => { sent = String(init.body); return new Response(JSON.stringify({ success: true, action: "signup", hostname: "kurotrace.com" })); }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "t", secret: "s", ip: "1.2.3.4", expectedAction: "signup", expectedHostnames: ["kurotrace.com"], fetchImpl })).toEqual({ ok: true });
    expect(sent).toContain("remoteip=1.2.3.4");
  });

  it("refuses failed, replayed-elsewhere and unreachable checks", async () => {
    expect(await verifyTurnstile({ token: "t", secret: "s", fetchImpl: reply({ success: false, "error-codes": ["timeout-or-duplicate"] }) })).toEqual({ ok: false, reason: "rejected" });
    expect(await verifyTurnstile({ token: "t", secret: "s", expectedAction: "signup", fetchImpl: reply({ success: true, action: "login" }) })).toEqual({ ok: false, reason: "wrong-action" });
    expect(await verifyTurnstile({ token: "t", secret: "s", expectedHostnames: ["kurotrace.com"], fetchImpl: reply({ success: true, hostname: "evil.example" }) })).toEqual({ ok: false, reason: "wrong-host" });
    expect(await verifyTurnstile({ token: "t", secret: "s", fetchImpl: reply({}, 500) })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyTurnstile({ token: "t", secret: "s", fetchImpl: (async () => { throw new Error("down"); }) as typeof fetch })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("allows frames only when asked", () => {
    expect(buildCsp({ nonce: "n" })).toContain("frame-src 'none'");
    expect(buildCsp({ nonce: "n", extraFrameSrc: ["https://challenges.cloudflare.com"] })).toContain("frame-src https://challenges.cloudflare.com");
  });
});
