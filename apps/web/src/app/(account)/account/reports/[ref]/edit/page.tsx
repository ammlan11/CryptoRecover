import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MAX_EVIDENCE_FILES } from "@kurotrace/core/files";
import { ActionForm } from "@/components/account/ActionForm";
import { ASSET_OPTIONS, CHANNEL_OPTIONS, formatDate, lossLabel, NETWORK_OPTIONS, scamLabel } from "@/lib/labels";
import { LOSS_BAND_OPTIONS, SCAM_TYPE_OPTIONS } from "@/lib/options";
import { requireUser } from "@/lib/session";
import { evidenceName, getUserReport, MAX_NARRATIVE, narrativeOf } from "@/server/reports";
import {
  addPaymentAction,
  finishEvidenceAction,
  finishPaymentsAction,
  removeEvidenceAction,
  removePaymentAction,
  saveStep1Action,
  saveStep2Action,
  submitReportAction,
  uploadEvidenceAction,
} from "../../../actions";

export const metadata: Metadata = { title: "Your report" };

const STEPS = ["What happened", "How they contacted you", "Money and wallets", "Evidence", "Review and send"];

export default async function EditReportPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ step?: string }> }) {
  const session = await requireUser();
  const { ref } = await params;
  const report = await getUserReport(session.userId, ref);
  if (!report) notFound();
  if (report.status !== "DRAFT") redirect(`/account/reports/${ref}`);
  const requested = Number((await searchParams).step ?? report.lastStep);
  const step = Number.isInteger(requested) && requested >= 1 && requested <= report.lastStep ? requested : report.lastStep;
  const narrative = narrativeOf(report);
  const contact = report.indicators.filter((i) => !i.paymentId);
  const handle = contact.find((i) => i.kind !== "DOMAIN")?.value ?? "";
  const website = contact.find((i) => i.kind === "DOMAIN")?.value ?? "";
  const hidden = <input type="hidden" name="ref" value={report.publicRef} />;

  return (
    <div className="wizard">
      <nav aria-label="Report steps" className="panel wizard-nav">
        <div style={{ fontSize: 22, fontWeight: 300, padding: "4px 12px 6px" }}>Your report</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--ink-muted)", padding: "0 12px 12px" }}>{report.publicRef} · draft</div>
        <ol>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const reachable = n <= report.lastStep;
            const state = n === step ? "on" : n < report.lastStep || (n < step) ? "done" : "todo";
            const inner = (
              <>
                <span className={`step-dot ${state}`}>{state === "done" ? "✓" : n}</span>
                <span>{label}</span>
              </>
            );
            return (
              <li key={label}>
                {reachable ? (
                  <Link href={`?step=${n}`} className={`step-link ${n === step ? "current" : ""}`} aria-current={n === step ? "step" : undefined}>{inner}</Link>
                ) : (
                  <span className="step-link disabled">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="fine" style={{ padding: "8px 12px 0", lineHeight: 1.5 }}>Saved as you go. We never ask for your seed phrase, private keys or ID documents.</p>
      </nav>

      <section className="panel wizard-body" aria-labelledby="step-title">
        <div className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>Step {step} of 5</div>

        {step === 1 && (
          <>
            <h1 id="step-title" className="step-title">What happened?</h1>
            <ActionForm action={saveStep1Action} className="stack">
              {hidden}
              <div>
                <label className="label" htmlFor="scamType">Type of scam</label>
                <select id="scamType" name="scamType" className="field" defaultValue={report.scamType}>
                  {SCAM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="narrative">Tell us in your own words</label>
                <textarea id="narrative" name="narrative" rows={8} maxLength={MAX_NARRATIVE} defaultValue={narrative} className="field textarea" placeholder="How it started, what you were promised, what happened when you tried to withdraw…" />
                <p className="fine">Don&rsquo;t include passwords, seed phrases or ID numbers.</p>
              </div>
              <div className="grid-2">
                <div>
                  <label className="label" htmlFor="occurredAt">When did it start?</label>
                  <input id="occurredAt" name="occurredAt" type="date" className="field" defaultValue={report.occurredAt?.toISOString().slice(0, 10)} />
                </div>
                <div>
                  <label className="label" htmlFor="lossBand">Roughly how much was lost?</label>
                  <select id="lossBand" name="lossBand" className="field" defaultValue={report.lossBand ?? ""}>
                    <option value="">Prefer not to say</option>
                    {LOSS_BAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="country">Your country (2-letter code)</label>
                  <input id="country" name="country" className="field" maxLength={2} placeholder="e.g. GB, AE, US" defaultValue={report.country ?? ""} style={{ textTransform: "uppercase" }} />
                </div>
              </div>
              <div className="wizard-actions"><span /><button type="submit" className="btn btn-navy">Save and continue →</button></div>
            </ActionForm>
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="step-title" className="step-title">How did they contact you?</h1>
            <ActionForm action={saveStep2Action} className="stack">
              {hidden}
              <div>
                <label className="label" htmlFor="channel">Where did it start?</label>
                <select id="channel" name="channel" className="field" defaultValue={report.contactChannel ?? ""}>
                  <option value="">Not sure</option>
                  {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="handle">Their username, phone number or email</label>
                <input id="handle" name="handle" className="field" maxLength={512} defaultValue={handle} placeholder="@handle, +phone or name@site.com" />
              </div>
              <div>
                <label className="label" htmlFor="website">Website or app they used</label>
                <input id="website" name="website" className="field" maxLength={512} defaultValue={website} placeholder="https://…" />
                <p className="fine">We compare this with other reports. It is never published with your name.</p>
              </div>
              <div className="wizard-actions">
                <Link href="?step=1" className="btn btn-line">← Back</Link>
                <button type="submit" className="btn btn-navy">Save and continue →</button>
              </div>
            </ActionForm>
          </>
        )}

        {step === 3 && (
          <>
            <h1 id="step-title" className="step-title">Money and wallets</h1>
            <p style={{ color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 20px" }}>Add each payment you made. Missing details are fine; add what you have. No losses? Skip this step.</p>
            {report.payments.length > 0 && (
              <ul className="item-list">
                {report.payments.map((p, i) => (
                  <li key={p.id}>
                    <div>
                      <strong style={{ fontWeight: 500 }}>Payment {i + 1}: {p.amount ? `${p.amount.toString()} ` : ""}{p.asset}</strong>
                      <div className="fine" style={{ margin: "4px 0 0" }}>
                        {[p.network, p.sentAt && formatDate(p.sentAt)].filter(Boolean).join(" · ")}
                        {p.indicators.map((ind) => <code key={ind.id} className="code-chip">{ind.kind === "WALLET" ? "to " : "tx "}{ind.value}</code>)}
                      </div>
                    </div>
                    <form action={removePaymentAction}>
                      {hidden}
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button type="submit" className="link-btn">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addPaymentAction} className="subpanel stack" resetOnSuccess>
              {hidden}
              <div className="mono" style={{ fontSize: 12 }}>Add a payment</div>
              <div className="grid-3">
                <div>
                  <label className="label" htmlFor="amount">Amount</label>
                  <input id="amount" name="amount" className="field" inputMode="decimal" placeholder="2500" />
                </div>
                <div>
                  <label className="label" htmlFor="asset">Currency or coin</label>
                  <select id="asset" name="asset" className="field">{ASSET_OPTIONS.map((a) => <option key={a}>{a}</option>)}</select>
                </div>
                <div>
                  <label className="label" htmlFor="network">Network</label>
                  <select id="network" name="network" className="field" defaultValue="Not sure">{NETWORK_OPTIONS.map((n) => <option key={n}>{n}</option>)}</select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="toAddress">Wallet address you sent to</label>
                <input id="toAddress" name="toAddress" className="field mono-input" maxLength={128} placeholder="T…, 0x…, bc1…" spellCheck={false} />
              </div>
              <div className="grid-2">
                <div>
                  <label className="label" htmlFor="txHash">Transaction ID (optional)</label>
                  <input id="txHash" name="txHash" className="field mono-input" maxLength={128} spellCheck={false} />
                </div>
                <div>
                  <label className="label" htmlFor="sentAt">Date sent (optional)</label>
                  <input id="sentAt" name="sentAt" type="date" className="field" />
                </div>
              </div>
              <button type="submit" className="btn btn-line" style={{ justifySelf: "start" }}>+ Add payment</button>
            </ActionForm>
            <form action={finishPaymentsAction} className="wizard-actions">
              {hidden}
              <Link href="?step=2" className="btn btn-line">← Back</Link>
              <button type="submit" className="btn btn-navy">Continue →</button>
            </form>
          </>
        )}

        {step === 4 && (
          <>
            <h1 id="step-title" className="step-title">Evidence</h1>
            <p style={{ color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 20px" }}>Screenshots of chats, the platform and payment receipts help most. Files are encrypted before they are stored.</p>
            {report.evidence.length > 0 && (
              <ul className="item-list">
                {report.evidence.map((f) => (
                  <li key={f.id}>
                    <div>
                      <strong style={{ fontWeight: 500 }}>{evidenceName(f)}</strong>
                      <div className="fine" style={{ margin: "4px 0 0" }}>{(f.sizeBytes / 1024).toFixed(0)} KB · encrypted</div>
                    </div>
                    <form action={removeEvidenceAction}>
                      {hidden}
                      <input type="hidden" name="evidenceId" value={f.id} />
                      <button type="submit" className="link-btn">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {report.evidence.length < MAX_EVIDENCE_FILES && (
              <ActionForm action={uploadEvidenceAction} className="stack" encType="multipart/form-data" resetOnSuccess>
                {hidden}
                <label htmlFor="files" className="dropzone">
                  <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                  <strong style={{ fontWeight: 500 }}>Choose files from your device</strong>
                  <span className="fine" style={{ margin: 0 }}>PNG, JPG, WebP or PDF · up to 10 MB each, 25 MB per upload · {MAX_EVIDENCE_FILES - report.evidence.length} more allowed</span>
                </label>
                <input id="files" name="files" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="file-input" />
                <button type="submit" className="btn btn-line" style={{ justifySelf: "start" }}>Upload</button>
              </ActionForm>
            )}
            <form action={finishEvidenceAction} className="wizard-actions">
              {hidden}
              <Link href="?step=3" className="btn btn-line">← Back</Link>
              <button type="submit" className="btn btn-navy">Continue →</button>
            </form>
          </>
        )}

        {step === 5 && (
          <>
            <h1 id="step-title" className="step-title">Review and send</h1>
            <dl className="summary">
              <div><dt>Type</dt><dd>{scamLabel(report.scamType)} <Link href="?step=1">Edit</Link></dd></div>
              <div><dt>Loss</dt><dd>{lossLabel(report.lossBand)}</dd></div>
              <div><dt>Your description</dt><dd>{narrative ? `${narrative.slice(0, 280)}${narrative.length > 280 ? "…" : ""}` : <em>None yet</em>}</dd></div>
              <div><dt>Contact details</dt><dd>{contact.length ? contact.map((c) => c.value).join(", ") : <em>None</em>} <Link href="?step=2">Edit</Link></dd></div>
              <div><dt>Payments</dt><dd>{report.payments.length} <Link href="?step=3">Edit</Link></dd></div>
              <div><dt>Evidence files</dt><dd>{report.evidence.length} <Link href="?step=4">Edit</Link></dd></div>
            </dl>
            <ActionForm action={submitReportAction} className="stack">
              {hidden}
              <label className="check boxed">
                <input type="checkbox" name="accurate" required />
                <span>I confirm this is accurate to the best of my knowledge. <span className="muted-ink">(Required)</span></span>
              </label>
              <label className="check boxed">
                <input type="checkbox" name="research" required />
                <span><strong style={{ fontWeight: 500 }}>Use my report for scam research.</strong> Our in-house team and private investigators ([Investigation firm]) analyse it; findings are published without my details. I can delete it any time. <span className="muted-ink">(Required)</span></span>
              </label>
              <label className="check boxed">
                <input type="checkbox" name="publicAlert" />
                <span>After review, the wallets and websites in my report (never my details) may appear in public scam alerts. <span className="muted-ink">(Optional)</span></span>
              </label>
              <div className="wizard-actions">
                <Link href="?step=4" className="btn btn-line">← Back</Link>
                <button type="submit" className="btn btn-navy">Send report</button>
              </div>
            </ActionForm>
          </>
        )}
      </section>
    </div>
  );
}
