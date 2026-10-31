import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Private object storage for evidence. Files arrive here already encrypted by the app.
 * - "s3":    any S3-compatible bucket (AWS S3, Cloudflare R2). The bucket must be private.
 * - "local": a folder on disk, for development and tests only.
 */
export interface Storage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

function localStorage(): Storage {
  // Runtime-chosen folder (dev/test only): tell the bundler not to trace it.
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.EVIDENCE_LOCAL_DIR ?? ".evidence");
  const file = (key: string) => {
    if (!/^[a-z0-9/_-]+$/i.test(key)) throw new Error("Invalid storage key");
    return path.join(/*turbopackIgnore: true*/ root, key);
  };
  return {
    async put(key, body) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), body, { mode: 0o600 });
    },
    get: (key) => readFile(file(key)),
    remove: (key) => rm(file(key), { force: true }),
  };
}

function s3Storage(): Storage {
  const bucket = process.env.EVIDENCE_BUCKET;
  if (!bucket) throw new Error("EVIDENCE_BUCKET must be set");
  const client = new S3Client({
    region: process.env.EVIDENCE_REGION ?? "auto",
    endpoint: process.env.EVIDENCE_ENDPOINT || undefined, // e.g. https://<account>.r2.cloudflarestorage.com
  });
  return {
    async put(key, body) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/octet-stream", ServerSideEncryption: process.env.EVIDENCE_ENDPOINT ? undefined : "AES256" }),
      );
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await res.Body!.transformToByteArray());
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (instance) return instance;
  const driver = process.env.EVIDENCE_STORAGE ?? (process.env.NODE_ENV === "production" ? "s3" : "local");
  if (driver === "local" && process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_EVIDENCE !== "true") {
    throw new Error("Local evidence storage is not allowed in production");
  }
  instance = driver === "s3" ? s3Storage() : localStorage();
  return instance;
}
