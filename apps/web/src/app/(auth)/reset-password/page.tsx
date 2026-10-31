import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetForm } from "@/components/auth/AuthForms";
import { peekEmailToken } from "@/server/email-tokens";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await peekEmailToken(token, "RESET_PASSWORD");
  if (!valid) {
    return (
      <AuthCard title="This link has expired" lead="Reset links work once, for 1 hour.">
        <Link href="/forgot-password" className="btn btn-navy" style={{ width: "100%" }}>Send a new link</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" lead="You'll be signed out on other devices.">
      <ResetForm token={token} />
    </AuthCard>
  );
}
