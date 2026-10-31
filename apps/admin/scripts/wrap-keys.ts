/**
 * Wraps the data-encryption keys with AWS KMS, for production.
 *
 *   KMS_KEY_ID=alias/kurotrace-data FIELD_ENCRYPTION_KEYS=... BLIND_INDEX_KEY=... \
 *     npm run wrap-keys -w @kurotrace/admin
 *
 * Prints KMS_WRAPPED_KEYS=... : put that in the server's environment and REMOVE the
 * plain FIELD_ENCRYPTION_KEYS and BLIND_INDEX_KEY from it. Keep an offline copy of the
 * plain keys in a safe place (password manager / sealed envelope) in case the KMS key
 * is ever deleted: without either, encrypted data can't be recovered.
 * Run on a trusted machine with AWS credentials allowed to kms:Encrypt on that key.
 */
import { KMSClient, EncryptCommand } from "@aws-sdk/client-kms";
import { KMS_CONTEXT, loadKeys, wrappedPayload } from "@kurotrace/services/keys";

async function main() {
  const keyId = process.env.KMS_KEY_ID;
  if (!keyId) throw new Error("Set KMS_KEY_ID (key ARN or alias) first.");
  const fieldKeys = process.env.FIELD_ENCRYPTION_KEYS ?? "";
  const blindIndexKey = process.env.BLIND_INDEX_KEY ?? "";
  await loadKeys({ FIELD_ENCRYPTION_KEYS: fieldKeys, BLIND_INDEX_KEY: blindIndexKey }); // validates both
  const client = new KMSClient({ region: process.env.KMS_REGION || process.env.AWS_REGION });
  const out = await client.send(new EncryptCommand({ KeyId: keyId, Plaintext: Buffer.from(wrappedPayload(fieldKeys, blindIndexKey)), EncryptionContext: { ...KMS_CONTEXT } }));
  if (!out.CiphertextBlob) throw new Error("KMS returned nothing");
  console.log(`KMS_WRAPPED_KEYS=${Buffer.from(out.CiphertextBlob).toString("base64")}`);
  console.log(`KMS_KEY_ID=${keyId}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
