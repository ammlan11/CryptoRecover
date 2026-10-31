import "server-only";
import { buildAuditRow, type AuditEntry } from "@kurotrace/core/audit";
import { prisma, Prisma } from "@kurotrace/db";

/**
 * Appends to the hash-chained audit log. The previous row is read with a row lock
 * inside the transaction so concurrent writers cannot fork the chain.
 * User events store no IP (data minimisation); staff events do (Phase 4).
 */
export async function audit(event: Omit<AuditEntry, "at">): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const last = await tx.$queryRaw<{ hash: string }[]>`SELECT hash FROM AuditLog ORDER BY id DESC LIMIT 1 FOR UPDATE`;
        const at = new Date();
        const entry: AuditEntry = { ...event, at: at.toISOString() };
        if (entry.detail === undefined) delete entry.detail;
        const row = buildAuditRow(last[0] ?? null, entry);
        await tx.auditLog.create({
          data: {
            actorType: row.actorType,
            actorId: row.actorId,
            action: row.action,
            entity: row.entity,
            entityId: row.entityId,
            ip: row.ip,
            detail: (row.detail as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
            at,
            prevHash: row.prevHash,
            hash: row.hash,
          },
        });
      });
      return;
    } catch (error) {
      // Two first-ever writers can race on an empty table; the unique hash rejects one. Retry.
      if (attempt === 2) console.error("audit write failed", error instanceof Error ? error.message : error);
    }
  }
}

export function userEvent(userId: string, action: string, entity = "user", entityId: string | null = userId, detail?: Record<string, unknown>) {
  return audit({ actorType: "user", actorId: userId, action, entity, entityId, ip: null, ...(detail ? { detail } : {}) });
}
