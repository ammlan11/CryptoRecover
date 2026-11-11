# Putting Kuro Trace live on a Contabo VPS

About an hour, start to finish. You need: the domain, the Contabo VPS (Ubuntu 24.04), and
a Mac terminal. Every command box is copy-and-paste; replace the parts in `<angle brackets>`.

The same setup is rebuilt from scratch on every pull request (the **deploy-rehearsal** CI
job), so if CI is green these steps work.

---

## 1. Create your SSH key (on your Mac, once)

```bash
ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519 -C "kurotrace"
cat ~/.ssh/id_ed25519.pub
```

Press Enter at each question, but **do set a passphrase**. Copy the line that starts with `ssh-ed25519`.

## 2. First login and a normal user (on the server)

Contabo emails you the server IP and root password.

```bash
ssh root@<server-ip>
apt-get update && apt-get -y upgrade
adduser kuro                      # choose a strong password (used for sudo)
usermod -aG sudo kuro
mkdir -p /home/kuro/.ssh && nano /home/kuro/.ssh/authorized_keys   # paste the ssh-ed25519 line, save
chown -R kuro:kuro /home/kuro/.ssh && chmod 700 /home/kuro/.ssh && chmod 600 /home/kuro/.ssh/authorized_keys
```

In a **new** Mac terminal, check the key works before going further:

```bash
ssh kuro@<server-ip>
```

## 3. Lock the server down

```bash
sudo apt-get install -y git
git clone https://github.com/ammlan11/CryptoRecover.git ~/kurotrace
cd ~/kurotrace
sudo bash deploy/harden-server.sh kuro
```

This turns off root and password logins, opens only ports 22/80/443, adds fail2ban and
automatic security updates. Open one more new terminal and check `ssh kuro@<server-ip>` still works.

Contabo extra: in the Contabo control panel you can also add their **firewall** with the same
three ports. Optional; the server's own firewall already does this.

## 4. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker kuro
sudo apt-get install -y age
exit                               # log out and back in so the docker group applies
```

```bash
ssh kuro@<server-ip>
docker run --rm hello-world
```

## 5. Point the domain at the server

At the company where you bought the domain, add these DNS records (or at Cloudflare, see step 9):

| Type | Name    | Value         |
|------|---------|---------------|
| A    | `@`     | `<server-ip>` |
| A    | `www`   | `<server-ip>` |
| A    | `admin` | `<server-ip>` |

If Contabo gave you an IPv6 address too, add the same three as `AAAA` records.
Check with `dig +short <your-domain>` (it can take a few minutes up to an hour).

## 6. Create the settings file

```bash
cd ~/kurotrace
bash deploy/init-env.sh
```

It asks for your domain and the IP address(es) allowed into the admin (find yours at
https://ifconfig.me, from your home or office). It creates every secret key automatically and
writes `deploy/.env`.

It also creates the **backup key** at `~/kurotrace-backup-PRIVATE.key`. Copy it to your Mac and to
a password manager, then delete it from the server:

```bash
# on your Mac
scp kuro@<server-ip>:kurotrace-backup-PRIVATE.key ~/Documents/
# then on the server
shred -u ~/kurotrace-backup-PRIVATE.key
```

Without that file, backups can't be opened. With it, anyone can open them, so keep it off the server.

## 7. Email password

Create the mailbox `no-reply@<your-domain>` in Hostinger Email (or your email provider), then:

```bash
nano deploy/.env        # set SMTP_PASS="the mailbox password"
```

Also add SPF, DKIM and DMARC records for the domain as described in `docs/LAUNCH.md` → Email,
or sign-in codes may land in spam.

## 8. Start it

```bash
cd ~/kurotrace/deploy
docker compose up -d --build        # first build takes 5–10 minutes
docker compose ps                   # everything "running" or "healthy"; "migrate" exits 0
```

Open `https://<your-domain>`. The certificate is issued automatically on the first visit.

Create your admin account (shows a key for your authenticator app once):

```bash
docker compose run --rm admin node /app/node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/create-owner.ts --username <your-name>
```

Then open `https://admin.<your-domain>` from the IP you allowed.
From any other IP it's a blank "not found", by design.

## 9. Cloudflare (recommended, free)

Hides the server IP and absorbs attacks.

1. Add the site to Cloudflare and change the domain's nameservers to the two Cloudflare gives you.
2. Make the `@` and `www` records **Proxied** (orange cloud). You can leave `admin` grey (DNS only).
3. SSL/TLS → **Full (strict)**.
4. Then lock the server so only Cloudflare can reach the public site:

```bash
cd ~/kurotrace/deploy
sed -i '/^EDGE_IPS=/d;/^TRUSTED_PROXIES=/d' .env && bash cloudflare-ips.sh >> .env
docker compose up -d
```

5. Get free **Turnstile** keys (Cloudflare → Turnstile), put them in `deploy/.env`
   (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), delete the `BOT_CHECK="off"` line, then
   `docker compose up -d --build`.

## 10. Updates

When a pull request is merged:

```bash
cd ~/kurotrace && bash deploy/update.sh
```

## 11. Backups off the server

Backups run nightly into a Docker volume, encrypted. To also copy them off the server
(recommended: a Contabo Object Storage bucket or Backblaze B2), set `BACKUP_BUCKET` and the `BACKUP_S3_*` settings
in `deploy/.env`, then `docker compose --profile offsite up -d`.

## When something's wrong

```bash
cd ~/kurotrace/deploy
docker compose ps
docker compose logs --tail 100 web      # or admin, caddy, mysql, migrate
```
