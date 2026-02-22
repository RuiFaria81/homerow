#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_MODULE="${ROOT_DIR}/modules/backup.nix"

expect_contains() {
  local pattern="$1"
  if ! grep -Fq -- "$pattern" "$BACKUP_MODULE"; then
    echo "expected ${BACKUP_MODULE} to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains 'postgresBackupDir = "/var/backup/postgresql";'
expect_contains 'systemd.services.postgres-backup = {'
expect_contains 'pg_dumpall --globals-only > "$tmp_dir/globals.sql"'
expect_contains 'pg_dump -d mailsync -Fc -f "$tmp_dir/mailsync.dump"'
expect_contains 'systemd.timers.postgres-backup = {'
expect_contains 'OnCalendar = "02:45";'
expect_contains 'postgresBackupDir'

echo "postgres backup test: ok"
