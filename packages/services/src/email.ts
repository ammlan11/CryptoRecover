import "server-only";
import { appendFileSync } from "node:fs";
import { createTransport, type Transporter } from "nodemailer";
import { renderEmail, type EmailContent } from "./email-layout";
import { siteUrl } from "./site";

/**
 * Outgoing email. Providers:
 * - "postmark": production (POSTMARK_SERVER_TOKEN, EMAIL_FROM)
 * - "smtp":     production with any mailbox, e.g. Hostinger Email (SMTP_HOST, SMTP_PORT,
 *               SMTP_USER, SMTP_PASS, EMAIL_FROM). Always encrypted (TLS), certificate checked.
 * - "log":      development only; prints the message, including links, to the server log
 * - "memory":   tests; messages collect in `outbox`
 * - "none":     end-to-end tests; messages are dropped
 * - "file":     CI only (needs ALLOW_TEST_EMAIL=true); appends messages to EMAIL_OUTBOX_FILE
 *               so browser tests can read sign-in codes
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
  /** Branded version shown by mail apps that support HTML. */
  html?: string;
}

export const outbox: Email[] = [];

let transport: Transporter | null = null;
function smtp(): Transporter {
  if (transport) return transport;
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass || !process.env.EMAIL_FROM) throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM must be set");
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport = createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS from the start; 587 = STARTTLS, which we then require
    requireTLS: port !== 465,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

export async function sendEmail(email: Email): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? (process.env.NODE_ENV === "production" ? "postmark" : "log");
  if (provider === "memory") {
    outbox.push(email);
    return;
  }
  if (provider === "none") {
    // End-to-end tests: drop the message. Never logs links, so it is safe on any server.
    return;
  }
  if (provider === "file") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_EMAIL !== "true") throw new Error("EMAIL_PROVIDER=file needs ALLOW_TEST_EMAIL=true (CI only)");
    appendFileSync(process.env.EMAIL_OUTBOX_FILE ?? "/tmp/kurotrace-email.log", `${JSON.stringify(email)}\n`);
    return;
  }
  if (provider === "log") {
    if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER=log is not allowed in production");
    console.info(`\n[email] to=${email.to}\nsubject: ${email.subject}\n${email.text}\n`);
    return;
  }
  if (provider === "smtp") {
    await smtp().sendMail({ from: process.env.EMAIL_FROM, to: email.to, subject: email.subject, text: email.text, ...(email.html ? { html: email.html } : {}) });
    return;
  }
  if (provider === "postmark") {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    const from = process.env.EMAIL_FROM;
    if (!token || !from) throw new Error("POSTMARK_SERVER_TOKEN and EMAIL_FROM must be set");
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Postmark-Server-Token": token },
      body: JSON.stringify({ From: from, To: email.to, Subject: email.subject, TextBody: email.text, ...(email.html ? { HtmlBody: email.html } : {}), MessageStream: "outbound" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Postmark responded ${res.status}`);
    return;
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}"`);
}

const footer = `\n\n—\nKuro Trace never asks for payment, a "recovery fee" or your seed phrase. If an email asks for any of these, it is not from us.\n${siteUrl}`;
const notYou = "If this wasn't you, reset your password now.";

/** One email: the plain-text version plus the same content in the branded HTML layout. */
function mail(subject: string, text: string, content: EmailContent): Omit<Email, "to"> {
  return { subject, text: `${text}${footer}`, html: renderEmail(content, siteUrl) };
}

const resetButton = { label: "Reset my password", url: `${siteUrl}/forgot-password` };
const reportButton = (ref: string) => ({ label: "Open my report", url: `${siteUrl}/account/reports/${ref}` });

export const templates = {
  /** Sent when someone joins: welcome + confirm the address. */
  verifyEmail: (link: string) =>
    mail(
      "Welcome to Kuro Trace: confirm your email",
      `Welcome to Kuro Trace, and thank you for joining.\n\nWe collect reports of crypto scams so our researchers can work out how they operate, and we publish warnings so fewer people fall for them. Your reports are encrypted and never shown with your name.\n\nConfirm your email address to finish setting up your account:\n\n${link}\n\nThe link works for 24 hours. If you didn't sign up, ignore this email.`,
      {
        preheader: "Confirm your email to finish setting up your account.",
        heading: "Welcome to Kuro Trace",
        intro: [
          "Thank you for joining. We collect reports of crypto scams so our researchers can work out how they operate, and we publish warnings so fewer people fall for them.",
          "Your reports are encrypted and never shown with your name. Confirm your email address to finish setting up your account.",
        ],
        button: { label: "Confirm my email", url: link },
        after: ["The link works for 24 hours. If you didn't sign up, you can ignore this email."],
      },
    ),
  alreadyRegistered: (loginLink: string, resetLink: string) =>
    mail(
      "You already have a Kuro Trace account",
      `Someone tried to create an account with this email, but you already have one.\n\nLog in: ${loginLink}\nForgot your password? ${resetLink}\n\nIf this wasn't you, you can ignore this email.`,
      {
        preheader: "Log in instead, or reset your password.",
        heading: "You already have an account",
        intro: ["Someone tried to create an account with this email address, but you already have one."],
        button: { label: "Log in", url: loginLink },
        after: [`Forgot your password? Reset it here: ${resetLink}`, "If this wasn't you, you can ignore this email."],
      },
    ),
  resetPassword: (link: string) =>
    mail(
      "Reset your password",
      `Use this link to choose a new password:\n\n${link}\n\nThe link works for 1 hour and only once. If you didn't ask for this, ignore this email; your password stays the same.`,
      {
        preheader: "Choose a new password. The link works for 1 hour.",
        heading: "Reset your password",
        intro: ["We received a request to reset the password for your Kuro Trace account. Click the button to choose a new one."],
        button: { label: "Choose a new password", url: link },
        after: [
          "The link works for 1 hour and only once.",
          "If you didn't ask for this, ignore this email. Your password stays the same and nobody can change it without this link.",
        ],
      },
    ),
  continueReport: (link: string) =>
    mail(
      "Finish your scam report",
      `Thank you for starting a report. Use this secure link to finish it; it takes about 5 minutes:\n\n${link}\n\nThe link works for 7 days. Your report is encrypted and never published with your name.`,
      {
        preheader: "Pick up where you left off. About 5 minutes.",
        heading: "Finish your scam report",
        intro: ["Thank you for starting a report. Use this secure link to finish it; it takes about 5 minutes."],
        button: { label: "Continue my report", url: link },
        after: ["The link works for 7 days. Your report is encrypted and never published with your name."],
      },
    ),
  /** Reminder to someone who started a report on the home or campaign page but hasn't continued. */
  reminderContinue: (link: string, final: boolean) =>
    mail(
      final ? "Last reminder: your scam report is waiting" : "Your scam report is waiting",
      `You started a scam report on Kuro Trace but haven't finished it yet. It takes about 5 minutes, and every report helps us find the people behind these scams and warn others.\n\nPick up where you left off:\n\n${link}\n\nThe link works for 7 days.${final ? " This is the last reminder we'll send." : " We'll remind you once more, then stop."} Changed your mind? Just ignore this email.`,
      {
        preheader: "It takes about 5 minutes, and it helps warn others.",
        heading: final ? "Last reminder: your report is waiting" : "Your report is waiting",
        intro: [
          "You started a scam report on Kuro Trace but haven't finished it yet.",
          "It takes about 5 minutes. Every report helps us find the people behind these scams and warn others before they lose money too.",
        ],
        button: { label: "Finish my report", url: link },
        after: [
          `The link works for 7 days. ${final ? "This is the last reminder we'll send." : "We'll remind you once more, then stop."}`,
          "Changed your mind? Just ignore this email.",
        ],
      },
    ),
  /** Reminder to an account holder with an unsent draft. */
  reminderDraft: (ref: string, final: boolean) =>
    mail(
      final ? `Last reminder: report ${ref} isn't sent yet` : `Report ${ref} isn't sent yet`,
      `Your report ${ref} is saved as a draft, but it hasn't been sent to our research team yet. Nothing reaches them until you press "Send report".\n\nFinish it here: ${siteUrl}/account/reports/${ref}/edit\n\n${final ? "This is the last reminder we'll send about it." : "We'll remind you once more, then stop."}`,
      {
        preheader: "Our team can't see it until you send it.",
        heading: "Your report isn't sent yet",
        intro: [
          `Your report ${ref} is saved as a draft, but it hasn't been sent to our research team yet.`,
          "Nothing reaches them until you press \"Send report\". It only takes a few minutes to finish.",
        ],
        button: { label: "Finish and send", url: `${siteUrl}/account/reports/${ref}/edit` },
        after: [final ? "This is the last reminder we'll send about this report." : "We'll remind you once more, then stop."],
      },
    ),
  passwordChanged: () =>
    mail(
      "Your password was changed",
      `The password on your Kuro Trace account was just changed and other devices were signed out.\n\nIf this wasn't you, reset your password now: ${siteUrl}/forgot-password`,
      {
        preheader: "Your password was just changed.",
        heading: "Your password was changed",
        intro: ["The password on your Kuro Trace account was just changed, and other devices were signed out."],
        alert: notYou,
        button: resetButton,
      },
    ),
  twoStepChanged: (enabled: boolean) =>
    mail(
      enabled ? "Two-step sign-in is on" : "Two-step sign-in was turned off",
      `${enabled ? "Two-step sign-in is now on for your Kuro Trace account." : "Two-step sign-in was turned off on your Kuro Trace account."}\n\nIf this wasn't you, reset your password now: ${siteUrl}/forgot-password`,
      {
        preheader: enabled ? "Your authenticator app is now required to sign in." : "Your authenticator app is no longer required to sign in.",
        heading: enabled ? "Two-step sign-in is on" : "Two-step sign-in was turned off",
        intro: [enabled ? "Two-step sign-in is now on for your Kuro Trace account." : "Two-step sign-in was turned off on your Kuro Trace account."],
        alert: notYou,
        button: resetButton,
      },
    ),
  phoneChanged: (masked: string, resetLink: string) =>
    mail(
      "Your mobile number was changed",
      `The mobile number on your Kuro Trace account was changed to ${masked}.\n\nIf this wasn't you, reset your password now: ${resetLink}`,
      {
        preheader: `Your mobile number is now ${masked}.`,
        heading: "Your mobile number was changed",
        intro: [`The mobile number on your Kuro Trace account was changed to ${masked}.`],
        alert: notYou,
        button: { label: "Reset my password", url: resetLink },
      },
    ),
  loginCode: (code: string, minutes: number) =>
    mail(
      `${code} is your Kuro Trace sign-in code`,
      `Your sign-in code is:\n\n    ${code}\n\nIt works once, for ${minutes} minutes. Never share it: Kuro Trace will never ask you for this code by phone, chat or email.\n\nIf you didn't just try to log in, someone has your password. Reset it now: ${siteUrl}/forgot-password`,
      {
        preheader: `It works once, for ${minutes} minutes.`,
        heading: "Your sign-in code",
        intro: ["Enter this code to finish signing in:"],
        code,
        after: [
          `It works once, for ${minutes} minutes. Never share it: Kuro Trace will never ask you for this code by phone, chat or email.`,
          `If you didn't just try to log in, someone has your password. Reset it now: ${siteUrl}/forgot-password`,
        ],
      },
    ),
  /** Staff replies: the content stays inside the account, never in the email. */
  newMessage: (ref: string) =>
    mail(
      `New message about report ${ref}`,
      `Our research team sent you a message about report ${ref}. Log in to read it:\n\n${siteUrl}/account/reports/${ref}`,
      {
        preheader: "Log in to read it.",
        heading: "You have a new message",
        intro: [`Our research team sent you a message about report ${ref}. For your privacy, messages stay inside your account. Log in to read it.`],
        button: reportButton(ref),
      },
    ),
  infoNeeded: (ref: string) =>
    mail(
      `We have a question about report ${ref}`,
      `Our research team needs a little more detail on report ${ref}. Log in to see the question:\n\n${siteUrl}/account/reports/${ref}`,
      {
        preheader: "Log in to see the question.",
        heading: "We have a question",
        intro: [`Our research team needs a little more detail on report ${ref}. Log in to see the question.`],
        button: reportButton(ref),
      },
    ),
  reportClosed: (ref: string) =>
    mail(
      `Report ${ref} is closed`,
      `Thank you for report ${ref}. Our team has finished reviewing it, and what it showed now helps warn others. You can still read it in your account:\n\n${siteUrl}/account/reports/${ref}`,
      {
        preheader: "Thank you. What it showed now helps warn others.",
        heading: `Report ${ref} is closed`,
        intro: [`Thank you for report ${ref}. Our team has finished reviewing it, and what it showed now helps warn others.`, "You can still read it in your account."],
        button: reportButton(ref),
      },
    ),
  reportReceived: (ref: string) =>
    mail(
      `Report ${ref} received`,
      `Thank you. We received report ${ref}. Our research team reads every report, and we'll message you in your account if we have a question.\n\n${siteUrl}/account/reports/${ref}`,
      {
        preheader: "Our research team reads every report.",
        heading: "We received your report",
        intro: [`Thank you. We received report ${ref}. Our research team reads every report, and we'll message you in your account if we have a question.`],
        button: reportButton(ref),
      },
    ),
};
