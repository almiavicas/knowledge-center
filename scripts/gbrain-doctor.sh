#!/usr/bin/env bash
set -euo pipefail

if ! command -v gbrain >/dev/null 2>&1; then
  echo "gbrain is not installed. Run: bun install -g github:garrytan/gbrain" >&2
  exit 1
fi

gbrain doctor
