import "server-only";
import {
  blindIndex,
  decryptBytes,
  decryptField,
  encryptBytes,
  encryptField,
  normalizeEmail,
} from "@kurotrace/core/crypto";
import { currentKeys } from "./keys";

const keys = () => currentKeys();

/** Lookup hash for an email. `context` keeps indexes in different tables unrelated. */
export function emailHashFor(email: string, context: string) {
  return blindIndex(normalizeEmail(email), keys().indexKey, context);
}

/** Encrypted email plus its lookup hash. */
export function protectEmail(email: string, context: string) {
  const normalized = normalizeEmail(email);
  return { emailHash: emailHashFor(normalized, context), emailEnc: encryptField(normalized, keys().ring, context) };
}

export function encryptText(value: string, aad: string) {
  return encryptField(value, keys().ring, aad);
}

export function decryptText(token: string, aad: string) {
  return decryptField(token, keys().ring, aad);
}

export function encryptFile(bytes: Buffer, aad: string) {
  return encryptBytes(bytes, keys().ring, aad);
}

export function decryptFile(blob: Buffer, aad: string) {
  return decryptBytes(blob, keys().ring, aad);
}

/** Hash of an IP for session records: lets us spot anomalies without keeping the address. */
export function ipHashFor(ip: string) {
  return blindIndex(ip, keys().indexKey, "session.ip");
}
