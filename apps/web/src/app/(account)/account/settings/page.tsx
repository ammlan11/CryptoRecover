import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@kurotrace/db";
import { ActionForm } from "@/components/account/ActionForm";
import { requireUser } from "@/lib/session";
import { userEmail } from "@/server/accounts";
import { maskPhone, userPhone } from "@/server/phone";
import { changePasswordAction, deleteAccountAction, disableTwoStepAction, revokeSessionAction, signOutEverywhereAction } from "../actions";

export const metadata: Metadata = { title: "Settings" };

function describeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function SettingsPage() {
  const session = await requireUser();
  const sessions = await prisma.userSession.findMany({ where: { userId: session.userId }, orderBy: { lastSeenAt: "desc" } });
  const phone = userPhone(await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { id: true, phoneEnc: true } }));
  const remaining = session.user.totpEnabledAt ? await prisma.userRecoveryCode.count({ where: { userId: session.userId, usedAt: null } }) : 0;

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <div className="settings">
        <section className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>Email</h2>
          <p style={{ margin: 0 }}>{userEmail(session.user)} {session.user.emailVerifiedAt ? <span className="status status-ok">Confirmed</span> : <span className="status status-warn">Not confirmed</span>}</p>
        </section>

        <section className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>Mobile number</h2>
          <p style={{ marginTop: 0 }}>{phone ? maskPhone(phone) : "None"} <span className="status status-ok">Confirmed</span> We text a code to this number each time you log in.</p>
          <Link href="/account/settings/phone" className="btn btn-line">Change number</Link>
        </section>

        <section className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>Authenticator app (optional, stronger)</h2>
          {session.user.totpEnabledAt ? (
            <>
              <p style={{ marginTop: 0 }}><span className="status status-ok">On</span> When you log in you can use a code from your authenticator app instead of the text message. {remaining} recovery {remaining === 1 ? "code" : "codes"} left.</p>
              <ActionForm action={disableTwoStepAction} className="stack">
                <div>
                  <label className="label" htmlFor="pw-2fa">Your password, to turn it off</label>
                  <input id="pw-2fa" name="password" type="password" autoComplete="current-password" required className="field" style={{ maxWidth: 360 }} />
                </div>
                <button type="submit" className="btn btn-line danger-btn" style={{ justifySelf: "start" }}>Turn off two-step sign-in</button>
              </ActionForm>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>Text messages can be intercepted if someone takes over your phone number. An authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others) can&rsquo;t be, and gives you recovery codes in case you lose your phone.</p>
              <Link href="/account/settings/two-step" className="btn btn-navy">Set up two-step sign-in</Link>
            </>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>Change password</h2>
          <ActionForm action={changePasswordAction} className="stack" resetOnSuccess>
            <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="field" /></div>
            <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field" /><p className="fine">At least 12 characters.</p></div>
            <div><label className="label" htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" /></div>
            <button type="submit" className="btn btn-navy" style={{ justifySelf: "start" }}>Change password</button>
          </ActionForm>
        </section>

        <section className="panel">
          <div className="row-between">
            <h2 className="section-title" style={{ margin: 0 }}>Where you&rsquo;re signed in</h2>
            {sessions.length > 1 && (
              <form action={signOutEverywhereAction}><button type="submit" className="link-btn">Sign out everywhere else</button></form>
            )}
          </div>
          <ul className="item-list" style={{ marginTop: 16 }}>
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <strong style={{ fontWeight: 500 }}>{describeAgent(s.userAgent)}</strong>
                  {s.id === session.id && <span className="status status-info" style={{ marginLeft: 8 }}>This device</span>}
                  <div className="fine" style={{ margin: "4px 0 0" }}>Last active {s.lastSeenAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</div>
                </div>
                {s.id !== session.id && (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button type="submit" className="link-btn">Sign out</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>Delete your account</h2>
          <p className="fine" style={{ marginTop: 0 }}>Permanently deletes your account, all your reports, messages and evidence files. Scam patterns already published stay published, without any link to you.</p>
          <ActionForm action={deleteAccountAction} className="stack">
            <div><label className="label" htmlFor="pw-del">Your password</label><input id="pw-del" name="password" type="password" autoComplete="current-password" required className="field" style={{ maxWidth: 360 }} /></div>
            <label className="check"><input type="checkbox" name="confirm" required /><span>I understand this can&rsquo;t be undone.</span></label>
            <button type="submit" className="btn btn-line danger-btn" style={{ justifySelf: "start" }}>Delete my account</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
