import "server-only";
import { decryptText } from "./crypto";

/**
 * Additional authenticated data for each kind of encrypted record. Binding a ciphertext
 * to where it lives means a value copied into another row or column fails to decrypt.
 * Both apps must use these exact strings.
 */
export const aad = {
  narrative: (reportId: string) => `report:${reportId}:narrative`,
  message: (reportId: string) => `message:${reportId}`,
  note: (reportId: string) => `note:${reportId}`,
  file: (storageKey: string) => `evidence:${storageKey}`,
  fileName: (storageKey: string) => `evidence:${storageKey}:name`,
  issue: () => "issue",
  userEmail: () => "user.email",
  leadEmail: () => "lead.email",
  watchEmail: () => "watch.email",
  userTotp: (userId: string) => `user:${userId}:totp`,
  staffTotp: (staffId: string) => `staff:${staffId}:totp`,
  userPhone: (userId: string) => `user:${userId}:phone`,
};

export const narrativeOf = (r: { id: string; narrativeEnc: string | null }) => (r.narrativeEnc ? decryptText(r.narrativeEnc, aad.narrative(r.id)) : "");
export const messageText = (m: { reportId: string; bodyEnc: string }) => decryptText(m.bodyEnc, aad.message(m.reportId));
export const noteText = (n: { reportId: string; bodyEnc: string }) => decryptText(n.bodyEnc, aad.note(n.reportId));
export const evidenceName = (f: { storageKey: string; fileNameEnc: string }) => decryptText(f.fileNameEnc, aad.fileName(f.storageKey));
export const issueText = (i: { bodyEnc: string }) => decryptText(i.bodyEnc, aad.issue());
