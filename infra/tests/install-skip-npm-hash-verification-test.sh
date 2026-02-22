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

expect_contains 'SKIP_NPM_DEPS_HASH_VERIFICATION=${SKIP_NPM_DEPS_HASH_VERIFICATION:-"false"}'
expect_contains 'case "${SKIP_NPM_DEPS_HASH_VERIFICATION}" in'
expect_contains 'if [ "${SKIP_NPM_DEPS_HASH_VERIFICATION}" = "true" ]; then'
expect_contains 'Skipping Nix npm dependency hash refresh/verification (SKIP_NPM_DEPS_HASH_VERIFICATION=true).'
expect_contains './scripts/refresh-npm-deps-hashes.sh'

echo "install skip npm hash verification test: ok"
