#!/usr/bin/env bash
# Restore the app on the UNO Q from a backup copy and restart it. data/ (leaderboard, key) is left untouched.
#   current  ~/ArduinoApps/llama-drama-backup          last verified build, with live voice (default)
#   prelive  ~/ArduinoApps/llama-drama-backup-prelive  build from before live voice (git tag demo-safe-1810)
# Usage: scripts/rollback_board.sh [current|prelive] [host]   (default host: $BOARD_HOST, e.g. arduino@<board-ip>)
set -euo pipefail

case "${1:-current}" in
  current) SRC=llama-drama-backup ;;
  prelive) SRC=llama-drama-backup-prelive ;;
  *) echo "usage: $0 [current|prelive] [host]" >&2; exit 1 ;;
esac
HOST="${2:-${BOARD_HOST:?Set BOARD_HOST, e.g. BOARD_HOST=arduino@<board-ip>}}"
ssh -o BatchMode=yes "$HOST" "cd ~/ArduinoApps && test -d $SRC/python && \
  rm -rf llama-drama/sketch llama-drama/python llama-drama/assets llama-drama/app.yaml && \
  cp -r $SRC/app.yaml $SRC/sketch $SRC/python $SRC/assets llama-drama/ && sync && \
  (arduino-app-cli app stop user:llama-drama >/dev/null 2>&1 || true) && arduino-app-cli app start user:llama-drama"
echo "Rolled back to $SRC. Reload the page."
