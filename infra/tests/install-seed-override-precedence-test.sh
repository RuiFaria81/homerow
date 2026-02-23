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

expect_contains 'SEED_INBOX_OVERRIDE_SET="${SEED_INBOX+x}"'
expect_contains 'SEED_INBOX_COUNT_OVERRIDE_SET="${SEED_INBOX_COUNT+x}"'
expect_contains 'SEED_INBOX_INCLUDE_CATEGORIES_OVERRIDE_SET="${SEED_INBOX_INCLUDE_CATEGORIES+x}"'
expect_contains 'source config.env'
expect_contains 'if [ -n "${SEED_INBOX_OVERRIDE_SET}" ]; then'
expect_contains 'SEED_INBOX="${SEED_INBOX_OVERRIDE_VALUE}"'
expect_contains 'if [ -n "${SEED_INBOX_COUNT_OVERRIDE_SET}" ]; then'
expect_contains 'SEED_INBOX_COUNT="${SEED_INBOX_COUNT_OVERRIDE_VALUE}"'
expect_contains 'if [ -n "${SEED_INBOX_INCLUDE_CATEGORIES_OVERRIDE_SET}" ]; then'
expect_contains 'SEED_INBOX_INCLUDE_CATEGORIES="${SEED_INBOX_INCLUDE_CATEGORIES_OVERRIDE_VALUE}"'

echo "install seed override precedence test: ok"
