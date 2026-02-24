# Homerow Email

Self-hosted email with full control and a modern webmail experience.

This repository provides a practical path to provision infrastructure, deploy a NixOS mail server, and run a custom webmail stack.

## Documentation

Full docs: https://docs.homerow.email

Key pages:
- Quick start: https://docs.homerow.email/getting-started/quick-start/
- Configuration (`config.env`): https://docs.homerow.email/getting-started/configuration/
- Remote deploy (GitHub Actions): https://docs.homerow.email/deploy/github-actions/
- Local deploy (Docker/Podman): https://docs.homerow.email/deploy/docker/
- Local deploy (Nix/NixOS): https://docs.homerow.email/deploy/local-nix/
- Architecture overview: https://docs.homerow.email/architecture/overview/
- Sync engine: https://docs.homerow.email/architecture/sync-engine/
- Terraform state: https://docs.homerow.email/infrastructure/terraform-state/
- Resource sizing: https://docs.homerow.email/operations/resource-sizing/
- Backups and restore: https://docs.homerow.email/operations/backups-restore/
- Security: https://docs.homerow.email/operations/security/
- Updates: https://docs.homerow.email/operations/updates/
- Destroy: https://docs.homerow.email/operations/destroy/

## Deploy

### Option A: Remotely with GitHub Actions (Fork-and-Deploy)

1. Fork this repository.
2. Create a local `config.env` (see Configuration docs above).
3. Add helper values to `config.env`:

```bash
GITHUB_FORK_REPO=<owner/repo>
SSH_PRIVATE_KEY_PATH=<path/to/private_key>
```

4. Push secrets to your fork (without cloning):

```bash
curl -fsSL https://raw.githubusercontent.com/guilhermeprokisch/homerow/main/scripts/fork-deploy.sh | bash -s -- --config ./config.env
```

The script can also trigger workflow `Deploy Mail Server` after uploading secrets.

> [!NOTE]
> `gh` CLI is required for this flow (`gh auth login`).
> Deploy always needs an SSH key.
> Local commands use `SSH_PRIVATE_KEY_PATH`; GitHub Actions uses `SSH_PRIVATE_KEY` secret content.
> If you manually add secrets in your fork, set `SSH_PRIVATE_KEY` to full private key content (not a filesystem path).

### Option B: Locally with Docker/Podman

1. Clone this repository.
2. Create `config.env` in repo root (see Configuration docs).
3. Run:

```bash
SSH_PRIVATE_KEY_PATH=<path/to/private_key> ./hrow deploy --via docker
```

### Option C: Locally with Nix/NixOS

1. Clone this repository.
2. Create `config.env` in repo root (see Configuration docs).
3. Run:

```bash
SSH_PRIVATE_KEY_PATH=<path/to/private_key> nix run .#deploy
```

## Post-Deploy Guides

- After deploy checks: https://docs.homerow.email/guides/after-deploy/
- Gmail migration: https://docs.homerow.email/guides/gmail-migration/
- Hetzner post-install guide: https://docs.homerow.email/guides/hetzner-post-install/

## Development Notes

- Never commit `config.env`, private keys, or provider secrets.
- Providers and stack notes: [infra/PROVIDERS.md](infra/PROVIDERS.md)
- Infra module details: [infra/README.md](infra/README.md)
