"use client";

import { useActionState } from "react";
import { checkIndicator, watchIndicator, type CheckState, type FormState } from "@/app/actions";
import { BotCheck } from "@/components/forms/BotCheck";

const KIND_LABEL: Record<string, string> = {
  WALLET: "wallet",
  TX_HASH: "transaction",
  DOMAIN: "website",
  TELEGRAM: "handle",
  PHONE: "phone number",
  EMAIL: "email address",
  OTHER: "entry",
};

function WatchForm({ kind, value }: { kind: string; value: string }) {
  const [state, action, pending] = useActionState(watchIndicator, { status: "idle" } as FormState);
  if (state.status === "success") return <p className="form-msg ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="watch">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="value" value={value} />
      <div className="hp" aria-hidden="true">
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label htmlFor="watch-email" className="sr-only">Email me if this is reported again</label>
      <input id="watch-email" name="email" type="email" autoComplete="email" required placeholder="Email me if it's reported again" />
      <button type="submit" className="btn btn-line-w" disabled={pending}>{pending ? "…" : "Watch"}</button>
      <BotCheck action="watch" resetOn={state} />
      {state.status === "error" && <p className="form-msg err" role="alert" style={{ flexBasis: "100%" }}>{state.message}</p>}
    </form>
  );
}

export function Checker() {
  const [state, action, pending] = useActionState(checkIndicator, { status: "idle" } as CheckState);

  return (
    <div className="checker-body on-dark">
      <form action={action}>
        <label htmlFor="checker-q" className="label" style={{ color: "#d8def3", marginBottom: 8 }}>
          Wallet address, website or @handle
        </label>
        <div className="inline-form">
          <input id="checker-q" name="q" className="field-dark" required maxLength={512} autoComplete="off" spellCheck={false} placeholder="0x…, bc1…, T…, site.com, @handle" />
          <button type="submit" className="btn btn-cyan" disabled={pending}>{pending ? "Checking…" : "Check"}</button>
        </div>
      </form>

      <div aria-live="polite">
        {state.status === "error" && <p className="form-msg err">{state.message}</p>}
        {state.status === "result" && (
          <div className="result">
            {state.count > 0 ? (
              <p className="result-head" style={{ margin: 0 }}>
                <span className="dot-red blink" aria-hidden="true">● </span>
                <strong>Reported {state.count} {state.count === 1 ? "time" : "times"}</strong>
                {state.since && <span className="muted"> since {new Date(state.since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
                . Do not send money to this {KIND_LABEL[state.kind]}.
              </p>
            ) : (
              <p className="result-head" style={{ margin: 0 }}>
                <strong>No confirmed reports for this {KIND_LABEL[state.kind]} yet.</strong>{" "}
                <span className="muted">That alone doesn&rsquo;t make it safe. Check it against the warning signs below.</span>
              </p>
            )}
            <p className="result-head" style={{ margin: "6px 0 0" }}>
              <code>{state.value}</code>
            </p>
            <WatchForm key={`${state.kind}:${state.value}`} kind={state.kind} value={state.value} />
          </div>
        )}
      </div>
    </div>
  );
}
