#!/usr/bin/env bash
# Build the Edge Impulse "Linux (AARCH64)" runner (.eim), save it as
# python/model.eim, then deploy the app to the board with scripts/deploy.sh.
# Usage: scripts/ei_deploy.sh [host]   (host is passed to scripts/deploy.sh)
# Env: EI_TARGET, EI_ENGINE (tflite), EI_MODEL_TYPE (float32 | int8), EI_TIMEOUT_S.
# Needs EI_API_KEY and EI_PROJECT_ID in .env. The key is never printed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
[[ -n "${EI_API_KEY:-}" ]] || { echo "EI_API_KEY not set (add it to .env)" >&2; exit 1; }
[[ -n "${EI_PROJECT_ID:-}" ]] || { echo "EI_PROJECT_ID not set (add it to .env)" >&2; exit 1; }

API="https://studio.edgeimpulse.com/v1/api/$EI_PROJECT_ID"
TARGET="${EI_TARGET:-runner-linux-aarch64}"   # format name from GET /deployment/targets
ENGINE="${EI_ENGINE:-tflite}"
MODEL_TYPE="${EI_MODEL_TYPE:-float32}"   # board is Linux aarch64; float avoids int8 accuracy loss
OUT="python/model.eim"
TIMEOUT_S="${EI_TIMEOUT_S:-1200}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# curl with the API key passed through a stdin config, so it never shows in argv / ps.
ei_curl() {
  printf 'header = "x-api-key: %s"\n' "$EI_API_KEY" | curl -sS -K - "$@"
}

# Read a field from a JSON file; exit 1 (and print the API error) when success is false.
jget() {
  python3 -I - "$1" "$2" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print("no JSON reply", file=sys.stderr); sys.exit(1)
if not d.get("success"):
    print("API error:", str(d.get("error", ""))[:200], file=sys.stderr); sys.exit(1)
v = d
for k in sys.argv[2].split("."):
    v = v.get(k) if isinstance(v, dict) else None
print("" if v is None else v)
PY
}

# 1. Start the build job.
printf '{"engine":"%s","modelType":"%s"}' "$ENGINE" "$MODEL_TYPE" > "$TMP/body.json"
ei_curl -X POST -H "Content-Type: application/json" --data-binary "@$TMP/body.json" \
  -o "$TMP/build.json" "$API/jobs/build-ondevice-model?type=$TARGET"
JOB="$(jget "$TMP/build.json" id)"
VER="$(jget "$TMP/build.json" deploymentVersion)"
echo "job $JOB started (target=$TARGET engine=$ENGINE modelType=$MODEL_TYPE version=$VER)"

# 2. Poll until finished.
start=$SECONDS; last=""
while :; do
  ei_curl -o "$TMP/status.json" "$API/jobs/$JOB/status"
  fin="$(jget "$TMP/status.json" job.finished)"
  okf="$(jget "$TMP/status.json" job.finishedSuccessful)"
  if [[ -n "$fin" ]]; then
    echo "job $JOB finished successful=$okf"
    [[ "$okf" == "True" ]] || { echo "build failed; see Studio > Deployment logs" >&2; exit 1; }
    break
  fi
  el=$((SECONDS - start))
  st="job $JOB running"
  [[ "$st" != "$last" ]] && echo "$st" && last="$st"
  (( el < TIMEOUT_S )) || { echo "job $JOB timed out after ${TIMEOUT_S}s" >&2; exit 1; }
  sleep 5
done

# 3. Download the built deployment (zip or bare .eim).
code="$(ei_curl -o "$TMP/artifact" -w '%{http_code}' "$API/deployment/history/$VER/download")"
[[ "$code" == "200" ]] || { echo "download failed: HTTP $code" >&2; exit 1; }
if [[ "$(head -c 2 "$TMP/artifact")" == "PK" ]]; then
  eim="$(unzip -Z1 "$TMP/artifact" | grep -m1 '\.eim$' || true)"
  [[ -n "$eim" ]] || { echo "no .eim inside the downloaded zip" >&2; exit 1; }
  unzip -p "$TMP/artifact" "$eim" > "$OUT"
else
  cp "$TMP/artifact" "$OUT"
fi
chmod +x "$OUT"
echo "saved $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"

# 4. Push the app (with the model) to the board.
exec "$ROOT/scripts/deploy.sh" "$@"
