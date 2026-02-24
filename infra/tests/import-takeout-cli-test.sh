#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMPORT_SCRIPT="${ROOT_DIR}/scripts/import.sh"
TAKEOUT_SCRIPT="${ROOT_DIR}/scripts/import-takeout.sh"

if [ ! -x "${IMPORT_SCRIPT}" ]; then
  echo "expected import.sh to be executable" >&2
  exit 1
fi

if [ ! -x "${TAKEOUT_SCRIPT}" ]; then
  echo "expected import-takeout.sh to be executable" >&2
  exit 1
fi

expect_contains() {
  local file="$1"
  local pattern="$2"
  if ! grep -Fq -- "$pattern" "$file"; then
    echo "expected ${file} to contain: $pattern" >&2
    exit 1
  fi
}

expect_contains "${IMPORT_SCRIPT}" './hrow import <source> [options]'
expect_contains "${IMPORT_SCRIPT}" 'takeout    Import Google Takeout archives'
expect_contains "${IMPORT_SCRIPT}" 'exec "${ROOT_DIR}/import-takeout.sh" "$@"'

expect_contains "${TAKEOUT_SCRIPT}" 'START_IMPORT="true"'
expect_contains "${TAKEOUT_SCRIPT}" '--upload-only            Only upload archive; do not create/start import job'
expect_contains "${TAKEOUT_SCRIPT}" '--keep-remote            Keep uploaded archive on server after successful import'
expect_contains "${TAKEOUT_SCRIPT}" '"${SSH_HELPER}" --print-host'
expect_contains "${TAKEOUT_SCRIPT}" 'rm -f '\''${REMOTE_DIR}/${REMOTE_NAME}'\''' 

IMPORT_HELP_LOG="$(mktemp)"
IMPORT_UNKNOWN_LOG=""
trap 'rm -f "${IMPORT_HELP_LOG}" "${IMPORT_UNKNOWN_LOG}"' EXIT
"${IMPORT_SCRIPT}" >"${IMPORT_HELP_LOG}" 2>&1
expect_contains "${IMPORT_HELP_LOG}" './hrow import <source> [options]'

IMPORT_UNKNOWN_LOG="$(mktemp)"
if "${IMPORT_SCRIPT}" unknown-source >"${IMPORT_UNKNOWN_LOG}" 2>&1; then
  echo "expected import.sh unknown source to fail" >&2
  exit 1
fi
expect_contains "${IMPORT_UNKNOWN_LOG}" '[import] unknown source: unknown-source'

echo "import takeout cli test: ok"
