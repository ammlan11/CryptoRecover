import { currentSession } from "@/lib/session";
import { readUserEvidence } from "@/server/reports";

/**
 * Serves the owner's own evidence file, decrypted. Always a download (never rendered
 * inline), sandboxed by CSP, never cached.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string; id: string }> }) {
  const session = await currentSession();
  if (!session) return new Response("Not found", { status: 404 });
  const { ref, id } = await params;
  const file = await readUserEvidence(session.userId, ref, id).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  const asciiName = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
