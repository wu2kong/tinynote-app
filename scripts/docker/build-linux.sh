#!/usr/bin/env bash
set -euo pipefail

cd /app

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

npx tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm

if [[ -n "${HOST_UID:-}" ]]; then
  if [[ -d /app/src-tauri/target/x86_64-unknown-linux-gnu ]]; then
    chown -R "${HOST_UID}:${HOST_GID:-0}" /app/src-tauri/target/x86_64-unknown-linux-gnu
  fi
  if [[ -f /app/package-lock.json ]]; then
    chown "${HOST_UID}:${HOST_GID:-0}" /app/package-lock.json
  fi
fi
