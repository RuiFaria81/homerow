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

expect_contains 'terraform_state_has_resource() {'
expect_contains 'hcloud_server.mail[0]'
expect_contains 'Terraform state already manages hcloud_server.mail[0]; refusing auto-reuse mode for safety.'
expect_contains 'Refusing existing server reuse variables because Terraform state already manages hcloud_server.mail[0].'

echo "install safe reuse test: ok"
