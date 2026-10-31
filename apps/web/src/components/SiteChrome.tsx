import Link from "next/link";
import { SCAMS } from "@/content/scams";

function ShieldMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2l9 3.5v7c0 5.5-4 9.5-9 11.5-5-2-9-6-9-11.5v-7z" />
      <circle cx="13" cy="12" r="1.6" fill="currentColor" />
      <circle cx="13" cy="12" r="5" strokeDasharray="0 3.2" strokeLinecap="round" />
    </svg>
  );
}

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
        <Link href="/" className="brand" aria-label="Kuro Trace home">
          <ShieldMark />
          <span>Kuro Trace</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/scams">Crypto scams</Link>
          <Link href="/#check">Check a wallet</Link>
          <Link href="/#alerts">Scam alerts</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
      </div>
      <div className="pill pill-side">
        <Link href="/login" style={{ fontSize: 15, fontWeight: 500, color: "var(--navy-900)" }}>Log in</Link>
        <Link href="/#report" className="btn btn-line">
          Share your report
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Kuro Trace</span>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: "12px 0 0" }}>
            Crypto scam research.
            <br />
            [Legal entity] · [Registered address]
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
          <Link href="/#report">Report a crypto scam</Link>
          <Link href="/#check">Crypto wallet checker</Link>
          <Link href="/#alerts">Weekly scam alert</Link>
        </nav>
        <nav className="footer-col" aria-label="Legal">
          <span className="mono" style={{ fontSize: 12 }}>Legal</span>
          <Link href="/privacy">Privacy notice</Link>
        </nav>
      </div>
      <div className="wrap footer-base">
        <span>© {new Date().getFullYear()} [Entity]. We never ask for payment, a recovery fee or your seed phrase.</span>
      </div>
    </footer>
  );
}

export function StickyCta() {
  return (
    <div className="sticky-cta">
      <div className="wrap">
        <span style={{ fontSize: 14, color: "#d8def3" }}>Seen a crypto scam? It takes 5 minutes to put it on the record.</span>
        <Link href="/#report" className="btn btn-cyan">
          Share your report
        </Link>
      </div>
    </div>
  );
}
