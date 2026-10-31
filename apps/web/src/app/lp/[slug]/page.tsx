import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SmallOrb } from "@/components/Orb";
import { StartReportForm } from "@/components/forms/StartReportForm";
import { AdTags } from "@/components/ads/AdTags";
import { CAMPAIGNS, getCampaign } from "@/content/campaigns";

/**
 * Ad landing pages: one goal (start a report), no site navigation, headline matching
 * the ad. Never indexed, so they don't compete with the SEO pages.
 */
export function generateStaticParams() {
  return CAMPAIGNS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const campaign = getCampaign((await params).slug);
  return {
    title: campaign?.headline.replace(/[“”]/g, "") ?? "Share your report",
    robots: { index: false, follow: false },
  };
}

function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10l4 4 8-8" fill="none" stroke="#3fd0e6" strokeWidth="2" />
    </svg>
  );
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const campaign = getCampaign((await params).slug);
  if (!campaign) notFound();

  return (
    <>
      <AdTags />
      <header className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "20px 0", flexWrap: "wrap" }}>
        <div className="pill" style={{ padding: "12px 20px", fontSize: 22, fontWeight: 700 }}>Kuro Trace</div>
        <span className="mono" style={{ fontSize: 12, color: "var(--on-dark-muted)" }}>Free · Confidential · No recovery fees, ever</span>
      </header>

      <main>
        <section className="wrap" style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center", padding: "40px 0 80px" }}>
          <div style={{ position: "absolute", left: "28%", top: "50%", width: 640, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
            <SmallOrb opacity={0.3} core={false} />
          </div>
          <div style={{ position: "relative", flex: "999 1 520px", minWidth: 0 }}>
            <div className="eyebrow">{campaign.eyebrow}</div>
            <h1 style={{ margin: "18px 0 0", fontSize: "clamp(40px, 5vw, 72px)", lineHeight: 1.03, fontWeight: 300, letterSpacing: "-.035em" }}>
              {campaign.headline}
            </h1>
            <p className="hero-sub" style={{ maxWidth: 560 }}>{campaign.sub}</p>
            <ul style={{ listStyle: "none", padding: "24px 0 0", margin: "32px 0 0", display: "grid", gap: 14, fontSize: 16, borderTop: "1px solid var(--line-dark)" }}>
              <li style={{ display: "flex", gap: 12, alignItems: "center" }}><Check />Free to report, in any country</li>
              <li style={{ display: "flex", gap: 12, alignItems: "center" }}><Check />Encrypted, and never published with your name</li>
              <li style={{ display: "flex", gap: 12, alignItems: "center" }}><Check />We never ask for money or your seed phrase</li>
            </ul>
          </div>
          <div style={{ position: "relative", flex: "1 1 400px", minWidth: 0, background: "#fff", color: "var(--ink)", borderRadius: 12, padding: 32 }}>
            <div className="card-tag">Step 1 of 3</div>
            <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-.02em", margin: "6px 0 16px" }}>Share how the scam worked</div>
            <StartReportForm variant="campaign" defaultScamType={campaign.defaultScamType} />
          </div>
        </section>

        <section className="light section" style={{ padding: "80px 0" }}>
          <div className="wrap">
            <h2 className="h2" style={{ fontSize: "clamp(30px, 3.4vw, 46px)", marginBottom: 32 }}>Sound familiar?</h2>
            <div className="grid-cards" style={{ marginTop: 0 }}>
              {campaign.quotes.map((q) => (
                <blockquote key={q} className="card" style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>&ldquo;{q}&rdquo;</blockquote>
              ))}
            </div>
            <p style={{ margin: "24px 0 0", color: "var(--ink-muted)", fontSize: 16 }}>{campaign.quotesNote}</p>
          </div>
        </section>

        <section className="white section" style={{ padding: "64px 0" }}>
          <div className="wrap faq">
            <div><h2 className="h2" style={{ fontSize: 34 }}>Before you start</h2></div>
            <div>
              <details open>
                <summary>Can you get my money back?</summary>
                <p>No. We&rsquo;re a research project, not a recovery service. Report the loss to your police and bank, and be wary of anyone offering recovery for a fee.</p>
              </details>
              <details>
                <summary>What do I need?</summary>
                <p>Whatever you have: screenshots, wallet addresses, transaction IDs, chats.</p>
              </details>
              <details>
                <summary>Who sees my report?</summary>
                <p>Our in-house team and private investigators. We never publish your name.</p>
              </details>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: "var(--navy-950)", color: "#9aa6d1", fontSize: 13, padding: "24px 0" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <span>© {new Date().getFullYear()} [Entity] · [Registered address]</span>
          <Link href="/privacy" style={{ color: "#c9d1ef" }}>Privacy notice</Link>
        </div>
      </footer>
    </>
  );
}
