#!/usr/bin/env bash
#
# Restores a MongoDB archive produced by scripts/backup-mongodb.sh.
#
# Defaults to a dry run. Restoring over a live database is destructive, so the
# real thing requires CONFIRM=yes rather than a bare flag that is easy to leave
# in a shell history and re-run by accident.
#
# Usage:
#   MONGODB_URI="mongodb://..." ./scripts/restore-mongodb.sh backups/automail-....gz
#   CONFIRM=yes MONGODB_URI="mongodb://..." ./scripts/restore-mongodb.sh <archive>

set -euo pipefail

MONGODB_URI="${MONGODB_URI:?MONGODB_URI must be set}"
ARCHIVE="${1:?Pass the archive path to restore}"
CONFIRM="${CONFIRM:-no}"

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "FAILED: ${ARCHIVE} does not exist" >&2
  exit 1
fi

if [[ "${CONFIRM}" != "yes" ]]; then
  echo "==> DRY RUN. Nothing will be written."
  echo "    Re-run with CONFIRM=yes to restore for real."
  mongorestore --uri="${MONGODB_URI}" --archive="${ARCHIVE}" --gzip --dryRun
  exit 0
fi

echo "==> Restoring ${ARCHIVE} (this overwrites existing collections)"
mongorestore --uri="${MONGODB_URI}" --archive="${ARCHIVE}" --gzip --drop

echo "==> Restore complete. Verify with: npm run api:start and check /api/v1/health/ready"
