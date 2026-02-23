#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="${ROOT_DIR}/scripts/hrow.sh"
TOP_LEVEL_CLI="${ROOT_DIR}/hrow"
SSH_HELPER="${ROOT_DIR}/scripts/ssh-vps.sh"

if [ ! -x "${CLI}" ]; then
  echo "expected scripts/hrow.sh to be executable" >&2
  exit 1
fi

if [ ! -x "${TOP_LEVEL_CLI}" ]; then
  echo "expected ./hrow launcher to be executable" >&2
  exit 1
fi

if [ ! -x "${SSH_HELPER}" ]; then
  echo "expected scripts/ssh-vps.sh to be executable" >&2
  exit 1
fi

HELP_OUTPUT="$("${CLI}" help)"
echo "${HELP_OUTPUT}" | grep -q "ssh"
echo "${HELP_OUTPUT}" | grep -q "fork-deploy"
echo "${HELP_OUTPUT}" | grep -q "deploy"
echo "${HELP_OUTPUT}" | grep -q "docker"

TOP_LEVEL_HELP_OUTPUT="$("${TOP_LEVEL_CLI}" help)"
echo "${TOP_LEVEL_HELP_OUTPUT}" | grep -q "Usage:"
echo "${TOP_LEVEL_HELP_OUTPUT}" | grep -q "docker"

UNKNOWN_LOG="$(mktemp)"
trap 'rm -f "${UNKNOWN_LOG}"' EXIT
if "${CLI}" unknown-command >"${UNKNOWN_LOG}" 2>&1; then
  echo "expected hrow to fail on unknown command" >&2
  exit 1
fi
grep -q "unknown command" "${UNKNOWN_LOG}"

if ! grep -Fq 'exec "${REPO_ROOT}/scripts/ssh-vps.sh" "$@"' "${CLI}"; then
  echo "expected hrow ssh command to call scripts/ssh-vps.sh" >&2
  exit 1
fi

if ! grep -Fq 'run_docker_command "$@"' "${CLI}"; then
  echo "expected hrow docker command to invoke docker wrapper" >&2
  exit 1
fi

if ! grep -Fq 'resolve_ssh_private_key_content() {' "${CLI}"; then
  echo "expected hrow docker wrapper to resolve SSH key content from SSH_PRIVATE_KEY_PATH" >&2
  exit 1
fi

if ! grep -Fq 'if [ -n "${SSH_PRIVATE_KEY:-}" ]; then' "${SSH_HELPER}"; then
  echo "expected ssh-vps.sh to support SSH_PRIVATE_KEY input" >&2
  exit 1
fi

if ! grep -Fq 'SSH_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${REPO_ROOT}/infra/id_ed25519}"' "${SSH_HELPER}"; then
  echo "expected ssh-vps.sh to use SSH_PRIVATE_KEY_PATH for key path input" >&2
  exit 1
fi

echo "project cli test: ok"
