import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/AuthForms";
import { currentStaff } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentStaff()) redirect("/");
  return (
    <main className="auth">
      <div className="auth-card">
        <div style={{ marginBottom: 20 }}><Logo tone="black" height={30} /></div>
        <h1>Admin terminal</h1>
        <p className="auth-tag">AUTHORISED STAFF ONLY · EVERY ACTION IS LOGGED</p>
        <LoginForm />
      </div>
    </main>
  );
}
