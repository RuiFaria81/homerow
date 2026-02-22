#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SCRIPT="${ROOT_DIR}/scripts/install.sh"

if ! grep -Fq 'TF_STATE_STACK_DIR="infra/terraform-state/${TF_STATE_STACK}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define terraform-state stack directory" >&2
  exit 1
fi

if ! grep -Fq 'HETZNER_REUSE_EXISTING_SERVER=${HETZNER_REUSE_EXISTING_SERVER:-"true"}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define Hetzner server reuse toggle" >&2
  exit 1
fi

if ! grep -Fq 'DEPLOY_SSH_PRIVATE_KEY_PATH=${DEPLOY_SSH_PRIVATE_KEY_PATH:-""}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define deploy ssh private key path input without implicit default" >&2
  exit 1
fi

if ! grep -Fq 'SSH_PRIVATE_KEY=${SSH_PRIVATE_KEY:-""}' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to define SSH_PRIVATE_KEY env input" >&2
  exit 1
fi

if ! grep -Fq 'if [ -n "${SSH_PRIVATE_KEY}" ]; then' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to prioritize SSH_PRIVATE_KEY when provided" >&2
  exit 1
fi

if ! grep -Fq 'SSH key not provided. Set SSH_PRIVATE_KEY (preferred) or DEPLOY_SSH_PRIVATE_KEY_PATH to an existing key.' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to require an explicit ssh key and prefer SSH_PRIVATE_KEY" >&2
  exit 1
fi

if ! grep -Fq 'DEPLOY_SSH_PRIVATE_KEY_PATH is set but empty. Set it to an existing private key path.' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to validate an empty DEPLOY_SSH_PRIVATE_KEY_PATH input" >&2
  exit 1
fi

if grep -Fq 'log "Generating SSH key..."' "${INSTALL_SCRIPT}"; then
  echo "did not expect install.sh to auto-generate ssh keys" >&2
  exit 1
fi

if ! grep -Fq 'WORKSPACE_SSH_PUBLIC_KEY_PATH="$(pwd)/infra/id_ed25519.pub"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to materialize workspace ssh public key path when SSH_PRIVATE_KEY is provided" >&2
  exit 1
fi

if ! grep -Fq 'cp "${TEMP_DEPLOY_SSH_PUBLIC_KEY}" "${WORKSPACE_SSH_PUBLIC_KEY_PATH}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to write workspace ssh public key for Nix evaluation" >&2
  exit 1
fi

if ! grep -Fq 'ssh_public_key_path = "${DEPLOY_SSH_PUBLIC_KEY_PATH}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to pass configured ssh public key path to terraform vars" >&2
  exit 1
fi

if ! grep -Fq 'terraform -chdir="$TF_STATE_STACK_DIR" init -backend=false' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to set up terraform state with local backend init" >&2
  exit 1
fi

if ! grep -Fq 'terraform_import_if_exists "$TF_STATE_STACK_DIR" "minio_s3_bucket.terraform_state" "${TF_STATE_BUCKET_NAME}"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to import existing state bucket during terraform-state setup" >&2
  exit 1
fi

if ! grep -Fq 'terraform -chdir="$tf_state_dir" plan -input=false -no-color -target=minio_s3_bucket.terraform_state -detailed-exitcode' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to verify terraform-state bucket drift after apply" >&2
  exit 1
fi

if ! grep -Fq 'terraform -chdir="$tf_state_dir" apply -auto-approve -target=minio_s3_bucket.terraform_state' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to reconcile terraform-state bucket when drift is detected" >&2
  exit 1
fi

if ! grep -Fq 'terraform -chdir="$VPS_STACK_DIR" init -input=false -migrate-state -force-copy -backend-config="$TEMP_TF_BACKEND_VPS"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to initialize vps stack with remote backend config" >&2
  exit 1
fi

if ! grep -Fq 'terraform -chdir="$DNS_STACK_DIR" init -input=false -migrate-state -force-copy -backend-config="$TEMP_TF_BACKEND_DNS"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to initialize dns stack with remote backend config" >&2
  exit 1
fi

if ! grep -Fq 'terraform -chdir="$STORAGE_STACK_DIR" init -input=false -migrate-state -force-copy -backend-config="$TEMP_TF_BACKEND_STORAGE"' "${INSTALL_SCRIPT}"; then
  echo "expected install.sh to initialize storage stack with remote backend config" >&2
  exit 1
fi

echo "install terraform state setup test: ok"
