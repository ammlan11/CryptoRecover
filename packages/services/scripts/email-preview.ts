/**
 * Writes every email as an HTML file you can open in a browser, to check the design.
 *   npm run email-preview        → opens nothing, prints the folder
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
  "reminder-continue-1": templates.reminderContinue(`${site}/continue?token=sample`, false),
  "reminder-continue-2": templates.reminderContinue(`${site}/continue?token=sample`, true),
  "reminder-draft-1": templates.reminderDraft("DM-7KQ2P", false),
  "password-changed": templates.passwordChanged(),
  "two-step-on": templates.twoStepChanged(true),
  "phone-changed": templates.phoneChanged("+81 ••• ••• 5678", `${site}/forgot-password`),
  "report-received": templates.reportReceived("DM-7KQ2P"),
  "new-message": templates.newMessage("DM-7KQ2P"),
  "info-needed": templates.infoNeeded("DM-7KQ2P"),
  "report-closed": templates.reportClosed("DM-7KQ2P"),
};
// Real emails load the logo from the live site. For previews, use the file in the repo so it
// shows even when the site isn't running on this computer.
const brandDir = pathToFileURL(resolve(process.cwd(), "../../apps/web/public/brand")).href;
for (const [name, mail] of Object.entries(samples)) {
  writeFileSync(join(out, `${name}.html`), (mail.html ?? "").replaceAll(`${site}/brand/`, `${brandDir}/`));
  writeFileSync(join(out, `${name}.txt`), `Subject: ${mail.subject}\n\n${mail.text}\n`);
}
console.log(`Wrote ${Object.keys(samples).length} emails to ${out} (open the .html files in a browser).`);
