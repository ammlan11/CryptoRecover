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
  const lead = summary.maskedPhone
    ? sent === "0"
      ? `We couldn't send a text to ${summary.maskedPhone} just now. Use "Send a new code" below${summary.hasApp ? ", or a code from your authenticator app" : ""}.`
      : `We texted a 6-digit code to ${summary.maskedPhone}.${summary.hasApp ? " You can also use a code from your authenticator app." : ""} Never share it: we will never ask you for it.`
    : "Open your authenticator app and type the 6-digit code for Kuro Trace. Lost your phone? Use one of your recovery codes.";
  return (
    <AuthCard title="Enter your code" lead={lead}>
      <TwoStepForm next={next} maskedPhone={summary.maskedPhone} hasApp={summary.hasApp} />
    </AuthCard>
  );
}
