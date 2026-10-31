/**
 * Creates the first owner account (run once per environment, from a trusted machine).
 *
 *   npm run create-owner -w @demo/admin -- --username alice
 *
 * Asks for a password, then prints an authenticator key and QR link to scan.
 * Later staff are invited from the admin terminal (Staff → Invite).
 *
 * Non-interactive use (CI only): OWNER_PASSWORD=... and, with ALLOW_FIXED_TOTP=true,
 * OWNER_TOTP_SECRET=... for a known authenticator secret.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { checkPasswordPolicy, hashPassword } from "@demo/core/password";
import { generateTotpSecret, totpUri } from "@demo/core/totp";
import { prisma } from "@demo/db";
import { audit } from "@demo/services/audit";
import { encryptText } from "@demo/services/crypto";
import { aad } from "@demo/services/records";

async function main() {
  const args = process.argv.slice(2);
  const username = (args[args.indexOf("--username") + 1] ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(username) || args.indexOf("--username") === -1) {
    console.error("Usage: npm run create-owner -w @demo/admin -- --username <name>");
    process.exit(1);
  }
  if (await prisma.staff.findUnique({ where: { username } })) {
    console.error(`A staff account named "${username}" already exists.`);
    process.exit(1);
  }

  let password = process.env.OWNER_PASSWORD ?? "";
  if (!password) {
    const rl = createInterface({ input: stdin, output: stdout });
    password = await rl.question("Password (at least 12 characters): ");
    rl.close();
  }
  if (checkPasswordPolicy(password)) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  const fixed = process.env.ALLOW_FIXED_TOTP === "true" ? process.env.OWNER_TOTP_SECRET : undefined;
  const secret = fixed ?? generateTotpSecret();
  const staff = await prisma.staff.create({ data: { username, role: "OWNER", passwordHash: await hashPassword(password), activatedAt: new Date() } });
  await prisma.staff.update({ where: { id: staff.id }, data: { totpSecretEnc: encryptText(secret, aad.staffTotp(staff.id)) } });
  await audit({ actorType: "system", actorId: null, action: "staff.owner_created", entity: "staff", entityId: staff.id, ip: null, detail: { username } });

  console.log(`\nOwner "${username}" created.`);
  if (!fixed) {
    console.log("\nAdd this to your authenticator app now. It will not be shown again:");
    console.log(`  Key: ${secret.match(/.{1,4}/g)?.join(" ")}`);
    console.log(`  Link: ${totpUri(secret, username, "Demo Admin")}\n`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
