export const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  RECEIVED: { label: "Received", tone: "neutral" },
  IN_HOUSE_REVIEW: { label: "In-house review", tone: "info" },
  INFO_NEEDED: { label: "Info needed", tone: "warn" },
  WITH_INVESTIGATORS: { label: "With investigators", tone: "cyan" },
  CLOSED: { label: "Closed", tone: "ok" },
};

export const SCAM: Record<string, string> = {
  PIG_BUTCHERING: "Romance + investing",
  FAKE_TRADING_APP: "Fake trading app",
  MESSAGING_BROKER: "Telegram / WhatsApp broker",
  RECOVERY_OFFER: "Recovery offer",
  WALLET_DRAINER: "Wallet drainer",
  IMPERSONATION: "Impersonation",
  OTHER: "Other",
  UNSURE: "Not sure",
};

export const LOSS: Record<string, string> = {
  NONE: "No loss",
  UNDER_1K: "< $1k",
  FROM_1K_TO_10K: "$1k–10k",
  FROM_10K_TO_50K: "$10k–50k",
  OVER_50K: "> $50k",
  NOT_GIVEN: "Not given",
};

export const SOURCE: Record<string, string> = {
  HERO_FORM: "Home page form",
  CAMPAIGN_FORM: "Ad landing page",
  CHECKER_WATCH: "Checker watch-list",
  NEWSLETTER: "Weekly alert",
};

export const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
export const fmtDay = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export function Pill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" };
  return <span className={`pill pill-${s.tone}`}>{s.label}</span>;
}
