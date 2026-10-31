import { LOSS_BAND_OPTIONS, SCAM_TYPE_OPTIONS } from "./options";

export const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "info" | "warn" | "ok" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  RECEIVED: { label: "Received", tone: "info" },
  IN_HOUSE_REVIEW: { label: "In-house review", tone: "info" },
  INFO_NEEDED: { label: "Info needed", tone: "warn" },
  WITH_INVESTIGATORS: { label: "Investigator analysis", tone: "info" },
  CLOSED: { label: "Closed", tone: "ok" },
};

export const STATUS_FLOW = ["RECEIVED", "IN_HOUSE_REVIEW", "WITH_INVESTIGATORS", "CLOSED"] as const;

export const scamLabel = (value: string) => SCAM_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "Other";
export const lossLabel = (value: string | null) => (value ? LOSS_BAND_OPTIONS.find((o) => o.value === value)?.label ?? "" : "Not given");

export const CHANNEL_OPTIONS = [
  { value: "TELEGRAM", label: "Telegram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SOCIAL_MEDIA", label: "Instagram, Facebook or other social media" },
  { value: "DATING_APP", label: "Dating app" },
  { value: "PHONE", label: "Phone call or SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "WEBSITE_AD", label: "A website or an online ad" },
  { value: "OTHER", label: "Something else" },
] as const;

export const ASSET_OPTIONS = ["USDT", "USDC", "BTC", "ETH", "BNB", "TRX", "SOL", "USD", "EUR", "GBP", "OTHER"] as const;
export const NETWORK_OPTIONS = ["TRON (TRC-20)", "Ethereum (ERC-20)", "Bitcoin", "BNB Chain (BEP-20)", "Solana", "Polygon", "Other", "Not sure"] as const;

export const formatDate = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
