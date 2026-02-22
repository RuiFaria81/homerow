#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY="${ROOT_DIR}/infra/id_ed25519"

usage() {
  cat <<USAGE
Usage: $0 [--host <ip-or-host>] [--user <ssh-user>] [--keep-webmail-running]

Wipes server mail/import data for repeatable import tests:
- /var/vmail/*
- mailsync DB tables (messages, folders, threads, etc.)
- takeout import jobs table (if present)
- /tmp import temp/checkpoint files
- rspamd spam service data (/var/lib/rspamd and /var/lib/redis-rspamd when present)

Defaults:
- host: terraform output 'server_ip' from ./infra
- user: root
- stops mail-sync-engine and custom-webmail during reset (unless --keep-webmail-running)
USAGE
}

HOST=""
USER_NAME="root"
KEEP_WEBMAIL_RUNNING="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --user)
      USER_NAME="${2:-}"
      shift 2
      ;;
    --keep-webmail-running)
      KEEP_WEBMAIL_RUNNING="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  if command -v terraform >/dev/null 2>&1; then
    if [[ -d "${ROOT_DIR}/infra" ]]; then
      HOST="$(cd "${ROOT_DIR}/infra" && terraform output -raw server_ip 2>/dev/null || true)"
    fi
  fi
fi

if [[ -z "$HOST" ]]; then
  echo "Could not determine server host. Pass --host <ip-or-host>." >&2
  exit 1
fi

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

echo "[reset] target=${USER_NAME}@${HOST}"
echo "[reset] wiping mail/import data (DESTRUCTIVE)"

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "${USER_NAME}@${HOST}" bash -s -- "$KEEP_WEBMAIL_RUNNING" <<'REMOTE'
set -euo pipefail

KEEP_WEBMAIL_RUNNING="$1"

if [[ "$KEEP_WEBMAIL_RUNNING" != "true" ]]; then
  systemctl stop custom-webmail || true
fi
systemctl stop mail-sync-engine || true
systemctl stop rspamd || true

if [[ -d /var/vmail ]]; then
  find /var/vmail -mindepth 1 -delete
fi

if [[ -d /var/lib/rspamd ]]; then
  find /var/lib/rspamd -mindepth 1 -delete
fi

if [[ -d /var/lib/redis-rspamd ]]; then
  find /var/lib/redis-rspamd -mindepth 1 -delete
fi

sudo -u postgres psql -d mailsync -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE TABLE attachments, messages, threads, folders, contacts, sync_log RESTART IDENTITY CASCADE;
UPDATE accounts SET last_sync_at = NULL, updated_at = now();
SQL

has_takeout_jobs=$(sudo -u postgres psql -d mailsync -tAc "SELECT to_regclass('public.takeout_import_jobs') IS NOT NULL;")
if [[ "$has_takeout_jobs" == "t" ]]; then
  sudo -u postgres psql -d mailsync -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE takeout_import_jobs RESTART IDENTITY;"
fi

rm -f /tmp/.import-checkpoint-*.json || true
rm -f /tmp/.import-checkpoint-*.ids || true

systemctl restart dovecot
systemctl restart postfix
systemctl restart rspamd
systemctl restart mail-sync-engine
if [[ "$KEEP_WEBMAIL_RUNNING" != "true" ]]; then
  systemctl start custom-webmail
fi

systemctl is-active dovecot postfix rspamd mail-sync-engine
if [[ "$KEEP_WEBMAIL_RUNNING" != "true" ]]; then
  systemctl is-active custom-webmail
fi
REMOTE

echo "[reset] done"
