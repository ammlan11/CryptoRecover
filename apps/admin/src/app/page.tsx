/**
 * Placeholder. Phase 4 adds staff sign-in (password + hardware key or TOTP),
 * the reports queue and the audit log viewer.
 */
export default function AdminHome() {
  return (
    <main style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ background: "#020b33", color: "#fff", width: 240, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Demo</div>
        <div style={{ color: "#3fd0e6", fontSize: 11, letterSpacing: ".1em", marginTop: 4 }}>ADMIN TERMINAL</div>
      </aside>
      <section style={{ padding: 40 }}>
        <h1 style={{ fontWeight: 300, fontSize: 36, margin: 0 }}>Admin terminal</h1>
        <p style={{ color: "#4a5375", marginTop: 12 }}>
          You reached this page from an allow-listed IP. Staff sign-in arrives in Phase 4.
        </p>
      </section>
    </main>
  );
}
