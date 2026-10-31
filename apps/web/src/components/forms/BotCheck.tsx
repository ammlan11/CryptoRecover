"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
      getResponse: (id: string) => string | undefined;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    // Inserted by our own nonce'd bundle, so 'strict-dynamic' in the CSP allows it.
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("bot check failed to load")); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Invisible bot check placed inside a form. Most people never see it; Cloudflare only
 * shows a checkbox when it's unsure. If someone submits before the check has finished,
 * the submit waits for it (up to 15 s) and then goes ahead.
 * `resetOn` should change after every server response, because each token works once.
 */
export function BotCheck({ action, resetOn }: { action: string; resetOn?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    const el = box.current;
    const form = el.closest("form");
    let cancelled = false;
    let waiting = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widget.current = window.turnstile.render(el, { sitekey: SITE_KEY, action, appearance: "interaction-only", size: "flexible" });
      })
      .catch(() => { /* the server will refuse the form with a clear message */ });

    function onSubmit(e: SubmitEvent) {
      const id = widget.current;
      const token = id && window.turnstile?.getResponse(id);
      if (token || !form) return;
      e.preventDefault(); // React skips the form action when the event is cancelled
      e.stopPropagation();
      if (waiting) return;
      waiting = true;
      const submitter = e.submitter as HTMLElement | null;
      const started = Date.now();
      const timer = setInterval(() => {
        const ready = widget.current && window.turnstile?.getResponse(widget.current);
        if (ready || Date.now() - started > 15_000) {
          clearInterval(timer);
          waiting = false;
          if (ready) form.requestSubmit(submitter instanceof HTMLButtonElement ? submitter : undefined);
        }
      }, 200);
    }
    form?.addEventListener("submit", onSubmit, true);
    return () => {
      cancelled = true;
      form?.removeEventListener("submit", onSubmit, true);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [action]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetOn]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="bot-check" />;
}
