import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password" lead="Enter your email and we'll send you a link to choose a new password.">
      <ForgotForm />
    </AuthCard>
  );
}
