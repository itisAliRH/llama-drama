#!/usr/bin/env bash
# Copy only the web assets to the UNO Q, without restarting the app (no sketch rebuild).
# Usage: scripts/push_assets.sh [host]   (default host: $BOARD_HOST, e.g. arduino@<board-ip>)
set -euo pipefail

HOST="${1:-${BOARD_HOST:?Set BOARD_HOST, e.g. BOARD_HOST=arduino@<board-ip>}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

COPYFILE_DISABLE=1 tar -C "$ROOT" --no-xattrs -czf - --exclude '.DS_Store' --exclude '.playwright-cli' assets \
  | ssh -o BatchMode=yes "$HOST" "cd ~/ArduinoApps/llama-drama && rm -rf assets && tar -xzf - 2>/dev/null && sync"
echo "Assets updated. Reload the page."
