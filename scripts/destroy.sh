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

echo -e "${RED}!!! WARNING !!!${NC}"
echo "This will DELETE the mail server, all emails, DNS records, and local keys."
read -p "Are you sure? (y/N): " confirm
if [[ "$confirm" != "y" ]]; then
    echo "Aborted."
    exit 1
fi

# 1. Load Config
if [ -f "config.env" ]; then source config.env; fi

VPS_STACK=${VPS_STACK:-"hetzner"}
DNS_STACK=${DNS_STACK:-"cloudflare"}
STORAGE_STACK=${STORAGE_STACK:-"hetzner-object-storage"}

VPS_STACK_DIR="infra/vps/${VPS_STACK}"
DNS_STACK_DIR="infra/dns/${DNS_STACK}"
STORAGE_STACK_DIR="infra/storage/${STORAGE_STACK}"

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

destroy_stack() {
    local dir="$1"
    local label="$2"
    local extra_args=("${@:3}")

    if [ -f "${dir}/terraform.tfstate" ]; then
        echo -e "${GREEN}${label}${NC}"
        terraform -chdir="${dir}" init >/dev/null
        terraform -chdir="${dir}" destroy -auto-approve "${extra_args[@]}"
    else
        log "No state found for ${dir}, skipping."
    fi
}

# 2. Terraform Destroy
destroy_stack "${STORAGE_STACK_DIR}" "[1/4] Destroying storage stack..."
destroy_stack "${DNS_STACK_DIR}" "[2/4] Destroying DNS stack..." -var="mail_server_ipv4=${DNS_MAIL_SERVER_IPV4}"
destroy_stack "${VPS_STACK_DIR}" "[3/4] Destroying VPS stack..."

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

echo -e "${GREEN}Cleanup Complete.${NC}"
