import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBytes, DecryptionError, encryptBytes, parseKeyRing } from "../src/crypto";
import { cleanFileName, sniffEvidenceType } from "../src/files";
import { base32Decode, base32Encode, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpAt, totpUri, verifyTotp } from "../src/totp";

// RFC 6238 Appendix B test secret ("12345678901234567890"), SHA-1, truncated to 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpAt(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpAt(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totpAt(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
    expect(totpAt(RFC_SECRET, 2_000_000_000_000)).toBe("279037");
  });

  it("round-trips base32", () => {
    const buf = randomBytes(20);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts one step of clock drift and rejects older codes and replays", () => {
    const now = 1_700_000_000_000;
    const secret = generateTotpSecret();
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totpAt(secret, now), now)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, now - 90_000), now)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now), now, step)).toBeNull(); // replay
    expect(verifyTotp(secret, "12345", now)).toBeNull();
  });

  it("builds an authenticator URI", () => {
    expect(totpUri("ABC", "a@b.com")).toBe("otpauth://totp/Kuro%20Trace%3Aa%40b.com?secret=ABC&issuer=Kuro%20Trace&algorithm=SHA1&digits=6&period=30");
  });

  it("makes unique recovery codes and hashes them case- and dash-insensitively", () => {
    const { codes, hashes } = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(hashRecoveryCode(codes[0]!.toLowerCase().replace("-", " "))).toBe(hashes[0]);
  });
});

describe("evidence files", () => {
  it("detects types from magic bytes, not names", () => {
    expect(sniffEvidenceType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime).toBe("image/png");
    expect(sniffEvidenceType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffEvidenceType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))?.mime).toBe("image/webp");
    expect(sniffEvidenceType(Buffer.from("%PDF-1.7"))?.mime).toBe("application/pdf");
    expect(sniffEvidenceType(Buffer.from("<html><script>"))).toBeNull();
    expect(sniffEvidenceType(Buffer.from("MZ\x90\x00"))).toBeNull(); // Windows executable
  });

  it("cleans file names", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("C:\\Users\\me\\chat<1>.png")).toBe("chat1.png");
    expect(cleanFileName("")).toBe("file");
  });

  it("encrypts file bytes bound to their storage key", () => {
    const ring = parseKeyRing(`k1:${randomBytes(32).toString("base64")}`);
    const file = randomBytes(5000);
    const blob = encryptBytes(file, ring, "evidence:abc");
    expect(blob.includes(file.subarray(0, 64))).toBe(false);
    expect(decryptBytes(blob, ring, "evidence:abc").equals(file)).toBe(true);
    expect(() => decryptBytes(blob, ring, "evidence:other")).toThrow(DecryptionError);
  });
});
