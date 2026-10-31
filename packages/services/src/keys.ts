/**
 * Where the data-encryption keys come from.
 *
 * - Development / simple hosting: FIELD_ENCRYPTION_KEYS and BLIND_INDEX_KEY in the
 *   environment (plain base64).
 * - Production (recommended): KMS_WRAPPED_KEYS holds those same keys encrypted by a
 *   cloud key service (AWS KMS). The server asks KMS to unwrap them once at start-up
 *   and keeps them only in memory. A leaked .env file or database dump is then useless
 *   without access to the KMS key, which is logged and can be revoked.
 *
 * No "server-only" marker: this also runs from Next.js instrumentation and CLI scripts.
 * State lives on globalThis so every server bundle sees the same unwrapped keys.
 */
import { parseKeyRing, type KeyRing } from "@kurotrace/core/crypto";

export interface LoadedKeys {
  ring: KeyRing;
  indexKey: Buffer;
  source: "env" | "kms";
}

export const KMS_CONTEXT = { app: "kurotrace", purpose: "data-keys" } as const;
const SLOT = Symbol.for("kurotrace.dataKeys");
type Slot = { keys?: LoadedKeys; loading?: Promise<LoadedKeys> };
const slot = ((globalThis as Record<symbol, unknown>)[SLOT] ??= {}) as Slot;

type Env = Record<string, string | undefined>;

export class KeysNotLoaded extends Error {}

function fromSpec(fieldKeys: string | undefined, blindIndexKey: string | undefined, source: LoadedKeys["source"]): LoadedKeys {
  const ring = parseKeyRing(fieldKeys);
  if (!blindIndexKey) throw new KeysNotLoaded("BLIND_INDEX_KEY is not set");
  const indexKey = Buffer.from(blindIndexKey, "base64");
  if (indexKey.length < 32) throw new KeysNotLoaded("BLIND_INDEX_KEY must be at least 32 bytes");
  return { ring, indexKey, source };
}

/** The plaintext that KMS_WRAPPED_KEYS decrypts to. */
export function wrappedPayload(fieldKeys: string, blindIndexKey: string) {
  return JSON.stringify({ v: 1, fieldKeys, blindIndexKey });
}

export type KmsDecrypt = (ciphertext: Buffer, context: Record<string, string>) => Promise<Buffer>;

async function awsKmsDecrypt(ciphertext: Buffer, context: Record<string, string>): Promise<Buffer> {
  const { KMSClient, DecryptCommand } = await import("@aws-sdk/client-kms");
  const client = new KMSClient({ region: process.env.KMS_REGION || process.env.AWS_REGION });
  const out = await client.send(new DecryptCommand({ CiphertextBlob: ciphertext, EncryptionContext: context, KeyId: process.env.KMS_KEY_ID || undefined }));
  if (!out.Plaintext) throw new KeysNotLoaded("KMS returned no plaintext");
  return Buffer.from(out.Plaintext);
}

/**
 * Loads the keys once per process. Call at start-up (instrumentation, scripts).
 * Safe to call again; later calls return the same keys.
 */
export async function loadKeys(env: Env = process.env, decrypt: KmsDecrypt = awsKmsDecrypt): Promise<LoadedKeys> {
  if (slot.keys) return slot.keys;
  slot.loading ??= (async () => {
    const wrapped = env.KMS_WRAPPED_KEYS?.trim();
    if (!wrapped) return fromSpec(env.FIELD_ENCRYPTION_KEYS, env.BLIND_INDEX_KEY, "env");
    if (env.FIELD_ENCRYPTION_KEYS || env.BLIND_INDEX_KEY) {
      throw new KeysNotLoaded("Set either KMS_WRAPPED_KEYS or the plain keys, not both: remove FIELD_ENCRYPTION_KEYS and BLIND_INDEX_KEY.");
    }
    const plain = await decrypt(Buffer.from(wrapped, "base64"), { ...KMS_CONTEXT });
    try {
      const payload = JSON.parse(plain.toString("utf8")) as { v?: number; fieldKeys?: string; blindIndexKey?: string };
      if (payload.v !== 1) throw new Error("version");
      return fromSpec(payload.fieldKeys, payload.blindIndexKey, "kms");
    } finally {
      plain.fill(0);
    }
  })();
  try {
    slot.keys = await slot.loading;
    return slot.keys;
  } finally {
    slot.loading = undefined;
  }
}

/** Synchronous access for request handlers. Plain env keys load lazily; KMS keys must be loaded at start-up. */
export function currentKeys(env: Env = process.env): LoadedKeys {
  if (slot.keys) return slot.keys;
  if (env.KMS_WRAPPED_KEYS?.trim()) throw new KeysNotLoaded("Encryption keys are wrapped by KMS and haven't been loaded: loadKeys() must run at start-up.");
  slot.keys = fromSpec(env.FIELD_ENCRYPTION_KEYS, env.BLIND_INDEX_KEY, "env");
  return slot.keys;
}

/** Tests only. */
export function forgetKeys() {
  slot.keys = undefined;
  slot.loading = undefined;
}
