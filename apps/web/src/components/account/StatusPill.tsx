import { STATUS_LABEL } from "@/lib/labels";

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "neutral" as const };
  return <span className={`status status-${s.tone}`}>{s.label}</span>;
}
