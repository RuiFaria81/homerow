#!/usr/bin/env bash
set -euo pipefail

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="${PWD}"
fi

usage() {
  local dev_mode
  dev_mode="$(resolve_dev_mode)"
  cat <<'EOF'
Usage:
  ./hrow <command> [args...]

Commands:
  deploy           Unified deploy entrypoint
  destroy          Destroy infrastructure/resources
  backup           Backup operations (list/restore from snapshots)
  import           Data import operations (e.g. takeout)
  ssh              SSH into the deployed VPS
  help             Show this help
EOF
  if [[ "${dev_mode}" == "true" ]]; then
    cat <<'EOF'
  e2e              Run webmail end-to-end tests
EOF
  fi
}

resolve_default_local_or_docker_mode() {
  local config_file="${DEPLOY_CONFIG_FILE:-${REPO_ROOT}/config.env}"
  local use_docker="${USE_DOCKER:-}"

  if [ -z "${use_docker}" ] && [ -f "${config_file}" ]; then
    use_docker="$(set -a; source "${config_file}"; set +a; printf '%s' "${USE_DOCKER:-}")"
  fi

  local normalized
  normalized="$(printf '%s' "${use_docker}" | tr '[:upper:]' '[:lower:]')"
  case "${normalized}" in
    ""|0|false|no|off)
      printf 'local'
      ;;
    1|true|yes|on)
      printf 'docker'
      ;;
    *)
      echo "[hrow] invalid USE_DOCKER=${use_docker}. Use true/false (or 1/0, yes/no, on/off)." >&2
      exit 1
      ;;
  esac
}

resolve_dev_mode() {
  local config_file="${DEPLOY_CONFIG_FILE:-${REPO_ROOT}/config.env}"
  local dev_mode="${DEV_MODE:-}"

  if [ -z "${dev_mode}" ] && [ -f "${config_file}" ]; then
    dev_mode="$(set -a; source "${config_file}"; set +a; printf '%s' "${DEV_MODE:-}")"
  fi

  local normalized
  normalized="$(printf '%s' "${dev_mode}" | tr '[:upper:]' '[:lower:]')"
  case "${normalized}" in
    ""|0|false|no|off)
      printf 'false'
      ;;
    1|true|yes|on)
      printf 'true'
      ;;
    *)
      echo "[hrow] invalid DEV_MODE=${dev_mode}. Use true/false (or 1/0, yes/no, on/off)." >&2
      exit 1
      ;;
  esac
}

deploy_usage() {
  cat <<'EOF'
Usage:
  ./hrow deploy [--via local|docker|github] [args...]
  ./hrow deploy [local|docker|github] [args...]

Modes:
  local   Run scripts/install.sh in strict config mode (default)
  docker  Run deploy in container
  github  Push GitHub fork secrets / optional workflow trigger

Default mode:
  USE_DOCKER=true in environment or config.env changes local/docker default to docker.
EOF
}

run_command_with_mode() {
  local command_name="$1"
  local local_target="$2"
  local docker_subcmd="$3"
  shift 3

  local via
  via="$(resolve_default_local_or_docker_mode)"

  if [ "$#" -gt 0 ]; then
    case "${1}" in
      local|docker)
        via="${1}"
        shift
        ;;
    esac
  fi

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --via)
        [ "$#" -ge 2 ] || { echo "[hrow] ${command_name} --via requires a value: local|docker" >&2; exit 1; }
        via="$2"
        shift 2
        ;;
      --via=*)
        via="${1#--via=}"
        shift
        ;;
      --local)
        via="local"
        shift
        ;;
      --docker)
        via="docker"
        shift
        ;;
      *)
        break
        ;;
    esac
  done

  case "${via}" in
    local)
      exec "${local_target}" "$@"
      ;;
    docker)
      run_docker_command "${docker_subcmd}" "$@"
      ;;
    *)
      echo "[hrow] invalid ${command_name} mode: ${via}. Use local|docker." >&2
      exit 1
      ;;
  esac
}

run_unified_deploy() {
  local via
  via="$(resolve_default_local_or_docker_mode)"

  if [ "$#" -gt 0 ]; then
    case "${1}" in
      -h|--help)
        deploy_usage
        exit 0
        ;;
    esac
  fi

  # Unified deploy routing:
  # - ./hrow deploy                    -> local strict install.sh
  # - ./hrow deploy --via docker       -> dockerized deploy
  # - ./hrow deploy --via github       -> fork-deploy.sh
  # - ./hrow deploy docker|local|github  -> positional shorthand
  if [ "$#" -gt 0 ]; then
    case "${1}" in
      local|docker|github|fork)
        via="${1}"
        if [[ "${via}" == "fork" ]]; then
          via="github"
        fi
        shift
        ;;
    esac
  fi

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --via)
        [ "$#" -ge 2 ] || { echo "[hrow] deploy --via requires a value: local|docker|github" >&2; exit 1; }
        via="$2"
        if [[ "${via}" == "fork" ]]; then
          via="github"
        fi
        shift 2
        ;;
      --via=*)
        via="${1#--via=}"
        if [[ "${via}" == "fork" ]]; then
          via="github"
        fi
        shift
        ;;
      --local)
        via="local"
        shift
        ;;
      --docker)
        via="docker"
        shift
        ;;
      --github|--fork)
        via="github"
        shift
        ;;
      *)
        break
        ;;
    esac
  done

  case "${via}" in
    local)
      local config_file="${DEPLOY_CONFIG_FILE:-${REPO_ROOT}/config.env}"
      exec env INSTALL_STRICT_CONFIG=1 INSTALL_CONFIG_FILE="${config_file}" DEPLOY_SKIP_UPDATE_CHECK="${DEPLOY_SKIP_UPDATE_CHECK:-}" "${REPO_ROOT}/scripts/install.sh" "$@"
      ;;
    docker)
      run_docker_command deploy "$@"
      ;;
    github)
      exec "${REPO_ROOT}/scripts/fork-deploy.sh" "$@"
      ;;
    *)
      echo "[hrow] invalid deploy mode: ${via}. Use local|docker|github." >&2
      exit 1
      ;;
  esac
}

resolve_ssh_private_key_content() {
  local config_file="$1"
  local key_content="${SSH_PRIVATE_KEY:-}"
  if [ -n "${key_content}" ]; then
    printf '%s' "${key_content}"
    return 0
  fi

  local key_path="${SSH_PRIVATE_KEY_PATH:-}"
  if [ -z "${key_path}" ] && [ -f "${config_file}" ]; then
    # Read key path from config.env when running in docker mode.
    key_path="$(set -a; source "${config_file}"; set +a; printf '%s' "${SSH_PRIVATE_KEY_PATH:-}")"
  fi

  if [ -z "${key_path}" ]; then
    return 0
  fi
  if [[ "${key_path}" != /* ]]; then
    key_path="${REPO_ROOT}/${key_path}"
  fi
  [ -f "${key_path}" ] || { echo "[hrow] SSH private key not found: ${key_path}" >&2; exit 1; }

  cat "${key_path}"
}

run_docker_command() {
  local subcmd="${1:-}"
  shift || true
  [ -n "${subcmd}" ] || { echo "[hrow] docker mode requires a subcommand." >&2; exit 1; }

  local target=""
  case "${subcmd}" in
    deploy) target="/workspace/scripts/install.sh" ;;
    destroy) target="/workspace/scripts/destroy.sh" ;;
    backup) target="/workspace/scripts/backup.sh" ;;
    import) target="/workspace/scripts/import.sh" ;;
    ssh) target="/workspace/scripts/ssh-vps.sh" ;;
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
  local ssh_private_key_content
  ssh_private_key_content="$(resolve_ssh_private_key_content "${config_file}")"

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
  if [ "${subcmd}" = "deploy" ]; then
    run_args+=(-e "INSTALL_STRICT_CONFIG=1")
  fi
  if [ -n "${ssh_private_key_content}" ]; then
    run_args+=(-e "SSH_PRIVATE_KEY=${ssh_private_key_content}")
  fi

  exec "${engine}" "${run_args[@]}" "${image}" "${target}" "$@"
}

cmd="${1:-help}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "${cmd}" in
  deploy)
    run_unified_deploy "$@"
    ;;
  destroy)
    run_command_with_mode "destroy" "${REPO_ROOT}/scripts/destroy.sh" "destroy" "$@"
    ;;
  backup)
    run_command_with_mode "backup" "${REPO_ROOT}/scripts/backup.sh" "backup" "$@"
    ;;
  import)
    run_command_with_mode "import" "${REPO_ROOT}/scripts/import.sh" "import" "$@"
    ;;
  ssh)
    run_command_with_mode "ssh" "${REPO_ROOT}/scripts/ssh-vps.sh" "ssh" "$@"
    ;;
  e2e)
    if [[ "$(resolve_dev_mode)" != "true" ]]; then
      echo "[hrow] command 'e2e' is available only when DEV_MODE=true." >&2
      exit 1
    fi
    run_command_with_mode "e2e" "${REPO_ROOT}/scripts/run-tests.sh" "e2e" "$@"
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
