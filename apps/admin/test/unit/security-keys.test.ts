import { afterEach, describe, expect, it, vi } from "vitest";
import { keysRequiredFor, parseCredentialJson, relyingParty } from "@/server/security-keys";

afterEach(() => vi.unstubAllEnvs());

describe("security keys", () => {
  it("binds keys to the admin hostname from ADMIN_URL", () => {
    vi.stubEnv("ADMIN_URL", "https://admin.kurotrace.com/some/path");
    expect(relyingParty()).toMatchObject({ origin: "https://admin.kurotrace.com", rpID: "admin.kurotrace.com" });
  });

  it("refuses to run in production without ADMIN_URL", () => {
    vi.stubEnv("ADMIN_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => relyingParty()).toThrow(/ADMIN_URL/);
  });

  it("only switches off codes when the server says so and the person has a key", () => {
    expect(keysRequiredFor(2)).toBe(false);
    vi.stubEnv("STAFF_SECURITY_KEY_ONLY", "true");
    expect(keysRequiredFor(0)).toBe(false);
    expect(keysRequiredFor(1)).toBe(true);
  });

  it("ignores junk in the credential field", () => {
    expect(parseCredentialJson("")).toBeNull();
    expect(parseCredentialJson("{not json")).toBeNull();
    expect(parseCredentialJson('{"no":"id"}')).toBeNull();
    expect(parseCredentialJson("x".repeat(30_000))).toBeNull();
    expect(parseCredentialJson('{"id":"abc","response":{}}')).toMatchObject({ id: "abc" });
  });
});
