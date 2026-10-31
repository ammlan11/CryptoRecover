#!/usr/bin/env bash
# Encrypted MySQL backup.
#  - Consistent snapshot (--single-transaction) of the whole database.
#  - Compressed, then encrypted to an age PUBLIC key: the server can write backups
#    but can't read them. The private key lives offline with the owner.
#  - Local files older than BACKUP_KEEP_DAYS are deleted. The "offsite" service in
#    docker-compose.yml copies new backups to an S3 / R2 bucket.
# Note: the database already stores personal fields encrypted with the app's keys, so a
# restore also needs those keys (or KMS access). Back up the keys separately, offline.
set -euo pipefail

: "${MYSQL_HOST:?}" "${MYSQL_ROOT_PASSWORD:?}" "${BACKUP_AGE_RECIPIENT:?}"
DB="${MYSQL_DATABASE:-kurotrace}"
DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
AGE="${AGE_BIN:-age}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DIR/${DB}-${STAMP}.sql.gz.age"
mkdir -p "$DIR"

export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
mysqldump -h "$MYSQL_HOST" -u root --single-transaction --quick --routines --triggers --events \
  --set-gtid-purged=OFF --no-tablespaces "$DB" \
  | gzip -9 \
  | "$AGE" -r "$BACKUP_AGE_RECIPIENT" -o "$OUT.partial"
mv "$OUT.partial" "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "backup written: $OUT ($(du -h "$OUT" | cut -f1))"


find "$DIR" -name "${DB}-*.sql.gz.age*" -mtime +"$KEEP" -delete
