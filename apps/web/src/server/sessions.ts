import "server-only";
import { generateToken, hashToken } from "@demo/core/tokens";
import { prisma } from "@demo/db";

export const SESSION_ABSOLUTE_DAYS = 30;
export const SESSION_IDLE_DAYS = 7;
const TOUCH_EVERY_MS = 5 * 60_000;
const DAY = 24 * 60 * 60_000;

/** Creates a session; the raw token goes in the cookie, only its hash in the database. */
export async function createSession(userId: string, meta: { userAgent?: string | null; ipHash?: string | null } = {}) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_DAYS * DAY);
  await prisma.userSession.create({
    data: { tokenHash: hashToken(token), userId, userAgent: meta.userAgent?.slice(0, 255) ?? null, ipHash: meta.ipHash ?? null, expiresAt },
  });
  return { token, expiresAt };
}

/** Resolves a cookie token to its session and user, enforcing absolute and idle expiry. */
export async function resolveSession(token: string | undefined | null) {
  if (!token || token.length > 100) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, emailEnc: true, emailVerifiedAt: true, totpEnabledAt: true, deletedAt: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.lastSeenAt.getTime() < now - SESSION_IDLE_DAYS * DAY || session.user.deletedAt) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.lastSeenAt.getTime() < now - TOUCH_EVERY_MS) {
    await prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session;
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Signs a user out everywhere, optionally keeping the current session. */
export async function destroyOtherSessions(userId: string, keepSessionId?: string) {
  await prisma.userSession.deleteMany({ where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) } });
}
