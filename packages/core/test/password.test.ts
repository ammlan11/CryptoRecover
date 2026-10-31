import { describe, expect, it } from "vitest";
import { checkPasswordBreach } from "../src/breach";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "../src/password";

describe("password policy", () => {
  it("enforces length and rejects trivial passwords", () => {
    expect(checkPasswordPolicy("short")).toBe("too_short");
    expect(checkPasswordPolicy("a".repeat(129))).toBe("too_long");
    expect(checkPasswordPolicy("aaaaaaaaaaaa")).toBe("single_character");
    expect(checkPasswordPolicy("correct horse battery")).toBeNull();
  });
});

describe("argon2id hashing", () => {
  it("hashes with argon2id and verifies", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(stored, "correct horse battery")).toBe(true);
    expect(await verifyPassword(stored, "wrong horse battery")).toBe(false);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "whatever password")).toBe(false);
  });
});

describe("breached password check", () => {
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  const fakeFetch = (body: string, ok = true) => async () => ({ ok, text: async () => body });

  it("detects a breached password from the range response", async () => {
    const res = await checkPasswordBreach("password", fakeFetch("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\nABC:0"));
    expect(res).toEqual({ breached: true, checked: true });
  });

  it("ignores padding entries with a zero count", async () => {
    const res = await checkPasswordBreach("password", fakeFetch("1E4C9B93F3F0682250B6CF8331B7EE68FD8:0"));
    expect(res).toEqual({ breached: false, checked: true });
  });

  it("reports unchecked when the service fails", async () => {
    expect(await checkPasswordBreach("password", fakeFetch("", false))).toEqual({ breached: false, checked: false });
    const throwing = async () => {
      throw new Error("offline");
    };
    expect(await checkPasswordBreach("password", throwing)).toEqual({ breached: false, checked: false });
  });
});
