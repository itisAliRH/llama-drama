(function () {
  var cv = document.getElementById('c'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  var THEMES = [
    { sky1: '#0b1a3a', sky2: '#ff7a3c', ground: '#2b2f3a', edge: '#ffd24a', line: '#8a93a8', side: '#14301c', obs: '#e8505b', bar: '#ffb347', blk: '#7a5cff' },
    { sky1: '#050014', sky2: '#c026d3', ground: '#1a1030', edge: '#22d3ee', line: '#7c5cff', side: '#0a0a24', obs: '#ff3d81', bar: '#22d3ee', blk: '#f5f5ff' },
    { sky1: '#0f3d2e', sky2: '#d9f99d', ground: '#4a3b2a', edge: '#fef08a', line: '#c9b28a', side: '#1f5a2e', obs: '#c2410c', bar: '#facc15', blk: '#0f766e' }
  ];
  var track = 0, state = 'start', score = 0, dist = 0, speed = 7, hi = 0;
  var lane = 1, px = 1, jumpT = -1, ducking = false, obs = [], nextSpawn = 14, lastIn = '', lastInT = 0, lastReport = 0, deadT = 0, hitFlash = 0;
  var JD = 0.8, hy = 0, by = 0;
  function layout() { hy = H * 0.34; by = H * 0.9; }

  function sfx(n) { window.sfx && window.sfx.play(n); }
  var lastStep = 0;
  function report(force) {
    var now = Date.now();
    if (!force && now - lastReport < 500) return;
    lastReport = now;
    try { if (typeof window.onGameState === 'function') window.onGameState({ state: state, score: Math.floor(score), track: track }); } catch (e) {}
  }
  function reset() {
    score = 0; dist = 0; speed = 7; lane = 1; px = 1; jumpT = -1; ducking = false; obs = []; nextSpawn = 16; state = 'running'; lastStep = 0;
    sfx('start'); report(true);
  }
  function die() { sfx('hit'); sfx('dead'); state = 'dead'; deadT = performance.now(); hitFlash = 1; if (score > hi) hi = score; report(true); }

  function show(t) { lastIn = t; lastInT = performance.now(); }
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
    if (m === 'track') { track = (track + 1) % 3; sfx('track'); show('TRACK ' + (track + 1)); report(true); return; }
    if (m === 'track_prev') { track = (track + 2) % 3; sfx('track'); show('TRACK ' + (track + 1)); report(true); return; }
    if (m === 'start') { if (state !== 'running') reset(); show('START'); return; }
    if (state !== 'running') return;
    if (m === 'left') { if (lane > 0) sfx('lane'); lane = Math.max(0, lane - 1); show('LEFT'); }
    else if (m === 'right') { if (lane < 2) sfx('lane'); lane = Math.min(2, lane + 1); show('RIGHT'); }
    else if (m === 'jump') { if (ducking) { ducking = false; sfx('stand'); show('STAND'); } else { if (jumpT < 0) { jumpT = 0; sfx('jump'); } show('JUMP'); } }
    else if (m === 'duck') { if (jumpT < 0) { if (!ducking) sfx('duck'); ducking = true; } show('DUCK'); }
  }
  window.game = { input: input, debug: debug, speedMul: 1, paused: false };

  window.addEventListener('keydown', function (e) {
    var k = e.key, m = null;
    if ((k === 'd' || k === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) { setDbg(!dbgOn); return; }
    if (k === 'ArrowLeft') m = 'left'; else if (k === 'ArrowRight') m = 'right';
    else if (k === 'ArrowUp') m = 'jump'; else if (k === 'ArrowDown') m = 'duck';
    else if (k === ' ' || k === 'Enter') m = 'start';
    else if (k === 't' || k === 'T') m = 'track'; else if (k === 'r' || k === 'R') m = 'track_prev';
    if (m) { e.preventDefault(); input(m, 'keyboard'); }
  });
  // touch fallback: tap = start, swipes = moves
  var tx = 0, ty = 0;
  window.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { input('start', 'touch'); return; }
    if (Math.abs(dx) > Math.abs(dy)) input(dx > 0 ? 'right' : 'left', 'touch'); else input(dy < 0 ? 'jump' : 'duck', 'touch');
  });

  var panel = document.createElement('div'); panel.id = 'dbg'; panel.style.display = 'none'; document.body.appendChild(panel);
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
    h += row('lane', lane) + row('jump', jumpT >= 0 ? 'ACTIVE' : '-') + row('duck', ducking ? 'DUCKING' : 'standing') + row('track', track);
    h += row('last input', lastInWall ? (now - lastInWall) + ' ms ago' : 'never');
    h += '<b>Input log</b>';
    if (!inLog.length) h += '<div class="m">none</div>';
    inLog.forEach(function (e) { h += '<div>' + hms(e.t) + ' ' + esc(e.m) + ' <i>' + esc(e.s) + '</i></div>'; });
    h += '<b>Sensors</b>';
    var ks = Object.keys(sensors);
    if (!ks.length) h += '<div class="m">no data</div>';
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

  function spawn() {
    var r = Math.random(), row = [];
    var type = r < 0.34 ? 'low' : r < 0.6 ? 'high' : 'block';
    if (type === 'block') {
      var n = Math.random() < 0.4 ? 2 : 1, free = Math.floor(Math.random() * 3);
      for (var l = 0; l < 3; l++) if (n === 2 ? l !== free : l === free) row.push(l);
      if (n === 1) { row = [Math.floor(Math.random() * 3)]; }
    } else { row = [0, 1, 2]; }
    row.forEach(function (l) { obs.push({ lane: l, d: 70, type: type }); });
    if (speed > 16 && Math.random() < Math.min(0.5, (speed - 16) / 30)) {
      var t2 = Math.random() < 0.5 ? 'low' : 'high', d2 = 70 + speed * 1.05;
      [0, 1, 2].forEach(function (l) { obs.push({ lane: l, d: d2, type: t2 }); });
    }
  }
  // perspective scale; linear continuation for d<0 so objects keep growing past the player
  function sc(d) { return d >= 0 ? 1 / (1 + d * 0.14) : 1 - d * 0.14; }
  function lw() { return Math.min(W * 0.2, H * 0.5); }
  function X(l, s) { return W / 2 + (l - 1) * lw() * s; }
  function Y(s) { return hy + (by - hy) * s; }
  function offscreen(o) { var s = sc(o.d); return Y(s) - lw() * 1.2 * s > H + 20; }

  function update(dt) {
    if (state !== 'running' || window.game.paused) return;
    var sm = +window.game.speedMul; if (!(sm > 0)) sm = 1;
    speed = Math.min(6 + dist / 45, 42) * sm;
    var step = Math.floor(speed / 4); if (step > lastStep) { if (lastStep > 0) sfx('speedup'); lastStep = step; } else if (lastStep === 0) lastStep = step;
    var adv = speed * dt; dist += adv; score += adv * 1.0;
    px += (lane - px) * Math.min(1, dt * 12);
    if (jumpT >= 0) { jumpT += dt; if (jumpT >= JD) jumpT = -1; }
    nextSpawn -= adv;
    if (nextSpawn <= 0) { spawn(); nextSpawn = Math.max(speed * 0.9, 22 - dist / 60) + Math.random() * (4 + speed * 0.2); }
    layout();
    var jh = jumpT >= 0 ? Math.sin(Math.PI * jumpT / JD) : 0;
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; o.d -= adv;
      if (o.d < 0 && offscreen(o)) { obs.splice(i, 1); continue; }
      if (Math.abs(o.d) < 0.55 && Math.abs(px - o.lane) < 0.6) {
        if (o.type === 'block') die();
        else if (o.type === 'low' && jh < 0.3) die();
        else if (o.type === 'high' && !ducking) die();
        if (state === 'dead') return;
      }
    }
    report(false);
  }

  function draw(now) {
    var T = THEMES[track];
    layout();
    var gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, T.sky1); gr.addColorStop(1, T.sky2);
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
    g.fillStyle = T.side; g.fillRect(0, hy, W, H - hy);
    // road
    var s0 = 0.02, hw = 1.5;
    g.fillStyle = T.ground; g.beginPath();
    g.moveTo(X(1, s0) - hw * lw() * s0, Y(s0)); g.lineTo(X(1, s0) + hw * lw() * s0, Y(s0));
    g.lineTo(X(1, 1.4) + hw * lw() * 1.4, Y(1.4)); g.lineTo(X(1, 1.4) - hw * lw() * 1.4, Y(1.4)); g.fill();
    // scrolling dashes
    var off = (dist % 4) / 4;
    for (var k = 0; k < 18; k++) {
      var d0 = k * 4 - off * 4, d1 = d0 + 2; if (d0 < -1) continue;
      var a = sc(Math.max(d0, 0)), b = sc(d1);
      g.fillStyle = T.line;
      [0.5, 1.5].forEach(function (lx) {
        var xa = X(lx, a) - 2 * a, xb = X(lx, b) - 2 * b;
        g.beginPath(); g.moveTo(xa, Y(a)); g.lineTo(xa + 4 * a, Y(a)); g.lineTo(xb + 4 * b, Y(b)); g.lineTo(xb, Y(b)); g.fill();
      });
      // side stripes
      g.fillStyle = (k % 2) ? T.edge : T.line;
      [-0.5, 2.5].forEach(function (lx) {
        var xa = X(lx, a), xb = X(lx, b);
        g.beginPath(); g.moveTo(xa, Y(a)); g.lineTo(xa + 10 * a, Y(a)); g.lineTo(xb + 10 * b, Y(b)); g.lineTo(xb, Y(b)); g.fill();
      });
    }
    // obstacles far -> near
    var hu = lw() * 0.8;
    var list = obs.slice().sort(function (a, b) { return b.d - a.d; });
    var jh = jumpT >= 0 ? Math.sin(Math.PI * jumpT / JD) : 0;
    var playerDrawn = false;
    function player() {
      var x = X(px, 1), y = by - jh * hu * 0.9;
      var ph = ducking ? hu * 0.55 : hu * 1.1, pw = hu * 0.45;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, by, pw, pw * 0.25, 0, 0, 7); g.fill();
      g.fillStyle = '#f5f5f5'; g.fillRect(x - pw / 2, y - ph, pw, ph);
      g.fillStyle = T.edge; g.fillRect(x - pw / 2, y - ph, pw, ph * 0.28);
      g.fillStyle = '#111'; g.fillRect(x - pw * 0.3, y - ph * 0.85, pw * 0.6, ph * 0.08);
      if (ducking) { g.textAlign = 'center'; g.font = '900 ' + Math.max(14, H * 0.035) + 'px system-ui,Arial,sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.8)'; g.fillStyle = '#ffd24a'; g.strokeText('DUCKING', x, y - ph - 8); g.fillText('DUCKING', x, y - ph - 8); }
    }
    list.forEach(function (o) {
      if (!playerDrawn && o.d < 0) { player(); playerDrawn = true; }
      var s = sc(o.d);
      var x = X(o.lane, s), y = Y(s), w = lw() * 0.8 * s, h = hu * s;
      if (o.type === 'low') {
        g.fillStyle = T.obs; g.fillRect(x - w / 2, y - h * 0.35, w, h * 0.35);
        g.fillStyle = '#fff'; g.fillRect(x - w / 2, y - h * 0.35, w, h * 0.07);
      } else if (o.type === 'high') {
        g.fillStyle = '#444'; g.fillRect(x - w / 2, y - h * 1.5, w * 0.08, h * 1.5); g.fillRect(x + w / 2 - w * 0.08, y - h * 1.5, w * 0.08, h * 1.5);
        g.fillStyle = T.bar; g.fillRect(x - w / 2, y - h * 1.3, w, h * 0.5);
      } else {
        g.fillStyle = T.blk; g.fillRect(x - w / 2, y - h * 1.3, w, h * 1.3);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - w / 2, y - h * 1.3, w, h * 0.12);
      }
    });
    if (!playerDrawn) player();
    // HUD
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineJoin = 'round';
    function txt(t, x, y, sz) { g.font = '900 ' + sz + 'px system-ui,Arial,sans-serif'; g.lineWidth = sz / 8; g.strokeText(t, x, y); g.fillText(t, x, y); }
    txt(String(Math.floor(score)), W / 2, Math.max(56, H * 0.12), Math.max(40, H * 0.1));
    if (ducking && state === 'running') txt('DUCKING', W / 2, Math.max(100, H * 0.2), Math.max(22, H * 0.05));
    var age = now - lastInT;
    if (lastIn && age < 500) {
      g.globalAlpha = 1 - age / 500; txt(lastIn, W / 2, H * 0.55, Math.max(48, H * 0.16)); g.globalAlpha = 1;
    }
    if (state === 'start') {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
      txt('BARE METAL RUN', W / 2, H * 0.35, Math.max(36, H * 0.12));
      txt('Press START', W / 2, H * 0.52, Math.max(28, H * 0.07));
      txt('jump low barriers, duck high bars, dodge blocks', W / 2, H * 0.65, Math.max(16, H * 0.04));
    } else if (state === 'dead') {
      g.fillStyle = 'rgba(120,0,0,.55)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
      txt('GAME OVER', W / 2, H * 0.34, Math.max(40, H * 0.13));
      txt('Score ' + Math.floor(score), W / 2, H * 0.5, Math.max(32, H * 0.09));
      txt('Best ' + Math.floor(hi), W / 2, H * 0.6, Math.max(20, H * 0.05));
      txt('Press START to restart', W / 2, H * 0.74, Math.max(22, H * 0.06));
    }
  }

  var last = performance.now();
  function loop(now) {
    var raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
    if (raw > 0) { fpsAcc += raw; fpsN++; }
    if (now - dbgT > 100) { if (fpsAcc > 0) fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; dbgT = now; if (dbgOn) renderDbg(); }
    update(dt); draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  report(true);
})();
