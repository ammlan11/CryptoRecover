/**
 * Append-only, hash-chained audit log. Each row stores the hash of the previous row;
 * editing or deleting any row breaks every hash after it, which verifyAuditChain finds.
 */
import { createHash } from "node:crypto";

export interface AuditEntry {
  actorType: "staff" | "user" | "system";
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  at: string; // ISO timestamp
  detail?: Record<string, unknown>;
}

export interface AuditRow extends AuditEntry {
  prevHash: string | null;
  hash: string;
}

/** JSON with object keys sorted at every level, so the same entry always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function computeAuditHash(prevHash: string | null, entry: AuditEntry): string {
  return createHash("sha256")
    .update(prevHash ?? "GENESIS")
    .update("\n")
    .update(canonicalJson(entry))
    .digest("hex");
}

export function buildAuditRow(prev: Pick<AuditRow, "hash"> | null, entry: AuditEntry): AuditRow {
  const prevHash = prev?.hash ?? null;
  return { ...entry, prevHash, hash: computeAuditHash(prevHash, entry) };
}

/** Returns the index of the first broken row, or -1 when the whole chain is intact. */
export function verifyAuditChain(rows: readonly AuditRow[]): number {
  let prevHash: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const { prevHash: storedPrev, hash, ...entry } = row;
    if (storedPrev !== prevHash || computeAuditHash(prevHash, entry) !== hash) return i;
    prevHash = hash;
  }
  return -1;
}
