/**
 * Security headers shared by the public site and the admin terminal.
 * Web-standard APIs only, so this runs inside the Next.js request proxy.
 */

export interface CspOptions {
  nonce: string;
  dev?: boolean;
  /** Extra script origins, e.g. ad pixels on campaign pages only. Never on account or admin pages. */
  extraScriptSrc?: string[];
  extraConnectSrc?: string[];
  extraImgSrc?: string[];
  /** Third-party frames, e.g. the bot-check widget. Default: no frames at all. */
  extraFrameSrc?: string[];
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildCsp(opts: CspOptions): string {
  const script = ["'self'", `'nonce-${opts.nonce}'`, "'strict-dynamic'", ...(opts.extraScriptSrc ?? [])];
  if (opts.dev) script.push("'unsafe-eval'"); // Next.js dev overlay and hot reload
  const connect = ["'self'", ...(opts.extraConnectSrc ?? [])];
  if (opts.dev) connect.push("ws:");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": script,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(opts.extraImgSrc ?? [])],
    "font-src": ["'self'"],
    "connect-src": connect,
    "frame-src": opts.extraFrameSrc?.length ? opts.extraFrameSrc : ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const csp = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!opts.dev) csp.push("upgrade-insecure-requests");
  return csp.join("; ");
}

export function securityHeaders(opts: { admin?: boolean; dev?: boolean } = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": opts.admin ? "no-referrer" : "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (!opts.dev) headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  if (opts.admin) {
    headers["X-Robots-Tag"] = "noindex, nofollow, noarchive";
    headers["Cache-Control"] = "no-store";
  }
  return headers;
}
