# Provider Reference

This file explains how infrastructure is split, which providers are supported now, and which secrets are required for each stack.

## Why The Infra Is Split

Deployment is split into three infrastructure components:

1. `VPS`
- Creates the server where NixOS and mail/webmail services run.
- Must output a public IPv4 address (`server_ip`).

2. `DNS`
- Creates DNS records so your domain points to the VPS.
- Receives `mail_server_ipv4` from the VPS stack.

3. `Storage`
- Creates object storage for encrypted restic backups.
- Must output backup repo URL (`s3_bucket_url`).

This separation keeps provider growth additive. You can add new VPS, DNS, or Storage stacks independently.

## Current Supported Stacks

- `VPS_STACK=hetzner` (`infra/vps/hetzner`)
- `DNS_STACK=cloudflare` (`infra/dns/cloudflare`)
- `STORAGE_STACK=hetzner-object-storage` (`infra/storage/hetzner-object-storage`)

## Required Secrets By Current Stack

`config.env` is provider-dependent. In practice, you keep the shared settings for your deployment and only add provider credentials for the stacks you selected.

### VPS (`hetzner`)

- `HCLOUD_TOKEN`

Optional tuning:
- `HETZNER_SERVER_TYPE` (default `cx23`)
- `HETZNER_LOCATION` (default `nbg1`)
- `HETZNER_REUSE_EXISTING_SERVER` (default `true`; set `false` to force creating a fresh server instead of auto-reusing `mail-server`)
- `SSH_PRIVATE_KEY_PATH` (preferred local input; path to your private key)
- `SSH_PRIVATE_KEY` (GitHub Actions secret content)
- `HETZNER_EXISTING_SSH_KEY_ID` (optional override; when set, deploy reuses this Hetzner SSH key instead of creating `admin_key`)
- `HETZNER_EXISTING_SERVER_ID` + `HETZNER_EXISTING_SERVER_IPV4` (optional override; when set, deploy reuses an existing `mail-server` instead of creating a new one)

### DNS (`cloudflare`)

- `CLOUDFLARE_TOKEN`
- `CLOUDFLARE_ZONE_ID`

### Storage (`hetzner-object-storage`)

- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

Optional tuning:
- `HETZNER_OBJECT_STORAGE_LOCATION` (default `nbg1`)
- `BACKUP_BUCKET_NAME` (optional override for backup bucket name; defaults to deterministic `mail-backup-<domain>`)
- `TF_STATE_BUCKET_NAME` (optional override for Terraform state bucket; defaults to deterministic `mail-tfstate-<domain>`)
- `TF_STATE_PREFIX` (optional override for Terraform state key prefix; defaults to `<domain>`)

## Common Secrets (Not Provider-Specific)

- `DOMAIN`
- `EMAIL` (optional, defaults to `admin@<domain>`)
- `MAIL_PASSWORD`
- `RESTIC_PASSWORD`
- `ACME_ENV` (`production` or `staging`)
- `WEBMAIL_SUBDOMAIN` (optional, default `webmail`; must not be `mail`)

## `config.env` Guidance

A good pattern is to keep `config.env` organized in three short sections: common deployment values, stack selectors (`VPS_STACK`, `DNS_STACK`, `STORAGE_STACK`), and provider-specific credentials for those selected stacks. If you switch to a future provider stack, expect the provider-specific part to change.

## How Deploy Uses These Components

Deploy orchestration order:

1. Set up remote Terraform state bucket
2. Apply VPS stack -> read `server_ip`
3. Apply DNS stack -> pass `mail_server_ipv4=server_ip`
4. Apply Storage stack -> read `s3_bucket_url`
5. Deploy/update NixOS host and configure backups/secrets on the server

## Adding New Providers (Future)

Provider pull requests are welcome. If you want to add support for a new VPS, DNS, or storage provider, open a PR.

When a new provider is added in one category, it may require a different set of secrets and optional variables.

If you add a stack:

1. Create stack under `infra/vps/<name>`, `infra/dns/<name>`, or `infra/storage/<name>`.
2. Add stack handling in `scripts/install.sh`:
- selection `case` block
- variable prompts/validation
- `terraform.tfvars` generation
3. Extend `infra/tests/provider-selection-test.sh` with positive and negative plan checks.
4. Update this document with:
- stack name
- required secrets
- optional variables

For deeper implementation details, see [`infra/README.md`](README.md).
