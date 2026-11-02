"use client";

import { useActionState, useEffect, useRef } from "react";
import type { State } from "@/app/actions";

type Action = (prev: State, form: FormData) => Promise<State>;

/** Server-action form with pending state and result message (and a one-time link when given). */
export function Form({ action, children, className, reset }: { action: Action; children: React.ReactNode; className?: string; reset?: boolean }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as State);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reset && state.status === "success") ref.current?.reset();
  }, [state, reset]);
  return (
    <form ref={ref} action={formAction}>
      {/* Layout classes go on the fieldset, which holds the fields, so gaps apply between them. */}
      <fieldset disabled={pending} className={className} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>{children}</fieldset>
      {state.status !== "idle" && (
        <p className={`msg ${state.status}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
      {state.status === "success" && state.link && (
        <p className="once">
          <code>{typeof window !== "undefined" ? `${window.location.origin}${state.link}` : state.link}</code>
        </p>
      )}
    </form>
  );
}
