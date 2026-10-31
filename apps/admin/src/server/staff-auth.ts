import "server-only";
import { checkPasswordBreach } from "@kurotrace/core/breach";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@kurotrace/core/password";
import { isIpAllowed, parseAllowList } from "@kurotrace/core/ip";
import { generateToken, hashToken } from "@kurotrace/core/tokens";
import { generateTotpSecret, totpUri, verifyTotp } from "@kurotrace/core/totp";
import { prisma, type StaffRole } from "@kurotrace/db";
import { audit } from "@kurotrace/services/audit";
import { decryptText, encryptText } from "@kurotrace/services/crypto";
import { aad } from "@kurotrace/services/records";

export const STAFF_IDLE_MINUTES = 120;
export const STAFF_ABSOLUTE_HOURS = 12;
export const REAUTH_MINUTES = 10;
const MAX_FAILED = 5;
const LOCK_MINUTES = 30;
const INVITE_HOURS = 48;

let dummy: Promise<string> | null = null;
const timingDummy = () => (dummy ??= hashPassword(generateToken(24)));

export function staffEvent(staffId: string | null, ip: string | null, action: string, entity = "staff", entityId: string | null = staffId, detail?: Record<string, unknown>) {
  return audit({ actorType: "staff", actorId: staffId, action, entity, entityId, ip, ...(detail ? { detail } : {}) });
}

function ipAllowedForStaff(allowedIps: string | null, ip: string) {
  if (!allowedIps) return true;
  try {
    return isIpAllowed(ip, parseAllowList(allowedIps));
  } catch {
    return false;
  }
}

async function codeAccepted(staff: { id: string; totpSecretEnc: string | null; totpLastStep: number | null }, code: string) {
  if (!staff.totpSecretEnc) return false;
  const step = verifyTotp(decryptText(staff.totpSecretEnc, aad.staffTotp(staff.id)), code, Date.now(), staff.totpLastStep);
  if (step === null) return false;
  const { count } = await prisma.staff.updateMany({
    where: { id: staff.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return count === 1;
}

export type StaffLogin = { ok: true; staffId: string } | { ok: false; reason: "invalid" | "locked" };

/** Username + password + authenticator code in one step. Every outcome is audited with the IP. */
export async function staffLogin(username: string, password: string, code: string, ip: string): Promise<StaffLogin> {
  const staff = await prisma.staff.findUnique({ where: { username: username.trim().toLowerCase() } });
  if (!staff || !staff.activatedAt || staff.disabledAt) {
    await verifyPassword(await timingDummy(), password);
    await staffEvent(null, ip, "staff.login_failed", "staff", null, { reason: "unknown_or_inactive" });
    return { ok: false, reason: "invalid" };
  }
  if (staff.lockedUntil && staff.lockedUntil > new Date()) {
    await staffEvent(staff.id, ip, "staff.login_blocked_locked");
    return { ok: false, reason: "locked" };
  }
  const passwordOk = await verifyPassword(staff.passwordHash, password);
  const codeOk = passwordOk && (await codeAccepted(staff, code));
  const ipOk = ipAllowedForStaff(staff.allowedIps, ip);
  if (!passwordOk || !codeOk || !ipOk) {
    const failed = staff.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await staffEvent(staff.id, ip, lock ? "staff.locked" : "staff.login_failed", "staff", staff.id, {
      reason: !passwordOk ? "password" : !codeOk ? "code" : "ip",
    });
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }
  await prisma.staff.update({ where: { id: staff.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await staffEvent(staff.id, ip, "staff.login");
  return { ok: true, staffId: staff.id };
}

export async function createStaffSession(staffId: string, ip: string, userAgent: string | null) {
  const token = generateToken();
  const now = new Date();
  await prisma.staffSession.create({
    data: {
      tokenHash: hashToken(token),
      staffId,
      ip,
      userAgent: userAgent?.slice(0, 255) ?? null,
      secondFactorAt: now, // login always includes the authenticator code
      reauthenticatedAt: now,
      expiresAt: new Date(now.getTime() + STAFF_ABSOLUTE_HOURS * 3_600_000),
    },
  });
  return token;
}

/**
 * A staff session is valid only from the IP it was created on, within 2 hours of
 * activity and 12 hours overall, for an active account whose per-person allow-list
 * still matches.
 */
export async function resolveStaffSession(token: string | undefined, ip: string) {
  if (!token || token.length > 100) return null;
  const session = await prisma.staffSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { staff: true } });
  if (!session) return null;
  const now = Date.now();
  const expired =
    session.expiresAt.getTime() < now ||
    session.lastSeenAt.getTime() < now - STAFF_IDLE_MINUTES * 60_000 ||
    !session.secondFactorAt ||
    session.ip !== ip ||
    session.staff.disabledAt !== null ||
    !session.staff.activatedAt ||
    !ipAllowedForStaff(session.staff.allowedIps, ip);
  if (expired) {
    await prisma.staffSession.delete({ where: { id: session.id } }).catch(() => {});
    if (session.ip !== ip) await staffEvent(session.staffId, ip, "staff.session_ip_mismatch", "staff", session.staffId, { sessionIp: session.ip });
    return null;
  }
  if (session.lastSeenAt.getTime() < now - 60_000) {
    await prisma.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session;
}

export async function endStaffSession(token: string | undefined) {
  if (token) await prisma.staffSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function recentlyReauthenticated(session: { reauthenticatedAt: Date | null }) {
  return Boolean(session.reauthenticatedAt && session.reauthenticatedAt.getTime() > Date.now() - REAUTH_MINUTES * 60_000);
}

/** Password + fresh code again, required before exports and staff changes. */
export async function reauthenticate(sessionId: string, staffId: string, password: string, code: string, ip: string) {
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });
  const ok = (await verifyPassword(staff.passwordHash, password)) && (await codeAccepted(staff, code));
  await staffEvent(staffId, ip, ok ? "staff.reauthenticated" : "staff.reauth_failed");
  if (ok) await prisma.staffSession.update({ where: { id: sessionId }, data: { reauthenticatedAt: new Date() } });
  return ok;
}

// ─── Staff management (owner) ───────────────────────────────────

const USERNAME = /^[a-z0-9._-]{3,64}$/;

/** Creates an inactive account and a one-time setup link. The link is shown once, to the owner. */
export async function inviteStaff(ownerId: string, ip: string, input: { username: string; role: StaffRole; organisation: string | null }) {
  const username = input.username.trim().toLowerCase();
  if (!USERNAME.test(username)) throw new Error("Usernames use 3–64 lowercase letters, numbers, dots, dashes or underscores.");
  if (await prisma.staff.findUnique({ where: { username } })) throw new Error("That username is taken.");
  const staff = await prisma.staff.create({
    data: { username, role: input.role, organisation: input.organisation, passwordHash: await hashPassword(generateToken(24)) },
  });
  const token = await issueInvite(staff.id, ownerId);
  await staffEvent(ownerId, ip, "staff.invited", "staff", staff.id, { username, role: input.role });
  return { staffId: staff.id, token };
}

export async function issueInvite(staffId: string, createdById: string | null) {
  const token = generateToken();
  await prisma.$transaction([
    prisma.staffInvite.updateMany({ where: { staffId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.staffInvite.create({ data: { tokenHash: hashToken(token), staffId, createdById, expiresAt: new Date(Date.now() + INVITE_HOURS * 3_600_000) } }),
  ]);
  return token;
}

export async function findInvite(token: string) {
  if (!token || token.length > 100) return null;
  const invite = await prisma.staffInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { staff: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date() || invite.staff.disabledAt) return null;
  return invite;
}

/** Shows the authenticator secret for an invite (created once, reused on refresh). */
export async function inviteAuthenticator(token: string) {
  const invite = await findInvite(token);
  if (!invite) return null;
  let secret: string;
  if (invite.staff.totpSecretEnc && !invite.staff.activatedAt) {
    secret = decryptText(invite.staff.totpSecretEnc, aad.staffTotp(invite.staffId));
  } else {
    secret = generateTotpSecret();
    await prisma.staff.update({ where: { id: invite.staffId }, data: { totpSecretEnc: encryptText(secret, aad.staffTotp(invite.staffId)), totpLastStep: null } });
  }
  return { username: invite.staff.username, role: invite.staff.role, secret, uri: totpUri(secret, invite.staff.username, "Kuro Trace Admin") };
}

/** Finishes setup: password (policy + breach check) and a working authenticator code. */
export async function completeInvite(token: string, password: string, code: string, ip: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const invite = await findInvite(token);
  if (!invite) return { ok: false, message: "This setup link has expired or was already used. Ask the owner for a new one." };
  const problem = checkPasswordPolicy(password);
  if (problem) return { ok: false, message: "Use a password of at least 12 characters." };
  if ((await checkPasswordBreach(password)).breached) return { ok: false, message: "This password has appeared in a data breach. Choose another." };
  if (!(await codeAccepted(invite.staff, code))) return { ok: false, message: "That code didn't match. Use the newest code in your authenticator app." };
  const { count } = await prisma.staffInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count !== 1) return { ok: false, message: "This setup link was already used." };
  await prisma.staff.update({ where: { id: invite.staffId }, data: { passwordHash: await hashPassword(password), activatedAt: new Date(), failedLogins: 0, lockedUntil: null } });
  await staffEvent(invite.staffId, ip, "staff.activated");
  return { ok: true };
}

/** Disables an account and ends its sessions immediately. */
export async function setStaffDisabled(ownerId: string, ip: string, staffId: string, disabled: boolean) {
  if (staffId === ownerId) throw new Error("You can't disable your own account.");
  await prisma.$transaction([
    prisma.staff.update({ where: { id: staffId }, data: { disabledAt: disabled ? new Date() : null } }),
    prisma.staffSession.deleteMany({ where: { staffId } }),
  ]);
  await staffEvent(ownerId, ip, disabled ? "staff.disabled" : "staff.enabled", "staff", staffId);
}

/** Wipes a person's password and authenticator and issues a fresh setup link. */
export async function resetStaff(ownerId: string, ip: string, staffId: string) {
  if (staffId === ownerId) throw new Error("Reset your own account from the command line instead.");
  await prisma.$transaction([
    prisma.staff.update({ where: { id: staffId }, data: { activatedAt: null, totpSecretEnc: null, totpLastStep: null, passwordHash: await hashPassword(generateToken(24)) } }),
    prisma.staffSession.deleteMany({ where: { staffId } }),
  ]);
  const token = await issueInvite(staffId, ownerId);
  await staffEvent(ownerId, ip, "staff.reset", "staff", staffId);
  return token;
}

export async function updateStaffAccess(ownerId: string, ip: string, staffId: string, input: { role: StaffRole; organisation: string | null; allowedIps: string | null }) {
  if (staffId === ownerId && input.role !== "OWNER") throw new Error("You can't remove your own owner role.");
  if (input.allowedIps) parseAllowList(input.allowedIps); // throws on a bad entry
  await prisma.staff.update({ where: { id: staffId }, data: { role: input.role, organisation: input.organisation, allowedIps: input.allowedIps } });
  await prisma.staffSession.deleteMany({ where: { staffId, NOT: { staffId: ownerId } } });
  await staffEvent(ownerId, ip, "staff.access_changed", "staff", staffId, { role: input.role });
}

export async function changeStaffPassword(staffId: string, sessionId: string, ip: string, current: string, next: string) {
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });
  if (!(await verifyPassword(staff.passwordHash, current))) return { ok: false as const, message: "Your current password is not correct." };
  if (checkPasswordPolicy(next)) return { ok: false as const, message: "Use at least 12 characters." };
  if ((await checkPasswordBreach(next)).breached) return { ok: false as const, message: "This password has appeared in a data breach. Choose another." };
  await prisma.staff.update({ where: { id: staffId }, data: { passwordHash: await hashPassword(next) } });
  await prisma.staffSession.deleteMany({ where: { staffId, id: { not: sessionId } } });
  await staffEvent(staffId, ip, "staff.password_changed");
  return { ok: true as const };
}
