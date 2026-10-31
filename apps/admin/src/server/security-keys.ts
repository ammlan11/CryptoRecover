import "server-only";
import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { prisma } from "@kurotrace/db";
import { audit } from "@kurotrace/services/audit";
import { decryptText, encryptText } from "@kurotrace/services/crypto";

/**
 * Security keys and passkeys for staff (WebAuthn). Phishing-resistant: the browser only
 * signs for the real admin address, so a look-alike site can't capture a usable sign-in.
 *
 * Challenges live in a short-lived, encrypted, Strict cookie bound to their purpose (and,
 * for registration and re-auth, to the staff member), and are consumed on first use.
 */
const CHALLENGE_COOKIE = "__Host-wa";
const CHALLENGE_SECONDS = 300;
const CHALLENGE_AAD = "staff:webauthn:challenge";
export const MAX_KEYS = 10;

type Purpose = "register" | "login" | "reauth";
type Pending = { c: string; p: Purpose; s: string | null; e: number };

export class KeyError extends Error {}

/** The admin's public address. Keys are tied to its hostname, so set it before anyone registers one. */
export function relyingParty() {
  const raw = process.env.ADMIN_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");
  if (!raw) throw new KeyError("Security keys aren't set up on this server yet (ADMIN_URL is missing).");
  const url = new URL(raw);
  return { origin: url.origin, rpID: url.hostname, name: "Kuro Trace Admin" };
}

/** When on, staff who have a key must use it: authenticator codes stop working for them. */
export function keysRequiredFor(keyCount: number) {
  return keyCount > 0 && process.env.STAFF_SECURITY_KEY_ONLY === "true";
}

async function remember(pending: Omit<Pending, "e">) {
  const value = encryptText(JSON.stringify({ ...pending, e: Date.now() + CHALLENGE_SECONDS * 1000 }), CHALLENGE_AAD);
  (await cookies()).set(CHALLENGE_COOKIE, value, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: CHALLENGE_SECONDS });
}

/** Reads and deletes the pending challenge: each one can be tried once. */
async function takeChallenge(purpose: Purpose, staffId: string | null): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  if (!raw || raw.length > 2000) return null;
  try {
    const pending = JSON.parse(decryptText(raw, CHALLENGE_AAD)) as Pending;
    if (pending.p !== purpose || pending.e < Date.now()) return null;
    if (pending.s !== null && pending.s !== staffId) return null;
    return pending.c;
  } catch {
    return null;
  }
}

export function parseCredentialJson<T>(value: string): T | null {
  if (!value || value.length > 20_000) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && typeof parsed.id === "string" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

// ─── Registration ────────────────────────────────────────────────

export async function registrationOptions(staff: { id: string; username: string }) {
  const rp = relyingParty();
  const existing = await prisma.webAuthnKey.findMany({ where: { staffId: staff.id }, select: { credentialId: true } });
  if (existing.length >= MAX_KEYS) throw new KeyError(`You can register up to ${MAX_KEYS} keys.`);
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.rpID,
    userName: staff.username,
    userID: new TextEncoder().encode(staff.id),
    attestationType: "none",
    excludeCredentials: existing.map((k) => ({ id: k.credentialId })),
    // Discoverable credentials, so sign-in needn't reveal which usernames have keys.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await remember({ c: options.challenge, p: "register", s: staff.id });
  return options;
}

export async function finishRegistration(staff: { id: string }, ip: string, label: string, response: RegistrationResponseJSON) {
  const expectedChallenge = await takeChallenge("register", staff.id);
  if (!expectedChallenge) throw new KeyError("That took too long. Please try again.");
  const rp = relyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: false });
  } catch {
    throw new KeyError("The key's response couldn't be verified. Please try again.");
  }
  if (!verification.verified) throw new KeyError("The key's response couldn't be verified. Please try again.");
  const { credential } = verification.registrationInfo;
  const key = await prisma.webAuthnKey.create({
    data: {
      staffId: staff.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      label: label.trim().slice(0, 64) || "Security key",
    },
  });
  await audit({ actorType: "staff", actorId: staff.id, action: "staff.key_added", entity: "webauthn_key", entityId: key.id, ip });
  return key;
}

export async function removeKey(staff: { id: string }, ip: string, keyId: string) {
  const { count } = await prisma.webAuthnKey.deleteMany({ where: { id: keyId, staffId: staff.id } });
  if (count) await audit({ actorType: "staff", actorId: staff.id, action: "staff.key_removed", entity: "webauthn_key", entityId: keyId, ip });
}

// ─── Sign-in and re-authentication ───────────────────────────────

export async function assertionOptions(purpose: "login" | "reauth", staffId: string | null) {
  const rp = relyingParty();
  const allow = purpose === "reauth" && staffId
    ? (await prisma.webAuthnKey.findMany({ where: { staffId }, select: { credentialId: true } })).map((k) => ({ id: k.credentialId }))
    : [];
  if (purpose === "reauth" && allow.length === 0) throw new KeyError("You don't have a security key yet.");
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, allowCredentials: allow, userVerification: "preferred" });
  await remember({ c: options.challenge, p: purpose, s: purpose === "reauth" ? staffId : null });
  return options;
}

/** True only if this signed response comes from one of `staffId`'s own keys. */
export async function keyAssertionValid(purpose: "login" | "reauth", staffId: string, response: AuthenticationResponseJSON): Promise<boolean> {
  const expectedChallenge = await takeChallenge(purpose, staffId);
  if (!expectedChallenge) return false;
  const key = await prisma.webAuthnKey.findUnique({ where: { credentialId: response.id } });
  if (!key || key.staffId !== staffId) return false;
  const rp = relyingParty();
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credential: { id: key.credentialId, publicKey: new Uint8Array(key.publicKey), counter: Number(key.counter) },
      requireUserVerification: false,
    });
    if (!verified) return false;
    // Signature counters only ever go up; a step backwards suggests a cloned key.
    await prisma.webAuthnKey.update({ where: { id: key.id }, data: { counter: BigInt(authenticationInfo.newCounter), lastUsedAt: new Date() } });
    return true;
  } catch {
    return false;
  }
}
