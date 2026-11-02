#!/usr/bin/env bash
# Prints the EDGE_IPS and TRUSTED_PROXIES lines for deploy/.env when the site is behind
# Cloudflare (orange-cloud proxied DNS). With these set, the server only answers
# Cloudflare, so attackers can't skip Cloudflare's protection by using the server's IP,
# and the real visitor address is read from Cloudflare's header.
# Re-run every few months (Cloudflare publishes changes in advance), then restart Caddy.
set -euo pipefail
v4=$(curl -fsSL https://www.cloudflare.com/ips-v4)
v6=$(curl -fsSL https://www.cloudflare.com/ips-v6)
ranges=$(printf '%s\n%s\n' "$v4" "$v6" | tr '\n' ' ' | sed 's/ *$//')
echo "EDGE_IPS=\"$ranges\""
echo "TRUSTED_PROXIES=\"$ranges\""
