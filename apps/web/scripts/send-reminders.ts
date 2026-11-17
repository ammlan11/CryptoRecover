/**
 * Sends the "finish your report" reminders that are due (see src/server/reminders.ts).
 * On the server this runs every 30 minutes in the "reminders" container.
 *   npm run reminders
 */
import { prisma } from "@kurotrace/db";
import { loadKeys } from "@kurotrace/services/keys";
import { sendDueReminders } from "@/server/reminders";

async function main() {
  await loadKeys();
  const summary = await sendDueReminders();
  // The email log (Admin → Emails sent) keeps 90 days, as the Privacy Policy says.
  await prisma.emailSend.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } });
  if (summary.leads || summary.drafts || summary.failed) {
    console.log(`reminders: ${summary.leads} to people who started a report, ${summary.drafts} about unsent drafts, ${summary.failed} failed`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("reminders failed:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
