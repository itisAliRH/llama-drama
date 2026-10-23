#!/usr/bin/env bash
# Copy recorded Edge Impulse CSVs from the board into the repo's data/ dir.
# Usage: scripts/pull_data.sh [host]   (default host: $BOARD_HOST, e.g. arduino@<board-ip>)
set -euo pipefail

HOST="${1:-${BOARD_HOST:?Set BOARD_HOST, e.g. BOARD_HOST=arduino@<board-ip>}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/data"
# Board has no rsync: stream a tarball of the CSVs only (never keys or the leaderboard).
ssh -o BatchMode=yes "$HOST" "cd ~/ArduinoApps/llama-drama && \
  find data data/crops -maxdepth 1 -name '*.csv' 2>/dev/null | tar -czf - -T - 2>/dev/null || true" \
  | tar -C "$ROOT" -xzf -
echo "Clips per label:"
for l in left right jump duck idle; do
  printf '  %-6s %s\n' "$l" "$(find "$ROOT/data" -name "$l.*.csv" | wc -l | tr -d ' ')"
done
