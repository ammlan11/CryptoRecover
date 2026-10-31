/**
 * Session and one-time tokens. The browser holds the raw token; the database stores
 * only its SHA-256 hash, so a leaked database cannot be used to sign in as anyone.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(bytes = 32): string {
  if (bytes < 16) throw new Error("Tokens must be at least 128 bits");
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time comparison for equal-length secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Short human-friendly reference shown to users, e.g. DM-7K2Q9 (no 0/O/1/I). */
export function generatePublicRef(prefix = "DM", length = 5): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${prefix}-${out}`;
}
