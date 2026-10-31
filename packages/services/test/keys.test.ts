import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { currentKeys, forgetKeys, KeysNotLoaded, KMS_CONTEXT, loadKeys, wrappedPayload, type KmsDecrypt } from "../src/keys";

const fieldKeys = `k1:${randomBytes(32).toString("base64")}`;
const blindIndexKey = randomBytes(32).toString("base64");

/** Stand-in for KMS: "ciphertext" is the payload XORed with a byte, and the context must match. */
const fakeKms: KmsDecrypt = async (blob, context) => {
  if (JSON.stringify(context) !== JSON.stringify(KMS_CONTEXT)) throw new Error("AccessDenied: context mismatch");
  return Buffer.from(blob.map((b) => b ^ 0x5a));
};
const wrap = (text: string) => Buffer.from(Buffer.from(text).map((b) => b ^ 0x5a)).toString("base64");

beforeEach(forgetKeys);

describe("data-encryption keys", () => {
  it("loads plain keys from the environment", async () => {
    const keys = await loadKeys({ FIELD_ENCRYPTION_KEYS: fieldKeys, BLIND_INDEX_KEY: blindIndexKey });
    expect(keys.source).toBe("env");
    expect(keys.indexKey.toString("base64")).toBe(blindIndexKey);
  });

  it("unwraps KMS-protected keys once and serves them from memory", async () => {
    let calls = 0;
    const counting: KmsDecrypt = async (b, c) => { calls++; return fakeKms(b, c); };
    const env = { KMS_WRAPPED_KEYS: wrap(wrappedPayload(fieldKeys, blindIndexKey)) };
    const [a, b] = await Promise.all([loadKeys(env, counting), loadKeys(env, counting)]);
    expect(a.source).toBe("kms");
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(currentKeys(env)).toBe(a);
  });

  it("refuses ambiguous or unloaded configurations", async () => {
    const wrapped = wrap(wrappedPayload(fieldKeys, blindIndexKey));
    await expect(loadKeys({ KMS_WRAPPED_KEYS: wrapped, FIELD_ENCRYPTION_KEYS: fieldKeys }, fakeKms)).rejects.toThrow(/not both/);
    forgetKeys();
    expect(() => currentKeys({ KMS_WRAPPED_KEYS: wrapped })).toThrow(KeysNotLoaded);
    await expect(loadKeys({ KMS_WRAPPED_KEYS: wrap("{\"v\":2}") }, fakeKms)).rejects.toThrow();
  });
});
