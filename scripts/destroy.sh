#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
is_ipv4() {
    local value="$1"
    [[ "$value" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}
sanitize_bucket_name() {
    local raw="$1"
    local cleaned
    cleaned="$(echo "$raw" \
        | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
    if [ ${#cleaned} -lt 3 ]; then
        cleaned="mail-backup-${cleaned}"
    fi
    echo "${cleaned:0:63}"
}
normalize_state_prefix() {
    local raw="$1"
    local normalized
    normalized="$(echo "$raw" | sed -E 's#^/+##; s#/+$##; s#//+#/#g')"
    echo "$normalized"
}
write_s3_backend_config() {
    local backend_file="$1"
    local bucket_name="$2"
    local key_path="$3"
    local location="$4"
    local endpoint="https://${location}.your-objectstorage.com"

    cat > "$backend_file" <<EOF
bucket = "${bucket_name}"
key = "${key_path}"
region = "${location}"
access_key = "${S3_ACCESS_KEY}"
secret_key = "${S3_SECRET_KEY}"
endpoints = { s3 = "${endpoint}" }
skip_credentials_validation = true
skip_requesting_account_id = true
skip_region_validation = true
EOF
}

ASSUME_YES="false"
DELETE_STORAGE="false"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes)
            ASSUME_YES="true"
            shift
            ;;
        --delete-storage)
            DELETE_STORAGE="true"
            shift
            ;;
        -h|--help)
            cat <<'USAGE'
Usage: ./hrow destroy [--yes] [--delete-storage]

Options:
  --yes             Skip confirmation prompt
  --delete-storage  WARNING: Permanent data loss. Also delete backup data and the Terraform state bucket.
  -h, --help        Show this help
USAGE
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

echo -e "${RED}!!! WARNING !!!${NC}"
echo "This will DELETE the mail server, all emails, DNS records, and local keys."
if [[ "${DELETE_STORAGE}" == "true" ]]; then
    echo "WARNING: Permanent data loss. Also delete backup data and the Terraform state bucket."
else
    echo "Backup data and the Terraform state bucket will be preserved (pass --delete-storage to remove them)."
fi
if [[ "${ASSUME_YES}" != "true" ]]; then
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" != "y" ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# 1. Load Config
if [ -f "config.env" ]; then source config.env; fi

VPS_STACK=${VPS_STACK:-"hetzner"}
DNS_STACK=${DNS_STACK:-"cloudflare"}
STORAGE_STACK=${STORAGE_STACK:-"hetzner-object-storage"}
TF_STATE_STACK=${TF_STATE_STACK:-"hetzner-object-storage"}
DOMAIN=${DOMAIN:-""}
HCLOUD_TOKEN=${HCLOUD_TOKEN:-""}
CLOUDFLARE_TOKEN=${CLOUDFLARE_TOKEN:-""}
CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID:-""}
WEBMAIL_SUBDOMAIN=${WEBMAIL_SUBDOMAIN:-"webmail"}
HETZNER_SERVER_TYPE=${HETZNER_SERVER_TYPE:-"cx23"}
HETZNER_LOCATION=${HETZNER_LOCATION:-"nbg1"}
HETZNER_OBJECT_STORAGE_LOCATION=${HETZNER_OBJECT_STORAGE_LOCATION:-"nbg1"}

VPS_STACK_DIR="infra/vps/${VPS_STACK}"
DNS_STACK_DIR="infra/dns/${DNS_STACK}"
STORAGE_STACK_DIR="infra/storage/${STORAGE_STACK}"
TF_STATE_STACK_DIR="infra/terraform-state/${TF_STATE_STACK}"

SERVER_IP=""
if [ -f "${VPS_STACK_DIR}/terraform.tfstate" ]; then
    SERVER_IP=$(terraform -chdir="${VPS_STACK_DIR}" output -raw server_ip 2>/dev/null || true)
elif [ -f "infra/terraform.tfstate" ]; then
    SERVER_IP=$(grep '"ipv4_address":' infra/terraform.tfstate | cut -d '"' -f 4 | head -1 || true)
fi
if ! is_ipv4 "$SERVER_IP"; then
    SERVER_IP=""
fi

DNS_MAIL_SERVER_IPV4="$SERVER_IP"
if [ -z "$DNS_MAIL_SERVER_IPV4" ] && [ -f "${DNS_STACK_DIR}/terraform.tfvars" ]; then
    DNS_MAIL_SERVER_IPV4=$(sed -n 's/^[[:space:]]*mail_server_ipv4[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' "${DNS_STACK_DIR}/terraform.tfvars" | head -n1)
fi
if ! is_ipv4 "$DNS_MAIL_SERVER_IPV4"; then
    DNS_MAIL_SERVER_IPV4=""
fi
if [ -z "$DNS_MAIL_SERVER_IPV4" ]; then
    DNS_MAIL_SERVER_IPV4="127.0.0.1"
fi

TF_STATE_BUCKET_NAME=${TF_STATE_BUCKET_NAME:-"mail-tfstate-${DOMAIN//./-}"}
TF_STATE_BUCKET_NAME="$(sanitize_bucket_name "$TF_STATE_BUCKET_NAME")"
TF_STATE_PREFIX=${TF_STATE_PREFIX:-"${DOMAIN}"}
TF_STATE_PREFIX="$(normalize_state_prefix "$TF_STATE_PREFIX")"
BACKUP_BUCKET_NAME=${BACKUP_BUCKET_NAME:-"mail-backup-${DOMAIN//./-}"}
BACKUP_BUCKET_NAME="$(sanitize_bucket_name "$BACKUP_BUCKET_NAME")"

TEMP_DESTROY_SSH_PUBLIC_KEY="$(mktemp)"
cat > "${TEMP_DESTROY_SSH_PUBLIC_KEY}" <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA destroy@local
EOF

TEMP_TF_BACKEND_VPS=""
TEMP_TF_BACKEND_DNS=""
TEMP_TF_BACKEND_STORAGE=""
if [ -n "${TF_STATE_BUCKET_NAME}" ] && [ -n "${TF_STATE_PREFIX}" ] && [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ]; then
    TEMP_TF_BACKEND_VPS="$(mktemp)"
    TEMP_TF_BACKEND_DNS="$(mktemp)"
    TEMP_TF_BACKEND_STORAGE="$(mktemp)"
    write_s3_backend_config "$TEMP_TF_BACKEND_VPS" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/vps-${VPS_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"
    write_s3_backend_config "$TEMP_TF_BACKEND_DNS" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/dns-${DNS_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"
    write_s3_backend_config "$TEMP_TF_BACKEND_STORAGE" "${TF_STATE_BUCKET_NAME}" "${TF_STATE_PREFIX}/storage-${STORAGE_STACK}.tfstate" "${HETZNER_OBJECT_STORAGE_LOCATION}"
fi

destroy_stack() {
    local dir="$1"
    local label="$2"
    local backend_config="${3:-}"
    local tf_vars=("${@:4}")

    if [ -n "${backend_config}" ] && [ -f "${backend_config}" ]; then
        terraform -chdir="${dir}" init -input=false -backend-config="${backend_config}" >/dev/null
    elif [ -f "${dir}/terraform.tfstate" ]; then
        terraform -chdir="${dir}" init -input=false -backend=false >/dev/null
    else
        terraform -chdir="${dir}" init -input=false >/dev/null
    fi

    if terraform -chdir="${dir}" state pull >/dev/null 2>&1 || [ -f "${dir}/terraform.tfstate" ]; then
        echo -e "${GREEN}${label}${NC}"
        terraform -chdir="${dir}" destroy -input=false -auto-approve "${tf_vars[@]}"
    else
        log "No state found for ${dir}, skipping."
    fi
}

destroy_tf_state_stack() {
    local dir="$1"
    local label="$2"
    local resource_addr="minio_s3_bucket.terraform_state"

    terraform -chdir="${dir}" init -input=false -backend=false >/dev/null

    if ! terraform -chdir="${dir}" state show "${resource_addr}" >/dev/null 2>&1; then
        terraform -chdir="${dir}" import -input=false "${resource_addr}" "${TF_STATE_BUCKET_NAME}" >/dev/null 2>&1 || true
    fi

    if terraform -chdir="${dir}" state show "${resource_addr}" >/dev/null 2>&1; then
        echo -e "${GREEN}${label}${NC}"
        terraform -chdir="${dir}" destroy -input=false -auto-approve \
            -var="location=${HETZNER_OBJECT_STORAGE_LOCATION}" \
            -var="s3_access_key=${S3_ACCESS_KEY:-}" \
            -var="s3_secret_key=${S3_SECRET_KEY:-}" \
            -var="bucket_name=${TF_STATE_BUCKET_NAME}"
    else
        log "No Terraform state bucket found for ${dir}, skipping."
    fi
}

# 2. Terraform Destroy
if [[ "${DELETE_STORAGE}" == "true" ]]; then
    destroy_stack "${STORAGE_STACK_DIR}" "[1/4] Destroying storage stack..." "${TEMP_TF_BACKEND_STORAGE}" \
        -var="location=${HETZNER_OBJECT_STORAGE_LOCATION}" \
        -var="s3_access_key=${S3_ACCESS_KEY:-}" \
        -var="s3_secret_key=${S3_SECRET_KEY:-}" \
        -var="bucket_name=${BACKUP_BUCKET_NAME}"
    destroy_tf_state_stack "${TF_STATE_STACK_DIR}" "[2/4] Destroying Terraform state bucket stack..."
else
    log "Skipping storage stack destroy (use --delete-storage to include backup data and the Terraform state bucket)."
fi
destroy_stack "${DNS_STACK_DIR}" "[3/4] Destroying DNS stack..." "${TEMP_TF_BACKEND_DNS}" \
    -var="domain=${DOMAIN}" \
    -var="cloudflare_token=${CLOUDFLARE_TOKEN}" \
    -var="cloudflare_zone_id=${CLOUDFLARE_ZONE_ID}" \
    -var="mail_server_ipv4=${DNS_MAIL_SERVER_IPV4}" \
    -var="webmail_subdomain=${WEBMAIL_SUBDOMAIN}"
destroy_stack "${VPS_STACK_DIR}" "[4/4] Destroying VPS stack..." "${TEMP_TF_BACKEND_VPS}" \
    -var="domain=${DOMAIN}" \
    -var="hcloud_token=${HCLOUD_TOKEN}" \
    -var="server_type=${HETZNER_SERVER_TYPE}" \
    -var="location=${HETZNER_LOCATION}" \
    -var="ssh_public_key_path=${TEMP_DESTROY_SSH_PUBLIC_KEY}"

# 3. Clean SSH Known Hosts
if [ ! -z "$SERVER_IP" ]; then
    echo -e "${GREEN}[4/4] Removing $SERVER_IP from known_hosts...${NC}"
    ssh-keygen -R "$SERVER_IP" >/dev/null 2>&1 || true
fi

# 4. Remove Local Files
echo -e "${GREEN}Removing local terraform/state files and keys...${NC}"
rm -rf infra/.terraform infra/.terraform.lock.hcl infra/terraform.tfstate* infra/terraform.tfvars
rm -rf infra/vps/*/.terraform infra/vps/*/.terraform.lock.hcl infra/vps/*/terraform.tfstate* infra/vps/*/terraform.tfvars
rm -rf infra/dns/*/.terraform infra/dns/*/.terraform.lock.hcl infra/dns/*/terraform.tfstate* infra/dns/*/terraform.tfvars
rm -rf infra/storage/*/.terraform infra/storage/*/.terraform.lock.hcl infra/storage/*/terraform.tfstate* infra/storage/*/terraform.tfvars
rm -f infra/id_ed25519 infra/id_ed25519.pub modules/settings.nix
rm -f "${TEMP_TF_BACKEND_VPS:-}" "${TEMP_TF_BACKEND_DNS:-}" "${TEMP_TF_BACKEND_STORAGE:-}"
rm -f "${TEMP_DESTROY_SSH_PUBLIC_KEY:-}"

echo -e "${GREEN}Cleanup Complete.${NC}"
