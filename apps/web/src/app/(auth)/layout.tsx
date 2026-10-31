import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="wrap" style={{ padding: "20px 0" }}>
        <Link href="/" className="pill" style={{ display: "inline-flex", padding: "12px 20px", fontSize: 22, fontWeight: 700 }}>Kuro Trace</Link>
      </header>
      <main id="main" className="auth-main">{children}</main>
      <p className="auth-foot">Kuro Trace never asks for payment, a recovery fee or your seed phrase.</p>
    </div>
  );
}
