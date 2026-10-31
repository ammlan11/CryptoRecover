import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  blindIndex,
  CryptoConfigError,
  decryptField,
  DecryptionError,
  encryptField,
  needsReEncryption,
  normalizeEmail,
  parseKeyRing,
} from "../src/crypto";

const key = () => randomBytes(32).toString("base64");

describe("field encryption", () => {
  const ring = parseKeyRing(`k1:${key()}`);

  it("round-trips text, including non-Latin scripts", () => {
    for (const text of ["hello", "مرحبا", "你好", ""]) {
      expect(decryptField(encryptField(text, ring), ring)).toBe(text);
    }
  });

  it("produces a different ciphertext each time", () => {
    expect(encryptField("same", ring)).not.toBe(encryptField("same", ring));
  });

  it("rejects tampered ciphertext", () => {
    const token = encryptField("secret", ring);
    const parts = token.split(".");
    const ct = Buffer.from(parts[4]!, "base64url");
    ct[0] = ct[0]! ^ 0xff;
    parts[4] = ct.toString("base64url");
    expect(() => decryptField(parts.join("."), ring)).toThrow(DecryptionError);
  });

  it("binds ciphertext to its AAD context", () => {
    const token = encryptField("+44 7700 900000", ring, "user:1:phone");
    expect(decryptField(token, ring, "user:1:phone")).toBe("+44 7700 900000");
    expect(() => decryptField(token, ring, "user:2:phone")).toThrow(DecryptionError);
  });

  it("decrypts with older keys after rotation and flags them for re-encryption", () => {
    const oldKey = key();
    const before = parseKeyRing(`k1:${oldKey}`);
    const token = encryptField("rotate me", before);
    const after = parseKeyRing(`k2:${key()},k1:${oldKey}`);
    expect(decryptField(token, after)).toBe("rotate me");
    expect(needsReEncryption(token, after)).toBe(true);
    expect(needsReEncryption(encryptField("new", after), after)).toBe(false);
  });

  it("rejects unknown keys and malformed input", () => {
    const other = parseKeyRing(`k9:${key()}`);
    expect(() => decryptField(encryptField("x", ring), other)).toThrow(DecryptionError);
    expect(() => decryptField("not-a-token", ring)).toThrow(DecryptionError);
  });

  it("validates key ring configuration", () => {
    expect(() => parseKeyRing(undefined)).toThrow(CryptoConfigError);
    expect(() => parseKeyRing("k1:dG9vc2hvcnQ=")).toThrow(CryptoConfigError);
    expect(() => parseKeyRing(`bad id:${key()}`)).toThrow(CryptoConfigError);
    const k = key();
    expect(() => parseKeyRing(`k1:${k},k1:${k}`)).toThrow(CryptoConfigError);
  });
});

describe("blind index", () => {
  const idxKey = randomBytes(32);

  it("is deterministic for the same value and context", () => {
    expect(blindIndex("a@b.com", idxKey, "user.email")).toBe(blindIndex("a@b.com", idxKey, "user.email"));
  });

  it("differs across contexts and keys", () => {
    expect(blindIndex("a@b.com", idxKey, "user.email")).not.toBe(blindIndex("a@b.com", idxKey, "lead.email"));
    expect(blindIndex("a@b.com", idxKey, "user.email")).not.toBe(blindIndex("a@b.com", randomBytes(32), "user.email"));
  });

  it("normalises emails before indexing", () => {
    expect(normalizeEmail("  Someone@Example.COM ")).toBe("someone@example.com");
  });
});
