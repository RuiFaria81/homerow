#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if ! grep -Fq 'Cloudflare lookup: type=${type} name=${name}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to log Cloudflare lookup start" >&2
  exit 1
fi

if ! grep -Fq -- '--connect-timeout "${cf_connect_timeout}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to set Cloudflare API connect timeout" >&2
  exit 1
fi

if ! grep -Fq -- '--max-time "${cf_max_time}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to set Cloudflare API max time" >&2
  exit 1
fi

if ! grep -Fq 'Cloudflare API request failed for ${type} ${name}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to log Cloudflare request failures" >&2
  exit 1
fi

if ! grep -Fq 'Cloudflare lookup timed out/failed for ${type} ${name}; continuing without import hint.' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to log Cloudflare timeout fallback" >&2
  exit 1
fi

echo "install cloudflare logging timeout test: ok"
