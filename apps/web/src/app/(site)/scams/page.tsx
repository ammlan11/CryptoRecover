import type { Metadata } from "next";
import Link from "next/link";
import { SCAMS } from "@/content/scams";

export const metadata: Metadata = {
  title: "Types of Crypto Scams and How They Work",
  description:
    "Pig butchering, fake trading apps, Telegram brokers, recovery scams, wallet drainers and impersonation: how each crypto scam works and the warning signs.",
  alternates: { canonical: "/scams" },
};

export default function ScamsIndex() {
  return (
    <section className="light section">
      <div className="wrap">
        <div className="eyebrow blue">Crypto scam playbooks</div>
        <h1 className="h2" style={{ maxWidth: 860 }}>Types of crypto scams and how they work</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: 18, lineHeight: 1.6, maxWidth: 720, marginTop: 16 }}>
          Each playbook walks through how the scam unfolds, the red flags to watch for, and what to do if it reaches you.
        </p>
        <div className="grid-cards">
          {SCAMS.map((s) => (
            <Link key={s.slug} href={`/scams/${s.slug}`} className="card">
              <div className={`card-tag${s.danger ? " danger" : ""}`}>{s.danger ? "● " : ""}{s.tag}</div>
              <h2 style={{ fontSize: 24, fontWeight: 500, margin: "12px 0 8px" }}>{s.name}</h2>
              <p>{s.card}</p>
              <span className="more">Read the playbook →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
