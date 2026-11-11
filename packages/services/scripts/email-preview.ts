/**
 * Writes every email as an HTML file you can open in a browser, to check the design.
 *   npm run email-preview        → opens nothing, prints the folder
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { templates } from "../src/email";

const out = join(process.cwd(), "email-previews");
mkdirSync(out, { recursive: true });
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const samples = {
  "welcome-confirm-email": templates.verifyEmail(`${site}/verify-email?token=sample`),
  "reset-password": templates.resetPassword(`${site}/reset-password?token=sample`),
  "sign-in-code": templates.loginCode("483920", 10),
  "already-registered": templates.alreadyRegistered(`${site}/login`, `${site}/forgot-password`),
  "continue-report": templates.continueReport(`${site}/continue?token=sample`),
  "password-changed": templates.passwordChanged(),
  "two-step-on": templates.twoStepChanged(true),
  "phone-changed": templates.phoneChanged("+81 ••• ••• 5678", `${site}/forgot-password`),
  "report-received": templates.reportReceived("DM-7KQ2P"),
  "new-message": templates.newMessage("DM-7KQ2P"),
  "info-needed": templates.infoNeeded("DM-7KQ2P"),
  "report-closed": templates.reportClosed("DM-7KQ2P"),
};
for (const [name, mail] of Object.entries(samples)) {
  writeFileSync(join(out, `${name}.html`), mail.html ?? "");
  writeFileSync(join(out, `${name}.txt`), `Subject: ${mail.subject}\n\n${mail.text}\n`);
}
console.log(`Wrote ${Object.keys(samples).length} emails to ${out} (open the .html files in a browser).`);
