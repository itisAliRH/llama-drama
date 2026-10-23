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

  // themes: sky top/bottom, sun, far/near mountains, stone tiles a/b, curb, wall a/b, grass, leaf a/b, fog
  var THEMES = [
    { sky1: '#2a6fb5', sky2: '#ffc27a', sun: '#fff1b8', m1: '#6f8fb0', m2: '#3d6b55', ta: '#9c8f78', tb: '#8a7d67', curb: '#c9b88f', wa: '#6e5a42', wb: '#5d4b36', grass: '#2f6b2f', la: '#2e8b3a', lb: '#1f6a2c', fog: '255,214,160' },
    { sky1: '#1a0b3d', sky2: '#ff6a5c', sun: '#ffd0a0', m1: '#5a3a7a', m2: '#2a2050', ta: '#7d6f86', tb: '#6c5f75', curb: '#b79ac4', wa: '#4f3b57', wb: '#42304a', grass: '#27402f', la: '#3b7a5a', lb: '#2a5a45', fog: '255,150,130' },
    { sky1: '#0f4d3a', sky2: '#e8f5a8', sun: '#fffbd0', m1: '#4f8a6a', m2: '#1f5a36', ta: '#a89a6a', tb: '#968858', curb: '#d9cc8a', wa: '#7a6a3a', wb: '#675830', grass: '#2d6a28', la: '#4aa23a', lb: '#2f7a2a', fog: '230,245,170' }
  ];
  var track = 0, state = 'start', score = 0, dist = 0, speed = 7, hi = 0;
  var lane = 1, px = 1, jumpT = -1, ducking = false, obs = [], nextSpawn = 14, lastIn = '', lastInT = 0, lastReport = 0, deadT = 0, hitFlash = 0;
  var JD = 0.8, hy = 0, by = 0, shake = 0, parts = [], lastBand = 0, wasAir = false;
  function layout() { hy = H * 0.34; by = H * 0.9; }

  var paused = false, extPause = false, deathMsg = '', gt = 0, sliding = false, slideLeft = 0, slideTotal = 1, laneCh = null, actT = -9, actKind = '', nmT = -99, nmCount = 0, pops = [], intT = 0;
  var forkAt = 0, forkPrev = -1e9, choice = null, turnT = 0, turnDir = 0;
  function schedFork() { forkAt = dist + speed * (20 + Math.random() * 15); }
  function forkLeftS() { return speed > 0 ? (forkAt - dist) / speed : 99; }
  function sfx(n) { try { window.sfx && window.sfx.play(n); } catch (e) {} }
  function sfxCall(f, a) { try { if (window.sfx && window.sfx[f]) window.sfx[f](a); } catch (e) {} }
  function cfg() { try { return (window.settings && window.settings.get && window.settings.get()) || {}; } catch (e) { return {}; } }
  function duckMode() { return cfg().duckMode === 'slide' ? 'slide' : 'hold'; }
  function slideMs() { var v = +cfg().slideMs; return v >= 400 && v <= 1500 ? v : 800; }
  function setPause(on, ext) {
    on = !!on; if (on === paused) return;
    if (on && state !== 'running') return;
    paused = on; extPause = on && !!ext; sfx(on ? 'pause' : 'resume'); sfxCall('duck', on);
    if (on) show('PAUSED');
  }
  function pop(text, col) { pops.push({ t: text, col: col || '#ffd24a', age: 0 }); if (pops.length > 4) pops.shift(); }
  function nearMiss() {
    nmCount = (gt - nmT < 3) ? Math.min(3, nmCount + 1) : 1; nmT = gt;
    score += 25 * nmCount; pop('NEAR MISS!', '#7ff0ff'); sfx('nearmiss');
    if (nmCount >= 2) { pop('COMBO x' + nmCount, '#ffd24a'); sfx('combo'); }
  }
  function report(force) {
    var now = Date.now();
    if (!force && now - lastReport < 500) return;
    lastReport = now;
    try { if (typeof window.onGameState === 'function') window.onGameState({ state: state, score: Math.floor(score), track: track }); } catch (e) {}
  }
  function reset() {
    score = 0; dist = 0; speed = 7; lane = 1; px = 1; jumpT = -1; ducking = false; obs = []; nextSpawn = 16; state = 'running'; parts = []; lastBand = 0; wasAir = false;
    forkPrev = -1e9; choice = null; turnT = 0; turnDir = 0; paused = false; extPause = false; deathMsg = ''; gt = 0; sliding = false; slideLeft = 0; laneCh = null; actT = -9; actKind = ''; nmT = -99; nmCount = 0; pops = []; intT = 0;
    schedFork();
    sfxCall('duck', false); sfxCall('music', true);
    sfx('start'); report(true);
  }
  function die(msg) { deathMsg = msg || ''; state = 'dead'; paused = false; extPause = false; sliding = false; sfxCall('music', false); sfxCall('duck', false); deadT = performance.now(); hitFlash = 1; shake = 1; if (score > hi) hi = score; burst(X(px, 1), by - lw() * 0.4, 36, 'rock'); sfx('hit'); sfx('dead'); report(true); }

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
    if (m === 'track' || m === 'track_prev') {
      var right = m === 'track';
      if (state === 'running') {
        if (paused || forkLeftS() > 3) return;
        choice = right ? 'right' : 'left'; show(right ? 'RIGHT >' : '< LEFT'); sfx('lane'); return;
      }
      track = (track + (right ? 1 : 2)) % 3; show('TRACK ' + (track + 1)); sfx('track'); report(true); return;
    }
    if (m === 'pause') { if (state === 'running' && !extPause) setPause(!paused); return; }
    if (m === 'start') { if (paused) { if (!extPause) setPause(false); return; } if (state !== 'running') reset(); show('START'); return; }
    if (state !== 'running' || paused) return;
    if (m === 'left') { if (lane > 0) { laneCh = { t: gt, from: lane, to: lane - 1 }; lane--; dust(); sfx('lane'); } show('LEFT'); }
    else if (m === 'right') { if (lane < 2) { laneCh = { t: gt, from: lane, to: lane + 1 }; lane++; dust(); sfx('lane'); } show('RIGHT'); }
    else if (m === 'jump') {
      if (ducking && sliding) { ducking = false; sliding = false; slideLeft = 0; if (jumpT < 0) { jumpT = 0; actT = gt; actKind = 'jump'; sfx('jump'); } show('JUMP'); }
      else if (ducking) { ducking = false; show('STAND'); sfx('stand'); }
      else { if (jumpT < 0) { jumpT = 0; actT = gt; actKind = 'jump'; sfx('jump'); } show('JUMP'); }
    }
    else if (m === 'duck') {
      if (duckMode() === 'slide') {
        if (jumpT < 0 && !sliding) { sliding = true; ducking = true; slideTotal = slideMs() / 1000; slideLeft = slideTotal; actT = gt; actKind = 'duck'; sfx('slide'); dust(); }
        show('SLIDE');
      } else {
        if (jumpT < 0) { if (!ducking) { sfx('duck'); actT = gt; actKind = 'duck'; } ducking = true; } show('DUCK');
      }
    }
  }
  window.game = { input: input, debug: debug };
  Object.defineProperty(window.game, 'paused', { get: function () { return paused; }, set: function (v) { if (v) setPause(true, true); else if (extPause) setPause(false); }, enumerable: true });

  window.addEventListener('keydown', function (e) {
    var k = e.key, m = null;
    if (k === 'p' || k === 'P' || k === 'Escape') { if (extPause) return; e.preventDefault(); if (!e.repeat) input('pause', 'keyboard'); return; }
    if ((k === 'f' || k === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) { if (state === 'running' && !paused) { forkAt = dist + speed * 4; choice = null; show('FORK SOON'); } return; }
    if ((k === 'd' || k === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) { setDbg(!dbgOn); return; }
    if (k === 'ArrowLeft') m = 'left'; else if (k === 'ArrowRight') m = 'right';
    else if (k === 'ArrowUp') m = 'jump'; else if (k === 'ArrowDown') m = 'duck';
    else if (k === ' ' || k === 'Enter') m = 'start';
    else if (k === 't' || k === 'T' || k === 'e' || k === 'E') m = 'track'; else if (k === 'r' || k === 'R' || k === 'q' || k === 'Q') m = 'track_prev';
    if (m) { e.preventDefault(); if (e.repeat && m !== 'duck') return; if (e.repeat) return; input(m, 'keyboard'); }
  });
  // hold-to-duck on keyboard: release stands up
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowDown' && ducking && !sliding && state === 'running' && !paused) { ducking = false; show('STAND'); sfx('stand'); }
  });
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
    row.forEach(function (l) { obs.push({ lane: l, d: 70, type: type, v: Math.random() }); });
    if (speed > 16 && Math.random() < Math.min(0.5, (speed - 16) / 30)) {
      var t2 = Math.random() < 0.5 ? 'low' : 'high', d2 = 70 + speed * 1.05;
      [0, 1, 2].forEach(function (l) { obs.push({ lane: l, d: d2, type: t2, v: Math.random() }); });
    }
  }
  function sc(d) { return d >= 0 ? 1 / (1 + d * 0.14) : 1 - d * 0.14; }
  function lw() { return Math.min(W * 0.2, H * 0.5); }
  function X(l, s) { return W / 2 + (l - 1) * lw() * s; }
  function Y(s) { return hy + (by - hy) * s; }
  function offscreen(o) { var s = sc(o.d); return Y(s) - lw() * 1.2 * s > H + 20; }
  function rnd(i) { var x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); }

  // particles
  function burst(x, y, n, kind) {
    var T = THEMES[track];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, sp = 80 + Math.random() * (kind === 'rock' ? 420 : 160);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'rock' ? 200 : 60), life: 0, max: 0.5 + Math.random() * 0.5, r: 2 + Math.random() * (kind === 'rock' ? 6 : 4), col: kind === 'rock' ? (i % 2 ? T.wa : T.curb) : 'rgba(225,205,160,.8)', g: kind === 'rock' ? 900 : 120 });
    }
  }
  function dust() { burst(X(px, 1), by, 12, 'dust'); }

  function update(dt) {
    if (paused) return;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      if (p.life > p.max) parts.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 2.2); hitFlash = Math.max(0, hitFlash - dt * 1.8);
    if (state !== 'running') return;
    var prevBand = Math.floor(speed / 6);
    speed = Math.min(6 + dist / 45, 42);
    if (Math.floor(speed / 6) > prevBand && dist > 50) { sfx('speedup'); show('FASTER'); }
    gt += dt;
    if (turnT > 0) turnT = Math.max(0, turnT - dt);
    if (sliding) { slideLeft -= dt; if (slideLeft <= 0) { sliding = false; ducking = false; sfx('stand'); } }
    for (var q = pops.length - 1; q >= 0; q--) { pops[q].age += dt; if (pops[q].age > 1.1) pops.splice(q, 1); }
    intT += dt; if (intT >= 1) { intT = 0; sfxCall('setIntensity', Math.max(0, Math.min(1, (speed - 6) / 36))); }
    var adv = speed * dt; dist += adv; score += adv * 1.0;
    if (sliding && Math.random() < 0.7) burst(X(px, 1) - lw() * 0.25, by, 2, 'dust');
    px += (lane - px) * Math.min(1, dt * 12);
    if (jumpT >= 0) { jumpT += dt; wasAir = true; if (jumpT >= JD) { jumpT = -1; burst(X(px, 1), by, 8, 'dust'); } }
    if (forkAt - dist <= 0) {
      if (!choice) { die('Missed the TURN!'); return; }
      turnDir = choice === 'left' ? -1 : 1; turnT = 0.4; track = (track + (turnDir > 0 ? 1 : 2)) % 3;
      score += 50; pop('TURN +50', '#ffd24a'); sfx('turn'); burst(X(px, 1), by, 14, 'dust'); report(true);
      choice = null; forkPrev = dist; schedFork();
    }
    nextSpawn -= adv;
    if (nextSpawn <= 0) { spawn(); nextSpawn = Math.max(speed * 0.9, 22 - dist / 60) + Math.random() * (4 + speed * 0.2); }
    // clear runway: none within 4 s before the fork or 1.5 s after (distance at current speed)
    var zF = forkAt - dist, zA = zF - speed * 4, zB = zF + speed * 1.5, pA = forkPrev - dist, pB = pA + speed * 1.5;
    for (var z = obs.length - 1; z >= 0; z--) { var od = obs[z].d; if ((od >= zA && od <= zB) || (od >= pA && od <= pB && od > -0.6)) obs.splice(z, 1); }
    layout();
    var jh = jumpT >= 0 ? Math.sin(Math.PI * jumpT / JD) : 0, nm = false;
    for (var j = obs.length - 1; j >= 0; j--) {
      var o = obs[j]; o.d -= adv;
      if (o.d < 0 && offscreen(o)) { obs.splice(j, 1); continue; }
      if (Math.abs(o.d) < 0.55 && Math.abs(px - o.lane) < 0.6) {
        if (o.type === 'block') die('Hit BLOCK - change lane!');
        else if (o.type === 'low' && jh < 0.5) die('Hit LOW BARRIER - jump!');
        else if (o.type === 'high' && !ducking) die('Hit HIGH BAR - duck!');
        if (state === 'dead') return;
      }
      if (!o.chk && o.d <= 0.55) {
        o.chk = true;
        var ol = o.lane, mine = Math.abs(px - ol) < 0.6;
        if (mine) {
          if (o.type === 'low' && actKind === 'jump' && gt - actT < 0.2) nm = true;
          else if (o.type === 'high' && actKind === 'duck' && gt - actT < 0.2) nm = true;
        } else if (o.type === 'block' && laneCh) {
          if (laneCh.from === ol && gt - laneCh.t < 0.25) nm = true;
          else if (Math.abs(ol - lane) === 1 && laneCh.to === lane && gt - laneCh.t < 0.12) nm = true;
        }
      }
    }
    if (nm) nearMiss();
    report(false);
  }

  function quad(x1, y1, x2, y2, x3, y3, x4, y4, col) {
    g.fillStyle = col; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4); g.closePath(); g.fill();
  }
  function rr(x, y, w, h, r, col) {
    g.fillStyle = col; g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
    g.fill();
  }

  function drawSky(T, now) {
    var gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, T.sky1); gr.addColorStop(1, T.sky2);
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
    // sun + glow
    var sx = W * 0.5 - (px - 1) * W * 0.02, sy = hy * 0.62, sr = Math.min(W, H) * 0.075;
    var rg = g.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 4);
    rg.addColorStop(0, 'rgba(255,240,200,.65)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = rg; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    g.fillStyle = T.sun; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
    // clouds
    g.fillStyle = 'rgba(255,255,255,.28)';
    for (var c = 0; c < 5; c++) {
      var cx = ((c * 0.27 * W + now * 0.004 * (1 + c * 0.3) - (px - 1) * 15) % (W + 300)) - 150, cy = hy * (0.15 + 0.12 * c % 0.5);
      g.beginPath(); g.ellipse(cx, cy, 70 + c * 8, 14, 0, 0, 7); g.ellipse(cx + 40, cy - 8, 40, 12, 0, 0, 7); g.fill();
    }
    // mountains, 2 parallax layers
    [[T.m1, 0.32, 0.011, 1.0, 0.8], [T.m2, 0.2, 0.017, 1.7, 1.6]].forEach(function (L) {
      var off = -(px - 1) * W * 0.03 * L[4] + dist * 0.15 * L[4] * 0.1;
      g.fillStyle = L[0]; g.beginPath(); g.moveTo(0, hy + 2);
      for (var x = 0; x <= W + 8; x += 8) {
        var v = Math.sin((x + off) * L[2]) * 0.5 + Math.sin((x + off) * L[2] * 2.7 + L[3]) * 0.3 + 0.5;
        g.lineTo(x, hy - v * hy * L[1]);
      }
      g.lineTo(W, hy + 2); g.closePath(); g.fill();
    });
  }

  function drawTree(x, base, h, T, seed) {
    var tw = h * 0.1;
    g.fillStyle = '#4a3322'; g.fillRect(x - tw / 2, base - h * 0.5, tw, h * 0.5);
    g.fillStyle = seed > 0.5 ? T.la : T.lb;
    g.beginPath(); g.arc(x, base - h * 0.65, h * 0.3, 0, 7); g.arc(x - h * 0.2, base - h * 0.5, h * 0.22, 0, 7); g.arc(x + h * 0.2, base - h * 0.5, h * 0.22, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(x - h * 0.08, base - h * 0.72, h * 0.14, 0, 7); g.fill();
  }

  function drawWorld(T) {
    // ground beyond cliffs
    var gg = g.createLinearGradient(0, hy, 0, H);
    gg.addColorStop(0, T.m2); gg.addColorStop(0.3, T.grass); gg.addColorStop(1, T.lb);
    g.fillStyle = gg; g.fillRect(0, hy, W, H - hy);
    // road base
    var s0 = 0.02;
    quad(X(-0.5, s0), Y(s0), X(2.5, s0), Y(s0), X(2.5, 1.5), Y(1.5), X(-0.5, 1.5), Y(1.5), T.tb);
    var BAND = 3, off = dist % BAND, base = Math.floor(dist / BAND);
    for (var k = 30; k >= -4; k--) {
      var d0 = k * BAND - off, d1 = d0 + BAND;
      var sa = sc(d0), sb = sc(d1), ya = Y(sa), yb = Y(sb), idx = base + k;
      var even = (idx & 1) === 0;
      // stone tiles
      quad(X(-0.5, sa), ya, X(2.5, sa), ya, X(2.5, sb), yb, X(-0.5, sb), yb, even ? T.ta : T.tb);
      // tile joints
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = Math.max(1, 2 * sa);
      g.beginPath(); g.moveTo(X(-0.5, sa), ya); g.lineTo(X(2.5, sa), ya);
      [0.5, 1.5].forEach(function (lx) { g.moveTo(X(lx, sa), ya); g.lineTo(X(lx, sb), yb); });
      g.stroke();
      if (state === 'running') {
        var fr = forkAt - dist;
        if (d1 > fr && fr > -3) {
          var ga = Math.max(0, Math.min(1, (d0 - fr) / 9)) * 0.95, gb = Math.max(0, Math.min(1, (d1 - fr) / 9)) * 0.95;
          var fc = 'rgb(' + T.fog + ')';
          quad(X(1 - ga, sa), ya, X(1 + ga, sa), ya, X(1 + gb, sb), yb, X(1 - gb, sb), yb, T.m2);
          if (d0 < fr) { // split cut line
            quad(X(-0.5, sa), ya, X(2.5, sa), ya, X(2.5, sa), ya, X(-0.5, sa), ya, T.m2);
          }
        }
      }
      // curbs
      quad(X(-0.5, sa), ya, X(-0.68, sa), ya, X(-0.68, sb), yb, X(-0.5, sb), yb, T.curb);
      quad(X(2.5, sa), ya, X(2.68, sa), ya, X(2.68, sb), yb, X(2.5, sb), yb, T.curb);
      // cliff walls (face toward road)
      var ha = lw() * 0.9 * sa, hb = lw() * 0.9 * sb, wc = even ? T.wa : T.wb;
      quad(X(-0.68, sa), ya, X(-0.68, sb), yb, X(-0.68, sb), yb - hb, X(-0.68, sa), ya - ha, wc);
      quad(X(2.68, sa), ya, X(2.68, sb), yb, X(2.68, sb), yb - hb, X(2.68, sa), ya - ha, wc);
      g.fillStyle = 'rgba(0,0,0,.18)';
      // moss lip
      g.fillStyle = T.la; g.fillRect(Math.min(X(-0.68, sa), X(-0.68, sb)) - 1, yb - hb - 2 * sb, 1, 1);
      // trees on plateaus
      var r = rnd(idx), r2 = rnd(idx + 977);
      if (sa < 1.2 && d0 > -3) {
        var hh = lw() * (0.7 + r * 0.6) * sa;
        drawTree(X(-0.68 - 0.5 - r2 * 1.6, sa), ya - ha, hh, T, r);
        drawTree(X(2.68 + 0.5 + r * 1.6, sa), ya - ha, lw() * (0.7 + r2 * 0.6) * sa, T, r2);
      }
    }
    if (state === 'running') { // fork stripe + arrow signs
      var fd = forkAt - dist;
      if (fd > 0 && fd < 60) {
        var fs = sc(fd), fy = Y(fs), sz2 = lw() * fs;
        quad(X(-0.5, fs), fy, X(2.5, fs), fy, X(2.5, fs), fy - sz2 * 0.05, X(-0.5, fs), fy - sz2 * 0.05, 'rgba(255,210,70,.85)');
        [[-0.95, '<'], [2.95, '>']].forEach(function (a) {
          var sd = Math.max(0, fd - 6), ss = sc(sd), sx2 = X(a[0], ss), sy2 = Y(ss), bw = lw() * 0.7 * ss, bh = lw() * 0.8 * ss;
          g.fillStyle = '#4a3322'; g.fillRect(sx2 - bw * 0.05, sy2 - bh, bw * 0.1, bh);
          rr(sx2 - bw / 2, sy2 - bh * 1.5, bw, bh * 0.6, 4 * ss, '#ffd24a');
          g.fillStyle = '#3a2410'; g.font = '900 ' + Math.max(8, bh * 0.5) + 'px system-ui,Arial,sans-serif'; g.textAlign = 'center'; g.fillText(a[1], sx2, sy2 - bh * 1.05);
        });
      }
    }
    // fog toward horizon
    var fg = g.createLinearGradient(0, hy - 4, 0, hy + (by - hy) * 0.32);
    fg.addColorStop(0, 'rgba(' + T.fog + ',.95)'); fg.addColorStop(1, 'rgba(' + T.fog + ',0)');
    g.fillStyle = fg; g.fillRect(0, hy - 4, W, (by - hy) * 0.32 + 4);
  }

  function drawObstacle(o, T) {
    var s = sc(o.d), x = X(o.lane, s), y = Y(s), w = lw() * 0.85 * s, h = lw() * 0.8 * s;
    if (o.d > 20) { g.globalAlpha = Math.max(0.3, 1 - (o.d - 20) / 40); }
    // contact shadow
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y, w * 0.55, h * 0.1, 0, 0, 7); g.fill();
    if (o.type === 'low') {
      // carved stone barrier
      var bh = h * 0.38;
      rr(x - w / 2, y - bh, w, bh, 3 * s, '#8c8574');
      g.fillStyle = '#a9a28f'; g.fillRect(x - w / 2, y - bh, w, bh * 0.22);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - w / 2, y - bh * 0.35, w, bh * 0.08);
      g.fillStyle = '#6d6757'; for (var i = 0; i < 3; i++) g.fillRect(x - w * 0.36 + i * w * 0.3, y - bh * 0.7, w * 0.12, bh * 0.28);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = Math.max(1, 2 * s); g.strokeRect(x - w / 2, y - bh, w, bh);
    } else if (o.type === 'high') {
      // tree trunk bar between two stumps
      var py = y - h * 1.425, th = h * 0.45;
      g.fillStyle = '#6a6455'; g.fillRect(x - w / 2, py, w * 0.1, h * 1.425); g.fillRect(x + w / 2 - w * 0.1, py, w * 0.1, h * 1.425);
      var lg = g.createLinearGradient(0, py, 0, py + th);
      lg.addColorStop(0, '#9a6b3d'); lg.addColorStop(0.5, '#6e4a28'); lg.addColorStop(1, '#4a301a');
      rr(x - w * 0.62, py, w * 1.24, th, th / 2, lg);
      g.fillStyle = '#c99a62'; g.beginPath(); g.ellipse(x - w * 0.62 + th * 0.2, py + th / 2, th * 0.2, th * 0.5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, s * 2);
      g.beginPath(); g.moveTo(x - w * 0.4, py + th * 0.35); g.lineTo(x - w * 0.1, py + th * 0.35); g.moveTo(x + w * 0.1, py + th * 0.65); g.lineTo(x + w * 0.45, py + th * 0.65); g.stroke();
    } else {
      // rock wall
      var rh = h * 1.35;
      g.fillStyle = '#7b7566'; g.beginPath();
      g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - rh * 0.8); g.lineTo(x - w * 0.3, y - rh); g.lineTo(x + w * 0.15, y - rh * 0.92); g.lineTo(x + w / 2, y - rh * 0.78); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x - w / 2, y - rh * 0.8); g.lineTo(x - w * 0.3, y - rh); g.lineTo(x + w * 0.15, y - rh * 0.92); g.lineTo(x - w * 0.1, y - rh * 0.7); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = Math.max(1, 2 * s);
      g.beginPath(); g.moveTo(x - w * 0.1, y - rh * 0.9); g.lineTo(x - w * 0.2, y - rh * 0.5); g.lineTo(x, y - rh * 0.3); g.moveTo(x + w * 0.25, y - rh * 0.7); g.lineTo(x + w * 0.15, y - rh * 0.35); g.stroke();
      g.fillStyle = T.la; g.fillRect(x - w * 0.45, y - rh * 0.5, w * 0.12, rh * 0.12);
    }
    g.globalAlpha = 1;
  }

  function drawPlayer(T, now) {
    var x = X(px, 1), hu = lw() * 0.8, H0 = hu * 1.1;
    var jh = jumpT >= 0 ? Math.sin(Math.PI * jumpT / JD) : 0;
    var feet = by - jh * hu * 1.05;
    // shadow shrinks while airborne
    g.fillStyle = 'rgba(0,0,0,' + (0.38 - jh * 0.2) + ')'; g.beginPath(); g.ellipse(x, by, H0 * 0.3 * (1 - jh * 0.35), H0 * 0.07 * (1 - jh * 0.35), 0, 0, 7); g.fill();
    var run = state === 'running' && jumpT < 0;
    var ph = dist * 1.1, sw = run ? Math.sin(ph) : 0, sw2 = run ? Math.sin(ph + Math.PI) : 0;
    var bob = run ? Math.abs(Math.cos(ph)) * H0 * 0.03 : 0;
    var legL = sliding ? H0 * 0.16 : ducking ? H0 * 0.22 : H0 * 0.44, torsoL = H0 * 0.32, headR = H0 * 0.095;
    var lean = sliding ? 1.3 : ducking ? 0.9 : (jumpT >= 0 ? 0.15 : 0.12);
    var hipx = x, hipy = feet - legL - bob + (ducking ? 0 : 0);
    var lim = 'rgba(0,0,0,.0)';
    function limb(ax, ay, ang, len, wid, col) {
      var bx = ax + Math.sin(ang) * len, by2 = ay + Math.cos(ang) * len;
      g.strokeStyle = col; g.lineWidth = wid; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by2); g.stroke();
      return [bx, by2];
    }
    // back arm + leg
    var armA = sliding ? 1.5 : ducking ? 0.3 : (jumpT >= 0 ? -2.4 : sw2 * 0.9), legA = jumpT >= 0 ? -0.6 : (ducking ? 0.5 : sw2 * 0.8);
    var tx = hipx + Math.sin(lean) * torsoL, ty = hipy - Math.cos(lean) * torsoL;
    var lw2 = H0 * 0.075;
    // legs (tucked while jumping, bent while ducking)
    if (sliding) {
      limb(hipx - lw2, hipy, -1.45, legL * 2.6, lw2, '#3b2a1c'); limb(hipx + lw2, hipy, -1.3, legL * 2.6, lw2, '#4a3524');
    } else if (ducking) {
      var k1 = limb(hipx - lw2, hipy, -0.9, legL * 0.75, lw2, '#3b2a1c'); limb(k1[0], k1[1], 0.2, legL * 0.7, lw2, '#3b2a1c');
      var k2 = limb(hipx + lw2, hipy, -0.7, legL * 0.75, lw2, '#4a3524'); limb(k2[0], k2[1], 0.2, legL * 0.7, lw2, '#4a3524');
    } else if (jumpT >= 0) {
      var j1 = limb(hipx - lw2, hipy, 0.9, legL * 0.55, lw2, '#3b2a1c'); limb(j1[0], j1[1], -0.6, legL * 0.55, lw2, '#3b2a1c');
      var j2 = limb(hipx + lw2, hipy, -0.5, legL * 0.55, lw2, '#4a3524'); limb(j2[0], j2[1], 0.4, legL * 0.55, lw2, '#4a3524');
    } else {
      var a1 = limb(hipx, hipy, legA, legL * 0.52, lw2, '#3b2a1c'); limb(a1[0], a1[1], legA + 0.6 + Math.max(0, -sw2) * 0.5, legL * 0.52, lw2, '#3b2a1c');
      var sA = sw * 0.8, a2 = limb(hipx, hipy, sA, legL * 0.52, lw2, '#5a4230'); limb(a2[0], a2[1], sA + 0.6 + Math.max(0, -sw) * 0.5, legL * 0.52, lw2, '#5a4230');
    }
    // back arm
    limb(tx, ty + torsoL * 0.15, armA, H0 * 0.3, lw2 * 0.9, '#c78d5c');
    // backpack + scarf
    g.fillStyle = '#7a3b1c'; g.beginPath(); g.ellipse(tx - Math.cos(lean) * H0 * 0.1 - 3, (ty + hipy) / 2, H0 * 0.08, H0 * 0.13, lean, 0, 7); g.fill();
    // torso
    g.strokeStyle = T.ta === '#a89a6a' ? '#2d7a46' : '#c8402a'; g.lineWidth = H0 * 0.19; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hipx, hipy); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#f0c040'; g.lineWidth = H0 * 0.04; g.beginPath(); g.moveTo(hipx - H0 * 0.07, hipy - 3); g.lineTo(hipx + H0 * 0.07, hipy - 3); g.stroke();
    // head + hat + scarf tail
    var hx = tx + Math.sin(lean) * headR * 1.5, hyy = ty - headR * 1.3;
    g.fillStyle = '#d9a070'; g.beginPath(); g.arc(hx, hyy, headR, 0, 7); g.fill();
    g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(hx, hyy - headR * 0.2, headR * 1.02, Math.PI, 0); g.fill();
    g.fillRect(hx - headR * 1.25, hyy - headR * 0.25, headR * 2.5, headR * 0.25);
    g.fillStyle = '#c8402a'; g.beginPath(); g.moveTo(tx - 2, ty + 2);
    var fl = Math.sin(now * 0.02) * H0 * 0.03;
    g.lineTo(tx - H0 * 0.28, ty + H0 * 0.04 + fl); g.lineTo(tx - H0 * 0.2, ty + H0 * 0.1 + fl); g.lineTo(tx + 2, ty + 8); g.closePath(); g.fill();
    // front arm
    limb(tx, ty + torsoL * 0.15, sliding ? 1.7 : ducking ? 0.6 : (jumpT >= 0 ? 2.4 : sw * 0.9), H0 * 0.3, lw2 * 0.9, '#d9a070');
    if (ducking && state === 'running') {
      g.textAlign = 'center'; g.font = '900 ' + Math.max(14, H * 0.03) + 'px system-ui,Arial,sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.8)'; g.fillStyle = '#ffd24a';
      var dl = sliding ? 'SLIDE' : 'DUCK'; g.strokeText(dl, x, feet - H0 * 0.7); g.fillText(dl, x, feet - H0 * 0.7);
    }
  }

  function txt(t, x, y, sz, fill, stroke) {
    g.font = '900 ' + sz + 'px system-ui,Arial,sans-serif'; g.lineJoin = 'round'; g.textAlign = 'center';
    g.lineWidth = sz / 7; g.strokeStyle = stroke || 'rgba(0,0,0,.75)'; g.strokeText(t, x, y); g.fillStyle = fill || '#fff'; g.fillText(t, x, y);
  }
  function panelBox(x, y, w, h, T) {
    rr(x - w / 2 - 6, y - 6, w + 12, h + 12, 18, 'rgba(0,0,0,.35)');
    var pg = g.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, '#8a7d67'); pg.addColorStop(1, '#5d4b36');
    rr(x - w / 2, y, w, h, 14, pg);
    g.strokeStyle = '#d9c28a'; g.lineWidth = 3; g.beginPath(); if (g.roundRect) g.roundRect(x - w / 2 + 6, y + 6, w - 12, h - 12, 10); g.stroke();
  }

  function drawHud(now, T) {
    var sz = Math.max(40, H * 0.1);
    var sw = Math.max(200, H * 0.4);
    rr(W / 2 - sw / 2, 8, sw, sz * 1.1, 14, 'rgba(30,20,10,.55)');
    txt(String(Math.floor(score)), W / 2, 8 + sz * 0.9, sz, '#ffe08a');
    // speed meter
    var mw = Math.max(160, W * 0.18), mh = 14, mx = W - mw - 24, my = 28, f = Math.min(1, (speed - 6) / 36);
    rr(mx - 4, my - 4, mw + 8, mh + 8, 8, 'rgba(30,20,10,.55)');
    var sg = g.createLinearGradient(mx, 0, mx + mw, 0); sg.addColorStop(0, '#7ad05a'); sg.addColorStop(0.6, '#f0c040'); sg.addColorStop(1, '#e8402a');
    rr(mx, my, mw * f, mh, 6, sg);
    g.font = '800 12px system-ui,Arial,sans-serif'; g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText('SPEED ' + speed.toFixed(0), mx + mw, my + mh + 20);
    if (hi) { g.textAlign = 'left'; g.fillText('BEST ' + Math.floor(hi), 24, 36); }
    if (state === 'running') {
      var tl = forkLeftS();
      if (tl <= 3) {
        var ax = W / 2, ay = H * 0.2, as2 = Math.max(18, H * 0.05);
        if (tl <= 2.5) { g.globalAlpha = 0.6 + 0.4 * Math.sin(now * 0.02); txt('TURN!', ax, H * 0.17, Math.max(30, H * 0.08), '#ffd24a'); g.globalAlpha = 1; }
        g.fillStyle = 'rgba(30,20,10,.55)'; g.fillRect(ax - as2 * 2.2, ay, as2 * 4.4, as2 * 1.4);
        g.font = '800 ' + Math.max(12, as2 * 0.45) + 'px system-ui,Arial,sans-serif'; g.textAlign = 'center';
        [[-1, 'left'], [1, 'right']].forEach(function (a) {
          var on = choice === a[1], cx2 = ax + a[0] * as2 * 1.1, cy2 = ay + as2 * 0.7;
          g.fillStyle = on ? '#7ff0ff' : 'rgba(255,255,255,.35)';
          g.beginPath(); g.moveTo(cx2 + a[0] * as2 * 0.4, cy2); g.lineTo(cx2 - a[0] * as2 * 0.3, cy2 - as2 * 0.4); g.lineTo(cx2 - a[0] * as2 * 0.3, cy2 + as2 * 0.4); g.closePath(); g.fill();
        });
        g.fillStyle = '#fff'; g.fillText(tl.toFixed(1) + 's', ax, ay + as2 * 1.9);
      }
    }
    // mode + combo badges
    var bs = Math.max(12, H * 0.022), bx0 = 24, by0 = H - 28;
    var sl = duckMode() === 'slide';
    rr(bx0, by0 - bs * 1.3, bs * 6.2, bs * 1.8, 8, 'rgba(30,20,10,.55)');
    g.strokeStyle = sl ? '#7ff0ff' : '#ffe08a'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
    if (sl) { g.moveTo(bx0 + 8, by0 - bs * 0.2); g.lineTo(bx0 + 8 + bs * 1.1, by0 - bs * 0.2); g.moveTo(bx0 + 8 + bs * 0.7, by0 - bs * 0.6); g.lineTo(bx0 + 8 + bs * 1.1, by0 - bs * 0.2); g.lineTo(bx0 + 8 + bs * 0.7, by0 + bs * 0.2); }
    else { g.moveTo(bx0 + 8 + bs * 0.5, by0 - bs * 0.7); g.lineTo(bx0 + 8 + bs * 0.5, by0 + bs * 0.2); g.moveTo(bx0 + 8 + bs * 0.1, by0 - bs * 0.2); g.lineTo(bx0 + 8 + bs * 0.5, by0 + bs * 0.2); g.lineTo(bx0 + 8 + bs * 0.9, by0 - bs * 0.2); }
    g.stroke();
    g.font = '800 ' + bs + 'px system-ui,Arial,sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff';
    g.fillText(sl ? 'SLIDE ' + (slideMs() / 1000).toFixed(1) + 's' : 'HOLD', bx0 + bs * 2.1, by0 + bs * 0.1);
    if (state === 'running' && nmCount >= 1 && gt - nmT < 3) {
      var cf = 1 - (gt - nmT) / 3, cw = bs * 7;
      rr(bx0, by0 - bs * 3.6, cw, bs * 1.8, 8, 'rgba(30,20,10,.55)');
      rr(bx0 + 6, by0 - bs * 1.95, (cw - 12) * cf, 3, 2, '#ffd24a');
      g.fillStyle = '#ffd24a'; g.fillText('COMBO x' + nmCount, bx0 + 10, by0 - bs * 2.4);
    }
    // popups: scale-in + fade-out
    for (var i = 0; i < pops.length; i++) {
      var pp = pops[i], u = Math.min(1, pp.age / 0.25), sc2 = 0.5 + 0.7 * (1 - Math.pow(1 - u, 3)) - (pp.age > 0.25 ? Math.min(0.2, (pp.age - 0.25) * 0.3) : 0);
      g.save(); g.globalAlpha = Math.max(0, Math.min(1, (1.1 - pp.age) / 0.5));
      var py2 = H * 0.3 + i * H * 0.07 - pp.age * H * 0.04;
      g.translate(W / 2, py2); g.scale(sc2, sc2);
      txt(pp.t, 0, 0, Math.max(26, H * 0.07), pp.col);
      if (i === 0 && pp.t === 'NEAR MISS!') txt('+' + 25 * Math.max(1, nmCount), 0, Math.max(20, H * 0.05), Math.max(16, H * 0.04), '#fff');
      g.restore();
    }
    var age = now - lastInT;
    if (lastIn && age < 500) { g.globalAlpha = 1 - age / 500; txt(lastIn, W / 2, H * 0.5, Math.max(32, H * 0.1), '#fff'); g.globalAlpha = 1; }
  }

  function drawScreens(now, T) {
    if (state === 'running') return;
    var dead = state === 'dead';
    g.fillStyle = dead ? 'rgba(90,0,0,.55)' : 'rgba(10,15,10,.6)'; g.fillRect(0, 0, W, H);
    var pw = Math.min(W * 0.86, 720), ph = Math.min(H * 0.7, 440), pcx = W / 2, py = (H - ph) / 2;
    panelBox(pcx, py, pw, ph, T);
    var tsz = Math.max(22, Math.min(pw * 0.075, H * 0.075));
    if (!dead) {
      txt('LLAMA DRAMA // BARE METAL', pcx, py + ph * 0.24, tsz, '#ffe08a');
      txt('Escape the ruins', pcx, py + ph * 0.38, tsz * 0.55, '#f5e6c0');
      var pulse = 0.75 + 0.25 * Math.sin(now * 0.006);
      g.globalAlpha = pulse; txt('PRESS START', pcx, py + ph * 0.6, tsz * 1.2, '#fff'); g.globalAlpha = 1;
      txt('JUMP stone barriers - DUCK under logs - DODGE rock walls', pcx, py + ph * 0.78, Math.max(12, tsz * 0.38), '#f5e6c0');
      txt('Arrows / swipe / gestures / Space', pcx, py + ph * 0.88, Math.max(11, tsz * 0.33), '#d9c28a');
    } else {
      txt('YOU FELL', pcx, py + ph * 0.24, tsz * 1.5, '#ff7a5a');
      if (deathMsg) txt(deathMsg, pcx, py + ph * 0.36, tsz * 0.7, '#ffd0c0');
      txt('Score ' + Math.floor(score), pcx, py + ph * 0.5, tsz * 1.2, '#ffe08a');
      txt('Best ' + Math.floor(hi), pcx, py + ph * 0.64, tsz * 0.8, '#f5e6c0');
      var p2 = 0.75 + 0.25 * Math.sin(now * 0.006);
      g.globalAlpha = p2; txt('PRESS START TO RESTART', pcx, py + ph * 0.82, tsz * 0.75, '#fff'); g.globalAlpha = 1;
    }
  }

  function draw(now) {
    var T = THEMES[track];
    layout();
    g.save();
    if (turnT > 0) { var u = 1 - turnT / 0.4, sw3 = Math.sin(Math.PI * u); g.translate(W / 2 - turnDir * sw3 * W * 0.08, by); g.rotate(turnDir * sw3 * 0.12); g.translate(-W / 2, -by); }
    if (shake > 0) g.translate((Math.random() - 0.5) * shake * 26, (Math.random() - 0.5) * shake * 26);
    drawSky(T, now);
    drawWorld(T);
    var list = obs.slice().sort(function (a, b) { return b.d - a.d; });
    var drawn = false;
    list.forEach(function (o) {
      if (!drawn && o.d < 0) { drawPlayer(T, now); drawn = true; }
      drawObstacle(o, T);
    });
    if (!drawn) drawPlayer(T, now);
    parts.forEach(function (p) { g.globalAlpha = Math.max(0, 1 - p.life / p.max); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); });
    g.globalAlpha = 1;
    g.restore();
    if (hitFlash > 0) { g.fillStyle = 'rgba(255,60,40,' + (hitFlash * 0.5) + ')'; g.fillRect(0, 0, W, H); }
    // vignette
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    drawHud(now, T);
    drawScreens(now, T);
    if (paused && state === 'running') {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H);
      txt('PAUSED', W / 2, H * 0.5, Math.max(48, H * 0.14), '#fff');
      txt('P / Esc / forward wave to resume', W / 2, H * 0.58, Math.max(14, H * 0.03), '#d9c28a');
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
