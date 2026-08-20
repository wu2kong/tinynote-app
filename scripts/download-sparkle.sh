#!/bin/bash
# Download Sparkle 2.8.1 framework and CLI tools into src-tauri/.
set -euo pipefail

VERSION="2.8.1"
EXPECTED_SHA256="5cddb7695674ef7704268f38eccaee80e3accbf19e61c1689efff5b6116d85be"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri"

if [ -d "$DEST/Sparkle.framework" ] && [ -x "$DEST/sparkle-bin/generate_keys" ]; then
  echo "Sparkle.framework already exists"
  exit 0
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Downloading Sparkle ${VERSION}..."
curl -L -o "$TEMP_DIR/sparkle.tar.xz" \
  "https://github.com/sparkle-project/Sparkle/releases/download/${VERSION}/Sparkle-${VERSION}.tar.xz"

echo "Verifying checksum..."
echo "${EXPECTED_SHA256}  $TEMP_DIR/sparkle.tar.xz" | shasum -a 256 -c -

echo "Extracting Sparkle.framework..."
tar -xf "$TEMP_DIR/sparkle.tar.xz" -C "$TEMP_DIR"

rm -rf "$DEST/Sparkle.framework"
cp -R "$TEMP_DIR/Sparkle.framework" "$DEST/"

if [ -d "$TEMP_DIR/bin" ]; then
  echo "Copying Sparkle bin tools..."
  rm -rf "$DEST/sparkle-bin"
  mkdir -p "$DEST/sparkle-bin"
  cp -R "$TEMP_DIR/bin/"* "$DEST/sparkle-bin/"
  chmod +x "$DEST/sparkle-bin/"*
fi

echo "Done."
echo "To generate EdDSA keys: $DEST/sparkle-bin/generate_keys"
