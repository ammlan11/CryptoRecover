/**
 * Ad landing pages at /lp/<slug>. Headlines match the ad copy word for word so
 * Google and Meta see message match. These pages are noindex.
 */
import type { ScamTypeValue } from "@/lib/options";

export interface Campaign {
  slug: string;
  eyebrow: string;
  headline: string;
  sub: string;
  defaultScamType: ScamTypeValue;
  quotes: string[];
  quotesNote: string;
  /** Heading above the quotes (default "Sound familiar?"). */
  quotesTitle?: string;
}

export const CAMPAIGNS: Campaign[] = [
  {
    slug: "behind-every-scam",
    eyebrow: "Crypto scam research",
    headline: "Behind every scam is a person.",
    sub: "No one who's been scammed should feel alone, and it's never their fault. Our research team is mapping how these scams work so fewer people get caught.",
    defaultScamType: "UNSURE",
    quotesTitle: "Lines scammers use on thousands of people",
    quotes: [
      "I've never felt this close to anyone. Let me show you how I grow my savings.",
      "Move it to this platform, it's safer than your bank.",
      "Don't tell your family yet. They won't understand until you're rich.",
    ],
    quotesNote: "These scripts are written to work on anyone. Falling for one says nothing about you.",
  },
  {
    slug: "broker-scams",
    eyebrow: "Crypto scam research · Broker scams",
    headline: "“Trading mentors” asking for withdrawal fees are a scam pattern.",
    sub: "Seen one? Share how it worked. Our private investigators study every report to expose the wallets and sites behind it, and we publish warnings so others don't pay. We don't recover money and we never charge.",
    defaultScamType: "MESSAGING_BROKER",
    quotes: [
      "Your profit is ready, but you must pay a 15% release fee first.",
      "Your account is frozen for tax verification. Deposit to unlock.",
      "I'm your personal account manager. Send more to reach VIP level.",
    ],
    quotesNote: "Common lines in broker scams. Real platforms take fees from your balance, never as a new deposit.",
  },
  {
    slug: "fake-apps",
    eyebrow: "Crypto scam research · Fake trading apps",
    headline: "When cashing out costs a “fee”, the app is the scam.",
    sub: "Seen a trading app that shows profits but won't let you withdraw? Share how it worked. Investigators study every report and we publish confirmed fake platforms. Free, and we never ask for money.",
    defaultScamType: "FAKE_TRADING_APP",
    quotes: [
      "Withdrawal pending: pay the anti-money-laundering deposit to continue.",
      "Upgrade to VIP to unlock withdrawals above your limit.",
      "Your balance is below the minimum. Top up to release funds.",
    ],
    quotesNote: "Messages reported from fake trading apps. A real exchange never asks for a deposit to release your own balance.",
  },
  {
    slug: "report",
    eyebrow: "Crypto scam research",
    headline: "Every scam leaves a pattern. Your report helps us find it.",
    sub: "Tell us how a crypto scam reached you. A private investigation team studies each report to work out how it operates, and we publish warnings so fewer people fall for it.",
    defaultScamType: "UNSURE",
    quotes: [
      "Guaranteed 20% a month, no risk.",
      "Only today: double your deposit bonus.",
      "Send the fee and your funds are released immediately.",
    ],
    quotesNote: "Promises like these show up again and again in reports.",
  },
];

export function getCampaign(slug: string) {
  return CAMPAIGNS.find((c) => c.slug === slug);
}
