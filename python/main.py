from arduino.app_utils import *
from arduino.app_bricks.web_ui import WebUI
import re
import threading
import time

logger = Logger("llama-drama")
ui = WebUI()

START = time.time()
last_status = {"msg": "no status yet"}
debug = {
    "mode": "gesture",
    "i2c": "",
    "sensor": "waiting",
    "gesture": "",
    "raw": "",
    "msgs": 0,
    "uptime": 0,
}


def send_debug():
    debug["uptime"] = round(time.time() - START, 1)
    ui.send_message("debug", dict(debug))


def gesture(move: str, raw: int = 0):
    """Called by the sketch via Bridge.notify("gesture", move, raw)."""
    debug["msgs"] += 1
    if raw and globals().get("ai", {}).get("mode") == "ai" and globals()["ai"].get("runner"):
        logger.info(f"gesture {move} ignored (mode=ai)")
        return
    debug["gesture"] = move
    debug["raw"] = f"0x{int(raw):02x}"
    logger.info(f"gesture -> {move} raw={debug['raw']}")
    ui.send_message("move", {"move": move})
    if move == "shoot":
        globals().get("lcd_event", lambda _e: None)("shoot")
    send_debug()


def sensor_status(msg: str):
    """Called by the sketch every few seconds with the I2C scan result."""
    if msg != last_status["msg"]:
        logger.info(f"sensor: {msg}")
    last_status["msg"] = msg
    addrs = re.findall(r"0x[0-9a-f]{2}", msg)
    debug["i2c"] = ",".join(addrs)
    debug["sensor"] = "ok" if "init OK" in msg else msg.split("|")[-1].strip()


def on_game_state(client_id, data):
    logger.info(f"game state: {data}")
    try:
        lcd_from_state(data)
    except Exception as e:
        logger.warning(f"lcd: state mapping failed: {e}")
    try:
        globals().get("lb_on_state", lambda _c, _d: None)(client_id, data)
    except Exception as e:
        logger.warning(f"leaderboard: state hook failed: {e}")


def on_client_move(client_id, data):
    """Lets the browser inject a move for testing (echoed back to all clients)."""
    move = (data or {}).get("move")
    if move:
        gesture(move, 0)


def heartbeat():
    while True:
        try:
            send_debug()
        except Exception as e:
            logger.warning(f"heartbeat failed: {e}")
        time.sleep(1)


ui.on_message("game_state", on_game_state)
ui.on_message("test_move", on_client_move)
ui.expose_api("GET", "/status", lambda: {**last_status, **debug})
ui.on_connect(lambda sid: logger.info(f"client connected: {sid}"))

Bridge.provide("gesture", gesture)
Bridge.provide("sensor_status", sensor_status)

threading.Thread(target=heartbeat, daemon=True).start()

# --- AI path: raw PAJ7620 recording (Edge Impulse CSV) + optional inference ---
import collections
import os

RAW_HZ = 50
RAW_DT_MS = 1000 // RAW_HZ
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(APP_DIR, "data")
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.eim")
LABELS = ("left", "right", "jump", "duck", "idle")
AI_MIN_CONF = 0.7
AI_COOLDOWN_S = 0.4
AI_STRIDE = 5  # samples between classifications (100 ms at 50 Hz)

ai_lock = threading.Lock()
raw_buf = collections.deque(maxlen=RAW_HZ * 10)
raw_state = {"wanted": False, "batches": 0, "last_push": 0.0}
rec = {"active": False}
ai = {
    "mode": os.environ.get("MODE", "builtin"),
    "runner": None,
    "window": 0,
    "axes": 4,
    "since": 0,
    "last_fire": 0.0,
    "armed": True,  # fire once per gesture; re-armed by idle or after one window
}
debug["ai_mode"] = ai["mode"]
debug["ai_label"] = ""
debug["ai_conf"] = 0.0
debug["ai_model"] = "none"
debug["raw_batches"] = 0


def _safe(s: str) -> str:
    """Filename-safe token; dots removed because Edge Impulse takes the label from text before the first dot."""
    return re.sub(r"[^A-Za-z0-9_-]", "", str(s or ""))[:24]


def set_raw(on: bool):
    raw_state["wanted"] = bool(on)
    try:
        Bridge.call("set_raw", bool(on), timeout=2)
    except Exception as e:
        logger.warning(f"set_raw({on}) failed: {e}")


def raw_needed() -> bool:
    return raw_state["wanted"] or rec["active"] or (ai["runner"] is not None and ai["mode"] in ("ai", "both"))


def raw_keepalive():
    """Re-assert raw streaming: the sketch may boot after python or reset."""
    while True:
        try:
            Bridge.call("set_raw", raw_needed(), timeout=2)
        except Exception as e:
            logger.debug(f"raw keepalive: {e}")
        time.sleep(5)


def record_start(label: str, seconds: float = 2, name: str = "") -> dict:
    label = _safe(label).lower()
    if label not in LABELS:
        return {"ok": False, "error": f"label must be one of {LABELS}"}
    seconds = max(0.5, min(float(seconds or 2), 30))
    os.makedirs(DATA_DIR, exist_ok=True)
    who = _safe(name)
    ts = time.strftime("%Y%m%d-%H%M%S")
    fname = f"{label}.{who + '-' if who else ''}{ts}.csv"
    path = os.path.join(DATA_DIR, fname)
    with ai_lock:
        if rec["active"]:
            _record_finish("restarted")
        f = open(path, "w")
        f.write("timestamp,x,y,brightness,size\n")
        rec.update(active=True, label=label, file=fname, path=path, f=f, rows=0,
                   target=int(round(seconds * RAW_HZ)), seconds=seconds, t0=None)
    set_raw(True)
    logger.info(f"record start {fname} ({seconds}s)")
    ui.send_message("record_progress", {"file": fname, "rows": 0, "target": rec["target"], "label": label})
    return {"ok": True, "file": fname, "target": rec["target"]}


def _record_finish(reason: str):
    """Caller holds ai_lock."""
    if not rec["active"]:
        return None
    try:
        rec["f"].close()
    except Exception:
        pass
    rec["active"] = False
    info = {"file": rec["file"], "rows": rec["rows"], "label": rec["label"], "reason": reason}
    counts = clip_counts()
    info["counts"] = counts
    logger.info(f"record done {info['file']} rows={info['rows']} ({reason})")
    ui.send_message("record_done", info)
    return info


def record_stop():
    with ai_lock:
        return _record_finish("stopped") or {"ok": False, "error": "not recording"}


def clip_counts() -> dict:
    counts = {l: 0 for l in LABELS}
    try:
        for fn in os.listdir(DATA_DIR):
            lab = fn.split(".", 1)[0]
            if lab in counts and fn.endswith(".csv"):
                counts[lab] += 1
    except FileNotFoundError:
        pass
    return counts


def raw(t0: int, data: str):
    """Called by the sketch via Bridge.notify("raw", t0_ms, "x,y,b,s;...")."""
    samples = []
    for part in str(data).split(";"):
        if not part:
            continue
        try:
            x, y, b, s = (int(v) for v in part.split(","))
        except ValueError:
            continue
        samples.append((x, y, b, s))
    if not samples:
        return
    raw_state["batches"] += 1
    debug["raw_batches"] = raw_state["batches"]
    with ai_lock:
        raw_buf.extend(samples)
        if rec["active"]:
            if rec["t0"] is None:
                rec["t0"] = int(t0)
            base = int(t0) - rec["t0"]
            for i, (x, y, b, s) in enumerate(samples):
                if rec["rows"] >= rec["target"]:
                    break
                rec["f"].write(f"{base + i * RAW_DT_MS},{x},{y},{b},{s}\n")
                rec["rows"] += 1
            ui.send_message("record_progress", {"file": rec["file"], "rows": rec["rows"],
                                                "target": rec["target"], "label": rec["label"]})
            if rec["rows"] >= rec["target"]:
                _record_finish("complete")
    ui.send_message("raw", {"t0": int(t0), "s": samples})
    ai_step(len(samples))


def ai_load():
    if not os.path.exists(MODEL_PATH):
        logger.info(f"AI: no model at {MODEL_PATH}; staying on built-in gestures")
        debug["ai_model"] = "none"
        return
    try:
        os.chmod(MODEL_PATH, 0o755)
    except Exception:
        pass
    try:
        from edge_impulse_linux.runner import ImpulseRunner
        runner = ImpulseRunner(MODEL_PATH)
        info = runner.init()
        params = info["model_parameters"]
        axes = int(params.get("axis_count") or 4)
        ai["window"] = int(params["input_features_count"]) // axes
        ai["axes"] = axes
        ai["runner"] = runner
        debug["ai_model"] = f"{info.get('project', {}).get('name', 'model')} win={ai['window']} labels={params.get('labels')}"
        logger.info(f"AI: model loaded: {debug['ai_model']}")
    except Exception as e:
        debug["ai_model"] = f"error: {e}"
        logger.warning(f"AI: model load failed ({e}); staying on built-in gestures")


def ai_step(n_new: int):
    if ai["runner"] is None or ai["mode"] not in ("ai", "both"):
        return
    ai["since"] += n_new
    if ai["since"] < AI_STRIDE:
        return
    ai["since"] = 0
    with ai_lock:
        if len(raw_buf) < ai["window"]:
            return
        win = list(raw_buf)[-ai["window"]:]
    feats = [float(v) for smp in win for v in smp[: ai["axes"]]]
    try:
        res = ai["runner"].classify(feats)
    except Exception as e:
        logger.warning(f"AI classify failed: {e}")
        return
    scores = (res.get("result") or {}).get("classification") or {}
    if not scores:
        return
    label, conf = max(scores.items(), key=lambda kv: kv[1])
    debug["ai_label"] = label
    debug["ai_conf"] = round(float(conf), 2)
    now = time.time()
    # A gesture stays in the window for ~1 window length; without this one swipe fires 2-3 moves.
    if label == "idle" or now - ai["last_fire"] >= ai["window"] * RAW_DT_MS / 1000:
        ai["armed"] = True
    if ai["armed"] and label != "idle" and conf >= AI_MIN_CONF and now - ai["last_fire"] >= AI_COOLDOWN_S:
        ai["armed"] = False
        ai["last_fire"] = now
        debug["gesture"] = f"ai:{label}"
        logger.info(f"AI move -> {label} ({conf:.2f})")
        ui.send_message("move", {"move": label, "source": "ai", "confidence": round(float(conf), 2)})


def on_set_mode(client_id, data):
    mode = str((data or {}).get("mode", "")).lower()
    if mode not in ("builtin", "ai", "both"):
        return
    ai["mode"] = mode
    debug["ai_mode"] = mode if (ai["runner"] or mode == "builtin") else f"{mode} (no model -> builtin)"
    logger.info(f"mode -> {debug['ai_mode']}")
    set_raw(raw_needed())
    send_debug()


def on_record_start(client_id, data):
    d = data or {}
    res = record_start(d.get("label", ""), d.get("seconds", 2), d.get("name", ""))
    if not res.get("ok"):
        ui.send_message("record_error", res)


ui.on_message("record_start", on_record_start)
ui.on_message("record_stop", lambda cid, d: record_stop())
ui.on_message("raw_on", lambda cid, d: set_raw(True))
ui.on_message("raw_off", lambda cid, d: set_raw(False))
ui.on_message("set_mode", on_set_mode)
ui.on_message("clip_counts", lambda cid, d: ui.send_message("clip_counts", clip_counts()))
ui.expose_api("GET", "/clips", lambda: clip_counts())
Bridge.provide("raw", raw)
ai_load()
on_set_mode(None, {"mode": ai["mode"]})
threading.Thread(target=raw_keepalive, daemon=True).start()
# --- end AI path ---

# --- Grove LCD RGB: game state -> sketch Bridge "lcdm"(mode, score, lives, ammo, coins, level, event, best) ---
# The sketch animates on its own (~7 fps); python sends mode/values on change plus one-shot events.
# Unknown values are sent as -1. Falls back to the legacy text call "lcd"(l1, l2, r, g, b) for old sketches.
LCD_MIN_S = 0.125  # <= 8 calls/s
LCD_RETRY_S = 3.0
LCD_MODES = {"idle": 0, "running": 1, "paused": 2, "dead": 3}
LCD_EVENTS = {"hit": 1, "coin": 2, "shoot": 3, "levelup": 4, "turn": 5}
LCD_WHITE = (255, 255, 255)
LCD_GREEN = (40, 255, 60)
LCD_YELLOW = (255, 190, 0)
LCD_RED = (255, 0, 0)
LCD_BLUE = (0, 90, 255)
LCD_AMBER = (255, 110, 0)
lcd_lock = threading.Lock()
lcd = {
    "want": (0, 0, -1, -1, -1, -1, -1),  # mode, score, lives, ammo, coins, level, best
    "text": ("BARE METAL", "READY", LCD_WHITE),
    "sent": None,
    "next": 0.0,
    "events": collections.deque(maxlen=8),  # events are queued, not coalesced
    "prev": {},
    "best": -1,
}
debug["lcd"] = "waiting"


def _int(v, default=None):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def lcd_screen(data) -> tuple:
    """Legacy text mapping: game state dict -> (line1, line2, rgb)."""
    d = data or {}
    state = str(d.get("state", "")).lower()
    score = _int(d.get("score"), 0)
    lives = _int(d.get("lives"))
    if state == "paused" or (state == "running" and d.get("paused")):
        return ("PAUSED", f"SCORE {score}", LCD_AMBER)
    if state == "dead":
        return ("GAME OVER", f"SCORE {score}", LCD_RED)
    if state == "running":
        parts = []
        if _int(d.get("level")) is not None:
            parts.append(f"L{_int(d.get('level'))}")
        if lives is not None:
            parts.append(f"HP{lives}")
        if _int(d.get("coins")) is not None:
            parts.append(f"C{_int(d.get('coins'))}")
        line2 = " ".join(parts) if parts else f"TRACK {_int(d.get('track'), 0)}"
        color = LCD_GREEN if lives is None or lives >= 3 else LCD_YELLOW if lives == 2 else LCD_RED
        return (f"SCORE {score}", line2, color)
    return ("LLAMA DRAMA", "SWIPE UP START", LCD_BLUE)


def lcd_event(name: str):
    code = LCD_EVENTS.get(str(name or "").lower())
    if code:
        with lcd_lock:
            lcd["events"].append(code)


def lcd_from_state(data):
    """Maps game state to the lcdm values and derives events from changes."""
    d = data or {}
    state = str(d.get("state", "")).lower()
    if state == "running" and d.get("paused"):
        state = "paused"
    mode = LCD_MODES.get(state, 0)
    score = _int(d.get("score"), 0)
    lives = _int(d.get("lives"), -1)
    ammo = _int(d.get("ammo"), -1)
    coins = _int(d.get("coins"), -1)
    level = _int(d.get("level"), -1)
    best = _int(d.get("best"), -1)
    with lcd_lock:
        if mode == 3:  # session best when the game does not report one
            lcd["best"] = max(lcd["best"], score)
        if best < 0 and lcd["best"] > 0:
            best = lcd["best"]
        p = lcd["prev"]
        evs = []
        if p and mode == 1 and p.get("mode") in (1, 2):
            if 0 <= lives < p.get("lives", -1):
                evs.append("hit")
            if coins > p.get("coins", coins) >= 0:
                evs.append("coin")
            if level > p.get("level", level) >= 0:
                evs.append("levelup")
        turn = bool(d.get("fork") or d.get("turn"))
        if turn and not p.get("turn"):
            evs.append("turn")
        lcd["prev"] = {"mode": mode, "lives": lives, "coins": coins, "level": level, "turn": turn}
        lcd["want"] = (mode, score, lives, ammo, coins, level, best)
        lcd["text"] = lcd_screen(data)
    for e in evs:
        lcd_event(e)
    if d.get("event"):
        lcd_event(d.get("event"))


def lcd_worker():
    """Sends values on change or with an event, at most every LCD_MIN_S; LCD missing is not an error."""
    while True:
        time.sleep(LCD_MIN_S)
        if time.time() < lcd["next"]:
            continue
        with lcd_lock:
            want = lcd["want"]
            text = lcd["text"]
            ev = lcd["events"][0] if lcd["events"] else 0
        if not ev and want == lcd["sent"]:
            continue
        mode, score, lives, ammo, coins, level, best = want
        try:
            ok = Bridge.call("lcdm", mode, score, lives, ammo, coins, level, ev, best, timeout=1)
            debug["lcd"] = "ok" if ok else "missing"
        except Exception as e:
            try:  # older sketch without "lcdm": plain text screen
                l1, l2, (r, g, b) = text
                ok = Bridge.call("lcd", l1[:16], l2[:16], r, g, b, timeout=1)
                debug["lcd"] = ("ok" if ok else "missing") + " (text)"
            except Exception as e2:
                lcd["next"] = time.time() + LCD_RETRY_S  # sketch not up yet: retry later
                debug["lcd"] = f"error: {e2}"
                logger.debug(f"lcd: {e} / {e2}")
                continue
        lcd["sent"] = want
        if ev:
            with lcd_lock:
                if lcd["events"] and lcd["events"][0] == ev:
                    lcd["events"].popleft()


threading.Thread(target=lcd_worker, daemon=True).start()
# --- end LCD ---

# --- Leaderboard: data/leaderboard.json, one run recorded per client running -> dead ---
import json

LB_PATH = os.path.join(DATA_DIR, "leaderboard.json")
LB_TOP = 10
lb_lock = threading.Lock()
lb_players = {}  # sid -> {"name", "ui"}
lb_prev = {}  # sid -> last game state


def _lb_name(v) -> str:
    n = re.sub(r"[^A-Z0-9 _.-]", "", str(v or "").strip().upper()).strip()[:12]
    return n or "PLAYER"


def _lb_load() -> dict:
    try:
        with open(LB_PATH) as f:
            d = json.load(f)
        if isinstance(d, dict):
            return {"best": dict(d.get("best") or {}), "top": list(d.get("top") or [])}
    except (OSError, ValueError):
        pass
    return {"best": {}, "top": []}


def _lb_save(d: dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = f"{LB_PATH}.{os.getpid()}.{threading.get_ident()}.tmp"
    with open(tmp, "w") as f:
        json.dump(d, f)
    os.replace(tmp, LB_PATH)


def lb_snapshot() -> dict:
    with lb_lock:
        d = _lb_load()
    return {"top": d["top"][:LB_TOP], "best": d["best"]}


def lb_record(name: str, score: int, coins: int, level: int, ui_name: str) -> dict:
    entry = {"name": name, "score": score, "coins": coins, "level": level, "ui": ui_name, "ts": int(time.time())}
    with lb_lock:
        d = _lb_load()
        prev = d["best"].get(name)
        is_best = prev is None or score > _int(prev.get("score"), 0)
        if is_best:
            d["best"][name] = entry
        d["top"] = sorted(d["top"] + [entry], key=lambda e: -_int(e.get("score"), 0))[:LB_TOP]
        rank = 1 + sum(1 for n, e in d["best"].items() if n != name and _int(e.get("score"), 0) > score)
        _lb_save(d)
        top = d["top"]
    logger.info(f"leaderboard: {name} {score} rank={rank} best={is_best}")
    return {"top": top, "last": {"name": name, "score": score, "rank": rank, "isBest": is_best}}


def lb_on_state(client_id, data):
    d = data or {}
    state = str(d.get("state", "")).lower()
    prev = lb_prev.get(client_id)
    lb_prev[client_id] = state
    if prev == "running" and state == "dead":
        p = lb_players.get(client_id) or {}
        msg = lb_record(p.get("name") or "PLAYER", max(0, _int(d.get("score"), 0)),
                        _int(d.get("coins"), 0), _int(d.get("level"), 0), p.get("ui") or "game")
        ui.send_message("leaderboard", msg)


def on_set_player(client_id, data):
    d = data or {}
    p = lb_players.setdefault(client_id, {})
    p["name"] = _lb_name(d.get("name"))
    p["ui"] = re.sub(r"[^A-Za-z0-9_-]", "", str(d.get("ui") or ""))[:16] or "game"


def on_leaderboard_get(client_id, data):
    ui.send_message("leaderboard", {"top": lb_snapshot()["top"], "last": None})


ui.on_message("set_player", on_set_player)
ui.on_message("leaderboard_get", on_leaderboard_get)
ui.expose_api("GET", "/leaderboard", lambda: lb_snapshot())
# --- end leaderboard ---

# --- live TTS (ElevenLabs): browser emits "tts" {id, text, who}, board replies "tts_audio" {id, ok, b64} ---
import base64
import urllib.error
import urllib.request

TTS_VOICES = {
    "gary": "N2lVS1w4EtoT3dr4eOWO",
    "sunny": "cgSgspJ2msm6clMCkdW9",
    "hero": os.environ.get("ELEVENLABS_HERO_VOICE") or "N2lVS1w4EtoT3dr4eOWO",
}
TTS_MIN_INTERVAL_S = 2.0  # per client
TTS_DAY_CHARS = 20000  # all clients, per calendar day
tts_lock = threading.Lock()
tts_cnt_lock = threading.Lock()
tts_state = {"pending": 0, "day": "", "day_chars": 0}
tts_last = {}  # client id -> time of last accepted request


def _tts_key() -> str:
    k = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if k:
        return k
    try:
        with open(os.path.join(DATA_DIR, "elevenlabs.key"), "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def _tts_live() -> bool:
    v = os.environ.get("LIVE_TTS", "").strip()
    if not v:
        try:
            with open(os.path.join(DATA_DIR, "live_tts"), "r", encoding="utf-8") as f:
                v = f.read().strip()
        except Exception:
            v = ""
    return v == "1"


TTS_KEY = _tts_key()
TTS_ON = bool(TTS_KEY) and _tts_live()


def _tts_reply(cid, tid, ok: bool, b64: str = ""):
    try:
        ui.send_message("tts_audio", {"id": tid, "ok": ok, "b64": b64}, room=cid)
    except Exception as e:
        logger.warning(f"tts: reply failed: {type(e).__name__}")


def _tts_run(cid, tid, text: str, who: str):
    try:
        with tts_lock:  # single request in flight
            body = json.dumps({
                "text": text,
                "model_id": "eleven_flash_v2_5",
                "voice_settings": {"stability": 0.35, "similarity_boost": 0.75, "style": 0.6},
            }).encode("utf-8")
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{TTS_VOICES[who]}?output_format=mp3_22050_32"
            req = urllib.request.Request(url, data=body, method="POST", headers={
                "xi-api-key": TTS_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
            try:
                with urllib.request.urlopen(req, timeout=6) as r:
                    audio = r.read()
                _tts_reply(cid, tid, True, base64.b64encode(audio).decode("ascii"))
            except urllib.error.HTTPError as e:
                logger.warning(f"tts: http {e.code}")
                _tts_reply(cid, tid, False)
            except Exception as e:
                logger.warning(f"tts: {type(e).__name__}")
                _tts_reply(cid, tid, False)
    finally:
        with tts_cnt_lock:
            tts_state["pending"] = max(0, tts_state["pending"] - 1)


def _tts_admit(client_id, n: int) -> str:
    """Server-side limits; returns the drop reason, or "" when admitted."""
    now, day = time.time(), time.strftime("%Y-%m-%d")
    with tts_cnt_lock:
        if tts_state["day"] != day:
            tts_state["day"], tts_state["day_chars"] = day, 0
        if now - tts_last.get(client_id, 0.0) < TTS_MIN_INTERVAL_S:
            return "rate"
        if tts_state["day_chars"] + n > TTS_DAY_CHARS:
            return "daily cap"
        if tts_state["pending"] >= 2:
            return "busy"
        if len(tts_last) > 256:
            tts_last.clear()
        tts_last[client_id] = now
        tts_state["day_chars"] += n
        tts_state["pending"] += 1
    return ""


def on_tts(client_id, data):
    try:
        d = data if isinstance(data, dict) else {}
        tid, text, who = d.get("id"), d.get("text"), d.get("who")
        if not isinstance(tid, str) or len(tid) > 32:
            tid = None
        text = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", text).strip() if isinstance(text, str) else ""
        if not TTS_ON:
            reason = "disabled"
        elif tid is None or not text or len(text) > 220 or who not in TTS_VOICES:
            reason = "bad request"
        else:
            reason = _tts_admit(client_id, len(text))
        if reason:
            (logger.info if reason == "daily cap" else logger.debug)(f"tts: drop ({reason})")
            _tts_reply(client_id, tid, False)
            return
        threading.Thread(target=_tts_run, args=(client_id, tid, text, who), daemon=True).start()
    except Exception as e:
        logger.warning(f"tts: on_tts failed: {type(e).__name__}")


ui.on_message("tts", on_tts)
ui.expose_api("GET", "/tts_status", lambda: {"enabled": TTS_ON})
logger.info(f"tts: {'enabled' if TTS_ON else 'disabled (no key)' if not TTS_KEY else 'disabled (LIVE_TTS not 1)'}")
# --- end live TTS ---

logger.info("llama-drama python started")
App.run()
