#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Rain Alarm"
RELEASE_DIR="${ROOT_DIR}/release"
VERSION="$(cd "${ROOT_DIR}" && node -p "require('./package.json').version")"
ARCH="arm64"
ZIP_NAME="Rain-Alarm-macOS-Electron-${ARCH}.zip"

command -v ditto >/dev/null

mkdir -p "${RELEASE_DIR}"
rm -f "${RELEASE_DIR}/${ZIP_NAME}"

PACKAGED_APP="$("${ROOT_DIR}/scripts/package.sh" | tail -n 1)"
ditto -c -k --sequesterRsrc --keepParent "${PACKAGED_APP}" "${RELEASE_DIR}/${ZIP_NAME}"

echo "Packaged ${PACKAGED_APP}"
echo "Packaged ${RELEASE_DIR}/${ZIP_NAME}"
echo "Version ${VERSION}"
