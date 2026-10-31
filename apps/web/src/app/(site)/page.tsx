import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { HeroOrb, SmallOrb } from "@/components/Orb";
import { Checker } from "@/components/forms/Checker";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { StartReportForm } from "@/components/forms/StartReportForm";
import { SCAMS } from "@/content/scams";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const FAQ = [
  {
    q: "How do I report a crypto scam?",
    a: "Share what happened using the form at the top of this page. It takes about 5 minutes. Also report it to your local police and to the exchange or bank you paid from.",
  },
  { q: "Can you get my money back?", a: "No. Kuro Trace is a research project, not a recovery service. Be wary of anyone who offers to recover crypto for a fee." },
  { q: "Why should I report it?", a: "Your report shows how the scam works and links the wallets and sites behind it, so we can warn others sooner." },
  {
    q: "How can I check if a crypto website is a scam?",
    a: "Paste it into our free checker, look the platform up on your financial regulator's register, and watch for the seven warning signs.",
  },
  { q: "Who can see my report?", a: "Our in-house team and the private investigation team. We never publish your name." },
  { q: "Does it cost anything?", a: "No, and we will never ask you for money." },
];

const SIGNS = [
  "A stranger starts the conversation",
  "The returns sound effortless",
  "You're told to decide today",
  "The platform is on no regulator's list",
  "Withdrawing needs a new payment",
  "They ask you to keep it from your bank",
  "Anyone wants your seed phrase",
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />

      <section id="report" className="wrap hero">
        <div className="hero-copy">
          <div className="eyebrow">Crypto scam research · Free and confidential</div>
          <h1>Report a crypto scam. Help expose the pattern behind it.</h1>
          <p className="hero-sub">
            Tell us how the scam reached you. Private investigators study every report to work out how it operates, and we publish
            warnings so fewer people fall for it. Never shown with your name.
          </p>
          <StartReportForm variant="hero" />
        </div>
        <div className="hero-art">
          <HeroOrb />
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }} aria-label="Why people trust Kuro Trace">
        <div className="trust">
          <div><div className="eyebrow">Cost</div><div className="trust-value">Free, always</div></div>
          <div><div className="eyebrow">Privacy</div><div className="trust-value">Encrypted, never published</div></div>
          <div><div className="eyebrow">Research</div><div className="trust-value">Private investigators</div></div>
          <div><div className="eyebrow">Reach</div><div className="trust-value">Reports from any country</div></div>
        </div>
        <div className="logos">
          <span className="mono" style={{ fontSize: 11.5 }}>As seen in</span>
          <span className="logo-slot">[Press logo]</span>
          <span className="logo-slot">[Press logo]</span>
          <span className="logo-slot">[Partner logo]</span>
        </div>
      </section>

      <section id="check" className="wrap" style={{ paddingBottom: 88 }}>
        <div className="checker">
          <div className="checker-intro">
            <div className="eyebrow">Free crypto scam checker</div>
            <h2 className="h2" style={{ fontSize: "clamp(28px, 3vw, 40px)" }}>Check a wallet or website before you send</h2>
            <p className="muted" style={{ lineHeight: 1.6, margin: "12px 0 0" }}>
              See whether a crypto wallet, website or Telegram handle has been reported and confirmed by our investigators.
            </p>
          </div>
          <Checker />
        </div>
      </section>

      <section id="scams" className="light section">
        <div className="wrap">
          <div className="row-between">
            <div>
              <div className="eyebrow blue">Types of crypto scams</div>
              <h2 className="h2">Crypto scams we&rsquo;re tracking right now</h2>
            </div>
            <Link href="/scams" className="see-all">All scam types →</Link>
          </div>
          <div className="grid-cards">
            {SCAMS.map((s) => (
              <Link key={s.slug} href={`/scams/${s.slug}`} className="card">
                <div className={`card-tag${s.danger ? " danger" : ""}`}>{s.danger ? "● " : ""}{s.tag}</div>
                <h3>{s.name}</h3>
                <p>{s.card}</p>
                <span className="more">Read the playbook →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="eyebrow">How it works</div>
          <h2 className="h2">How reporting a crypto scam works</h2>
          <div className="steps">
            <div>
              <div className="eyebrow" style={{ fontSize: 13 }}>01 · 5 minutes</div>
              <h3>Share what happened</h3>
              <p>The platform, how they contacted you, what they asked for. Skip anything you don&rsquo;t know.</p>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 13 }}>02 · Investigators</div>
              <h3>Investigators analyse it</h3>
              <p>Our private investigation team classifies the scam and links wallets, websites and scripts across reports.</p>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 13 }}>03 · Published</div>
              <h3>The findings protect others</h3>
              <p>Confirmed patterns become public scam alerts and guides. Your name is never published.</p>
            </div>
          </div>
          <div className="cta-band">
            <div>
              <strong>Seen a crypto scam? Put it on the record.</strong>
              <span style={{ fontSize: 15 }}>Free · About 5 minutes · Never published with your name</span>
            </div>
            <Link href="#report" className="btn btn-navy">Share your report</Link>
          </div>
        </div>
      </section>

      <section className="light section">
        <div className="wrap">
          <div className="eyebrow blue">Who studies the reports</div>
          <h2 className="h2" style={{ maxWidth: 820 }}>Researchers and private investigators, on every report</h2>
          <div className="grid-cards">
            <div className="card" style={{ padding: 32 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#0b1433" strokeWidth="1.5">
                <circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5.5" />
              </svg>
              <h3>In-house research team</h3>
              <p>Reads every report, checks it is complete, and contacts you only if we have a question.</p>
            </div>
            <div className="card" style={{ padding: 32 }}>
              <div style={{ width: 148, height: 40, border: "1.5px dashed #9aa3c0", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 12, color: "var(--ink-muted)" }}>[Firm logo]</div>
              <h3>[Investigation firm]</h3>
              <p>Private investigators who analyse how each scam operates and confirm patterns before anything is published.</p>
              <div className="card-tag" style={{ marginTop: 16 }}>[Credentials] · [Country]</div>
            </div>
          </div>
        </div>
      </section>

      <section id="alerts" className="section" style={{ overflow: "hidden" }}>
        <div className="wrap alerts">
          <div className="alerts-copy">
            <div className="eyebrow">Free weekly scam alert</div>
            <h2 className="h2">Know the newest crypto scams before they reach you</h2>
            <p className="muted" style={{ lineHeight: 1.6, margin: "16px 0 0", maxWidth: 560 }}>
              One short email a week: newly confirmed fake platforms, the scripts scammers are using, and how to spot them.
            </p>
            <NewsletterForm />
          </div>
          <div className="alert-preview" aria-label="Example scam alert">
            <div className="card-tag">Scam alert · preview</div>
            <div style={{ fontSize: 20, fontWeight: 500, margin: "10px 0 14px" }}>3 new fake trading apps confirmed</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div className="alert-row"><span>[app-name-sample].app</span><span style={{ color: "var(--danger-text)", fontWeight: 600 }}>Confirmed</span></div>
              <div className="alert-row"><span>New script: &ldquo;tax unlock fee&rdquo;</span><span style={{ color: "var(--ink-muted)" }}>Pattern</span></div>
              <div className="alert-row"><span>How to spot it in 30 seconds</span><span style={{ color: "var(--blue)" }}>Guide</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="light section">
        <div className="wrap signs">
          <div>
            <div className="eyebrow red">Warning signs</div>
            <h2 className="h2">7 signs of a crypto scam</h2>
            <p style={{ color: "var(--ink-muted)", lineHeight: 1.6, margin: "16px 0 28px" }}>
              If two or more sound familiar, stop sending money and share what happened.
            </p>
            <Link href="#report" className="btn btn-navy">Share your report</Link>
          </div>
          <ol>
            {SIGNS.map((s, i) => (
              <li key={s}><span>{String(i + 1).padStart(2, "0")}</span><span>{s}</span></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faq" className="white section">
        <div className="wrap faq">
          <div>
            <div className="eyebrow blue">FAQ</div>
            <h2 className="h2">Crypto scam questions, answered</h2>
          </div>
          <div>
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "96px 0", overflow: "hidden" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 40 }}>
          <div style={{ flex: "999 1 520px", minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(36px, 4.4vw, 64px)", lineHeight: 1.04, fontWeight: 300, letterSpacing: "-.035em" }}>
              Every report makes the next scam easier to spot.
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
              <Link href="#report" className="btn btn-cyan">Share your report</Link>
              <Link href="#check" className="btn btn-line-w">Check a wallet</Link>
            </div>
          </div>
          <div style={{ flex: "1 1 240px", minWidth: 0, maxWidth: 300 }}>
            <SmallOrb />
          </div>
        </div>
      </section>
    </>
  );
}
