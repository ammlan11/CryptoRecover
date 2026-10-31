/**
 * Placeholder until Phase 2 builds the approved home page design.
 */
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 680 }}>
        <p style={{ fontFamily: "var(--font-mono)", letterSpacing: ".08em", color: "var(--cyan)", fontSize: 13 }}>
          CRYPTO SCAM RESEARCH
        </p>
        <h1 style={{ fontWeight: 300, fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.05, margin: "12px 0 0" }}>
          Report a crypto scam. Help expose the pattern behind it.
        </h1>
        <p style={{ color: "#b9c3e6", fontSize: 18, lineHeight: 1.55, marginTop: 20 }}>
          Demo is being built. We will never ask for payment, a recovery fee or your seed phrase.
        </p>
      </div>
    </main>
  );
}
