import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/AuthForms";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await currentSession()) redirect("/account/reports");
  return (
    <AuthCard title="Create an account" lead="Your account keeps your reports private and lets our team ask you questions securely. Free, always.">
      <SignupForm />
    </AuthCard>
  );
}
