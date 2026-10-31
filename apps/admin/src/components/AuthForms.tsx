"use client";

import { Form } from "./Form";
import { loginAction, reauthAction, setupAction } from "@/app/actions";

export function LoginForm() {
  return (
    <Form action={loginAction} className="stack">
      <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required className="field" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} className="field" style={{ fontFamily: "var(--font-mono)", letterSpacing: ".2em", fontSize: 18 }} /></div>
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Sign in</button>
    </Form>
  );
}

export function SetupForm({ token }: { token: string }) {
  return (
    <Form action={setupAction} className="stack">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="password">Choose a password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className="field" /><p className="hint">At least 12 characters.</p></div>
      <div><label className="label" htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" /></div>
      <div><label className="label" htmlFor="code">6-digit code from your authenticator app</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} className="field" style={{ fontFamily: "var(--font-mono)", letterSpacing: ".2em", fontSize: 18 }} /></div>
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Activate my account</button>
    </Form>
  );
}

export function ReauthForm({ next }: { next: string }) {
  return (
    <Form action={reauthAction} className="stack">
      <input type="hidden" name="next" value={next} />
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} className="field" style={{ fontFamily: "var(--font-mono)", letterSpacing: ".2em", fontSize: 18 }} /></div>
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Confirm</button>
    </Form>
  );
}
