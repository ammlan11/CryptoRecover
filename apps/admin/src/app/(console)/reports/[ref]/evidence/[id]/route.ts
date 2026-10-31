import { currentStaff, staffIp } from "@/lib/session";
import { readCaseEvidence } from "@/server/cases";

/** Staff evidence download: visibility-checked, audited, never rendered inline or cached. */
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string; id: string }> }) {
  const session = await currentStaff();
  if (!session) return new Response("Not found", { status: 404 });
  const { ref, id } = await params;
  const file = await readCaseEvidence(session.staff, await staffIp(), ref, id).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
