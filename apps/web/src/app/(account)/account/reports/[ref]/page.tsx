import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/account/ActionForm";
import { StatusPill } from "@/components/account/StatusPill";
import { formatDate, lossLabel, scamLabel, STATUS_FLOW, STATUS_LABEL } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { evidenceName, getUserReport, markStaffMessagesRead, MAX_MESSAGE, messageText, narrativeOf } from "@/server/reports";
import { deleteReportAction, sendMessageAction } from "../../actions";

export const metadata: Metadata = { title: "Report" };

export default async function ReportDetailPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ sent?: string }> }) {
  const session = await requireUser();
  const { ref } = await params;
  const report = await getUserReport(session.userId, ref);
  if (!report) notFound();
  if (report.status === "DRAFT") redirect(`/account/reports/${ref}/edit`);
  await markStaffMessagesRead(report.id);
  const { sent } = await searchParams;
  const narrative = narrativeOf(report);
  const currentIndex = report.status === "INFO_NEEDED" ? 1 : STATUS_FLOW.indexOf(report.status as (typeof STATUS_FLOW)[number]);

  return (
    <>
      {sent && (
        <div className="panel" role="status" style={{ borderLeft: "4px solid var(--cyan)", marginBottom: 20 }}>
          <strong style={{ fontWeight: 500 }}>Thank you. Your report was sent.</strong>
          <p style={{ margin: "6px 0 0", color: "var(--ink-muted)" }}>Our research team reads every report. If we have a question, it will appear below and we&rsquo;ll email you.</p>
        </div>
      )}
      <div className="detail">
        <section className="panel">
          <div className="row-between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{report.publicRef}</div>
              <h1 className="page-title" style={{ fontSize: 30, marginTop: 6 }}>{scamLabel(report.scamType)}</h1>
              <p className="fine" style={{ margin: "6px 0 0" }}>Sent {formatDate(report.submittedAt)} · {lossLabel(report.lossBand)}</p>
            </div>
            <StatusPill status={report.status} />
          </div>

          <ol className="progress" aria-label="Report progress">
            {STATUS_FLOW.map((s, i) => (
              <li key={s} className={i < currentIndex ? "done" : i === currentIndex ? "current" : ""}>
                <span>{s === "IN_HOUSE_REVIEW" && report.status === "INFO_NEEDED" ? "Info needed" : STATUS_LABEL[s]?.label}</span>
              </li>
            ))}
          </ol>

          <h2 className="section-title">Secure messages</h2>
          {report.messages.length === 0 ? (
            <p className="fine">No messages yet. If our team needs more detail, they&rsquo;ll ask here.</p>
          ) : (
            <ul className="messages">
              {report.messages.map((m) => (
                <li key={m.id} className={m.authorType === "USER" ? "mine" : "theirs"}>
                  <div className="msg-meta">{m.authorType === "USER" ? "You" : "Research team"} · {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</div>
                  <p>{messageText(m)}</p>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={sendMessageAction} className="stack" resetOnSuccess>
            <input type="hidden" name="ref" value={report.publicRef} />
            <label className="sr-only" htmlFor="body">Write a message</label>
            <textarea id="body" name="body" rows={3} maxLength={MAX_MESSAGE} required className="field textarea" placeholder="Add a detail or answer a question…" />
            <button type="submit" className="btn btn-navy" style={{ justifySelf: "start" }}>Send message</button>
          </ActionForm>
          <p className="fine">Our team will never ask you for money, a recovery fee or your seed phrase in these messages.</p>
        </section>

        <aside className="detail-side">
          <div className="panel">
            <h2 className="section-title" style={{ marginTop: 0 }}>What you told us</h2>
            <p style={{ whiteSpace: "pre-line", lineHeight: 1.6, color: "var(--ink-muted)", margin: 0 }}>{narrative || "No description."}</p>
            {report.indicators.length > 0 && (
              <>
                <h3 className="mini-title">Wallets, sites and contacts</h3>
                <div>{report.indicators.map((i) => <code key={i.id} className="code-chip">{i.value}</code>)}</div>
              </>
            )}
            <h3 className="mini-title">Payments</h3>
            <p className="fine" style={{ margin: 0 }}>
              {report.payments.length ? report.payments.map((p) => `${p.amount ? p.amount.toString() + " " : ""}${p.asset}`).join(" · ") : "None"}
            </p>
            {report.evidence.length > 0 && (
              <>
                <h3 className="mini-title">Evidence</h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {report.evidence.map((f) => (
                    <li key={f.id}>
                      <a href={`/account/reports/${report.publicRef}/evidence/${f.id}`} style={{ color: "var(--blue)", textDecoration: "underline" }}>{evidenceName(f)}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="panel">
            <h2 className="section-title" style={{ marginTop: 0 }}>Delete this report</h2>
            <p className="fine" style={{ marginTop: 0 }}>Removes the report, its messages and evidence files permanently.</p>
            <ActionForm action={deleteReportAction} className="stack">
              <input type="hidden" name="ref" value={report.publicRef} />
              <label className="check"><input type="checkbox" name="confirm" required /><span>I understand this can&rsquo;t be undone.</span></label>
              <button type="submit" className="btn btn-line danger-btn" style={{ justifySelf: "start" }}>Delete report</button>
            </ActionForm>
          </div>
          <Link href="/account/reports" className="fine" style={{ textDecoration: "underline" }}>← All reports</Link>
        </aside>
      </div>
    </>
  );
}
