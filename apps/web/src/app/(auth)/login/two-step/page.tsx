import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { TwoStepForm } from "@/components/auth/AuthForms";
import { takeChallengeCookie } from "@/lib/session";
import { challengeSummary } from "@/server/accounts";

export const metadata: Metadata = { title: "Enter your code" };

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string }> }) {
  const { next, sent } = await searchParams;
  const summary = await challengeSummary(await takeChallengeCookie());
  if (!summary) redirect("/login");
  const app = summary.hasApp ? " You can also use a code from your authenticator app." : "";
  const lead =
    sent === "0"
      ? `We couldn't send the email to ${summary.maskedEmail} just now. Use "send a new code" below.${app}`
      : `We emailed a 6-digit code to ${summary.maskedEmail}.${app} Never share it: we will never ask you for it.`;
  return (
    <AuthCard title="Check your email" lead={lead}>
      <TwoStepForm next={next} hasApp={summary.hasApp} />
    </AuthCard>
  );
}
