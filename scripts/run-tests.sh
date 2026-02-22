#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBMAIL_DIR="$ROOT_DIR/webmail"
CONFIG_FILE="$ROOT_DIR/config.env"
SPEC_FILE="${1:-e2e/category-regressions.spec.ts}"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

DEFAULT_DOMAIN="${DOMAIN:-inout.email}"
DEFAULT_WEBMAIL_SUBDOMAIN="${WEBMAIL_SUBDOMAIN:-webmail}"
export E2E_BASE_URL="${E2E_BASE_URL:-https://${DEFAULT_WEBMAIL_SUBDOMAIN}.${DEFAULT_DOMAIN}}"
export E2E_EMAIL="${E2E_EMAIL:-${EMAIL:-admin@${DEFAULT_DOMAIN}}}"
export E2E_PASSWORD="${E2E_PASSWORD:-${MAIL_PASSWORD:-}}"

if [[ -z "${E2E_PASSWORD}" ]]; then
  cat <<'EOF'
Missing E2E credentials.

Set E2E_PASSWORD in your environment or in config.env, then run again.
Example:
  E2E_PASSWORD='your-password' ./scripts/run-tests.sh
EOF
  exit 1
fi

cd "$WEBMAIL_DIR"
npm run e2e -- "$SPEC_FILE"
