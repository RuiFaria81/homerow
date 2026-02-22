#!/usr/bin/env bash
set -euo pipefail

error() {
  echo "[deploy] $1" >&2
  exit 1
}

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="${PWD}"
fi

if [ ! -f "${REPO_ROOT}/flake.nix" ] || [ ! -f "${REPO_ROOT}/scripts/install.sh" ]; then
  error "run this command from inside the homerow repository."
fi

CONFIG_FILE="${DEPLOY_CONFIG_FILE:-${REPO_ROOT}/config.env}"
INSTALL_CMD="${DEPLOY_INSTALL_CMD:-${REPO_ROOT}/scripts/install.sh}"

if [ ! -f "${CONFIG_FILE}" ]; then
  error "missing config file at ${CONFIG_FILE}."
fi

if [ "${DEPLOY_SKIP_UPDATE_CHECK:-}" != "1" ]; then
  "${REPO_ROOT}/scripts/print-update-notice.sh" "${REPO_ROOT}" || true
fi

set -a
source "${CONFIG_FILE}"
set +a

required_vars=(
  DOMAIN
  MAIL_PASSWORD
  RESTIC_PASSWORD
  HCLOUD_TOKEN
  CLOUDFLARE_TOKEN
  CLOUDFLARE_ZONE_ID
  S3_ACCESS_KEY
  S3_SECRET_KEY
)

missing=()
for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    missing+=("${var_name}")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  error "missing required variables in ${CONFIG_FILE}: ${missing[*]}"
fi

cd "${REPO_ROOT}"
exec "${INSTALL_CMD}" "$@"
