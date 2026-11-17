"use client";

import { useActionState, useEffect } from "react";
import { subscribeNewsletter, type FormState } from "@/app/actions";
import { announceLead } from "@/components/ads/AdTags";
import { BotCheck } from "@/components/forms/BotCheck";

/**
 * Weekly scam alert sign-up. Used in the alerts section, in the home hero (compact) and on
 * ad landing pages, where a sign-up is reported to the ad platforms as a "newsletter" lead.
 */
export function NewsletterForm({ id = "nl-email", compact = false }: { id?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, { status: "idle" } as FormState);
  const eventId = state.status === "success" ? state.eventId : undefined;
  useEffect(() => announceLead(eventId), [eventId]);

  if (state.status === "success") {
    return <p className="form-msg ok" role="status" style={{ marginTop: compact ? 12 : 28, fontSize: compact ? 15 : 16 }}>{state.message}</p>;
  }
  return (
    <div className="on-dark">
      <form action={action} className="inline-form" style={{ marginTop: compact ? 10 : 28, maxWidth: 560 }} aria-label="Get the weekly scam alert">
        <div className="hp" aria-hidden="true">
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <label htmlFor={id} className="sr-only">Email address</label>
        <input id={id} name="email" type="email" autoComplete="email" required placeholder="you@email.com" className="field-dark" />
        <button type="submit" className="btn btn-cyan" disabled={pending}>{pending ? "…" : "Get alerts"}</button>
        <BotCheck action="newsletter" resetOn={state} />
      </form>
      {state.status === "error" && <p className="form-msg err" role="alert">{state.message}</p>}
      <p style={{ fontSize: 12.5, color: "#8a97c7", margin: "10px 0 0" }}>
        {compact ? "One short email a week. Unsubscribe any time." : "One email a week. No spam. We never sell your email. Unsubscribe any time."}
      </p>
    </div>
  );
}
