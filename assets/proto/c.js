(function () {
  var cv = document.getElementById('c'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, scan = null, vig = null;
  var FONT = 'ui-monospace,Menlo,Consolas,"Courier New",monospace';
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    scan = document.createElement('canvas'); scan.width = 1; scan.height = 4;
    var sg = scan.getContext('2d'); sg.fillStyle = 'rgba(0,0,0,.28)'; sg.fillRect(0, 2, 1, 2);
    vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.7)');
  }
  window.addEventListener('resize', resize); resize();

  // a = near/magenta line color, b = cyan, sun gradient top->bottom, obs/bar/blk neon, sky glow
  var THEMES = [
    { a: '#ff2bd6', b: '#19e8ff', s1: '#ffe14a', s2: '#ff2b8a', obs: '#ff3d81', bar: '#19e8ff', blk: '#b36bff', sky: '#2a0044' },
    { a: '#19e8ff', b: '#3d6bff', s1: '#9bfff0', s2: '#2b6bff', obs: '#ffd23d', bar: '#ff2bd6', blk: '#19ffa0', sky: '#001a44' },
    { a: '#a6ff2b', b: '#ff8a1c', s1: '#fff35a', s2: '#ff4a1c', obs: '#ff2b5a', bar: '#a6ff2b', blk: '#ffb31c', sky: '#2a1400' }
  ];
  var track = 0, state = 'start', score = 0, dist = 0, speed = 7, hi = 0;
  var lane = 1, px = 1, jumpT = -1, ducking = false, obs = [], nextSpawn = 14, lastIn = '', lastInT = 0, lastReport = 0, deadT = 0, hitFlash = 0;
  var forkIn = 25, forkChoice = null, turnT = 0, turnDir = 0, TURN_D = 0.4, paused = false, extPause = false, sliding = false, slideLeft = 0, gt = 0, lastIntensityT = 0;
  var laneChg = { t: -9, from: 1, to: 1 }, act = { t: -9, type: '' }, nmLast = -9, nmChain = 0, nmEnd = 0, mode = 'HOLD';
  var JD = 0.8, hy = 0, by = 0, combo = 0, pops = [], trail = [], lastSpeedTier = 0, shake = 0;
  // round 3: fork types, crash anim, coins, traps, levels
  var forkType = 'split', forkWin = 3, turnPend = -1, crashT = 0, CRASH_D = 0.6, crashWhy = '', crashDir = 1, redFlash = 0;
  var coins = [], coinN = 0, parts = [], level = 1, LVL = [10, 14, 18, 22, 26, 30, 35, 40], BEST_K = 'neongrid.best';
  TURN_D = 0.9;
  // round 5: time-based levels, smooth forks (bend + cross-fade), moving traps, hearts, ship anims
  var LVT = [20, 45, 75, 105, 135, 165, 200, 240], K_B = 0.015, bendDir = 0, bOn = false, bFd = 999, bAmp = 0, fa = 0;
  var fadeFrom = 0, fadeK = 1, turnDist0 = 0, tOL = true, tOR = true, tCL = '#fff', tCR = '#fff', heartIn = 50, landT = -9, slideEndT = -9, shootT = -9;
  function ease(q) { q = Math.max(0, Math.min(1, q)); return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  var THX = THEMES.map(function (t) { var o = {}; for (var k in t) o[k] = hex(t[k]); return o; });
  function mixT() {
    if (fadeK >= 1 || fadeFrom === track) return THEMES[track];
    var a = THX[fadeFrom], b = THX[track], k = ease(fadeK), o = {};
    for (var key in a) { var p = a[key], q = b[key]; o[key] = 'rgb(' + Math.round(p[0] + (q[0] - p[0]) * k) + ',' + Math.round(p[1] + (q[1] - p[1]) * k) + ',' + Math.round(p[2] + (q[2] - p[2]) * k) + ')'; }
    return o;
  }
  // round 4: lives, shooting
  var lives = 3, invT = 0, ammo = 3, ammoT = 0, AMMO_MAX = 3, AMMO_RE = 15, slowT = 0, SLOW_D = 1.2, cannonT = 0, bolts = [], rings = [], RANGE = 42, lifeLost = -9999, shieldT = 0, shieldCD = 0, SHIELD_D = 3, SHIELD_RE = 45;
  try { hi = +localStorage.getItem(BEST_K) || 0; } catch (e) {}
  // tuning: read live from window.settings at point of use, missing key = default
  function tune(k, d) { try { var v = window.settings && window.settings.get && window.settings.get()[k]; return v === undefined || v === null || v === '' ? d : v; } catch (e) { return d; } }
  function tnum(k, d) { var v = +tune(k, d); return isFinite(v) ? v : d; }
  function ammoMax() { return Math.max(1, Math.round(tnum('ammoMax', 3))); }
  function maxLives() { return Math.max(1, Math.round(tnum('startLives', 3))); }
  var godLocal = false;
  function godOn() { var v = tune('godMode', godLocal); return v === true || v === 'true' || v === 1; }
  var superAmmo = 0, superIn = 75, slowLen = 1.2, shieldLen = 6, shieldReLen = 45;
  function jit(avg) { return avg * (0.8 + Math.random() * 0.4); }
  function inWin() { return forkIn <= forkWin && crashT <= 0; }
  function newFork() {
    forkIn = Math.max(6, tnum('forkEvery', 27) * (0.75 + Math.random() * 0.5)); forkChoice = null;
    var pSingle = Math.min(0.75, 0.2 + Math.max(0, speed - 7) / 40);
    forkType = Math.random() < pSingle ? (Math.random() < 0.5 ? 'L' : 'R') : 'split';
    forkWin = Math.max(2, 3 - (level - 1) * 0.15);
  }
  function isOpen(side) { return forkType === 'split' || (forkType === 'L' ? side === 'left' : side === 'right'); }

  function sfx(n) { try { window.sfx && window.sfx.play(n); } catch (e) {} }
  function music(on) { try { if (window.sfx && window.sfx.music) window.sfx.music(on); } catch (e) {} }
  function slowmo(on) { try { if (window.sfx && window.sfx.slowmo) window.sfx.slowmo(on); } catch (e) {} }
  function duckMusic(on) { try { if (window.sfx && window.sfx.duck) window.sfx.duck(on); } catch (e) {} }
  function duckMode() { try { var c = window.settings && window.settings.get && window.settings.get(); return c && c.duckMode === 'slide' ? 'slide' : 'hold'; } catch (e) { return 'hold'; } }
  function slideMs() { try { var v = +window.settings.get().slideMs; return v >= 400 && v <= 1500 ? v : 800; } catch (e) { return 800; } }
  function setPause(on, ext) {
    on = !!on; if (on === paused) return;
    if (on && state !== 'running') return;
    paused = on; extPause = on && !!ext; duckMusic(on); sfx(on ? 'pause' : 'resume'); report(true);
  }
  function layout() { hy = H * 0.4; by = H * 0.9; }
  function report(force) {
    var now = Date.now();
    if (!force && now - lastReport < 500) return;
    lastReport = now;
    try { if (typeof window.onGameState === 'function') window.onGameState({ state: state, score: Math.floor(score), track: track, lives: lives, coins: coinN, level: level, paused: !!paused }); } catch (e) {}
  }
  function reset() {
    score = 0; dist = 0; speed = tnum('speedStart', 6); lane = 1; px = 1; jumpT = -1; ducking = false; obs = []; nextSpawn = 16; lastFree = 1; state = 'running';
    combo = 0; pops = []; trail = []; lastSpeedTier = 0; hitFlash = 0;
    turnT = 0; turnDir = 0; turnPend = -1; crashT = 0; redFlash = 0; coins = []; coinN = 0; parts = []; level = 1; newFork();
    paused = false; extPause = false; duckMusic(false); sliding = false; slideLeft = 0; gt = 0; lastIntensityT = 0;
    laneChg = { t: -9, from: 1, to: 1 }; act = { t: -9, type: '' }; nmLast = -9; nmChain = 0; nmEnd = 0;
    lives = maxLives(); invT = 0; shieldT = 0; shieldCD = 0; ammo = ammoMax(); superAmmo = 0; superIn = jit(tnum('superEvery', 75)); ammoT = 0; cannonT = 0; bolts = []; rings = []; deathCause = ''; if (slowT > 0) slowmo(false); slowT = 0;
    bendDir = 0; bOn = false; fadeFrom = track; fadeK = 1; heartIn = jit(tnum('heartEvery', 50)); landT = -9; slideEndT = -9; shootT = -9;
    music(true);
    report(true);
  }
  var deathCause = '';
  function die(why) { crashT = 0; lives = 0; if (slowT > 0) slowmo(false); slowT = 0; bolts = []; deathCause = why || ''; state = 'dead'; paused = false; sliding = false; duckMusic(false); music(false); deadT = performance.now(); hitFlash = 1; shake = 1; feelHit(); combo = 0; if (score > hi) { hi = score; try { localStorage.setItem(BEST_K, String(Math.floor(hi))); } catch (e) {} } sfx('hit'); setTimeout(function () { sfx('dead'); }, 150); report(true); }
  // 0 = ignored (invulnerable), 1 = lost a life, 2 = game over
  function hurt(why) {
    if (shieldT > 0) return 3;
    if (invT > 0) return 0;
    if (godOn()) return 0;
    lives--; deathCause = why || '';
    if (lives <= 0) { die(why); return 2; }
    redFlash = 1; shake = 0.8; invT = 2; combo = 0; lifeLost = performance.now(); feelHit();
    sfx('hurt'); pop('-1 LIFE', '#ff2b5a'); spark(X(px, 1), by - lw() * 0.5, '#ff2b5a', 18);
    return 1;
  }
  function shieldOn() {
    if (shieldCD > 0) { show('SHIELD ' + Math.ceil(shieldCD) + 's'); sfx('lane'); return; }
    shieldLen = tnum('shieldSec', 6); shieldReLen = tnum('shieldCooldown', 45); shieldT = shieldLen; shieldCD = shieldReLen; invT = Math.max(invT, shieldLen); show('SHIELD');
    sfx('shield');
    pop('SHIELD ' + (+shieldLen.toFixed(1)) + 's', '#19e8ff'); spark(X(px, 1), by - lw() * 0.5, '#19e8ff', 16);
  }
  function shieldBreak(o) {
    var s = sc(Math.max(0, o.d)), ex = X(o.type === 'mover' ? o.lane : px, s), ey = Y(s) - lw() * 0.8 * s * 0.6;
    spark(ex, ey, '#19e8ff', 22); spark(ex, ey, '#ffffff', 10);
    rings.push({ x: ex, y: ey, r: lw() * s, born: performance.now() });
    score += 10; pop('SHIELD BREAK +10', '#19e8ff'); shake = Math.max(shake, 0.25); feelBoom(ex, ey);
    setTimeout(function () { sfx('explode'); }, 60);
  }
  function shoot() {
    var sup = superAmmo > 0;
    if (!sup && ammo < 1) { show('NO AMMO'); sfx('lane'); return; }
    if (sup) superAmmo--; else ammo--;
    slowLen = tnum('slowmoSec', 1.2); slowT = slowLen; cannonT = slowLen; shootT = performance.now(); slowmo(true); sfx('shoot'); show('FIRE');
    var tgt = null, cand = [];
    obs.forEach(function (o) {
      if (o.d <= 0.3 || o.d > RANGE) return;
      if (o.gone || o.heart) return;
      var hitL = (o.type === 'pit' || o.type === 'laser') ? inSpan(o, lane) : Math.abs(o.lane - lane) < 0.7;
      if (hitL) cand.push(o);
    });
    cand.sort(function (a, b) { return a.d - b.d; });
    tgt = cand[0] || null;
    // super ammo: pierce up to 3 obstacles in lane, chained explosions
    bolts.push({ lane: lane, d: 0, tgt: tgt, sup: sup, rest: sup ? cand.slice(1, 3) : [], kills: 0 });
    if (sup) { show('SUPER SHOT'); pop('SUPER SHOT', '#ff2bd6'); }
  }
  function boom(o, bl) {
    var i = obs.indexOf(o); if (i >= 0) obs.splice(i, 1);
    var s = sc(Math.max(0, o.d)), ex = X(o.type === 'mover' ? o.lane : (o.type === 'pit' || o.type === 'laser') ? bl : o.lane, s), ey = Y(s) - lw() * 0.8 * s * 0.6;
    spark(ex, ey, '#ff2bd6', 26); spark(ex, ey, '#19e8ff', 26); spark(ex, ey, '#ffe14a', 18); spark(ex, ey, '#ffffff', 10);
    rings.push({ x: ex, y: ey, r: lw() * s, born: performance.now() });
    score += 20; pop('BOOM +20', '#ff2bd6'); shake = Math.max(shake, 0.35); feelBoom(ex, ey);
    setTimeout(function () { sfx('explode'); }, 60);
  }
  function show(t) { lastIn = t; lastInT = performance.now(); }
  function pop(t, col) { pops.push({ t: t, c: col, born: performance.now() }); if (pops.length > 4) pops.shift(); }

  var inLog = [], lastInWall = 0, sensors = {}, dbgOn = false, fps = 0;
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function hms(t) { var d = new Date(t); return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '.' + pad(d.getMilliseconds(), 3); }
  function input(m, source) {
    source = source || 'keyboard';
    lastInWall = Date.now(); inLog.unshift({ t: lastInWall, m: String(m), s: String(source) }); if (inLog.length > 10) inLog.length = 10;
    inputInner(m);
  }
  function debug(data) {
    if (!data || typeof data !== 'object') return;
    var now = Date.now();
    Object.keys(data).forEach(function (k) { sensors[k] = { v: data[k], t: now }; });
  }
  function inputInner(m) {
    if (m === 'track' || m === 'track_prev') {
      if (state === 'running') {
        if (!paused && inWin()) { forkChoice = m === 'track' ? 'right' : 'left'; show(forkChoice === 'right' ? 'RIGHT >' : '< LEFT'); sfx('lane'); }
        return;
      }
      track = (track + (m === 'track' ? 1 : 2)) % 3; show('TRACK ' + (track + 1)); sfx('track'); report(true); return;
    }
    if (m === 'pause') { if (state === 'running' && !extPause && crashT <= 0) setPause(!paused); return; }
    if (m === 'start') { if (paused) { if (!extPause) setPause(false); return; } if (state !== 'running') { reset(); sfx('start'); } show('START'); return; }
    if (state !== 'running' || paused || crashT > 0) return;
    if (m === 'shoot') { shoot(); return; }
    if (m === 'shield') { shieldOn(); return; }
    if ((m === 'left' || m === 'right') && inWin()) { forkChoice = m; show(m === 'right' ? 'RIGHT >' : '< LEFT'); sfx('lane'); return; }
    if (m === 'left') { if (lane > 0) { sfx('lane'); laneChg = { t: gt, from: lane, to: lane - 1 }; } lane = Math.max(0, lane - 1); show('LEFT'); }
    else if (m === 'right') { if (lane < 2) { sfx('lane'); laneChg = { t: gt, from: lane, to: lane + 1 }; } lane = Math.min(2, lane + 1); show('RIGHT'); }
    else if (m === 'jump') {
      if (sliding) { sliding = false; ducking = false; slideLeft = 0; jumpT = 0; act = { t: gt, type: 'jump' }; sfx('jump'); show('JUMP'); }
      else if (ducking) { ducking = false; show('STAND'); sfx('stand'); }
      else { if (jumpT < 0) { jumpT = 0; act = { t: gt, type: 'jump' }; sfx('jump'); } else fj.buf = performance.now(); show('JUMP'); }
    }
    else if (m === 'duck') {
      if (jumpT < 0) {
        if (duckMode() === 'slide') { if (!sliding) { sliding = true; slideLeft = slideMs() / 1000; ducking = true; act = { t: gt, type: 'duck' }; sfx('slide'); } }
        else { if (!ducking) { sfx('duck'); act = { t: gt, type: 'duck' }; } ducking = true; }
      }
      show(duckMode() === 'slide' ? 'SLIDE' : 'DUCK');
    }
  }
  window.game = { input: input, debug: debug };
  Object.defineProperty(window.game, 'paused', { get: function () { return paused; }, set: function (v) { if (v) setPause(true, true); else if (extPause) setPause(false); }, enumerable: true });

  // test keys (contract "Tuning and test keys"): spawn ~3 s ahead in current lane, only while running
  function testKey(k) {
    var kk = String(k).toUpperCase();
    if ('123456789LKG'.indexOf(kk) < 0 || kk.length !== 1) return false;
    if (state !== 'running' || paused || crashT > 0) return true;
    var d = Math.max(12, Math.min(68, speed * 3)), L = lane, nm = '', o;
    if (kk === '1') { coins.push({ lane: L, d: d, h: 0, coin: true, sup: true, sp: 0 }); nm = 'SUPER AMMO'; }
    else if (kk === '2') { coins.push({ lane: L, d: d, h: 0, coin: true, heart: true, sp: 0 }); nm = 'HEART'; }
    else if (kk === '3') { for (var i = 0; i < 5; i++) coins.push({ lane: L, d: d + i * 2.5, h: 0, coin: true, sp: Math.random() * 6 }); nm = 'COIN ROW'; }
    else if (kk === '4' || kk === '5') { [0, 1, 2].forEach(function (l) { obs.push({ lane: l, d: d, type: kk === '4' ? 'low' : 'high' }); }); nm = kk === '4' ? 'LOW BARRIER' : 'HIGH BAR'; }
    else if (kk === '6') { obs.push({ lane: L, d: d, type: 'block' }); nm = 'BLOCK'; }
    else if (kk === '7') { obs.push({ type: 'pit', lanes: [L], l0: L, l1: L, off: 0, lane: L, d: d, len: 2.6, trap: true }); nm = 'PIT'; }
    else if (kk === '8') { obs.push({ type: 'laser', l0: 0, l1: 2, off: 0, lane: 1, d: d, ph: 0, trap: true }); nm = 'LASER STRIP'; }
    else if (kk === '9') { o = { type: 'mover', l0: L, l1: L, off: 0, lane: L, d: d, trap: true }; setMove(o); obs.push(o); nm = 'MOVING BLOCK'; }
    else if (kk === 'L') { level = Math.min(LVT.length + 1, level + 1); sfx('speedup'); lvlT = performance.now(); lvlMsg = 'TEST'; nm = 'LEVEL ' + level; }
    else if (kk === 'K') { ammo = ammoMax(); ammoT = 0; shieldCD = 0; nm = 'REFILL'; }
    else if (kk === 'G') {
      var cur = godOn();
      try { if (window.settings && typeof window.settings.set === 'function') window.settings.set('godMode', !cur); else godLocal = !cur; } catch (e) { godLocal = !cur; }
      if (godOn() === cur) godLocal = !cur;
      nm = 'GOD ' + (godOn() ? 'ON' : 'OFF');
    }
    pop('TEST: ' + nm, '#19ffa0'); show(nm);
    return true;
  }
  window.addEventListener('keydown', function (e) {
    var k = e.key, m = null;
    if ((k === 'd' || k === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) { setDbg(!dbgOn); return; }
    if (k === 'p' || k === 'P' || k === 'Escape') {
      var tg = e.target;
      if (tg && tg !== document.body && tg !== document.documentElement && tg !== document && tg.tagName !== 'CANVAS') return;
      if (!e.repeat) input('pause', 'keyboard');
      e.preventDefault(); return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && testKey(k)) { e.preventDefault(); return; }
    if ((k === 'f' || k === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) { if (state === 'running' && !paused) { var tgt = 4.5; if (forkIn > tgt) { forkIn = tgt; show('FORK SOON'); } } return; }
    if (k === 'q' || k === 'Q') m = 'track_prev'; else if (k === 'e' || k === 'E') m = 'track';
    else if (k === 'ArrowLeft') m = 'left'; else if (k === 'ArrowRight') m = 'right';
    else if (k === 'ArrowUp') m = 'jump'; else if (k === 'ArrowDown') m = 'duck';
    else if (k === 'x' || k === 'X') m = 'shoot'; else if (k === 'z' || k === 'Z') m = 'shield';
    else if (k === 'Enter') m = state === 'running' && !paused ? 'shoot' : 'start';
    else if (k === ' ') m = 'start';
    else if (k === 't' || k === 'T') m = 'track'; else if (k === 'r' || k === 'R') m = 'track_prev';
    if (m) { e.preventDefault(); input(m, 'keyboard'); }
  });
  var tx = 0, ty = 0;
  window.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { input('start', 'touch'); return; }
    if (Math.abs(dx) > Math.abs(dy)) input(dx > 0 ? 'right' : 'left', 'touch'); else input(dy < 0 ? 'jump' : 'duck', 'touch');
  });

  var panel = document.getElementById('dbg') || document.createElement('div'); panel.id = 'dbg'; panel.style.display = 'none'; document.body.appendChild(panel);
  function setDbg(on) {
    dbgOn = on; panel.style.display = on ? 'block' : 'none';
    try { localStorage.setItem('dbg', on ? '1' : '0'); } catch (e) {}
    if (on) renderDbg();
  }
  function esc(x) { return String(x).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function renderDbg() {
    var now = Date.now(), h = '';
    function row(k, v) { return '<div class="r"><span class="k">' + k + '</span><span>' + esc(v) + '</span></div>'; }
    h += '<b>DEBUG</b> (D)';
    h += row('fps', fps.toFixed(0)) + row('state', state) + row('score', Math.floor(score)) + row('speed', speed.toFixed(2));
    h += row('lane', lane) + row('jump', jumpT >= 0 ? 'ACTIVE' : '-') + row('duck', ducking ? 'DUCKING' : 'standing') + row('track', track) + row('combo', combo) + row('level', level) + row('coins', coinN) + row('lives', lives + (invT > 0 ? ' (inv ' + invT.toFixed(1) + ')' : '')) + row('ammo', ammo + ' +' + ammoT.toFixed(1) + 's') + row('slowmo', slowT > 0 ? slowT.toFixed(2) : '-') + row('fork', forkType + ' in ' + forkIn.toFixed(1) + 's win ' + forkWin.toFixed(2));
    h += row('god', godOn() ? 'ON' : 'off') + row('super', superAmmo + ' next ' + superIn.toFixed(0) + 's') + row('heart in', heartIn.toFixed(0) + 's');
    h += '<div>Test keys: 1 super 2 heart 3 coins 4 low 5 high 6 block 7 pit 8 laser 9 mover F fork L level K refill G god</div>';
    h += row('last input', lastInWall ? (now - lastInWall) + ' ms ago' : 'never');
    h += '<b>Input log</b>';
    if (!inLog.length) h += '<div>none</div>';
    inLog.forEach(function (e) { h += '<div>' + hms(e.t) + ' ' + esc(e.m) + ' <i>' + esc(e.s) + '</i></div>'; });
    h += '<b>Sensors</b>';
    var ks = Object.keys(sensors);
    if (!ks.length) h += '<div>no data</div>';
    ks.forEach(function (k) {
      var o = sensors[k], age = now - o.t, v = o.v;
      if (v && typeof v === 'object') { try { v = JSON.stringify(v); } catch (e) {} }
      h += '<div class="r' + (age > 2000 ? ' st' : '') + '"><span class="k">' + esc(k) + '</span><span>' + esc(v) + ' <i>' + age + 'ms</i></span></div>';
    });
    panel.innerHTML = h;
  }
  var fpsAcc = 0, fpsN = 0, dbgT = 0;
  try { if (localStorage.getItem('dbg') === '1') dbgOn = true; } catch (e) {}
  if (/[?&]debug=1(&|$)/.test(location.search)) dbgOn = true;
  if (dbgOn) { panel.style.display = 'block'; }

  var spawnExtra = 0, lastFree = 1;
  function reactS() { return Math.max(0.6, Math.min(2.0, tnum('reactSec', 1.1))); }
  function spawn() {
    spawnExtra = 0;
    var SD = Math.max(70, speed * 1.8), arr = SD / Math.max(speed, 1);
    if (arr > forkIn - 4 && arr < forkIn + 1.5) return;
    var r = Math.random(), row = [];
    var trapP = !tune('trapsOn', true) || tune('trapsOn', true) === 'false' ? 0 : level >= 2 ? Math.min(0.45, 0.15 + (level - 2) * 0.06) : 0;
    if (Math.random() < trapP) {
      var tt = ['pit'];
      if (level >= 3) tt.push('laser');
      if (level >= 4) tt.push('mover');
      var tk = tt[Math.floor(Math.random() * tt.length)], mov = level >= 3 && Math.random() < Math.min(0.6, 0.3 + (level - 3) * 0.1), o;
      if (tk === 'pit') {
        var pl = Math.random() < 0.5 ? [Math.floor(Math.random() * 3)] : (Math.random() < 0.5 ? [0, 1] : [1, 2]);
        o = { type: 'pit', lanes: pl, l0: pl[0], l1: pl[pl.length - 1], off: 0, lane: (pl[0] + pl[pl.length - 1]) / 2, d: SD, len: 2.6, trap: true };
        if (mov) setMove(o); obs.push(o);
        if (!mov && Math.random() < 0.3) coinArc(pl[0], SD + 1.3);
      } else if (tk === 'laser') {
        var lp = mov ? (Math.random() < 0.5 ? 0 : 1) : 0;
        o = { type: 'laser', l0: lp, l1: mov ? lp + 1 : 2, off: 0, lane: 1, d: SD, ph: Math.random() * 2, trap: true };
        if (mov) setMove(o); obs.push(o);
        if (Math.random() < 0.15) coinArc(Math.floor(Math.random() * 3), SD);
      } else {
        var ml = Math.floor(Math.random() * 3);
        o = { type: 'mover', l0: ml, l1: ml, off: 0, lane: ml, d: SD, trap: true }; setMove(o); obs.push(o);
      }
      return;
    }
    var type = r < 0.34 ? 'low' : r < 0.6 ? 'high' : 'block';
    if (type === 'block') {
      var n = Math.random() < 0.4 ? 2 : 1, free = Math.max(0, Math.min(2, lastFree + Math.floor(Math.random() * 3) - 1));
      for (var l = 0; l < 3; l++) if (n === 2 ? l !== free : l === free) row.push(l);
      if (n === 1) { row = [Math.floor(Math.random() * 3)]; }
      else lastFree = free;
    } else { row = [0, 1, 2]; }
    row.forEach(function (l) { obs.push({ lane: l, d: SD, type: type }); });
    if (type === 'low' && Math.random() < 0.18) coinArc(Math.floor(Math.random() * 3), SD);
    else if (type === 'block' && Math.random() < 0.3) { var fl = [0, 1, 2].filter(function (l) { return row.indexOf(l) < 0; }); if (fl.length) coinLine(fl[Math.floor(Math.random() * fl.length)], 64, cRow(), 2.2); }
    else if (type === 'high' && Math.random() < 0.2) coinLine(Math.floor(Math.random() * 3), 66, cRow(), 2);
    if (speed > 12 && Math.random() < Math.min(0.55, (speed - 12) / 25) && !((SD + speed * reactS()) / speed > forkIn - 4 && (SD + speed * reactS()) / speed < forkIn + 1.5)) {
      var t2 = Math.random() < 0.5 ? 'low' : 'high', d2 = SD + speed * reactS(); spawnExtra = speed * reactS();
      [0, 1, 2].forEach(function (l) { obs.push({ lane: l, d: d2, type: t2 }); });
    }
  }
  function setMove(o) { o.mv = true; o.dir = o.l1 >= 2 ? -1 : o.l0 <= 0 ? 1 : (Math.random() < 0.5 ? -1 : 1); o.mFrom = 0; o.mTo = 0; o.mStart = -9; o.next = gt + reactS() + Math.random() * 0.6; }
  function stepMove(o) {
    if (!o.mv) return;
    if (gt >= o.next) {
      if (o.l0 + o.mTo + o.dir < 0 || o.l1 + o.mTo + o.dir > 2) o.dir = -o.dir;
      o.mFrom = o.mTo; o.mTo += o.dir; o.mStart = gt; o.next = gt + Math.max(1.3, reactS());
      if (o.l0 + o.mTo + o.dir < 0 || o.l1 + o.mTo + o.dir > 2) o.dir = -o.dir;
    }
    o.off = o.mFrom + (o.mTo - o.mFrom) * ease((gt - o.mStart) / 0.45);
    o.lane = (o.l0 + o.l1) / 2 + o.off;
  }
  function inSpan(o, p) { var a = (o.l0 === undefined ? 0 : o.l0) + (o.off || 0), b = (o.l1 === undefined ? 2 : o.l1) + (o.off || 0); return p > a - 0.5 && p < b + 0.5; }
  function coinOk(d) { var a = d / Math.max(speed, 1); return !(a > forkIn - 2.5 && a < forkIn + 1); }
  function addCoin(l, d, h) { if (coinOk(d)) coins.push({ lane: l, d: d, h: h || 0, coin: true, sp: Math.random() * 6 }); }
  function coinArc(l, d0) { var span = speed * JD, n = 5; for (var i = 0; i < n; i++) addCoin(l, d0 - span / 2 + span * i / (n - 1), Math.sin(Math.PI * i / (n - 1))); }
  function coinLine(l, d0, n, sp) { for (var i = 0; i < n; i++) addCoin(l, d0 + i * sp); }
  function cRow() { return 3 + Math.floor(Math.random() * 3); }
  function coinGap(d0, gap) {
    if (gap < 12) return;
    var r = Math.random(), n = Math.min(Math.floor((gap - 8) / 2.5), cRow());
    if (n < 3) return;
    if (r < 0.15) coinLine(Math.floor(Math.random() * 3), d0 + 4, n, 2.5);
    else if (r < 0.25) { var l = Math.floor(Math.random() * 3), dir = l === 2 ? -1 : 1; for (var i = 0; i < n; i++) { addCoin(l, d0 + 4 + i * 2.5); if (i % 2 === 1) { l += dir; if (l < 0 || l > 2) { dir = -dir; l += 2 * dir; } } } }
  }
  function sc(d) { return d >= 0 ? 1 / (1 + d * 0.14) : 1 - d * 0.14; }
  function lw() { return Math.min(W * 0.2, H * 0.5); }
  function latAt(d) { if (!bOn) return 0; var e = d - bFd; if (e <= 0) return 0; return Math.max(-400, Math.min(400, bendDir * bAmp * K_B * e * e)); }
  function X0(l, s) { return W / 2 + (l - 1) * lw() * s; }
  function X(l, s) { return W / 2 + (l - 1 + (s < 1 ? latAt((1 / s - 1) / 0.14) : 0)) * lw() * s; }
  function Y(s) { return hy + (by - hy) * s; }
  function offscreen(o) { var s = sc(o.d); return Y(s) - lw() * 1.2 * s > H + 20; }

  function update(dt) {
    hitFlash = Math.max(0, hitFlash - dt * 2.2); shake = Math.max(0, shake - dt * 3); redFlash = Math.max(0, redFlash - dt * 1.5);
    for (var p = pops.length - 1; p >= 0; p--) if (performance.now() - pops[p].born > 900) pops.splice(p, 1);
    if (state !== 'running' || paused) return;
    if (crashT > 0) { crashT -= dt; if (crashT <= 0) die(crashWhy); return; }
    // real-time timers, then world slow motion
    invT = Math.max(0, invT - dt); shieldT = Math.max(0, shieldT - dt); shieldCD = Math.max(0, shieldCD - dt); cannonT = Math.max(0, cannonT - dt);
    var AM = ammoMax(), ARE = Math.max(1, tnum('ammoRecharge', 15)); if (ammo > AM) ammo = AM; if (lives > maxLives()) lives = maxLives();
    if (ammo < AM) { ammoT += dt; if (ammoT >= ARE) { ammoT = 0; ammo++; pop('AMMO +1', '#19e8ff'); } } else ammoT = 0;
    if (slowT > 0) { slowT -= dt; if (slowT <= 0) { slowT = 0; slowmo(false); } }
    for (var bi = bolts.length - 1; bi >= 0; bi--) {
      var b = bolts[bi]; b.d += 60 * dt;
      if (b.tgt && obs.indexOf(b.tgt) < 0) b.tgt = null;
      if (b.tgt && b.d >= b.tgt.d) {
        boom(b.tgt, b.lane); b.kills++;
        if (b.sup && b.kills > 1) pop(b.kills === 2 ? 'DOUBLE!' : 'TRIPLE!', b.kills === 2 ? '#ffe14a' : '#ff2bd6');
        b.tgt = null;
        while (b.rest.length && !b.tgt) { var nx = b.rest.shift(); if (obs.indexOf(nx) >= 0) b.tgt = nx; }
        if (!b.tgt) { bolts.splice(bi, 1); continue; }
      }
      if (b.d > RANGE + 6) bolts.splice(bi, 1);
    }
    if (slowT > 0) dt *= 0.25;
    gt += dt;
    turnT = Math.max(0, turnT - dt); fadeK = Math.min(1, fadeK + dt / 1.0);
    var bt = turnT > 0 ? turnDir : (forkChoice && isOpen(forkChoice)) ? (forkChoice === 'right' ? 1 : -1) : forkType === 'split' ? 0 : (forkType === 'L' ? -1 : 1);
    bendDir += (bt - bendDir) * Math.min(1, dt * 5);
    forkIn -= dt;
    if (forkIn <= 0) {
      forkIn = 0;
      var okTurn = !!forkChoice && isOpen(forkChoice);
      if (!okTurn) {
        var why = !forkChoice ? 'Missed the TURN!' : 'Wrong way! Hit the wall';
        if (shieldT > 0) { pop('SHIELD SAVE', '#19e8ff'); sfx('shield'); spark(X(px, 1), by - lw() * 0.5, '#19e8ff', 18); }
        else if (invT <= 0 && lives <= 1 && !godOn()) {
          crashWhy = why; deathCause = why;
          crashDir = forkChoice === 'left' ? -1 : 1; crashT = CRASH_D; redFlash = 1; shake = 0.8; sliding = false; ducking = false; jumpT = -1;
          if (slowT > 0) slowmo(false); slowT = 0;
          sfx('hit'); spark(X(px, 1), by - lw() * 0.5, '#ff2b5a', 26); return;
        }
        else hurt(why);
        // place runner on the open branch
        forkChoice = forkType === 'split' ? (forkChoice || (px < 1 ? 'left' : 'right')) : (forkType === 'L' ? 'left' : 'right');
      }
      turnDir = forkChoice === 'right' ? 1 : -1; turnT = TURN_D; turnDist0 = dist;
      tOL = isOpen('left'); tOR = isOpen('right'); tCL = THEMES[(track + 2) % 3].b; tCR = THEMES[(track + 1) % 3].b;
      fadeFrom = track; fadeK = 0; track = (track + (turnDir > 0 ? 1 : 2)) % 3;
      if (okTurn) { score += 50; pop('TURN ' + (turnDir > 0 ? 'RIGHT' : 'LEFT') + ' +50', '#ffe14a'); }
      try { if (window.sfx && window.sfx.play) { window.sfx.play('turn'); } } catch (e) {}
      newFork(); report(true);
    }
    if (sliding) { slideLeft -= dt; if (slideLeft <= 0) { sliding = false; ducking = false; slideEndT = performance.now(); sfx('stand'); } }
    if (gt - lastIntensityT >= 1) { lastIntensityT = gt; try { if (window.sfx && window.sfx.setIntensity) window.sfx.setIntensity(Math.max(0, Math.min(1, (speed - 6) / 16))); } catch (e) {} }
    var sp0 = tnum('speedStart', 6), spM = Math.max(sp0, tnum('speedMax', 22)); speed = Math.min(spM, sp0 + (spM - sp0) * (1 - Math.exp(-gt / 150)));
    var lv = 1; for (var li = 0; li < LVT.length; li++) if (gt >= LVT[li]) lv = li + 2;
    if (lv > level) { level = lv; sfx('speedup'); lvlT = performance.now(); lvlMsg = lv === 2 ? 'PITS AHEAD' : lv === 3 ? 'FIRE STRIPS + MOVING TRAPS' : lv === 4 ? 'MOVING BLOCKS' : 'FASTER'; }
    heartIn -= dt;
    if (heartIn <= 0) { var ha = 70 / Math.max(speed, 1); if (ha > forkIn - 4 && ha < forkIn + 2) heartIn = 1; else { coins.push({ lane: Math.floor(Math.random() * 3), d: 70, h: 0, coin: true, heart: true, sp: 0 }); heartIn = jit(tnum('heartEvery', 50)); } }
    superIn -= dt;
    if (superIn <= 0) { var sa0 = 70 / Math.max(speed, 1); if (sa0 > forkIn - 4 && sa0 < forkIn + 2) superIn = 1; else { coins.push({ lane: Math.floor(Math.random() * 3), d: 70, h: 0, coin: true, sup: true, sp: 0 }); superIn = jit(tnum('superEvery', 75)); } }
    var adv = speed * dt; dist += adv; score += adv * 1.0;
    px += (lane - px) * Math.min(1, dt * 12);
    if (jumpT >= 0) { jumpT += dt; if (jumpT >= JD) { jumpT = -1; landT = performance.now(); spark(X(px, 1), by, T0().b, 12); rings.push({ x: X(px, 1), y: by, r: lw() * 0.45, born: landT }); } }
    nextSpawn -= adv;
    if (nextSpawn <= 0) { spawn(); nextSpawn = spawnExtra + Math.max(speed * reactS(), 22 - dist / 60 - level) + Math.random() * Math.max(2, 4 + speed * 0.2 - level * 0.4); coinGap(70, nextSpawn); }
    feelUpdate(dt);
    layout();
    var jh = jumpT >= 0 ? fj.y : 0;
    trail.unshift({ x: px, jh: jh, duck: ducking });
    mode = duckMode() === 'slide' ? 'SLIDE' : 'HOLD'; if (trail.length > 14) trail.length = 14;
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; o.d -= adv;
      if (!o.gone && turnT <= 0 && o.d > 8 && o.d > speed * (forkIn - 4) && o.d < speed * (forkIn + 1.5)) o.gone = gt;
      if (o.gone) { if (gt - o.gone > 0.35) obs.splice(i, 1); continue; }
      if (o.d + (o.len || 0) < 0 && offscreen({ d: o.d + (o.len || 0) })) { obs.splice(i, 1); continue; }
      if (o.reachT === undefined && o.d <= 0) o.reachT = gt;
      if (o.trap) {
        stepMove(o);
        var tw = '';
        if (o.type === 'pit') { if (o.d < -0.2 && o.d + o.len > 0.2 && jh < 0.25 && inSpan(o, px)) tw = 'Fell in a pit! - jump or change lane'; }
        else if (o.type === 'laser') { if (Math.abs(o.d) < 0.5 && laserOn(o) && jh < 0.4 && inSpan(o, px)) tw = 'Burned by FIRE strip - jump or time it!'; }
        else if (Math.abs(o.d) < 0.55 && Math.abs(px - o.lane) < 0.6) tw = 'Hit MOVING BLOCK - watch it slide!';
        if (tw) { var th = hurt(tw); if (th === 2) return; if (th === 3) { shieldBreak(o); obs.splice(i, 1); continue; } if (th === 1) { obs.splice(i, 1); continue; } }
        if (!o.done && o.d + (o.len || 0) < -0.55) { o.done = true; score += 15; pop('TRAP CLEARED +15', '#19ffa0'); }
        continue;
      }
      if (Math.abs(o.d) < 0.55 && Math.abs(px - o.lane) < 0.6) {
        var hw = o.type === 'block' ? 'Hit BLOCK - change lane!' : (o.type === 'low' && jh < 0.5) ? 'Hit LOW BARRIER - jump!' : (o.type === 'high' && !ducking) ? 'Hit HIGH BAR - duck!' : '';
        if (hw) { var hr = hurt(hw); if (hr === 2) return; if (hr === 3) { shieldBreak(o); obs.splice(i, 1); continue; } if (hr === 1) { obs.splice(i, 1); continue; } o.done = true; }
      }
      if (!o.done && o.d < -0.55) {
        o.done = true;
        var dl = Math.abs(px - o.lane);
        if (dl < 0.6) { nmAction(o); combo++; score += 5 * combo; sfx('coin'); if (combo % 5 === 0) pop('COMBO x' + combo, '#ff2bd6'); else if (o.type !== 'block') pop('CLEAN +' + 5 * combo, '#19e8ff'); }
        else nearMiss(o, dl);
      }
    }
    for (var ci = coins.length - 1; ci >= 0; ci--) {
      var c = coins[ci]; c.d -= adv;
      if (c.d < -3) { coins.splice(ci, 1); continue; }
      if (Math.abs(c.d) < 0.7 && Math.abs(px - c.lane) < 0.5 && Math.abs(jh - c.h) < 0.4) {
        coins.splice(ci, 1);
        if (c.heart) {
          sfx('life'); spark(X(c.lane, 1), by - lw() * 0.5, '#ff2b5a', 22);
          if (lives < maxLives()) { lives++; pop('+1 LIFE', '#ff2b5a'); } else { score += 50; pop('FULL LIFE +50', '#ff2b5a'); }
          continue;
        }
        if (c.sup) { superAmmo = Math.min(3, superAmmo + 1); sfx('life'); spark(X(c.lane, 1), by - lw() * 0.5, '#ff2bd6', 24); pop('SUPER AMMO', '#ff2bd6'); continue; }
        coinN++; score += 10; sfx('coin');
        if (coinN % Math.max(1, Math.round(tnum('coinsPerAmmo', 10))) === 0 && ammo < ammoMax()) { ammo++; if (ammo >= ammoMax()) ammoT = 0; sfx('life'); pop('+1 AMMO', '#19e8ff'); }
        spark(X(c.lane, 1), by - lw() * 0.8 * (0.35 + c.h * 0.9), '#ffe14a', 10);
      }
    }
    report(false);
  }
  var lvlT = -9999, lvlMsg = '';
  function T0() { return THEMES[track]; }
  function laserOn(o) { return ((gt + o.ph) % 1.4) < 0.7; }
  function spark(x, y, col, n) { var t = performance.now(); for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = 60 + Math.random() * 220; parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, born: t, c: col }); } if (parts.length > 320) parts.splice(0, parts.length - 320); }

  function nearMiss(o, dl) {
    if (o.reachT === undefined || gt - nmLast < 0.25) return;
    var r = o.reachT, ok = false;
    // dl>=0.6 here (not hit); a) left the obstacle lane <250ms before it arrived
    if (o.lane === laneChg.from && lane !== o.lane && r - laneChg.t >= 0 && r - laneChg.t < 0.25) ok = true;
    // c) block in directly adjacent lane, switched next to it <120ms before pass
    else if (o.type === 'block' && Math.abs(lane - o.lane) === 1 && laneChg.to === lane && laneChg.from !== o.lane && r - laneChg.t >= 0 && r - laneChg.t < 0.12) ok = true;
    if (ok) awardNM();
  }
  function nmAction(o) {
    // b) cleared low/high with jump/duck/slide started <200ms before arrival
    if (o.type === 'block' || o.reachT === undefined || gt - nmLast < 0.25) return;
    var dt0 = o.reachT - act.t;
    if (dt0 >= 0 && dt0 < 0.2 && ((o.type === 'low' && act.type === 'jump') || (o.type === 'high' && act.type === 'duck'))) awardNM();
  }
  function awardNM() {
    nmChain = (gt - nmEnd <= 3 && nmChain > 0) ? nmChain + 1 : 1; nmEnd = gt; nmLast = gt;
    var mult = Math.min(3, nmChain); score += 25 * mult;
    pop('NEAR MISS!' + (mult > 1 ? ' x' + mult : '') + ' +' + 25 * mult, '#ffe14a');
    sfx(mult > 1 ? 'combo' : 'nearmiss');
  }
  function heart(cx, cy, r, col, full) {
    g.beginPath(); g.moveTo(cx, cy + r * 0.95);
    g.bezierCurveTo(cx - r * 1.5, cy - r * 0.05, cx - r * 0.75, cy - r * 1.25, cx, cy - r * 0.4);
    g.bezierCurveTo(cx + r * 0.75, cy - r * 1.25, cx + r * 1.5, cy - r * 0.05, cx, cy + r * 0.95); g.closePath();
    glow(col, full ? 18 : 0); g.lineWidth = 2; g.strokeStyle = col;
    if (full) { g.fillStyle = 'rgba(255,43,90,.45)'; g.fill(); }
    g.stroke(); noGlow();
  }
  function glow(col, blur) { g.shadowColor = col; g.shadowBlur = blur; }
  function noGlow() { g.shadowBlur = 0; }
  function txt(t, x, y, sz, col, blur, align) {
    g.font = '900 ' + sz + 'px ' + FONT; g.textAlign = align || 'center';
    try { g.letterSpacing = Math.round(sz * 0.12) + 'px'; } catch (e) {}
    glow(col, blur === undefined ? sz * 0.5 : blur); g.fillStyle = col; g.fillText(t, x, y);
    var ga = g.globalAlpha; g.fillStyle = '#fff'; g.globalAlpha = ga * 0.55; g.shadowBlur = 0; g.fillText(t, x, y); g.globalAlpha = ga;
    noGlow();
  }

  // curved branch road leaving the junction at depth fd (dir -1 left, +1 right)
  function branch(fd, dir, col, alpha, sh) {
    if (alpha <= 0.01) return;
    var L = [-0.5, 0.5, 1.5, 2.5];
    g.globalAlpha = alpha; glow(col, 14); g.strokeStyle = col;
    for (var i = 0; i < 4; i++) {
      g.lineWidth = i === 0 || i === 3 ? 3 : 1.6; g.beginPath(); var first = true;
      for (var e = 0; e <= 100; e += e < 24 ? 1.5 : 4) {
        var d = fd + e; if (d < -3.5) continue;
        var ss = sc(d), x = W / 2 + (L[i] - 1 + dir * K_B * e * e) * lw() * ss + sh, y = Y(ss);
        if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
        if (Math.abs(x - W / 2) > W * 1.6) break;
      }
      g.stroke();
    }
    // rungs so the branch reads as a grid road
    g.lineWidth = 1; g.globalAlpha = alpha * 0.5;
    for (var r = 2; r < 60; r += 4) {
      var dr = fd + r; if (dr < 0) continue; var sr = sc(dr), lt = dir * K_B * r * r;
      g.beginPath(); g.moveTo(W / 2 + (-1.5 + lt) * lw() * sr + sh, Y(sr)); g.lineTo(W / 2 + (1.5 + lt) * lw() * sr + sh, Y(sr)); g.stroke();
    }
    noGlow(); g.globalAlpha = 1;
  }
  function wall(wd, T, alpha, sh, oL, oR, cL, cR) {
    if (alpha <= 0.01 || wd < 0.3) return;
    var fs = sc(wd), fy = Y(fs), xl0 = X0(-0.5, fs) + sh, xr0 = X0(2.5, fs) + sh, bw = lw() * fs, wh = bw * 1.4;
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(40,0,30,.9)'; g.fillRect(xl0, fy - wh, xr0 - xl0, wh);
    glow(T.a, 18); g.strokeStyle = T.a; g.lineWidth = Math.max(2, 4 * fs); g.strokeRect(xl0, fy - wh, xr0 - xl0, wh);
    g.save(); g.beginPath(); g.rect(xl0, fy - wh, xr0 - xl0, wh); g.clip(); g.globalAlpha = 0.35 * alpha; g.lineWidth = Math.max(1, 2 * fs);
    for (var k = xl0 - wh; k < xr0; k += bw * 0.5) { g.beginPath(); g.moveTo(k, fy); g.lineTo(k + wh, fy - wh); g.stroke(); }
    g.restore(); noGlow(); g.globalAlpha = alpha;
    var ar = Math.max(10, bw * 0.9), ay = fy - wh * 0.5;
    function arrow(cx, dir, col) { glow(col, 20); g.fillStyle = col; g.beginPath(); g.moveTo(cx + dir * ar, ay); g.lineTo(cx - dir * ar * 0.2, ay - ar * 0.7); g.lineTo(cx - dir * ar * 0.2, ay + ar * 0.7); g.closePath(); g.fill(); noGlow(); }
    function xmark(cx, col) { glow(col, 20); g.strokeStyle = col; g.lineWidth = Math.max(2, 5 * fs); g.beginPath(); g.moveTo(cx - ar * 0.6, ay - ar * 0.6); g.lineTo(cx + ar * 0.6, ay + ar * 0.6); g.moveTo(cx + ar * 0.6, ay - ar * 0.6); g.lineTo(cx - ar * 0.6, ay + ar * 0.6); g.stroke(); noGlow(); }
    var mid = (xl0 + xr0) / 2;
    if (oL) arrow(mid - bw * 0.9, -1, cL); else xmark(mid - bw * 0.9, '#ff2b5a');
    if (oR) arrow(mid + bw * 0.9, 1, cR); else xmark(mid + bw * 0.9, '#ff2b5a');
    g.globalAlpha = 1;
  }
  // fork visuals: approaching = both open branches built ahead + T wall; turning = old wall and unused branch swing away
  function drawFork(T) {
    if (crashT > 0) { wall(Math.max(0.5, 3 * crashT / CRASH_D), T, 1, 0, isOpen('left'), isOpen('right'), THEMES[(track + 2) % 3].b, THEMES[(track + 1) % 3].b); return; }
    if (turnT > 0) {
      var te = ease(1 - turnT / TURN_D), sh = -turnDir * W * 0.9 * te, jd = -(dist - turnDist0);
      var otherOpen = turnDir > 0 ? tOL : tOR;
      if (otherOpen) branch(jd, -turnDir, turnDir > 0 ? tCL : tCR, 0.35 * (1 - te), sh);
      wall(13 + jd, T, 1 - te, sh, tOL, tOR, tCL, tCR);
      return;
    }
    if (!bOn) return;
    var cL = THEMES[(track + 2) % 3].b, cR = THEMES[(track + 1) % 3].b, ch = forkChoice && isOpen(forkChoice) ? forkChoice : null;
    if (isOpen('left')) branch(bFd, -1, cL, fa * (ch ? (ch === 'left' ? 1 : 0.3) : 0.85), 0);
    if (isOpen('right')) branch(bFd, 1, cR, fa * (ch ? (ch === 'right' ? 1 : 0.3) : 0.85), 0);
    wall(bFd + 13, T, fa, 0, isOpen('left'), isOpen('right'), cL, cR);
  }
  // fade for obstacles: removed ones fade out; ones past an undecided split junction stay dim
  function objA(o) {
    var a = 1;
    if (o.gone) a *= Math.max(0, 1 - (gt - o.gone) / 0.35);
    if (bOn && turnT <= 0 && o.d > bFd) a *= 1 - fa * (1 - Math.abs(bendDir)) * 0.8;
    return a;
  }
  // telegraph: chevrons in move direction, blinking in the 0.6 s before the next lane step
  function tele(o, s, y) {
    if (!o.mv || o.d < -1) return;
    var hot = gt > o.next - 0.6, ga = g.globalAlpha, edge = o.dir > 0 ? o.l1 + o.off + 0.5 : o.l0 + o.off - 0.5;
    var x = X(edge, s), sz = Math.max(5, lw() * 0.18 * s), col = hot ? '#ffe14a' : 'rgba(255,225,74,.45)';
    if (hot && Math.floor(gt * 10) % 2) return;
    glow('#ffe14a', hot ? 18 : 4); g.strokeStyle = col; g.lineWidth = Math.max(1.5, 3 * s);
    for (var c = 0; c < 2; c++) { var cx = x + o.dir * (sz * 0.6 + c * sz * 0.8); g.beginPath(); g.moveTo(cx - o.dir * sz * 0.4, y - sz * 0.5); g.lineTo(cx + o.dir * sz * 0.3, y); g.lineTo(cx - o.dir * sz * 0.4, y + sz * 0.5); g.stroke(); }
    noGlow(); g.globalAlpha = ga;
  }
  function speedLines(amt, dir, now, T) {
    g.save(); g.lineCap = 'round';
    for (var i = 0; i < 46; i++) {
      var a = (i * 2.399) % 6.283, ph = ((now / 260 + i * 0.137) % 1), r0 = Math.min(W, H) * (0.15 + ph * 0.9), r1 = r0 + Math.min(W, H) * (0.08 + 0.25 * ph);
      var cx = W / 2 + dir * W * 0.15 * amt, cy = hy;
      g.globalAlpha = amt * (0.25 + 0.6 * ph); g.strokeStyle = i % 3 ? T.b : '#fff'; g.lineWidth = 1 + ph * 3; glow(T.b, 10);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0 - dir * amt * 40, cy + Math.sin(a) * r0 * 0.7); g.lineTo(cx + Math.cos(a) * r1 - dir * amt * 120, cy + Math.sin(a) * r1 * 0.7); g.stroke();
    }
    g.restore(); noGlow();
  }
  var DS = [-3.6, 0, 1, 2, 3, 4, 6, 8, 10, 13, 16, 20, 25, 30, 36, 43, 51, 60, 70, 82, 96, 115, 140, 180, 250, 350];
  function lineD(xl, d0, d1) {
    var pts = DS.filter(function (d) { return d > d0 && d < d1; });
    if (bOn) for (var e = 1; e < 120; e += e < 20 ? 2 : 6) { var dd = bFd + e; if (dd > d0 && dd < d1) pts.push(dd); }
    pts.push(d1); pts.sort(function (a, b) { return a - b; });
    g.beginPath(); var s0 = sc(d0); g.moveTo(X(xl, s0), Y(s0));
    for (var i = 0; i < pts.length; i++) { var ss = sc(pts[i]), x = X(xl, ss); g.lineTo(x, Y(ss)); if (Math.abs(x - W / 2) > W * 2) break; }
    g.stroke();
  }
  function draw(now) {
    var T = mixT();
    layout();
    var fdv = forkIn * speed; fa = 0;
    if (state === 'running' && turnT > 0) { bOn = true; bFd = 0; bAmp = 1 - ease(1 - turnT / TURN_D); }
    else if (state === 'running' && crashT <= 0 && fdv < 85) { bOn = true; bFd = fdv; bAmp = 1; fa = Math.max(0, Math.min(1, (85 - fdv) / 20)); }
    else bOn = false;
    g.save();
    feelCam();
    var tAmt = 0, sm = slowT > 0 ? Math.max(0, Math.min(1, (slowLen - slowT) / 0.15, slowT / 0.25)) : 0;
    if (sm > 0) { var zf = 1 + 0.08 * sm; g.translate(W / 2, by - lw() * 0.5); g.scale(zf, zf); g.translate(-W / 2, -(by - lw() * 0.5)); }
    if (turnT > 0) { var te = ease(1 - turnT / TURN_D); tAmt = Math.sin(Math.PI * te); g.translate(W / 2, H * 0.75); g.rotate(-turnDir * 0.12 * tAmt); g.translate(-W / 2 - turnDir * W * 0.06 * tAmt, -H * 0.75); }
    g.fillStyle = '#000'; g.fillRect(-W, -H, W * 3, H * 3);
    // sky glow
    var gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, '#000'); gr.addColorStop(1, T.sky);
    g.fillStyle = gr; g.fillRect(0, 0, W, hy);
    // sun with stripes
    var sr = Math.min(W * 0.2, H * 0.3), sx = W / 2 + (bOn ? bendDir * W * 0.3 * (turnT > 0 ? bAmp : fa) : 0), sy = hy - sr * 0.15;
    g.save(); g.beginPath(); g.rect(0, 0, W, hy); g.clip();
    glow(T.s2, 50);
    var sg = g.createLinearGradient(0, sy - sr, 0, sy + sr);
    sg.addColorStop(0, T.s1); sg.addColorStop(1, T.s2);
    g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill(); noGlow();
    g.fillStyle = '#000';
    var so = (now / 1000 * 12) % 1;
    for (var k = 0; k < 7; k++) {
      var yy = sy - sr * 0.55 + k * sr * 0.11, hh = sr * (0.015 + k * 0.012);
      g.fillRect(sx - sr, yy, sr * 2, hh);
    }
    g.restore();
    // horizon line
    glow(T.a, 18); g.strokeStyle = T.a; g.lineWidth = 2; g.beginPath(); g.moveTo(0, hy); g.lineTo(W, hy); g.stroke(); noGlow();
    // floor
    var fg = g.createLinearGradient(0, hy, 0, H);
    fg.addColorStop(0, T.sky); fg.addColorStop(1, '#000');
    g.fillStyle = fg; g.fillRect(0, hy, W, H - hy);
    // grid lines
    g.lineWidth = 1.5;
    var off = (dist % 4) / 4;
    for (var j = 0; j < 22; j++) {
      var d = j * 4 - off * 4, s = sc(Math.max(d, 0)), y = Y(s);
      if (y > H) continue;
      g.globalAlpha = Math.min(1, 0.25 + s * 1.2);
      glow(T.a, 8); g.strokeStyle = T.a; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 1;
    var roadC = turnT > 0 ? THEMES[track].b : T.b;
    for (var l = -12; l <= 14; l++) {
      var isRoad = (l === 0 || l === 1 || l === 2 || l === 3) ;
      g.strokeStyle = isRoad ? roadC : T.a; g.lineWidth = isRoad ? 2.5 : 1.2; glow(isRoad ? roadC : T.a, isRoad ? 14 : 6);
      var xl = l - 0.5;
      if (isRoad && bOn && turnT <= 0) {
        lineD(xl, -3.6, bFd);
        if (fa < 1) { g.globalAlpha = 1 - fa; lineD(xl, bFd, 350); g.globalAlpha = 1; }
      } else lineD(xl, -3.6, 350);
    }
    noGlow();
    // fork ahead
    if (state === 'running') drawFork(T);
    // pits: black void cut in the grid
    obs.forEach(function (o) {
      if (o.type !== 'pit' || o.d > 69) return;
      var dn = Math.max(o.d, -1.5), df = o.d + o.len; if (df < -1.5) return;
      var s0 = sc(dn), s1 = sc(df), l0 = o.l0 + o.off - 0.5, l1 = o.l1 + o.off + 0.5;
      g.globalAlpha = Math.min(1, Math.max(0.2, 1.3 - o.d / 55)) * objA(o);
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(X(l0, s1), Y(s1)); g.lineTo(X(l1, s1), Y(s1)); g.lineTo(X(l1, s0), Y(s0)); g.lineTo(X(l0, s0), Y(s0)); g.closePath(); g.fill();
      var dep = lw() * 0.5 * s1;
      g.fillStyle = 'rgba(255,43,90,.18)'; g.beginPath(); g.moveTo(X(l0, s1), Y(s1)); g.lineTo(X(l1, s1), Y(s1)); g.lineTo(X(l1, s1), Y(s1) + dep); g.lineTo(X(l0, s1), Y(s1) + dep); g.closePath(); g.fill();
      glow('#ff2b5a', 18); g.strokeStyle = '#ff2b5a'; g.lineWidth = Math.max(1.5, 3 * s0);
      g.beginPath(); g.moveTo(X(l0, s1), Y(s1)); g.lineTo(X(l1, s1), Y(s1)); g.lineTo(X(l1, s0), Y(s0)); g.lineTo(X(l0, s0), Y(s0)); g.closePath(); g.stroke();
      noGlow(); tele(o, s0, Y(s0) - lw() * 0.15 * s0);
      g.globalAlpha = 1;
    });
    // obstacles
    var hu = lw() * 0.8;
    var list = obs.filter(function (o) { return o.type !== 'pit'; }).concat(coins).sort(function (a, b) { return b.d - a.d; });
    var jh = jumpT >= 0 ? fj.y : 0;
    var playerDrawn = false;
    function player() {
      var x = X(px, 1), y = by - jh * hu * 0.9;
      var ph = sliding ? hu * 0.28 : ducking ? hu * 0.5 : hu * 1.0, pw = sliding ? hu * 0.9 : hu * 0.5;
      var bank = turnDir * 0.5 * tAmt + (lane - px) * 0.35, cp = crashT > 0 ? 1 - crashT / CRASH_D : 0;
      if (cp > 0) { bank = crashDir * cp * 1.3; y -= Math.sin(Math.PI * Math.min(1, cp * 1.6)) * hu * 0.4 - cp * hu * 0.2; }
      // ship animation: launch stretch, barrel roll, landing squash, slide lean/flatten, stand-up pop, shot recoil
      var asx = 1, asy = 1, nowA = performance.now();
      if (jumpT >= 0) { var jq = jumpT / JD; if (jq < 0.12) { asy = 1.25 - jq; asx = 0.85; } asx *= Math.max(0.15, Math.abs(Math.cos(2 * Math.PI * ease((jq - 0.15) / 0.6)))); }
      var lq = (nowA - landT) / 220; if (lq >= 0 && lq < 1) { asy *= 1 - 0.35 * (1 - lq); asx *= 1 + 0.3 * (1 - lq); }
      if (sliding) { bank -= 0.22; asx *= 1.15; asy *= 0.8; }
      var rq = (nowA - slideEndT) / 260; if (!sliding && rq >= 0 && rq < 1) asy *= 1 + 0.3 * Math.sin(Math.PI * rq);
      var kq = (nowA - shootT) / 180; if (kq >= 0 && kq < 1) { y += hu * 0.12 * (1 - kq); asy *= 1 - 0.1 * (1 - kq); }
      g.save(); g.translate(x, y - ph * 0.4); g.rotate(bank); g.translate(-x, -(y - ph * 0.4));
      g.translate(x, y); g.scale(asx, asy); g.translate(-x, -y);
      if (cp > 0 && Math.floor(cp * 20) % 2) g.globalAlpha = 0.4;
      feelBody(x, y);
      var blink = invT > 0 && Math.floor(invT * 12) % 2 === 0;
      // shadow
      g.fillStyle = 'rgba(25,232,255,.18)'; g.beginPath(); g.ellipse(x, by + 4, pw * (1 - jh * 0.3), pw * 0.18, 0, 0, 7); g.fill();
      // trail
      for (var i = trail.length - 1; i >= 1; i--) {
        var t = trail[i], k = 1 - i / trail.length;
        var tx2 = X(t.x, 1), ty2 = by - t.jh * hu * 0.9 - ph * 0.1 + i * 9;
        g.globalAlpha = k * 0.35; glow(T.a, 10); g.strokeStyle = T.a; g.lineWidth = 2;
        g.beginPath(); g.moveTo(tx2, ty2 - ph * 0.9 * k); g.lineTo(tx2 - pw * 0.5 * k, ty2); g.lineTo(tx2 + pw * 0.5 * k, ty2); g.closePath(); g.stroke();
      }
      g.globalAlpha = blink ? 0.25 : 1;
      glow(T.b, 28); g.strokeStyle = T.b; g.lineWidth = 3.5; g.fillStyle = 'rgba(25,232,255,.18)';
      g.beginPath(); g.moveTo(x, y - ph); g.lineTo(x - pw / 2, y); g.lineTo(x, y - ph * 0.2); g.lineTo(x + pw / 2, y); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; glow('#fff', 10);
      g.beginPath(); g.moveTo(x, y - ph); g.lineTo(x, y - ph * 0.2); g.stroke();
      noGlow();
      if (cannonT > 0) {
        // neon cannon mounted on the ship, pointing down the lane
        var ca = Math.min(1, (slowLen - cannonT) / 0.12, cannonT / 0.2), cw2 = pw * 0.18, chh = ph * 0.42 * ca, cy0 = y - ph * 0.55;
        glow('#ff2bd6', 24); g.strokeStyle = '#ff2bd6'; g.fillStyle = 'rgba(255,43,214,.35)'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x - cw2 * 0.8, cy0); g.lineTo(x - cw2 * 0.45, cy0 - chh); g.lineTo(x + cw2 * 0.45, cy0 - chh); g.lineTo(x + cw2 * 0.8, cy0); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = '#19e8ff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - cw2 * 0.6, cy0 - chh * 0.35); g.lineTo(x + cw2 * 0.6, cy0 - chh * 0.35); g.stroke();
        var mz = slowLen - cannonT < 0.18 ? 1 - (slowLen - cannonT) / 0.18 : 0;
        if (mz > 0) { glow('#ffffff', 30); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, cy0 - chh, cw2 * (0.5 + mz), 0, 7); g.fill(); }
        noGlow();
      }
      if (sliding) {
        g.strokeStyle = '#ffe14a'; g.lineWidth = 2; glow('#ffb31c', 12);
        for (var q = 0; q < 9; q++) {
          var sx2 = x + (Math.random() - 0.5) * pw * 1.4, sy2 = y - Math.random() * ph * 0.4, ln = 6 + Math.random() * hu * 0.3;
          g.globalAlpha = 0.3 + Math.random() * 0.7; g.beginPath(); g.moveTo(sx2, sy2); g.lineTo(sx2 + (Math.random() - 0.5) * 10, sy2 + ln); g.stroke();
        }
        g.globalAlpha = 1; noGlow();
      }
      if (shieldT > 0) {
        var sa = Math.min(1, shieldT / 0.5) * (0.75 + 0.25 * Math.sin(nowA / 70)), scy = y - ph * 0.5, sr = (Math.max(ph * 0.5, Math.hypot(pw / 2, ph * 0.5)) / Math.cos(Math.PI / 6) * 1.2 + 8) * (1 + 0.04 * Math.sin(nowA / 90));
        g.save(); g.globalAlpha = sa; g.strokeStyle = '#19e8ff'; g.fillStyle = 'rgba(25,232,255,.12)'; g.lineWidth = 3; glow('#19e8ff', 22);
        g.beginPath(); for (var hx = 0; hx < 6; hx++) { var ha = nowA / 900 + hx * Math.PI / 3; g[hx ? 'lineTo' : 'moveTo'](x + Math.cos(ha) * sr, scy + Math.sin(ha) * sr); }
        g.closePath(); g.fill(); g.stroke(); noGlow(); g.restore();
      }
      g.restore(); g.globalAlpha = 1;
      if (sliding) txt('SLIDE', x, y - ph - 10, Math.max(14, H * 0.03), '#ffb31c');
      else if (ducking) txt('DUCK', x, y - ph - 10, Math.max(14, H * 0.03), '#ffe14a');
    }
    list.forEach(function (o) {
      if (!playerDrawn && o.d < 0) { player(); playerDrawn = true; }
      var s = sc(o.d);
      var x = X(o.lane, s), y = Y(s), w = lw() * 0.8 * s, h = hu * s;
      g.globalAlpha = Math.min(1, Math.max(0.15, 1.3 - o.d / 55)) * objA(o);
      g.lineWidth = Math.max(1.5, 3 * s);
      if (o.sup) {
        var sp2 = 1 + 0.18 * Math.sin(now / 90), sr2 = Math.max(6, h * 0.3) * sp2, scy2 = y - h * 0.5, rot = now / 400;
        glow('#ff2bd6', 30); g.strokeStyle = '#ff2bd6'; g.fillStyle = 'rgba(255,43,214,.4)'; g.lineWidth = Math.max(2, 3 * s);
        g.beginPath(); for (var st = 0; st < 10; st++) { var sa2 = rot + st * Math.PI / 5, rr = st % 2 ? sr2 * 0.45 : sr2; g[st ? 'lineTo' : 'moveTo'](x + Math.cos(sa2) * rr, scy2 + Math.sin(sa2) * rr); }
        g.closePath(); g.fill(); g.stroke();
        glow('#ffffff', 16); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.globalAlpha *= 0.5 + 0.4 * Math.sin(now / 100); g.beginPath(); g.arc(x, scy2, sr2 * 1.7, 0, 7); g.stroke();
      } else if (o.heart) {
        var hp = 1 + 0.15 * Math.sin(now / 120), hr = Math.max(5, h * 0.28) * hp;
        heart(x, y - h * 0.5, hr, '#ff2b5a', true);
        g.globalAlpha *= 0.4 + 0.3 * Math.sin(now / 120); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - h * 0.5, hr * 1.8, 0, 7); g.stroke();
      } else if (o.coin) {
        var cy = y - h * (0.35 + o.h * 0.9), cr = Math.max(3, h * 0.2), sp = Math.cos(now / 180 + o.sp), cw = cr * (0.25 + 0.75 * Math.abs(sp));
        glow('#ffe14a', 16); g.strokeStyle = '#ffe14a'; g.lineWidth = Math.max(1.5, 2.5 * s);
        g.beginPath(); g.moveTo(x, cy - cr); g.lineTo(x + cw, cy); g.lineTo(x, cy + cr); g.lineTo(x - cw, cy); g.closePath(); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, cy, cw * 0.45, cr * 0.45, 0, 0, 7); g.stroke();
      } else if (o.type === 'laser') {
        var on = laserOn(o), xl = X(o.l0 + o.off - 0.5, s), xr = X(o.l1 + o.off + 0.5, s), pul = 0.6 + 0.4 * Math.sin(now / 40);
        g.strokeStyle = '#ff7a1c'; g.lineWidth = Math.max(2, 4 * s); glow('#ff7a1c', 10);
        g.beginPath(); g.moveTo(xl, y); g.lineTo(xl, y - h * 0.6); g.moveTo(xr, y); g.lineTo(xr, y - h * 0.6); g.stroke();
        if (on) {
          glow('#ff2b2b', 30 * pul); g.strokeStyle = '#ff2b2b'; g.fillStyle = 'rgba(255,60,30,' + (0.5 * pul) + ')';
          g.beginPath(); var n = 12; g.moveTo(xl, y);
          for (var q = 0; q < n; q++) { var x0 = xl + (xr - xl) * q / n, x1 = xl + (xr - xl) * (q + 0.5) / n; g.lineTo(x1, y - h * (0.25 + 0.15 * pul)); g.lineTo(xl + (xr - xl) * (q + 1) / n, y); }
          g.closePath(); g.fill(); g.stroke();
          g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xl, y - h * 0.12); g.lineTo(xr, y - h * 0.12); g.stroke();
        } else { g.setLineDash([6 * s + 2, 6 * s + 2]); g.strokeStyle = 'rgba(255,122,28,.6)'; g.lineWidth = Math.max(1, 2 * s); g.beginPath(); g.moveTo(xl, y); g.lineTo(xr, y); g.stroke(); g.setLineDash([]); }
      } else if (o.type === 'mover') {
        glow('#ffffff', 26); g.strokeStyle = '#ff9a1c'; g.fillStyle = 'rgba(255,154,28,.18)';
        g.fillRect(x - w / 2, y - h * 1.1, w, h * 1.1); g.strokeRect(x - w / 2, y - h * 1.1, w, h * 1.1);
        g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, 2.5 * s); var my = y - h * 0.55, mw = w * 0.32, dr = o.dir || 1;
        g.beginPath(); g.moveTo(x - dr * mw, my); g.lineTo(x + dr * mw, my); g.moveTo(x + dr * mw - dr * mw * 0.4, my - mw * 0.4); g.lineTo(x + dr * mw, my); g.lineTo(x + dr * mw - dr * mw * 0.4, my + mw * 0.4); g.stroke();
      } else if (o.type === 'low') {
        glow(T.obs, 20); g.strokeStyle = T.obs; g.fillStyle = 'rgba(255,61,129,.15)';
        g.fillRect(x - w / 2, y - h * 0.35, w, h * 0.35); g.strokeRect(x - w / 2, y - h * 0.35, w, h * 0.35);
        g.beginPath(); g.moveTo(x - w / 2, y - h * 0.35); g.lineTo(x + w / 2, y); g.moveTo(x + w / 2, y - h * 0.35); g.lineTo(x - w / 2, y); g.stroke();
      } else if (o.type === 'high') {
        glow(T.bar, 20); g.strokeStyle = T.bar; g.fillStyle = 'rgba(25,232,255,.15)';
        g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h * 1.5); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y - h * 1.5); g.stroke();
        g.fillRect(x - w / 2, y - h * 1.35, w, h * 0.5); g.strokeRect(x - w / 2, y - h * 1.35, w, h * 0.5);
      } else {
        glow(T.blk, 24); g.strokeStyle = T.blk; g.fillStyle = 'rgba(179,107,255,.12)';
        g.fillRect(x - w / 2, y - h * 1.3, w, h * 1.3); g.strokeRect(x - w / 2, y - h * 1.3, w, h * 1.3);
        g.beginPath(); g.moveTo(x - w / 2, y - h * 1.3); g.lineTo(x + w / 2, y); g.moveTo(x + w / 2, y - h * 1.3); g.lineTo(x - w / 2, y);
        g.moveTo(x - w / 2, y - h * 0.65); g.lineTo(x + w / 2, y - h * 0.65); g.stroke();
      }
      noGlow();
      if (o.mv && o.type !== 'pit') tele(o, s, y - h * (o.type === 'mover' ? 1.3 : 0.45));
      g.globalAlpha = 1;
    });
    if (!playerDrawn) player();
    // laser bolts
    g.lineCap = 'round';
    bolts.forEach(function (b) {
      var s0 = sc(b.d), s1 = sc(Math.max(0, b.d - 6)), x0 = X(b.lane, s0), y0 = Y(s0) - hu * s0 * 0.6, x1 = X(b.lane, s1), y1 = Y(s1) - hu * s1 * 0.6;
      glow('#ff2bd6', 34); g.strokeStyle = '#ff2bd6'; g.lineWidth = Math.max(4, 14 * s0);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x0, y0); g.stroke();
      glow('#ffffff', 16); g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, 5 * s0);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x0, y0); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x0, y0, Math.max(3, 9 * s0), 0, 7); g.fill(); noGlow();
    });
    g.lineCap = 'butt';
    feelDraw();
    g.restore(); g.save();
    if (sm > 0) {
      // chromatic ghosting + tint during slow motion
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.2 * sm;
      var co = 6 * DPR * sm; g.drawImage(cv, co, 0); g.drawImage(cv, -co, 0); g.restore();
      g.fillStyle = 'rgba(90,0,160,' + (0.16 * sm) + ')'; g.fillRect(0, 0, W, H);
      var eg = g.createLinearGradient(0, 0, W, 0); eg.addColorStop(0, 'rgba(255,43,214,' + 0.22 * sm + ')'); eg.addColorStop(0.2, 'rgba(0,0,0,0)'); eg.addColorStop(0.8, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(25,232,255,' + 0.22 * sm + ')');
      g.fillStyle = eg; g.fillRect(0, 0, W, H);
    }
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var R = rings[ri], ra = (now - R.born) / 500; if (ra >= 1) { rings.splice(ri, 1); continue; }
      g.globalAlpha = 1 - ra; glow('#ff2bd6', 24); g.strokeStyle = ri % 2 ? '#19e8ff' : '#ff2bd6'; g.lineWidth = 3 + 6 * (1 - ra);
      g.beginPath(); g.arc(R.x, R.y, R.r * (0.2 + ra * 1.4), 0, 7); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(R.x, R.y, R.r * (0.1 + ra * 0.9), 0, 7); g.stroke();
    }
    g.globalAlpha = 1; noGlow();
    if (shake > 0) g.translate(fx.sx, fx.sy);
    if (tAmt > 0.02) speedLines(tAmt, turnDir, now, T);
    for (var pi = parts.length - 1; pi >= 0; pi--) {
      var P = parts[pi], pa = (now - P.born) / 600; if (pa >= 1) { parts.splice(pi, 1); continue; }
      var t2 = pa * 0.6, ppx = P.x + P.vx * t2, ppy = P.y + P.vy * t2 + 300 * t2 * t2;
      g.globalAlpha = 1 - pa; glow(P.c, 10); g.fillStyle = P.c; g.fillRect(ppx - 2, ppy - 2, 4, 4);
    }
    g.globalAlpha = 1; noGlow();
    // HUD
    var sz = Math.max(30, H * 0.075);
    txt(pad(Math.floor(score), 6), W / 2, Math.max(48, H * 0.1), sz, T.b);
    txt('HI ' + pad(Math.floor(hi), 6), 16, 28, Math.max(14, H * 0.025), T.a, 8, 'left');
    txt(mode, W - 16, 28, Math.max(14, H * 0.025), T.b, 8, 'right');
    txt('\u25c6 ' + coinN, 16, 28 + Math.max(20, H * 0.04), Math.max(16, H * 0.032), '#ffe14a', 10, 'left');
    txt('LV ' + level, 16, 28 + 2 * Math.max(20, H * 0.04), Math.max(13, H * 0.024), T.b, 6, 'left');
    var hr0 = Math.max(9, H * 0.017), hy0 = 28 + 3 * Math.max(20, H * 0.04);
    var mL = Math.max(maxLives(), lives); for (var hi2 = 0; hi2 < mL; hi2++) {
      var full = hi2 < lives, justLost = hi2 === lives && now - lifeLost < 900 && Math.floor(now / 90) % 2 === 0;
      heart(16 + hr0 + hi2 * hr0 * 2.8, hy0, hr0, full || justLost ? '#ff2b5a' : 'rgba(255,43,90,.3)', full || justLost);
    }
    var ay0 = hy0 + hr0 * 2.4, pw0 = hr0 * 1.1, ph0 = hr0 * 1.6, AMh = ammoMax(), AREh = Math.max(1, tnum('ammoRecharge', 15));
    for (var ai = 0; ai < AMh; ai++) {
      var ax = 16 + ai * pw0 * 2, fill = ai < ammo ? 1 : ai === ammo ? ammoT / AREh : 0;
      g.strokeStyle = fill >= 1 ? '#19e8ff' : 'rgba(25,232,255,.45)'; g.lineWidth = 2; glow('#19e8ff', fill >= 1 ? 14 : 4);
      g.strokeRect(ax, ay0, pw0, ph0);
      if (fill > 0) { g.fillStyle = fill >= 1 ? 'rgba(25,232,255,.85)' : 'rgba(25,232,255,.35)'; g.fillRect(ax, ay0 + ph0 * (1 - fill), pw0, ph0 * fill); }
      noGlow();
    }
    if (state === 'running') {
      var sx0 = 16 + (AMh * 2 + 1) * pw0, rdy = shieldCD <= 0, sq = rdy ? 1 : 1 - shieldCD / Math.max(1, shieldReLen), scx = sx0 + ph0 * 0.5, scy0 = ay0 + ph0 * 0.5;
      g.strokeStyle = rdy ? '#19e8ff' : 'rgba(25,232,255,.45)'; g.lineWidth = 2; glow('#19e8ff', rdy ? 14 : 4);
      g.beginPath(); for (var hh = 0; hh < 6; hh++) { var hb = hh * Math.PI / 3; g[hh ? 'lineTo' : 'moveTo'](scx + Math.cos(hb) * ph0 * 0.55, scy0 + Math.sin(hb) * ph0 * 0.55); }
      g.closePath(); g.stroke();
      if (sq > 0) { g.fillStyle = rdy ? 'rgba(25,232,255,.85)' : 'rgba(25,232,255,.35)'; g.beginPath(); g.arc(scx, scy0, ph0 * 0.4 * sq, 0, 7); g.fill(); }
      noGlow();
      if (superAmmo > 0) { g.globalAlpha = 0.7 + 0.3 * Math.sin(now / 90); txt('SUPER x' + superAmmo, sx0 + ph0 * 1.4, ay0 + ph0 * 0.8, Math.max(12, H * 0.022), '#ff2bd6', 12, 'left'); g.globalAlpha = 1; }
      if (godOn()) txt('GOD', W - 16, H - 24 - Math.max(18, H * 0.035), Math.max(14, H * 0.03), '#ffe14a', 14, 'right');
    }
    if (slowT > 0 && state === 'running') { g.globalAlpha = 0.6 + 0.4 * Math.sin(now / 60); txt('SLOW-MO', W - 16, H - 24, Math.max(14, H * 0.03), '#ff2bd6', 14, 'right'); g.globalAlpha = 1; }
    var la = (now - lvlT) / 1600;
    if (la >= 0 && la < 1 && state === 'running') { g.globalAlpha = la < 0.8 ? 1 : (1 - la) * 5; var lsz = Math.max(36, H * 0.1) * (1 + 0.3 * Math.max(0, 0.15 - la) / 0.15); txt('LEVEL UP', W / 2, H * 0.4, lsz, '#19ffa0', 40); txt('LV ' + level + ' - ' + lvlMsg, W / 2, H * 0.4 + lsz * 0.8, Math.max(16, H * 0.035), '#ffffff', 8); g.globalAlpha = 1; }
    if (combo > 1 && state === 'running') txt('COMBO x' + combo, W - 16, 28 + Math.max(18, H * 0.035), Math.max(16, H * 0.03), '#ffe14a', 10, 'right');
    if (state === 'running' && nmChain > 0 && gt - nmEnd <= 3) txt('NM x' + Math.min(3, nmChain), W - 16, 28 + 2 * Math.max(18, H * 0.035), Math.max(14, H * 0.025), '#ff2bd6', 8, 'right');
    if (state === 'running' && !paused && inWin()) {
      var hs = Math.max(16, H * 0.04), hb = Math.floor(now / 200) % 2 === 0;
      var hint = forkType === 'split' ? 'SWIPE \u2190 or \u2192 TO TURN' : forkType === 'L' ? '\u2190 TURN LEFT!' : 'TURN RIGHT! \u2192';
      if (forkIn <= 2.5 && (!forkChoice || !isOpen(forkChoice)) && hb) txt(hint, W / 2, H * 0.2, Math.max(30, H * 0.09), '#ff2b5a');
      txt(isOpen('left') ? '<' : 'X', W / 2 - hs * 3, H * 0.15, hs * 1.6, !isOpen('left') ? '#ff2b5a' : forkChoice === 'left' ? '#ffe14a' : T.a, forkChoice === 'left' ? 20 : 4);
      txt(isOpen('right') ? '>' : 'X', W / 2 + hs * 3, H * 0.15, hs * 1.6, !isOpen('right') ? '#ff2b5a' : forkChoice === 'right' ? '#ffe14a' : T.a, forkChoice === 'right' ? 20 : 4);
      if (forkChoice) txt(forkChoice === 'left' ? '< LEFT' : 'RIGHT >', W / 2, H * 0.15, hs, isOpen(forkChoice) ? '#ffe14a' : '#ff2b5a', 12);
    }
    var age = now - lastInT;
    if (lastIn && age < 450 && state === 'running') {
      g.globalAlpha = 1 - age / 450; txt(lastIn, W / 2, H * 0.3, Math.max(28, H * 0.08), T.a); g.globalAlpha = 1;
    }
    pops.forEach(function (p, i) {
      var a = (now - p.born) / 900;
      g.globalAlpha = Math.max(0, 1 - a); txt(p.t, W / 2, H * 0.52 - a * 50 - i * 0, Math.max(20, H * 0.05), p.c); g.globalAlpha = 1;
    });
    g.restore();
    if (paused && state === 'running') {
      g.fillStyle = 'rgba(0,0,10,.62)'; g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.75 + 0.25 * Math.sin(now / 250);
      txt('PAUSED', W / 2, H * 0.48, Math.max(44, H * 0.14), T.b, 50); g.globalAlpha = 1;
      txt('P / ESC / PULL TO RESUME', W / 2, H * 0.6, Math.max(13, H * 0.028), '#ffffff', 6);
    }
    if (state === 'start') {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, H);
      txt('NEON GRID', W / 2, H * 0.34, Math.max(40, H * 0.13), T.a, 40);
      if (Math.floor(now / 500) % 2 === 0) txt('INSERT GESTURE', W / 2, H * 0.52, Math.max(24, H * 0.06), T.b);
      txt('JUMP LOW  /  DUCK HIGH  /  DODGE BLOCKS', W / 2, H * 0.64, Math.max(13, H * 0.028), '#ffffff', 6);
      txt('PUSH = SHOOT (X)  /  WAVE = SHIELD (Z)  /  PULL = PAUSE (P)  /  3 LIVES', W / 2, H * 0.70, Math.max(13, H * 0.028), '#ff2bd6', 6);
      txt('TRACK ' + (track + 1) + '  (T / R)', W / 2, H * 0.77, Math.max(13, H * 0.028), T.a, 6);
    } else if (state === 'dead') {
      g.fillStyle = 'rgba(40,0,20,.6)'; g.fillRect(0, 0, W, H);
      txt('GAME OVER', W / 2, H * 0.34, Math.max(40, H * 0.12), '#ff2b5a', 40);
      if (deathCause) txt(deathCause, W / 2, H * 0.43, Math.max(16, H * 0.04), '#ffe14a', 6);
      txt('SCORE ' + Math.floor(score), W / 2, H * 0.5, Math.max(28, H * 0.07), T.b);
      txt('BEST ' + Math.floor(hi), W / 2, H * 0.59, Math.max(18, H * 0.045), T.a);
      txt('\u25c6 COINS ' + coinN + '   LV ' + level, W / 2, H * 0.67, Math.max(16, H * 0.04), '#ffe14a', 10);
      if (Math.floor(now / 500) % 2 === 0) txt('INSERT GESTURE', W / 2, H * 0.78, Math.max(20, H * 0.05), '#ffe14a');
    }
    // hit flash
    if (hitFlash > 0) { g.fillStyle = 'rgba(255,255,255,' + (hitFlash * 0.8) + ')'; g.fillRect(0, 0, W, H); }
    if (redFlash > 0) { g.fillStyle = 'rgba(255,20,60,' + (redFlash * 0.55 * (0.6 + 0.4 * Math.sin(now / 30))) + ')'; g.fillRect(0, 0, W, H); }
    // CRT: scanlines + vignette
    if (scan) { g.fillStyle = g.createPattern(scan, 'repeat'); g.fillRect(0, 0, W, H); }
    if (vig) { g.fillStyle = vig; g.fillRect(0, 0, W, H); }
  }

  // ---------- game feel ----------
  // jump physics, lane spring + lean, camera follow + zoom punch, hit-stop, smooth shake, pooled particles.
  // own clocks: frozen while paused, x0.25 in slow motion, frozen during hit-stop (camera springs run on real time).
  var J_A = JD, J_TR = J_A / (1 + Math.sqrt(1 / 1.5)), J_V0 = 2 / J_TR, J_GU = 2 / (J_TR * J_TR), J_GD = J_GU * 1.5; // apex 1 at J_TR, lands with the JD timer (height clamps at 0)
  var LANE_W = 28, fj = { air: false, y: 0, v: 0, buf: -9999 }, fs = { x: 1, v: 0 };
  var camX = { x: 0, v: 0 }, camY = { x: 0, v: 0 }, camZ = { x: 0, v: 0 };
  var fx = { st: '', hs: 0, rt: 0, sx: 0, sy: 0, cannon: 0, level: 1, coinN: 0 };
  var FP_N = 150, FP = [], fpi = 0, DEB_C = ['#ff2bd6', '#19e8ff', '#ffe14a', '#ffffff'];
  for (var fpk = 0; fpk < FP_N; fpk++) FP.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, gr: 0, dr: 0, t: 0, life: 1, c: '#fff', sz: 3, k: 0 });
  // k: 0 = square spark, 1 = velocity streak
  function fpEmit(x, y, vx, vy, gr, dr, life, c, sz, k) { var p = FP[fpi]; fpi = (fpi + 1) % FP_N; p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.gr = gr; p.dr = dr; p.t = 0; p.life = life; p.c = c; p.sz = sz; p.k = k; }
  // exact critically damped spring step toward tgt
  function crit(s, tgt, w, dt) { var d = s.x - tgt, e = Math.exp(-w * dt), k = s.v + w * d; s.x = tgt + (d + k * dt) * e; s.v = (s.v - w * k * dt) * e; }
  function fnoise(t, sd) { return Math.sin(t + sd) * 0.55 + Math.sin(t * 2.31 + sd * 1.7) * 0.3 + Math.sin(t * 4.73 + sd * 2.9) * 0.15; }
  function feelInit() {
    fs.x = px; fs.v = 0; fj.air = false; fj.y = 0; fj.v = 0; fj.buf = -9999;
    fx.hs = 0; fx.cannon = cannonT; fx.level = level; fx.coinN = coinN;
  }
  function feelHit() { fx.hs = 0.07; }
  function feelBoom(x, y) {
    fx.hs = 0.07;
    for (var i = 0; i < 22; i++) { var a = Math.random() * 6.283, v = 140 + Math.random() * 380; fpEmit(x, y, Math.cos(a) * v, Math.sin(a) * v - 220, 1100, 0.6, 0.55 + Math.random() * 0.35, DEB_C[i % 4], 2 + Math.random() * 2, 1); }
  }
  // world step, called from update() after the jump timer: owns px and jump height
  function feelUpdate(dt) {
    crit(fs, lane, LANE_W, dt); px = fs.x;
    var hu = lw() * 0.8, x0 = X(px, 1);
    if (jumpT >= 0 && !fj.air) { fj.air = true; fj.y = 0; fj.v = J_V0; }
    if (fj.air) {
      if (jumpT < 0) {
        fj.air = false; fj.y = 0;
        for (var i = 0; i < 9; i++) { var sd = i % 2 ? 1 : -1; fpEmit(x0 + sd * hu * 0.15, by, sd * (60 + Math.random() * 160), -20 - Math.random() * 60, 200, 4, 0.3 + Math.random() * 0.2, i % 3 ? THEMES[track].b : '#ffffff', 2 + Math.random() * 2, 0); }
        if (performance.now() - fj.buf <= 150) { fj.buf = -9999; inputInner('jump'); }
      } else { var gr = fj.v > 0 ? J_GU : J_GD; fj.y = Math.max(0, fj.y + fj.v * dt - 0.5 * gr * dt * dt); fj.v -= gr * dt; }
    }
    var jy = jumpT >= 0 ? fj.y : 0;
    if (Math.abs(fs.v) > 4 && dt > 0) fpEmit(x0, by - jy * hu * 0.9 - hu * (0.2 + Math.random() * 0.6), -fs.v * 18, 0, 0, 6, 0.22, THEMES[track].b, 2.5, 1);
    if (coinN > fx.coinN) {
      var cy = by - hu * (0.35 + jy * 0.9);
      for (var c = 0; c < 10; c++) { var a = Math.random() * 6.283, v = 40 + Math.random() * 120; fpEmit(x0, cy, Math.cos(a) * v, Math.sin(a) * v - 90, -60, 2, 0.35 + Math.random() * 0.25, c % 3 ? '#ffe14a' : '#ffffff', 2 + Math.random() * 2.5, 0); }
    }
    fx.coinN = coinN;
  }
  // per frame from loop(): clocks, hit-stop, camera, particles. returns dt for update()
  function feelStop(dt) {
    if (state === 'running' && fx.st !== 'running') feelInit();
    fx.st = state;
    var rdt = paused ? 0 : dt, stop = fx.hs > 0;
    fx.rt += rdt; fx.hs = Math.max(0, fx.hs - rdt);
    var wdt = stop ? 0 : rdt * (slowT > 0 ? 0.25 : 1);
    if (cannonT > fx.cannon + 0.01) camZ.v += 1.6; fx.cannon = cannonT;
    if (level > fx.level) camZ.v += 2.6; fx.level = level;
    var amp = 10 * Math.pow(shake, 1.5), nt = fx.rt * 38;
    fx.sx = amp * fnoise(nt, 0); fx.sy = amp * fnoise(nt, 5.2);
    var jy = jumpT >= 0 ? fj.y : 0;
    crit(camX, (X(px, 1) - W / 2) * 0.08, 7, rdt); crit(camY, jy * lw() * 0.8 * 0.9 * 0.12, 9, rdt); crit(camZ, 0, 12, rdt);
    for (var i = 0; i < FP_N; i++) {
      var p = FP[i]; if (!p.on) continue;
      p.t += wdt; if (p.t >= p.life) { p.on = false; continue; }
      var dm = Math.max(0, 1 - p.dr * wdt); p.vx *= dm; p.vy = p.vy * dm + p.gr * wdt; p.x += p.vx * wdt; p.y += p.vy * wdt;
    }
    return stop ? 0 : dt;
  }
  // world camera: smooth shake + lagged follow + zoom punch (edge overscan hides lateral seams)
  function feelCam() {
    g.translate(fx.sx, fx.sy);
    var cx = X(px, 1), cy = by - lw() * 0.4, z = 1 + Math.max(-0.05, camZ.x) + 2 * Math.abs(camX.x) / Math.max(1, W);
    g.translate(cx, cy); g.scale(z, z); g.translate(-cx - camX.x, -cy + camY.x);
  }
  // runner transform about the feet: lean + skew from lane velocity (squash/stretch lives in round 5 asx/asy)
  function feelBody(x, y) {
    var ln = Math.max(-0.2, Math.min(0.2, fs.v * 0.015)), sk = Math.max(-0.15, Math.min(0.15, -fs.v * 0.012));
    g.translate(x, y); g.rotate(ln); g.transform(1, 0, sk, 1, 0, 0);
    g.translate(-x, -y);
  }
  function feelDraw() {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (var i = 0; i < FP_N; i++) {
      var p = FP[i]; if (!p.on) continue;
      var a = 1 - p.t / p.life; g.globalAlpha = a;
      if (p.k === 1) { g.strokeStyle = p.c; g.lineWidth = p.sz; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); g.stroke(); }
      else { var s = p.sz * (0.5 + 0.5 * a); g.fillStyle = p.c; g.fillRect(p.x - s, p.y - s, s * 2, s * 2); }
    }
    g.restore();
  }
  // ---------- end game feel ----------

  var last = performance.now();
  function loop(now) {
    var raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
    if (raw > 0) { fpsAcc += raw; fpsN++; }
    if (now - dbgT > 100) { if (fpsAcc > 0) fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; dbgT = now; if (dbgOn) renderDbg(); }
    update(feelStop(dt)); draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  report(true);
})();
