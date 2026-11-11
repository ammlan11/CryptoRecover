import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { SCAMS, getScam } from "@/content/scams";
import { siteUrl } from "@/lib/site";
import { ReportLink } from "@/components/ReportLink";

export function generateStaticParams() {
  return SCAMS.map((s) => ({ slug: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const scam = getScam((await params).slug);
  if (!scam) return {};
  return {
    title: { absolute: `${scam.seoTitle} | Kuro Trace` },
    description: scam.seoDescription,
    alternates: { canonical: `/scams/${scam.slug}` },
    openGraph: { title: scam.seoTitle, description: scam.seoDescription, type: "article" },
  };
}

export default async function ScamPage({ params }: { params: Promise<{ slug: string }> }) {
  const scam = getScam((await params).slug);
  if (!scam) notFound();
  const others = SCAMS.filter((s) => s.slug !== scam.slug).slice(0, 3);
  const url = `${siteUrl}/scams/${scam.slug}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: scam.seoTitle,
              description: scam.seoDescription,
              mainEntityOfPage: url,
              publisher: { "@id": `${siteUrl}/#org` },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
                { "@type": "ListItem", position: 2, name: "Crypto scams", item: `${siteUrl}/scams` },
                { "@type": "ListItem", position: 3, name: scam.name, item: url },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: scam.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ],
        }}
      />
      <article className="light section">
        <div className="wrap article">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> / <Link href="/scams">Crypto scams</Link> / <span aria-current="page">{scam.name}</span>
          </nav>
          <div className={`card-tag${scam.danger ? " danger" : ""}`} style={{ marginTop: 28 }}>{scam.danger ? "● " : ""}{scam.tag}</div>
          <h1>{scam.name}</h1>
          <p className="lead">{scam.intro}</p>

          <h2>How the scam unfolds</h2>
          <ol className="timeline">
            {scam.stages.map((stage) => (
              <li key={stage.title}>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </li>
            ))}
          </ol>

          <h2>Red flags</h2>
          <ul className="flags">
            {scam.redFlags.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>

          <h2>If it reached you</h2>
          <ol style={{ color: "var(--ink-muted)", lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
            <li>Stop sending money, including any &ldquo;fee&rdquo; to release funds.</li>
            <li>Save screenshots, wallet addresses, transaction IDs and chats.</li>
            <li>Report it to your local police and the exchange or bank you paid from.</li>
            <li>Share what happened with us so investigators can warn others.</li>
          </ol>
          <div className="cta-band" style={{ marginTop: 32 }}>
            <div>
              <strong>Seen this scam? Put it on the record.</strong>
              <span style={{ fontSize: 15 }}>Free · About 5 minutes · We don&rsquo;t recover money and never charge</span>
            </div>
            <ReportLink className="btn btn-navy" />
          </div>

          <h2>Questions</h2>
          <div className="faq" style={{ display: "block" }}>
            <div>
              {scam.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        <div className="wrap" style={{ marginTop: 64 }}>
          <h2 className="h2" style={{ fontSize: 32 }}>Other scams we&rsquo;re tracking</h2>
          <div className="grid-cards">
            {others.map((s) => (
              <Link key={s.slug} href={`/scams/${s.slug}`} className="card">
                <div className="card-tag">{s.tag}</div>
                <h3>{s.name}</h3>
                <p>{s.card}</p>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
