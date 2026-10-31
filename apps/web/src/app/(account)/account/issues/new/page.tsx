import type { Metadata } from "next";
import { ActionForm } from "@/components/account/ActionForm";
import { createIssueAction } from "../../actions";

export const metadata: Metadata = { title: "Report an issue" };

export default function NewIssuePage() {
  return (
    <div className="panel narrow">
      <h1 className="page-title" style={{ fontSize: 30 }}>Report an issue</h1>
      <p style={{ color: "var(--ink-muted)", lineHeight: 1.6 }}>Something not working, a complaint about our service, or a request about your data. We reply by email.</p>
      <ActionForm action={createIssueAction} className="stack" resetOnSuccess>
        <div>
          <label className="label" htmlFor="category">What is it about?</label>
          <select id="category" name="category" className="field">
            <option value="SITE_PROBLEM">Something on the site isn&rsquo;t working</option>
            <option value="COMPLAINT">A complaint about our service</option>
            <option value="DATA_REQUEST">A request about my data</option>
            <option value="OTHER">Something else</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="body">Tell us more</label>
          <textarea id="body" name="body" rows={6} maxLength={5000} required className="field textarea" />
        </div>
        <button type="submit" className="btn btn-navy" style={{ justifySelf: "start" }}>Send</button>
      </ActionForm>
    </div>
  );
}
