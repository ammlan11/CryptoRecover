# Kuro Trace — crypto scam research platform

Brand: **Kuro Trace**. The production domain is set with `NEXT_PUBLIC_SITE_URL`.

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
npm run db:migrate             # applies packages/db/prisma/migrations
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

### Database changes without a local MySQL

Edit `packages/db/prisma/schema.prisma`, then put a short name in `packages/db/prisma/migrate.request`
(e.g. `add_partner_cases`) and push the branch. The "Generate migration" workflow creates the migration
on GitHub and commits it back. CI fails any pull request whose schema and migrations disagree.

### Tests

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm test` | Unit tests (crypto, 2FA, files, checker, attribution) | nothing |
| `npm run test:integration -w @kurotrace/web` | Accounts, sessions, two-step, reset, reports, evidence, audit chain | MySQL |
| `npm run test:e2e -w @kurotrace/web` | Browser: sign up → five-step report → evidence → message → two-step login | running server + MySQL |

All three run in CI on every pull request.

## Build phases

1. **Foundation** — monorepo, schema, security core, headers, CI *(done)*
2. **Public site** — approved home page design with lead capture, scam playbooks, checker, campaign landing pages (`/lp/broker-scams`, `/lp/fake-apps`, `/lp/report`), SEO *(done)*
3. **User terminal** — sign-up, two-step sign-in, five-step report form, encrypted evidence, messages, settings, erasure *(done)*
4. **Admin terminal** — staff sign-in with hardware key or TOTP, reports queue, investigator role, audit log
5. **Hardening and launch** — KMS keys, penetration test, backups, ad pixels and conversions

## Security

See [SECURITY.md](SECURITY.md).
