#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if ! grep -Fq 'TERRAFORM_IMPORT_TIMEOUT_SECONDS' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define terraform import timeout" >&2
  exit 1
fi

if ! grep -Fq 'Importing existing resource: ${resource_addr} (${import_id})' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to log terraform import start" >&2
  exit 1
fi

if ! grep -Fq 'Import failed or timed out (${import_timeout}s): ${resource_addr}. Continuing...' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to log terraform import timeout/failure" >&2
  exit 1
fi

if ! grep -Fq 'timeout "${import_timeout}" terraform -chdir="$dir" import -no-color -input=false' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to enforce timeout for terraform import" >&2
  exit 1
fi

echo "install terraform import timeout test: ok"
