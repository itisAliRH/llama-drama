#!/usr/bin/env bash
# Upload recorded CSV clips to Edge Impulse via the ingestion API.
# Usage: scripts/ei_upload.sh [--dry-run] [files...]
#   default files: data/*.csv except *bottest*
# Label = file name text before the first '.'. Split: ~80/20 train/test by a
# stable hash of the file name, or of the source clip id for crops (name with '~'),
# so all crops of one clip stay in one set. Uploaded names are kept in data/.uploaded.
# Needs EI_API_KEY and EI_PROJECT_ID in .env. The key is never printed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi

# shellcheck source=/dev/null
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
[[ -n "${EI_API_KEY:-}" ]] || { echo "EI_API_KEY not set (add it to .env)" >&2; exit 1; }
[[ -n "${EI_PROJECT_ID:-}" ]] || { echo "EI_PROJECT_ID not set (add it to .env)" >&2; exit 1; }

API="https://studio.edgeimpulse.com/v1/api/$EI_PROJECT_ID"
INGEST="https://ingestion.edgeimpulse.com/api"
DONE_LIST="data/.uploaded"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# curl with the API key passed through a stdin config, so it never shows in argv / ps.
ei_curl() {
  printf 'header = "x-api-key: %s"\n' "$EI_API_KEY" | curl -sS -K - "$@"
}

# 1. Connectivity check: project name + success only.
code="$(ei_curl -o "$TMP/project.json" -w '%{http_code}' "$API/" || true)"
if ! python3 -I - "$TMP/project.json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print("connectivity: FAIL (no JSON reply)"); sys.exit(1)
if not d.get("success"):
    print("connectivity: FAIL", str(d.get("error", ""))[:200]); sys.exit(1)
print("connectivity: OK project =", d.get("project", {}).get("name"))
PY
then
  echo "HTTP $code" >&2
  exit 1
fi

# 2. File list.
files=()
if [[ $# -gt 0 ]]; then
  files=("$@")
else
  shopt -s nullglob
  for f in data/*.csv; do
    [[ "$f" == *bottest* ]] && continue
    files+=("$f")
  done
  shopt -u nullglob
fi
(( DRY )) || touch "$DONE_LIST"

ok=0; fail=0; skip=0
labels=""  # one label per line, counted at the end (bash 3.2 has no assoc arrays)

for f in ${files[@]+"${files[@]}"}; do
  base="$(basename "$f")"
  if [[ ! -f "$f" ]]; then echo "FAIL  $base (missing)"; fail=$((fail+1)); continue; fi
  label="${base%%.*}"
  if grep -Fxq "$base" "$DONE_LIST" 2>/dev/null; then
    echo "SKIP  $base (already uploaded)"; skip=$((skip+1)); continue
  fi
  # Crops of one clip (<label>.<id>~c<k>.csv) share the source id, so they land in one set.
  key="$base"
  if [[ "$base" == *~* ]]; then key="${base#*.}"; key="${key%%~*}"; fi
  h="$(printf '%s' "$key" | cksum | awk '{print $1}')"
  if (( h % 10 < 8 )); then cat=training; else cat=testing; fi

  if (( DRY )); then
    echo "DRY   $base label=$label -> $cat"
    labels+="$label"$'\n'; ok=$((ok+1))
    continue
  fi

  code="$(ei_curl -o "$TMP/resp.json" -w '%{http_code}' \
    -H "x-label: $label" -H "x-disallow-duplicates: 1" \
    -F "data=@$f" "$INGEST/$cat/files" || true)"
  # HTTP 200 is not enough: each file has its own success flag.
  if msg="$(python3 -I - "$TMP/resp.json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print("no JSON reply"); sys.exit(1)
fs = d.get("files") or []
if d.get("success") and fs and all(x.get("success") for x in fs):
    sys.exit(0)
err = d.get("error") or (fs[0].get("error") if fs else "") or "unknown"
print(str(err)[:200]); sys.exit(1)
PY
)"; then
    echo "OK    $base label=$label -> $cat"
    echo "$base" >> "$DONE_LIST"
    labels+="$label"$'\n'; ok=$((ok+1))
  else
    echo "FAIL  $base HTTP $code: $msg"; fail=$((fail+1))
  fi
done

echo "---"
(( DRY )) && echo "dry run: nothing uploaded"
echo "ok=$ok fail=$fail skipped=$skip"
[[ -n "$labels" ]] && printf '%s' "$labels" | sort | uniq -c | awk '{printf "  %-6s %s\n", $2, $1}'
(( fail == 0 ))
