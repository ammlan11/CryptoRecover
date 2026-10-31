import "server-only";
import { blindIndex, encryptField, loadBlindIndexKeyFromEnv, loadKeyRingFromEnv, normalizeEmail, type KeyRing } from "@demo/core/crypto";

let ring: KeyRing | null = null;
let indexKey: Buffer | null = null;

function keys() {
  ring ??= loadKeyRingFromEnv();
  indexKey ??= loadBlindIndexKeyFromEnv();
  return { ring, indexKey };
}

/** Encrypted email plus its lookup hash. `context` keeps indexes in different tables unrelated. */
export function protectEmail(email: string, context: string) {
  const { ring, indexKey } = keys();
  const normalized = normalizeEmail(email);
  return {
    emailHash: blindIndex(normalized, indexKey, context),
    emailEnc: encryptField(normalized, ring, context),
  };
}
