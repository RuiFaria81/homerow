#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  push-gh-secrets.sh [--config path/to/config.env] [--repo owner/repo] [--ssh-key path/to/private_key]

Notes:
  - Requires GitHub CLI (`gh`) and authenticated session (`gh auth login`).
  - Can run inside or outside this repository.
  - Pushes non-empty values from config.env as repository secrets.
  - Pushes SSH_PRIVATE_KEY from --ssh-key path, or infra/id_ed25519 if found.
EOF
}

error() {
  echo "[push-gh-secrets] $1" >&2
  exit 1
}

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  CONFIG_FILE="${REPO_ROOT}/config.env"
  DEFAULT_SSH_KEY_FILE="${REPO_ROOT}/infra/id_ed25519"
else
  REPO_ROOT="${PWD}"
  CONFIG_FILE="${PWD}/config.env"
  DEFAULT_SSH_KEY_FILE="${PWD}/infra/id_ed25519"
fi

TARGET_REPO=""
SSH_KEY_FILE="${DEFAULT_SSH_KEY_FILE}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --config)
      [ "$#" -ge 2 ] || error "--config requires a value."
      CONFIG_FILE="$2"
      shift 2
      ;;
    --repo)
      [ "$#" -ge 2 ] || error "--repo requires a value."
      TARGET_REPO="$2"
      shift 2
      ;;
    --ssh-key)
      [ "$#" -ge 2 ] || error "--ssh-key requires a value."
      SSH_KEY_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      error "unknown argument: $1"
      ;;
  esac
done

command -v gh >/dev/null 2>&1 || error "GitHub CLI not found. Install `gh` first."
gh auth status >/dev/null 2>&1 || error "GitHub CLI is not authenticated. Run `gh auth login`."

[ -f "${CONFIG_FILE}" ] || error "config file not found: ${CONFIG_FILE}"

set -a
source "${CONFIG_FILE}"
set +a

gh_args=()
if [ -n "${TARGET_REPO}" ]; then
  gh_args+=(--repo "${TARGET_REPO}")
fi

secrets=(
  DOMAIN
  EMAIL
  MAIL_PASSWORD
  RESTIC_PASSWORD
  HCLOUD_TOKEN
  CLOUDFLARE_TOKEN
  CLOUDFLARE_ZONE_ID
  S3_ACCESS_KEY
  S3_SECRET_KEY
  ACME_ENV
  VPS_STACK
  DNS_STACK
  STORAGE_STACK
  HETZNER_SERVER_TYPE
  HETZNER_LOCATION
  HETZNER_REUSE_EXISTING_SERVER
  HETZNER_OBJECT_STORAGE_LOCATION
  WEBMAIL_SUBDOMAIN
  TF_STATE_BUCKET_NAME
  TF_STATE_PREFIX
  SEED_INBOX
  SEED_INBOX_COUNT
  SEED_INBOX_INCLUDE_CATEGORIES
)

set_secret() {
  local name="$1"
  local value="$2"
  gh secret set "${name}" "${gh_args[@]}" --body "${value}" >/dev/null
  echo "[push-gh-secrets] set ${name}"
}

for name in "${secrets[@]}"; do
  value="${!name:-}"
  if [ -n "${value}" ]; then
    set_secret "${name}" "${value}"
  fi
done

if [ -f "${SSH_KEY_FILE}" ]; then
  gh secret set SSH_PRIVATE_KEY "${gh_args[@]}" < "${SSH_KEY_FILE}" >/dev/null
  echo "[push-gh-secrets] set SSH_PRIVATE_KEY (from ${SSH_KEY_FILE})"
else
  echo "[push-gh-secrets] skipped SSH_PRIVATE_KEY (${SSH_KEY_FILE} not found)"
fi

echo "[push-gh-secrets] done"
