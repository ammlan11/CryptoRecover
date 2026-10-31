"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ADS_CONSENT_MODE, ADS_ENABLED, CONSENT_COOKIE, GOOGLE_LEAD_SEND_TO, GOOGLE_TAG_ID, LEAD_EVENT, META_PIXEL_ID } from "@/lib/ads";

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readConsent(): "yes" | "no" | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(yes|no)`));
  return (m?.[1] as "yes" | "no" | undefined) ?? null;
}

function saveConsent(value: "yes" | "no") {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
}

function addScript(src: string) {
  // Inserted by our own nonce'd bundle: allowed by 'strict-dynamic' in the page's CSP.
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let loaded = false;
function loadTags() {
  if (loaded) return;
  loaded = true;
  if (META_PIXEL_ID && !window.fbq) {
    const fbq: Fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = window._fbq = fbq;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", META_PIXEL_ID);
    fbq("track", "PageView");
  }
  if (GOOGLE_TAG_ID && !window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js expects the Arguments object itself.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_TAG_ID)}`);
    window.gtag("js", new Date());
    window.gtag("config", GOOGLE_TAG_ID, { anonymize_ip: true });
  }
}

/** Sends a "Lead" conversion. The event id matches the server-side event, so Meta counts it once. */
function trackLead(eventId: string) {
  window.fbq?.("track", "Lead", {}, { eventID: eventId });
  if (window.gtag) {
    window.gtag("event", "generate_lead", { transaction_id: eventId });
    if (GOOGLE_LEAD_SEND_TO) window.gtag("event", "conversion", { send_to: GOOGLE_LEAD_SEND_TO, transaction_id: eventId });
  }
}

/**
 * Ad measurement for landing pages: asks first (unless consent mode is "implied"),
 * then loads the Meta Pixel and/or Google tag and reports started reports as leads.
 * Renders nothing when no ad IDs are configured.
 */
export function AdTags() {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    const consent = ADS_CONSENT_MODE === "implied" ? "yes" : readConsent();
    if (consent === "yes") loadTags();
    else if (consent === null) setAsk(true);

    const onLead = (e: Event) => {
      const id = (e as CustomEvent<{ eventId?: string }>).detail?.eventId;
      if (id && loaded) trackLead(id);
    };
    window.addEventListener(LEAD_EVENT, onLead);
    return () => window.removeEventListener(LEAD_EVENT, onLead);
  }, []);

  if (!ADS_ENABLED || !ask) return null;
  const choose = (value: "yes" | "no") => {
    saveConsent(value);
    setAsk(false);
    if (value === "yes") loadTags();
  };
  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Ad measurement cookies">
      <p>
        Can we use cookies from Meta and Google to measure which ads bring people here? It helps us reach more scam
        victims. Nothing you write in a report is ever shared. <Link href="/privacy">Privacy notice</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-line-w" onClick={() => choose("no")}>No thanks</button>
        <button type="button" className="btn btn-cyan" onClick={() => choose("yes")}>Allow</button>
      </div>
    </div>
  );
}

/** Called by the lead form after a real (non-bot) success. */
export function announceLead(eventId: string | undefined) {
  if (eventId) window.dispatchEvent(new CustomEvent(LEAD_EVENT, { detail: { eventId } }));
}
