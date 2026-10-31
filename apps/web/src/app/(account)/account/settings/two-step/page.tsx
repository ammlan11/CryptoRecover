import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@demo/db";
import { totpUri } from "@demo/core/totp";
import { ActionForm } from "@/components/account/ActionForm";
import { decryptText } from "@/lib/server-crypto";
import { requireUser } from "@/lib/session";
import { beginTwoStepSetup, userEmail } from "@/server/accounts";
import { confirmTwoStepAction } from "../../actions";

export const metadata: Metadata = { title: "Set up two-step sign-in", referrer: "no-referrer" };

export default async function TwoStepSetupPage() {
  const session = await requireUser();
  if (session.user.totpEnabledAt) redirect("/account/settings");

  // Reuse a pending (unconfirmed) secret so refreshing the page doesn't invalidate a scanned code.
  const stored = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { totpSecretEnc: true } });
  const pendingSecret = stored.totpSecretEnc ? decryptText(stored.totpSecretEnc, `user:${session.userId}:totp`) : null;
  const pending = pendingSecret ? { secret: pendingSecret, uri: totpUri(pendingSecret, userEmail(session.user)) } : null;
  const setup = pending ?? (await beginTwoStepSetup(session.userId));
  if (!setup) redirect("/account/settings");
  const qr = await QRCode.toString(setup.uri, { type: "svg", margin: 1, width: 200, color: { dark: "#020b33", light: "#ffffff" } });

  return (
    <div className="panel narrow">
      <h1 className="page-title" style={{ fontSize: 30 }}>Set up two-step sign-in</h1>
      <ol className="setup-steps">
        <li>Open your authenticator app and add a new account.</li>
        <li>
          Scan this code, or type the key below.
          {/* SVG generated server-side by the qrcode library from our own data. */}
          <div className="qr" aria-label="QR code for your authenticator app" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
          <code className="code-chip" style={{ fontSize: 14, letterSpacing: ".08em" }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
        </li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <ActionForm action={confirmTwoStepAction} className="stack">
        <div>
          <label className="label" htmlFor="code">6-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required maxLength={7} className="field" style={{ maxWidth: 220, fontFamily: "var(--font-mono)", fontSize: 20, letterSpacing: ".2em" }} />
        </div>
        <button type="submit" className="btn btn-navy" style={{ justifySelf: "start" }}>Turn on</button>
      </ActionForm>
      <p className="fine" style={{ marginTop: 20 }}><Link href="/account/settings">Back to settings</Link></p>
    </div>
  );
}
