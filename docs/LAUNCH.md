# Kuro Trace launch checklist

The checklist has three parts:

- **Part A** is what's built into the code. It's done and tested in CI.
- **Part B** is what you plug in once you've tested and are happy: your accounts, keys and domain.
- **Part C** is the order of events on launch day.

Every setting named here is listed in `.env.example`, with notes.

---

## Part A: built and tested ✅

| Area | What it does | Checked by |
| --- | --- | --- |
| Brand | Kuro Trace appears everywhere: site, emails, the authenticator app entry and the admin | build |
| Bot protection | A Cloudflare Turnstile check on sign-up, log-in, reset, report start, wallet watch and newsletter. It's invisible unless Cloudflare is unsure. If its keys are missing, those forms are refused in production. | unit + browser tests |
| Virus scanning | Every evidence upload is scanned by ClamAV before it's stored, and infected files are refused. Files that couldn't be scanned yet are re-checked every 5 minutes, and staff can't open them until they're clean. | unit + live ClamAV in CI |
| Staff security keys | YubiKeys and passkeys for staff sign-in and re-authentication. They can't be phished, and setting `STAFF_SECURITY_KEY_ONLY=true` switches off authenticator codes for anyone who has registered a key. | browser test with a virtual key |
| Managed keys | The encryption keys can be wrapped by AWS KMS. They're unwrapped into memory only, and the server won't start without them. | unit tests |
| Ad measurement | Meta Pixel and the Google tag run on `/lp/*` pages only, after the visitor allows them. Started reports count as "Lead" conversions, sent both from the browser and from the server (Meta Conversions API). | browser check |
| Deployment | One Docker image that runs non-root on a read-only filesystem. Docker Compose sets up Caddy (automatic HTTPS), MySQL on a private network, ClamAV, migrations and backups. | CI builds and runs it |
| Backups | A nightly MySQL dump, encrypted to your public key, kept 30 days, with an optional off-site copy | CI does a real backup → restore → compare |
| Security scan | Every pull request runs automatic checks: headers, cookies, caching of private pages, the admin IP gate (including spoofed IPs), exposed files, and an OWASP ZAP scan | CI |
| Mobile | Every public, account and admin page is loaded at 360, 390 and 768px wide; any page that scrolls sideways fails the build, naming the element | CI + screenshots |
| Admin lockdown | Three locks: Caddy refuses IPs outside `ADMIN_IP_RANGES`; the app checks `ADMIN_ALLOWED_IPS` again; without a staff session every admin address goes to sign-in before any page runs. A test tries every admin page and download with no cookie and with a forged one | CI |
| Attack traffic | Scanner probes (WordPress, PHP, `.env`, `.git`, phpMyAdmin…) are dropped at Caddy without a reply; per-address flood limit (429); optional Cloudflare-only mode so nobody can bypass Cloudflare via the server IP | Caddy config validated + unit tests |

Built in earlier phases and still covered by tests:

- encryption of personal fields and evidence
- Argon2id passwords with a check against known breaches
- two-step sign-in
- a hash-chained audit log
- the admin hidden behind an IP allow-list, with staff sessions tied to their IP address

---

## Part B: your accounts and settings (add after testing)

Tick each item off as you set it. Items marked **required** must be done before real users arrive.

### Hosting (Hostinger VPS)
This project needs Docker (MySQL 8, the virus scanner and the two apps run as containers), so it runs on a **Hostinger VPS**, not on shared or website-builder hosting. Hostinger's VPS supports Docker and Docker Compose.
- [ ] **Required.** Choose a VPS with at least 2 vCPU and 8 GB RAM; the virus scanner alone uses about 1.5 GB. Pick **Ubuntu 24.04**, and the data centre nearest most of your visitors.
- [ ] **Required.** Turn on **two-factor login** for your Hostinger account. Whoever controls that account controls your domain, email and server.
- [ ] **Required.** Log in with an **SSH key**, not a password. Create a normal user with sudo, then run `sudo bash deploy/harden-server.sh <user>` on the server. It sets up the firewall, keys-only SSH, fail2ban and automatic security updates.
- [ ] In hPanel → VPS → **Firewall**, allow only ports 22, 80 and 443. This is a second firewall in front of the server's own.

### Domain and Cloudflare (free plan)
Brand-new domains get scanned within hours of going live. Cloudflare absorbs most of that before it reaches your server, and hides the server's IP address.
- [ ] **Required.** Buy the domain at Hostinger. Turn on **domain lock**, privacy protection and auto-renew.
- [ ] **Required.** Add the domain to a free Cloudflare account, then change the nameservers in hPanel → Domains → DNS / Nameservers to the two Cloudflare gives you. From then on, all DNS records (website and email) are managed in Cloudflare.
- [ ] **Required.** In Cloudflare DNS, add A records for `kurotrace.com`, `www` and `admin` pointing at the VPS IP, all with the **orange cloud (proxied)**.
- [ ] **Required.** Cloudflare settings:
  - SSL/TLS → **Full (strict)**
  - Security → WAF → turn on the free **managed rules**
  - **Bot Fight Mode**: on
  - Security level: medium
  - Leave **"Always Use HTTPS" off**. The server already redirects to HTTPS, and Cloudflare's redirect would block certificate renewal.
- [ ] **Required.** Add one Cloudflare **rate-limiting rule** (the free plan allows one): requests to `/login` or `/signup` above 20 per 10 seconds from one IP get blocked for 10 seconds.
- [ ] **Required.** On the server, run `bash deploy/cloudflare-ips.sh` and put the two lines it prints (`EDGE_IPS=…`, `TRUSTED_PROXIES=…`) in `deploy/.env`. The server will then only answer Cloudflare, so attackers can't get around Cloudflare by using the server's IP.
- [ ] **Required.** Set `SITE_DOMAIN`, `ADMIN_DOMAIN`, `NEXT_PUBLIC_SITE_URL=https://kurotrace.com` and `ADMIN_URL=https://admin.kurotrace.com`.
- [ ] **Required.** Set **both** `ADMIN_IP_RANGES` (space-separated) and `ADMIN_ALLOWED_IPS` (comma-separated) to your office or VPN IP addresses only. Everyone else gets a blank "not found" from the admin address.
- [ ] Under attack? In Cloudflare, switch on **"I'm Under Attack" mode**. Visitors get a short browser check, and floods stop at Cloudflare.

### Secrets (generate on a trusted computer)
- [ ] **Required.** Generate `FIELD_ENCRYPTION_KEYS` and `BLIND_INDEX_KEY`: run `openssl rand -base64 32` once for each. **Keep an offline copy.** Without these keys, the encrypted data can't be recovered.
- [ ] Recommended: create an AWS KMS key and run `npm run wrap-keys -w @kurotrace/admin`. Then put the `KMS_WRAPPED_KEYS` it prints on the server and delete the plain keys from it.
- [ ] **Required.** Set `MYSQL_ROOT_PASSWORD` and `MYSQL_APP_PASSWORD` to long random values.
- [ ] **Required.** Run `age-keygen -o kurotrace-backup.key` and keep that file **offline**. Put the public key it prints (`age1…`) in `BACKUP_AGE_RECIPIENT`.

### Email (Hostinger Email)
Every log-in sends a sign-in code by email, so delivery has to be reliable before launch.
- [ ] **Required.** In hPanel, create a mailbox just for the site, e.g. `no-reply@kurotrace.com`, with a long random password.
- [ ] **Required.** Set:
  - `EMAIL_PROVIDER=smtp`
  - `SMTP_HOST=smtp.hostinger.com`
  - `SMTP_PORT=465`
  - `SMTP_USER=no-reply@kurotrace.com`
  - `SMTP_PASS=…`
  - `EMAIL_FROM="Kuro Trace <no-reply@kurotrace.com>"`
- [ ] **Required.** Copy the **MX**, **SPF** and **DKIM** records from hPanel → Emails → DNS settings into Cloudflare DNS, all as **DNS only** (grey cloud).
- [ ] **Required.** Add a **DMARC** record, so scammers can't send emails that pretend to come from your domain. This matters for a scam-reporting brand: impostors will try it.
  - Name `_dmarc`, value `v=DMARC1; p=quarantine; rua=mailto:dmarc@kurotrace.com`.
  - After a few weeks with no problems, change `p=quarantine` to `p=reject`.
- [ ] Check deliverability: send yourself a sign-in code at Gmail and Outlook. It should land in the inbox, and the message details should show SPF, DKIM and DMARC as **PASS**.
- [ ] Sending limits: Hostinger allows about 1,000 emails a day on Business Starter and 3,000 on Business Premium. If you regularly pass about half of that, switch to Postmark (`EMAIL_PROVIDER=postmark`). The SPF and DKIM steps are the same, using Postmark's records.

### Evidence storage (S3 or Cloudflare R2)
- [ ] **Required.** Create a **private** bucket with no public access, and turn on versioning.
- [ ] **Required.** Set `EVIDENCE_STORAGE=s3`, `EVIDENCE_BUCKET`, `EVIDENCE_REGION` and `EVIDENCE_ENDPOINT` (R2 only), plus an access key that's limited to that bucket.
- [ ] For off-site backups, create a second bucket and set `BACKUP_BUCKET` and the `BACKUP_S3_*` settings. Then start with `docker compose --profile offsite up -d`.

### Bot protection (Cloudflare Turnstile, free)
- [ ] **Required.** Create a Turnstile widget for `kurotrace.com`. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` and `TURNSTILE_HOSTNAMES=kurotrace.com,www.kurotrace.com`.

### Ads
- [ ] Meta: set `NEXT_PUBLIC_META_PIXEL_ID`. Create a Conversions API token and set `META_CAPI_TOKEN`. Check that events arrive using `META_TEST_EVENT_CODE`, then clear it.
- [ ] Google Ads: set `NEXT_PUBLIC_GOOGLE_TAG_ID` (`AW-…`) and `NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO` (`AW-…/label`) for the "report started" conversion.
- [ ] Point ads at the `/lp/…` pages; tracking runs only there. The lead export includes `gclid` and `fbclid` for offline conversion uploads.
- [ ] Ask your legal adviser whether you can use `NEXT_PUBLIC_ADS_CONSENT=implied` in your target countries. The default asks visitors first.

### Legal and content
- [ ] **Required.** Fill in the privacy notice placeholders: legal entity, address, privacy email, retention periods and data-sharing partners.
- [ ] **Required.** Name the investigation firm (or firms) and sign a data processing agreement with each.
- [ ] Replace the "As seen in" placeholder logos, or remove that strip.
- [ ] Set `security@` in `SECURITY.md` to a real mailbox.

---

## Part C: launch day

1. On the server, after running `deploy/harden-server.sh`, copy `.env.example` to `deploy/.env`, fill in every Part B value, and run `chmod 600 deploy/.env`.
2. Start everything with `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`. Migrations run automatically, and HTTPS certificates are issued within a minute.
3. Create the first owner account: `docker compose -f deploy/docker-compose.yml run --rm admin node /app/node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/create-owner.ts --username <you>`. Then scan the QR link it prints with your authenticator app.
4. Sign in at `https://admin.kurotrace.com` from an allowed IP. Under **My account**, add **two** security keys, then set `STAFF_SECURITY_KEY_ONLY=true` and restart.
5. Invite your reviewers and the investigation firm's staff from **Staff**. For investigators, add their office IP addresses to their access settings.
6. Run a full test report on the live site: sign up, report, evidence, message. Answer it from the admin, and confirm a wallet in the public checker.
7. Check the backup: run `docker compose … logs backup`, which should say "backup written". Then do one practice restore on your own computer with `deploy/restore.sh` and the offline key.
8. Set `SITE_INDEXABLE=true` and restart, so search engines may index the public pages. Submit `https://kurotrace.com/sitemap.xml` in Google Search Console.
9. Turn on the ads.

### After launch
- [ ] Book an independent penetration test once real traffic starts. The automated checks are a floor, not a replacement.
- [ ] Every month: restore a backup to check it works, and review the admin audit log and the staff list.
- [ ] Every year: rotate the field encryption key. Add `k2:` first in `FIELD_ENCRYPTION_KEYS` (or re-wrap with KMS). Old data stays readable.
- [ ] Watch Dependabot pull requests. CI must be green before you merge.
- [ ] Every week for the first month: look at Cloudflare → Security → Events, to see what's being blocked, and at the admin audit log for failed staff sign-ins.
