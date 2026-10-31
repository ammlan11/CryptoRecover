/** Choices shown in forms. Values match the database enums. */

export const SCAM_TYPE_OPTIONS = [
  { value: "FAKE_TRADING_APP", label: "Fake trading app" },
  { value: "MESSAGING_BROKER", label: "Telegram / WhatsApp broker" },
  { value: "PIG_BUTCHERING", label: "Romance + investing" },
  { value: "RECOVERY_OFFER", label: "Recovery offer" },
  { value: "WALLET_DRAINER", label: "Wallet drainer" },
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "UNSURE", label: "Not sure" },
] as const;

export const LOSS_BAND_OPTIONS = [
  { value: "UNDER_1K", label: "Under $1,000" },
  { value: "FROM_1K_TO_10K", label: "$1,000 to $10,000" },
  { value: "FROM_10K_TO_50K", label: "$10,000 to $50,000" },
  { value: "OVER_50K", label: "Over $50,000" },
  { value: "NONE", label: "Nothing yet" },
] as const;

export type ScamTypeValue = (typeof SCAM_TYPE_OPTIONS)[number]["value"];
export type LossBandValue = (typeof LOSS_BAND_OPTIONS)[number]["value"];
