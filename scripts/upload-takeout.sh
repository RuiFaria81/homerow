#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY="${ROOT_DIR}/infra/id_ed25519"

usage() {
  cat <<USAGE
Usage: $0 --file <local-takeout.tgz> [options]

Copies a local Google Takeout archive to the server import temp dir.
Optional: creates and starts an import job using server-side file reuse.

Options:
  --file <path>            Local .tgz/.tar.gz file to upload (required)
  --host <ip-or-host>      Server host (default: terraform output server_ip)
  --user <ssh-user>        SSH user (default: root)
  --remote-dir <dir>       Remote target dir (default: /var/lib/custom-webmail/takeout-imports)
  --remote-name <name>     Remote filename (default: basename of --file)
  --start-import           Create and queue import job after upload
  --email <email>          Webmail account email for API login (default: config.env EMAIL)
  --password <password>    Webmail account password for API login (default: config.env MAIL_PASSWORD)
  --api-base <url>         API base on remote host (default: http://127.0.0.1:3000)
  -h, --help               Show this help

Examples:
  $0 --file ./takeout/my.tgz
  $0 --file ./takeout/my.tgz --start-import
  $0 --file ./takeout/my.tgz --host 1.2.3.4 --start-import --api-base http://127.0.0.1:3000
USAGE
}

FILE_PATH=""
HOST=""
USER_NAME="root"
REMOTE_DIR="/var/lib/custom-webmail/takeout-imports"
REMOTE_NAME=""
START_IMPORT="false"
LOGIN_EMAIL=""
LOGIN_PASSWORD=""
API_BASE="http://127.0.0.1:3000"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      FILE_PATH="${2:-}"
      shift 2
      ;;
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --user)
      USER_NAME="${2:-}"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="${2:-}"
      shift 2
      ;;
    --remote-name)
      REMOTE_NAME="${2:-}"
      shift 2
      ;;
    --start-import)
      START_IMPORT="true"
      shift
      ;;
    --email)
      LOGIN_EMAIL="${2:-}"
      shift 2
      ;;
    --password)
      LOGIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --api-base)
      API_BASE="${2:-}"
      shift 2
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

if [[ -z "$FILE_PATH" ]]; then
  echo "Missing required --file argument." >&2
  usage
  exit 1
fi

if [[ ! -f "$FILE_PATH" ]]; then
  echo "File not found: $FILE_PATH" >&2
  exit 1
fi

if [[ "${FILE_PATH,,}" != *.tgz && "${FILE_PATH,,}" != *.tar.gz ]]; then
  echo "Only .tgz or .tar.gz files are supported: $FILE_PATH" >&2
  exit 1
fi

if [[ -z "$REMOTE_NAME" ]]; then
  REMOTE_NAME="$(basename "$FILE_PATH")"
fi

if [[ -z "$HOST" ]]; then
  if command -v terraform >/dev/null 2>&1 && [[ -d "${ROOT_DIR}/infra" ]]; then
    HOST="$(cd "${ROOT_DIR}/infra" && terraform output -raw server_ip 2>/dev/null || true)"
  fi
fi

if [[ -f "${ROOT_DIR}/config.env" ]]; then
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/config.env"
fi

if [[ -z "$LOGIN_EMAIL" ]]; then
  LOGIN_EMAIL="${EMAIL:-}"
fi
if [[ -z "$LOGIN_PASSWORD" ]]; then
  LOGIN_PASSWORD="${MAIL_PASSWORD:-}"
fi

if [[ -z "$HOST" ]]; then
  echo "Could not determine server host. Pass --host <ip-or-host>." >&2
  exit 1
fi

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

echo "[upload] target=${USER_NAME}@${HOST}"
echo "[upload] local=${FILE_PATH}"
echo "[upload] remote=${REMOTE_DIR}/${REMOTE_NAME}"

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "${USER_NAME}@${HOST}" "mkdir -p '$REMOTE_DIR'"
scp -o StrictHostKeyChecking=no -i "$SSH_KEY" "$FILE_PATH" "${USER_NAME}@${HOST}:${REMOTE_DIR}/${REMOTE_NAME}"
echo "[upload] done"

if [[ "$START_IMPORT" != "true" ]]; then
  echo "[next] server import path: ${REMOTE_DIR}"
  echo "[next] expected filename in UI/API: ${REMOTE_NAME}"
  echo "[next] create and queue import with:"
  echo "curl -s -X POST ${API_BASE}/api/imports/takeout/jobs -H 'Content-Type: application/json' -d '{\"existingServerFilename\":\"${REMOTE_NAME}\"}'"
  exit 0
fi

if [[ -z "$LOGIN_EMAIL" || -z "$LOGIN_PASSWORD" ]]; then
  echo "[import] missing credentials for authenticated API calls." >&2
  echo "[import] pass --email and --password, or set EMAIL/MAIL_PASSWORD in config.env." >&2
  exit 1
fi

echo "[import] creating import job from existing server file"
set +e
CREATE_RESPONSE="$(
  ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "${USER_NAME}@${HOST}" bash -s -- \
    "$API_BASE" "$REMOTE_NAME" "$LOGIN_EMAIL" "$LOGIN_PASSWORD" <<'REMOTE'
set -euo pipefail

API_BASE="$1"
REMOTE_NAME="$2"
LOGIN_EMAIL="$3"
LOGIN_PASSWORD="$4"

COOKIE_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE"' EXIT

sign_in_payload=$(printf '{"email":"%s","password":"%s"}' "$LOGIN_EMAIL" "$LOGIN_PASSWORD")
sign_in_code="$(curl -sS -o /tmp/takeout-signin-response.json -w '%{http_code}' \
  -c "$COOKIE_FILE" \
  -X POST "${API_BASE}/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "$sign_in_payload")"

if [[ "$sign_in_code" -lt 200 || "$sign_in_code" -ge 300 ]]; then
  cat /tmp/takeout-signin-response.json
  exit 41
fi

create_payload=$(printf '{"existingServerFilename":"%s"}' "$REMOTE_NAME")
curl -sS \
  -b "$COOKIE_FILE" \
  -X POST "${API_BASE}/api/imports/takeout/jobs" \
  -H "Content-Type: application/json" \
  -d "$create_payload"
REMOTE
)"
CREATE_STATUS=$?
set -e

if [[ $CREATE_STATUS -eq 41 ]]; then
  echo "[import] sign-in failed. Response:" >&2
  echo "$CREATE_RESPONSE" >&2
  echo "[import] upload succeeded; you can start import from Webmail UI (Settings -> Import)." >&2
  exit 1
fi
if [[ $CREATE_STATUS -ne 0 ]]; then
  echo "[import] failed creating job from server file (exit $CREATE_STATUS)." >&2
  echo "$CREATE_RESPONSE" >&2
  exit 1
fi

JOB_ID="$(printf '%s' "$CREATE_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n1)"
if [[ -z "$JOB_ID" ]]; then
  echo "[import] failed to parse job id from response:" >&2
  echo "$CREATE_RESPONSE" >&2
  exit 1
fi

echo "[import] job id=${JOB_ID}"
echo "[import] queueing job"
set +e
QUEUE_OUTPUT="$(
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "${USER_NAME}@${HOST}" \
  bash -s -- "$API_BASE" "$JOB_ID" "$LOGIN_EMAIL" "$LOGIN_PASSWORD" <<'REMOTE'
set -euo pipefail

API_BASE="$1"
JOB_ID="$2"
LOGIN_EMAIL="$3"
LOGIN_PASSWORD="$4"

COOKIE_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE"' EXIT

sign_in_payload=$(printf '{"email":"%s","password":"%s"}' "$LOGIN_EMAIL" "$LOGIN_PASSWORD")
sign_in_code="$(curl -sS -o /tmp/takeout-signin-response.json -w '%{http_code}' \
  -c "$COOKIE_FILE" \
  -X POST "${API_BASE}/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "$sign_in_payload")"

if [[ "$sign_in_code" -lt 200 || "$sign_in_code" -ge 300 ]]; then
  cat /tmp/takeout-signin-response.json
  exit 42
fi

curl -sS -b "$COOKIE_FILE" -X POST "${API_BASE}/api/imports/takeout/jobs/${JOB_ID}/complete" >/dev/null
REMOTE
)"; QUEUE_STATUS=$?
set -e

if [[ $QUEUE_STATUS -eq 42 ]]; then
  echo "[import] could not queue job because sign-in failed." >&2
  echo "[import] upload succeeded; queue from Webmail UI (Settings -> Import)." >&2
  exit 1
fi
if [[ $QUEUE_STATUS -ne 0 ]]; then
  echo "[import] failed queueing job (exit $QUEUE_STATUS)." >&2
  echo "$QUEUE_OUTPUT" >&2
  exit 1
fi

echo "[import] started"
echo "[import] check status at ${API_BASE}/api/imports/takeout/jobs"
