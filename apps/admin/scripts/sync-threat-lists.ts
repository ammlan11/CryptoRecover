/**
 * Refreshes the free threat lists the public checker uses (US sanctions list,
 * MetaMask and PhishDestroy scam-site lists). Safe to run any time; the server runs it
 * every 12 hours. Takes a minute or two (about 360,000 entries).
 *
 *   npm run sync-lists
 */
import { prisma } from "@kurotrace/db";
import { syncThreatLists } from "@kurotrace/services/threat-lists";

async function main() {
  console.log("Downloading threat lists…");
  const summary = await syncThreatLists();
  for (const [source, r] of Object.entries(summary)) {
    console.log(`  ${source.padEnd(13)} ${r.ok ? "updated" : "FAILED, kept previous"}  ${r.entries.toLocaleString()} entries${r.error ? `  (${r.error})` : ""}`);
  }
  await prisma.$disconnect();
  process.exit(Object.values(summary).every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
