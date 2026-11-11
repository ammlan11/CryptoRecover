#!/usr/bin/env bash
# Updates the live server to the latest code on GitHub's main branch.
#   bash deploy/update.sh
# Database migrations run automatically; the site stays up while the new version builds.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd deploy
docker compose build
docker compose up -d --remove-orphans
docker image prune -f > /dev/null
docker compose ps
echo "Updated to $(git -C .. log -1 --format='%h %s')"
