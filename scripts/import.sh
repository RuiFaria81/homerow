#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  ./hrow import <source> [options]

Sources:
  takeout    Import Google Takeout archives

Examples:
  ./hrow import takeout --file ./takeout/my.tgz
  ./hrow import takeout --file ./takeout/my.tgz --upload-only
USAGE
}

SOURCE="${1:-}"
case "${SOURCE}" in
  takeout)
    shift
    exec "${ROOT_DIR}/import-takeout.sh" "$@"
    ;;
  ""|-h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "[import] unknown source: ${SOURCE}" >&2
    usage >&2
    exit 1
    ;;
esac
