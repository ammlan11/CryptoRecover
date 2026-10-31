import "server-only";
import { siteUrl } from "@/lib/site";

/**
 * Outgoing email. Providers:
 * - "postmark": production (POSTMARK_SERVER_TOKEN, EMAIL_FROM)
 * - "log":      development only; prints the message, including links, to the server log
 * - "memory":   tests; messages collect in `outbox`
 * - "none":     end-to-end tests; messages are dropped
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
}

export const outbox: Email[] = [];

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
  if (provider === "log") {
    if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER=log is not allowed in production");
    console.info(`\n[email] to=${email.to}\nsubject: ${email.subject}\n${email.text}\n`);
    return;
  }
  if (provider === "postmark") {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    const from = process.env.EMAIL_FROM;
    if (!token || !from) throw new Error("POSTMARK_SERVER_TOKEN and EMAIL_FROM must be set");
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Postmark-Server-Token": token },
      body: JSON.stringify({ From: from, To: email.to, Subject: email.subject, TextBody: email.text, MessageStream: "outbound" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Postmark responded ${res.status}`);
    return;
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}"`);
}

const footer = `\n\n—\nDemo never asks for payment, a "recovery fee" or your seed phrase. If an email asks for any of these, it is not from us.\n${siteUrl}`;

export const templates = {
  verifyEmail: (link: string): Omit<Email, "to"> => ({
    subject: "Confirm your email",
    text: `Confirm your email address to finish setting up your Demo account:\n\n${link}\n\nThe link works for 24 hours. If you didn't sign up, ignore this email.${footer}`,
  }),
  alreadyRegistered: (loginLink: string, resetLink: string): Omit<Email, "to"> => ({
    subject: "You already have a Demo account",
    text: `Someone tried to create an account with this email, but you already have one.\n\nLog in: ${loginLink}\nForgot your password? ${resetLink}\n\nIf this wasn't you, you can ignore this email.${footer}`,
  }),
  resetPassword: (link: string): Omit<Email, "to"> => ({
    subject: "Reset your password",
    text: `Use this link to choose a new password:\n\n${link}\n\nThe link works for 1 hour and only once. If you didn't ask for this, ignore this email; your password stays the same.${footer}`,
  }),
  continueReport: (link: string): Omit<Email, "to"> => ({
    subject: "Finish your scam report",
    text: `Thank you for starting a report. Use this secure link to finish it; it takes about 5 minutes:\n\n${link}\n\nThe link works for 7 days. Your report is encrypted and never published with your name.${footer}`,
  }),
  passwordChanged: (): Omit<Email, "to"> => ({
    subject: "Your password was changed",
    text: `The password on your Demo account was just changed and other devices were signed out.\n\nIf this wasn't you, reset your password now: ${siteUrl}/forgot-password${footer}`,
  }),
  twoStepChanged: (enabled: boolean): Omit<Email, "to"> => ({
    subject: enabled ? "Two-step sign-in is on" : "Two-step sign-in was turned off",
    text: `${enabled ? "Two-step sign-in is now on for your Demo account." : "Two-step sign-in was turned off on your Demo account."}\n\nIf this wasn't you, reset your password now: ${siteUrl}/forgot-password${footer}`,
  }),
  reportReceived: (ref: string): Omit<Email, "to"> => ({
    subject: `Report ${ref} received`,
    text: `Thank you. We received report ${ref}. Our research team reads every report, and we'll message you in your account if we have a question.\n\n${siteUrl}/account/reports/${ref}${footer}`,
  }),
};
