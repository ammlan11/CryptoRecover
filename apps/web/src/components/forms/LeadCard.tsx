"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { protectSignup, type FormState } from "@/app/actions";
import { announceLead } from "@/components/ads/AdTags";
import { PhoneField } from "@/components/auth/PhoneField";
import { BotCheck } from "@/components/forms/BotCheck";
import { StartReportForm } from "@/components/forms/StartReportForm";
import type { ScamTypeValue } from "@/lib/options";

type Tab = "protect" | "report";

/**
 * The lead card on the ad landing pages: "Keep me protected" (most visitors haven't been
 * scammed) or "I've seen a scam" (the first step of a report). Both count as a lead.
 * Mobile first: the protect form fits one phone screen, button included.
 */
export function LeadCard({ defaultScamType, phoneCountry = "AE" }: { defaultScamType: ScamTypeValue; phoneCountry?: string }) {
  const [tab, setTab] = useState<Tab>("protect");
  return (
    <div className="lead-card">
      <h2 className="lead-card-title">How can we help?</h2>
      <div className="lead-tabs" role="tablist" aria-label="How can we help?">
        {(
          [
            ["protect", "Keep me protected"],
            ["report", "I've seen a scam"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className={`lead-tab${tab === key ? " on" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Both panels stay mounted so switching tabs never loses what was typed. */}
      <div id="panel-protect" role="tabpanel" aria-labelledby="tab-protect" hidden={tab !== "protect"}>
        <ProtectForm phoneCountry={phoneCountry} />
      </div>
      <div id="panel-report" role="tabpanel" aria-labelledby="tab-report" hidden={tab !== "report"}>
        <StartReportForm variant="campaign" defaultScamType={defaultScamType} phoneCountry={phoneCountry} />
      </div>
    </div>
  );
}

function ProtectForm({ phoneCountry }: { phoneCountry: string }) {
  const [state, action, pending] = useActionState(protectSignup, { status: "idle" } as FormState);
  const [hasPhone, setHasPhone] = useState(false);
  const eventId = state.status === "success" ? state.eventId : undefined;
  useEffect(() => announceLead(eventId), [eventId]);

  if (state.status === "success") {
    return (
      <div role="status" style={{ padding: "8px 0" }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Thank you.</p>
        <p className="form-msg ok" style={{ marginTop: 6 }}>{state.message}</p>
      </div>
    );
  }
  const error = state.status === "error" ? state : null;
  return (
    <form action={action} aria-label="Keep me protected" noValidate className="lead-form">
      <div className="hp" aria-hidden="true">
        <label htmlFor="protect-website">Leave this empty</label>
        <input id="protect-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="protect-email">Email</label>
        <input id="protect-email" name="email" type="email" autoComplete="email" required placeholder="you@email.com" className="field" aria-invalid={error?.field === "email" || undefined} />
      </div>
      <PhoneField label="Mobile number (optional)" required={false} compact idPrefix="protect-" defaultCountry={phoneCountry} help={null} onNumberChange={setHasPhone} />
      <label className={`check${hasPhone ? "" : " disabled"}`} style={{ fontSize: 14 }}>
        <input type="checkbox" name="whatsappOptIn" disabled={!hasPhone} />
        <span>Send me scam alerts on WhatsApp</span>
      </label>
      <BotCheck action="lead" resetOn={state} />
      {error && <p className="form-msg err" role="alert" style={{ margin: 0 }}>{error.message}</p>}
      <button type="submit" className="btn btn-navy" disabled={pending} style={{ minHeight: 52, width: "100%" }}>
        {pending ? "Sending…" : "Send me the free checklist"}
      </button>
      <p className="fine" style={{ margin: 0 }}>
        We&rsquo;ll never ask for money, passwords or wallet keys. We only contact you if you tick a box above.{" "}
        <Link href="/privacy">Privacy Policy</Link>
      </p>
    </form>
  );
}
