import type { Metadata } from "next";
import Link from "next/link";
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
            <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2l9 3.5v7c0 5.5-4 9.5-9 11.5-5-2-9-6-9-11.5v-7z" />
            </svg>
            Demo
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
