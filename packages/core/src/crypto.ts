/**
 * Field-level encryption for personal data and report content.
 *
 * Values are encrypted with AES-256-GCM in the application before they reach the
 * database, so a leaked database or backup exposes only ciphertext.
 *
 * Token format: v1.<keyId>.<iv>.<tag>.<ciphertext>  (base64url parts)
 *
 * - Keys live in a key ring. The first key encrypts; every key can decrypt, so keys
 *   rotate without downtime (re-encrypt rows whose keyId is not the primary).
 * - An optional AAD ("additional authenticated data") binds a ciphertext to where it
 *   belongs, e.g. `user:42:phone`. Copying it into another row or column makes
 *   decryption fail instead of silently returning someone else's data.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const KEY_ID = /^[A-Za-z0-9_-]{1,16}$/;

export interface KeyRing {
  primaryId: string;
  keys: ReadonlyMap<string, Buffer>;
}

export class CryptoConfigError extends Error {}
export class DecryptionError extends Error {}

/** Parses "k2:base64,k1:base64" — the first entry is the primary (encrypting) key. */
export function parseKeyRing(spec: string | undefined): KeyRing {
  if (!spec || !spec.trim()) throw new CryptoConfigError("No field encryption keys configured");
  const keys = new Map<string, Buffer>();
  let primaryId: string | undefined;
  for (const part of spec.split(",")) {
    const entry = part.trim();
    const sep = entry.indexOf(":");
    if (sep < 1) throw new CryptoConfigError("Key ring entries must look like id:base64key");
    const id = entry.slice(0, sep);
    const key = Buffer.from(entry.slice(sep + 1), "base64");
    if (!KEY_ID.test(id)) throw new CryptoConfigError(`Invalid key id "${id}"`);
    if (key.length !== KEY_BYTES) throw new CryptoConfigError(`Key "${id}" must be ${KEY_BYTES} bytes`);
    if (keys.has(id)) throw new CryptoConfigError(`Duplicate key id "${id}"`);
    keys.set(id, key);
    primaryId ??= id;
  }
  return { primaryId: primaryId!, keys };
}

const b64u = (buf: Buffer) => buf.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function encryptField(plaintext: string, ring: KeyRing, aad?: string): string {
  const key = ring.keys.get(ring.primaryId);
  if (!key) throw new CryptoConfigError("Primary key missing from key ring");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, ring.primaryId, b64u(iv), b64u(tag), b64u(ciphertext)].join(".");
}

export function decryptField(token: string, ring: KeyRing, aad?: string): string {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) throw new DecryptionError("Unrecognised ciphertext format");
  const [, keyId, ivPart, tagPart, ctPart] = parts as [string, string, string, string, string];
  const key = ring.keys.get(keyId);
  if (!key) throw new DecryptionError(`Unknown key id "${keyId}"`);
  const iv = fromB64u(ivPart);
  const tag = fromB64u(tagPart);
  if (iv.length !== IV_BYTES || tag.length !== 16) throw new DecryptionError("Malformed ciphertext");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(fromB64u(ctPart)), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError("Ciphertext failed authentication");
  }
}

/**
 * Binary variant for evidence files. Layout: [1 byte keyId length][keyId][12 IV][16 tag][ciphertext].
 * Files are encrypted before they reach object storage, on top of the bucket's own encryption.
 */
export function encryptBytes(plain: Buffer, ring: KeyRing, aad: string): Buffer {
  const key = ring.keys.get(ring.primaryId);
  if (!key) throw new CryptoConfigError("Primary key missing from key ring");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const id = Buffer.from(ring.primaryId, "utf8");
  return Buffer.concat([Buffer.from([id.length]), id, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBytes(blob: Buffer, ring: KeyRing, aad: string): Buffer {
  const idLen = blob[0];
  if (idLen === undefined || idLen < 1 || blob.length < 1 + idLen + IV_BYTES + 16) throw new DecryptionError("Malformed encrypted file");
  const keyId = blob.subarray(1, 1 + idLen).toString("utf8");
  const key = ring.keys.get(keyId);
  if (!key) throw new DecryptionError(`Unknown key id "${keyId}"`);
  let offset = 1 + idLen;
  const iv = blob.subarray(offset, (offset += IV_BYTES));
  const tag = blob.subarray(offset, (offset += 16));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(blob.subarray(offset)), decipher.final()]);
  } catch {
    throw new DecryptionError("Encrypted file failed authentication");
  }
}

/** True when a value was encrypted with an older key and should be re-encrypted. */
export function needsReEncryption(token: string, ring: KeyRing): boolean {
  return token.split(".")[1] !== ring.primaryId;
}

/**
 * Deterministic keyed hash for looking a value up without storing it in plain text
 * (e.g. find a user by email). The context separates indexes so the same email in two
 * tables produces unrelated hashes.
 */
export function blindIndex(value: string, key: Buffer, context: string): string {
  if (key.length < KEY_BYTES) throw new CryptoConfigError("Blind index key must be at least 32 bytes");
  return createHmac("sha256", key).update(context).update("\u0000").update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function loadKeyRingFromEnv(env: NodeJS.ProcessEnv = process.env): KeyRing {
  return parseKeyRing(env.FIELD_ENCRYPTION_KEYS);
}

export function loadBlindIndexKeyFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.BLIND_INDEX_KEY;
  if (!raw) throw new CryptoConfigError("BLIND_INDEX_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length < KEY_BYTES) throw new CryptoConfigError("BLIND_INDEX_KEY must be at least 32 bytes");
  return key;
}
