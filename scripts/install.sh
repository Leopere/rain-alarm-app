#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="/Applications/Rain Alarm.app"
ICON_ICNS="${ROOT_DIR}/build/rain-alarm.icns"

cd "${ROOT_DIR}"

PACKAGED_APP="$("${ROOT_DIR}/scripts/package.sh" | tail -n 1)"

rm -rf "${APP_PATH}"
ditto "${PACKAGED_APP}" "${APP_PATH}"
cp "${ICON_ICNS}" "${APP_PATH}/Contents/Resources/rain-alarm.icns"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile rain-alarm" "${APP_PATH}/Contents/Info.plist"
codesign --force --deep --sign - "${APP_PATH}" >/dev/null
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${APP_PATH}" 2>/dev/null || true

echo "Installed ${APP_PATH}"
