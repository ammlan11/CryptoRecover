import {
  domainCandidates,
  OFAC_TICKERS,
  parseMetaMaskConfig,
  parseOfacList,
  parsePhishDestroy,
  SOURCE_INFO,
  walletCandidates,
  type ThreatEntry,
  type ThreatSource,
} from "@kurotrace/core/threat-lists";
import type { NormalizedIndicator } from "@kurotrace/core/indicators";
import { prisma } from "@kurotrace/db";

/**
 * Downloads the free threat lists and checks checker input against them.
 * No "server-only" marker: the sync also runs from a CLI script.
 */
const RAW = "https://raw.githubusercontent.com";
const URLS = {
  ofac: (ticker: string) => `${RAW}/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_${ticker}.txt`,
  metamask: `${RAW}/MetaMask/eth-phishing-detect/main/src/config.json`,
  phishdestroy: `${RAW}/phishdestroy/destroylist/main/list.json`,
};

/** A list far smaller than usual is probably a broken download: keep the old data. */
const MINIMUM: Record<ThreatSource, number> = { OFAC: 200, METAMASK: 20_000, PHISHDESTROY: 20_000 };
const MAX_BYTES = 40 * 1024 * 1024;

async function download(url: string, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(120_000), headers: { "User-Agent": "KuroTrace-threat-list-sync" } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error(`${url} is unexpectedly large`);
  return text;
}

async function replaceSource(source: ThreatSource, entries: ThreatEntry[], minimum: number) {
  if (entries.length < minimum) throw new Error(`only ${entries.length} entries; keeping the previous list`);
  // One transaction: visitors keep seeing the old list until the new one is complete.
  await prisma.$transaction(
    async (tx) => {
      await tx.threatListEntry.deleteMany({ where: { source } });
      for (let i = 0; i < entries.length; i += 5000) {
        await tx.threatListEntry.createMany({
          data: entries.slice(i, i + 5000).map((e) => ({ source, kind: e.kind, value: e.value.slice(0, 255), chain: e.chain ?? null })),
          skipDuplicates: true,
        });
      }
    },
    { timeout: 10 * 60_000, maxWait: 30_000 },
  );
}

async function record(source: ThreatSource, entries: number, error?: unknown) {
  const data = { syncedAt: new Date(), entries, ok: !error, error: error ? String(error instanceof Error ? error.message : error).slice(0, 500) : null };
  await prisma.threatListSync.upsert({ where: { source }, create: { source, ...data }, update: data });
}

export type SyncSummary = Record<ThreatSource, { ok: boolean; entries: number; error?: string }>;

/** Refreshes every list. A failure in one list keeps its previous data and doesn't stop the others. */
export async function syncThreatLists(fetchImpl: typeof fetch = fetch, opts: { minimum?: Partial<Record<ThreatSource, number>> } = {}): Promise<SyncSummary> {
  const summary = {} as SyncSummary;
  const run = async (source: ThreatSource, load: () => Promise<ThreatEntry[]>) => {
    try {
      const entries = await load();
      await replaceSource(source, entries, opts.minimum?.[source] ?? MINIMUM[source]);
      await record(source, entries.length);
      summary[source] = { ok: true, entries: entries.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const previous = await prisma.threatListEntry.count({ where: { source } });
      await record(source, previous, message);
      summary[source] = { ok: false, entries: previous, error: message };
    }
  };

  await run("OFAC", async () => {
    const all: ThreatEntry[] = [];
    for (const ticker of OFAC_TICKERS) {
      try {
        all.push(...parseOfacList(ticker, await download(URLS.ofac(ticker), fetchImpl)));
      } catch {
        // A coin with no file yet is fine; the minimum-size check catches a total failure.
      }
    }
    return all;
  });

  await run("METAMASK", async () => {
    const { blocked, allowed } = parseMetaMaskConfig(JSON.parse(await download(URLS.metamask, fetchImpl)));
    if (allowed.length) {
      await prisma.$transaction([
        prisma.threatListAllow.deleteMany({}),
        prisma.threatListAllow.createMany({ data: allowed.map((value) => ({ value: value.slice(0, 255) })), skipDuplicates: true }),
      ]);
    }
    return blocked;
  });

  await run("PHISHDESTROY", async () => parsePhishDestroy(JSON.parse(await download(URLS.phishdestroy, fetchImpl))));
  return summary;
}

export interface ListMatch {
  source: ThreatSource;
  name: string;
  url: string;
}

/** Which free lists name this wallet or website. Empty when none do. */
export async function checkThreatLists(indicator: NormalizedIndicator, raw: string): Promise<ListMatch[]> {
  let rows: { source: ThreatSource }[] = [];
  if (indicator.kind === "DOMAIN") {
    const candidates = domainCandidates(indicator.normalizedValue);
    // A domain a list marks as legitimate (e.g. a real exchange) is never flagged.
    if (await prisma.threatListAllow.findFirst({ where: { value: { in: candidates } }, select: { value: true } })) return [];
    rows = await prisma.threatListEntry.findMany({ where: { kind: "DOMAIN", value: { in: candidates } }, select: { source: true }, distinct: ["source"] });
  } else if (indicator.kind === "WALLET" || indicator.kind === "OTHER") {
    rows = await prisma.threatListEntry.findMany({
      where: { source: "OFAC", value: { in: walletCandidates(indicator.normalizedValue, raw) } },
      select: { source: true },
      distinct: ["source"],
    });
  }
  return rows.map((r) => ({ source: r.source, ...SOURCE_INFO[r.source] }));
}

/** When the lists were last refreshed successfully (oldest of them), for the checker footer. */
export async function listsUpdatedAt(): Promise<Date | null> {
  const rows = await prisma.threatListSync.findMany({ where: { ok: true }, select: { syncedAt: true } });
  return rows.length ? new Date(Math.min(...rows.map((r) => r.syncedAt.getTime()))) : null;
}
