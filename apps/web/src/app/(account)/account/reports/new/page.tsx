import type { Metadata } from "next";
import { ActionForm } from "@/components/account/ActionForm";
import { SCAM_TYPE_OPTIONS } from "@/lib/options";
import { newReportAction } from "../../actions";

export const metadata: Metadata = { title: "New report" };

export default function NewReportPage() {
  return (
    <div className="panel narrow">
      <h1 className="page-title" style={{ fontSize: 32 }}>Start a report</h1>
      <p style={{ color: "var(--ink-muted)", lineHeight: 1.6 }}>Pick the closest match. You can change it on the next screen.</p>
      <ActionForm action={newReportAction} className="stack">
        <fieldset className="chips" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">What kind of scam?</legend>
          {SCAM_TYPE_OPTIONS.map((o, i) => (
            <label key={o.value} className="chip">
              <input type="radio" name="scamType" value={o.value} defaultChecked={i === 0} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn btn-navy" style={{ marginTop: 20 }}>Start →</button>
      </ActionForm>
    </div>
  );
}
