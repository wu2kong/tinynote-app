#!/bin/bash
# Download WinSparkle 0.9.4 x64 DLL into src-tauri/winsparkle/.
set -euo pipefail

VERSION="0.9.4"
EXPECTED_SHA256="6037df37fc263bd1650a1c4949681a9d40ffe991d01f35892a406cb5d103c976"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri/winsparkle"
DLL="$DEST/WinSparkle.dll"

if [ -f "$DLL" ]; then
  echo "WinSparkle.dll already exists"
  exit 0
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Downloading WinSparkle ${VERSION}..."
curl -L -o "$TEMP_DIR/winsparkle.zip" \
  "https://github.com/vslavik/winsparkle/releases/download/v${VERSION}/WinSparkle-${VERSION}.zip"

echo "Verifying checksum..."
if command -v shasum >/dev/null 2>&1; then
  echo "${EXPECTED_SHA256}  $TEMP_DIR/winsparkle.zip" | shasum -a 256 -c -
elif command -v sha256sum >/dev/null 2>&1; then
  echo "${EXPECTED_SHA256}  $TEMP_DIR/winsparkle.zip" | sha256sum -c -
else
  echo "No sha256 tool found, skipping checksum verification"
fi

echo "Extracting WinSparkle.dll..."
tar -xf "$TEMP_DIR/winsparkle.zip" -C "$TEMP_DIR"

mkdir -p "$DEST"
cp "$TEMP_DIR/WinSparkle-${VERSION}/x64/Release/WinSparkle.dll" "$DLL"

if [ -f "$TEMP_DIR/WinSparkle-${VERSION}/bin/winsparkle-tool.exe" ]; then
  cp "$TEMP_DIR/WinSparkle-${VERSION}/bin/winsparkle-tool.exe" "$DEST/winsparkle-tool.exe"
fi

echo "Done. DLL: $DLL"
