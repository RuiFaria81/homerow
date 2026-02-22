#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="${ROOT_DIR}/scripts/deploy-from-config.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -q "$expected" "$file"; then
    echo "expected '$expected' in $file" >&2
    exit 1
  fi
}

MISSING_CONFIG_LOG="${TMP_DIR}/missing-config.log"
if DEPLOY_SKIP_UPDATE_CHECK=1 DEPLOY_CONFIG_FILE="${TMP_DIR}/does-not-exist.env" "${DEPLOY_SCRIPT}" >"${MISSING_CONFIG_LOG}" 2>&1; then
  echo "expected deploy script failure when config file is missing" >&2
  exit 1
fi
assert_contains "${MISSING_CONFIG_LOG}" "missing config file"

INCOMPLETE_CONFIG="${TMP_DIR}/incomplete.env"
cat > "${INCOMPLETE_CONFIG}" <<'EOF'
DOMAIN=example.com
MAIL_PASSWORD=mail-secret
RESTIC_PASSWORD=backup-secret
EOF

INCOMPLETE_LOG="${TMP_DIR}/incomplete.log"
if DEPLOY_SKIP_UPDATE_CHECK=1 DEPLOY_CONFIG_FILE="${INCOMPLETE_CONFIG}" "${DEPLOY_SCRIPT}" >"${INCOMPLETE_LOG}" 2>&1; then
  echo "expected deploy script failure for missing required vars" >&2
  exit 1
fi
assert_contains "${INCOMPLETE_LOG}" "missing required variables"
assert_contains "${INCOMPLETE_LOG}" "CLOUDFLARE_TOKEN"

VALID_CONFIG="${TMP_DIR}/valid.env"
cat > "${VALID_CONFIG}" <<'EOF'
DOMAIN=example.com
MAIL_PASSWORD=mail-secret
RESTIC_PASSWORD=backup-secret
HCLOUD_TOKEN=hc-token
CLOUDFLARE_TOKEN=cf-token
CLOUDFLARE_ZONE_ID=cf-zone
S3_ACCESS_KEY=s3-key
S3_SECRET_KEY=s3-secret
EOF

FAKE_INSTALL="${TMP_DIR}/fake-install.sh"
cat > "${FAKE_INSTALL}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
test -n "${DOMAIN:-}"
test -n "${HCLOUD_TOKEN:-}"
echo "install-called"
EOF
chmod +x "${FAKE_INSTALL}"

SUCCESS_LOG="${TMP_DIR}/success.log"
DEPLOY_SKIP_UPDATE_CHECK=1 DEPLOY_CONFIG_FILE="${VALID_CONFIG}" DEPLOY_INSTALL_CMD="${FAKE_INSTALL}" "${DEPLOY_SCRIPT}" >"${SUCCESS_LOG}" 2>&1
assert_contains "${SUCCESS_LOG}" "install-called"

echo "deploy-from-config test: ok"
