import Link from "next/link";
import { prisma } from "@kurotrace/db";
import { Form } from "@/components/Form";
import { AddKey } from "@/components/SecurityKeys";
import { fmt, fmtDay } from "@/lib/labels";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireStaff } from "@/lib/session";
import { keysRequiredFor } from "@/server/security-keys";
import { recentlyReauthenticated } from "@/server/staff-auth";
import { passwordAction, removeKeyAction } from "../../actions";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const { staff, session } = await requireStaff();
  const keys = await prisma.webAuthnKey.findMany({ where: { staffId: staff.id }, orderBy: { createdAt: "asc" } });
  const fresh = recentlyReauthenticated(session);
  const keyOnly = keysRequiredFor(keys.length);
  return (
    <>
      <h1 className="title">My account</h1>
      <p className="hint">{staff.username} · {ROLE_LABEL[staff.role]}. To replace your authenticator app, ask the owner to reset your account.</p>

      <section className="card" style={{ marginTop: 20, maxWidth: 720 }}>
        <h2 className="sub">Security keys and passkeys</h2>
        <p className="hint" style={{ marginTop: -4 }}>
          A hardware key (such as a YubiKey) or a passkey on your phone or laptop. It only works on the real admin address, so it
          can&rsquo;t be phished. Register two, in case you lose one.
          {keyOnly && " On this server, once you have a key, sign-in by authenticator code is switched off for you."}
        </p>
        {keys.length > 0 && (
          <ul className="list">
            {keys.map((k) => (
              <li key={k.id}>
                <span>
                  <strong>{k.label}</strong>
                  <span className="hint"> · added {fmtDay(k.createdAt)} · {k.lastUsedAt ? `last used ${fmt(k.lastUsedAt)}` : "not used yet"}</span>
                </span>
                {fresh && (
                  <Form action={removeKeyAction}>
                    <input type="hidden" name="keyId" value={k.id} />
                    <button type="submit" className="btn btn-line btn-small">Remove</button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
        {fresh ? (
          <AddKey />
        ) : (
          <p style={{ margin: "12px 0 0" }}>
            <Link className="btn btn-line btn-small" href="/reauth?next=/account">Confirm it&rsquo;s you to add or remove keys</Link>
          </p>
        )}
      </section>

      <section className="card" style={{ marginTop: 20, maxWidth: 560 }}>
        <h2 className="sub">Change password</h2>
        <Form action={passwordAction} className="stack" reset>
          <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="field" /></div>
          <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} className="field" /></div>
          <div><label className="label" htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" /></div>
          <button type="submit" className="btn btn-primary" style={{ justifySelf: "start" }}>Change password</button>
        </Form>
      </section>
    </>
  );
}
