"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type FormState } from "@/app/actions";
import { BotCheck } from "@/components/forms/BotCheck";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, { status: "idle" } as FormState);
  if (state.status === "success") {
    return <p className="form-msg ok" role="status" style={{ marginTop: 28, fontSize: 16 }}>{state.message}</p>;
  }
  return (
    <div className="on-dark">
      <form action={action} className="inline-form" style={{ marginTop: 28, maxWidth: 560 }}>
        <div className="hp" aria-hidden="true">
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <input id="nl-email" name="email" type="email" autoComplete="email" required placeholder="you@email.com" className="field-dark" />
        <button type="submit" className="btn btn-cyan" disabled={pending}>{pending ? "…" : "Get alerts"}</button>
        <BotCheck action="newsletter" resetOn={state} />
      </form>
      {state.status === "error" && <p className="form-msg err" role="alert">{state.message}</p>}
      <p style={{ fontSize: 12.5, color: "#8a97c7", margin: "10px 0 0" }}>One email a week. No spam. We never sell your email. Unsubscribe any time.</p>
    </div>
  );
}
