(function () {
  var ctx = null, master = null, vol = 0.6, muted = false, noiseBuf = null;
  try { var v = localStorage.getItem('sfx.vol'); if (v !== null && !isNaN(+v)) vol = Math.max(0, Math.min(1, +v)); muted = localStorage.getItem('sfx.mute') === '1'; } catch (e) {}
  function save() { try { localStorage.setItem('sfx.vol', String(vol)); localStorage.setItem('sfx.mute', muted ? '1' : '0'); } catch (e) {} }
  function apply() { if (master) master.gain.value = muted ? 0 : vol; if (typeof mapply === 'function') mapply(); }
  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.connect(ctx.destination); apply();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  // tone: type, freq start->end, start offset, duration, peak gain
  function tone(type, f0, f1, at, dur, gain) {
    var t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(f0, f1, at, dur, gain, q) {
    var t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  var S = {
    jump: function () { tone('square', 280, 760, 0, 0.16, 0.22); },
    duck: function () { tone('sine', 150, 55, 0, 0.18, 0.5); noise(300, 100, 0, 0.08, 0.15, 0.7); },
    stand: function () { tone('square', 420, 640, 0, 0.09, 0.18); },
    lane: function () { noise(500, 3000, 0, 0.16, 0.35, 1.2); },
    track: function () { tone('triangle', 988, 988, 0, 0.35, 0.3); tone('triangle', 1319, 1319, 0.09, 0.4, 0.3); },
    turn: function () { tone('square', 523, 1047, 0, 0.18, 0.25); tone('triangle', 1319, 1568, 0.12, 0.3, 0.3); },
    coin: function () { tone('square', 988, 988, 0, 0.07, 0.18); tone('square', 1319, 1319, 0.07, 0.25, 0.18); },
    hit: function () { noise(1500, 200, 0, 0.2, 0.5, 0.6); tone('sawtooth', 220, 80, 0, 0.2, 0.3); },
    dead: function () {
      noise(2000, 80, 0, 0.7, 0.55, 0.5);
      tone('sawtooth', 440, 55, 0, 0.7, 0.35); tone('square', 330, 40, 0.05, 0.8, 0.2);
    },
    start: function () { tone('square', 523, 523, 0, 0.12, 0.2); tone('square', 659, 659, 0.12, 0.12, 0.2); tone('square', 784, 784, 0.24, 0.3, 0.22); },
    nearmiss: function () { noise(400, 4000, 0, 0.22, 0.4, 1.0); tone('sine', 1568, 1568, 0.1, 0.3, 0.25); tone('triangle', 2093, 2093, 0.12, 0.35, 0.18); },
    combo: function () { [659, 784, 1047].forEach(function (f, i) { tone('square', f, f * 1.01, i * 0.07, 0.12, 0.17); }); },
    pause: function () { tone('square', 660, 330, 0, 0.14, 0.2); },
    resume: function () { tone('square', 330, 660, 0, 0.14, 0.2); },
    slide: function () { noise(1800, 250, 0, 0.4, 0.4, 0.8); tone('sine', 200, 90, 0, 0.3, 0.2); },
    shoot: function () {
      tone('sawtooth', 1800, 180, 0, 0.14, 0.26); tone('square', 900, 90, 0, 0.1, 0.14);
      noise(5000, 1200, 0, 0.05, 0.2, 0.8);
    },
    explode: function () {
      noise(3000, 60, 0, 0.6, 0.6, 0.5); tone('sine', 120, 30, 0, 0.55, 0.7); tone('sawtooth', 200, 40, 0, 0.35, 0.25);
      [2093, 2637, 3136, 3951, 2349].forEach(function (f, i) { tone('triangle', f, f * 0.8, 0.12 + i * 0.07, 0.22, 0.09); });
    },
    hurt: function () { tone('sawtooth', 300, 70, 0, 0.22, 0.34); tone('square', 150, 50, 0, 0.22, 0.2); noise(900, 150, 0, 0.15, 0.25, 0.8); },
    shield: function () { tone('sine', 220, 880, 0, 0.45, 0.25); tone('triangle', 440, 1760, 0.05, 0.5, 0.15); tone('sine', 1320, 1320, 0.2, 0.6, 0.08); },
    life: function () { [784, 988, 1319, 1568].forEach(function (f, i) { tone('triangle', f, f, i * 0.07, 0.3, 0.22); tone('sine', f * 2, f * 2, i * 0.07, 0.25, 0.08); }); },
    speedup: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('square', f, f, i * 0.05, 0.08, 0.15); }); }
  };
  var api = {
    play: function (name) {
      try { if (!ensure() || !S[name]) return; if (muted || vol <= 0) return; S[name](); } catch (e) {}
    },
    unlock: ensure,
    setVolume: function (v) { vol = Math.max(0, Math.min(1, +v || 0)); apply(); save(); },
    getVolume: function () { return vol; },
    setMuted: function (m) { muted = !!m; apply(); save(); toast(); },
    isMuted: function () { return muted; },
    toggleMute: function () { api.setMuted(!muted); return muted; }
  };

  // ---- music ----
  // Signal chain: voice bus (per song, crossfaded) -> mDuck -> mLP (slow-mo) -> mFade (on/off) -> mOut (volume/mute)
  var mvol = 0.35, mOn = true, mOut = null, mDuck = null, mLP = null, mFade = null, playing = false, stopping = 0, intensity = 0, ilvl = 0, ducked = false;
  var mTimer = 0, mrate = 1, mrateT = 1, voices = [], main = null, cbus = null, cur = 0, pending = -1, cycleSec = 90;
  try {
    var mv = localStorage.getItem('sfx.mvol'); if (mv !== null && !isNaN(+mv)) mvol = Math.max(0, Math.min(1, +mv)); mOn = localStorage.getItem('sfx.mon') !== '0';
    var sc = localStorage.getItem('sfx.song'); if (sc !== null && !isNaN(+sc)) cur = Math.max(0, Math.floor(+sc));
    var cs = localStorage.getItem('sfx.cycle'); if (cs !== null && !isNaN(+cs)) cycleSec = Math.max(0, Math.min(300, +cs));
  } catch (e) {}
  function msave() { try { localStorage.setItem('sfx.mvol', String(mvol)); localStorage.setItem('sfx.mon', mOn ? '1' : '0'); localStorage.setItem('sfx.song', String(cur)); localStorage.setItem('sfx.cycle', String(cycleSec)); } catch (e) {} }
  function mapply() {
    if (!mOut) return;
    var now = ctx.currentTime;
    mOut.gain.setTargetAtTime(muted ? 0 : mvol, now, 0.06);
    mDuck.gain.setTargetAtTime(ducked ? 0.25 : 1, now, 0.08);
  }
  function minit() {
    if (mOut || !ensure()) return !!mOut;
    mOut = ctx.createGain(); mDuck = ctx.createGain(); mFade = ctx.createGain(); mLP = ctx.createBiquadFilter();
    mLP.type = 'lowpass'; mLP.frequency.value = 22000; mFade.gain.value = 0.0001; mOut.gain.value = muted ? 0 : mvol;
    mDuck.connect(mLP); mLP.connect(mFade); mFade.connect(mOut); mOut.connect(ctx.destination); mapply();
    return true;
  }
  function mt(type, f0, f1, t, dur, gain) {
    if (gain < 0.002) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; f0 *= mrate; f1 *= mrate; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(cbus); o.start(t); o.stop(t + dur + 0.02);
  }
  function mn(t, dur, gain, hp) {
    if (gain < 0.002) return;
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(cbus); s.start(t); s.stop(t + dur + 0.02);
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  // layer level: fades a layer in/out around threshold thr as smoothed intensity crosses it
  function L(thr) { var a = (ilvl - thr + 0.1) / 0.2; return a <= 0 ? 0 : a >= 1 ? 1 : a; }
  function kick(t, g) { mt('sine', 150, 45, t, 0.16, g); }
  var PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19], MAJ = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
  var TOMS = { 0: [110, 0.8], 3: [150, 0.5], 6: [110, 0.6], 8: [88, 0.8], 10: [150, 0.5], 11: [180, 0.4], 14: [130, 0.6] };
  var FLUTE = [0, -1, 2, -1, 4, -1, 3, 2, 1, -1, 0, -1, 2, -1, -1, -1];
  var CMEL = [0, 2, 4, 2, 4, 5, 4, 2, 0, 2, 4, 7, 5, 4, 2, 1], BLEAD = [0, 1, 3, 1, 0, -1, 1, 3, 7, 6, 3, 1, 0, 1, 3, 6];
  var SONGS = [
    { name: 'Night Runner', bpm: [110, 150], roots: [45, 41, 48, 43], ch: [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12]],
      sched: function (k, bar, t, e) {
        var root = this.roots[bar], ch = this.ch[bar], a;
        if (k % 4 === 0) kick(t, 0.9);
        if (k === 4 || k === 12) mn(t, 0.1, 0.25, 1500);
        if (k % 2 === 0) { var m = root + (k % 8 === 6 ? 12 : 0); mt('sawtooth', hz(m), hz(m), t, e * 1.8, 0.2); }
        a = L(0.3); if (a && k % 2 === 1) mn(t, 0.04, 0.12 * a, 7000);
        a = L(0.6); if (a) { var n = root + 24 + ch[(k * 3 + (k >> 2)) % 4]; mt('square', hz(n), hz(n), t, e * 0.9, 0.07 * a); }
      } },
    { name: 'Temple Drums', bpm: [96, 128], roots: [45, 45, 50, 43],
      sched: function (k, bar, t, e) {
        var root = this.roots[bar], a, tm = TOMS[k];
        if (tm) { mt('sine', tm[0], tm[0] * 0.55, t, 0.28, tm[1]); mn(t, 0.03, 0.08 * tm[1], 2500); }
        if (k === 0) mt('triangle', hz(root - 12), hz(root - 12), t, e * 15, 0.16);
        if (FLUTE[k] >= 0) { var f = hz(69 + PENT[(FLUTE[k] + bar) % PENT.length]); mt('triangle', f, f, t, e * 1.9, 0.09); mt('sine', f * 2, f * 2, t, e * 1.5, 0.025); }
        a = L(0.3); if (a && k % 2 === 1) mn(t, 0.05, (k % 4 === 3 ? 0.1 : 0.06) * a, 6000);
        a = L(0.6); if (a) {
          if (k % 2 === 0) mn(t, 0.03, 0.1 * a, 3500);
          if (FLUTE[k] >= 0) { var h = hz(69 + PENT[(FLUTE[k] + bar + 2) % PENT.length]); mt('triangle', h, h, t, e * 1.6, 0.05 * a); }
          if (k === 15) mt('sine', 200, 120, t, 0.18, 0.4 * a);
        }
      } },
    { name: 'Neon Drive', bpm: [116, 138], roots: [48, 44, 51, 46], ch: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]],
      sched: function (k, bar, t, e) {
        var root = this.roots[bar], ch = this.ch[bar], a;
        if (k % 4 === 0) kick(t, 0.95);
        if (k === 4 || k === 12) { mn(t, 0.14, 0.28, 1000); mn(t + 0.012, 0.1, 0.15, 1400); }
        if (k % 4 === 2) mn(t, 0.05, 0.14, 8000);
        var b = hz(root - 12 + (k % 2 ? 12 : 0)); mt('sawtooth', b, b, t, e * 0.9, 0.12);
        a = L(0.3); if (a) { var n = hz(root + 12 + ch[k % 3] + (k % 6 >= 3 ? 12 : 0)); mt('sawtooth', n, n, t, e * 0.8, 0.05 * a); mt('square', n * 1.005, n * 1.005, t, e * 0.7, 0.025 * a); }
        a = L(0.6); if (a && k % 8 === 0) ch.forEach(function (c) { var p = hz(root + 24 + c); mt('sawtooth', p, p, t, e * 7.5, 0.035 * a); mt('sawtooth', p * 1.008, p * 1.008, t, e * 7.5, 0.02 * a); });
      } },
    { name: 'Chip Rush', bpm: [150, 185], roots: [48, 43, 45, 41], ch: [[0, 4, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]],
      sched: function (k, bar, t, e) {
        var root = this.roots[bar], ch = this.ch[bar], a;
        if (k === 0 || k === 8 || k === 10) mt('triangle', 220, 55, t, 0.08, 0.5);
        if (k === 4 || k === 12) mn(t, 0.07, 0.22, 3000);
        if (k % 2 === 0) { var b = hz(root - 12 + (k % 4 === 2 ? 7 : 0)); mt('triangle', b, b, t, e * 1.6, 0.26); }
        if (k % 2 === 0) { var m = hz(72 + MAJ[CMEL[(k + bar * 4) % 16] % MAJ.length]); mt('square', m, m, t, e * 1.5, 0.055); }
        a = L(0.3); if (a) { var n = hz(root + 24 + ch[k % 3]); mt('square', n, n, t, e * 0.6, 0.03 * a); }
        a = L(0.6); if (a) { mn(t, 0.02, 0.06 * a, 9000); if (k % 2 === 1) { var m2 = hz(84 + MAJ[CMEL[(k + bar * 4 + 15) % 16] % MAJ.length]); mt('square', m2, m2, t, e * 0.8, 0.025 * a); } }
      } },
    { name: 'Dark Run', bpm: [88, 118], roots: [38, 38, 34, 36], ch: [[0, 3, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 10]],
      sched: function (k, bar, t, e) {
        var root = this.roots[bar], ch = this.ch[bar], a;
        if (k === 0 || k === 10) kick(t, 0.85);
        var p = hz(root); mt('sawtooth', p, p, t, e * 0.7, k % 4 === 0 ? 0.11 : 0.065);
        if (k % 4 === 0) mt('sine', hz(root - 12), hz(root - 12), t, e * 3, 0.22);
        if (k === 0 && bar % 2 === 0) { var bl = hz(root + 31); mt('sine', bl, bl, t, e * 12, 0.05); }
        a = L(0.3); if (a) { if (k === 6 || k === 14) mn(t, 0.06, 0.1 * a, 7000); if (k === 12) mn(t, 0.2, 0.15 * a, 800); }
        a = L(0.6); if (a) { if (k === 8) kick(t, 0.6 * a); if (k % 3 === 0) { var n = hz(root + 24 + ch[(k / 3) % 4]); mt('sine', n, n, t, e * 2.5, 0.045 * a); } }
      } },
    { name: 'Boss Fight', bpm: [150, 176], roots: [40, 41, 40, 38],
      sched: function (k, bar, t, e) {
        var root = this.roots[bar], a, stab = k === 0 || k === 3 || k === 6 || k === 10 || k === 12;
        if (k % 4 === 0 || k === 14) mt('sine', 160, 40, t, 0.18, 1.0);
        if (k === 4 || k === 12) { mn(t, 0.12, 0.32, 1200); mt('triangle', 200, 150, t, 0.06, 0.15); }
        if (stab) { [0, 7, 12].forEach(function (o) { var s = hz(root + 12 + o); mt('sawtooth', s, s, t, e * 1.2, 0.05); mt('sawtooth', s * 1.012, s * 1.012, t, e * 1.2, 0.04); }); mt('square', hz(root), hz(root), t, e * 1.2, 0.05); }
        else { var b = hz(root - 12); mt('sawtooth', b, b, t, e * 0.6, 0.13); }
        a = L(0.3); if (a) mn(t, 0.03, (k % 2 ? 0.05 : 0.08) * a, 8000);
        a = L(0.6); if (a && k % 2 === 0) { var l = hz(root + 24 + BLEAD[(k + bar * 2) % 16]); mt('square', l, l, t, e * 1.8, 0.05 * a); }
      } }
  ];
  cur = cur % SONGS.length;
  function bpmOf(v) { var r = v.song.bpm; return r[0] + (r[1] - r[0]) * ilvl; }
  function newVoice(idx, t, fade) {
    var bus = ctx.createGain(); bus.connect(mDuck);
    if (fade > 0) { bus.gain.setValueAtTime(0.0001, ctx.currentTime); bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(1, t + fade); }
    else bus.gain.value = 1;
    return { idx: idx, song: SONGS[idx], bus: bus, step: 0, nextT: t, startT: t, endT: Infinity };
  }
  // switch at a bar boundary t: two-bar crossfade, old song keeps playing (scheduled) while fading out
  function doSwitch(t, spb) {
    var xf = Math.max(1.5, Math.min(5, spb * 8)), old = main;
    old.bus.gain.setValueAtTime(1, t); old.bus.gain.linearRampToValueAtTime(0.0001, t + xf); old.endT = t + xf;
    main = newVoice(pending, t, xf); voices.push(main); pending = -1;
  }
  function tick() {
    if (!playing || !ctx) return;
    var now = ctx.currentTime;
    if (cycleSec > 0 && pending < 0 && voices.length === 1 && now - main.startT >= cycleSec) { cur = (main.idx + 1) % SONGS.length; pending = cur; msave(); songToast(); }
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      while (v.nextT < now + 0.15 && v.nextT < v.endT) {
        if (v.nextT < now - 0.1) v.nextT = now + 0.02;
        if (v === main) { ilvl += (intensity - ilvl) / 16; mrate += (mrateT - mrate) * 0.3; if (Math.abs(mrateT - mrate) < 0.005) mrate = mrateT; }
        var spb = 60 / bpmOf(v) / mrate;
        if (v === main && v.step % 16 === 0 && pending >= 0 && pending !== v.idx && voices.length === 1) { doSwitch(v.nextT, spb); continue; }
        cbus = v.bus;
        try { v.song.sched(v.step % 16, Math.floor(v.step / 16) % 4, v.nextT, spb / 4); } catch (e) {}
        v.nextT += spb / 4; v.step = (v.step + 1) % 64;
      }
    }
    voices = voices.filter(function (v) { if (v !== main && now > v.endT + 0.5) { try { v.bus.disconnect(); } catch (e) {} return false; } return true; });
    if (pending === main.idx) pending = -1;
  }
  function hardStop() {
    stopping = 0; playing = false; clearInterval(mTimer); mTimer = 0; mrate = mrateT = 1; pending = -1;
    voices.forEach(function (v) { try { v.bus.disconnect(); } catch (e) {} }); voices = []; main = null;
    try { if (mLP) { mLP.frequency.cancelScheduledValues(ctx.currentTime); mLP.frequency.setValueAtTime(22000, ctx.currentTime); } } catch (e) {}
  }
  function fadeTo(v, dur) {
    var now = ctx.currentTime, g = mFade.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(v, now + dur);
  }
  function mstop(fast) {
    if (!playing) return;
    if (fast || !mFade) { hardStop(); try { if (mFade) { mFade.gain.cancelScheduledValues(ctx.currentTime); mFade.gain.setValueAtTime(0.0001, ctx.currentTime); } } catch (e) {} return; }
    if (stopping) return;
    fadeTo(0.0001, 1.0); stopping = setTimeout(hardStop, 1100);
  }
  api.music = function (on) {
    try {
      if (!on) { mstop(false); return; }
      if (!mOn || !minit()) return;
      if (playing && stopping) { clearTimeout(stopping); stopping = 0; fadeTo(1, 0.6); return; }
      if (playing) return;
      playing = true; ilvl = intensity; pending = -1; mapply();
      voices = [main = newVoice(cur, ctx.currentTime + 0.05, 0)];
      fadeTo(1, 0.6);
      clearInterval(mTimer); mTimer = setInterval(tick, 25); tick();
    } catch (e) {}
  };
  api.setIntensity = function (v) { intensity = Math.max(0, Math.min(1, +v || 0)); };
  api.slowmo = function (on) {
    try {
      if (!playing || !mLP || !ctx) { if (!on) mrate = mrateT = 1; return; }
      mrateT = on ? 0.8 : 1;
      mLP.frequency.setTargetAtTime(on ? 700 : 22000, ctx.currentTime, 0.08);
    } catch (e) {}
  };
  api.duck = function (on) { ducked = !!on; try { mapply(); } catch (e) {} };
  api.setMusicVolume = function (v) { mvol = Math.max(0, Math.min(1, +v || 0)); msave(); try { mapply(); } catch (e) {} };
  api.getMusicVolume = function () { return mvol; };
  api.setMusicEnabled = function (on) { mOn = !!on; msave(); if (!mOn) try { mstop(false); } catch (e) {} };
  api.isMusicEnabled = function () { return mOn; };
  api.isMusicPlaying = function () { return playing && !stopping; };
  function pickSong(i) {
    cur = ((i % SONGS.length) + SONGS.length) % SONGS.length; msave();
    if (playing && main) pending = cur === main.idx ? -1 : cur;
    songToast();
    try { window.dispatchEvent(new CustomEvent('sfx:song', { detail: { index: cur, name: SONGS[cur].name } })); } catch (e) {}
    return SONGS[cur].name;
  }
  api.nextSong = function () { return pickSong(cur + 1); };
  api.prevSong = function () { return pickSong(cur - 1); };
  api.setSong = function (i) { return pickSong(+i || 0); };
  api.songName = function () { return SONGS[cur].name; };
  api.songIndex = function () { return cur; };
  api.songs = function () { return SONGS.map(function (s) { return s.name; }); };
  api.setMusicCycle = function (s) { cycleSec = Math.max(0, Math.min(300, +s || 0)); if (main) main.startT = ctx.currentTime; msave(); };
  api.getMusicCycle = function () { return cycleSec; };
  window.sfx = api;

  var sEl = null, sTimer = 0;
  function songToast() {
    try {
      if (!sEl) {
        sEl = document.createElement('div');
        sEl.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);padding:6px 14px;background:rgba(0,0,0,.7);color:#fff;font:700 15px system-ui,Arial,sans-serif;border-radius:16px;z-index:9999;pointer-events:none;white-space:nowrap;transition:opacity .25s;opacity:0';
        document.body.appendChild(sEl);
      }
      sEl.textContent = '♪ ' + SONGS[cur].name; sEl.style.display = 'block'; void sEl.offsetWidth; sEl.style.opacity = '1';
      clearTimeout(sTimer); sTimer = setTimeout(function () { sEl.style.opacity = '0'; }, 2000);
    } catch (e) {}
  }

  var tEl = null, tTimer = 0;
  function toast() {
    try {
      if (!tEl) {
        tEl = document.createElement('div');
        tEl.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 16px;background:rgba(0,0,0,.75);color:#fff;font:700 16px system-ui,Arial,sans-serif;border-radius:8px;z-index:30;pointer-events:none';
        document.body.appendChild(tEl);
      }
      tEl.textContent = muted ? 'Sound: MUTED (M)' : 'Sound: ON (M)'; tEl.style.display = 'block';
      clearTimeout(tTimer); tTimer = setTimeout(function () { tEl.style.display = 'none'; }, 1200);
    } catch (e) {}
  }
  function unlock() { ensure(); }
  ['keydown', 'touchstart', 'touchend', 'click', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') { api.toggleMute(); return; }
    var el = e.target, tag = el && el.tagName;
    if ((tag === 'INPUT' && el.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    if ((e.key === 'n' || e.key === 'N') && !e.repeat) api.nextSong();
    else if ((e.key === 'b' || e.key === 'B') && !e.repeat) api.prevSong();
  });
})();
