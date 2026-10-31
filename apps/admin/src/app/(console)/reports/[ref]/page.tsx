import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@kurotrace/db";
import { evidenceName, messageText, narrativeOf, noteText } from "@kurotrace/services/records";
import { staffMayOpen } from "@kurotrace/services/malware";
import { Form } from "@/components/Form";
import { can } from "@/lib/permissions";
import { fmt, fmtDay, LOSS, Pill, SCAM, STATUS } from "@/lib/labels";
import { requireStaff } from "@/lib/session";
import { openCase } from "@/server/cases";
import { assignAction, indicatorAction, noteAction, patternAction, replyAction, returnAction, revealEmailAction, statusAction } from "../../../actions";

export const metadata = { title: "Case" };

const NEXT_STATUS: Record<string, string[]> = {
  RECEIVED: ["IN_HOUSE_REVIEW", "INFO_NEEDED", "WITH_INVESTIGATORS", "CLOSED"],
  IN_HOUSE_REVIEW: ["INFO_NEEDED", "WITH_INVESTIGATORS", "CLOSED"],
  INFO_NEEDED: ["IN_HOUSE_REVIEW", "WITH_INVESTIGATORS", "CLOSED"],
  WITH_INVESTIGATORS: ["IN_HOUSE_REVIEW", "INFO_NEEDED", "CLOSED"],
  CLOSED: ["IN_HOUSE_REVIEW"],
};

export default async function CasePage({ params }: { params: Promise<{ ref: string }> }) {
  const { staff, ip } = await requireStaff();
  const { ref } = await params;
  const report = await openCase(staff, ip, ref);
  if (!report) notFound();
  const role = staff.role;
  const hidden = <input type="hidden" name="ref" value={report.publicRef} />;
  const people = can(role, "assign")
    ? await prisma.staff.findMany({ where: { disabledAt: null, activatedAt: { not: null }, role: { in: ["OWNER", "REVIEWER", "INVESTIGATOR"] } }, select: { id: true, username: true, role: true, organisation: true } })
    : [];
  const thread = [
    ...report.messages.map((m) => ({ kind: m.authorType === "USER" ? "user" : "staff", at: m.createdAt, who: m.authorType === "USER" ? "Reporter" : m.staff?.username ?? "Staff", text: messageText(m) })),
    ...(can(role, "analyse") ? report.notes.map((n) => ({ kind: "note", at: n.createdAt, who: `${n.staff.username} · internal note`, text: noteText(n) })) : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <div className="row">
        <div>
          <div className="code" style={{ color: "var(--muted)" }}>{report.publicRef}</div>
          <h1 className="title" style={{ marginTop: 4 }}>{SCAM[report.scamType]}</h1>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            Sent {fmt(report.submittedAt)} · {LOSS[report.lossBand ?? "NOT_GIVEN"]}{report.country ? ` · ${report.country}` : ""}
            {report.publicAlertConsentAt ? " · may appear in public alerts" : " · no public-alert consent"}
          </p>
        </div>
        <Pill status={report.status} />
      </div>

      <div className="case">
        <div className="case-main">
          <section className="card">
            <h2 className="sub">What the reporter told us</h2>
            <p className="narrative">{narrativeOf(report) || <span className="hint">No description given.</span>}</p>
          </section>

          <section className="card">
            <h2 className="sub">Wallets, sites and contacts</h2>
            <p className="hint" style={{ marginTop: -6 }}>Confirmed entries are counted by the public checker.</p>
            {report.indicators.length === 0 ? <p className="hint">None given.</p> : (
              <ul className="list">
                {report.indicators.map((i) => (
                  <li key={i.id}>
                    <div>
                      <span className="pill pill-neutral" style={{ marginRight: 8 }}>{i.kind}{i.chain ? ` · ${i.chain}` : ""}</span>
                      <span className="code">{i.value}</span>
                      {i.confirmedAt && <div className="hint" style={{ marginTop: 4 }}>Confirmed by {i.confirmedBy?.username ?? "staff"} · {fmtDay(i.confirmedAt)}</div>}
                    </div>
                    {can(role, "analyse") && (
                      <form action={indicatorAction}>
                        {hidden}
                        <input type="hidden" name="indicatorId" value={i.id} />
                        <input type="hidden" name="confirm" value={i.confirmedAt ? "0" : "1"} />
                        <button type="submit" className={`btn btn-small ${i.confirmedAt ? "btn-line" : "btn-primary"}`}>{i.confirmedAt ? "Unconfirm" : "Confirm"}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {report.payments.length > 0 && (
              <>
                <h2 className="sub" style={{ marginTop: 20 }}>Payments</h2>
                <ul className="list">
                  {report.payments.map((p) => (
                    <li key={p.id}><span>{p.amount ? p.amount.toString() : "?"} {p.asset}{p.network ? ` · ${p.network}` : ""}</span><span className="hint">{p.sentAt ? fmtDay(p.sentAt) : ""}</span></li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card">
            <h2 className="sub">Evidence</h2>
            {report.evidence.length === 0 ? <p className="hint">No files.</p> : (
              <ul className="list">
                {report.evidence.map((f) => (
                  <li key={f.id}>
                    <span>{evidenceName(f)} <span className="hint">· {(f.sizeBytes / 1024).toFixed(0)} KB · {f.mimeType}</span></span>
                    <span>
                      {(f.scanStatus === "PENDING" || f.scanStatus === "FAILED") && <span className="pill pill-warn" style={{ marginRight: 8 }}>Not yet scanned</span>}
                      {f.scanStatus === "CLEAN" && <span className="pill pill-ok" style={{ marginRight: 8 }}>Scanned</span>}
                      {f.scanStatus === "INFECTED" ? <span className="pill pill-danger">Malware: blocked</span> : staffMayOpen(f.scanStatus) ? <a className="btn btn-line btn-small" href={`/reports/${report.publicRef}/evidence/${f.id}`}>Download</a> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="sub">Messages{can(role, "analyse") ? " and internal notes" : ""}</h2>
            {thread.length === 0 ? <p className="hint">No messages yet.</p> : (
              <ul className="thread">
                {thread.map((m, i) => (
                  <li key={i} className={m.kind}>
                    <div className="meta">{m.who} · {fmt(m.at)}</div>
                    <p>{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {can(role, "messageUser") && (
              <Form action={replyAction} className="stack" reset>
                {hidden}
                <label className="label" htmlFor="reply">Message to the reporter</label>
                <textarea id="reply" name="body" className="field" maxLength={5000} required placeholder="They'll get an email saying there's a new message; the text stays in their account." />
                <button type="submit" className="btn btn-primary" style={{ justifySelf: "start" }}>Send to reporter</button>
              </Form>
            )}
            {can(role, "analyse") && (
              <Form action={noteAction} className="stack" reset>
                {hidden}
                <label className="label" htmlFor="note" style={{ marginTop: 12 }}>Internal note (staff only)</label>
                <textarea id="note" name="body" className="field" maxLength={5000} required />
                <button type="submit" className="btn btn-line" style={{ justifySelf: "start" }}>Add note</button>
              </Form>
            )}
          </section>
        </div>

        <aside className="case-side">
          {can(role, "changeStatus") && (
            <section className="card">
              <h2 className="sub">Status</h2>
              <Form action={statusAction} className="inline">
                {hidden}
                <div>
                  <label className="sr-only" htmlFor="status">New status</label>
                  <select id="status" name="status" className="field">
                    {(NEXT_STATUS[report.status] ?? []).map((s) => <option key={s} value={s}>{STATUS[s]!.label}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ flex: "0 0 auto" }}>Update</button>
              </Form>
              <p className="hint">&ldquo;Info needed&rdquo; and &ldquo;Closed&rdquo; email the reporter.</p>
            </section>
          )}
          {role === "INVESTIGATOR" && report.status === "WITH_INVESTIGATORS" && (
            <section className="card">
              <h2 className="sub">Analysis done?</h2>
              <Form action={returnAction}>{hidden}<button type="submit" className="btn btn-primary">Hand back to in-house team</button></Form>
            </section>
          )}
          {can(role, "assign") && (
            <section className="card">
              <h2 className="sub">Assigned to</h2>
              <Form action={assignAction} className="inline">
                {hidden}
                <div>
                  <label className="sr-only" htmlFor="staffId">Assignee</label>
                  <select id="staffId" name="staffId" className="field" defaultValue={report.assignedStaff?.id ?? ""}>
                    <option value="">Unassigned</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.username} · {p.role.toLowerCase()}{p.organisation ? ` · ${p.organisation}` : ""}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Save</button>
              </Form>
            </section>
          )}
          {can(role, "analyse") && (
            <section className="card">
              <h2 className="sub">Scam pattern</h2>
              <Form action={patternAction} className="inline">
                {hidden}
                <div>
                  <label className="sr-only" htmlFor="pattern">Pattern</label>
                  <input id="pattern" name="pattern" className="field" defaultValue={report.scamPattern ?? ""} placeholder="e.g. fee-to-withdraw" />
                </div>
                <button type="submit" className="btn btn-line" style={{ flex: "0 0 auto" }}>Save</button>
              </Form>
            </section>
          )}
          {can(role, "viewReporterEmail") && (
            <section className="card">
              <h2 className="sub">Reporter</h2>
              <p className="hint" style={{ marginTop: 0 }}>Account since {fmtDay(report.user?.createdAt)} · email {report.user?.emailVerifiedAt ? "confirmed" : "not confirmed"}</p>
              <Form action={revealEmailAction}>{hidden}<button type="submit" className="btn btn-line btn-small">Show email (logged)</button></Form>
            </section>
          )}
          <Link href="/reports" className="hint">← Back to queue</Link>
        </aside>
      </div>
    </>
  );
}
