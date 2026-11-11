import Link from "next/link";
import { SCAMS } from "@/content/scams";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { ReportLink } from "@/components/ReportLink";

export function NoticeBar() {
  return (
    <div className="notice">
      <span className="notice-dot" aria-hidden="true" />
      Kuro Trace will never ask you for payment, a &ldquo;recovery fee&rdquo; or your seed phrase.
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="wrap site-header">
      <div className="pill pill-main">
        <Link href="/" className="brand">
          <Logo tone="black" height={34} alt="Kuro Trace home" />
        </Link>
        <MobileMenu />
        <nav className="nav" aria-label="Main">
          <Link href="/scams">Crypto scams</Link>
          <Link href="/#check">Check a wallet</Link>
          <Link href="/#alerts">Scam alerts</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
      </div>
      <div className="pill pill-side">
        <Link href="/login" style={{ fontSize: 15, fontWeight: 500, color: "var(--navy-900)" }}>Log in</Link>
        <Link href="/signup" className="header-signup" style={{ fontSize: 15, fontWeight: 500, color: "var(--navy-900)" }}>Create account</Link>
        <ReportLink className="btn btn-line" />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <Logo tone="white" height={36} />
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: "12px 0 0" }}>
            Crypto scam research.
            <br />
            Flaxhome, 8 Broadway, Duffield, Derbyshire, England, DE56 4BT.
          </p>
        </div>
        <nav className="footer-col" aria-label="Popular topics">
          <span className="mono" style={{ fontSize: 12 }}>Popular topics</span>
          {SCAMS.slice(0, 5).map((s) => (
            <Link key={s.slug} href={`/scams/${s.slug}`}>
              {s.name}
            </Link>
          ))}
        </nav>
        <nav className="footer-col" aria-label="Tools">
          <span className="mono" style={{ fontSize: 12 }}>Tools</span>
          <ReportLink>Report a crypto scam</ReportLink>
          <Link href="/#check">Crypto wallet checker</Link>
          <Link href="/#alerts">Weekly scam alert</Link>
        </nav>
        <nav className="footer-col" aria-label="Legal">
          <span className="mono" style={{ fontSize: 12 }}>Legal</span>
          <Link href="/privacy">Privacy notice</Link>
        </nav>
      </div>
      <div className="wrap footer-base">
        <span>© 2024 Kuro Trace. All rights reserved.</span>
      </div>
    </footer>
  );
}

export function StickyCta() {
  return (
    <div className="sticky-cta">
      <div className="wrap">
        <span style={{ fontSize: 14, color: "#d8def3" }}>Seen a crypto scam? It takes 5 minutes to put it on the record.</span>
        <ReportLink className="btn btn-cyan" />
      </div>
    </div>
  );
}
