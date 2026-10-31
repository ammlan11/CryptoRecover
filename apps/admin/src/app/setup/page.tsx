import QRCode from "qrcode";
import { SetupForm } from "@/components/AuthForms";
import { ROLE_LABEL } from "@/lib/permissions";
import { inviteAuthenticator } from "@/server/staff-auth";

export const metadata = { title: "Set up your account" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const setup = await inviteAuthenticator(token);
  if (!setup) {
    return (
      <main className="auth"><div className="auth-card"><h1>Link expired</h1><p className="hint">Setup links work once, for 48 hours. Ask the owner for a new one.</p></div></main>
    );
  }
  const qr = await QRCode.toString(setup.uri, { type: "svg", margin: 1, width: 200, color: { dark: "#020b33", light: "#ffffff" } });
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Set up your account</h1>
        <p className="auth-tag">{setup.username.toUpperCase()} · {ROLE_LABEL[setup.role].toUpperCase()}</p>
        <p className="hint" style={{ marginTop: 0 }}>1. Scan this code with an authenticator app (or type the key).</p>
        {/* SVG generated server-side by the qrcode library from our own data. */}
        <div className="qr" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="code" style={{ marginTop: 0 }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
        <p className="hint">2. Choose a password and enter the current code.</p>
        <SetupForm token={token} />
      </div>
    </main>
  );
}
