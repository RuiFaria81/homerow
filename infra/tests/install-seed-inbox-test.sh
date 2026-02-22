#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"
SEED_SCRIPT="${ROOT_DIR}/webmail/scripts/seed-e2e.mjs"

expect_contains() {
  local file="$1"
  local pattern="$2"
  if ! grep -Fq -- "$pattern" "$file"; then
    echo "expected ${file} to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains "$INSTALL_SCRIPT" 'SEED_INBOX=${SEED_INBOX:-"false"}'
expect_contains "$INSTALL_SCRIPT" 'SEED_INBOX_COUNT=${SEED_INBOX_COUNT:-"12"}'
expect_contains "$INSTALL_SCRIPT" 'SEED_INBOX_INCLUDE_CATEGORIES=${SEED_INBOX_INCLUDE_CATEGORIES:-"false"}'
expect_contains "$INSTALL_SCRIPT" 'E2E_SEED_SKIP_CATEGORY_ASSIGNMENTS="${SEED_SKIP_CATEGORY_ASSIGNMENTS}"'
expect_contains "$INSTALL_SCRIPT" 'npm run seed:e2e'
expect_contains "$SEED_SCRIPT" 'E2E_SEED_SKIP_CATEGORY_ASSIGNMENTS'
expect_contains "$SEED_SCRIPT" 'Skipping category assignment'

echo "install seed inbox test: ok"
