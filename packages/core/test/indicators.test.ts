import { describe, expect, it } from "vitest";
import { normalizeIndicator } from "../src/indicators";
import { RateLimiter } from "../src/rate-limit";

describe("normalizeIndicator", () => {
  it("recognises wallets on major chains", () => {
    expect(normalizeIndicator("0xAbC0000000000000000000000000000000000dEf")).toEqual({
      kind: "WALLET",
      normalizedValue: "0xabc0000000000000000000000000000000000def",
      chain: "evm",
    });
    expect(normalizeIndicator("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")?.chain).toBe("bitcoin");
    expect(normalizeIndicator("1BoatSLRHtKNngkdXEeobR76b53LETtpyT")?.chain).toBe("bitcoin");
    expect(normalizeIndicator("TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE")?.chain).toBe("tron");
  });

  it("recognises transaction hashes", () => {
    expect(normalizeIndicator(`0x${"A".repeat(64)}`)).toEqual({ kind: "TX_HASH", normalizedValue: `0x${"a".repeat(64)}`, chain: "evm" });
    expect(normalizeIndicator("f".repeat(64))?.kind).toBe("TX_HASH");
  });

  it("reduces any link to its bare domain", () => {
    for (const input of ["https://www.Fake-App.com/login?x=1", "fake-app.com", "WWW.FAKE-APP.COM.", "http://fake-app.com/"]) {
      expect(normalizeIndicator(input)).toEqual({ kind: "DOMAIN", normalizedValue: "fake-app.com" });
    }
    expect(normalizeIndicator("app.trade-pro.io")?.normalizedValue).toBe("app.trade-pro.io");
  });

  it("recognises Telegram handles and links", () => {
    expect(normalizeIndicator("@Crypto_Mentor")).toEqual({ kind: "TELEGRAM", normalizedValue: "crypto_mentor" });
    expect(normalizeIndicator("https://t.me/Crypto_Mentor")).toEqual({ kind: "TELEGRAM", normalizedValue: "crypto_mentor" });
  });

  it("recognises emails and phone numbers", () => {
    expect(normalizeIndicator("Support@Fake-App.com")).toEqual({ kind: "EMAIL", normalizedValue: "support@fake-app.com" });
    expect(normalizeIndicator("+44 (20) 7946-0958")).toEqual({ kind: "PHONE", normalizedValue: "+442079460958" });
  });

  it("rejects empty and oversized input", () => {
    expect(normalizeIndicator("   ")).toBeNull();
    expect(normalizeIndicator("x".repeat(600))).toBeNull();
  });

  it("falls back to OTHER for unrecognised text", () => {
    expect(normalizeIndicator("some broker name")).toEqual({ kind: "OTHER", normalizedValue: "some broker name" });
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    const blocked = limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
    expect(limiter.check("other-ip").allowed).toBe(true);
    now = 1000;
    expect(limiter.check("ip").allowed).toBe(true);
  });
});
