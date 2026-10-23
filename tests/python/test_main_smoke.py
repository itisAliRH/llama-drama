"""Off-board smoke test: import python/main.py with mocked arduino.* modules."""
import importlib.util
import shutil
import sys
import time
import types
import urllib.request
from pathlib import Path

import pytest

MAIN = Path(__file__).resolve().parents[2] / "python" / "main.py"
MOCKED = ("arduino", "arduino.app_utils", "arduino.app_bricks", "arduino.app_bricks.web_ui")


class WebUI:
    def __init__(self, *a, **k):
        self.events, self.api, self.sent = {}, {}, []

    def send_message(self, ev, msg, room=None):
        self.sent.append((ev, msg, room))

    def on_message(self, ev, cb):
        self.events[ev] = cb

    def expose_api(self, method, path, fn):
        self.api[path] = fn

    def on_connect(self, cb):
        pass


def _mock_modules():
    au = types.ModuleType("arduino.app_utils")

    class Logger:
        def __init__(self, name):
            pass

        def info(self, *a):
            pass

        debug = warning = error = info

    class Bridge:
        @staticmethod
        def provide(name, fn):
            pass

        @staticmethod
        def call(name, *a, timeout=10):
            return True

        @staticmethod
        def notify(name, *a):
            pass

    class App:
        @staticmethod
        def run():
            pass

    au.Logger, au.Bridge, au.App = Logger, Bridge, App
    au.__all__ = ["Logger", "Bridge", "App"]
    wu = types.ModuleType("arduino.app_bricks.web_ui")
    wu.WebUI = WebUI
    return {"arduino": types.ModuleType("arduino"), "arduino.app_utils": au,
            "arduino.app_bricks": types.ModuleType("arduino.app_bricks"), "arduino.app_bricks.web_ui": wu}


@pytest.fixture
def load(tmp_path, monkeypatch):
    """Load a copy of main.py under tmp_path, so DATA_DIR is tmp_path/data."""
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.delenv("LIVE_TTS", raising=False)
    (tmp_path / "python").mkdir()
    (tmp_path / "data").mkdir()
    shutil.copy(MAIN, tmp_path / "python" / "main.py")
    for name, mod in _mock_modules().items():
        monkeypatch.setitem(sys.modules, name, mod)

    def _load(key=None, live=None):
        if key:
            monkeypatch.setenv("ELEVENLABS_API_KEY", key)
        if live:
            monkeypatch.setenv("LIVE_TTS", live)
        spec = importlib.util.spec_from_file_location("board_main", tmp_path / "python" / "main.py")
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return m

    return _load


def tts_replies(m):
    return [(msg, room) for ev, msg, room in m.ui.sent if ev == "tts_audio"]


def wait_replies(m, n, timeout=3.0):
    end = time.time() + timeout
    while len(tts_replies(m)) < n and time.time() < end:
        time.sleep(0.01)
    return tts_replies(m)


def test_wires_events_and_routes(load):
    m = load()
    for ev in ("game_state", "record_start", "record_stop", "set_mode", "set_player", "tts"):
        assert ev in m.ui.events
    assert {"/status", "/clips", "/leaderboard", "/tts_status"} <= set(m.ui.api)
    assert "/record" not in m.ui.api


def test_tts_disabled_without_key(load):
    m = load(live="1")
    assert m.ui.api["/tts_status"]() == {"enabled": False}
    m.ui.events["tts"]("sid1", {"id": "v1", "text": "hi", "who": "gary"})
    assert tts_replies(m) == [({"id": "v1", "ok": False, "b64": ""}, "sid1")]


def test_tts_disabled_with_key_but_no_live_flag(load):
    m = load(key="dummy")
    assert m.ui.api["/tts_status"]() == {"enabled": False}


def test_tts_enabled_by_data_file_flag(load, tmp_path):
    (tmp_path / "data" / "live_tts").write_text("1\n")
    m = load(key="dummy")
    assert m.ui.api["/tts_status"]() == {"enabled": True}


def test_tts_rate_limit_cap_and_sender_only(load, monkeypatch):
    calls = []

    class Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b"mp3"

    def fake_urlopen(req, timeout=None):
        calls.append(req)
        return Resp()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    m = load(key="dummy", live="1")
    assert m.ui.api["/tts_status"]() == {"enabled": True}
    tts = m.ui.events["tts"]

    tts("sid1", {"id": "v1", "text": "hi\x00\x07 there", "who": "gary"})
    replies = wait_replies(m, 1)
    assert replies == [({"id": "v1", "ok": True, "b64": "bXAz"}, "sid1")]
    assert len(calls) == 1 and b'"hi there"' in calls[0].data

    tts("sid1", {"id": "v2", "text": "again", "who": "gary"})  # same client, too soon
    assert tts_replies(m)[-1] == ({"id": "v2", "ok": False, "b64": ""}, "sid1")

    tts("sid2", {"id": "x" * 100, "text": "hi", "who": "gary"})  # id too long
    assert tts_replies(m)[-1] == ({"id": None, "ok": False, "b64": ""}, "sid2")

    monkeypatch.setattr(m, "TTS_DAY_CHARS", m.tts_state["day_chars"] + 3)
    tts("sid3", {"id": "v3", "text": "over the cap", "who": "gary"})
    assert tts_replies(m)[-1] == ({"id": "v3", "ok": False, "b64": ""}, "sid3")
    assert len(calls) == 1
