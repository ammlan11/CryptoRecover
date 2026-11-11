/**
 * Free, openly licensed threat lists used by the public checker.
 *
 * - OFAC: crypto addresses on the US Treasury sanctions (SDN) list, extracted nightly by
 *   github.com/0xB10C/ofac-sanctioned-digital-currency-addresses (MIT).
 * - MetaMask: known crypto phishing sites, github.com/MetaMask/eth-phishing-detect
 *   (DBAD licence; credited on the site). Its allowlist overrides every list.
 * - PhishDestroy: crypto phishing and scam domains, github.com/phishdestroy/destroylist (MIT).
 *
 * This file only parses and matches. Downloading and storing lives in @kurotrace/services.
 */
import { normalizeIndicator, type IndicatorKind } from "./indicators";

export type ThreatSource = "OFAC" | "METAMASK" | "PHISHDESTROY";

export interface ThreatEntry {
  kind: IndicatorKind;
  value: string;
  chain?: string;
}

export const OFAC_TICKERS = ["XBT", "ETH", "USDT", "USDC", "TRX", "BSC", "ARB", "SOL", "LTC", "BCH", "BSV", "BTG", "ETC", "DASH", "ZEC", "XMR", "XRP", "XVG"] as const;

export const SOURCE_INFO: Record<ThreatSource, { name: string; url: string }> = {
  OFAC: { name: "US Treasury sanctions list (OFAC)", url: "https://sanctionssearch.ofac.treas.gov/" },
  METAMASK: { name: "MetaMask scam-site list", url: "https://github.com/MetaMask/eth-phishing-detect" },
  PHISHDESTROY: { name: "PhishDestroy scam-site list", url: "https://github.com/phishdestroy/destroylist" },
};

/**
 * Shared hosting and big platforms: a scam on one subdomain must never flag the whole
 * platform, so these are never matched as a parent domain.
 */
const SHARED_PARENTS = new Set([
  "vercel.app", "netlify.app", "github.io", "pages.dev", "web.app", "firebaseapp.com", "herokuapp.com", "blogspot.com",
  "wixsite.com", "weebly.com", "webflow.io", "framer.app", "glitch.me", "repl.co", "replit.app", "onrender.com", "fly.dev",
  "azurewebsites.net", "cloudfront.net", "amazonaws.com", "appspot.com", "workers.dev", "ipfs.io", "dweb.link",
  "google.com", "sites.google.com", "docs.google.com", "telegram.org", "t.me", "medium.com", "notion.site", "gitbook.io",
  "co.uk", "com.au", "co.jp", "com.br", "co.in", "com.sg", "com.my",
]);

/** One sanctions file: one address per line. Values are normalised like checker input. */
export function parseOfacList(ticker: string, text: string): ThreatEntry[] {
  const out: ThreatEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#") || raw.length > 128) continue;
    const n = normalizeIndicator(raw);
    // Coins the checker doesn't recognise (e.g. Monero) are kept exactly as listed.
    out.push(n && (n.kind === "WALLET" || n.kind === "TX_HASH") ? { kind: "WALLET", value: n.normalizedValue, chain: ticker } : { kind: "WALLET", value: raw, chain: ticker });
  }
  return out;
}

/** MetaMask config.json: { blacklist: [...], whitelist: [...] }. */
export function parseMetaMaskConfig(json: unknown): { blocked: ThreatEntry[]; allowed: string[] } {
  const d = json as { blacklist?: unknown; whitelist?: unknown };
  return { blocked: domains(d.blacklist), allowed: domains(d.whitelist).map((e) => e.value) };
}

/** PhishDestroy list.json: an array of domains. */
export function parsePhishDestroy(json: unknown): ThreatEntry[] {
  return domains(json);
}

function domains(list: unknown): ThreatEntry[] {
  if (!Array.isArray(list)) throw new Error("Unexpected list format");
  const seen = new Set<string>();
  const out: ThreatEntry[] = [];
  for (const item of list) {
    if (typeof item !== "string" || item.length > 253) continue;
    const n = normalizeIndicator(item);
    if (!n || n.kind !== "DOMAIN" || SHARED_PARENTS.has(n.normalizedValue) || seen.has(n.normalizedValue)) continue;
    seen.add(n.normalizedValue);
    out.push({ kind: "DOMAIN", value: n.normalizedValue });
  }
  return out;
}

/**
 * Hostnames to look up for a domain: the host itself, then each parent down to two
 * labels, skipping shared platforms. "login.evil-site.com" also matches "evil-site.com".
 */
export function domainCandidates(host: string): string[] {
  const labels = host.split(".");
  const out = [host];
  for (let i = 1; i <= labels.length - 2; i++) {
    const parent = labels.slice(i).join(".");
    if (!SHARED_PARENTS.has(parent)) out.push(parent);
  }
  return out;
}

/** Values to look up for a wallet: the normalised form, and the text as typed. */
export function walletCandidates(normalized: string, raw: string): string[] {
  const typed = raw.trim();
  return typed && typed !== normalized && typed.length <= 128 ? [normalized, typed] : [normalized];
}
