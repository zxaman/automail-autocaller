#!/usr/bin/env bash
#
# Takes a compressed MongoDB backup and verifies it can be read back.
#
# An unverified backup is not a backup. mongodump exits 0 on plenty of
# situations that still produce an unusable archive, so this script always
# reads the archive back with mongorestore --dryRun before declaring success.
#
# Usage:
#   MONGODB_URI="mongodb+srv://..." ./scripts/backup-mongodb.sh [output-dir]
#
# Restore with scripts/restore-mongodb.sh.

set -euo pipefail

MONGODB_URI="${MONGODB_URI:?MONGODB_URI must be set}"
OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${OUTPUT_DIR}/automail-${timestamp}.gz"

mkdir -p "${OUTPUT_DIR}"

echo "==> Dumping database to ${archive}"
mongodump --uri="${MONGODB_URI}" --archive="${archive}" --gzip

if [[ ! -s "${archive}" ]]; then
  echo "FAILED: archive is empty" >&2
  exit 1
fi

echo "==> Verifying the archive can be read back"
# --dryRun parses the entire archive and reports what it would restore without
# writing anything, which is what makes this a verification and not a guess.
if ! mongorestore --uri="${MONGODB_URI}" --archive="${archive}" --gzip --dryRun --quiet; then
  echo "FAILED: archive did not verify; treat this backup as unusable" >&2
  exit 1
fi

size="$(du -h "${archive}" | cut -f1)"
echo "==> Backup verified: ${archive} (${size})"

echo "==> Pruning backups older than ${RETENTION_DAYS} days"
find "${OUTPUT_DIR}" -name 'automail-*.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "==> Done"
