import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { currentStaff } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentStaff()) redirect("/");
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Kuro Trace admin</h1>
        <p className="auth-tag">AUTHORISED STAFF ONLY · EVERY ACTION IS LOGGED</p>
        <LoginForm />
      </div>
    </main>
  );
}
