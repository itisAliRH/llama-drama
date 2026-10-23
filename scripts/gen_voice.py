#!/usr/bin/env python3
"""Generate narration voice lines (mp3) with ElevenLabs from assets/voice/lines.json.

Usage:
  python3 scripts/gen_voice.py [--dry-run] [--force] [--only EVENT]
                               [--model MODEL] [--voice gary=ID --voice sunny=ID --voice hero=ID]
                               [--sfx-only | --no-sfx]

Key: ELEVENLABS_API_KEY in the environment or in a git-ignored .env at the repo root.
The key is never printed.
Required key permissions: Text to Speech (Access), Sound Effects (Access) and Voices (Read).
(Voices (Read) is not needed when all three --voice overrides are given;
Sound Effects (Access) is not needed with --no-sfx.)

Writes assets/voice/<file> (lines, optional `reply` lines, and sfx/*.mp3). Existing files are skipped unless --force.
Exit code is 1 if the key is missing or any line failed.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "assets", "voice")
LINES = os.path.join(VOICE_DIR, "lines.json")
API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_22050_32"
PREFER = {
    "gary": ["Callum", "George", "Bill", "Brian"],
    "sunny": ["Jessica", "Laura", "Charlotte", "Lily"],
    "hero": ["Adam", "Bill", "Brian", "Daniel", "George"],
}
SETTINGS = {
    "gary": {"stability": 0.35, "style": 0.6, "similarity_boost": 0.75},
    "sunny": {"stability": 0.3, "style": 0.7, "similarity_boost": 0.75},
    "hero": {"stability": 0.25, "style": 0.9, "similarity_boost": 0.75},
}


def load_env():
    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            if k.startswith("export "):
                k = k[7:].strip()
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)


def http(url, key, data=None):
    headers = {"xi-api-key": key, "Accept": "application/json" if data is None else "audio/mpeg"}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def err_text(e):
    try:
        return e.read().decode("utf-8", "replace")[:200].replace("\n", " ")
    except Exception:
        return ""


def pick_voices(key):
    try:
        voices = json.loads(http(API + "/voices", key))["voices"]
    except urllib.error.HTTPError as e:
        sys.exit("voice list failed: HTTP %d %s (key needs Voices (Read), or pass --voice)" % (e.code, err_text(e)))
    except Exception as e:
        sys.exit("voice list failed: %s" % e)
    premade = [v for v in voices if v.get("category") == "premade"] or voices
    by_name = {v["name"].split(" - ")[0].split()[0].lower(): v for v in premade}
    chosen = {}
    for who, names in PREFER.items():
        for n in names:
            v = by_name.get(n.lower())
            if v and v["voice_id"] not in [c["voice_id"] for c in chosen.values()]:
                chosen[who] = v
                break
    for who in PREFER:
        if who not in chosen:
            for v in premade:
                if v["voice_id"] not in [c["voice_id"] for c in chosen.values()]:
                    chosen[who] = v
                    break
    if len(chosen) < len(PREFER):
        sys.exit("could not pick distinct voices; use --voice")
    return {who: v["voice_id"] for who, v in chosen.items()}, {who: v["name"] for who, v in chosen.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="list lines, no API calls")
    ap.add_argument("--force", action="store_true", help="regenerate existing files")
    ap.add_argument("--only", metavar="EVENT", help="only this event")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--voice", action="append", default=[], metavar="WHO=ID", help="gary=<id>, sunny=<id> or hero=<id>")
    ap.add_argument("--sfx-only", action="store_true", help="only crowd sound effects")
    ap.add_argument("--no-sfx", action="store_true", help="skip crowd sound effects")
    a = ap.parse_args()

    with open(LINES, encoding="utf-8") as f:
        bank = json.load(f)
    events = bank["events"]
    if a.only:
        if a.only not in events:
            sys.exit("unknown event %r; known: %s" % (a.only, ", ".join(events)))
        events = {a.only: events[a.only]}
    items = []
    for e, ls in events.items():
        for l in ls:
            items.append((e, l))
            if l.get("reply"):
                items.append((e, l["reply"]))
    sfx = []
    if not a.no_sfx and not a.only:
        sfx = [(k, x) for k, xs in bank.get("sfx", {}).items() for x in xs]
    if a.sfx_only:
        items = []

    if a.dry_run:
        for e, l in items:
            exists = os.path.isfile(os.path.join(VOICE_DIR, l["file"]))
            print("%-12s %-5s %-28s %s%s" % (e, l["who"], l["file"], l["text"], " [exists]" if exists else ""))
        for k, x in sfx:
            exists = os.path.isfile(os.path.join(VOICE_DIR, x["file"]))
            print("sfx %-8s %-24s %ss%s %s%s" % (k, x["file"], x.get("duration"), " loop" if x.get("loop") else "", x["prompt"], " [exists]" if exists else ""))
        print("%d lines, %d sfx" % (len(items), len(sfx)))
        return 0

    load_env()
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        print("ELEVENLABS_API_KEY not set (export it or add it to .env)", file=sys.stderr)
        return 1

    ids = {}
    for v in a.voice:
        who, _, vid = v.partition("=")
        if who not in PREFER or not vid:
            sys.exit("bad --voice %r, use gary=<id> or sunny=<id>" % v)
        ids[who] = vid
    if set(ids) == set(PREFER) or not items:
        names = {w: "(override)" for w in ids}
    else:
        picked, names = pick_voices(key)
        for w in picked:
            ids.setdefault(w, picked[w])
            if w not in [x.partition("=")[0] for x in a.voice]:
                continue
            names[w] = "(override)"
    for w in PREFER:
        if w in ids:
            print("voice %s: %s %s" % (w, names.get(w, "?"), ids[w]))

    failed = 0
    for e, l in items:
        path = os.path.join(VOICE_DIR, l["file"])
        if os.path.isfile(path) and not a.force:
            print("skip %s (exists)" % l["file"])
            continue
        payload = {"text": l["text"], "model_id": a.model, "voice_settings": SETTINGS[l["who"]]}
        url = "%s/text-to-speech/%s?output_format=%s" % (API, ids[l["who"]], OUTPUT_FORMAT)
        try:
            audio = http(url, key, payload)
            if not audio:
                raise ValueError("empty response")
            with open(path, "wb") as f:
                f.write(audio)
            print("ok   %s (HTTP 200, %d bytes)" % (l["file"], len(audio)))
        except urllib.error.HTTPError as ex:
            failed += 1
            print("FAIL %s HTTP %d %s" % (l["file"], ex.code, err_text(ex)))
        except Exception as ex:
            failed += 1
            print("FAIL %s %s" % (l["file"], ex))
    for k, x in sfx:
        path = os.path.join(VOICE_DIR, x["file"])
        if os.path.isfile(path) and not a.force:
            print("skip %s (exists)" % x["file"])
            continue
        payload = {"text": x["prompt"], "duration_seconds": x.get("duration", 2), "prompt_influence": 0.5}
        if x.get("loop"):
            payload["loop"] = True
        try:
            audio = http(API + "/sound-generation", key, payload)
            if not audio:
                raise ValueError("empty response")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(audio)
            print("ok   %s (HTTP 200, %d bytes)" % (x["file"], len(audio)))
        except urllib.error.HTTPError as ex:
            failed += 1
            print("FAIL %s HTTP %d %s" % (x["file"], ex.code, err_text(ex)))
        except Exception as ex:
            failed += 1
            print("FAIL %s %s" % (x["file"], ex))
    print("%d failed" % failed if failed else "done")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
