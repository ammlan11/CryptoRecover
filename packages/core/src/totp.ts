/**
 * Time-based one-time passwords (RFC 6238) for two-step sign-in with an
 * authenticator app, plus single-use recovery codes.
 */
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { hashToken, safeEqual } from "./tokens";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, the size RFC 4226 recommends. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: string, timeMs: number, digits = DIGITS): string {
  const counter = Math.floor(timeMs / 1000 / STEP_SECONDS);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

/**
 * Accepts the current code and one step either side (clock drift).
 * Returns the matched time step so callers can refuse a replay of the same code.
 */
export function verifyTotp(secret: string, code: string, nowMs = Date.now(), lastUsedStep?: number | null): number | null {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return null;
  const current = Math.floor(nowMs / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    const step = current + drift;
    if (lastUsedStep != null && step <= lastUsedStep) continue;
    if (safeEqual(totpAt(secret, step * STEP_SECONDS * 1000), cleaned)) return step;
  }
  return null;
}

export function totpUri(secret: string, account: string, issuer = "Kuro Trace"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString().replace(/\+/g, "%20")}`;
}

/** Ten single-use codes like "7KQ2-M9XD", shown once; store only their hashes. */
export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = "";
    for (let j = 0; j < 8; j++) raw += alphabet[randomInt(alphabet.length)];
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

export function hashRecoveryCode(code: string): string {
  return hashToken(code.replace(/[\s-]/g, "").toUpperCase());
}
