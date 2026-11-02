/**
 * Phone-size layout check for every page of the site and the admin terminal.
 * At each width it fails if the page scrolls sideways, and names the elements that stick
 * out. Screenshots go to RESPONSIVE_SHOTS (CI keeps them as a downloadable artifact).
 *
 *   WEB_URL=… ADMIN_URL=… node test/e2e/responsive-check.mjs            # public pages only
 *   … with EMAIL_OUTBOX_FILE, OWNER_PASSWORD, OWNER_TOTP_SECRET set    # + account and admin pages
 */
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const SHOTS = process.env.RESPONSIVE_SHOTS ?? "/tmp/responsive";
const WIDTHS = [360, 390, 768];
mkdirSync(SHOTS, { recursive: true });

const PUBLIC = ["/", "/scams", "/scams/pig-butchering", "/privacy", "/lp/broker-scams", "/lp/fake-apps", "/lp/report", "/login", "/signup", "/forgot-password"];
const ACCOUNT = ["/account/reports", "/account/reports/new", "/account/settings", "/account/settings/two-step", "/account/settings/phone", "/account/issues/new"];
const ADMIN_PAGES = ["/", "/reports", "/indicators", "/leads", "/issues", "/audit", "/staff", "/account"];

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

const problems = [];

async function check(context, base, path, label) {
  const page = await context.newPage();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 860 });
    // "load", not "networkidle": the bot-check widget keeps a connection open.
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(600); // let fonts and late layout settle
    const result = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflow = document.documentElement.scrollWidth - vw;
      const offenders = [];
      if (overflow > 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= vw + 1) continue;
          // Ignore things inside a deliberately scrollable box (e.g. a wide table).
          let p = el.parentElement, clipped = false;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") { clipped = true; break; }
            p = p.parentElement;
          }
          if (clipped) continue;
          const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "");
          offenders.push(`${name} (right edge ${Math.round(r.right)}px)`);
          if (offenders.length >= 5) break;
        }
      }
      return { overflow, offenders, finalUrl: location.pathname };
    });
    const file = `${SHOTS}/${label}${path.replace(/[^a-z0-9]+/gi, "_")}-${width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    if (result.overflow > 1) problems.push(`${label} ${path} @${width}px scrolls sideways by ${result.overflow}px: ${result.offenders.join(", ") || "(no single element found)"}`);
  }
  await page.close();
  console.log(`✓ ${label} ${path}`);
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] } : {});
try {
  const anon = await browser.newContext();
  for (const p of PUBLIC) await check(anon, WEB, p, "site");

  // Account pages: sign up a fresh user and log in with the emailed code.
  if (process.env.EMAIL_OUTBOX_FILE) {
    const email = `mobile-${Date.now()}@example.com`;
    const password = "a long and memorable passphrase";
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${WEB}/signup`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#phone", "+81 90 1234 5678");
    await page.check("input[name=terms]");
    await page.click("button[type=submit]");
    await page.getByText("Check your inbox").waitFor();
    await page.goto(`${WEB}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("button[type=submit]");
    await page.waitForURL("**/login/two-step**");
    const mails = readFileSync(process.env.EMAIL_OUTBOX_FILE, "utf8").trim().split("\n").map((l) => JSON.parse(l)).reverse();
    const code = /code is:\s+(\d{6})/.exec(mails.find((m) => m.to === email && /sign-in code$/.test(m.subject)).text)[1];
    await page.fill("#code", code);
    await page.click("button:has-text('Verify')");
    await page.waitForURL("**/account/reports");
    await page.close();
    for (const p of ACCOUNT) await check(ctx, WEB, p, "account");
  }

  // Admin pages, signed in as the owner from an allowed IP.
  const adminCtx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "127.0.0.1" } });
  for (const p of ["/login"]) await check(adminCtx, ADMIN, p, "admin");
  if (process.env.OWNER_TOTP_SECRET) {
    const page = await adminCtx.newPage();
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000); // a fresh authenticator window
    await page.goto(`${ADMIN}/login`);
    await page.fill("#username", "owner");
    await page.fill("#password", process.env.OWNER_PASSWORD);
    await page.fill("#code", totp(process.env.OWNER_TOTP_SECRET));
    await page.click("button:has-text('Sign in')");
    await page.waitForURL(`${ADMIN}/`);
    const caseHref = await page.goto(`${ADMIN}/reports`).then(() => page.locator("table a.code").first().getAttribute("href").catch(() => null));
    await page.close();
    for (const p of [...ADMIN_PAGES, ...(caseHref ? [caseHref] : [])]) await check(adminCtx, ADMIN, p, "admin");
  }
} catch (error) {
  const flat = (v) => String(v).replace(/\s+/g, " ").slice(0, 700);
  console.log(`::error title=Phone-size check crashed::${flat(error?.message ?? error)}`);
  throw error;
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.log(`::error title=Not mobile friendly::${p}`);
  process.exit(1);
}
console.log("\nEvery page fits phone screens without sideways scrolling.");
