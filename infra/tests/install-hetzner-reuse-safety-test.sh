#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if grep -Fq 'EXISTING_HCLOUD_SSH_KEY_ID="$(find_existing_hcloud_ssh_key_id "${DEPLOY_SSH_PUBLIC_KEY_PATH}")"' "${INSTALL_SCRIPT}"; then
  echo "did not expect install.sh to auto-detect existing Hetzner SSH key id" >&2
  exit 1
fi

if grep -Fq 'EXISTING_SERVER_INFO="$(find_existing_hcloud_server "mail-server")"' "${INSTALL_SCRIPT}"; then
  echo "did not expect install.sh to auto-detect existing Hetzner server id" >&2
  exit 1
fi

if ! grep -Fq 'Set HETZNER_EXISTING_SERVER_ID and HETZNER_EXISTING_SERVER_IPV4 explicitly to reuse an unmanaged server.' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to require explicit existing server reuse inputs" >&2
  exit 1
fi

if ! grep -Fq 'Set HETZNER_EXISTING_SSH_KEY_ID explicitly to reuse an unmanaged key.' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to require explicit existing ssh key reuse input" >&2
  exit 1
fi

echo "install hetzner reuse safety test: ok"
