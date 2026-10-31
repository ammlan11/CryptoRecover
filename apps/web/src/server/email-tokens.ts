import "server-only";
import { generateToken, hashToken } from "@kurotrace/core/tokens";
import { prisma, type EmailTokenPurpose } from "@kurotrace/db";

const TTL_MINUTES: Record<EmailTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * 60,
  RESET_PASSWORD: 60,
  CONTINUE_REPORT: 7 * 24 * 60,
};

/** One-time link token. Only its hash is stored; issuing a new one retires older ones of the same kind. */
export async function issueEmailToken(emailHash: string, purpose: EmailTokenPurpose, leadId?: string): Promise<string> {
  const token = generateToken();
  await prisma.$transaction([
    prisma.emailToken.updateMany({ where: { emailHash, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailToken.create({
      data: { tokenHash: hashToken(token), emailHash, purpose, leadId, expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60_000) },
    }),
  ]);
  return token;
}

/** Looks a token up without using it (to show a form). */
export async function peekEmailToken(token: string, purpose: EmailTokenPurpose) {
  if (!token || token.length > 100) return null;
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Uses a token exactly once. The conditional update makes double-submits and races safe. */
export async function consumeEmailToken(token: string, purpose: EmailTokenPurpose) {
  const row = await peekEmailToken(token, purpose);
  if (!row) return null;
  const { count } = await prisma.emailToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return count === 1 ? row : null;
}
