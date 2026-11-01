"use client";

import { useActionState, useState } from "react";
import { phoneAction, type PhoneState } from "@/app/phone-actions";

const idle: PhoneState = { status: "idle" };

/**
 * Confirm (or change) the mobile number: type the number, get a text, type the code.
 * `changing` adds a password box, because swapping the number is a security change.
 */
export function PhoneForm({ changing = false }: { changing?: boolean }) {
  const [state, action, pending] = useActionState(phoneAction, idle);
  const [phone, setPhone] = useState("");
  const onCodeStep = state.status === "code" || (state.status === "error" && state.stage === "code");

  if (state.status === "done") return <p className="form-msg ok" role="status">{state.message}</p>;

  if (onCodeStep) {
    const masked = state.status === "code" ? state.masked : "";
    return (
      <div className="stack">
        <form action={action} className="stack">
          <input type="hidden" name="intent" value="confirm" />
          <p className="fine" style={{ margin: 0 }}>We texted a 6-digit code to <strong>{masked}</strong>. It works for 10 minutes.</p>
          <div>
            <label className="label" htmlFor="code">Code from the text message</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} autoFocus className="field" style={{ fontFamily: "var(--font-mono)", letterSpacing: ".2em", fontSize: 20 }} />
          </div>
          {state.status === "code" && state.message && <p className="form-msg err" role="alert">{state.message}</p>}
          <button type="submit" className="btn btn-navy" disabled={pending} style={{ width: "100%", minHeight: 52 }}>{pending ? "Checking…" : "Confirm number"}</button>
        </form>
        <form action={action}>
          <input type="hidden" name="intent" value="send" />
          <input type="hidden" name="phone" value={phone} />
          <p className="fine" style={{ textAlign: "center", margin: 0 }}>
            No text after a minute?{" "}
            <button type="submit" className="link-button" disabled={pending}>Send a new code</button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="stack">
      <input type="hidden" name="intent" value="send" />
      <div>
        <label className="label" htmlFor="phone">{changing ? "New mobile number" : "Mobile number"}</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          maxLength={40}
          className="field"
          placeholder="+94 77 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="fine" style={{ margin: "6px 0 0" }}>Start with your country code. We only use it to text you sign-in codes, never for marketing.</p>
      </div>
      {changing && (
        <div>
          <label className="label" htmlFor="password">Your password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
      )}
      {state.status === "error" && <p className="form-msg err" role="alert">{state.message}</p>}
      <button type="submit" className="btn btn-navy" disabled={pending} style={{ width: "100%", minHeight: 52 }}>{pending ? "Sending…" : "Text me a code"}</button>
    </form>
  );
}
