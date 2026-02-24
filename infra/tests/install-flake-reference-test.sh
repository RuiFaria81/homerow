#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if ! grep -Fq 'log "Preparing filtered deploy source..."' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to prepare a filtered deploy source" >&2
  exit 1
fi

if ! grep -Fq -- "--exclude '/takeout'" "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to exclude only root takeout from deploy source copy" >&2
  exit 1
fi

if ! grep -Fq 'FLAKE_REF="path:${TEMP_FLAKE}#mailserver"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define FLAKE_REF from TEMP_FLAKE path" >&2
  exit 1
fi

flake_ref_uses="$(grep -Fc -- '--flake "$FLAKE_REF"' "${INSTALL_SCRIPT}")"
if [[ "${flake_ref_uses}" -ne 2 ]]; then
  echo "expected install.sh to use FLAKE_REF in both deployment paths, found ${flake_ref_uses}" >&2
  exit 1
fi

echo "install flake reference test: ok"
