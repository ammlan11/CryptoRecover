import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ContinueForm } from "@/components/auth/AuthForms";
import { inspectContinueLink } from "@/server/accounts";

export const metadata: Metadata = { title: "Finish your report", referrer: "no-referrer" };

export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const info = await inspectContinueLink(token);
  if (!info) {
    return (
      <AuthCard title="This link has expired" lead="Report links work for 7 days. You can start a new report any time.">
        <Link href="/#report" className="btn btn-navy" style={{ width: "100%" }}>Start a report</Link>
      </AuthCard>
    );
  }
  if (info.hasAccount) {
    return (
      <AuthCard title="Welcome back" lead="You already have an account. Log in to finish your report.">
        <Link href="/login?next=/account/reports/new" className="btn btn-navy" style={{ width: "100%" }}>Log in</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Finish your report" lead="Choose a password so your report stays private and our team can contact you securely.">
      <ContinueForm token={token} email={info.email} />
    </AuthCard>
  );
}
