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
expect_contains 'TF_STATE_BUCKET_NAME=${TF_STATE_BUCKET_NAME:-"mail-tfstate-${DOMAIN//./-}"}'
expect_contains 'TF_STATE_PREFIX=${TF_STATE_PREFIX:-"${DOMAIN}"}'
expect_contains 'write_s3_backend_config "$TEMP_TF_BACKEND_VPS" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/vps-${VPS_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"'
expect_contains 'write_s3_backend_config "$TEMP_TF_BACKEND_DNS" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/dns-${DNS_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"'
expect_contains 'write_s3_backend_config "$TEMP_TF_BACKEND_STORAGE" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/storage-${STORAGE_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"'
expect_contains 'terraform -chdir="${dir}" init -input=false -backend-config="${backend_config}" >/dev/null'
expect_contains 'if terraform -chdir="${dir}" state pull >/dev/null 2>&1 || [ -f "${dir}/terraform.tfstate" ]; then'
expect_contains 'destroy_stack "${STORAGE_STACK_DIR}" "[1/4] Destroying storage stack..." "${TEMP_TF_BACKEND_STORAGE}"'
expect_contains 'destroy_stack "${DNS_STACK_DIR}" "[2/4] Destroying DNS stack..." "${TEMP_TF_BACKEND_DNS}" -var="mail_server_ipv4=${DNS_MAIL_SERVER_IPV4}"'
expect_contains 'destroy_stack "${VPS_STACK_DIR}" "[3/4] Destroying VPS stack..." "${TEMP_TF_BACKEND_VPS}"'

echo "destroy terraform state test: ok"
