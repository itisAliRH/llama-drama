(function () {
  var KEY = 'bm.settings';
  var cfg = { rot: 0, mirror: false, cool: 150, speed: 1, duckMode: 'hold', slideMs: 800 };
  var TUNE = [
    ['shieldSec', 'Shield duration', 6, 2, 15, 1, 's'], ['shieldCooldown', 'Shield recharge', 45, 10, 120, 1, 's'],
    ['startLives', 'Start lives', 3, 1, 5, 1, ''], ['ammoMax', 'Max ammo', 3, 1, 6, 1, ''],
    ['ammoRecharge', 'Ammo refill time', 15, 5, 60, 1, 's'], ['coinsPerAmmo', 'Coins per ammo', 10, 3, 30, 1, ''],
    ['slowmoSec', 'Shot slow-mo', 1.2, 0.5, 3, 0.1, 's'], ['heartEvery', 'Heart every', 50, 15, 120, 1, 's'],
    ['superEvery', 'Super ammo every', 75, 20, 180, 1, 's'], ['forkEvery', 'Fork every', 27, 10, 60, 1, 's'],
    ['speedStart', 'Start speed', 6, 3, 12, 1, ''], ['speedMax', 'Speed cap', 16, 10, 35, 1, ''], ['reactSec', 'Min time between moves', 1.1, 0.6, 2, 0.1, 's'],
    ['narrCooldown', 'Narration cooldown', 2, 0.5, 10, 0.5, 's'], ['voiceRate', 'Voice speed', 1.2, 0.8, 1.6, 0.05, 'x'], ['liveMax', 'Live lines per run', 12, 0, 60, 1, '']
  ], TOGGLES = [['trapsOn', 'Traps', true], ['godMode', 'God mode (G)', false], ['voiceOn', 'Narration voice', true], ['crowdOn', 'Crowd sounds', true], ['liveComm', 'Live commentary', true], ['liveVoice', 'Live voice (internet)', false]], TMAP = {};
  TUNE.forEach(function (t) { cfg[t[0]] = t[2]; TMAP[t[0]] = t; });
  TOGGLES.forEach(function (t) { cfg[t[0]] = t[2]; });
  var TESTKEYS = [['1', 'super ammo pickup'], ['2', 'heart'], ['3', 'coin row'], ['4', 'low barrier'], ['5', 'high bar'], ['6', 'block'], ['7', 'pit'], ['8', 'fire/laser strip'], ['9', 'moving block'], ['F', 'fork'], ['L', 'level up'], ['K', 'refill ammo + shield'], ['G', 'toggle god mode']];
  function clampT(k, v) { var t = TMAP[k]; v = +v; if (!isFinite(v)) return t[2]; return Math.max(t[3], Math.min(t[4], v)); }
  try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); for (var k in cfg) if (o[k] !== undefined && typeof o[k] === typeof cfg[k]) cfg[k] = o[k]; } catch (e) {}
  cfg.godMode = false; // never carry god mode over a reload (demo safety)
  if (o && o.speedMax === 22) cfg.speedMax = 16; // old default was too fast for the gesture sensor
  TUNE.forEach(function (t) { cfg[t[0]] = clampT(t[0], cfg[t[0]]); });
  if (cfg.duckMode !== 'slide') cfg.duckMode = 'hold';
  cfg.slideMs = Math.max(400, Math.min(1500, +cfg.slideMs || 800));
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }
  var CYCLE = ['left', 'up', 'right', 'down'], NAME = { jump: 'up', duck: 'down' }, BACK = { up: 'jump', down: 'duck', left: 'left', right: 'right' };
  var lastRaw = '-', lastMapped = '-', lastSrc = '-', lastNote = '', lastBySrc = {};

  function mapMove(m) {
    var d = NAME[m] || m, i = CYCLE.indexOf(d);
    if (i >= 0) {
      d = CYCLE[(i + cfg.rot / 90) % 4];
      if (cfg.mirror) { if (d === 'left') d = 'right'; else if (d === 'right') d = 'left'; }
      return BACK[d];
    }
    if (cfg.mirror) { if (m === 'track') return 'track_prev'; if (m === 'track_prev') return 'track'; }
    return m;
  }
  function applySpeed() { if (window.game) window.game.speedMul = cfg.speed; }

  var g = window.game;
  if (g && typeof g.input === 'function' && !g.__settingsWrapped) {
    var orig = g.input;
    g.input = function (move, source) {
      if (move === 'pause') { lastRaw = 'pause'; lastMapped = 'pause'; lastSrc = source || 'unknown'; lastNote = 'sent'; render(); return orig.call(g, move, source); }
      if (source === 'keyboard' || source === 'touch' || source === 'ai') return orig.call(g, move, source);
      var mapped = mapMove(move), now = Date.now(), s = source || 'unknown';
      lastRaw = String(move); lastSrc = s;
      if (move !== 'start' && cfg.cool > 0 && lastBySrc[s] && now - lastBySrc[s] < cfg.cool) {
        lastMapped = mapped; lastNote = 'dropped (cooldown)'; render(); return;
      }
      lastBySrc[s] = now; lastMapped = mapped; lastNote = 'sent'; render();
      return orig.call(g, mapped, source);
    };
    g.__settingsWrapped = true;
  }
  applySpeed();

  // ---- UI ----
  var css = document.createElement('style');
  css.textContent =
    '#bmgear{position:fixed;top:8px;left:8px;width:48px;height:48px;border-radius:24px;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:26px;line-height:48px;text-align:center;z-index:40;cursor:pointer;padding:0;touch-action:manipulation}' +
    '#bmset{position:fixed;top:0;left:0;bottom:0;width:min(420px,100vw);box-sizing:border-box;overflow:auto;padding:16px;background:rgba(10,12,20,.88);color:#e8f0ff;font:16px/1.3 system-ui,Arial,sans-serif;z-index:50;display:none;touch-action:pan-y}' +
    '#bmset h3{margin:0 0 12px;font-size:20px;display:flex;justify-content:space-between;align-items:center}' +
    '#bmset .lbl{margin:16px 0 6px;color:#9fb4d8;font-weight:700;display:flex;justify-content:space-between}' +
    '#bmset .row{display:flex;gap:8px;flex-wrap:wrap}' +
    '#bmset button{min-height:52px;min-width:52px;flex:1;border:2px solid #3a4666;border-radius:10px;background:#1a2036;color:#fff;font:700 16px system-ui,Arial,sans-serif;cursor:pointer;touch-action:manipulation}' +
    '#bmset button.on{background:#ffd24a;color:#111;border-color:#ffd24a}' +
    '#bmset input[type=range]{width:100%;height:40px;accent-color:#ffd24a}' +
    '#bmset .test{margin-top:16px;padding:12px;border-radius:10px;background:#000;font:15px/1.5 ui-monospace,Menlo,monospace}' +
    '#bmset .test b{color:#ffd24a}' +
    '#bmset details{margin-top:16px;border:1px solid #3a4666;border-radius:10px;padding:0 12px 12px}#bmset summary{min-height:48px;line-height:48px;font-weight:700;color:#9fb4d8;cursor:pointer}#bmset .tk{display:grid;grid-template-columns:40px 1fr;gap:4px 8px;font:15px/1.4 ui-monospace,Menlo,monospace}#bmset .tk b{color:#ffd24a}';
  document.head.appendChild(css);

  var gear = document.createElement('button'); gear.id = 'bmgear'; gear.textContent = '⚙'; gear.title = 'Settings (S)'; gear.setAttribute('aria-label', 'Settings');
  var panel = document.createElement('div'); panel.id = 'bmset';
  document.body.appendChild(gear); document.body.appendChild(panel);
  var open = false, tuneOpen = false;

  function esc(x) { return String(x).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function btn(act, val, label, on) { return '<button data-a="' + act + '" data-v="' + val + '"' + (on ? ' class="on"' : '') + '>' + label + '</button>'; }
  function build() {
    var vol = window.sfx ? Math.round(window.sfx.getVolume() * 100) : 60, muted = window.sfx && window.sfx.isMuted();
    var board = !window.BM_OFFLINE && !!(window.boardSocket && window.boardSocket.connected); // live voice runs on the board
    var dbgUrl = /[?&]debug(=|&|$)/.test(location.search); // test keys and god mode only with ?debug
    function boardOnly(k) { return (!board && (k === 'liveVoice' || k === 'liveMax')) || (!dbgUrl && k === 'godMode'); }
    var h = '<h3>Settings <button data-a="close" data-v="" style="flex:none;min-width:72px">Close</button></h3>';
    h += '<div class="lbl"><span>Sensor rotation</span></div><div class="row">';
    [0, 90, 180, 270].forEach(function (r) { h += btn('rot', r, r + '°', cfg.rot === r); });
    h += '</div><div class="lbl"><span>Mirror left/right</span></div><div class="row">' + btn('mirror', 0, 'Off', !cfg.mirror) + btn('mirror', 1, 'On', cfg.mirror) + '</div>';
    h += '<div class="lbl"><span>Cooldown</span><span id="bm-cool-v">' + cfg.cool + ' ms</span></div><input type="range" id="bm-cool" min="0" max="800" step="10" value="' + cfg.cool + '">';
    h += '<div class="lbl"><span>Game speed</span><span id="bm-speed-v">' + cfg.speed.toFixed(2) + 'x</span></div><input type="range" id="bm-speed" min="0.7" max="1.5" step="0.05" value="' + cfg.speed + '">';
    var sx = window.sfx, mv = sx && sx.getMusicVolume ? Math.round(sx.getMusicVolume() * 100) : 35, mo = sx && sx.isMusicEnabled ? sx.isMusicEnabled() : true;
    h += '<div class="lbl"><span>Duck mode</span></div><div class="row">' + btn('duck', 'hold', 'Hold', cfg.duckMode === 'hold') + btn('duck', 'slide', 'Slide', cfg.duckMode === 'slide') + '</div>';
    h += '<div class="lbl"><span>Slide duration</span><span id="bm-slide-v">' + cfg.slideMs + ' ms</span></div><input type="range" id="bm-slide" min="400" max="1500" step="50" value="' + cfg.slideMs + '">';
    h += '<div class="lbl"><span>Music</span></div><div class="row">' + btn('music', 0, 'Off', !mo) + btn('music', 1, 'On', mo) + '</div>';
    var sn = sx && sx.songName ? sx.songName() : '-', mc = sx && sx.getMusicCycle ? sx.getMusicCycle() : 90;
    h += '<div class="lbl"><span>Song</span><span id="bm-song-v">' + esc(sn) + '</span></div><div class="row">' + btn('song', -1, '&#9664; Prev (B)', false) + btn('song', 1, 'Next (N) &#9654;', false) + '</div>';
    h += '<div class="lbl"><span>Song cycle</span><span id="bm-mcycle-v">' + (mc > 0 ? mc + ' s' : 'Off') + '</span></div><input type="range" id="bm-mcycle" min="0" max="300" step="15" value="' + mc + '">';
    h += '<div class="lbl"><span>Music volume</span><span id="bm-mvol-v">' + mv + '%</span></div><input type="range" id="bm-mvol" min="0" max="100" step="5" value="' + mv + '">';
    h += '<div class="lbl"><span>Sound effects volume</span><span id="bm-vol-v">' + vol + '%</span></div><input type="range" id="bm-vol" min="0" max="100" step="5" value="' + vol + '">';
    h += '<div class="row" style="margin-top:8px">' + btn('mute', 0, muted ? 'Unmute (M)' : 'Mute (M)', muted) + btn('beep', 0, 'Test sound', false) + '</div>';
    h += '<details id="bm-tune"' + (tuneOpen ? ' open' : '') + '><summary>Game tuning</summary>';
    TUNE.forEach(function (t) {
      if (boardOnly(t[0])) return;
      h += '<div class="lbl"><span>' + t[1] + '</span><span id="bm-t-' + t[0] + '-v">' + cfg[t[0]] + t[6] + '</span></div><input type="range" data-t="' + t[0] + '" min="' + t[3] + '" max="' + t[4] + '" step="' + t[5] + '" value="' + cfg[t[0]] + '">';
    });
    TOGGLES.forEach(function (t) { if (boardOnly(t[0])) return; h += '<div class="lbl"><span>' + t[1] + '</span></div><div class="row">' + btn('tog:' + t[0], 0, 'Off', !cfg[t[0]]) + btn('tog:' + t[0], 1, 'On', cfg[t[0]]) + '</div>'; });
    h += '<div class="row" style="margin-top:16px">' + btn('reset', 0, 'Reset to defaults', false) + '</div></details>';
    if (dbgUrl) {
      h += '<details><summary>Test keys</summary><div class="tk">';
      TESTKEYS.forEach(function (t) { h += '<b>' + t[0] + '</b><span>' + t[1] + '</span>'; });
      h += '</div></details>';
    }
    h += '<div class="lbl"><span>Test: make a gesture</span></div><div class="test" id="bm-test"></div>';
    h += '<div class="lbl" style="font-weight:400">Rotation cycles left, up, right, down. Rotate, then mirror. Keys: S panel, M mute, N/B next/prev song.</div>';
    panel.innerHTML = h;
    render();
  }
  function render() {
    var t = document.getElementById('bm-test'); if (!t || !open) return;
    t.innerHTML = 'source <b>' + esc(lastSrc) + '</b><br>raw <b>' + esc(lastRaw) + '</b> &rarr; mapped <b>' + esc(lastMapped) + '</b><br>' + esc(lastNote || 'waiting...');
  }
  var prevPaused = false;
  function setOpen(on) {
    if (on === open) return;
    open = on; panel.style.display = on ? 'block' : 'none';
    if (window.game) { if (on) { prevPaused = !!window.game.paused; window.game.paused = true; } else window.game.paused = prevPaused; }
    if (on) build();
  }
  // keep panel events away from the game's window-level touch/keyboard handlers
  ['touchstart', 'touchend', 'mousedown', 'click'].forEach(function (ev) {
    panel.addEventListener(ev, function (e) { e.stopPropagation(); }, ev.indexOf('touch') === 0 ? { passive: true } : false);
    gear.addEventListener(ev, function (e) { e.stopPropagation(); }, ev.indexOf('touch') === 0 ? { passive: true } : false);
  });
  panel.addEventListener('keydown', function (e) { if (e.key !== 's' && e.key !== 'S' && e.key !== 'Escape' && e.key !== 'm' && e.key !== 'M') e.stopPropagation(); });
  gear.addEventListener('click', function () { setOpen(!open); gear.blur(); });
  panel.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
    var a = b.getAttribute('data-a'), v = b.getAttribute('data-v');
    if (a === 'close') { setOpen(false); return; }
    if (a === 'reset') { TUNE.forEach(function (t) { cfg[t[0]] = t[2]; }); TOGGLES.forEach(function (t) { cfg[t[0]] = t[2]; }); }
    else if (a.indexOf('tog:') === 0) cfg[a.slice(4)] = v === '1';
    else if (a === 'rot') cfg.rot = +v;
    else if (a === 'mirror') cfg.mirror = v === '1';
    else if (a === 'duck') cfg.duckMode = v === 'slide' ? 'slide' : 'hold';
    else if (a === 'music' && window.sfx && window.sfx.setMusicEnabled) window.sfx.setMusicEnabled(v === '1');
    else if (a === 'song' && window.sfx && window.sfx.nextSong) { if (v === '-1') window.sfx.prevSong(); else window.sfx.nextSong(); return; }
    else if (a === 'mute' && window.sfx) window.sfx.toggleMute();
    else if (a === 'beep' && window.sfx) { window.sfx.play('jump'); return; }
    var d = document.getElementById('bm-tune'); if (d) tuneOpen = d.open;
    save(); build();
  });
  panel.addEventListener('input', function (e) {
    var id = e.target.id, v = +e.target.value, el;
    if (id === 'bm-cool') { cfg.cool = v; el = document.getElementById('bm-cool-v'); if (el) el.textContent = v + ' ms'; }
    else if (id === 'bm-speed') { cfg.speed = v; applySpeed(); el = document.getElementById('bm-speed-v'); if (el) el.textContent = v.toFixed(2) + 'x'; }
    else if (e.target.getAttribute && e.target.getAttribute('data-t')) { var tk = e.target.getAttribute('data-t'); cfg[tk] = clampT(tk, v); el = document.getElementById('bm-t-' + tk + '-v'); if (el) el.textContent = cfg[tk] + TMAP[tk][6]; }
    else if (id === 'bm-slide') { cfg.slideMs = v; el = document.getElementById('bm-slide-v'); if (el) el.textContent = v + ' ms'; }
    else if (id === 'bm-mvol' && window.sfx && window.sfx.setMusicVolume) { window.sfx.setMusicVolume(v / 100); el = document.getElementById('bm-mvol-v'); if (el) el.textContent = v + '%'; return; }
    else if (id === 'bm-mcycle' && window.sfx && window.sfx.setMusicCycle) { window.sfx.setMusicCycle(v); el = document.getElementById('bm-mcycle-v'); if (el) el.textContent = v > 0 ? v + ' s' : 'Off'; return; }
    else if (id === 'bm-vol' && window.sfx) { window.sfx.setVolume(v / 100); el = document.getElementById('bm-vol-v'); if (el) el.textContent = v + '%'; return; }
    else return;
    save();
  });
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 's' || e.key === 'S') { setOpen(!open); }
    else if (e.key === 'Escape' && open) setOpen(false);
  });
  function full() {
    var sx = window.sfx, o = {}; for (var k in cfg) o[k] = cfg[k];
    o.musicOn = sx && sx.isMusicEnabled ? sx.isMusicEnabled() : true;
    o.musicVol = sx && sx.getMusicVolume ? sx.getMusicVolume() : 0.35;
    o.sfxVol = sx && sx.getVolume ? sx.getVolume() : 0.6;
    o.musicCycleSec = sx && sx.getMusicCycle ? sx.getMusicCycle() : 90;
    o.song = sx && sx.songName ? sx.songName() : '';
    return o;
  }
  function setKey(k, v) {
    if (TMAP[k]) cfg[k] = clampT(k, v);
    else if (k === 'trapsOn' || k === 'godMode' || k === 'voiceOn' || k === 'crowdOn' || k === 'liveComm' || k === 'liveVoice') cfg[k] = !!v;
    else return false;
    save(); if (open) { var d = document.getElementById('bm-tune'); if (d) tuneOpen = d.open; build(); }
    return true;
  }
  window.addEventListener('sfx:song', function (e) { var el = document.getElementById('bm-song-v'); if (el && e.detail) el.textContent = e.detail.name; });
  window.settings = { get: full, map: mapMove, open: setOpen, set: setKey };
})();
