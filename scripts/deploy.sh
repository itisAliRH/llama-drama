#!/usr/bin/env bash
# Deploy app to the UNO Q and (re)start it.
# Usage: scripts/deploy.sh [host]   (default host: $BOARD_HOST, e.g. arduino@<board-ip>)
set -euo pipefail

HOST="${1:-${BOARD_HOST:?Set BOARD_HOST, e.g. BOARD_HOST=arduino@<board-ip>}}"
APP_DIR="ArduinoApps/llama-drama"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH=(ssh -o BatchMode=yes "$HOST")

# Board has no rsync: stream a tarball, replacing only our four entries.
# Tracked and new non-ignored files ship (e.g. fresh gen_voice.py clips), plus the git-ignored Edge Impulse model when present.
{
  git -C "$ROOT" ls-files -z -co --exclude-standard app.yaml sketch python assets
  if [[ -f "$ROOT/python/model.eim" ]]; then printf 'python/model.eim\0'; fi
} | COPYFILE_DISABLE=1 tar -C "$ROOT" --no-xattrs --null -T - -czf - \
  | "${SSH[@]}" "mkdir -p ~/$APP_DIR && cd ~/$APP_DIR && rm -rf sketch python assets app.yaml && tar -xzf - && sync"

"${SSH[@]}" "arduino-app-cli app stop user:llama-drama >/dev/null 2>&1 || true; \
  arduino-app-cli app start user:llama-drama"

echo "Started. Logs: ssh $HOST arduino-app-cli app logs user:llama-drama"
