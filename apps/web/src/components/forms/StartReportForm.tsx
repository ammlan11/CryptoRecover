"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { startReport, type FormState } from "@/app/actions";
import { BotCheck } from "@/components/forms/BotCheck";
import { announceLead } from "@/components/ads/AdTags";
import { LOSS_BAND_OPTIONS, SCAM_TYPE_OPTIONS, type ScamTypeValue } from "@/lib/options";

const initial: FormState = { status: "idle" };

/** First step of a report. Hero variant = one row; campaign variant = stacked with loss band and consent. */
export function StartReportForm({ variant, defaultScamType = "UNSURE" }: { variant: "hero" | "campaign"; defaultScamType?: ScamTypeValue }) {
  const [state, action, pending] = useActionState(startReport, initial);
  const id = variant;
  const eventId = state.status === "success" ? state.eventId : undefined;
  useEffect(() => announceLead(eventId), [eventId]);

  if (state.status === "success") {
    return (
      <div className={variant === "hero" ? "hero-form" : undefined} role="status">
        <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Thank you.</p>
        <p className="form-msg ok" style={{ marginTop: 6 }}>{state.message}</p>
      </div>
    );
  }

  const error = state.status === "error" ? state : null;
  const honeypot = (
    <div className="hp" aria-hidden="true">
      <label htmlFor={`${id}-website`}>Leave this empty</label>
      <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );

  if (variant === "hero") {
    return (
      <form action={action} className="hero-form" aria-label="Start your report" noValidate>
        <input type="hidden" name="source" value="HERO_FORM" />
        {honeypot}
        <div className="hero-form-row">
          <div>
            <label className="label" htmlFor="hero-type">What kind of scam?</label>
            <select id="hero-type" name="scamType" className="field" defaultValue={defaultScamType}>
              {SCAM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hero-email">Your email</label>
            <input
              id="hero-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@email.com"
              className="field"
              aria-invalid={error?.field === "email" || undefined}
              aria-describedby={error ? "hero-error" : undefined}
            />
          </div>
          <button type="submit" className="btn btn-navy" disabled={pending}>
            {pending ? "Saving…" : "Start my report →"}
          </button>
        </div>
        <BotCheck action="lead" resetOn={state} />
        {error && <p id="hero-error" className="form-msg err" role="alert">{error.message}</p>}
        <p className="fine">
          About 5 minutes · We don&rsquo;t recover money and never charge · <Link href="/privacy">Privacy notice</Link>
        </p>
      </form>
    );
  }

  return (
    <form action={action} aria-label="Share how the scam worked" noValidate style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="source" value="CAMPAIGN_FORM" />
      {honeypot}
      <div>
        <label className="label" htmlFor="lp-type">What happened?</label>
        <select id="lp-type" name="scamType" className="field" defaultValue={defaultScamType}>
          {SCAM_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="lp-loss">Roughly how much was lost?</label>
        <select id="lp-loss" name="lossBand" className="field" defaultValue="">
          <option value="" disabled>Choose one</option>
          {LOSS_BAND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="lp-email">Email for your reply</label>
        <input id="lp-email" name="email" type="email" autoComplete="email" required placeholder="you@email.com" className="field" aria-invalid={error?.field === "email" || undefined} />
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}>
        <input type="checkbox" name="consent" style={{ width: 18, height: 18, margin: 0, flex: "none" }} aria-invalid={error?.field === "consent" || undefined} />
        <span>
          I agree my report is used for scam research, as described in the <Link href="/privacy" style={{ textDecoration: "underline" }}>privacy notice</Link>.
        </span>
      </label>
      <BotCheck action="lead" resetOn={state} />
      {error && <p className="form-msg err" role="alert" style={{ margin: 0 }}>{error.message}</p>}
      <button type="submit" className="btn btn-navy" disabled={pending} style={{ minHeight: 52, width: "100%" }}>
        {pending ? "Saving…" : "Continue →"}
      </button>
      <p className="fine" style={{ textAlign: "center", margin: 0 }}>About 5 minutes · You can stop and finish later</p>
    </form>
  );
}
