#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

expect_contains() {
  local pattern="$1"
  if ! grep -Fq -- "$pattern" "$INSTALL_SCRIPT"; then
    echo "expected install.sh to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains 'TF_IMPORT_TIMEOUT_SECONDS="${TF_IMPORT_TIMEOUT_SECONDS:-120}"'
expect_contains 'if terraform_state_has_resource "$dir" "$resource_addr"; then'
expect_contains 'timeout "${TF_IMPORT_TIMEOUT_SECONDS}" terraform -chdir="$dir" import -input=false -no-color "$resource_addr" "$import_id"'
expect_contains 'gtimeout "${TF_IMPORT_TIMEOUT_SECONDS}" terraform -chdir="$dir" import -input=false -no-color "$resource_addr" "$import_id"'
expect_contains 'Terraform import skipped for ${resource_addr} (${import_id}) due to non-zero exit (${import_exit}).'

echo "install import timeout test: ok"
