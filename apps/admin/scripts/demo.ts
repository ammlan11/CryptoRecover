/**
 * Demo accounts and sample data for showing Kuro Trace on your own computer.
 *
 *   npm run demo
 *
 * Creates (or resets, if they already exist) a demo admin and a demo user with known
 * passwords, clears any lock-out from wrong tries, and adds three sample reports.
 * Safe to run again any time before a demo.
 *
 * Refuses to run on a live server: these passwords are public.
 */
import { hashPassword } from "@kurotrace/core/password";
import { normalizeIndicator } from "@kurotrace/core/indicators";
import { generatePublicRef } from "@kurotrace/core/tokens";
import { totpUri } from "@kurotrace/core/totp";
import { prisma, type IndicatorKind, type ReportStatus, type ScamType } from "@kurotrace/db";
import { encryptText, indexFor, protectEmail } from "@kurotrace/services/crypto";
import { loadKeys } from "@kurotrace/services/keys";
import { aad } from "@kurotrace/services/records";

export const DEMO = {
  adminUsername: "demo-admin",
  userEmail: "demo@kurotrace.test",
  password: "kuro trace demo 2026",
  phone: "+819012345678",
  // Fixed so you can add it to your authenticator app once and keep it.
  totpSecret: "KUROTRACEDEMOKEYKUROTRACEDEMOKEY",
} as const;

function refuseOnLiveServer() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const local = !site || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(site);
  if (process.env.NODE_ENV === "production" || !local) {
    console.error("Refusing to create demo accounts: this looks like a live server (NODE_ENV=production or a public NEXT_PUBLIC_SITE_URL).");
    process.exit(1);
  }
}

const SAMPLES: { scamType: ScamType; status: ReportStatus; lossBand: "UNDER_1K" | "FROM_1K_TO_10K" | "FROM_10K_TO_50K"; country: string; narrative: string; asset: string; network: string; amount: string; indicators: string[]; confirmFirst: boolean; reply?: string }[] = [
  {
    scamType: "PIG_BUTCHERING",
    status: "IN_HOUSE_REVIEW",
    lossBand: "FROM_10K_TO_50K",
    country: "JP",
    narrative:
      "Someone messaged me by mistake on WhatsApp, then kept chatting for weeks. She showed me profits from a trading platform and helped me open an account. My balance grew, but when I tried to withdraw they asked for a 20% \"release fee\" first. After I paid it they asked for a tax payment, and then the site stopped answering.",
    asset: "USDT",
    network: "TRON",
    amount: "18500",
    indicators: ["TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", "globalcoin-trade.example", "@sakura_trader_88"],
    confirmFirst: true,
    reply: "Thank you for the detailed report. Could you upload a screenshot of the withdrawal screen that asked for the release fee?",
  },
  {
    scamType: "FAKE_TRADING_APP",
    status: "RECEIVED",
    lossBand: "FROM_1K_TO_10K",
    country: "AE",
    narrative:
      "I downloaded an app called \"BitNova Pro\" from a link in an Instagram ad. Deposits worked and the app showed fast gains. When I asked to withdraw, support said my account was frozen for \"suspicious activity\" and I had to deposit the same amount again to unlock it.",
    asset: "USDT",
    network: "Ethereum",
    amount: "4200",
    indicators: ["0x8ba1f109551bD432803012645Ac136ddd64DBA72", "bitnova-pro.example"],
    confirmFirst: false,
  },
  {
    scamType: "RECOVERY_OFFER",
    status: "CLOSED",
    lossBand: "UNDER_1K",
    country: "GB",
    narrative:
      "After I posted about losing money in a scam, an \"asset recovery agency\" contacted me on Telegram. They promised to get my funds back for an upfront fee of 0.01 BTC. I paid, and they disappeared.",
    asset: "BTC",
    network: "Bitcoin",
    amount: "0.01",
    indicators: ["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "@recovery_agent_desk"],
    confirmFirst: true,
  },
];

async function main() {
  refuseOnLiveServer();
  await loadKeys();
  const passwordHash = await hashPassword(DEMO.password);

  // ── Admin ──
  const staff = await prisma.staff.upsert({
    where: { username: DEMO.adminUsername },
    create: { username: DEMO.adminUsername, role: "OWNER", passwordHash, activatedAt: new Date() },
    update: { role: "OWNER", passwordHash, disabledAt: null, failedLogins: 0, lockedUntil: null, totpLastStep: null, allowedIps: null, activatedAt: new Date() },
  });
  await prisma.staff.update({ where: { id: staff.id }, data: { totpSecretEnc: encryptText(DEMO.totpSecret, aad.staffTotp(staff.id)) } });
  await prisma.staffSession.deleteMany({ where: { staffId: staff.id } });

  // ── User ──
  const { emailHash, emailEnc } = protectEmail(DEMO.userEmail, aad.userEmail());
  const user = await prisma.user.upsert({
    where: { emailHash },
    create: { emailHash, emailEnc, passwordHash, emailVerifiedAt: new Date() },
    update: { passwordHash, emailVerifiedAt: new Date(), failedLogins: 0, lockedUntil: null, deletedAt: null, totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { phoneEnc: encryptText(DEMO.phone, aad.userPhone(user.id)), phoneHash: indexFor(DEMO.phone, "user.phone") },
  });
  await prisma.userRecoveryCode.deleteMany({ where: { userId: user.id } });

  // ── Sample reports (replaced on every run) ──
  await prisma.report.deleteMany({ where: { userId: user.id } });
  const refs: string[] = [];
  for (const [i, s] of SAMPLES.entries()) {
    const submittedAt = new Date(Date.now() - (i + 1) * 36 * 60 * 60 * 1000);
    const report = await prisma.report.create({
      data: {
        publicRef: generatePublicRef(),
        userId: user.id,
        status: s.status,
        scamType: s.scamType,
        contactChannel: s.scamType === "PIG_BUTCHERING" ? "WHATSAPP" : s.scamType === "RECOVERY_OFFER" ? "TELEGRAM" : "SOCIAL_MEDIA",
        country: s.country,
        lossBand: s.lossBand,
        occurredAt: new Date(submittedAt.getTime() - 14 * 24 * 60 * 60 * 1000),
        lastStep: 5,
        researchConsentAt: submittedAt,
        publicAlertConsentAt: submittedAt,
        submittedAt,
        closedAt: s.status === "CLOSED" ? new Date() : null,
        createdAt: submittedAt,
      },
    });
    await prisma.report.update({ where: { id: report.id }, data: { narrativeEnc: encryptText(s.narrative, aad.narrative(report.id)) } });
    const payment = await prisma.reportPayment.create({ data: { reportId: report.id, amount: s.amount, asset: s.asset, network: s.network, sentAt: report.occurredAt } });
    for (const [j, raw] of s.indicators.entries()) {
      const n = normalizeIndicator(raw);
      await prisma.reportIndicator.create({
        data: {
          reportId: report.id,
          kind: (n?.kind ?? "OTHER") as IndicatorKind,
          value: raw,
          normalizedValue: n?.normalizedValue ?? raw.toLowerCase(),
          chain: n?.chain ?? null,
          paymentId: j === 0 ? payment.id : null,
          confirmedAt: s.confirmFirst && j === 0 ? new Date() : null,
          confirmedById: s.confirmFirst && j === 0 ? staff.id : null,
        },
      });
    }
    if (s.reply) {
      await prisma.message.create({ data: { reportId: report.id, authorType: "STAFF", staffId: staff.id, bodyEnc: encryptText(s.reply, aad.message(report.id)) } });
    }
    refs.push(`${report.publicRef} (${s.status.toLowerCase().replace(/_/g, " ")})`);
  }

  console.log(`
Demo ready. These details are public, so use them on your own computer only.

  ADMIN  http://localhost:3001
    Username:  ${DEMO.adminUsername}
    Password:  ${DEMO.password}
    Code:      from your authenticator app. Add this key once (Add account → Enter a setup key):
               ${DEMO.totpSecret.match(/.{1,4}/g)!.join(" ")}
               ${totpUri(DEMO.totpSecret, DEMO.adminUsername, "Kuro Trace Admin")}

  USER   http://localhost:3000/login
    Email:     ${DEMO.userEmail}
    Password:  ${DEMO.password}
    Code:      printed in the terminal running "npm run dev:web" (subject: "123456 is your Kuro Trace sign-in code")

  Sample reports: ${refs.join(", ")}
  Try the wallet checker on the home page with: ${SAMPLES[0]!.indicators[0]}
`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
