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

# Git Bash on Windows ships GNU tar, which cannot extract zip archives.
extract_zip() {
  local archive="$1"
  local dest="$2"

  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$archive" -d "$dest"
    return
  fi

  local win_tar=""
  if [ -x /c/Windows/System32/tar.exe ]; then
    win_tar="/c/Windows/System32/tar.exe"
  elif [ -x /mnt/c/Windows/System32/tar.exe ]; then
    win_tar="/mnt/c/Windows/System32/tar.exe"
  fi
  if [ -n "$win_tar" ]; then
    if command -v cygpath >/dev/null 2>&1; then
      "$win_tar" -xf "$(cygpath -w "$archive")" -C "$(cygpath -w "$dest")"
    else
      "$win_tar" -xf "$archive" -C "$dest"
    fi
    return
  fi

  if command -v powershell.exe >/dev/null 2>&1 && command -v cygpath >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command \
      "Expand-Archive -LiteralPath '$(cygpath -w "$archive")' -DestinationPath '$(cygpath -w "$dest")' -Force"
    return
  fi

  tar -xf "$archive" -C "$dest"
}

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
extract_zip "$TEMP_DIR/winsparkle.zip" "$TEMP_DIR"

mkdir -p "$DEST"
cp "$TEMP_DIR/WinSparkle-${VERSION}/x64/Release/WinSparkle.dll" "$DLL"

if [ -f "$TEMP_DIR/WinSparkle-${VERSION}/bin/winsparkle-tool.exe" ]; then
  cp "$TEMP_DIR/WinSparkle-${VERSION}/bin/winsparkle-tool.exe" "$DEST/winsparkle-tool.exe"
fi

echo "Done. DLL: $DLL"
