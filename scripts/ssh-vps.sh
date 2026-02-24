#!/usr/bin/env bash
set -euo pipefail

error() {
  echo "[ssh-vps] $1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  ./hrow ssh [command...]
  ./hrow ssh --print-host

Options:
  --print-host   Print resolved server IP from Terraform state and exit
  -h, --help     Show this help
USAGE
}

mask_in_github_actions() {
  local value="${1:-}"
  if [ "${GITHUB_ACTIONS:-}" = "true" ] && [ -n "${value}" ]; then
    printf '::add-mask::%s\n' "${value}"
  fi
}

TMP_SSH_KEY=""
BACKEND_FILE=""
cleanup() {
  [ -n "${TMP_SSH_KEY}" ] && rm -f "${TMP_SSH_KEY}" || true
  [ -n "${BACKEND_FILE}" ] && rm -f "${BACKEND_FILE}" || true
}
trap cleanup EXIT

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="${PWD}"
fi

if [ ! -f "${REPO_ROOT}/flake.nix" ] || [ ! -f "${REPO_ROOT}/scripts/install.sh" ]; then
  error "run this command from inside the homerow repository."
fi

CONFIG_FILE="${DEPLOY_CONFIG_FILE:-${REPO_ROOT}/config.env}"
[ -f "${CONFIG_FILE}" ] || error "missing config file at ${CONFIG_FILE}."

PRINT_HOST_ONLY="false"
if [ "${1:-}" = "--print-host" ]; then
  PRINT_HOST_ONLY="true"
  shift
elif [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

set -a
source "${CONFIG_FILE}"
set +a

VPS_STACK="${VPS_STACK:-hetzner}"
HETZNER_OBJECT_STORAGE_LOCATION="${HETZNER_OBJECT_STORAGE_LOCATION:-${S3_LOCATION:-nbg1}}"
TF_STATE_BUCKET_NAME="${TF_STATE_BUCKET_NAME:-mail-tfstate-${DOMAIN//./-}}"
TF_STATE_PREFIX="${TF_STATE_PREFIX:-${DOMAIN}}"
TF_STATE_PREFIX="$(echo "${TF_STATE_PREFIX}" | sed -E 's#^/+##; s#/+$##; s#//+#/#g')"
if [ -z "${TF_STATE_PREFIX}" ]; then
  error "TF_STATE_PREFIX must not be empty."
fi

required_vars=(
  DOMAIN
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

VPS_DIR="${REPO_ROOT}/infra/vps/${VPS_STACK}"
[ -d "${VPS_DIR}" ] || error "Unknown VPS stack '${VPS_STACK}'."

BACKEND_FILE="$(mktemp)"
cat > "${BACKEND_FILE}" <<EOF
bucket = "${TF_STATE_BUCKET_NAME}"
key = "${TF_STATE_PREFIX}/vps-${VPS_STACK}.tfstate"
region = "${HETZNER_OBJECT_STORAGE_LOCATION}"
access_key = "${S3_ACCESS_KEY}"
secret_key = "${S3_SECRET_KEY}"
endpoints = { s3 = "https://${HETZNER_OBJECT_STORAGE_LOCATION}.your-objectstorage.com" }
skip_credentials_validation = true
skip_requesting_account_id = true
skip_region_validation = true
EOF

terraform -chdir="${VPS_DIR}" init -input=false -backend-config="${BACKEND_FILE}" >/dev/null
SERVER_IP="$(terraform -chdir="${VPS_DIR}" output -raw server_ip 2>/dev/null || true)"
[ -n "${SERVER_IP}" ] || error "could not resolve server_ip from terraform state."
mask_in_github_actions "${SERVER_IP}"

if [ "${PRINT_HOST_ONLY}" = "true" ]; then
  printf '%s\n' "${SERVER_IP}"
  exit 0
fi

SSH_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${REPO_ROOT}/infra/id_ed25519}"
if [[ "${SSH_KEY_PATH}" != /* ]]; then
  SSH_KEY_PATH="${REPO_ROOT}/${SSH_KEY_PATH}"
fi

if [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  TMP_SSH_KEY="$(mktemp)"
  printf '%s\n' "${SSH_PRIVATE_KEY}" > "${TMP_SSH_KEY}"
  chmod 600 "${TMP_SSH_KEY}"
  SSH_KEY_PATH="${TMP_SSH_KEY}"
fi

[ -f "${SSH_KEY_PATH}" ] || error "SSH private key not found: ${SSH_KEY_PATH}"

exec ssh -o StrictHostKeyChecking=no -i "${SSH_KEY_PATH}" "root@${SERVER_IP}" "$@"
