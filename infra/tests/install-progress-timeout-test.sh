#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if ! grep -Fq 'wait_for_ssh_ready() {' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define wait_for_ssh_ready helper" >&2
  exit 1
fi

if ! grep -Fq 'SSH_READY_TIMEOUT_SECONDS="${SSH_READY_TIMEOUT_SECONDS:-600}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define configurable SSH readiness timeout" >&2
  exit 1
fi

if ! grep -Fq 'run_timed_step "nixos-anywhere install (${SERVER_IP})"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to time nixos-anywhere execution" >&2
  exit 1
fi

if ! grep -Fq 'run_timed_step "nixos-rebuild switch (${SERVER_IP})"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to time nixos-rebuild execution" >&2
  exit 1
fi

if ! grep -Fq 'run_timed_step "terraform apply (${VPS_STACK_DIR})"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to time terraform apply for vps stack" >&2
  exit 1
fi

echo "install progress timeout test: ok"
