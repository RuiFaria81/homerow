#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESTORE_SCRIPT="${ROOT_DIR}/scripts/restore-backup.sh"

if [ ! -x "${RESTORE_SCRIPT}" ]; then
  echo "expected restore-backup.sh to be executable" >&2
  exit 1
fi

expect_contains() {
  local pattern="$1"
  if ! grep -Fq -- "$pattern" "$RESTORE_SCRIPT"; then
    echo "expected ${RESTORE_SCRIPT} to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains 'Usage: ./hrow restore-backup'
expect_contains 'MODE="list"'
expect_contains 'SOURCE="restic"'
expect_contains 'RESTIC_SNAPSHOT="latest"'
expect_contains 'SNAPSHOT="latest"'
expect_contains 'restic --repository-file /root/restic-repo --password-file /root/restic-password restore'
expect_contains 'awk '\''$1 ~ /^[0-9a-f]{8,}$/ { id=$1 } END { print id }'\'''
expect_contains 'cp -a "${RESTIC_TARGET}/var/vmail/." /var/vmail/'
expect_contains 'sudo -u postgres psql -v ON_ERROR_STOP=0 -f "${SNAPSHOT_DIR}/globals.sql"'
expect_contains 'grep -v '\''role ".*" already exists'\'''
expect_contains 'sudo -u postgres pg_restore -d mailsync "${SNAPSHOT_DIR}/mailsync.dump"'
expect_contains 'systemctl restart postgresql'
expect_contains 'systemctl restart mail-sync-engine'

echo "restore-backup cli test: ok"
