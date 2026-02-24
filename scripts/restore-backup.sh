#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_HELPER="${ROOT_DIR}/ssh-vps.sh"

usage() {
  cat <<'USAGE'
Usage: ./hrow restore-backup [--list] [--source <restic|local>] [--restic-snapshot <id|latest>] [--snapshot <timestamp|latest>] [--yes] [--no-restart]

Restores mail files and PostgreSQL data.
Default flow:
  1) Recover /var/vmail and /var/backup/postgresql from restic bucket
  2) Restore PostgreSQL `mailsync` from /var/backup/postgresql/<timestamp>/

Options:
  --list                    List available snapshots for selected source and exit
  --source <restic|local>   Restore source (default: restic)
  --restic-snapshot <id>    Restic snapshot ID to recover files from (default: latest)
  --snapshot <value>        PostgreSQL snapshot timestamp to restore (default: latest)
  --yes                     Skip destructive confirmation prompt
  --no-restart              Do not restart services after restore
  -h, --help                Show this help

Examples:
  ./hrow restore-backup --list
  ./hrow restore-backup --restic-snapshot 0b28a36f --snapshot 20260224T024501Z
  ./hrow restore-backup --source local --snapshot latest --yes
USAGE
}

if [ ! -x "${SSH_HELPER}" ]; then
  echo "[restore-backup] missing SSH helper at ${SSH_HELPER}" >&2
  exit 1
fi

MODE="restore"
SOURCE="restic"
RESTIC_SNAPSHOT="latest"
SNAPSHOT="latest"
ASSUME_YES="false"
NO_RESTART="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)
      MODE="list"
      shift
      ;;
    --source)
      SOURCE="${2:-}"
      if [[ "${SOURCE}" != "restic" && "${SOURCE}" != "local" ]]; then
        echo "[restore-backup] --source must be restic or local." >&2
        exit 1
      fi
      shift 2
      ;;
    --restic-snapshot)
      RESTIC_SNAPSHOT="${2:-}"
      if [ -z "${RESTIC_SNAPSHOT}" ]; then
        echo "[restore-backup] --restic-snapshot requires a value." >&2
        exit 1
      fi
      shift 2
      ;;
    --snapshot)
      SNAPSHOT="${2:-}"
      if [ -z "${SNAPSHOT}" ]; then
        echo "[restore-backup] --snapshot requires a value." >&2
        exit 1
      fi
      shift 2
      ;;
    --yes)
      ASSUME_YES="true"
      shift
      ;;
    --no-restart)
      NO_RESTART="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[restore-backup] unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${MODE}" == "list" ]]; then
  exec "${SSH_HELPER}" bash -s -- "${SOURCE}" <<'REMOTE'
set -euo pipefail

SOURCE="$1"
BACKUP_ROOT="/var/backup/postgresql"

if [[ "${SOURCE}" == "restic" ]]; then
  for f in /root/restic-env /root/restic-repo /root/restic-password; do
    if [[ ! -f "$f" ]]; then
      echo "Missing restic config file: $f" >&2
      exit 1
    fi
  done
  set -a
  # shellcheck disable=SC1091
  source /root/restic-env
  set +a
  restic --repository-file /root/restic-repo --password-file /root/restic-password snapshots
  exit 0
fi

snapshots="$(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -E '^[0-9]{8}T[0-9]{6}Z$' | sort || true)"
if [[ -z "${snapshots}" ]]; then
  echo "No PostgreSQL backup snapshots found in ${BACKUP_ROOT}" >&2
  exit 1
fi

printf '%s\n' "${snapshots}"
REMOTE
fi

if [[ "${ASSUME_YES}" != "true" ]]; then
  echo "[restore-backup] This is destructive and will replace the current mailsync database."
  if [[ "${SOURCE}" == "restic" ]]; then
    read -r -p "Continue with restore from restic='${RESTIC_SNAPSHOT}' and postgres='${SNAPSHOT}'? (y/N): " confirm
  else
    read -r -p "Continue with local postgres snapshot '${SNAPSHOT}'? (y/N): " confirm
  fi
  if [[ "${confirm}" != "y" ]]; then
    echo "[restore-backup] Aborted."
    exit 1
  fi
fi

exec "${SSH_HELPER}" bash -s -- "${SOURCE}" "${RESTIC_SNAPSHOT}" "${SNAPSHOT}" "${NO_RESTART}" <<'REMOTE'
set -euo pipefail

SOURCE="$1"
REQUESTED_RESTIC_SNAPSHOT="$2"
REQUESTED_SNAPSHOT="$3"
NO_RESTART="$4"
BACKUP_ROOT="/var/backup/postgresql"
RESTIC_TARGET="/root/restic-restore"

if [[ "${SOURCE}" == "restic" ]]; then
  for f in /root/restic-env /root/restic-repo /root/restic-password; do
    if [[ ! -f "$f" ]]; then
      echo "Missing restic config file: $f" >&2
      exit 1
    fi
  done
fi

webmail_unit_exists() {
  local unit="$1"
  systemctl list-unit-files --type=service --no-legend --no-pager | awk '{print $1}' | grep -Fxq "${unit}.service"
}

echo "[restore-backup] stopping services"
systemctl stop mail-sync-engine || true
if webmail_unit_exists "custom-webmail-blue" || webmail_unit_exists "custom-webmail-green"; then
  systemctl stop custom-webmail-blue custom-webmail-green || true
else
  systemctl stop custom-webmail || true
fi
systemctl stop dovecot postfix || true

if [[ "${SOURCE}" == "restic" ]]; then
  if [[ ! -d "${RESTIC_TARGET}" ]]; then
    mkdir -p "${RESTIC_TARGET}"
  fi
  rm -rf "${RESTIC_TARGET:?}/"*
  set -a
  # shellcheck disable=SC1091
  source /root/restic-env
  set +a
  if [[ "${REQUESTED_RESTIC_SNAPSHOT}" == "latest" ]]; then
    RESOLVED_RESTIC_SNAPSHOT="$(
      restic --repository-file /root/restic-repo --password-file /root/restic-password snapshots \
        | awk '$1 ~ /^[0-9a-f]{8,}$/ { id=$1 } END { print id }'
    )"
    if [[ -z "${RESOLVED_RESTIC_SNAPSHOT}" ]]; then
      echo "Could not resolve latest restic snapshot." >&2
      exit 1
    fi
  else
    RESOLVED_RESTIC_SNAPSHOT="${REQUESTED_RESTIC_SNAPSHOT}"
  fi

  echo "[restore-backup] restoring files from restic snapshot ${RESOLVED_RESTIC_SNAPSHOT}"
  restic --repository-file /root/restic-repo --password-file /root/restic-password restore "${RESOLVED_RESTIC_SNAPSHOT}" --target "${RESTIC_TARGET}" --include /var/vmail --include /var/backup/postgresql

  if [[ ! -d "${RESTIC_TARGET}/var/vmail" ]]; then
    echo "Restic snapshot does not contain /var/vmail" >&2
    exit 1
  fi
  if [[ ! -d "${RESTIC_TARGET}/var/backup/postgresql" ]]; then
    echo "Restic snapshot does not contain /var/backup/postgresql" >&2
    exit 1
  fi

  mkdir -p /var/vmail /var/backup/postgresql
  find /var/vmail -mindepth 1 -delete
  find /var/backup/postgresql -mindepth 1 -delete
  cp -a "${RESTIC_TARGET}/var/vmail/." /var/vmail/
  cp -a "${RESTIC_TARGET}/var/backup/postgresql/." /var/backup/postgresql/
  if id -u vmail >/dev/null 2>&1 && getent group vmail >/dev/null 2>&1; then
    chown -R vmail:vmail /var/vmail
  else
    echo "[restore-backup] skipping /var/vmail chown: vmail user/group not found"
  fi
  chown -R postgres:postgres /var/backup/postgresql
fi

if [[ ! -d "${BACKUP_ROOT}" ]]; then
  echo "Backup directory missing at ${BACKUP_ROOT}" >&2
  exit 1
fi
snapshots="$(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -E '^[0-9]{8}T[0-9]{6}Z$' | sort || true)"
if [[ -z "${snapshots}" ]]; then
  echo "No PostgreSQL backup snapshots found in ${BACKUP_ROOT}" >&2
  exit 1
fi

if [[ "${REQUESTED_SNAPSHOT}" == "latest" ]]; then
  SNAPSHOT="$(printf '%s\n' "${snapshots}" | tail -n1)"
else
  SNAPSHOT="${REQUESTED_SNAPSHOT}"
fi

SNAPSHOT_DIR="${BACKUP_ROOT}/${SNAPSHOT}"
if [[ ! -d "${SNAPSHOT_DIR}" ]]; then
  echo "Snapshot not found: ${SNAPSHOT_DIR}" >&2
  exit 1
fi

if [[ ! -f "${SNAPSHOT_DIR}/globals.sql" ]]; then
  echo "Missing globals.sql in ${SNAPSHOT_DIR}" >&2
  exit 1
fi

if [[ ! -f "${SNAPSHOT_DIR}/mailsync.dump" ]]; then
  echo "Missing mailsync.dump in ${SNAPSHOT_DIR}" >&2
  exit 1
fi

echo "[restore-backup] restoring postgres snapshot ${SNAPSHOT}"

globals_log="$(mktemp)"
cleanup() {
  rm -f "${globals_log}"
}
trap cleanup EXIT

# Globals restore can legitimately contain CREATE ROLE statements for roles that
# already exist on the host. Allow those conflicts, fail on anything else.
sudo -u postgres psql -v ON_ERROR_STOP=0 -f "${SNAPSHOT_DIR}/globals.sql" >"${globals_log}" 2>&1 || true
if grep -q '^ERROR:' "${globals_log}"; then
  unexpected_errors="$(grep '^ERROR:' "${globals_log}" | grep -v 'role ".*" already exists' || true)"
  if [[ -n "${unexpected_errors}" ]]; then
    cat "${globals_log}" >&2
    echo "Unexpected error(s) while applying globals.sql" >&2
    exit 1
  fi
  echo "[restore-backup] continuing despite existing role(s) from globals.sql"
fi

sudo -u postgres dropdb --if-exists mailsync
sudo -u postgres createdb -O mailsync mailsync
sudo -u postgres pg_restore -d mailsync "${SNAPSHOT_DIR}/mailsync.dump"

if [[ "${NO_RESTART}" != "true" ]]; then
  systemctl restart postgresql
  systemctl restart dovecot postfix
  systemctl restart mail-sync-engine
  if webmail_unit_exists "custom-webmail-blue" || webmail_unit_exists "custom-webmail-green"; then
    systemctl restart custom-webmail-blue custom-webmail-green
    systemctl is-active custom-webmail-blue custom-webmail-green
  else
    systemctl restart custom-webmail || true
    systemctl is-active custom-webmail || true
  fi
  systemctl is-active postgresql dovecot postfix mail-sync-engine
fi

echo "[restore-backup] restore completed from ${SNAPSHOT}"
REMOTE
