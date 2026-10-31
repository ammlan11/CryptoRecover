import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { TwoStepForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Enter your code" lead="Open your authenticator app and type the 6-digit code for Demo. Lost your phone? Use one of your recovery codes.">
      <TwoStepForm next={next} />
    </AuthCard>
  );
}
