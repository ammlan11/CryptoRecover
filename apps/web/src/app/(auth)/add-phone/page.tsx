import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { requireUser } from "@/lib/session";
import { logoutAction } from "../../(account)/account/actions";
import { AddPhoneForm } from "./AddPhoneForm";
import { visitorCountry } from "@/lib/visitor-country";

export const metadata: Metadata = { title: "Add your mobile number" };

/** For accounts created before a mobile number was required. */
export default async function AddPhonePage() {
  const session = await requireUser({ allowMissingPhone: true });
  if (session.user.phoneHash) redirect("/account/reports");
  return (
    <AuthCard title="Add your mobile number" lead="Our research team may need to reach you about your report. Your number is encrypted and never shown publicly.">
      <AddPhoneForm country={await visitorCountry()} />
      <form action={logoutAction} style={{ marginTop: 18, textAlign: "center" }}>
        <button type="submit" className="link-button fine">Log out</button>
      </form>
    </AuthCard>
  );
}
