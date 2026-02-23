#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "${ROOT_DIR}/flake.nix" ] || [ ! -f "${ROOT_DIR}/scripts/install.sh" ]; then
  echo "[deploy] run from the homerow repository root." >&2
  exit 1
fi

resolve_ssh_private_key_content() {
  local config_file="$1"
  local key_content="${SSH_PRIVATE_KEY:-}"
  if [ -n "${key_content}" ]; then
    printf '%s' "${key_content}"
    return 0
  fi

  local key_path="${SSH_PRIVATE_KEY_PATH:-}"
  if [ -z "${key_path}" ] && [ -f "${config_file}" ]; then
    key_path="$(set -a; source "${config_file}"; set +a; printf '%s' "${SSH_PRIVATE_KEY_PATH:-}")"
  fi

  if [ -z "${key_path}" ]; then
    return 0
  fi
  if [[ "${key_path}" != /* ]]; then
    key_path="${ROOT_DIR}/${key_path}"
  fi
  [ -f "${key_path}" ] || { echo "[deploy] SSH private key not found: ${key_path}" >&2; exit 1; }

  cat "${key_path}"
}

ENGINE="${DEPLOY_ENGINE:-}"
if [ -z "${ENGINE}" ]; then
  if command -v docker >/dev/null 2>&1; then
    ENGINE="docker"
  elif command -v podman >/dev/null 2>&1; then
    ENGINE="podman"
  else
    echo "[deploy] docker or podman is required." >&2
    exit 1
  fi
fi

IMAGE="${DEPLOY_IMAGE:-homerow/deployer:latest}"
CONFIG_FILE="${DEPLOY_CONFIG_FILE:-${ROOT_DIR}/config.env}"
BUILD_POLICY="${DEPLOY_BUILD_POLICY:-if-missing}" # if-missing | always | never
CONTAINER_CONFIG_PATH="/tmp/.deploy-config.env"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "[deploy] missing config file at ${CONFIG_FILE}" >&2
  exit 1
fi

SSH_PRIVATE_KEY_CONTENT="$(resolve_ssh_private_key_content "${CONFIG_FILE}")"

has_image=0
if "${ENGINE}" image inspect "${IMAGE}" >/dev/null 2>&1; then
  has_image=1
fi

case "${BUILD_POLICY}" in
  always)
    "${ENGINE}" build -f "${ROOT_DIR}/Dockerfile.deploy" -t "${IMAGE}" "${ROOT_DIR}"
    ;;
  if-missing)
    if [ "${has_image}" -eq 0 ]; then
      "${ENGINE}" build -f "${ROOT_DIR}/Dockerfile.deploy" -t "${IMAGE}" "${ROOT_DIR}"
    fi
    ;;
  never)
    if [ "${has_image}" -eq 0 ]; then
      echo "[deploy] image ${IMAGE} not found and DEPLOY_BUILD_POLICY=never." >&2
      exit 1
    fi
    ;;
  *)
    echo "[deploy] invalid DEPLOY_BUILD_POLICY=${BUILD_POLICY}. Use if-missing|always|never." >&2
    exit 1
    ;;
esac

TTY_ARGS=()
if [ -t 0 ] && [ -t 1 ]; then
  TTY_ARGS=(-it)
fi

run_args=(
  run --rm
  "${TTY_ARGS[@]}"
  -v "${ROOT_DIR}:/workspace"
  -v "${CONFIG_FILE}:${CONTAINER_CONFIG_PATH}:ro"
  -w /workspace
  -e "DEPLOY_CONFIG_FILE=${CONTAINER_CONFIG_PATH}"
  -e "DEPLOY_SKIP_UPDATE_CHECK=${DEPLOY_SKIP_UPDATE_CHECK:-}"
  -e "UPDATE_SOURCE_REMOTE=${UPDATE_SOURCE_REMOTE:-}"
)
if [ -n "${SSH_PRIVATE_KEY_CONTENT}" ]; then
  run_args+=(-e "SSH_PRIVATE_KEY=${SSH_PRIVATE_KEY_CONTENT}")
fi

exec "${ENGINE}" "${run_args[@]}" "${IMAGE}" /workspace/scripts/deploy-from-config.sh "$@"
