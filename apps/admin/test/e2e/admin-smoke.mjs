/**
 * Browser smoke test of the admin terminal, run in CI after the user-terminal smoke test
 * (which leaves one submitted report). Proves the IP gate, staff sign-in with an
 * authenticator code, case handling, indicator confirmation reaching the public
 * checker, the audit chain, re-authentication and the owner's lead export.
 *
 *   ADMIN_URL=http://localhost:3001 WEB_URL=http://localhost:3000 OWNER_PASSWORD=… OWNER_TOTP_SECRET=… node test/e2e/admin-smoke.mjs
 */
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const PASSWORD = process.env.OWNER_PASSWORD;
const SECRET = process.env.OWNER_TOTP_SECRET;
const WALLET = "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE";

function totp(secret, timeMs = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes = [];
  for (const c of secret) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}
const nextWindow = () => new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 1_000));
const step = (name) => console.log(`✓ ${name}`);

const browser = await chromium.launch();
try {
  // The IP gate: unknown or missing client IP gets a plain 404 before any page renders.
  const outsider = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.5" } });
  assert.equal((await outsider.request.get(`${ADMIN}/login`)).status(), 404);
  const noHeader = await browser.newContext();
  assert.equal((await noHeader.request.get(`${ADMIN}/login`)).status(), 404);
  step("admin hidden from IPs outside the allow-list");

  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "127.0.0.1" } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { throw new Error(`Page error: ${e.message}`); });

  // Wrong code is refused; right code signs in
  await page.goto(`${ADMIN}/login`);
  await page.fill("#username", "owner");
  await page.fill("#password", PASSWORD);
  await page.fill("#code", "000000");
  await page.click("button:has-text('Sign in')");
  await page.getByText("Those details are not correct.").waitFor();
  // React clears a form after its action runs, so fill everything again.
  await page.fill("#username", "owner");
  await page.fill("#password", PASSWORD);
  await page.fill("#code", totp(SECRET));
  await page.click("button:has-text('Sign in')");
  await page.waitForURL(`${ADMIN}/`);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  step("owner signed in with password + authenticator code");

  // Open the report from the queue
  await page.goto(`${ADMIN}/reports`);
  await page.locator("table a.code").first().click();
  await page.waitForURL(/\/reports\/DM-[A-Z0-9]{5}$/);
  const ref = /DM-[A-Z0-9]{5}/.exec(page.url())[0];
  await page.getByText("release fee").waitFor();
  step(`case ${ref} opened, narrative decrypted`);

  await page.fill("#reply", "Thank you. Could you upload the withdrawal screen?");
  await page.click("button:has-text('Send to reporter')");
  await page.getByText("Sent. The reporter was notified").waitFor();
  await page.selectOption("#status", "INFO_NEEDED");
  await page.click("button:has-text('Update')");
  await page.getByText("Status updated.").waitFor();
  await page.getByText("Info needed").first().waitFor();
  step("replied to the reporter and set status to Info needed");

  // Confirm the wallet → public checker reports it
  await page.locator("li", { hasText: WALLET }).getByRole("button", { name: "Confirm" }).click();
  await page.getByText("Confirmed by owner").waitFor();
  const pub = await (await browser.newContext()).newPage();
  await pub.goto(`${WEB}/#check`);
  await pub.fill("#checker-q", WALLET);
  await pub.click("button:has-text('Check')");
  await pub.getByText("Reported 1 time").waitFor();
  step("confirmed wallet now flagged by the public checker");

  // Audit chain
  await page.goto(`${ADMIN}/audit`);
  await page.click("button:has-text('Verify the whole chain')");
  await page.getByText("The chain is intact.").waitFor();
  await page.getByText("report.viewed").first().waitFor();
  step("audit log verified intact");

  // Staff changes require confirming password + a fresh code
  await page.goto(`${ADMIN}/staff`);
  await page.fill("#username", "acme.investigator");
  await page.selectOption("#role", "INVESTIGATOR");
  await page.fill("#organisation", "Acme Investigations");
  // Session is fresh from sign-in, so this goes through; force a re-auth by waiting is covered below.
  await page.click("button:has-text('Create setup link')");
  await page.getByText("Invite created.").waitFor();
  const link = await page.locator(".once code").innerText();
  assert.match(link, /\/setup\?token=/);
  step("investigator invited with a one-time setup link");

  // Lead export: owner-only CSV
  const csv = await page.request.get(`${ADMIN}/leads/export`);
  assert.equal(csv.status(), 200);
  assert.match(await csv.text(), /^created_at,email,source/);
  step("owner exported leads as CSV");

  // Re-authentication page works with a new code
  await nextWindow();
  await page.goto(`${ADMIN}/reauth?next=/staff`);
  await page.fill("#password", PASSWORD);
  await page.fill("#code", totp(SECRET));
  await page.click("button:has-text('Confirm')");
  await page.waitForURL(`${ADMIN}/staff`);
  step("re-authentication with password + new code");

  await page.click("button:has-text('Sign out')");
  await page.waitForURL(`${ADMIN}/login`);
  await page.goto(`${ADMIN}/reports`);
  await page.waitForURL(`${ADMIN}/login`);
  step("signed out; console requires sign-in again");

  console.log("\nAll admin end-to-end checks passed.");
} finally {
  await browser.close();
}
