"use client";

import { useActionState } from "react";
import { PhoneField } from "@/components/auth/AuthForms";
import { changePhoneAction, type PhoneState } from "@/app/phone-actions";

export function ChangePhoneForm() {
  const [state, action, pending] = useActionState(changePhoneAction, { status: "idle" } as PhoneState);
  if (state.status === "success") return <p className="form-msg ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="stack">
      <PhoneField label="New mobile number" />
      <div>
        <label className="label" htmlFor="password">Your password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {state.status === "error" && <p className="form-msg err" role="alert">{state.message}</p>}
      <button type="submit" className="btn btn-navy" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Saving…" : "Save number"}</button>
    </form>
  );
}
