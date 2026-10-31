"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/(account)/account/actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Wraps a server action form: disables inputs while saving, shows the result message,
 * and optionally clears the form after a success (messages, payments).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  encType,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.status === "success") ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {children}
      </fieldset>
      {state.status !== "idle" && (
        <p className={`form-msg ${state.status === "success" ? "ok" : "err"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
      {state.status === "success" && state.codes && (
        <div className="codes" role="region" aria-label="Recovery codes">
          <p style={{ margin: "0 0 10px", fontWeight: 500 }}>Save these recovery codes somewhere safe. Each works once if you lose your phone. They won't be shown again.</p>
          <ul>{state.codes.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
    </form>
  );
}
