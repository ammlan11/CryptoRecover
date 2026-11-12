/**
 * Branded HTML for every email Kuro Trace sends. Each email also has a plain-text version;
 * mail apps show this HTML when they can and the text otherwise.
 *
 * Built for email clients, not browsers: tables for layout, inline styles only, no web
 * fonts, no scripts, one hosted image (the logo) with alt text so it reads fine when
 * images are blocked. Every value put into the HTML is escaped.
 */

export interface EmailContent {
  /** Short line some inboxes show after the subject. */
  preheader: string;
  heading: string;
  /** Paragraphs before the button or code. */
  intro: string[];
  button?: { label: string; url: string };
  /** A one-time code shown large (sign-in codes). */
  code?: string;
  /** Small print after the button or code: expiry, "if this wasn't you", … */
  after?: string[];
  /** Highlighted warning (e.g. a security change the reader didn't make). */
  alert?: string;
}

const C = {
  page: "#f2f4f9",
  navy: "#020b33",
  card: "#ffffff",
  line: "#e1e5f0",
  ink: "#0b1433",
  muted: "#4a5375",
  faint: "#7a829e",
  cyan: "#3fd0e6",
  danger: "#b42318",
  dangerBg: "#fef3f2",
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only our own http(s) links go into buttons. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";
}

const p = (text: string, style = "") =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.muted};${style}">${escapeHtml(text)}</p>`;

export function renderEmail(content: EmailContent, site: string): string {
  const siteUrl = site.replace(/\/$/, "");
  const host = escapeHtml(siteUrl.replace(/^https?:\/\//, ""));
  const logo = `${escapeHtml(siteUrl)}/brand/kuro-trace-horizontal-white.png`;

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
        <tr><td style="border-radius:6px;background:${C.navy}">
          <a href="${safeUrl(content.button.url)}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${MONO};font-size:14px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(content.button.label)}</a>
        </td></tr>
      </table>
      <p style="margin:0 0 24px;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.faint}">Button not working? Copy this link into your browser:<br>
        <a href="${safeUrl(content.button.url)}" style="color:${C.muted};word-break:break-all">${escapeHtml(content.button.url)}</a></p>`
    : "";

  const code = content.code
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px">
        <tr><td align="center" style="background:${C.page};border:1px solid ${C.line};border-radius:8px;padding:22px 12px;font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:10px;color:${C.ink}">${escapeHtml(content.code)}</td></tr>
      </table>`
    : "";

  const alert = content.alert
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px">
        <tr><td style="background:${C.dangerBg};border-left:4px solid ${C.danger};border-radius:4px;padding:14px 16px;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.danger}">${escapeHtml(content.alert)}</td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(content.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.page}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px">
      <tr><td style="background:${C.navy};border-radius:12px 12px 0 0;padding:26px 32px">
        <a href="${escapeHtml(siteUrl)}" target="_blank" style="text-decoration:none"><img src="${logo}" width="152" height="36" alt="Kuro Trace" style="display:block;border:0;color:#ffffff;font-family:${SANS};font-size:20px;font-weight:600"></a>
      </td></tr>
      <tr><td style="height:3px;line-height:3px;font-size:0;background:${C.cyan}">&nbsp;</td></tr>
      <tr><td style="background:${C.card};padding:36px 32px 12px;border-left:1px solid ${C.line};border-right:1px solid ${C.line}">
        <h1 style="margin:0 0 18px;font-family:${SANS};font-size:24px;line-height:1.3;font-weight:600;color:${C.ink}">${escapeHtml(content.heading)}</h1>
        ${alert}
        ${content.intro.map((t) => p(t)).join("\n        ")}
        ${button}${code}
        ${(content.after ?? []).map((t) => p(t, `font-size:14px;color:${C.faint}`)).join("\n        ")}
      </td></tr>
      <tr><td style="background:${C.card};padding:0 32px 32px;border:1px solid ${C.line};border-top:0;border-radius:0 0 12px 12px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="border-top:1px solid ${C.line};padding-top:20px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
            <strong style="color:${C.ink}">Stay safe:</strong> Kuro Trace never asks for payment, a &ldquo;recovery fee&rdquo; or your seed phrase. If an email asks for any of these, it is not from us.
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:22px 16px 8px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint}">
        Kuro Trace &middot; Crypto scam research<br>
        <a href="${escapeHtml(siteUrl)}" style="color:${C.faint}">${host}</a> &middot; <a href="${escapeHtml(siteUrl)}/privacy" style="color:${C.faint}">Privacy Policy</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
