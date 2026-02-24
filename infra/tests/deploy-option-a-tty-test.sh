#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="${ROOT_DIR}/scripts/deploy.sh"

if ! grep -Fq 'if [ -t 0 ] && [ -t 1 ]; then' "${DEPLOY_SCRIPT}"; then
  echo "expected deploy.sh to detect TTY availability before passing -it" >&2
  exit 1
fi

if ! grep -Fq 'exec "${ENGINE}" "${run_args[@]}"' "${DEPLOY_SCRIPT}"; then
  echo "expected deploy.sh to pass composed run args (including optional TTY) to container run" >&2
  exit 1
fi

if ! grep -Fq 'CONTAINER_CONFIG_PATH="/tmp/.deploy-config.env"' "${DEPLOY_SCRIPT}"; then
  echo "expected deploy.sh to mount config file outside /workspace bind mount" >&2
  exit 1
fi

echo "deploy option A tty test: ok"
