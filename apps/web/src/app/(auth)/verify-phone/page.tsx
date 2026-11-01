import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { PhoneForm } from "@/components/auth/PhoneForm";
import { requireUser } from "@/lib/session";
import { logoutAction } from "../../(account)/account/actions";

export const metadata: Metadata = { title: "Confirm your mobile number" };

/** Every account confirms a mobile number before using the site; sign-ins then need a texted code. */
export default async function VerifyPhonePage() {
  const session = await requireUser({ allowUnverifiedPhone: true });
  if (session.user.phoneVerifiedAt) redirect("/account/reports");
  return (
    <AuthCard
      title="Confirm your mobile number"
      lead="One last step. Each time you log in, we'll text a code to this number, so nobody else can get into your account, even with your password."
    >
      <PhoneForm />
      <form action={logoutAction} style={{ marginTop: 18, textAlign: "center" }}>
        <button type="submit" className="link-button fine">Log out</button>
      </form>
    </AuthCard>
  );
}
