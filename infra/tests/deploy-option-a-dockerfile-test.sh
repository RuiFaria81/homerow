#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKERFILE="${ROOT_DIR}/Dockerfile.deploy"

if ! grep -Fq "NIXPKGS_ALLOW_UNFREE=1 nix profile install --impure --priority 4" "${DOCKERFILE}"; then
  echo "expected Dockerfile.deploy to allow unfree terraform install with upgrade-safe profile priority" >&2
  exit 1
fi

if ! grep -Fq "nixpkgs#terraform" "${DOCKERFILE}"; then
  echo "expected Dockerfile.deploy to install terraform" >&2
  exit 1
fi

if ! grep -Fq "nixpkgs#rsync" "${DOCKERFILE}"; then
  echo "expected Dockerfile.deploy to install rsync required by install.sh" >&2
  exit 1
fi

echo "deploy option A dockerfile test: ok"
