import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/AuthForms";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentSession()) redirect("/account/reports");
  const { next } = await searchParams;
  return (
    <AuthCard title="Log in" lead="Follow your reports and messages from our research team.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
