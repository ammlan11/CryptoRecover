/**
 * Creates the first owner account (run once per environment, from a trusted machine).
 *
 *   npm run create-owner -w @kurotrace/admin -- --username alice
 *
 * Asks for a password, then shows a QR code (and the same key as text) to scan with an
 * authenticator app. The key is stored encrypted and is never shown again.
 * Later staff are invited from the admin terminal (Staff → Invite).
 *
 * Non-interactive use (CI only): OWNER_PASSWORD=... and, with ALLOW_FIXED_TOTP=true,
 * OWNER_TOTP_SECRET=... for a known authenticator secret.
 */
import { createInterface } from "node:readline/promises";
import QRCode from "qrcode";
import { stdin, stdout } from "node:process";
import { checkPasswordPolicy, hashPassword } from "@kurotrace/core/password";
import { generateTotpSecret, totpUri } from "@kurotrace/core/totp";
import { prisma } from "@kurotrace/db";
import { loadKeys } from "@kurotrace/services/keys";
import { audit } from "@kurotrace/services/audit";
import { encryptText } from "@kurotrace/services/crypto";
import { aad } from "@kurotrace/services/records";

async function main() {
  await loadKeys();
  const args = process.argv.slice(2);
  const username = (args[args.indexOf("--username") + 1] ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(username) || args.indexOf("--username") === -1) {
    console.error("Usage: npm run create-owner -w @kurotrace/admin -- --username <name>");
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
    const uri = totpUri(secret, username, "Kuro Trace Admin");
    console.log("\nScan this with your authenticator app now (Google Authenticator, Microsoft Authenticator, 1Password…).");
    console.log("It is shown only this once and is stored encrypted. Clear the screen afterwards (type: clear).\n");
    console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
    console.log(`  Can't scan? Choose "Enter a setup key" and type: ${secret.match(/.{1,4}/g)?.join(" ")}`);
    console.log("  (Time-based, account name: Kuro Trace Admin)\n");
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
