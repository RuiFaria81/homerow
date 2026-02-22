# Infra Stacks

Terraform is split by service category so each stack only initializes the providers it needs:

- `vps/<stack>`
- `dns/<stack>`
- `storage/<stack>`
- `terraform-state/<stack>` (Terraform remote state setup)

Current stacks:

- VPS: `hetzner` (`infra/vps/hetzner`)
- DNS: `cloudflare` (`infra/dns/cloudflare`)
- Storage: `hetzner-object-storage` (`infra/storage/hetzner-object-storage`)
- Terraform state: `hetzner-object-storage` (`infra/terraform-state/hetzner-object-storage`)

For provider-specific secrets/variables, see [`infra/PROVIDERS.md`](PROVIDERS.md).

`scripts/install.sh` orchestrates in this order:

1. Set up remote state bucket
2. Apply VPS stack and read `server_ip`
3. Apply DNS stack with `mail_server_ipv4=server_ip`
4. Apply storage stack and read `s3_bucket_url`

## Declarative deploy entry point

You can run deploy through the flake app:

```bash
nix run .#deploy
```

This entry point loads `config.env`, validates required variables, and then
executes the current deploy orchestrator. This keeps deploy invocation
declarative at the interface layer while preserving current behavior.

## Selecting stacks

Set these environment variables in `config.env` (or shell):

- `VPS_STACK`
- `DNS_STACK`
- `STORAGE_STACK`

If unset, defaults are:

- `VPS_STACK=hetzner`
- `DNS_STACK=cloudflare`
- `STORAGE_STACK=hetzner-object-storage`

## Adding a new provider

To add a new provider in one category:

1. Create a new stack root under the category folder (for example `infra/vps/digitalocean/main.tf`).
2. Implement resources directly in that stack root.
3. Extend `scripts/install.sh`:
   - stack selector validation `case` block
   - variable prompts
   - per-stack `terraform.tfvars` generation
4. Extend `infra/tests/provider-selection-test.sh` with plan checks for the new stack.

This keeps growth additive (`new vps` + `new dns` + `new storage`) instead of combinatorial.

## Migration plan from `scripts/install.sh` to Nix-first deploy

1. Phase 1 (now): use `nix run .#deploy` as the stable deploy command.
2. Phase 2: move secret material out of plain `config.env` into `sops-nix` or `agenix`.
3. Phase 3: split deploy orchestration into explicit flake apps:
   - `.#infra-apply` (Terraform/OpenTofu stacks)
   - `.#host-bootstrap` (nixos-anywhere for first install)
   - `.#host-switch` (nixos-rebuild or deploy-rs for updates)
4. Phase 4: keep `scripts/install.sh` as compatibility wrapper only, then remove it.
