import Link from "next/link";

/** Shown inside the console when a report reference doesn't match a submitted report you can see. */
export default function ReportNotFound() {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1 className="title" style={{ marginTop: 0 }}>Report not found</h1>
      <p className="hint" style={{ fontSize: 15, lineHeight: 1.6 }}>
        This reference doesn&rsquo;t match a submitted report you have access to. It may still be a draft the person hasn&rsquo;t submitted, it may have been deleted,
        or it may be assigned to another investigator.
      </p>
      <Link href="/reports" className="btn btn-line" style={{ marginTop: 8 }}>Back to the reports queue</Link>
    </div>
  );
}
