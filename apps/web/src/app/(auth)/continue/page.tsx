import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ContinueForm } from "@/components/auth/AuthForms";
import { inspectContinueLink } from "@/server/accounts";
import { visitorCountry } from "@/lib/visitor-country";

export const metadata: Metadata = { title: "Finish your report", referrer: "no-referrer" };

export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const info = await inspectContinueLink(token);
  if (!info) {
    return (
      <AuthCard title="This link has expired" lead="Report links work for 7 days. You can start a new report any time.">
        <Link href="/#start" className="btn btn-navy" style={{ width: "100%" }}>Start a report</Link>
      </AuthCard>
    );
  }
  if (info.hasAccount) {
    return (
      <AuthCard title="You already have an account" lead={`${info.email} already has a Kuro Trace account, so there's nothing to sign up for. Log in to finish your report.`}>
        <Link href="/login?next=/account/reports/new" className="btn btn-navy" style={{ width: "100%" }}>Log in and continue</Link>
        <p className="fine" style={{ textAlign: "center", marginTop: 14 }}>
          Forgot your password? <Link href="/forgot-password">Reset it</Link>
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Create your free account" lead="One quick step before your report: choose a password and add your mobile number, so your report stays private and our team can reach you. Your email is already confirmed.">
      <ContinueForm token={token} email={info.email} country={await visitorCountry()} />
    </AuthCard>
  );
}
