import "server-only";
import { checkPasswordBreach } from "@kurotrace/core/breach";
import { checkPasswordPolicy, hashPassword, verifyPassword, type PasswordProblem } from "@kurotrace/core/password";
import { generateToken, hashToken } from "@kurotrace/core/tokens";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpUri, verifyTotp } from "@kurotrace/core/totp";
import { prisma } from "@kurotrace/db";
import { decryptText, emailHashFor, encryptText, protectEmail } from "@kurotrace/services/crypto";
import { siteUrl } from "@/lib/site";
import { userEvent } from "@kurotrace/services/audit";
import { consumeEmailToken, issueEmailToken, peekEmailToken } from "./email-tokens";
import { sendEmail, templates } from "@kurotrace/services/email";
import { destroyOtherSessions } from "./sessions";
import { storage } from "@kurotrace/services/storage";
import { loginCodeAccepted, maskEmail } from "./login-codes";
import { protectPhone } from "./phone";

export const USER_EMAIL_CONTEXT = "user.email";
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const CHALLENGE_MINUTES = 10;
const MAX_CHALLENGE_ATTEMPTS = 5;

/** A real Argon2id hash of a random password: verifying against it costs the same time as a real check. */
let dummyHash: Promise<string> | null = null;
const timingDummy = () => (dummyHash ??= hashPassword(generateToken(24)));

export type PasswordCheck = { ok: true } | { ok: false; message: string };

const POLICY_MESSAGES: Record<PasswordProblem, string> = {
  too_short: "Use at least 12 characters.",
  too_long: "Use 128 characters or fewer.",
  single_character: "Choose something less predictable.",
};

/** Policy plus breach check. A breached password is refused; an unreachable breach service is not. */
export async function checkNewPassword(password: string): Promise<PasswordCheck> {
  const problem = checkPasswordPolicy(password);
  if (problem) return { ok: false, message: POLICY_MESSAGES[problem] };
  const breach = await checkPasswordBreach(password);
  if (breach.breached) return { ok: false, message: "This password has appeared in a data breach. Please choose a different one." };
  return { ok: true };
}

export function userEmail(user: { id: string; emailEnc: string }) {
  return decryptText(user.emailEnc, USER_EMAIL_CONTEXT);
}

/**
 * Sign-up. The response never reveals whether an account exists: an existing owner
 * gets an "you already have an account" email instead of a second account.
 */
export async function registerUser(email: string, password: string, phoneE164: string): Promise<PasswordCheck> {
  const check = await checkNewPassword(password);
  if (!check.ok) return check;
  const { emailHash, emailEnc } = protectEmail(email, USER_EMAIL_CONTEXT);
  const existing = await prisma.user.findUnique({ where: { emailHash }, select: { id: true } });
  if (existing) {
    await sendEmail({ to: email, ...templates.alreadyRegistered(`${siteUrl}/login`, `${siteUrl}/forgot-password`) });
    return { ok: true };
  }
  const user = await prisma.user.create({ data: { emailHash, emailEnc, passwordHash: await hashPassword(password) } });
  await prisma.user.update({ where: { id: user.id }, data: protectPhone(user.id, phoneE164) });
  await sendVerification(user.id, email);
  await userEvent(user.id, "user.registered");
  return { ok: true };
}

export async function sendVerification(userId: string, email: string) {
  const token = await issueEmailToken(emailHashFor(email, USER_EMAIL_CONTEXT), "VERIFY_EMAIL");
  await sendEmail({ to: email, ...templates.verifyEmail(`${siteUrl}/verify-email?token=${token}`) });
  return userId;
}

export async function verifyEmail(token: string): Promise<boolean> {
  const row = await consumeEmailToken(token, "VERIFY_EMAIL");
  if (!row) return false;
  const user = await prisma.user.findUnique({ where: { emailHash: row.emailHash }, select: { id: true, emailVerifiedAt: true } });
  if (!user) return false;
  if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await userEvent(user.id, "user.email_verified");
  return true;
}

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: "two_step"; challenge: string; userId: string }
  | { ok: false; reason: "invalid" | "locked"; retryMinutes?: number };

/** Password check with per-account lockout. Wrong email and wrong password look identical. */
export async function authenticate(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { emailHash: emailHashFor(email, USER_EMAIL_CONTEXT) } });
  if (!user || user.deletedAt) {
    await verifyPassword(await timingDummy(), password);
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, reason: "locked", retryMinutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000) };
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await userEvent(user.id, lock ? "user.locked" : "user.login_failed");
    return lock ? { ok: false, reason: "locked", retryMinutes: LOCK_MINUTES } : { ok: false, reason: "invalid" };
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  // Every sign-in has a second step: a code emailed to the account's address, or
  // (for people who set one up) a code from their authenticator app.
  const token = generateToken();
  await prisma.loginChallenge.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000) },
  });
  return { ok: "two_step", challenge: token, userId: user.id };
}

/** Second step: an authenticator code or a recovery code. Five tries per challenge. */
export async function completeTwoStep(challengeToken: string, code: string): Promise<{ ok: true; userId: string } | { ok: false; expired?: boolean }> {
  const challenge = await prisma.loginChallenge.findUnique({ where: { tokenHash: hashToken(challengeToken) }, include: { user: true } });
  if (!challenge || challenge.expiresAt < new Date() || challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) return { ok: false, expired: true };
  await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
  const user = challenge.user;
  let accepted = false;
  const sixDigits = /^\d{6}$/.test(code.replace(/\s/g, ""));
  if (sixDigits && (await loginCodeAccepted(user.id, code))) {
    accepted = true;
  } else if (user.totpSecretEnc && sixDigits) {
    const step = verifyTotp(decryptText(user.totpSecretEnc, `user:${user.id}:totp`), code, Date.now(), user.totpLastStep);
    if (step !== null) {
      // Conditional update: a second request with the same code loses the race.
      const { count } = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step },
      });
      accepted = count === 1;
    }
  } else {
    const { count } = await prisma.userRecoveryCode.updateMany({
      where: { userId: user.id, codeHash: hashRecoveryCode(code), usedAt: null },
      data: { usedAt: new Date() },
    });
    accepted = count === 1;
    if (accepted) await userEvent(user.id, "user.recovery_code_used");
  }
  if (!accepted) return { ok: false };
  await prisma.loginChallenge.delete({ where: { id: challenge.id } });
  await userEvent(user.id, "user.login", "user", user.id, { twoStep: true });
  return { ok: true, userId: user.id };
}

/** Always behaves the same, whether or not the email has an account. */
export async function requestPasswordReset(email: string) {
  const emailHash = emailHashFor(email, USER_EMAIL_CONTEXT);
  const user = await prisma.user.findUnique({ where: { emailHash }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) return;
  const token = await issueEmailToken(emailHash, "RESET_PASSWORD");
  await sendEmail({ to: email, ...templates.resetPassword(`${siteUrl}/reset-password?token=${token}`) });
  await userEvent(user.id, "user.password_reset_requested");
}

export async function resetPassword(token: string, password: string): Promise<PasswordCheck> {
  const check = await checkNewPassword(password);
  if (!check.ok) return check;
  const row = await consumeEmailToken(token, "RESET_PASSWORD");
  if (!row) return { ok: false, message: "This link has expired or was already used. Request a new one." };
  const user = await prisma.user.findUnique({ where: { emailHash: row.emailHash } });
  if (!user) return { ok: false, message: "This link has expired or was already used. Request a new one." };
  await prisma.user.update({
    where: { id: user.id },
    // Clicking the emailed link also proves the address, so it counts as verified.
    data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  await destroyOtherSessions(user.id);
  await sendEmail({ to: userEmail(user), ...templates.passwordChanged() });
  await userEvent(user.id, "user.password_reset");
  return { ok: true };
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string): Promise<PasswordCheck> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, current))) return { ok: false, message: "Your current password is not correct." };
  const check = await checkNewPassword(next);
  if (!check.ok) return check;
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await destroyOtherSessions(userId, sessionId);
  await sendEmail({ to: userEmail(user), ...templates.passwordChanged() });
  await userEvent(userId, "user.password_changed");
  return { ok: true };
}

// ─── Two-step sign-in setup ─────────────────────────────────────

/** Stores a fresh secret (not yet active) and returns what the authenticator app needs. */
export async function beginTwoStepSetup(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpEnabledAt) return null;
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: encryptText(secret, `user:${userId}:totp`), totpLastStep: null } });
  return { secret, uri: totpUri(secret, userEmail(user)) };
}

export async function confirmTwoStep(userId: string, code: string): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpEnabledAt || !user.totpSecretEnc) return { ok: false };
  const step = verifyTotp(decryptText(user.totpSecretEnc, `user:${userId}:totp`), code);
  if (step === null) return { ok: false };
  const { codes, hashes } = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date(), totpLastStep: step } }),
    prisma.userRecoveryCode.deleteMany({ where: { userId } }),
    prisma.userRecoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
  ]);
  await sendEmail({ to: userEmail(user), ...templates.twoStepChanged(true) });
  await userEvent(userId, "user.two_step_enabled");
  return { ok: true, recoveryCodes: codes };
}

export async function disableTwoStep(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, password))) return false;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null } }),
    prisma.userRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await sendEmail({ to: userEmail(user), ...templates.twoStepChanged(false) });
  await userEvent(userId, "user.two_step_disabled");
  return true;
}

// ─── Continue-report link (from the hero and campaign forms) ────

/** Emails a lead a link to create their account and finish the report. */
export async function sendContinueReportLink(email: string, leadId: string) {
  const token = await issueEmailToken(emailHashFor(email, USER_EMAIL_CONTEXT), "CONTINUE_REPORT", leadId);
  await sendEmail({ to: email, ...templates.continueReport(`${siteUrl}/continue?token=${token}`) });
}

export async function inspectContinueLink(token: string) {
  const row = await peekEmailToken(token, "CONTINUE_REPORT");
  if (!row || !row.leadId) return null;
  const lead = await prisma.lead.findUnique({ where: { id: row.leadId } });
  if (!lead) return null;
  const email = decryptText(lead.emailEnc, "lead.email");
  const existing = await prisma.user.findUnique({ where: { emailHash: row.emailHash }, select: { id: true } });
  return { email, leadId: lead.id, scamType: lead.scamType, hasAccount: Boolean(existing) };
}

/** Creates the account from the link (the click proves the email), so it starts verified. */
export async function accountFromContinueLink(token: string, password: string, phoneE164: string): Promise<{ ok: true; userId: string; leadId: string } | { ok: false; message: string }> {
  const check = await checkNewPassword(password);
  if (!check.ok) return check;
  const info = await inspectContinueLink(token);
  if (!info || info.hasAccount) return { ok: false, message: "This link has expired or was already used." };
  const row = await consumeEmailToken(token, "CONTINUE_REPORT");
  if (!row) return { ok: false, message: "This link has expired or was already used." };
  const { emailHash, emailEnc } = protectEmail(info.email, USER_EMAIL_CONTEXT);
  const user = await prisma.user.create({ data: { emailHash, emailEnc, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
  await prisma.user.update({ where: { id: user.id }, data: protectPhone(user.id, phoneE164) });
  await userEvent(user.id, "user.registered", "user", user.id, { via: "continue_link" });
  return { ok: true, userId: user.id, leadId: info.leadId };
}

// ─── Erasure ────────────────────────────────────────────────────

/** Deletes the account, its reports and their evidence files. Requires the password. */
export async function deleteAccount(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { reports: { include: { evidence: true } } } });
  if (!(await verifyPassword(user.passwordHash, password))) return false;
  for (const report of user.reports) {
    for (const file of report.evidence) await storage().remove(file.storageKey).catch(() => {});
  }
  await prisma.$transaction([prisma.report.deleteMany({ where: { userId } }), prisma.user.delete({ where: { id: userId } })]);
  await userEvent(userId, "user.deleted", "user", userId, { reports: user.reports.length });
  return true;
}

/** What the "enter your code" page should say for this sign-in. */
export async function challengeSummary(challengeToken: string | undefined) {
  if (!challengeToken) return null;
  const challenge = await prisma.loginChallenge.findUnique({
    where: { tokenHash: hashToken(challengeToken) },
    include: { user: { select: { id: true, emailEnc: true, totpEnabledAt: true } } },
  });
  if (!challenge || challenge.expiresAt < new Date()) return null;
  return { userId: challenge.userId, maskedEmail: maskEmail(userEmail(challenge.user)), hasApp: Boolean(challenge.user.totpEnabledAt) };
}
