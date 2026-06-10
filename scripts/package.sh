#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build"
ICONSET="${BUILD_DIR}/rain-alarm.iconset"
ICON_PNG="${BUILD_DIR}/rain-alarm-512.png"
ICON_ICNS="${BUILD_DIR}/rain-alarm.icns"
DIST_DIR="${ROOT_DIR}/dist"

cd "${ROOT_DIR}"

command -v npm >/dev/null
command -v sips >/dev/null
command -v iconutil >/dev/null
command -v curl >/dev/null

mkdir -p "${BUILD_DIR}"

if [[ ! -f "${ICON_ICNS}" ]]; then
  rm -rf "${ICONSET}"
  mkdir -p "${ICONSET}"

  curl -L --fail --silent --show-error \
    "https://www.rain-alarm.com/launcher/launcher_512.png" \
    -o "${ICON_PNG}"

  for size in 16 32 128 256 512; do
    sips -z "${size}" "${size}" "${ICON_PNG}" \
      --out "${ICONSET}/icon_${size}x${size}.png" >/dev/null
  done

  for size in 16 32 128 256; do
    double_size=$((size * 2))
    sips -z "${double_size}" "${double_size}" "${ICON_PNG}" \
      --out "${ICONSET}/icon_${size}x${size}@2x.png" >/dev/null
  done

  cp "${ICON_PNG}" "${ICONSET}/icon_512x512.png"
  iconutil -c icns "${ICONSET}" -o "${ICON_ICNS}"
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

rm -rf "${DIST_DIR}"
npm exec -- electron-packager . "Rain Alarm" \
  --platform=darwin \
  --arch=arm64 \
  --out="${DIST_DIR}" \
  --overwrite \
  --app-bundle-id="ca.aedev.rain-alarm" \
  --app-version="0.2.3" \
  --build-version="5" \
  --extend-info="${ROOT_DIR}/resources/extend-info.plist" \
  --ignore="^/dist($|/)" \
  --ignore="^/release($|/)" \
  --ignore="^/\\.git($|/)" \
  --ignore="^/build/rain-alarm\\.iconset($|/)"

PACKAGED_APP="${DIST_DIR}/Rain Alarm-darwin-arm64/Rain Alarm.app"
cp "${ICON_ICNS}" "${PACKAGED_APP}/Contents/Resources/rain-alarm.icns"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile rain-alarm" "${PACKAGED_APP}/Contents/Info.plist"

echo "${PACKAGED_APP}"
