import { ReauthForm } from "@/components/AuthForms";
import { prisma } from "@kurotrace/db";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Confirm it's you" };

export default async function ReauthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { staff } = await requireStaff();
  const hasKeys = (await prisma.webAuthnKey.count({ where: { staffId: staff.id } })) > 0;
  const { next = "/" } = await searchParams;
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Confirm it&rsquo;s you</h1>
        <p className="auth-tag">REQUIRED FOR EXPORTS AND STAFF CHANGES</p>
        <ReauthForm next={next} hasKeys={hasKeys} />
      </div>
    </main>
  );
}
