"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { keyChallengeAction, keyRegistrationOptionsAction, registerKeyAction } from "@/app/actions";

type CreationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
type RequestOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

function friendly(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return "The key request was cancelled or timed out.";
  if (name === "InvalidStateError") return "That key is already registered.";
  return "Your browser couldn't use a security key here.";
}

/**
 * "Use a security key" on the sign-in and confirm-it's-you forms. Gets a challenge,
 * asks the browser for a signature, puts it in the form and submits it in place of a code.
 */
export function KeySignInButton({ purpose }: { purpose: "login" | "reauth" }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    const form = ref.current?.closest("form");
    if (!form) return;
    setMessage(null);
    if (!browserSupportsWebAuthn()) return setMessage("This browser doesn't support security keys.");
    const password = form.querySelector<HTMLInputElement>("#password");
    if (password && !password.value) {
      password.focus();
      return setMessage("Enter your password first, then use your key.");
    }
    setBusy(true);
    try {
      const challenge = await keyChallengeAction(purpose);
      if (!challenge.ok) return setMessage(challenge.message);
      const response = await startAuthentication({ optionsJSON: challenge.options as RequestOptions });
      const field = form.querySelector<HTMLInputElement>("input[name=webauthn]");
      const code = form.querySelector<HTMLInputElement>("#code");
      if (field) field.value = JSON.stringify(response);
      if (code) code.required = false;
      form.requestSubmit();
      // One-shot: clear it so a later typed code isn't shadowed by a spent signature.
      setTimeout(() => { if (field) field.value = ""; if (code) code.required = true; }, 0);
    } catch (error) {
      setMessage(friendly(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input type="hidden" name="webauthn" defaultValue="" />
      <button ref={ref} type="button" className="btn btn-line" style={{ width: "100%" }} onClick={go} disabled={busy}>
        {busy ? "Waiting for your key…" : "Use a security key or passkey instead"}
      </button>
      {message && <p className="msg error" role="alert">{message}</p>}
    </>
  );
}

/** Add-a-key control on My account. */
export function AddKey() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setState(null);
    if (!browserSupportsWebAuthn()) return setState({ ok: false, text: "This browser doesn't support security keys." });
    setBusy(true);
    try {
      const opts = await keyRegistrationOptionsAction();
      if (!opts.ok) return setState({ ok: false, text: opts.message });
      const response = await startRegistration({ optionsJSON: opts.options as CreationOptions });
      const result = await registerKeyAction(label, JSON.stringify(response));
      if (result.status === "error") return setState({ ok: false, text: result.message });
      setLabel("");
      setState({ ok: true, text: result.status === "success" ? result.message : "Security key added." });
      router.refresh();
    } catch (error) {
      setState({ ok: false, text: friendly(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="inline">
        <div>
          <label className="label" htmlFor="key-label">Name for this key</label>
          <input id="key-label" className="field" maxLength={64} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. YubiKey on keyring, work laptop" />
        </div>
        <button type="button" className="btn btn-primary" style={{ flex: "0 0 auto", alignSelf: "end" }} onClick={add} disabled={busy}>
          {busy ? "Touch your key…" : "Add security key"}
        </button>
      </div>
      {state && <p className={`msg ${state.ok ? "success" : "error"}`} role={state.ok ? "status" : "alert"}>{state.text}</p>}
    </div>
  );
}
