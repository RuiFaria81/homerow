#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"
WEBMAIL_MODULE="${ROOT_DIR}/modules/webmail.nix"

expect_contains() {
  local file="$1"
  local pattern="$2"
  if ! grep -Fq -- "$pattern" "$file"; then
    echo "expected ${file} to contain: ${pattern}" >&2
    exit 1
  fi
}

expect_contains "${WEBMAIL_MODULE}" 'systemd.services.custom-webmail-blue = mkWebmailService "blue" webmailBluePort;'
expect_contains "${WEBMAIL_MODULE}" 'systemd.services.custom-webmail-green = mkWebmailService "green" webmailGreenPort;'
expect_contains "${WEBMAIL_MODULE}" 'services.nginx.upstreams.custom-webmail.servers'
expect_contains "${WEBMAIL_MODULE}" 'restartIfChanged = false;'

expect_contains "${INSTALL_SCRIPT}" 'rollout_webmail_slots() {'
expect_contains "${INSTALL_SCRIPT}" 'restart_slot custom-webmail-blue 3001'
expect_contains "${INSTALL_SCRIPT}" 'restart_slot custom-webmail-green 3002'
expect_contains "${INSTALL_SCRIPT}" 'run_timed_step "rolling webmail restart (${SERVER_IP})" rollout_webmail_slots "${SERVER_IP}" "${DEPLOY_SSH_PRIVATE_KEY_PATH}"'

echo "install webmail rolling release test: ok"
