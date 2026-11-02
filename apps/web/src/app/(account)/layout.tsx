import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ActionForm } from "@/components/account/ActionForm";
import { requireUser } from "@/lib/session";
import { logoutAction, resendVerificationAction } from "./account/actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  return (
    <div className="account-shell">
      <header className="account-header">
        <div className="wrap account-header-inner">
          <Link href="/account/reports" className="account-brand">
            <Logo tone="white" height={26} alt="Kuro Trace: my reports" />
          </Link>
          <nav aria-label="Account" className="account-nav">
            <Link href="/account/reports">My reports</Link>
            <Link href="/account/issues/new">Report an issue</Link>
            <Link href="/account/settings">Settings</Link>
          </nav>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-line-w" style={{ minHeight: 40, fontSize: 12 }}>Log out</button>
          </form>
        </div>
      </header>
      {!session.user.emailVerifiedAt && (
        <div className="verify-banner">
          <div className="wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>Confirm your email to send reports. We sent you a link when you signed up.</span>
            <ActionForm action={resendVerificationAction}>
              <button type="submit" className="btn btn-line" style={{ minHeight: 40, fontSize: 12 }}>Send it again</button>
            </ActionForm>
          </div>
        </div>
      )}
      <main id="main" className="wrap account-main">{children}</main>
    </div>
  );
}
