# Demo — crypto scam research platform

Working name **Demo** until the brand and domain are announced.

People share how a crypto scam reached them; an in-house research team and a private
investigation team study each report to classify the scam and link patterns; confirmed
findings are published as warnings. The platform does **not** recover money and never charges.

## What's in the repo

| Path | What it is | Runs on |
| --- | --- | --- |
| `apps/web` | Public site + user terminal (Next.js 16) | port 3000 |
| `apps/admin` | Admin terminal, separate app behind an IP allow-list | port 3001 |
| `packages/core` | Security building blocks: field encryption, Argon2id, tokens, breach check, IP allow-list, CSP, audit hash chain | — |
| `packages/db` | Prisma schema (MySQL 8) and client | — |

## Run locally

Needs Node 22 and MySQL 8.

```bash
cp .env.example .env          # then generate real keys (see the comments in the file)
npm install
npm run db:generate
npm run db:migrate             # once migrations exist (Phase 3)
npm run dev:web                # http://localhost:3000
npm run dev:admin              # http://localhost:3001 (127.0.0.1 is allow-listed by default)
```

Checks run in CI on every pull request:

```bash
npm run typecheck
npm test
npm audit --audit-level=high --omit=dev
npm run build
```

## Build phases

1. **Foundation** — monorepo, schema, security core, headers, CI *(this phase)*
2. **Public site** — approved home page design, scam pages, guides, checker, campaign landing pages, SEO
3. **User terminal** — sign-up with 2FA, report form, evidence upload, messages, research consent
4. **Admin terminal** — staff sign-in with hardware key or TOTP, reports queue, investigator role, audit log
5. **Hardening and launch** — KMS keys, penetration test, backups, ad pixels and conversions

## Security

See [SECURITY.md](SECURITY.md).
