#!/usr/bin/env bash
set -euo pipefail

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="${PWD}"
fi

usage() {
  cat <<'EOF'
Usage:
  ./hrow <command> [args...]

Commands:
  deploy           Run deploy from config
  install          Run install orchestrator
  destroy          Destroy infrastructure/resources
  ssh              SSH into the deployed VPS
  push-secrets     Push config values to GitHub secrets
  e2e              Run webmail end-to-end tests
  docker           Run a command inside deploy container
  help             Show this help
EOF
}

run_docker_command() {
  local subcmd="${1:-}"
  shift || true
  [ -n "${subcmd}" ] || { echo "[hrow] docker mode requires a subcommand." >&2; exit 1; }

  local target=""
  case "${subcmd}" in
    deploy) target="/workspace/scripts/deploy-from-config.sh" ;;
    install) target="/workspace/scripts/install.sh" ;;
    destroy) target="/workspace/scripts/destroy.sh" ;;
    ssh) target="/workspace/scripts/ssh-vps.sh" ;;
    push-secrets) target="/workspace/scripts/push-gh-secrets.sh" ;;
    e2e) target="/workspace/scripts/run-tests.sh" ;;
    *) echo "[hrow] unknown docker subcommand: ${subcmd}" >&2; exit 1 ;;
  esac

  local engine="${DEPLOY_ENGINE:-}"
  if [ -z "${engine}" ]; then
    if command -v docker >/dev/null 2>&1; then
      engine="docker"
    elif command -v podman >/dev/null 2>&1; then
      engine="podman"
    else
      echo "[hrow] docker or podman is required for docker mode." >&2
      exit 1
    fi
  fi

  local image="${DEPLOY_IMAGE:-homerow/deployer:latest}"
  local build_policy="${DEPLOY_BUILD_POLICY:-if-missing}"
  local config_file="${DEPLOY_CONFIG_FILE:-${REPO_ROOT}/config.env}"
  local container_config_path="/tmp/.deploy-config.env"
  [ -f "${config_file}" ] || { echo "[hrow] missing config file at ${config_file}" >&2; exit 1; }

  local has_image=0
  if "${engine}" image inspect "${image}" >/dev/null 2>&1; then
    has_image=1
  fi

  case "${build_policy}" in
    always)
      "${engine}" build -f "${REPO_ROOT}/Dockerfile.deploy" -t "${image}" "${REPO_ROOT}"
      ;;
    if-missing)
      if [ "${has_image}" -eq 0 ]; then
        "${engine}" build -f "${REPO_ROOT}/Dockerfile.deploy" -t "${image}" "${REPO_ROOT}"
      fi
      ;;
    never)
      if [ "${has_image}" -eq 0 ]; then
        echo "[hrow] image ${image} not found and DEPLOY_BUILD_POLICY=never." >&2
        exit 1
      fi
      ;;
    *)
      echo "[hrow] invalid DEPLOY_BUILD_POLICY=${build_policy}. Use if-missing|always|never." >&2
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
    -v "${REPO_ROOT}:/workspace"
    -v "${config_file}:${container_config_path}:ro"
    -w /workspace
    -e "DEPLOY_CONFIG_FILE=${container_config_path}"
    -e "DEPLOY_SKIP_UPDATE_CHECK=${DEPLOY_SKIP_UPDATE_CHECK:-}"
    -e "UPDATE_SOURCE_REMOTE=${UPDATE_SOURCE_REMOTE:-}"
  )
  if [ -n "${SSH_PRIVATE_KEY:-}" ]; then
    run_args+=(-e "SSH_PRIVATE_KEY=${SSH_PRIVATE_KEY}")
  fi

  exec "${engine}" "${run_args[@]}" "${image}" "${target}" "$@"
}

cmd="${1:-help}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "${cmd}" in
  deploy)
    exec "${REPO_ROOT}/scripts/deploy-from-config.sh" "$@"
    ;;
  install)
    exec "${REPO_ROOT}/scripts/install.sh" "$@"
    ;;
  destroy)
    exec "${REPO_ROOT}/scripts/destroy.sh" "$@"
    ;;
  ssh)
    exec "${REPO_ROOT}/scripts/ssh-vps.sh" "$@"
    ;;
  push-secrets)
    exec "${REPO_ROOT}/scripts/push-gh-secrets.sh" "$@"
    ;;
  e2e)
    exec "${REPO_ROOT}/scripts/run-tests.sh" "$@"
    ;;
  docker)
    run_docker_command "$@"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "[hrow] unknown command: ${cmd}" >&2
    usage >&2
    exit 1
    ;;
esac
