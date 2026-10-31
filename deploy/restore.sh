#!/usr/bin/env bash
# Restores an encrypted backup into a database (a NEW, empty one unless you are sure).
#   AGE_IDENTITY=~/kurotrace-backup.key MYSQL_HOST=... MYSQL_ROOT_PASSWORD=... \
#     deploy/restore.sh backups/kurotrace-20261101T020000Z.sql.gz.age kurotrace_restore
set -euo pipefail
FILE="${1:?backup file}"
TARGET="${2:?target database name}"
: "${MYSQL_HOST:?}" "${MYSQL_ROOT_PASSWORD:?}" "${AGE_IDENTITY:?path to the age private key}"
AGE="${AGE_BIN:-age}"
[[ "$TARGET" =~ ^[A-Za-z0-9_]+$ ]] || { echo "bad database name"; exit 1; }
if [ -f "$FILE.sha256" ]; then (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256"); fi

export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
mysql -h "$MYSQL_HOST" -u root -e "CREATE DATABASE IF NOT EXISTS \`$TARGET\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
"$AGE" -d -i "$AGE_IDENTITY" "$FILE" | gunzip | mysql -h "$MYSQL_HOST" -u root "$TARGET"
echo "restored into $TARGET:"
mysql -h "$MYSQL_HOST" -u root -N -e "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='$TARGET' ORDER BY table_name"
