#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTROY_SCRIPT="${ROOT_DIR}/scripts/destroy.sh"

if [ ! -x "${DESTROY_SCRIPT}" ]; then
  echo "expected destroy.sh to be executable" >&2
  exit 1
fi

expect_contains() {
  local pattern="$1"
  if ! grep -Fq -- "$pattern" "${DESTROY_SCRIPT}"; then
    echo "expected ${DESTROY_SCRIPT} to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains 'write_s3_backend_config() {'
expect_contains 'DELETE_STORAGE="false"'
expect_contains '--delete-storage'
expect_contains 'TF_STATE_BUCKET_NAME=${TF_STATE_BUCKET_NAME:-"mail-tfstate-${DOMAIN//./-}"}'
expect_contains 'TF_STATE_PREFIX=${TF_STATE_PREFIX:-"${DOMAIN}"}'
expect_contains 'write_s3_backend_config "$TEMP_TF_BACKEND_VPS" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/vps-${VPS_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"'
expect_contains 'write_s3_backend_config "$TEMP_TF_BACKEND_DNS" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/dns-${DNS_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"'
expect_contains 'write_s3_backend_config "$TEMP_TF_BACKEND_STORAGE" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/storage-${STORAGE_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"'
expect_contains 'terraform -chdir="${dir}" init -input=false -backend-config="${backend_config}" >/dev/null'
expect_contains 'if terraform -chdir="${dir}" state pull >/dev/null 2>&1 || [ -f "${dir}/terraform.tfstate" ]; then'
expect_contains 'terraform -chdir="${dir}" destroy -input=false -auto-approve "${tf_vars[@]}"'
expect_contains 'BACKUP_BUCKET_NAME=${BACKUP_BUCKET_NAME:-"mail-backup-${DOMAIN//./-}"}'
expect_contains '-var="bucket_name=${BACKUP_BUCKET_NAME}"'
expect_contains '-var="s3_access_key=${S3_ACCESS_KEY:-}"'
expect_contains '-var="s3_secret_key=${S3_SECRET_KEY:-}"'
expect_contains 'if [[ "${DELETE_STORAGE}" == "true" ]]; then'
expect_contains 'destroy_stack "${STORAGE_STACK_DIR}" "[1/4] Destroying storage stack..." "${TEMP_TF_BACKEND_STORAGE}"'
expect_contains 'log "Skipping storage stack destroy (use --delete-storage to include backup data and bucket resources)."'
expect_contains 'destroy_stack "${DNS_STACK_DIR}" "[2/4] Destroying DNS stack..." "${TEMP_TF_BACKEND_DNS}"'
expect_contains '-var="mail_server_ipv4=${DNS_MAIL_SERVER_IPV4}"'
expect_contains '-var="cloudflare_token=${CLOUDFLARE_TOKEN}"'
expect_contains '-var="hcloud_token=${HCLOUD_TOKEN}"'
expect_contains 'TEMP_DESTROY_SSH_PUBLIC_KEY="$(mktemp)"'
expect_contains '-var="ssh_public_key_path=${TEMP_DESTROY_SSH_PUBLIC_KEY}"'
expect_contains 'rm -f "${TEMP_DESTROY_SSH_PUBLIC_KEY:-}"'

echo "destroy terraform state test: ok"
