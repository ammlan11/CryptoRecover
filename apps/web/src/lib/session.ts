import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ipHashFor } from "@/lib/server-crypto";
import { clientIp } from "@/lib/request";
import { createSession, destroySession, resolveSession } from "@/server/sessions";

/**
 * __Host- prefix: the browser only accepts it over HTTPS, for this exact host, path "/".
 * SameSite=Lax (not Strict) so opening a link from an email still shows you signed in;
 * every state-changing request goes through a server action, which Next.js protects
 * with an Origin check.
 */
const SESSION_COOKIE = "__Host-sid";
const CHALLENGE_COOKIE = "__Host-2fa";

export const currentSession = cache(async () => resolveSession((await cookies()).get(SESSION_COOKIE)?.value));

export async function requireUser() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return session;
}

export async function signIn(userId: string) {
  const h = await headers();
  const { token, expiresAt } = await createSession(userId, { userAgent: h.get("user-agent"), ipHash: ipHashFor(await clientIp()) });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
}

export async function signOut() {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

export async function setChallengeCookie(token: string) {
  (await cookies()).set(CHALLENGE_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 10 * 60 });
}

export async function takeChallengeCookie() {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value;
}

export async function clearChallengeCookie() {
  (await cookies()).delete(CHALLENGE_COOKIE);
}
