#!/usr/bin/env bash
# Full dress rehearsal of the live setup on a throwaway machine (used by CI):
# builds every image, starts the whole stack with Caddy on *.localhost (local HTTPS),
# and checks the site, the admin lock, scanner blocking, owner creation and backups.
set -euo pipefail
cd "$(dirname "$0")"
# Logs can't always be downloaded from CI, so failures are reported as annotations.
note() { echo "::error title=$1::$(echo "$2" | tr '\n' ' ' | tr -s ' ' | cut -c1-1500)"; }
diagnose() {
  note "compose ps" "$(docker compose ps -a --format '{{.Service}} {{.State}} {{.Status}}' 2>&1 | grep -v 'No such container')"
  for svc in migrate web admin caddy backup mysql; do
    note "logs $svc" "$(docker compose logs --no-color --tail 15 $svc 2>&1 | grep -iv 'warn.*deprecat' | tail -15)"
  done
}
trap 'rc=$?; note "Rehearsal stopped at line $LINENO (exit $rc)" "$BASH_COMMAND"; diagnose' ERR
export SITE_DOMAIN=kurotrace.localhost
export ADMIN_IPS="203.0.113.10"          # an address the test machine is NOT, so the admin must 404
HOME_DIR=$(mktemp -d)
HOME="$HOME_DIR" bash init-env.sh > /dev/null
sed -i 's/^SMTP_PASS=""/SMTP_PASS="unused-in-rehearsal"/' .env
# No real emails from CI: write them to a file inside the container instead.
sed -i 's/^EMAIL_PROVIDER=.*/EMAIL_PROVIDER="file"/' .env
printf 'ALLOW_TEST_EMAIL="true"\nEMAIL_OUTBOX_FILE="/tmp/outbox.log"\n' >> .env

docker compose up -d --build --wait --wait-timeout 600 mysql
docker compose up -d --build
site() { curl -sk --resolve "$1:443:127.0.0.1" -o /dev/null -w "%{http_code}" "https://$1$2"; }
for i in $(seq 1 90); do [ "$(site kurotrace.localhost /robots.txt)" = "200" ] && break; sleep 2; done

fail() { trap - ERR; note "Rehearsal failed" "$*"; diagnose; exit 1; }
[ "$(site kurotrace.localhost /)" = "200" ] || fail "home page"
www=$(curl -sk --resolve www.kurotrace.localhost:443:127.0.0.1 -o /dev/null -w "%{http_code} %{redirect_url}" https://www.kurotrace.localhost/a?b=1)
[ "$www" = "301 https://kurotrace.localhost/a?b=1" ] || fail "www redirect: got $www"
hdrs=$(curl -skI --resolve kurotrace.localhost:443:127.0.0.1 https://kurotrace.localhost/)
echo "$hdrs" | grep -qi "strict-transport-security" || fail "HSTS header"
echo "$hdrs" | grep -qi "^server:" && fail "Server header should be hidden"
code=$(site kurotrace.localhost /wp-login.php || true); [ "$code" = "000" ] || fail "scanner path answered $code"
[ "$(site admin.kurotrace.localhost /login)" = "404" ] || fail "admin must 404 outside ADMIN_IP_RANGES"
# Inside the server network, from an allowed address, the admin answers.
docker compose exec -T admin node -e "fetch('http://127.0.0.1:3001/login',{headers:{'x-kt-client-ip':'203.0.113.10'}}).then(r=>{console.log('admin',r.status);process.exit(r.status===200?0:1)})" || fail "admin app"
owner=$(docker compose run --rm -T -e OWNER_PASSWORD="rehearsal owner passphrase" admin \
  node /app/node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/create-owner.ts --username owner 2>&1 || true)
echo "$owner" | grep -q 'Owner "owner" created' || fail "create-owner: $(echo "$owner" | tail -25)"
for i in $(seq 1 30); do docker compose exec -T backup sh -c 'ls /backups/*.sql.gz.age' > /dev/null 2>&1 && break; sleep 2; done
docker compose exec -T backup sh -c 'ls -l /backups' | grep -q 'sql.gz.age' || fail "backup"
docker compose exec -T web sh -c 'touch /data/evidence/.write-test && rm /data/evidence/.write-test' || fail "evidence volume not writable"
docker compose exec -T web sh -c 'touch /app/x 2>/dev/null' && fail "app filesystem should be read-only"
# Switch to "admin open to any address" (the default for teams without fixed IPs):
# the sign-in page must now load from outside, and still need a session for everything else.
sed -i 's|^ADMIN_IP_RANGES=.*|ADMIN_IP_RANGES="0.0.0.0/0 ::/0"|; s|^ADMIN_ALLOWED_IPS=.*|ADMIN_ALLOWED_IPS="*"|' .env
docker compose up -d caddy admin
for i in $(seq 1 60); do [ "$(site admin.kurotrace.localhost /login)" = "200" ] && break; sleep 2; done
[ "$(site admin.kurotrace.localhost /login)" = "200" ] || fail "open admin: sign-in page should load from anywhere"
[ "$(site admin.kurotrace.localhost /reports)" = "307" ] || fail "open admin: console must still need a session"
echo "Rehearsal passed: site, HTTPS headers, scanner blocking, admin lock, owner creation, backups, read-only containers."
