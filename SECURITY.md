# Security policy

## Reporting a vulnerability

Email **[security@demo-domain]** with details and steps to reproduce. Please do not open a
public issue. We acknowledge reports within 2 business days.

## How this codebase protects data

- **Field-level encryption.** Personal data and report narratives are encrypted with AES-256-GCM
  in the application before they reach the database (`packages/core/src/crypto.ts`). Keys rotate
  through a key ring; production keys live in a cloud KMS, never in the repo or `.env` files.
- **Blind indexes.** Emails are looked up through an HMAC, so the database never holds them in
  plain text.
- **Passwords.** Argon2id, minimum 12 characters, checked against known breaches using the
  k-anonymity range API (only the first 5 hash characters leave the server).
- **Sessions.** Random 256-bit tokens; only their SHA-256 hash is stored. Cookies are `__Host-`
  prefixed, HttpOnly, Secure, SameSite=Strict.
- **Admin isolation.** The admin terminal is a separate app with its own staff table, an IP
  allow-list enforced before any page renders, mandatory second factor, and `noindex`.
- **Audit log.** Every staff action is written to an append-only, hash-chained log; a deleted or
  edited row breaks the chain and is detectable.
- **Headers.** Strict, nonce-based Content Security Policy, HSTS, frame denial, no referrer
  leakage, restrictive permissions policy.

## Never

- Commit secrets, `.env` files or real report data.
- Ask users for seed phrases, private keys or identity documents.
- Load analytics or ad pixels on account, report or admin pages.
