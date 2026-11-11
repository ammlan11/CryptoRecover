"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Scrolls to the "Start my report" form and puts the cursor in the email box. */
function goToStartForm() {
  const form = document.getElementById("start");
  if (!form) return false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  const email = form.querySelector<HTMLInputElement>("input[type=email]");
  // Focus after the scroll so phones don't jump; preventScroll keeps the smooth scroll.
  window.setTimeout(() => email?.focus({ preventScroll: true }), 450);
  return true;
}

/**
 * Every "Share your report" button. On the home page it brings the report form into view
 * and focuses the email box (the form is often already on screen, so a plain #anchor link
 * looked like it did nothing). From other pages it opens the home page at the form.
 */
export function ReportLink({ className, children = "Share your report", onNavigate }: { className?: string; children?: React.ReactNode; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <Link
      href="/#start"
      className={className}
      onClick={(e) => {
        onNavigate?.();
        if (pathname === "/" && goToStartForm()) {
          e.preventDefault();
          window.history.replaceState(null, "", "#start");
        }
      }}
    >
      {children}
    </Link>
  );
}

/** On the home page: arriving at /#start (or the old /#report) focuses the form. */
export function FocusStartForm() {
  useEffect(() => {
    if (window.location.hash === "#start" || window.location.hash === "#report") goToStartForm();
  }, []);
  return null;
}
