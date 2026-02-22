#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_MODULE="${ROOT_DIR}/modules/configuration.nix"
SYNC_MODULE="${ROOT_DIR}/modules/sync-engine.nix"
WEBMAIL_MODULE="${ROOT_DIR}/modules/webmail.nix"
HETZNER_VPS_TF="${ROOT_DIR}/infra/vps/hetzner/main.tf"

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq "$expected" "$file"; then
    echo "expected '$expected' in $file" >&2
    exit 1
  fi
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  if grep -Fq "$unexpected" "$file"; then
    echo "did not expect '$unexpected' in $file" >&2
    exit 1
  fi
}

# SSH + host hardening
assert_contains "${CONFIG_MODULE}" 'PasswordAuthentication = false;'
assert_contains "${CONFIG_MODULE}" 'KbdInteractiveAuthentication = false;'
assert_contains "${CONFIG_MODULE}" 'PermitRootLogin = "prohibit-password";'
assert_contains "${CONFIG_MODULE}" 'services.fail2ban = {'

# App/runtime hardening
assert_not_contains "${SYNC_MODULE}" 'NODE_TLS_REJECT_UNAUTHORIZED = "0";'
assert_not_contains "${WEBMAIL_MODULE}" 'NODE_TLS_REJECT_UNAUTHORIZED = "0";'
assert_contains "${SYNC_MODULE}" 'scram-sha-256'
assert_not_contains "${SYNC_MODULE}" 'local mailsync mailsync trust'
assert_not_contains "${SYNC_MODULE}" "psql <<'SQL'"
assert_contains "${SYNC_MODULE}" 'psql <<SQL'

assert_contains "${SYNC_MODULE}" 'NoNewPrivileges = true;'
assert_contains "${WEBMAIL_MODULE}" 'NoNewPrivileges = true;'
assert_contains "${SYNC_MODULE}" 'RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" ];'
assert_contains "${WEBMAIL_MODULE}" 'RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" ];'
assert_contains "${WEBMAIL_MODULE}" 'DB_PASSWORD = "${settings.imapPassword}";'
assert_not_contains "${SYNC_MODULE}" 'RemainAfterExit = true;'
assert_not_contains "${WEBMAIL_MODULE}" 'RemainAfterExit = true;'

# Cloud perimeter hardening
assert_contains "${HETZNER_VPS_TF}" 'resource "hcloud_firewall" "mail" {'
assert_contains "${HETZNER_VPS_TF}" 'resource "hcloud_firewall_attachment" "mail" {'
assert_contains "${HETZNER_VPS_TF}" 'variable "allowed_ssh_cidrs" {'

echo "security hardening test: ok"
