#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_SCRIPT="${ROOT_DIR}/scripts/backup.sh"

if [ ! -x "${BACKUP_SCRIPT}" ]; then
  echo "expected backup.sh to be executable" >&2
  exit 1
fi

expect_contains() {
  local pattern="$1"
  if ! grep -Fq -- "$pattern" "$BACKUP_SCRIPT"; then
    echo "expected ${BACKUP_SCRIPT} to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains './hrow backup <command> [options]'
expect_contains 'list                   List available snapshots'
expect_contains 'restore                Restore from backup snapshots (destructive)'
expect_contains 'trigger                Trigger backup jobs now'
expect_contains 'SOURCE="restic"'
expect_contains 'RESTIC_SNAPSHOT="latest"'
expect_contains 'SNAPSHOT="latest"'
expect_contains 'TRIGGER_TARGET="all"'
expect_contains 'restic --repository-file /root/restic-repo --password-file /root/restic-password restore'
expect_contains 'awk '\''$1 ~ /^[0-9a-f]{8,}$/ { id=$1 } END { print id }'\'''
expect_contains 'systemctl start postgres-backup.service'
expect_contains 'systemctl start restic-backups-mail-server.service'
expect_contains 'cp -a "${RESTIC_TARGET}/var/vmail/." /var/vmail/'
expect_contains 'sudo -u postgres psql -v ON_ERROR_STOP=0 -f "${SNAPSHOT_DIR}/globals.sql"'
expect_contains 'grep -v '\''role ".*" already exists'\'''
expect_contains 'sudo -u postgres pg_restore -d mailsync "${SNAPSHOT_DIR}/mailsync.dump"'
expect_contains 'systemctl restart postgresql'
expect_contains 'systemctl restart mail-sync-engine'

NO_COMMAND_LOG="$(mktemp)"
trap 'rm -f "${NO_COMMAND_LOG}"' EXIT
if "${BACKUP_SCRIPT}" >"${NO_COMMAND_LOG}" 2>&1; then
  echo "expected backup.sh without command to fail" >&2
  exit 1
fi
if ! grep -Fq 'missing command. Use: list | restore | trigger' "${NO_COMMAND_LOG}"; then
  echo "expected backup.sh to require explicit command" >&2
  exit 1
fi
if grep -Fq 'This is destructive' "${NO_COMMAND_LOG}"; then
  echo "backup.sh should not reach destructive restore prompt without explicit restore command" >&2
  exit 1
fi

echo "backup cli test: ok"
