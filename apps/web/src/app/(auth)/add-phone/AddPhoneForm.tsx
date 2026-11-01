"use client";

import { useActionState } from "react";
import { PhoneField } from "@/components/auth/AuthForms";
import { addPhoneAction, type PhoneState } from "@/app/phone-actions";

export function AddPhoneForm() {
  const [state, action, pending] = useActionState(addPhoneAction, { status: "idle" } as PhoneState);
  return (
    <form action={action} className="stack">
      <PhoneField />
      {state.status === "error" && <p className="form-msg err" role="alert">{state.message}</p>}
      <button type="submit" className="btn btn-navy" disabled={pending} style={{ width: "100%", minHeight: 52 }}>{pending ? "Saving…" : "Save and continue"}</button>
    </form>
  );
}
