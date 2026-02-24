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

HELP_OUTPUT="$(DEV_MODE=false "${CLI}" help)"
echo "${HELP_OUTPUT}" | grep -q "ssh"
echo "${HELP_OUTPUT}" | grep -q "backup"
echo "${HELP_OUTPUT}" | grep -q "import"
echo "${HELP_OUTPUT}" | grep -q "deploy"
echo "${HELP_OUTPUT}" | grep -q "Unified deploy entrypoint"
echo "${HELP_OUTPUT}" | grep -q "destroy"
if echo "${HELP_OUTPUT}" | grep -q "e2e"; then
  echo "expected hrow help to hide e2e command when DEV_MODE=false" >&2
  exit 1
fi

HELP_OUTPUT_DEV="$(DEV_MODE=true "${CLI}" help)"
echo "${HELP_OUTPUT_DEV}" | grep -q "e2e"

TOP_LEVEL_HELP_OUTPUT="$("${TOP_LEVEL_CLI}" help)"
echo "${TOP_LEVEL_HELP_OUTPUT}" | grep -q "Usage:"
echo "${TOP_LEVEL_HELP_OUTPUT}" | grep -q "deploy"

UNKNOWN_LOG="$(mktemp)"
DEPLOY_INVALID_LOG=""
GITHUB_HELP_LOG=""
DOCKER_CMD_LOG=""
E2E_DISABLED_LOG=""
trap 'rm -f "${UNKNOWN_LOG}" "${DEPLOY_INVALID_LOG}" "${GITHUB_HELP_LOG}" "${DOCKER_CMD_LOG}" "${E2E_DISABLED_LOG}"' EXIT
if "${CLI}" unknown-command >"${UNKNOWN_LOG}" 2>&1; then
  echo "expected hrow to fail on unknown command" >&2
  exit 1
fi
grep -q "unknown command" "${UNKNOWN_LOG}"

if ! grep -Fq 'run_command_with_mode "ssh" "${REPO_ROOT}/scripts/ssh-vps.sh" "ssh" "$@"' "${CLI}"; then
  echo "expected hrow ssh command to route through unified mode dispatcher" >&2
  exit 1
fi

if ! grep -Fq 'run_command_with_mode "backup" "${REPO_ROOT}/scripts/backup.sh" "backup" "$@"' "${CLI}"; then
  echo "expected hrow backup command to route through unified mode dispatcher" >&2
  exit 1
fi

if ! grep -Fq 'run_unified_deploy() {' "${CLI}"; then
  echo "expected hrow deploy command to route through unified dispatcher" >&2
  exit 1
fi

if ! grep -Fq 'run_docker_command deploy "$@"' "${CLI}"; then
  echo "expected unified deploy dispatcher to support docker mode" >&2
  exit 1
fi

if ! grep -Fq 'run_command_with_mode() {' "${CLI}"; then
  echo "expected hrow non-deploy commands to route through unified local/docker dispatcher" >&2
  exit 1
fi

if ! grep -Fq 'resolve_default_local_or_docker_mode() {' "${CLI}"; then
  echo "expected hrow to support USE_DOCKER default mode resolution" >&2
  exit 1
fi

if ! grep -Fq 'USE_DOCKER' "${CLI}"; then
  echo "expected hrow to reference USE_DOCKER default mode flag" >&2
  exit 1
fi

if grep -Fq 'fork-deploy)' "${CLI}"; then
  echo "expected top-level fork-deploy command to be removed in favor of deploy --via github" >&2
  exit 1
fi

if ! grep -Fq 'run_command_with_mode "import" "${REPO_ROOT}/scripts/import.sh" "import" "$@"' "${CLI}"; then
  echo "expected hrow import command to route through unified mode dispatcher" >&2
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

DEPLOY_INVALID_LOG="$(mktemp)"
if "${CLI}" deploy --via invalid >"${DEPLOY_INVALID_LOG}" 2>&1; then
  echo "expected deploy --via invalid to fail" >&2
  exit 1
fi
grep -q "invalid deploy mode" "${DEPLOY_INVALID_LOG}"

DOCKER_CMD_LOG="$(mktemp)"
if "${CLI}" docker deploy >"${DOCKER_CMD_LOG}" 2>&1; then
  echo "expected top-level docker command to fail" >&2
  exit 1
fi
grep -q "unknown command" "${DOCKER_CMD_LOG}"

E2E_DISABLED_LOG="$(mktemp)"
if DEV_MODE=false "${CLI}" e2e >"${E2E_DISABLED_LOG}" 2>&1; then
  echo "expected hrow e2e command to fail when DEV_MODE=false" >&2
  exit 1
fi
grep -q "available only when DEV_MODE=true" "${E2E_DISABLED_LOG}"

GITHUB_HELP_LOG="$(mktemp)"
"${CLI}" deploy --via github --help >"${GITHUB_HELP_LOG}" 2>&1
grep -q "fork-deploy.sh" "${GITHUB_HELP_LOG}"

DEPLOY_HELP_OUTPUT="$("${CLI}" deploy --help)"
echo "${DEPLOY_HELP_OUTPUT}" | grep -q "./hrow deploy"
echo "${DEPLOY_HELP_OUTPUT}" | grep -q "local|docker|github"
echo "${DEPLOY_HELP_OUTPUT}" | grep -q "USE_DOCKER=true"

if ! grep -Fq 'SSH_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-${REPO_ROOT}/infra/id_ed25519}"' "${SSH_HELPER}"; then
  echo "expected ssh-vps.sh to use SSH_PRIVATE_KEY_PATH for key path input" >&2
  exit 1
fi

echo "project cli test: ok"
