import "server-only";
import { prisma } from "@kurotrace/db";
import { decryptText, emailHashFor } from "@kurotrace/services/crypto";
import { sendEmail, templates } from "@kurotrace/services/email";
import { siteUrl } from "@/lib/site";
import { USER_EMAIL_CONTEXT, userEmail } from "./accounts";
import { issueEmailToken } from "./email-tokens";

/**
 * "Finish your report" reminders. Two at most for each started report, then we stop:
 *  - leads: typed their email in "Start my report" but never used the emailed link;
 *  - drafts: have an account and a draft that was never sent.
 * Runs every 30 minutes from the "reminders" job (deploy/docker-compose.yml).
 */
const HOUR = 60 * 60 * 1000;
/** When each reminder is due, counted from when the report was started. */
export const REMINDER_AFTER = [24 * HOUR, 72 * HOUR] as const;
/** Older than this, the moment has passed: no reminders. */
const LEAD_WINDOW = 7 * 24 * HOUR;
const DRAFT_WINDOW = 14 * 24 * HOUR;
/** Don't nag someone who is still working on a draft. */
const QUIET_AFTER_EDIT = 12 * HOUR;
const BATCH = 200;
/** At least a day between two reminders, even if the job was paused for a while. */
const MIN_GAP = 24 * HOUR;
const spaced = (now: Date, step: number) => (step > 0 ? { lastReminderAt: { lte: new Date(now.getTime() - MIN_GAP) } } : {});

type Summary = { leads: number; drafts: number; skipped: number; failed: number };

export async function sendDueReminders(now = new Date()): Promise<Summary> {
  const summary: Summary = { leads: 0, drafts: 0, skipped: 0, failed: 0 };
  for (const [step, after] of REMINDER_AFTER.entries()) {
    await remindLeads(now, step, after, summary);
    await remindDrafts(now, step, after, summary);
  }
  return summary;
}

/** Claims a reminder slot so two runs can never send the same reminder twice. */
async function claim(table: "lead" | "report", id: string, step: number, now: Date) {
  const where = { id, remindersSent: step };
  const data = { remindersSent: step + 1, lastReminderAt: now };
  const res = table === "lead" ? await prisma.lead.updateMany({ where, data }) : await prisma.report.updateMany({ where, data });
  return res.count === 1;
}

async function release(table: "lead" | "report", id: string, step: number) {
  const where = { id, remindersSent: step + 1 };
  const data = { remindersSent: step, lastReminderAt: null };
  if (table === "lead") await prisma.lead.updateMany({ where, data });
  else await prisma.report.updateMany({ where, data });
}

async function remindLeads(now: Date, step: number, after: number, summary: Summary) {
  const leads = await prisma.lead.findMany({
    where: {
      source: { in: ["HERO_FORM", "CAMPAIGN_FORM"] },
      convertedReportId: null,
      remindersSent: step,
      ...spaced(now, step),
      createdAt: { lte: new Date(now.getTime() - after), gte: new Date(now.getTime() - LEAD_WINDOW) },
    },
    orderBy: { createdAt: "desc" },
    take: BATCH,
  });
  const seen = new Set<string>();
  for (const lead of leads) {
    // One reminder per person, even if they used the form more than once.
    if (seen.has(lead.emailHash)) {
      await prisma.lead.update({ where: { id: lead.id }, data: { remindersSent: REMINDER_AFTER.length } });
      summary.skipped++;
      continue;
    }
    seen.add(lead.emailHash);
    const email = decryptText(lead.emailEnc, "lead.email");
    const userHash = emailHashFor(email, USER_EMAIL_CONTEXT);
    // Already made an account (by the link or by signing up): the draft reminders take over.
    if (await prisma.user.findUnique({ where: { emailHash: userHash }, select: { id: true } })) {
      await prisma.lead.update({ where: { id: lead.id }, data: { remindersSent: REMINDER_AFTER.length } });
      summary.skipped++;
      continue;
    }
    if (!(await claim("lead", lead.id, step, now))) continue;
    try {
      const token = await issueEmailToken(userHash, "CONTINUE_REPORT", lead.id);
      await sendEmail({ to: email, ...templates.reminderContinue(`${siteUrl}/continue?token=${token}`, step === REMINDER_AFTER.length - 1) });
      summary.leads++;
    } catch (error) {
      await release("lead", lead.id, step);
      summary.failed++;
      console.error("reminder (lead) failed", error instanceof Error ? error.message : error);
    }
  }
}

async function remindDrafts(now: Date, step: number, after: number, summary: Summary) {
  const drafts = await prisma.report.findMany({
    where: {
      status: "DRAFT",
      userId: { not: null },
      remindersSent: step,
      ...spaced(now, step),
      createdAt: { lte: new Date(now.getTime() - after), gte: new Date(now.getTime() - DRAFT_WINDOW) },
      updatedAt: { lte: new Date(now.getTime() - QUIET_AFTER_EDIT) },
      user: { deletedAt: null, emailVerifiedAt: { not: null } },
    },
    orderBy: { createdAt: "desc" },
    take: BATCH,
    include: { user: { select: { id: true, emailEnc: true } } },
  });
  const seen = new Set<string>();
  for (const draft of drafts) {
    // One email per person per run, about their newest draft.
    if (!draft.user || seen.has(draft.user.id)) continue;
    seen.add(draft.user.id);
    if (!(await claim("report", draft.id, step, now))) continue;
    try {
      await sendEmail({ to: userEmail(draft.user), ...templates.reminderDraft(draft.publicRef, step === REMINDER_AFTER.length - 1) });
      summary.drafts++;
    } catch (error) {
      await release("report", draft.id, step);
      summary.failed++;
      console.error("reminder (draft) failed", error instanceof Error ? error.message : error);
    }
  }
}
