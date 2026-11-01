/**
 * Lost-phone recovery for a reporter, run by the owner on the server after checking
 * the person's identity (e.g. they reply from the account's email and describe their report).
 *
 *   npm run reset-user-phone -w @kurotrace/admin -- --email person@example.com
 *
 * Clears the confirmed number and signs them out everywhere. At their next log-in they
 * confirm a new number before they can do anything else. The change is audit-logged.
 */
import { prisma } from "@kurotrace/db";
import { audit } from "@kurotrace/services/audit";
import { emailHashFor } from "@kurotrace/services/crypto";
import { loadKeys } from "@kurotrace/services/keys";

async function main() {
  await loadKeys();
  const args = process.argv.slice(2);
  const email = args[args.indexOf("--email") + 1];
  if (args.indexOf("--email") === -1 || !email) throw new Error("Usage: npm run reset-user-phone -w @kurotrace/admin -- --email person@example.com");
  const user = await prisma.user.findUnique({ where: { emailHash: emailHashFor(email, "user.email") }, select: { id: true } });
  if (!user) throw new Error("No account with that email.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { phoneEnc: null, phoneHash: null, phoneVerifiedAt: null } }),
    prisma.phoneCode.deleteMany({ where: { userId: user.id } }),
    prisma.userSession.deleteMany({ where: { userId: user.id } }),
    prisma.loginChallenge.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit({ actorType: "system", actorId: null, action: "user.phone_reset", entity: "user", entityId: user.id, ip: null, detail: { via: "owner_cli" } });
  console.log("Phone number cleared and all sessions ended. They'll confirm a new number at their next log-in.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
