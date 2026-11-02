"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

const LINKS = [
  { href: "/scams", label: "Crypto scams" },
  { href: "/#check", label: "Check a wallet" },
  { href: "/#alerts", label: "Scam alerts" },
  { href: "/#faq", label: "FAQ" },
];

/** Phone navigation: a "Menu" button that opens a panel with large, clear links. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className="menu-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
        {open ? "Close" : "Menu"}
      </button>
      <div id={id} className="menu-panel" hidden={!open}>
        <nav aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close} className="menu-link">
              {l.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
        <div className="menu-actions">
          <Link href="/login" onClick={close} className="btn btn-line">Log in</Link>
          <Link href="/#report" onClick={close} className="btn btn-cyan">Share your report</Link>
        </div>
      </div>
    </>
  );
}
