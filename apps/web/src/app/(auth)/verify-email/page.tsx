import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { verifyEmail } from "@/server/accounts";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const ok = await verifyEmail(token);
  return ok ? (
    <AuthCard title="Email confirmed" lead="Thank you. You can now send reports.">
      <Link href="/account/reports" className="btn btn-navy" style={{ width: "100%" }}>Go to my reports</Link>
    </AuthCard>
  ) : (
    <AuthCard title="This link has expired" lead="Confirmation links work once, for 24 hours. Log in and we'll offer to send a new one.">
      <Link href="/login" className="btn btn-navy" style={{ width: "100%" }}>Log in</Link>
    </AuthCard>
  );
}
