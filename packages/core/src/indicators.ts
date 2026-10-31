/**
 * Turns whatever someone pastes into the checker (a wallet, a link, a @handle) into
 * one canonical form, so "https://www.Fake-App.com/login" and "fake-app.com" match.
 * Web-standard APIs only.
 */

export type IndicatorKind = "WALLET" | "TX_HASH" | "DOMAIN" | "TELEGRAM" | "PHONE" | "EMAIL" | "OTHER";

export interface NormalizedIndicator {
  kind: IndicatorKind;
  normalizedValue: string;
  chain?: "evm" | "bitcoin" | "tron" | "solana";
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const EVM_TX = /^0x[0-9a-fA-F]{64}$/;
const BTC_BECH32 = /^(bc1)[02-9ac-hj-np-z]{11,71}$/i;
const BTC_LEGACY = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX_TX = /^[0-9a-fA-F]{64}$/;
const HANDLE = /^@[A-Za-z0-9_]{3,64}$/;
const TELEGRAM_LINK = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,64})\/?$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s().-]{6,20}$/;

export const MAX_INDICATOR_LENGTH = 512;

export function normalizeIndicator(raw: string): NormalizedIndicator | null {
  const value = raw.normalize("NFKC").trim();
  if (!value || value.length > MAX_INDICATOR_LENGTH) return null;

  if (EVM_ADDRESS.test(value)) return { kind: "WALLET", normalizedValue: value.toLowerCase(), chain: "evm" };
  if (EVM_TX.test(value)) return { kind: "TX_HASH", normalizedValue: value.toLowerCase(), chain: "evm" };
  if (BTC_BECH32.test(value)) return { kind: "WALLET", normalizedValue: value.toLowerCase(), chain: "bitcoin" };
  if (BTC_LEGACY.test(value)) return { kind: "WALLET", normalizedValue: value, chain: "bitcoin" };
  if (TRON.test(value)) return { kind: "WALLET", normalizedValue: value, chain: "tron" };
  if (HEX_TX.test(value)) return { kind: "TX_HASH", normalizedValue: value.toLowerCase() };

  const tg = TELEGRAM_LINK.exec(value);
  if (tg) return { kind: "TELEGRAM", normalizedValue: tg[1]!.toLowerCase() };
  if (HANDLE.test(value)) return { kind: "TELEGRAM", normalizedValue: value.slice(1).toLowerCase() };

  if (EMAIL.test(value) && !value.includes("/")) return { kind: "EMAIL", normalizedValue: value.toLowerCase() };

  const domain = toDomain(value);
  if (domain) return { kind: "DOMAIN", normalizedValue: domain };

  if (PHONE.test(value)) {
    const digits = value.replace(/[^0-9+]/g, "");
    if (digits.replace("+", "").length >= 7) return { kind: "PHONE", normalizedValue: digits };
  }

  // Solana addresses overlap with plain words, so they are checked after domains.
  if (SOLANA.test(value)) return { kind: "WALLET", normalizedValue: value, chain: "solana" };

  return { kind: "OTHER", normalizedValue: value.toLowerCase() };
}

function toDomain(value: string): string | null {
  if (/\s/.test(value)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let host: string;
  try {
    host = new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  // Needs at least one dot and a 2+ letter TLD; rejects bare words and IPs.
  if (!/^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]{1,62}$/.test(host)) return null;
  return host;
}
