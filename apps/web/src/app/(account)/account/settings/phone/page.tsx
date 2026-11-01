import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@kurotrace/db";
import { requireUser } from "@/lib/session";
import { maskPhone, userPhone } from "@/server/phone";
import { ChangePhoneForm } from "./ChangePhoneForm";

export const metadata: Metadata = { title: "Change mobile number" };

export default async function ChangePhonePage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { id: true, phoneEnc: true } });
  const phone = userPhone(user);
  return (
    <>
      <h1 className="page-title">Change mobile number</h1>
      <section className="panel" style={{ maxWidth: 520 }}>
        <p style={{ marginTop: 0 }}>Your number on file is <strong>{phone ? maskPhone(phone) : "none"}</strong>. We&rsquo;ll email you when it changes.</p>
        <ChangePhoneForm />
        <p className="fine" style={{ marginBottom: 0 }}><Link href="/account/settings">← Back to settings</Link></p>
      </section>
    </>
  );
}
