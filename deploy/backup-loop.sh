#!/usr/bin/env bash
# Entry point of the backup container: one backup at start-up, then every night at 02:00 UTC.
set -uo pipefail
/backup/backup.sh || echo "BACKUP FAILED at $(date -u)"
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today 02:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -u -d "tomorrow 02:00" +%s)
  sleep $(( next - now ))
  /backup/backup.sh || echo "BACKUP FAILED at $(date -u)"
done
