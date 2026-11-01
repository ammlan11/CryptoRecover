/**
 * Browser smoke test of the user terminal, run in CI against a production build and MySQL.
 * Signs up, confirms a mobile number by text, sends a full report with evidence, messages the team, turns on two-step
 * sign-in and logs back in with a code. Fails loudly on any broken step.
 *
 *   BASE_URL=http://localhost:3000 MYSQL="mysql -h127.0.0.1 -uroot -proot demo_e2e" node test/e2e/smoke.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = "a long and memorable passphrase";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(512, 3)]);
const SMS_FILE = process.env.SMS_OUTBOX_FILE ?? "/tmp/kurotrace-sms.log";
const lastSmsCode = () => JSON.parse(readFileSync(SMS_FILE, "utf8").trim().split("\n").at(-1)).code;
const sql = (q) => execSync(`${process.env.MYSQL} -N -e "${q}"`).toString().trim();

function totp(secret, timeMs) {
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

const step = (name) => console.log(`✓ ${name}`);
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (e) => { throw new Error(`Page error: ${e.message}`); });

try {
  // Sign up
  await page.goto(`${BASE}/signup`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.check("input[name=terms]");
  await page.click("button[type=submit]");
  await page.getByText("Check your inbox").waitFor();
  step("sign up");

  // Unverified accounts can't send reports; confirm the email the way the link would
  sql(`UPDATE User SET emailVerifiedAt = NOW(3) WHERE emailVerifiedAt IS NULL`);

  // Log in
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  // Every account confirms a mobile number before anything else.
  await page.waitForURL("**/verify-phone");
  await page.goto(`${BASE}/account/reports`);
  await page.waitForURL("**/verify-phone");
  await page.fill("#phone", "+94 77 123 4567");
  await page.click("button:has-text('Text me a code')");
  await page.getByText("We texted a 6-digit code").waitFor();
  await page.fill("#code", "000000");
  await page.click("button:has-text('Confirm number')");
  await page.getByText("That code isn't right").waitFor();
  await page.fill("#code", lastSmsCode());
  await page.click("button:has-text('Confirm number')");
  await page.waitForURL("**/account/reports");
  step("log in, then confirm a mobile number with a texted code");

  // New report → five steps
  await page.click("text=+ New report");
  await page.waitForURL("**/account/reports/new");
  await page.click("text=Telegram / WhatsApp broker");
  await page.click("button:has-text('Start')");
  await page.waitForURL(/\/account\/reports\/DM-[A-Z0-9]{5}\/edit/);
  const ref = /DM-[A-Z0-9]{5}/.exec(page.url())[0];

  await page.fill("#narrative", "A trading mentor on Telegram asked me to pay a 15% release fee.");
  await page.selectOption("#lossBand", "FROM_1K_TO_10K");
  await page.fill("#country", "GB");
  await page.click("button:has-text('Save and continue')");
  await page.waitForURL("**?step=2");
  await page.selectOption("#channel", "TELEGRAM");
  await page.fill("#handle", "@mentor_e2e");
  await page.fill("#website", "https://www.fake-e2e-app.com/login");
  await page.click("button:has-text('Save and continue')");
  await page.waitForURL("**?step=3");
  await page.fill("#amount", "2500");
  await page.selectOption("#asset", "USDT");
  await page.fill("#toAddress", "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE");
  await page.click("button:has-text('+ Add payment')");
  await page.getByText("Payment 1: 2500 USDT").waitFor();
  await page.click("button:has-text('Continue')");
  await page.waitForURL("**?step=4");
  await page.setInputFiles("#files", { name: "chat.png", mimeType: "image/png", buffer: PNG });
  await page.click("button:has-text('Upload')");
  await page.getByText("chat.png").waitFor();
  await page.click("button:has-text('Continue')");
  await page.waitForURL("**?step=5");
  await page.check("input[name=accurate]");
  await page.check("input[name=research]");
  await page.click("button:has-text('Send report')");
  await page.waitForURL(`**/account/reports/${ref}?sent=1`);
  await page.getByText("Your report was sent").waitFor();
  step(`report ${ref} sent through all five steps`);

  assert.equal(sql(`SELECT status FROM Report WHERE publicRef='${ref}'`), "RECEIVED");
  assert.equal(sql(`SELECT COUNT(*) FROM ReportIndicator i JOIN Report r ON r.id=i.reportId WHERE r.publicRef='${ref}'`), "3");
  assert.ok(!sql(`SELECT narrativeEnc FROM Report WHERE publicRef='${ref}'`).includes("release fee"), "narrative must be encrypted");
  step("database: status, indicators, encrypted narrative");

  // Message
  await page.fill("#body", "Adding the transaction ID tomorrow.");
  await page.click("button:has-text('Send message')");
  await page.locator(".messages").getByText("Adding the transaction ID tomorrow.").waitFor();
  step("secure message");

  // Evidence download: owner gets the exact file as an attachment; anonymous gets 404
  const href = await page.locator("a[href*='/evidence/']").first().getAttribute("href");
  const res = await page.request.get(`${BASE}${href}`);
  assert.equal(res.status(), 200);
  assert.match(res.headers()["content-disposition"], /^attachment/);
  assert.ok(Buffer.from(await res.body()).equals(PNG), "downloaded file must match the upload");
  const anon = await (await browser.newContext()).request.get(`${BASE}${href}`);
  assert.equal(anon.status(), 404);
  step("evidence download (owner only)");

  // Two-step sign-in
  await page.goto(`${BASE}/account/settings/two-step`);
  const secret = (await page.locator(".code-chip").innerText()).replace(/\s+/g, "");
  await page.fill("#code", totp(secret, Date.now()));
  await page.click("button:has-text('Turn on')");
  await page.getByRole("region", { name: "Recovery codes" }).waitFor();
  step("two-step sign-in turned on");

  await page.click("button:has-text('Log out')");
  await page.waitForURL("**/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/login/two-step**");
  await page.getByText(/We texted a 6-digit code to \+94 ••• ••• 567/).waitFor();
  await page.getByText("You can also use a code from your authenticator app").waitFor();
  await page.fill("#code", lastSmsCode());
  await page.click("button[type=submit]");
  await page.waitForURL("**/account/reports");
  await page.getByText(ref).waitFor();
  step("logged back in with the texted code");

  await page.click("button:has-text('Log out')");
  await page.waitForURL("**/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/login/two-step**");
  // The code used to turn it on can't be replayed: wait for the next 30-second window.
  await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
  await page.fill("#code", totp(secret, Date.now()));
  await page.click("button[type=submit]");
  await page.waitForURL("**/account/reports");
  step("or with an authenticator app code instead");

  // Logged-out users can't see account pages
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto(`${BASE}/account/reports/${ref}`);
  assert.match(fresh.url(), /\/login$/);
  step("account pages require sign-in");

  console.log("\nAll end-to-end checks passed.");
} finally {
  await browser.close();
}
