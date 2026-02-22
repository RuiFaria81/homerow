#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

update_hash() {
  local lockfile="$1"
  local module_file="$2"

  if [[ ! -f "$ROOT_DIR/$lockfile" ]]; then
    echo "Skipping $lockfile (not found)"
    return
  fi
  if [[ ! -f "$ROOT_DIR/$module_file" ]]; then
    echo "Skipping $module_file (not found)"
    return
  fi

  echo "Refreshing npmDepsHash for $module_file from $lockfile..."
  local new_hash
  new_hash="$(nix run nixpkgs#prefetch-npm-deps -- "$ROOT_DIR/$lockfile" | tr -d '[:space:]')"

  local current_hash
  current_hash="$(sed -n 's/^[[:space:]]*npmDepsHash = "\(sha256-[^"]*\)";/\1/p' "$ROOT_DIR/$module_file" | head -n 1 | tr -d '[:space:]')"

  if [[ -z "$current_hash" ]]; then
    echo "Could not find npmDepsHash in $module_file"
    exit 1
  fi

  if [[ "$current_hash" == "$new_hash" ]]; then
    echo "  unchanged: $new_hash"
    return
  fi

  perl -0pi -e 's#npmDepsHash = "sha256-[^"]+";#npmDepsHash = "'"$new_hash"'";#' "$ROOT_DIR/$module_file"
  echo "  updated: $current_hash -> $new_hash"
}

update_hash "webmail/package-lock.json" "modules/webmail.nix"
update_hash "sync-engine/package-lock.json" "modules/sync-engine.nix"

echo "npmDepsHash refresh complete."
