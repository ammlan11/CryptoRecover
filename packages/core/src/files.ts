/**
 * Upload checks. The file's real type is read from its first bytes, never from the
 * name or the browser-supplied MIME type, which an attacker controls.
 */

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 10;

export type EvidenceType = { mime: "image/png" | "image/jpeg" | "image/webp" | "application/pdf"; ext: string };

export function sniffEvidenceType(bytes: Uint8Array): EvidenceType | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

function ascii(b: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...b.subarray(start, end));
}

/** Keeps a display name safe to show: no paths, control characters or absurd length. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  return (cleaned || "file").slice(0, 120);
}
