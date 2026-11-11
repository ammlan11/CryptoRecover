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

type Result = Extract<CheckState, { status: "result" }>;

function ago(iso: string) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return hours < 48 ? `${hours} hour${hours === 1 ? "" : "s"} ago` : `${Math.round(hours / 24)} days ago`;
}

/** The headline: sanctions first, then scam-site lists, then our reports, then "nothing found". */
function Verdict({ state }: { state: Result }) {
  const what = KIND_LABEL[state.kind];
  const sanctioned = state.lists.some((l) => l.source === "OFAC");
  const scamSite = state.lists.filter((l) => l.source !== "OFAC");
  const danger = sanctioned || scamSite.length > 0 || state.count > 0;
  return (
    <div className={`verdict ${danger ? "verdict-danger" : "verdict-none"}`}>
      {sanctioned && (
        <p className="result-head"><span className="dot-red blink" aria-hidden="true">● </span><strong>On the US Treasury sanctions list.</strong> This {what} belongs to a sanctioned criminal group. Do not send money to it.</p>
      )}
      {scamSite.length > 0 && (
        <p className="result-head">
          <span className="dot-red blink" aria-hidden="true">● </span><strong>Known scam website.</strong> Listed by{" "}
          {scamSite.map((l, i) => <span key={l.source}>{i > 0 && " and "}<a href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a></span>)}.
          Don&rsquo;t connect your wallet or enter any details.
        </p>
      )}
      {state.count > 0 && (
        <p className="result-head">
          <span className="dot-red blink" aria-hidden="true">● </span><strong>Reported {state.count} {state.count === 1 ? "time" : "times"}</strong>
          {state.since && <span className="muted"> since {new Date(state.since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
          {" "}to Kuro Trace and confirmed by our team. Do not send money to this {what}.
        </p>
      )}
      {!danger && (
        <p className="result-head">
          <strong>No reports or listings found for this {what}.</strong>{" "}
          <span className="muted">That doesn&rsquo;t make it safe: new scam {what}s appear every day. Check the warning signs below before you send anything.</span>
        </p>
      )}
    </div>
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
            <Verdict state={state} />
            <p className="result-head" style={{ margin: "6px 0 0" }}>
              <code>{state.value}</code>
            </p>
            <WatchForm key={`${state.kind}:${state.value}`} kind={state.kind} value={state.value} />
            <p className="checked-against">
              Checked against Kuro Trace reports, the US Treasury sanctions list (OFAC) and the MetaMask and PhishDestroy scam-site lists
              {state.listsUpdated ? `, updated ${ago(state.listsUpdated)}` : ""}.{" "}
              {state.lists.length === 0 && state.count === 0 && <a href="/#report">Lost money to it? Report it.</a>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
