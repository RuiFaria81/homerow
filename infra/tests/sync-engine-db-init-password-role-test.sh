#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYNC_ENGINE_MODULE="${ROOT_DIR}/modules/sync-engine.nix"

expect_contains() {
  local pattern="$1"
  if ! grep -Fq -- "$pattern" "$SYNC_ENGINE_MODULE"; then
    echo "expected sync-engine.nix to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains "psql <<'SQL'"
expect_contains 'DO $do$'
expect_contains "CREATE ROLE mailsync WITH LOGIN PASSWORD"
expect_contains "ALTER ROLE mailsync WITH LOGIN PASSWORD"

echo "sync-engine db init password role test: ok"
