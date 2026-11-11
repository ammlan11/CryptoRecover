#!/usr/bin/env bash
# Creates deploy/.env for the live server, with every password and key generated fresh.
#   bash deploy/init-env.sh
# Asks for your domain and office IP address(es). Never overwrites an existing deploy/.env.
# Non-interactive (CI): SITE_DOMAIN=… ADMIN_IPS="…" bash deploy/init-env.sh
set -euo pipefail
cd "$(dirname "$0")"
OUT=.env
[ -e "$OUT" ] && { echo "deploy/.env already exists; not touching it."; exit 1; }

ask() { local var=$1 prompt=$2; if [ -z "${!var:-}" ]; then read -r -p "$prompt" "$var"; fi; }
ask SITE_DOMAIN "Your domain, without https:// (e.g. kurotrace.com): "
ask ADMIN_IPS "IP address(es) allowed into the admin, separated by spaces (find yours at https://ifconfig.me): "
SITE_DOMAIN=$(echo "$SITE_DOMAIN" | tr 'A-Z' 'a-z' | sed 's#^https\?://##; s#/.*##; s#^www\.##')
[[ "$SITE_DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "That doesn't look like a domain."; exit 1; }
[ -n "$ADMIN_IPS" ] || { echo "At least one admin IP is required."; exit 1; }

rand() { openssl rand -base64 32; }
hex() { openssl rand -hex 24; }

if command -v age-keygen >/dev/null; then
  AGE_KEY_FILE="$HOME/kurotrace-backup-PRIVATE.key"
  age-keygen -o "$AGE_KEY_FILE" 2>/dev/null
  chmod 600 "$AGE_KEY_FILE"
  AGE_PUBLIC=$(age-keygen -y "$AGE_KEY_FILE")
else
  AGE_PUBLIC="${BACKUP_AGE_RECIPIENT:-}"
  [ -n "$AGE_PUBLIC" ] || { echo "Install age first: sudo apt-get install -y age"; exit 1; }
fi

umask 077
cat > "$OUT" <<ENV
# Kuro Trace live server settings. Created $(date -u +%Y-%m-%d). Keep this file private (chmod 600).
# See .env.example in the repo for what each setting does.

SITE_DOMAIN="$SITE_DOMAIN"
ADMIN_DOMAIN="admin.$SITE_DOMAIN"
NEXT_PUBLIC_SITE_URL="https://$SITE_DOMAIN"
ADMIN_URL="https://admin.$SITE_DOMAIN"
ADMIN_IP_RANGES="$ADMIN_IPS"
ADMIN_ALLOWED_IPS="$(echo "$ADMIN_IPS" | tr -s ' ' ',')"
SITE_INDEXABLE=""               # set to "true" on launch day so Google can index the site

# Encryption keys: also copy these two lines into your password manager. Without them
# the encrypted data and backups can never be read again.
FIELD_ENCRYPTION_KEYS="k1:$(rand)"
BLIND_INDEX_KEY="$(rand)"
KEYS_SOURCE="env"

MYSQL_ROOT_PASSWORD="$(hex)"
MYSQL_APP_PASSWORD="$(hex)"

# Evidence files are stored encrypted on this server (a Docker volume, included in backups).
EVIDENCE_STORAGE="local"
EVIDENCE_LOCAL_DIR="/data/evidence"
ALLOW_LOCAL_EVIDENCE="true"

# Email (sign-in codes, confirmations). Hostinger Email: smtp.hostinger.com, port 465.
EMAIL_PROVIDER="smtp"
EMAIL_FROM="Kuro Trace <no-reply@$SITE_DOMAIN>"
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_USER="no-reply@$SITE_DOMAIN"
SMTP_PASS=""                    # ← fill in: the mailbox password

# Bot protection (Cloudflare Turnstile, free). Until you add keys, forms work without it.
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
TURNSTILE_HOSTNAMES="$SITE_DOMAIN,www.$SITE_DOMAIN"
BOT_CHECK="off"                 # ← remove this line once the two Turnstile keys are set

# Behind Cloudflare: paste the two lines printed by: bash deploy/cloudflare-ips.sh
EDGE_IPS=""
TRUSTED_PROXIES=""

# Nightly encrypted backups (public key; the private key is NOT on this server)
BACKUP_AGE_RECIPIENT="$AGE_PUBLIC"
BACKUP_KEEP_DAYS="30"

# Ads (optional, landing pages only)
NEXT_PUBLIC_META_PIXEL_ID=""
NEXT_PUBLIC_GOOGLE_TAG_ID=""
NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO=""
NEXT_PUBLIC_ADS_CONSENT="banner"
ENV

echo
echo "Created deploy/.env."
echo "Next: open it (nano deploy/.env) and fill in SMTP_PASS."
if [ -n "${AGE_KEY_FILE:-}" ]; then
  echo
  echo "IMPORTANT: your backup PRIVATE key is in $AGE_KEY_FILE"
  echo "Copy it to your computer / password manager now, then delete it from the server:"
  echo "  cat $AGE_KEY_FILE      # copy everything it prints"
  echo "  rm $AGE_KEY_FILE"
fi
