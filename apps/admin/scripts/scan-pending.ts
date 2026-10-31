/**
 * Virus-scans evidence that couldn't be scanned at upload time (scanner down or not
 * yet set up). Safe to run repeatedly, e.g. every 5 minutes from cron:
 *
 *   npm run scan-pending -w @kurotrace/admin
 *
 * Needs CLAMAV_HOST (and CLAMAV_PORT if not 3310). Exits non-zero if anything is infected
 * or the scanner can't be reached, so a cron/alerting setup notices.
 */
import { clamdFromEnv, scanWithClamd, ScannerUnavailable } from "@kurotrace/core/malware";
import { prisma } from "@kurotrace/db";
import { loadKeys } from "@kurotrace/services/keys";
import { audit } from "@kurotrace/services/audit";
import { decryptFile } from "@kurotrace/services/crypto";
import { aad } from "@kurotrace/services/records";
import { storage } from "@kurotrace/services/storage";

async function main() {
  await loadKeys();
  const opts = clamdFromEnv();
  if (!opts) {
    console.error("CLAMAV_HOST is not set; nothing scanned.");
    process.exit(2);
  }
  const pending = await prisma.evidence.findMany({
    where: { scanStatus: { in: ["PENDING", "FAILED"] } },
    select: { id: true, storageKey: true, reportId: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  let clean = 0, infected = 0, failed = 0;
  for (const file of pending) {
    try {
      const bytes = decryptFile(await storage().get(file.storageKey), aad.file(file.storageKey));
      const result = await scanWithClamd(bytes, opts);
      if (result.status === "CLEAN") {
        await prisma.evidence.update({ where: { id: file.id }, data: { scanStatus: "CLEAN" } });
        clean++;
      } else {
        await prisma.evidence.update({ where: { id: file.id }, data: { scanStatus: "INFECTED" } });
        await audit({ actorType: "system", actorId: null, action: "evidence.infected", entity: "evidence", entityId: file.id, ip: null, detail: { report: file.reportId, signature: result.signature } });
        infected++;
      }
    } catch (error) {
      if (error instanceof ScannerUnavailable) {
        console.error(`Scanner unavailable: ${error.message}`);
        failed = pending.length - clean - infected;
        break;
      }
      // Unreadable or undecryptable file: mark FAILED so staff still can't open it.
      console.error(`Could not scan evidence ${file.id}:`, error instanceof Error ? error.message : error);
      await prisma.evidence.update({ where: { id: file.id }, data: { scanStatus: "FAILED" } });
      failed++;
    }
  }
  console.log(`Scanned ${pending.length}: ${clean} clean, ${infected} infected, ${failed} not scanned.`);
  await prisma.$disconnect();
  process.exit(infected || failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
