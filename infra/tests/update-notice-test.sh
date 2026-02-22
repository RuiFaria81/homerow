#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NOTICE_SCRIPT="${ROOT_DIR}/scripts/print-update-notice.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

WORK_REPO="${TMP_DIR}/work"
REMOTE_REPO="${TMP_DIR}/remote.git"

git init -q "${WORK_REPO}"
git -C "${WORK_REPO}" config user.email "test@example.com"
git -C "${WORK_REPO}" config user.name "test"
echo "test" > "${WORK_REPO}/README"
git -C "${WORK_REPO}" add README
git -C "${WORK_REPO}" commit -q -m "init"

git init -q --bare "${REMOTE_REPO}"
git -C "${WORK_REPO}" remote add upstream "${REMOTE_REPO}"
git -C "${WORK_REPO}" push -q upstream HEAD:main
git -C "${WORK_REPO}" tag v0.1.0
git -C "${WORK_REPO}" push -q upstream v0.1.0
git -C "${WORK_REPO}" tag v0.2.0
git -C "${WORK_REPO}" push -q upstream v0.2.0

echo "0.1.0" > "${WORK_REPO}/VERSION"

OUTDATED_LOG="${TMP_DIR}/outdated.log"
UPDATE_SOURCE_REMOTE=upstream "${NOTICE_SCRIPT}" "${WORK_REPO}" > "${OUTDATED_LOG}"
grep -q "update available: v0.1.0 -> v0.2.0" "${OUTDATED_LOG}"

echo "0.2.0" > "${WORK_REPO}/VERSION"
UPTODATE_LOG="${TMP_DIR}/uptodate.log"
UPDATE_SOURCE_REMOTE=upstream "${NOTICE_SCRIPT}" "${WORK_REPO}" > "${UPTODATE_LOG}"
if [ -s "${UPTODATE_LOG}" ]; then
  echo "expected no output when up to date" >&2
  exit 1
fi

echo "update-notice test: ok"
