#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if ! grep -Fq 'terraform_module_has_variable() {' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define terraform module variable capability check helper" >&2
  exit 1
fi

if ! grep -Fq 'upsert_tfvar_string() {' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define tfvars upsert helper for provider-agnostic dns vars" >&2
  exit 1
fi

if ! grep -Fq 'DNS_STACK_SUPPORTS_DKIM=false' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define DKIM capability flag for dns stacks" >&2
  exit 1
fi

if ! grep -Fq 'if terraform_module_has_variable "$DNS_STACK_DIR" "dkim_selector" && terraform_module_has_variable "$DNS_STACK_DIR" "dkim_public_key"; then' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to infer DKIM support from dns stack variable declarations" >&2
  exit 1
fi

if ! grep -Fq 'if [ "$DNS_STACK_SUPPORTS_DKIM" = "true" ] && [ -z "${DKIM_PUBLIC_KEY}" ]; then' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to run DKIM sync path for any supporting dns stack" >&2
  exit 1
fi

echo "install dns agnostic dkim test: ok"
