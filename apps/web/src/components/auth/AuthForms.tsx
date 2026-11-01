"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  continueAction,
  forgotAction,
  resendLoginCodeAction,
  loginAction,
  resetAction,
  signupAction,
  twoStepAction,
  type AuthState,
} from "@/app/(auth)/actions";
import { BotCheck } from "@/components/forms/BotCheck";

const idle: AuthState = { status: "idle" };

function Message({ state }: { state: AuthState }) {
  if (state.status === "idle") return null;
  return (
    <p className={`form-msg ${state.status === "success" ? "ok" : "err"}`} role={state.status === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" className="btn btn-navy" disabled={pending} style={{ width: "100%", minHeight: 52 }}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

/** Mobile number with country code, required on every account so the team can reach the reporter. */
export function PhoneField({ label = "Mobile number", defaultValue }: { label?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="label" htmlFor="phone">{label}</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} className="field" placeholder="+94 77 123 4567" defaultValue={defaultValue} />
      <p className="fine" style={{ margin: "6px 0 0" }}>Start with your country code. Only our research team can see it, to contact you about your report.</p>
    </div>
  );
}

const PasswordHint = () => <p className="fine" style={{ margin: "6px 0 0" }}>At least 12 characters. A short phrase you'll remember works well.</p>;

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, idle);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <BotCheck action="login" resetOn={state} />
      <Message state={state} />
      <Submit pending={pending}>Log in</Submit>
      <p className="fine" style={{ textAlign: "center" }}>
        <Link href="/forgot-password">Forgot your password?</Link> · <Link href="/signup">Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, idle);
  if (state.status === "success") return <Message state={state} />;
  return (
    <form action={action} className="stack">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field" />
        <PasswordHint />
      </div>
      <PhoneField />
      <label className="check">
        <input type="checkbox" name="terms" required />
        <span>I agree to the <Link href="/privacy">privacy notice</Link>.</span>
      </label>
      <BotCheck action="signup" resetOn={state} />
      <Message state={state} />
      <Submit pending={pending}>Create account</Submit>
      <p className="fine" style={{ textAlign: "center" }}>Already have an account? <Link href="/login">Log in</Link></p>
    </form>
  );
}

export function TwoStepForm({ next, hasApp }: { next?: string; hasApp: boolean }) {
  const [state, action, pending] = useActionState(twoStepAction, idle);
  const [resent, resend, resending] = useActionState(resendLoginCodeAction, idle);
  const label = hasApp ? "Code from the email or your authenticator app" : "Code from the email";
  return (
    <div className="stack">
      <form action={action} className="stack">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="code">{label}</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={20} autoFocus className="field" style={{ fontFamily: "var(--font-mono)", letterSpacing: ".2em", fontSize: 20 }} />
        </div>
        <Message state={state} />
        <Submit pending={pending}>Verify</Submit>
      </form>
      <form action={resend}>
        <Message state={resent} />
        <p className="fine" style={{ textAlign: "center", margin: 0 }}>
          No email after a minute? Check spam, or <button type="submit" className="link-button" disabled={resending}>send a new code</button>
        </p>
      </form>
      {hasApp && <p className="fine" style={{ textAlign: "center", margin: 0 }}>Lost your phone? You can also type one of your recovery codes.</p>}
      <p className="fine" style={{ textAlign: "center", margin: 0 }}><Link href="/login">Start again</Link></p>
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, idle);
  if (state.status === "success") return <Message state={state} />;
  return (
    <form action={action} className="stack">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <BotCheck action="forgot" resetOn={state} />
      <Message state={state} />
      <Submit pending={pending}>Send reset link</Submit>
      <p className="fine" style={{ textAlign: "center" }}><Link href="/login">Back to log in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, idle);
  if (state.status === "success") {
    return (
      <div className="stack">
        <Message state={state} />
        <Link href="/login" className="btn btn-navy" style={{ width: "100%" }}>Log in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field" />
        <PasswordHint />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Type it again</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
      </div>
      <Message state={state} />
      <Submit pending={pending}>Change password</Submit>
    </form>
  );
}

export function ContinueForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(continueAction, idle);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <div>
        <span className="label">Email</span>
        <p style={{ margin: 0, fontWeight: 500 }}>{email} <span style={{ color: "#1f7a35", fontSize: 13 }}>✓ confirmed</span></p>
      </div>
      <div>
        <label className="label" htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field" />
        <PasswordHint />
      </div>
      <PhoneField />
      <label className="check">
        <input type="checkbox" name="terms" required />
        <span>I agree to the <Link href="/privacy">privacy notice</Link>.</span>
      </label>
      <Message state={state} />
      <Submit pending={pending}>Continue to my report →</Submit>
    </form>
  );
}
