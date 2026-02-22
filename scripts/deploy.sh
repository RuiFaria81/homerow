#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "${ROOT_DIR}/flake.nix" ] || [ ! -f "${ROOT_DIR}/scripts/install.sh" ]; then
  echo "[deploy] run from the homerow repository root." >&2
  exit 1
fi

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

exec "${ENGINE}" run --rm "${TTY_ARGS[@]}" \
  -v "${ROOT_DIR}:/workspace" \
  -v "${CONFIG_FILE}:${CONTAINER_CONFIG_PATH}:ro" \
  -w /workspace \
  -e DEPLOY_CONFIG_FILE="${CONTAINER_CONFIG_PATH}" \
  -e DEPLOY_SKIP_UPDATE_CHECK="${DEPLOY_SKIP_UPDATE_CHECK:-}" \
  -e UPDATE_SOURCE_REMOTE="${UPDATE_SOURCE_REMOTE:-}" \
  "${IMAGE}" \
  /workspace/scripts/deploy-from-config.sh "$@"
