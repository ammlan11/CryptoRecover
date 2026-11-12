import Link from "next/link";

/** Who runs Kuro Trace, used on the legal pages. Update here if the details change. */
export const OPERATOR = {
  name: "Kuro Trace",
  address: "Flaxhome, 8 Broadway, Duffield, Derbyshire, England, DE56 4BT",
  email: "wesupport@kurotrace.com",
  updated: "12 November 2026",
};

/** Layout for the privacy policy and terms: title, date, "key points" box, numbered sections, contents. */
export function LegalPage({
  title,
  intro,
  keyPoints,
  sections,
}: {
  title: string;
  intro: React.ReactNode;
  keyPoints: React.ReactNode[];
  sections: { id: string; title: string; body: React.ReactNode }[];
}) {
  return (
    <section className="light section">
      <div className="wrap article legal">
        <div className="eyebrow" style={{ color: "var(--ink-muted)" }}>Last updated {OPERATOR.updated}</div>
        <h1>{title}</h1>
        <div className="lead">{intro}</div>

        <aside className="legal-key" aria-label="Key points">
          <h2>The key points</h2>
          <ul>{keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </aside>

        <nav className="legal-toc" aria-label="Contents">
          <span className="mono">Contents</span>
          <ol>{sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="legal-section">
            <h2><span className="legal-num">{i + 1}.</span> {s.title}</h2>
            {s.body}
          </section>
        ))}

        <p className="legal-foot">
          Questions about this page? Email <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> or write to {OPERATOR.name}, {OPERATOR.address}.
          See also our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Use</Link>.
        </p>
      </div>
    </section>
  );
}
