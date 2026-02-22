#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(pwd)}"
REMOTE="${UPDATE_SOURCE_REMOTE:-upstream}"

if [ ! -d "${REPO_ROOT}/.git" ]; then
  exit 0
fi

if ! git -C "${REPO_ROOT}" remote get-url "${REMOTE}" >/dev/null 2>&1; then
  REMOTE="origin"
fi

if ! git -C "${REPO_ROOT}" remote get-url "${REMOTE}" >/dev/null 2>&1; then
  exit 0
fi

latest_tag="$(
  git -C "${REPO_ROOT}" ls-remote --tags --refs "${REMOTE}" 'v*' 2>/dev/null \
    | awk '{print $2}' \
    | sed 's#refs/tags/##' \
    | sort -V \
    | tail -n 1
)"

if [ -z "${latest_tag}" ]; then
  exit 0
fi

current_version=""
if [ -f "${REPO_ROOT}/VERSION" ]; then
  current_version="$(tr -d '[:space:]' < "${REPO_ROOT}/VERSION")"
fi

if [ -z "${current_version}" ]; then
  current_version="$(git -C "${REPO_ROOT}" describe --tags --abbrev=0 2>/dev/null || true)"
fi

if [ -z "${current_version}" ]; then
  exit 0
fi

if [[ "${current_version}" != v* ]]; then
  current_version="v${current_version}"
fi

if [ "${current_version}" = "${latest_tag}" ]; then
  exit 0
fi

echo "[deploy] update available: ${current_version} -> ${latest_tag}"
echo "[deploy] to update, pull latest changes from your upstream remote and re-run deploy."
