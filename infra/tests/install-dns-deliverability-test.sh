#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"
DNS_MAIN="${ROOT_DIR}/infra/dns/cloudflare/main.tf"

if ! grep -Fq 'resource "cloudflare_record" "helo_spf"' "${DNS_MAIN}"; then
  echo "expected cloudflare dns stack to manage HELO SPF TXT record" >&2
  exit 1
fi

if ! grep -Fq 'resource "cloudflare_record" "dkim"' "${DNS_MAIN}"; then
  echo "expected cloudflare dns stack to support DKIM TXT record" >&2
  exit 1
fi

if ! grep -Fq 'DKIM_SELECTOR=${DKIM_SELECTOR:-"mail"}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define default DKIM selector" >&2
  exit 1
fi

if ! grep -Fq 'DKIM_PUBLIC_KEY=${DKIM_PUBLIC_KEY:-""}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to allow optional DKIM public key override" >&2
  exit 1
fi

if ! grep -Fq 'extract_dkim_dns_parts() {' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define DKIM extraction helper" >&2
  exit 1
fi

if ! grep -Fq 'run_timed_step "terraform apply (${DNS_STACK_DIR}, dkim sync)"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to re-apply dns stack after DKIM extraction" >&2
  exit 1
fi

echo "install dns deliverability test: ok"
