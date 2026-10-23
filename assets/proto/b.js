// Prototype B: low-poly 3D runner on three.js (r160 UMD global THREE).
(function () {
  if (typeof THREE === 'undefined') { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:40%;width:100%;text-align:center">three.js failed to load</p>'); return; }

  var THEMES = [
    { name: 'TEMPLE DUSK', sky: 0xf08a4b, hemiG: 0x3a2a1a, floor: 0x6b5a48, side: 0x2f4a2a, stripe: 0xd9c7a0, edge: 0xffd24a, pillar: 0x8a7a66, tree: 0x2f6b3a, low: 0xe8505b, bar: 0xffb347, blk: 0x7a5cff, fogN: 18, fogF: 72 },
    { name: 'NEON NIGHT', sky: 0x14002e, hemiG: 0x200040, floor: 0x1a1030, side: 0x0a0a24, stripe: 0x7c5cff, edge: 0x22d3ee, pillar: 0x2a1a5a, tree: 0xc026d3, low: 0xff3d81, bar: 0x22d3ee, blk: 0xf5f5ff, fogN: 14, fogF: 66 },
    { name: 'JUNGLE NOON', sky: 0x9fd8c0, hemiG: 0x2a3a1a, floor: 0x4a3b2a, side: 0x1f5a2e, stripe: 0xc9b28a, edge: 0xfef08a, pillar: 0x6f6a5a, tree: 0x2e7d32, low: 0xc2410c, bar: 0xfacc15, blk: 0x0f766e, fogN: 20, fogF: 78 }
  ];
  var LW = 2.0, SEG = 10, NSEG = 10, JD = 0.8, JH = 1.7;

  // ---------- renderer / scene ----------
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.insertBefore(renderer.domElement, document.body.firstChild);
  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 18, 72);
  scene.background = new THREE.Color(0x000000);
  var camera = new THREE.PerspectiveCamera(62, 1, 0.1, 140);
  var hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1.1); scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(5, 11, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 30;
  scene.add(sun); scene.add(sun.target); var W = new THREE.Group(); scene.add(W); var HP = Math.PI / 2;

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.fov = camera.aspect < 1 ? 78 : 62; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // ---------- materials (theme recolors these) ----------
  function lam(c) { return new THREE.MeshLambertMaterial({ color: c, flatShading: true }); }
  function glow(c) { return new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, flatShading: true }); }
  var M = {
    floor: lam(0x555555), side: lam(0x224422), stripe: lam(0xcccccc), edge: glow(0xffd24a),
    pillar: lam(0x888888), tree: lam(0x2f6b3a), trunk: lam(0x4a3020),
    low: glow(0xff0000), bar: glow(0xffaa00), post: lam(0x333333), blk: glow(0x7a5cff),
    skin: lam(0xf1c27d), shirt: lam(0xf5f5f5), pants: lam(0x23324a), band: glow(0xffd24a)
  };
  var G = {
    floor: new THREE.BoxGeometry(LW * 3.3, 0.4, SEG),
    side: new THREE.PlaneGeometry(30, SEG),
    dash: new THREE.BoxGeometry(0.1, 0.02, 2.4),
    curb: new THREE.BoxGeometry(0.35, 0.3, SEG),
    pillar: new THREE.BoxGeometry(0.9, 1, 0.9),
    cap: new THREE.BoxGeometry(1.2, 0.3, 1.2),
    cone: new THREE.ConeGeometry(1, 1, 6),
    trunk: new THREE.CylinderGeometry(0.15, 0.2, 1, 5),
    low: new THREE.BoxGeometry(LW * 0.9, 0.6, 0.5),
    lowTop: new THREE.BoxGeometry(LW * 0.92, 0.1, 0.55),
    post: new THREE.BoxGeometry(0.14, 2.0, 0.14),
    bar: new THREE.BoxGeometry(LW * 0.95, 0.45, 0.3),
    blk: new THREE.BoxGeometry(LW * 0.85, 2.4, 1.0),
    pit: new THREE.BoxGeometry(LW * 0.98, 0.04, 2.6),
    pitRim: new THREE.BoxGeometry(LW * 0.98, 0.07, 0.14),
    fireBase: new THREE.BoxGeometry(LW * 3.1, 0.06, 1.0),
    spike: new THREE.ConeGeometry(0.16, 0.6, 4),
    flame: new THREE.BoxGeometry(LW * 3.1, 0.7, 0.5),
    arrowC: new THREE.ConeGeometry(0.22, 0.5, 3)
  };
  // trap materials: fixed colors so each trap reads differently from normal obstacles
  var TM = {
    pit: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    rim: new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0xff8800, emissiveIntensity: 0.6, flatShading: true }),
    fireBase: new THREE.MeshLambertMaterial({ color: 0x2a1205, flatShading: true }),
    spike: new THREE.MeshLambertMaterial({ color: 0xff6a00, emissive: 0xff3300, emissiveIntensity: 0.9, flatShading: true }),
    flame: new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, depthWrite: false }),
    mblk: new THREE.MeshLambertMaterial({ color: 0xff2d55, emissive: 0xff2d55, emissiveIntensity: 0.5, flatShading: true }),
    arrow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    tele: new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.95, depthWrite: false }),
    teleGlow: new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, depthWrite: false })
  };

  // ---------- endless path ----------
  var segs = [];
  function decorate(s) {
    s.deco.forEach(function (d) {
      var tree = Math.random() < 0.55;
      d.tree.visible = tree; d.pil.visible = !tree;
      var sideX = d.side * (LW * 1.65 + 1.4 + Math.random() * 4);
      d.g.position.set(sideX, 0, (Math.random() - 0.5) * SEG);
      if (tree) { var hgt = 2.2 + Math.random() * 2.5; d.cone.scale.set(1 + Math.random() * 0.5, hgt, 1 + Math.random() * 0.5); d.cone.position.y = 0.9 + hgt / 2; }
      else { var ph = 2 + Math.random() * 3.5; d.col.scale.y = ph; d.col.position.y = ph / 2; d.cap.position.y = ph + 0.15; }
    });
  }
  for (var i = 0; i < NSEG; i++) {
    var s = new THREE.Group();
    var fl = new THREE.Mesh(G.floor, M.floor); fl.position.y = -0.2; fl.receiveShadow = true; s.add(fl);
    // clip: meshes that span the whole segment length, cut back at junctions (placeSeg); dash: lane dashes hidden there
    s.clip = [fl]; s.curb = []; s.dash = [];
    [-1, 1].forEach(function (sd) {
      var sp = new THREE.Mesh(G.side, M.side); sp.rotation.x = -Math.PI / 2; sp.position.set(sd * (LW * 1.65 + 15), -0.25, 0); s.add(sp);
      var cb = new THREE.Mesh(G.curb, M.edge); cb.position.set(sd * LW * 1.65, 0.05, 0); s.add(cb); s.curb.push(cb);
    });
    [-0.5, 0.5].forEach(function (lx) {
      [-2.5, 2.5].forEach(function (z) { var d = new THREE.Mesh(G.dash, M.stripe); d.position.set(lx * LW, 0.01, z); s.add(d); s.dash.push(d); });
    });
    s.deco = [];
    for (var k = 0; k < 4; k++) {
      var dg = new THREE.Group();
      var pil = new THREE.Group(), col = new THREE.Mesh(G.pillar, M.pillar), cap = new THREE.Mesh(G.cap, M.pillar);
      pil.add(col); pil.add(cap); dg.add(pil);
      var tree = new THREE.Group(), tr = new THREE.Mesh(G.trunk, M.trunk), cone = new THREE.Mesh(G.cone, M.tree);
      tr.scale.y = 1.2; tr.position.y = 0.6; tree.add(tr); tree.add(cone); dg.add(tree);
      s.add(dg);
      s.deco.push({ g: dg, side: k < 2 ? -1 : 1, pil: pil, col: col, cap: cap, tree: tree, cone: cone });
    }
    s.position.z = 10 - i * SEG - SEG / 2; s.d = -s.position.z; s.noSplit = true;
    decorate(s); W.add(s); segs.push(s);
  }

  // ---------- runner ----------
  var runner = new THREE.Group(), pose = new THREE.Group(); runner.add(pose); scene.add(runner);
  function part(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || pose).add(m); return m; }
  var torso = part(new THREE.CapsuleGeometry(0.32, 0.5, 2, 8), M.shirt, 0, 1.3, 0);
  part(new THREE.BoxGeometry(0.66, 0.12, 0.42), M.band, 0, 1.55, 0);
  var head = part(new THREE.IcosahedronGeometry(0.27, 1), M.skin, 0, 1.98, 0);
  function limb(w, h, mat, x, y) {
    var p = new THREE.Group(); p.position.set(x, y, 0); pose.add(p);
    part(new THREE.BoxGeometry(w, h, w), mat, 0, -h / 2, 0, p); return p;
  }
  var legL = limb(0.22, 0.75, M.pants, -0.15, 0.78), legR = limb(0.22, 0.75, M.pants, 0.15, 0.78);
  var armL = limb(0.15, 0.62, M.skin, -0.42, 1.58), armR = limb(0.15, 0.62, M.skin, 0.42, 1.58);
  // super cape: shows only while super ammo is stored; hinged at the shoulders, hangs behind (+z, toward camera)
  var CAPE_H = 1.0, cape = new THREE.Group(); cape.position.set(0, 1.64, 0.3); cape.visible = false; pose.add(cape);
  var capeGeo = new THREE.PlaneGeometry(0.72, CAPE_H, 2, 8); capeGeo.translate(0, -CAPE_H / 2, 0);
  var capeBase = capeGeo.attributes.position.array.slice(), capeK = 0;
  var capeMesh = new THREE.Mesh(capeGeo, new THREE.MeshLambertMaterial({ color: 0x7b2ff7, emissive: 0x4a12b0, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
  capeMesh.castShadow = true; cape.add(capeMesh);
  var capeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.06), M.band); capeTrim.position.y = -0.02; cape.add(capeTrim);
  var shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.02; scene.add(shadowBlob);

  // ---------- theme ----------
  var track = 0;
  var cA = new THREE.Color(), cB = new THREE.Color(), cW = new THREE.Color(0xffffff), thA = THEMES[0], thB = THEMES[0], thK = 1;
  function mixC(a, b, k) { return cA.setHex(a).lerp(cB.setHex(b), k); }
  function themeMix(A, B, k) {
    var c = mixC(A.sky, B.sky, k); scene.background.copy(c); scene.fog.color.copy(c); hemi.color.copy(c).lerp(cW, 0.55);
    scene.fog.near = A.fogN + (B.fogN - A.fogN) * k; scene.fog.far = A.fogF + (B.fogF - A.fogF) * k;
    hemi.groundColor.copy(mixC(A.hemiG, B.hemiG, k));
    ['floor', 'side', 'stripe', 'pillar', 'tree'].forEach(function (n) { M[n].color.copy(mixC(A[n], B[n], k)); });
    ['edge', 'low', 'bar', 'blk'].forEach(function (n) { var cc = mixC(A[n], B[n], k); M[n].color.copy(cc); M[n].emissive.copy(cc); });
    M.band.color.copy(M.edge.color); M.band.emissive.copy(M.edge.color);
    var ia = A === THEMES[1] ? 0.9 : 1.6, ib = B === THEMES[1] ? 0.9 : 1.6; sun.intensity = ia + (ib - ia) * k;
  }
  function applyTheme() {
    var T = THEMES[track]; thA = thB = T; thK = 1; themeMix(T, T, 1);
    el.trk.textContent = 'TRACK ' + (track + 1) + ' ' + T.name;
  }
  // round 5: cross-fade theme colors over about 1 s
  function fadeTheme(from) { thA = THEMES[from]; thB = THEMES[track]; thK = 0; el.trk.textContent = 'TRACK ' + (track + 1) + ' ' + thB.name; }

  // ---------- HUD ----------
  function $(id) { return document.getElementById(id); }
  var el = { score: $('score'), speed: $('speed'), trk: $('trk'), duck: $('duck'), flash: $('flash'), start: $('start'), over: $('over'), oscore: $('oscore'), obest: $('obest') };
  function sfx(n) { try { if (window.sfx && typeof window.sfx.play === 'function') window.sfx.play(n); } catch (e) {} }

  // ---------- game state (rules from assets/game.js) ----------
  var state = 'start', score = 0, dist = 0, speed = 6, runT = 0, turn = null, pj = null, hi = 0, level = 1, coinCount = 0, nextCoin = 30;
  var crashT = 0, crashCause = '', crashSide = 0, crashF0 = 0, crashed = false, leanDir = 0;
  var TURN_T = 0.9, CRASH_T = 0.55, BEST_KEY = 'protoB.best';
  try { hi = +localStorage.getItem(BEST_KEY) || 0; } catch (e) {}
  // round 5: levels follow running time (pits L2, fire + moving traps L3, moving blocks L4)
  function levelOf(t) { return Math.min(9, 1 + Math.floor(t / 30)); }
  function forkWin() { return Math.max(2, 3 - Math.max(0, speed - 10) / 12); }
  var lane = 1, px = 1, jumpT = -1, ducking = false, obs = [], nextSpawn = 14, lastReport = 0, shake = 0, speedTier = 0, coinTier = 0, runPhase = 0, deadT = 0;
  var lastIn = '', lastInT = -1e9;
  var gt = 0, paused = false, slideEnd = 0, slideBlend = 0, fovKick = 0;
  var lastLaneChg = { t: -1e9, from: 1, to: 1 }, lastAct = { t: -1e9, kind: '' }, lastNM = -1e9, combo = 0, intT = 0;
  // round 4: lives + shooting
  var MAX_LIVES = 3, MAX_AMMO = 3, AMMO_RECHARGE = 15, SLOW_T = 1.2, SHOT_RANGE = 60, SHOT_SPEED = 70;
  var lives = MAX_LIVES, invulnT = 0, hurtFx = 0, ammo = MAX_AMMO, ammoT = 0, slowT = 0, slowK = 0, worldRate = 0, shot = null;
  // tuning: read live from settings at point of use, game default when missing (docs/hackathon/contract.md)
  function tune(k, d) { try { var s = window.settings && window.settings.get && window.settings.get(); var v = s ? s[k] : undefined; return v == null ? d : v; } catch (e) { return d; } }
  function tn(k, d) { var v = +tune(k, d); return isFinite(v) ? v : d; }
  function maxLives() { return Math.max(1, Math.round(tn('startLives', MAX_LIVES))); }
  function maxAmmo() { return Math.max(1, Math.round(tn('ammoMax', MAX_AMMO))); }
  var godLocal = null;
  function godOn() { if (godLocal !== null) return godLocal; var g = tune('godMode', false); return g === true || g === 'true'; }
  function trapsOn() { var t = tune('trapsOn', true); return t !== false && t !== 'false'; }
  function isPaused() { return paused || (window.game && window.game.paused === true); }
  function msfx(fn, a) { try { if (window.sfx && window.sfx[fn]) window.sfx[fn](a); } catch (e) {} }
  function duckMode() { try { var s = window.settings && window.settings.get && window.settings.get(); return s && s.duckMode === 'slide' ? { slide: true, ms: Math.max(400, Math.min(1500, +s.slideMs || 800)) } : { slide: false, ms: 0 }; } catch (e) { return { slide: false, ms: 0 }; } }

  // overlay, popups, extra HUD (created here so b.html stays untouched)
  var css = document.createElement('style');
  css.textContent = '#pause{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:8;font-size:max(44px,12vh);letter-spacing:.1em}' +
    '#mode,#combo{position:absolute;left:16px;font-size:max(14px,2.6vh);letter-spacing:.08em}#mode{bottom:' + '48px}#combo{bottom:80px;color:#ffd24a;display:none}' +
    '.pop{position:absolute;left:0;right:0;top:30vh;text-align:center;font-size:max(30px,8vh);color:#ffd24a;pointer-events:none;animation:popA .9s ease-out forwards}' +
    '@keyframes popA{0%{transform:scale(.4);opacity:0}20%{transform:scale(1.25);opacity:1}60%{transform:scale(1);opacity:1}100%{transform:scale(1.1) translateY(-6vh);opacity:0}}';
  css.textContent += '#flash{top:auto !important;bottom:14vh;font-size:max(18px,4vh) !important;letter-spacing:.12em}';
  document.head.appendChild(css);
  var hudEl = $('hud');
  var pauseEl = document.createElement('div'); pauseEl.id = 'pause'; pauseEl.className = 't'; pauseEl.textContent = 'PAUSED'; document.body.appendChild(pauseEl);
  var modeEl = document.createElement('div'); modeEl.id = 'mode'; modeEl.className = 't'; hudEl.appendChild(modeEl);
  var comboEl = document.createElement('div'); comboEl.id = 'combo'; comboEl.className = 't'; hudEl.appendChild(comboEl);
  css.textContent += '#coins{position:absolute;top:3vh;left:72px;font-size:max(20px,4.5vh);color:#ffd700}' +
    '#lines{position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 45%,rgba(255,255,255,.75) 0deg 0.8deg,transparent 0.8deg 7deg);' +
    '-webkit-mask-image:radial-gradient(circle at 50% 45%,transparent 28%,#000 75%);mask-image:radial-gradient(circle at 50% 45%,transparent 28%,#000 75%)}';
  var coinsEl = document.createElement('div'); coinsEl.id = 'coins'; coinsEl.className = 't'; coinsEl.textContent = '● 0'; hudEl.appendChild(coinsEl);
  var linesEl = document.createElement('div'); linesEl.id = 'lines'; document.body.appendChild(linesEl);
  css.textContent += '#lives{position:absolute;top:3vh;right:16px;font-size:max(22px,5vh);color:#ff4d6d;letter-spacing:.06em}' +
    '#ammo{position:absolute;top:calc(3vh + max(30px,6.5vh));right:16px;font-size:max(16px,3.4vh);color:#7fe3ff;letter-spacing:.08em}' +
    '#hurtfx{position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(255,0,0,.15) 30%,rgba(255,0,0,.75) 100%)}' +
    '#slowfx{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(90,170,255,.12) 35%,rgba(20,40,120,.55) 100%);mix-blend-mode:normal}';
  var livesEl = document.createElement('div'); livesEl.id = 'lives'; livesEl.className = 't'; hudEl.appendChild(livesEl);
  var ammoEl = document.createElement('div'); ammoEl.id = 'ammo'; ammoEl.className = 't'; hudEl.appendChild(ammoEl);
  var hurtEl = document.createElement('div'); hurtEl.id = 'hurtfx'; document.body.appendChild(hurtEl);
  var slowEl = document.createElement('div'); slowEl.id = 'slowfx'; document.body.appendChild(slowEl);
  css.textContent += '#god{position:absolute;top:calc(3vh + max(30px,6.5vh));left:16px;font-size:max(12px,2.2vh);padding:1px 8px;border-radius:5px;background:#ff3df0;color:#fff;letter-spacing:.14em;display:none}';
  var godEl = document.createElement('div'); godEl.id = 'god'; godEl.className = 't'; godEl.textContent = 'GOD'; hudEl.appendChild(godEl);
  var lastLivesTxt = '', lastAmmoTxt = '', lastHo = -1, lastSo = -1;
  function rep(ch, n) { var s = ''; for (var i = 0; i < n; i++) s += ch; return s; }
  function drawHudR4() {
    var lt = rep('♥', lives) + rep('♡', maxLives() - lives);
    if (lt !== lastLivesTxt) { lastLivesTxt = lt; livesEl.textContent = lt; }
    var at = 'AMMO ' + rep('◆', ammo) + rep('◇', maxAmmo() - ammo);
    if (at !== lastAmmoTxt) { lastAmmoTxt = at; ammoEl.textContent = at; }
    var vis = state === 'running' ? 'block' : 'none';
    if (livesEl.style.display !== vis) { livesEl.style.display = vis; ammoEl.style.display = vis; }
    var gv = state === 'running' && godOn() ? 'block' : 'none'; if (godEl.style.display !== gv) godEl.style.display = gv;
  }
  function popup(txt) {
    var live = hudEl.querySelectorAll('.pop');
    for (var i = 0; i < live.length; i++) if (live[i].textContent === txt) live[i].parentNode.removeChild(live[i]);
    live = hudEl.querySelectorAll('.pop');
    while (live.length >= 4) { live[0].parentNode.removeChild(live[0]); live = hudEl.querySelectorAll('.pop'); }
    var used = {}; for (var j = 0; j < live.length; j++) used[live[j].getAttribute('data-slot')] = 1;
    var slot = 0; while (used[slot]) slot++;
    var p = document.createElement('div'); p.className = 'pop t'; p.textContent = txt; p.setAttribute('data-slot', slot);
    p.style.top = 'calc(24vh + ' + slot + ' * 9vh)'; hudEl.appendChild(p);
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1000);
  }
  // ---- forks ----
  var forkIn = 1e9, forkAbs = 1e9, prevForkAbs = -1e9, choice = '', forkDone = false, yawOff = 0, yawT = 0, yawFrom = 0;
  var turnEl = document.createElement('div'); turnEl.id = 'turn'; turnEl.className = 't'; hudEl.appendChild(turnEl);
  var arrowEl = document.createElement('div'); arrowEl.id = 'arrow'; arrowEl.className = 't'; hudEl.appendChild(arrowEl);
  css.textContent += '#turn{position:absolute;top:22vh;left:0;right:0;text-align:center;font-size:max(36px,10vh);color:#ff5a5a;display:none;animation:blink .5s steps(2) infinite}@keyframes blink{50%{opacity:.35}}' +
    '#arrow{position:absolute;top:36vh;left:0;right:0;text-align:center;font-size:max(30px,8vh);color:#7CFC9A;display:none}';
  var FM = { wall: new THREE.MeshLambertMaterial({ color: 0x552222, flatShading: true }), sign: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffd24a, emissiveIntensity: 0.8, flatShading: true }) };
  var STUB = 44;
  // two junction groups: the next fork, and the one just passed (stays in place while it scrolls away)
  function buildFork() {
    var g = new THREE.Group(), parts = {}; W.add(g); g.visible = false;
    var w = new THREE.Mesh(new THREE.BoxGeometry(LW * 3.4 + 28, 7, 1), FM.wall); w.position.set(0, 3, -3.5); g.add(w);
    // junction: one plain square patch, no lane dashes; main road and branches stop at its edges (placeSeg clips)
    var jp = new THREE.Mesh(new THREE.BoxGeometry(LW * 3.3, 0.4, LW * 3.3), M.floor); jp.position.y = -0.2; jp.receiveShadow = true; g.add(jp);
    // junction edge curbs: far (wall) side always; left/right sides only when that side is closed (setForkLook)
    var jf = new THREE.Mesh(new THREE.BoxGeometry(LW * 3.3 + 0.35, 0.3, 0.35), M.edge); jf.position.set(0, 0.05, -LW * 1.65); g.add(jf);
    [-1, 1].forEach(function (sd) {
      // long branch stub, already built and visible before the turn; sits a few cm below road segments so they win where both draw
      var br = new THREE.Group(), bf = new THREE.Mesh(new THREE.BoxGeometry(STUB, 0.4, LW * 3.3), M.floor); bf.position.y = -0.24; br.add(bf);
      [-1, 1].forEach(function (e) { var cb = new THREE.Mesh(new THREE.BoxGeometry(STUB + 0.35, 0.3, 0.33), M.edge); cb.position.set(-sd * 0.175, 0.02, e * LW * 1.65); br.add(cb); });
      // lane dashes along the branch direction, between its three lanes
      [-0.5, 0.5].forEach(function (lz) { for (var q = 0; q < STUB / 5; q++) { var dm = new THREE.Mesh(G.dash, M.stripe); dm.rotation.y = HP; dm.position.set(-STUB / 2 + 2.5 + q * 5, -0.03, lz * LW); br.add(dm); } });
      br.position.set(sd * (LW * 1.65 + STUB / 2), 0, 0); g.add(br);
      var cw = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 7.5), FM.wall); cw.position.set(sd * (LW * 1.65 + 0.6), 3, 0); g.add(cw);
      var ar = new THREE.Group();
      var sh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.2), FM.sign); ar.add(sh);
      var hd = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 3), FM.sign); hd.rotation.z = -sd * Math.PI / 2; hd.position.x = sd * 1.6; ar.add(hd);
      ar.position.set(sd * LW * 1.9, 2.6, 14); g.add(ar);
      var po = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), M.post); po.position.set(sd * LW * 1.9, 1.3, 14); g.add(po);
      var wa = ar.clone(); wa.position.set(sd * LW * 1.2, 3.2, -2.9); g.add(wa);
      var jc = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, LW * 3.3 + 0.35), M.edge); jc.position.set(sd * LW * 1.65, 0.05, 0); g.add(jc);
      parts[sd < 0 ? 'left' : 'right'] = { br: br, cw: cw, ar: ar, po: po, wa: wa, jc: jc };
    });
    return { g: g, parts: parts };
  }
  var forks = [buildFork(), buildFork()], fCur = 0, forkG = forks[0].g, forkParts = forks[0].parts, oldFork = forks[1].g, forkType = 'split';
  function setForkLook() {
    ['left', 'right'].forEach(function (k) {
      var open = forkType === 'split' || forkType === k, p = forkParts[k];
      p.br.visible = p.ar.visible = p.po.visible = p.wa.visible = open; p.cw.visible = p.jc.visible = !open;
    });
  }
  function scheduleFork(from) {
    prevForkAbs = forkAbs < 1e8 ? forkAbs : prevForkAbs; forkIn = speed * tn('forkEvery', 27) * (0.73 + Math.random() * 0.54); forkAbs = from + forkIn; choice = ''; forkDone = false;
    var pSingle = Math.min(0.75, 0.2 + Math.max(0, speed - 7) * 0.03);
    forkType = Math.random() < pSingle ? (Math.random() < 0.5 ? 'left' : 'right') : 'split'; setForkLook();
  }
  // ---- round 5: road mapping. Everything in W is placed by distance d along the road and lateral x.
  // Past the next junction the road continues on the open/chosen branch; behind the last junction it is the old road.
  var RP = { x: 0, z: 0, r: 0 }, BS = 0, lastHint = 0;
  function brSide() { if (turn) return turn.sd; if (forkType === 'left') return -1; if (forkType === 'right') return 1; return choice === 'left' ? -1 : choice === 'right' ? 1 : 0; }
  function road(d, lx, ks) {
    if (pj && d < pj.d) { var b = pj.d - d; RP.x = pj.sd * b; RP.z = -pj.d - pj.sd * lx; RP.r = pj.sd * HP; return true; }
    if (d > forkIn) { var bs = BS || ks || 0; if (!bs) return false; var e = d - forkIn; RP.x = bs * e + antX; RP.z = -forkIn + bs * lx; RP.r = -bs * HP; return true; }
    RP.x = lx + antBend(d); RP.z = -d; return true;
  }
  // ---------- fork anticipation ----------
  // antS: smoothed chosen side (-1..1); antX: lateral shift of the junction, road ahead bends into it
  var antS = 0, antX = 0, ANT_BEND = 1.6;
  function antBend(d) {
    RP.r = 0; if (!antX || d <= 0) return 0;
    var F = Math.max(4, forkIn), u = Math.min(1, d / F);
    if (u < 1) RP.r = -Math.atan(antX * 6 * u * (1 - u) / F);
    return antX * u * u * (3 - 2 * u);
  }
  function antDim(p, k, dt) {
    var tg = choice && forkType === 'split' && choice !== k ? 1 : 0; p.fd = (p.fd || 0) + (tg - (p.fd || 0)) * Math.min(1, dt * 4);
    if (!p.dm) { p.dm = []; p.br.traverse(function (m) { if (m.isMesh) { var src = m.material; m.material = src.clone(); m.material.transparent = true; p.dm.push({ m: m.material, src: src }); } }); }
    for (var i = 0; i < p.dm.length; i++) { var q = p.dm[i]; q.m.color.copy(q.src.color).multiplyScalar(1 - 0.55 * p.fd); if (q.src.emissive) q.m.emissive.copy(q.src.emissive).multiplyScalar(1 - 0.8 * p.fd); q.m.opacity = 1 - 0.7 * p.fd; }
    var sk = 1 - 0.65 * p.fd; p.ar.scale.setScalar(sk); p.wa.scale.setScalar(sk);
  }
  // ---------- end fork anticipation ----------
  function place(m, d, lx, y) {
    // split fork with no choice yet: items past the junction sit on either branch (stable per 12 m chunk)
    var ks = 0; if (!BS && !m.noSplit && d > forkIn) { ks = m.userData.ks || (m.userData.ks = (Math.floor((dist + d) / 12) & 1) ? 1 : -1); }
    var ok = road(d, lx, ks); m.visible = ok; if (ok) { m.position.set(RP.x, y, RP.z); m.rotation.y = RP.r; } return ok; }
  // cut a segment to the part of its length that lies on its own road piece: main road ends at the junction edge,
  // branch / old road start at it, so no surfaces or markings cross the junction square
  var JH2 = LW * 1.65;
  function clipSeg(s) {
    var lo = -1e9, hi = 1e9, d = s.d;
    if (pj && d < pj.d) hi = pj.d - JH2;
    else {
      if (pj) lo = pj.d + JH2;
      if (d > forkIn) lo = Math.max(lo, forkIn + JH2); else hi = forkIn - JH2;
    }
    var a = Math.max(d - SEG / 2, lo), b = Math.min(d + SEG / 2, hi), L = Math.max(0, b - a);
    // floor overlaps neighbours by 5 cm on free seams (hides cracks on the bend); curbs run 0.2 m past both ends so
    // they overlap the next curb or reach into the junction corner curb
    var fa = a > d - SEG / 2 ? a : a - 0.05, fb = b < d + SEG / 2 ? b : b + 0.05;
    for (var i = 0; i < s.clip.length; i++) { var m = s.clip[i]; m.visible = L > 0.01; m.scale.z = Math.max(0.001, (fb - fa) / SEG); m.position.z = -((fa + fb) / 2 - d); }
    for (var k = 0; k < s.curb.length; k++) { var cm = s.curb[k]; cm.visible = L > 0.01; cm.scale.z = (L + 0.4) / SEG; cm.position.z = -((a + b) / 2 - d); }
    for (var j = 0; j < s.dash.length; j++) { var dm = s.dash[j], dd = d - dm.position.z; dm.visible = dd - 1.2 >= a && dd + 1.2 <= b; }
  }
  function placeSeg(s) {
    place(s, s.d, 0, 0); clipSeg(s);
    for (var i = 0; i < s.deco.length; i++) { var dc = s.deco[i], dd = s.d - dc.g.position.z; dc.g.visible = Math.abs(dd - forkIn) > 6 && !(pj && Math.abs(dd - pj.d) < 6); }
    if (s.crowd) for (var c = 0; c < s.crowd.length; c++) { var fn = s.crowd[c], fd = s.d - fn.g.position.z; fn.g.visible = fn.on && Math.abs(fd - forkIn) > 6 && !(pj && Math.abs(fd - pj.d) < 6); }
  }
  // world transform during the 0.9 s turn: runner follows a quarter arc around the junction, world rotates eased
  var Pv = new THREE.Vector3();
  function worldXform() {
    if (!turn) { W.rotation.y = 0; W.position.set(0, 0, 0); return; }
    var j0 = turn.j0, u = Math.max(0, Math.min(1, (j0 - forkIn) / (2 * j0))), psi = u * HP;
    var ue = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, a = turn.sd * ue * HP;
    Pv.set(turn.sd * (j0 * (1 - Math.cos(psi)) + Math.max(0, -j0 - forkIn)), 0, -forkIn + j0 * (1 - Math.sin(psi)) - Math.max(0, -j0 - forkIn) * 0);
    var ca = Math.cos(a), sa = Math.sin(a);
    W.rotation.y = a; W.position.set(-(Pv.x * ca + Pv.z * sa), 0, -(-Pv.x * sa + Pv.z * ca));
  }
  function startCrash(cause, side) {
    crashT = CRASH_T; crashCause = cause; crashSide = side; crashF0 = forkIn; crashed = true; choice = '';
    shake = 0.25; sfx('hit');
    feelHit();
  }
  // a hit costs one life; returns true if the run is still alive
  function loseLife(why) {
    if (godOn()) { popup('GOD'); invulnT = Math.max(invulnT, 1); return true; }
    lives = Math.max(0, lives - 1); deathCause = why || deathCause;
    hurtFx = 1; shake = 0.35; invulnT = 2; sfx('hurt'); popup('-1 ♥');
    feelHit(); narrate(lives === 1 ? 'life_lost' : 'hit');
    return lives > 0;
  }
  function forkResolve() {
    if (choice && (forkType === 'split' || choice === forkType)) { doTurn(false); return; }
    // shield or god mode: missed/wrong turn auto-steers onto the open branch, no life lost
    if (shieldT > 0 || godOn()) { choice = forkType === 'split' ? (choice || 'right') : forkType; popup(shieldT > 0 ? 'SHIELD SAVE' : 'GOD SAVE'); doTurn(true); return; }
    var why = choice ? 'Wrong way! Ran into the wall' : 'Missed the TURN! Ran into the wall';
    if (lives > 1) { loseLife(why); choice = forkType === 'split' ? (choice || 'right') : forkType; doTurn(true); }
    else { lives = 0; startCrash(why, choice === 'left' ? -1 : choice === 'right' ? 1 : 0); }
  }
  function doTurn(penalty) {
    if (turn) return;
    var left = choice === 'left', from = track;
    track = (track + (left ? 2 : 1)) % 3; fadeTheme(from); sfx('turn'); sfx('slide');
    if (!penalty) { score += 50; popup('TURN +50'); }
    report(true);
    // smooth turn: obstacles and coins stay; world rotates around the junction over TURN_T
    turn = { sd: left ? -1 : 1, j0: Math.max(0.5, forkIn), li: lastHint }; crowdReact('fork');
    yawFrom = 0; yawT = TURN_T; yawOff = 0; leanDir = turn.sd; fovKick = 6;
  }
  function finishTurn() {
    pj = { d: forkIn, sd: turn.sd }; turn = null; worldXform();
    oldFork = forkG; fCur ^= 1; forkG = forks[fCur].g; forkParts = forks[fCur].parts;
    scheduleFork(dist);
  }
  function setPause(on) {
    if (paused === on) return;
    paused = on; msfx('duck', on); sfx(on ? 'pause' : 'resume');
    report(true);
  }
  function nearMiss() {
    if (gt - lastNM < 300) return;
    combo = gt - lastNM < 3000 ? Math.min(combo + 1, 3) : 1;
    lastNM = gt; var bonus = 25; score += bonus; fovKick = 7;
    popup('NEAR MISS! +' + bonus + (combo > 1 ? '  x' + combo : ''));
    sfx(combo > 1 ? 'combo' : 'nearmiss'); narrate('near_miss');
  }
  function checkNear(o) {
    var dl = gt - lastLaneChg.t, da = gt - lastAct.t;
    if (o.lane !== lane && lastLaneChg.from === o.lane && dl < 250) return nearMiss();
    if (o.lane === lane && da < 200 && ((o.type === 'low' && lastAct.kind === 'jump') || (o.type === 'high' && lastAct.kind === 'duck'))) return nearMiss();
    if (o.type === 'block' && Math.abs(o.lane - lane) === 1 && lastLaneChg.to === lane && dl < 120) return nearMiss();
  }

  function report(force) {
    var now = Date.now();
    if (!force && now - lastReport < 500) return;
    lastReport = now;
    try { if (typeof window.onGameState === 'function') window.onGameState({ state: state, score: Math.floor(score), track: track, lives: lives, coins: coinCount, level: level, paused: !!isPaused() }); } catch (e) {}
  }
  function clearObs() { obs.forEach(function (o) { W.remove(o.mesh); }); obs = []; }
  function reset() {
    clearObs();
    score = 0; dist = 0; speed = tn('speedStart', 6); lane = 1; px = 1; jumpT = -1; ducking = false; nextSpawn = 16; state = 'running'; speedTier = 1; coinTier = 0;
    runner.rotation.set(0, 0, 0); paused = false; pauseEl.style.display = 'none'; msfx('duck', false); slideEnd = 0; slideBlend = 0; gt = 0; speed = tn('speedStart', 6); runT = 0; turn = null; pj = null; worldXform(); oldFork.visible = false; forkAbs = 1e9; prevForkAbs = -1e9; yawOff = 0; yawT = 0; scheduleFork(0); forkAbs = forkIn; combo = 0; lastNM = -1e9; lastLaneChg = { t: -1e9, from: 1, to: 1 }; lastAct = { t: -1e9, kind: '' };
    clearCoins(); coinCount = 0; nextCoin = 30; level = 1; crashT = 0; crashed = false; leanDir = 0; coinsEl.textContent = '● 0';
    freeHeart(); nextHeart = heartGap();
    superReset(); shieldReset();
    lives = maxLives(); invulnT = 0; hurtFx = 0; ammo = maxAmmo(); ammoT = 0; deathCause = ''; runner.visible = true;
    if (slowT > 0) msfx('slowmo', false); slowT = 0; slowK = 0; endShot();
    msfx('music', true); sfx('start'); report(true);
    feelReset(); nHide(); (lvN = 0, narrate('start'));
  }
  var deathCause = '';
  function die(why) {
    deathCause = why || ''; state = 'dead'; deadT = performance.now(); shake = 0.6; crashT = 0;
    feelHit();
    lives = 0; invulnT = 0; shieldT = 0; runner.visible = true; if (slowT > 0) msfx('slowmo', false); slowT = 0; slowK = 0; endShot();
    nHide(); narrate(hi > 0 && score > hi ? 'high_score' : 'game_over');
    if (score > hi) { hi = score; try { localStorage.setItem(BEST_KEY, String(Math.floor(hi))); } catch (e) {} }
    sfx('hit'); sfx('dead'); msfx('music', false); if (paused) { paused = false; msfx('duck', false); } slideEnd = 0; report(true);
  }
  function show(t) { lastIn = t; lastInT = performance.now(); }

  var inLog = [], lastInWall = 0, sensors = {}, dbgOn = false, fps = 0;
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
    if (m === 'turn_left') m = 'track_prev'; else if (m === 'turn_right') m = 'track';
    if (crashT > 0) return;
    if (turn && state === 'running' && (m === 'track' || m === 'track_prev' || m === 'left' || m === 'right')) return;
    if ((m === 'track' || m === 'track_prev') && state === 'running') {
      if (!isPaused() && forkIn <= speed * forkWin()) { choice = m === 'track' ? 'right' : 'left'; show(choice === 'left' ? 'TURN LEFT' : 'TURN RIGHT'); }
      return;
    }
    if (m === 'track') { track = (track + 1) % 3; applyTheme(); show('TRACK ' + (track + 1)); sfx('track'); report(true); return; }
    if (m === 'track_prev') { track = (track + 2) % 3; applyTheme(); show('TRACK ' + (track + 1)); sfx('track'); report(true); return; }
    if (m === 'start') { if (state !== 'running') reset(); show('START'); return; }
    if (m === 'restart') { reset(); show('RESTART'); return; }
    if (m === 'pause') { if (state === 'running') setPause(!paused); return; }
    if (state !== 'running' || isPaused()) return;
    if (m === 'shoot') { shoot(); return; }
    if (m === 'shield') { shieldUse(); return; }
    if ((m === 'left' || m === 'right') && forkIn <= speed * forkWin()) { choice = m; show(m === 'left' ? 'TURN LEFT' : 'TURN RIGHT'); return; }
    if (m === 'left') { if (lane > 0) { lastLaneChg = { t: gt, from: lane, to: lane - 1 }; lane--; sfx('lane'); } show('LEFT'); }
    else if (m === 'right') { if (lane < 2) { lastLaneChg = { t: gt, from: lane, to: lane + 1 }; lane++; sfx('lane'); } show('RIGHT'); }
    else if (m === 'jump') {
      if (ducking && slideEnd > 0) { ducking = false; slideEnd = 0; jumpT = 0; lastAct = { t: gt, kind: 'jump' }; sfx('jump'); show('JUMP'); }
      else if (ducking) { ducking = false; show('STAND'); sfx('stand'); }
      else { if (jumpT < 0) { jumpT = 0; lastAct = { t: gt, kind: 'jump' }; sfx('jump'); } else fBuf = gt + 150; show('JUMP'); }
    } else if (m === 'duck') {
      if (jumpT < 0 && !ducking) {
        var dm = duckMode(); ducking = true; lastAct = { t: gt, kind: 'duck' };
        if (dm.slide) { slideEnd = gt + dm.ms; sfx('slide'); } else { slideEnd = 0; sfx('duck'); }
      }
      show(duckMode().slide ? 'SLIDE' : 'DUCK');
    }
  }
  window.game = { input: input, debug: debug, paused: false, restart: function () { input('restart', 'keyboard'); } };

  // test keys (docs/hackathon/contract.md): spawn things ~3 s ahead in the current lane, only while running; ?debug in the URL only
  var TEST_KEYS = /[?&]debug(=|&|$)/.test(location.search);
  function testKey(k) {
    if (!TEST_KEYS) return false;
    k = String(k).toUpperCase();
    if ('123456789LKG'.indexOf(k) < 0 || k.length !== 1) return false;
    if (state !== 'running' || isPaused() || crashT > 0) return true;
    var d = Math.max(12, speed * 3), x = (lane - 1) * LW, name = '';
    if (k === '1') { freeSuper(); sup.on = true; sup.lane = lane; sup.d = d; superG.userData.ks = 0; place(superG, d, x, SUPER_Y); name = 'SUPER AMMO'; }
    else if (k === '2') { hrt.on = true; hrt.lane = lane; hrt.d = d; heart.userData.ks = 0; place(heart, d, x, HEART_Y); name = 'HEART'; }
    else if (k === '3') { for (var i = 0; i < 5; i++) addCoin(lane, d + i * 2.2, 0.9); name = 'COIN ROW'; }
    else if (k === '4') { addObs(lane, d, 'low'); name = 'LOW BARRIER'; }
    else if (k === '5') { addObs(lane, d, 'high'); name = 'HIGH BAR'; }
    else if (k === '6') { addObs(lane, d, 'block'); name = 'BLOCK'; }
    else if (k === '7') { addObs(lane, d, 'pit', { lanes: [lane] }); name = 'PIT'; }
    else if (k === '8') { addObs(1, d, 'fire'); name = 'FIRE STRIP'; }
    else if (k === '9') { makeMover(addObs(lane, d, 'mblock', { lf: lane }), lane, lane === 2 ? -1 : 1, { ph: 0, k: 0, nd: 1, t: -1 }, 2.9); name = 'MOVING BLOCK'; }
    else if (k === 'L') { runT = Math.max(runT, Math.min(9, level) * 30); name = 'LEVEL UP'; }
    else if (k === 'K') { ammo = maxAmmo(); ammoT = 0; shieldN = 1; shieldCd = 0; name = 'AMMO + SHIELD REFILL'; }
    else if (k === 'G') {
      var on = !godOn();
      if (window.settings && typeof window.settings.set === 'function') { try { window.settings.set('godMode', on); godLocal = null; } catch (e) { godLocal = on; } } else godLocal = on;
      if (godOn() !== on) godLocal = on;
      name = 'GOD MODE ' + (on ? 'ON' : 'OFF');
    }
    popup('TEST: ' + name); return true;
  }
  window.addEventListener('keydown', function (e) {
    var k = e.key, m = null;
    if ((k === 'd' || k === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) { setDbg(!dbgOn); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && testKey(k)) { e.preventDefault(); return; }
    if ((k === 'f' || k === 'F') && TEST_KEYS && !e.ctrlKey && !e.metaKey && !e.altKey) { if (state === 'running' && !paused) { var ft = speed * 4.5 + 3; if (forkIn > ft) { forkIn = ft; forkAbs = dist + ft; choice = ''; sweepZone(); show('FORK SOON'); } } return; }
    if (k === 'ArrowLeft') m = 'left'; else if (k === 'ArrowRight') m = 'right';
    else if (k === 'ArrowUp') m = 'jump'; else if (k === 'ArrowDown') m = 'duck';
    else if (k === ' ') m = 'start';
    else if (k === 'Backspace') m = 'restart';
    else if (k === 'Enter') m = state === 'running' ? 'shoot' : 'start';
    else if (k === 'x' || k === 'X') m = 'shoot';
    else if (k === 'z' || k === 'Z') m = 'shield';
    else if (k === 'p' || k === 'P') m = 'pause';
    else if (k === 'Escape') { if (window.game && window.game.paused === true) return; m = 'pause'; }
    else if (k === 'q' || k === 'Q') m = 'track_prev'; else if (k === 'e' || k === 'E') m = 'track';
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
  // on-screen Play + mute buttons; their taps must not reach the swipe handler above
  function tapBtn(b, fn) {
    ['touchstart', 'touchend'].forEach(function (ev) { b.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
    b.addEventListener('click', function () { fn(); b.blur(); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.ov .play'), function (b) { tapBtn(b, function () { window.game.input('start', 'touch'); }); });
  var muteBtn = $('bmute'), muteShown = null;
  if (muteBtn) tapBtn(muteBtn, function () { if (window.sfx) window.sfx.toggleMute(); });

  // ---------- debug panel ----------
  var panel = document.createElement('div'); panel.id = 'dbg'; panel.style.display = 'none'; document.body.appendChild(panel);
  function setDbg(on) {
    dbgOn = on; panel.style.display = on ? 'block' : 'none';
    try { localStorage.setItem('dbg', on ? '1' : '0'); } catch (e) {}
    if (on) renderDbg();
  }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function hms(t) { var d = new Date(t); return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '.' + pad(d.getMilliseconds(), 3); }
  function esc(x) { return String(x).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function renderDbg() {
    var now = Date.now(), h = '';
    function row(k, v) { return '<div class="r"><span class="k">' + k + '</span><span>' + esc(v) + '</span></div>'; }
    h += '<b>DEBUG</b> (D)';
    h += row('fps', fps.toFixed(0)) + row('state', state) + row('score', Math.floor(score)) + row('speed', speed.toFixed(2));
    h += row('lane', lane) + row('jump', jumpT >= 0 ? 'ACTIVE' : '-') + row('duck', ducking ? 'DUCKING' : 'standing') + row('track', track) + row('obstacles', obs.length);
    h += row('level', level) + row('coins', coinCount) + row('fork', forkType + ' in ' + forkIn.toFixed(0)) + row('fork win', forkWin().toFixed(2) + ' s');
    h += row('god', godOn() ? 'ON' : 'off') + (TEST_KEYS ? row('test keys', '1 super 2 heart 3 coins 4 low 5 high 6 block 7 pit 8 fire 9 mblock F fork L lvl K refill G god') : '');
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
  try { if (localStorage.getItem('dbg') === '1') dbgOn = true; } catch (e) {}
  if (/[?&]debug=1(&|$)/.test(location.search)) dbgOn = true;
  if (dbgOn) panel.style.display = 'block';

  // ---------- obstacles ----------
  function makeObs(type) {
    var g = new THREE.Group(), m;
    if (type === 'low') {
      m = new THREE.Mesh(G.low, M.low); m.position.y = 0.3; m.castShadow = true; g.add(m);
      m = new THREE.Mesh(G.lowTop, M.stripe); m.position.y = 0.62; g.add(m);
    } else if (type === 'high') {
      [-1, 1].forEach(function (sd) { var p = new THREE.Mesh(G.post, M.post); p.position.set(sd * LW * 0.46, 1.1, 0); p.castShadow = true; g.add(p); });
      m = new THREE.Mesh(G.bar, M.bar); m.position.y = 1.85; m.castShadow = true; g.add(m);
    } else if (type === 'pit') {
      m = new THREE.Mesh(G.pit, TM.pit); m.position.y = 0.01; g.add(m);
      [-1, 1].forEach(function (sd) { var r = new THREE.Mesh(G.pitRim, TM.rim); r.position.set(0, 0.03, sd * 1.3); g.add(r); });
    } else if (type === 'fire') {
      m = new THREE.Mesh(G.fireBase, TM.fireBase); m.position.y = 0.03; g.add(m);
      var sp = new THREE.Group(); g.add(sp); g.spikes = sp;
      for (var i = 0; i < 9; i++) { var c = new THREE.Mesh(G.spike, TM.spike); c.position.set((i - 4) * LW * 0.34, 0.3, (i % 2) * 0.3 - 0.15); sp.add(c); }
      var fl = new THREE.Mesh(G.flame, TM.flame); fl.position.y = 0.4; g.add(fl); g.flame = fl;
    } else if (type === 'mblock') {
      m = new THREE.Mesh(G.blk, TM.mblk); m.position.y = 1.2; m.castShadow = true; g.add(m);
    } else {
      m = new THREE.Mesh(G.blk, M.blk); m.position.y = 1.2; m.castShadow = true; g.add(m);
    }
    W.add(g); return g;
  }
  // does obstacle o block lane l (for coin placement)
  function hitsLane(o, l) { return o.type === 'fire' || o.type === 'mblock' || (o.lanes ? o.lanes.indexOf(l) >= 0 : o.lane === l); }
  function addObs(l, d, type, extra) {
    var o = { lane: l, d: d, type: type, mesh: makeObs(type) };
    if (extra) for (var k in extra) o[k] = extra[k];
    placeObs(o); obs.push(o);
    for (var i = 0; i < coins.length; i++) { var c = coins[i]; if (c.on && Math.abs(c.d - d) < 2.2 && hitsLane(o, c.lane) && c.y < 1.4) freeCoin(c); }
    return o;
  }
  // ---------- coins (fixed pool, shared geometry/material) ----------
  var coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 14); coinGeo.rotateX(Math.PI / 2);
  var coinMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.6 });
  var coins = [], COIN_N = 70, coinSpin = 0;
  for (var ci = 0; ci < COIN_N; ci++) { var cmesh = new THREE.Mesh(coinGeo, coinMat); cmesh.visible = false; W.add(cmesh); coins.push({ mesh: cmesh, on: false, lane: 1, d: 0, y: 0.9 }); }
  function freeCoin(c) { c.on = false; c.mesh.visible = false; }
  function clearCoins() { for (var i = 0; i < coins.length; i++) freeCoin(coins[i]); }
  function addCoin(l, d, y) {
    if (inZone(dist + d)) return;
    for (var i = 0; i < obs.length; i++) { var o = obs[i]; if (Math.abs(o.d - d) < 2.2 && hitsLane(o, l) && y < 1.4 && o.type !== 'high') return; }
    for (var j = 0; j < coins.length; j++) if (!coins[j].on) {
      var c = coins[j]; c.on = true; c.mesh.userData.ks = 0; c.lane = l; c.d = d; c.y = y; place(c.mesh, d, (l - 1) * LW, y); return;
    }
  }
  function spawnCoins() {
    var r = Math.random(), base = 74, l = Math.floor(Math.random() * 3), n, i;
    if (r < 0.65) { n = 3 + Math.floor(Math.random() * 3); for (i = 0; i < n; i++) addCoin(l, base + i * 2.2, 0.9); }
    else { var dir = l === 2 ? -1 : 1; n = 5; for (i = 0; i < n; i++) { addCoin(l, base + i * 2.6, 0.9); if (i % 2 === 1) { l += dir; if (l < 0 || l > 2) { dir = -dir; l += 2 * dir; } } } }
  }
  function coinArc(l, d) {
    var span = speed * JD * 0.85, n = 4;
    for (var i = 0; i < n; i++) { var t = (i + 0.5) / n; addCoin(l, d + (t - 0.5) * span, 0.9 + JH * Math.sin(Math.PI * t)); }
  }
  // sparkle pool
  var sparks = [];
  var sparkGeo = new THREE.OctahedronGeometry(0.35, 0);
  for (var si = 0; si < 6; si++) { var smesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0, depthWrite: false })); smesh.visible = false; scene.add(smesh); sparks.push({ mesh: smesh, t: 0 }); }
  var sparkI = 0;
  function sparkle(x, y, z) { var s = sparks[sparkI]; sparkI = (sparkI + 1) % sparks.length; s.t = 0.35; s.mesh.position.set(x, y, z); s.mesh.visible = true; }
  function collectCoin(c) {
    freeCoin(c); coinCount++; cmCoinT = gt; score += 10; sfx('coin'); coinsEl.textContent = '● ' + coinCount;
    sparkle((c.lane - 1) * LW, c.y, 0);
    feelCoin((c.lane - 1) * LW, c.y);
    // round 5: every 10 coins = +1 ammo
    if (coinCount % Math.max(1, Math.round(tn('coinsPerAmmo', 10))) === 0 && ammo < maxAmmo()) { ammo++; ammoT = 0; sfx('life'); popup('+1 AMMO'); }
    if (coinCount % 10 === 0) narrate('coin_streak');
  }
  // ---------- shooting (round 4) ----------
  var gun = new THREE.Group();
  (function () {
    var gm = lam(0x2a2d34), gb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.14), gm); gb.position.y = -0.2; gun.add(gb);
    var gr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.22), gm); gr.position.set(0, 0.0, 0.1); gun.add(gr);
    var tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0x7fe3ff })); tip.position.y = -0.43; gun.add(tip);
  })();
  gun.position.set(0, -0.64, 0); gun.visible = false; armR.add(gun);
  var projMesh = new THREE.Group();
  projMesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  var trail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.02, 1.4, 8), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.7, depthWrite: false }));
  trail.rotation.x = Math.PI / 2; trail.position.z = 0.75; projMesh.add(trail);
  projMesh.visible = false; scene.add(projMesh);
  var projLight = new THREE.PointLight(0x7fe3ff, 0, 9, 2); scene.add(projLight);
  var parts = [], PART_N = 90, partI = 0, partGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  var PART_COL = [0xffd24a, 0xff7a1a, 0xffffff, 0x7fe3ff, 0xff4d6d];
  for (var pi = 0; pi < PART_N; pi++) {
    var pm = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    pm.visible = false; scene.add(pm); parts.push({ mesh: pm, t: 0, vx: 0, vy: 0, vz: 0 });
  }
  function burst(x, y, z) {
    for (var n = 0; n < 34; n++) {
      var p = parts[partI]; partI = (partI + 1) % PART_N;
      var a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = 3 + Math.random() * 5, h = Math.sqrt(1 - u * u);
      p.vx = Math.cos(a) * h * r; p.vy = Math.abs(u) * r + 3; p.vz = Math.sin(a) * h * r; p.t = 0.7 + Math.random() * 0.5; p.t0 = p.t;
      p.mesh.material.color.setHex(PART_COL[n % PART_COL.length]); p.mesh.material.opacity = 1;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z); p.mesh.visible = true;
    }
  }
  function updateParts(dt) {
    var drift = worldRate * dt;
    for (var i = 0; i < PART_N; i++) {
      var p = parts[i]; if (p.t <= 0) continue;
      p.t -= dt; p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt; p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt); p.mesh.position.z += p.vz * dt + drift;
      p.mesh.rotation.x += dt * 8; p.mesh.rotation.y += dt * 6;
      var k = Math.max(0, p.t / p.t0); p.mesh.material.opacity = k; p.mesh.scale.setScalar(0.5 + k);
      if (p.t <= 0) p.mesh.visible = false;
    }
  }
  // ---- round 5: rare heart pickup (+1 life, +50 at full lives)
  var heart = new THREE.Group(), heartSpin = new THREE.Group(), heartHalo; heart.add(heartSpin);
  (function () {
    var hm = new THREE.MeshLambertMaterial({ color: 0xff2d4d, emissive: 0xff1030, emissiveIntensity: 0.8, flatShading: true });
    var s1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), hm); s1.position.set(-0.15, 0.1, 0);
    var s2 = s1.clone(); s2.position.x = 0.15;
    var cn = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.5, 12), hm); cn.rotation.z = Math.PI; cn.position.y = -0.22;
    heartHalo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    heartSpin.add(s1); heartSpin.add(s2); heartSpin.add(cn); heartSpin.add(heartHalo);
  })();
  heart.visible = false; W.add(heart);
  function heartGap() { return tn('heartEvery', 50) * (0.85 + Math.random() * 0.3); }
  function superGap() { return tn('superEvery', 75) * (0.8 + Math.random() * 0.4); }
  var hrt = { on: false, lane: 1, d: 0 }, nextHeart = heartGap(), HEART_Y = 1.0;
  function freeHeart() { hrt.on = false; heart.visible = false; }
  function spawnHeart() {
    var d = 74; if (inZone(dist + d) || forkIn < d + 12) return false;
    var l0 = Math.floor(Math.random() * 3);
    for (var k = 0; k < 3; k++) {
      var l = (l0 + k) % 3, ok = true;
      for (var i = 0; i < obs.length; i++) if (Math.abs(obs[i].d - d) < 4 && hitsLane(obs[i], l)) { ok = false; break; }
      if (ok) { hrt.on = true; hrt.lane = l; hrt.d = d; heart.userData.ks = 0; place(heart, d, (l - 1) * LW, HEART_Y); return true; }
    }
    return false;
  }
  function collectHeart() {
    freeHeart(); sfx('life'); sparkle((hrt.lane - 1) * LW, HEART_Y, 0);
    if (lives < maxLives()) { lives++; popup('+1 LIFE'); } else { score += 50; popup('+50'); }
  }
  // ---------- super ammo ----------
  // rare pickup (~60-90 s): next shot pierces up to 3 obstacles/traps in the lane, chained explosions, max 1 stored
  var SUPER_Y = 1.0, SUPER_RANGE = 75, superN = 0, nextSuper = 75, sup = { on: false, lane: 1, d: 0 };
  var superG = new THREE.Group(), superSpin = new THREE.Group(), superRing; superG.add(superSpin);
  (function () {
    var cm = new THREE.MeshLambertMaterial({ color: 0x8a2be2, emissive: 0x6a1bd0, emissiveIntensity: 0.9, flatShading: true });
    var gm = new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0xffb000, emissiveIntensity: 0.9, flatShading: true });
    superSpin.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), cm));
    [-1, 1].forEach(function (s) { var b = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.56), gm); b.position.y = s * 0.19; superSpin.add(b); });
    superRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24), gm); superG.add(superRing);
    superG.add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), new THREE.MeshBasicMaterial({ color: 0xb36bff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
  })();
  superG.visible = false; W.add(superG);
  var superProj = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xffd24a })); superProj.visible = false; scene.add(superProj);
  css.textContent += '#super{position:absolute;top:calc(3vh + max(30px,6.5vh) + max(26px,5vh));right:16px;font-size:max(14px,2.8vh);padding:2px 10px;border-radius:6px;background:linear-gradient(90deg,#7b2ff7,#ffb000);color:#fff;letter-spacing:.14em;display:none;animation:blink .6s steps(2) infinite}';
  var superEl = document.createElement('div'); superEl.id = 'super'; superEl.className = 't'; superEl.textContent = 'SUPER'; hudEl.appendChild(superEl);
  function freeSuper() { sup.on = false; superG.visible = false; }
  function superReset() { freeSuper(); superN = 0; nextSuper = superGap(); }
  function spawnSuper() {
    var d = 74; if (superN > 0 || hrt.on || inZone(dist + d) || forkIn < d + 12) return false;
    var l0 = Math.floor(Math.random() * 3);
    for (var k = 0; k < 3; k++) {
      var l = (l0 + k) % 3, ok = true;
      for (var i = 0; i < obs.length; i++) if (Math.abs(obs[i].d - d) < 4 && hitsLane(obs[i], l)) { ok = false; break; }
      if (ok) { sup.on = true; sup.lane = l; sup.d = d; superG.userData.ks = 0; place(superG, d, (l - 1) * LW, SUPER_Y); return true; }
    }
    return false;
  }
  function superUpdate(dt, adv, ry) {
    nextSuper -= dt;
    if (nextSuper <= 0 && !sup.on) nextSuper = spawnSuper() ? superGap() : 1.5;
    if (!sup.on) return;
    if (nextHeart < 2) nextHeart = 2; // never a heart at the same time
    sup.d -= adv;
    if (sup.d < -3 || (sup.d > 8 && inZone(dist + sup.d))) { freeSuper(); return; }
    place(superG, sup.d, (sup.lane - 1) * LW, SUPER_Y + 0.15 * Math.sin(gt * 0.004));
    superSpin.rotation.y += dt * 2.2; superRing.rotation.x += dt * 3; superRing.rotation.y += dt * 1.7;
    if (superG.visible && Math.abs(sup.d) < 0.7 && Math.abs(px - sup.lane) < 0.5 && Math.abs(SUPER_Y - ry) < 1.1) {
      freeSuper(); superN = 1; sfx('life'); sparkle((sup.lane - 1) * LW, SUPER_Y, 0); popup('SUPER SHOT READY'); narrate('super_pickup');
    }
  }
  function superShoot() {
    superN = 0; if (slowT <= 0) msfx('slowmo', true); slowT = tn('slowmoSec', SLOW_T); sfx('shoot'); show('SUPER SHOT'); narrate('super_shot');
    var c = [], seen = [];
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i]; if (o.gone || o.d < 0.6 || o.d > SUPER_RANGE) continue;
      var inLane = o.lf != null ? Math.abs(o.lf - lane) < (o.type === 'fire' ? 1.0 : 0.75) : hitsLane(o, lane);
      if (!inLane || (o.lanes && seen.indexOf(o.lanes) >= 0)) continue;
      if (o.lanes) seen.push(o.lanes); c.push(o);
    }
    c.sort(function (a, b) { return a.d - b.d; }); if (c.length > 3) c.length = 3;
    shot = { x: (lane - 1) * LW, y: 1.25, z: -0.7, target: c[0] || null, sup: c, k: 0, n: 0, wait: 0 };
    projLight.intensity = 8;
  }
  function superStep(dt) {
    shot.z -= SHOT_SPEED * dt; shot.wait -= dt;
    while (shot.k < shot.sup.length && shot.sup[shot.k].gone) shot.k++;
    var t = shot.sup[shot.k];
    if (t && shot.wait <= 0 && shot.z <= -t.d + 0.4) {
      burst(t.type === 'fire' ? shot.x : obsX(t), t.type === 'pit' ? 0.4 : 1.0, -t.d);
      try { feelBoom(t.type === 'fire' ? shot.x : obsX(t), -t.d, t.mesh.children[0].material.color.getHex()); } catch (e) { feelHit(); }
      killObs(t); shot.k++; shot.n++; score += 20; sfx('explode'); fovKick = 6; shot.wait = 0.14;
    }
    var done = shot.k >= shot.sup.length;
    if ((done && shot.n > 0 && shot.wait <= 0) || shot.z < -SUPER_RANGE - 3) {
      if (shot.n) popup(shot.n === 3 ? 'TRIPLE! +60' : shot.n === 2 ? 'DOUBLE! +40' : 'SUPER BOOM +20');
      if (shot.n >= 2) narrate('super_multi');
      endShot(); return;
    }
    superProj.position.set(shot.x, shot.y, shot.z); projLight.position.copy(superProj.position);
  }
  function superDraw(dt) {
    var on = !!(shot && shot.sup); superProj.visible = on;
    if (on) { superProj.rotation.x += dt * 9; superProj.rotation.y += dt * 7; }
    projLight.color.setHex(on ? 0xc58bff : 0x7fe3ff);
    var vis = state === 'running' && superN > 0 ? 'block' : 'none'; if (superEl.style.display !== vis) superEl.style.display = vis;
  }
  function capeDraw(dt, jh, running) {
    var on = state !== 'start' && superN > 0;
    capeK = on ? Math.min(1, capeK + dt * 4) : 0; cape.visible = capeK > 0;
    if (!cape.visible) return;
    cape.scale.y = capeK; // unfurl on pickup
    var v = running ? Math.min(1, speed / 16) : 0.2;
    cape.rotation.x = -(0.25 + 0.55 * v + (jh > 0 ? 0.5 : 0)) - 0.08 * Math.sin(runPhase * 2);
    var p = capeGeo.attributes.position.array;
    for (var i = 0; i < p.length; i += 3) {
      var t = -capeBase[i + 1] / CAPE_H; // 0 at shoulders, 1 at hem
      p[i + 2] = capeBase[i + 2] + (0.06 + 0.1 * v) * t * t * Math.sin(gt * 0.012 - t * 5 + capeBase[i] * 2);
    }
    capeGeo.attributes.position.needsUpdate = true; capeGeo.computeVertexNormals();
  }
  // ---------- end super ammo ----------
  // ---------- shield (wave / Z): 3 s bubble, breaks obstacles, 1 charge, refills every 45 s ----------
  var SHIELD_T = 6, SHIELD_CD = 45, shieldT = 0, shieldN = 1, shieldCd = 0, lastShTxt = '';
  // bubble lives in the scene and is fitted each frame to the runner's bounding box (head included in every pose)
  var shieldG = new THREE.Group(); shieldG.visible = false; scene.add(shieldG);
  var shBox = new THREE.Box3(), shC = new THREE.Vector3(), shS = new THREE.Vector3();
  var shMatA = new THREE.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  var shMatB = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.5, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false });
  shieldG.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), shMatA));
  shieldG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.14, 1), shMatB));
  css.textContent += '#shield{position:absolute;top:calc(3vh + max(30px,6.5vh) + 2 * max(26px,5vh));right:16px;font-size:max(14px,2.8vh);padding:2px 10px;border-radius:6px;letter-spacing:.12em;color:#7fe3ff;border:1px solid #7fe3ff;display:none}#shield.on{background:#7fe3ff;color:#06222b}';
  var shieldEl = document.createElement('div'); shieldEl.id = 'shield'; shieldEl.className = 't'; hudEl.appendChild(shieldEl);
  function shieldReset() { shieldT = 0; shieldN = 1; shieldCd = 0; shieldG.visible = false; }
  function shieldUse() {
    if (shieldN <= 0 || shieldT > 0) { show('NO SHIELD'); return; }
    var st = tn('shieldSec', SHIELD_T); shieldN = 0; shieldCd = tn('shieldCooldown', SHIELD_CD); shieldT = st; invulnT = Math.max(invulnT, st);
    sfx('shield');
    show('SHIELD'); popup('SHIELD!'); narrate('shield');
  }
  function shieldTick(dt) {
    if (shieldT > 0) shieldT = Math.max(0, shieldT - dt);
    if (shieldN <= 0) { shieldCd -= dt; if (shieldCd <= 0) { shieldCd = 0; shieldN = 1; sfx('life'); popup('SHIELD READY'); } }
  }
  function shieldBreak(o) {
    var x = o.type === 'fire' ? (px - 1) * LW : obsX(o);
    burst(x, o.type === 'pit' ? 0.4 : 1.0, -o.d);
    try { feelBoom(x, -o.d, o.mesh.children[0].material.color.getHex()); } catch (e) { feelHit(); }
    killObs(o); score += 10; popup('SHIELD +10'); sfx('explode'); fovKick = Math.max(fovKick, 5);
  }
  function shieldDraw() {
    var on = state === 'running' && shieldT > 0; shieldG.visible = on;
    if (on) {
      var fade = Math.min(1, shieldT / 0.5), pul = Math.sin(performance.now() * 0.012);
      runner.updateMatrixWorld(true); shBox.setFromObject(pose); shBox.getCenter(shC); shBox.getSize(shS);
      var k = (1 + 0.06 * pul) / 1.1, rx = Math.max(0.8, shS.x * 0.5 + 0.3), ry = Math.max(0.9, shS.y * 0.5 + 0.3), rz = Math.max(0.8, shS.z * 0.5 + 0.3);
      shieldG.position.copy(shC); shieldG.scale.set(rx * k, ry * k, rz * k); shieldG.rotation.y += 0.03;
      shMatA.opacity = (0.2 + 0.08 * pul) * fade; shMatB.opacity = (0.45 + 0.15 * pul) * fade;
    }
    var t = shieldT > 0 ? 'SHIELD ' + shieldT.toFixed(1) + 's' : shieldN > 0 ? 'SHIELD READY (Z)' : 'SHIELD ' + Math.ceil(shieldCd) + 's';
    if (t !== lastShTxt) { lastShTxt = t; shieldEl.textContent = t; shieldEl.className = 't' + (shieldT > 0 || shieldN > 0 ? ' on' : ''); }
    var vis = state === 'running' ? 'block' : 'none'; if (shieldEl.style.display !== vis) shieldEl.style.display = vis;
  }
  // ---------- end shield ----------

  // ---------- narrators: Gary + Sunny (off-screen TV commentators, bubbles only) + hero announcer ----------
  // lines from ../voice/lines.json; mp3 optional (bubble-only when missing or muted)
  var NPRI = { super_shot: 4, game_over: 3, high_score: 3, super_multi: 3, super_pickup: 3, hit: 2, life_lost: 2, level_up: 2, shield: 2, start: 1, coin_streak: 1, near_miss: 1 };
  var nLines = null, nLast = {}, nCur = null, nT = 0, nLP = 0, nAud = null, nBad = {}, nTimer = 0, nDuck = false;
  try { fetch('../voice/lines.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.events) nLines = j; }).catch(function () {}); } catch (e) {}
  css.textContent += '.nb{position:absolute;bottom:calc(14vh + max(24px,5vh));font-size:max(14px,2.4vh);line-height:1.3;padding:8px 12px;border-radius:12px;max-width:34vw;opacity:0;transition:opacity .25s;background:rgba(0,0,0,.62);border:2px solid}' +
    '.nb b{display:block;font-size:.8em;letter-spacing:.12em}#nbg{left:16px;border-color:#c99a5b}#nbg b{color:#e8c48a}#nbs{right:16px;text-align:right;border-color:#22d3ee}#nbs b{color:#7fe3ff}.nb.on{opacity:1}' +
    '#ncred{position:absolute;left:0;right:0;bottom:1.2vh;text-align:center;font-size:max(11px,1.6vh);opacity:.6;font-weight:600}';
  function mkBub(id, name) { var b = document.createElement('div'); b.id = id; b.className = 'nb t'; b.innerHTML = '<b>' + name + '</b><span></span>'; hudEl.appendChild(b); return b; }
  var nBub = { gary: mkBub('nbg', 'GARY'), sunny: mkBub('nbs', 'SUNNY') };
  var credEl = document.createElement('div'); credEl.id = 'ncred'; credEl.textContent = 'Narration voices: ElevenLabs (elevenlabs.io)'; el.start.appendChild(credEl);
  var nHero = mkBub('nbh', 'SUPER SHOT'); nBub.hero = nHero;
  css.textContent += '#nbh{left:50%;right:auto;top:9vh;bottom:auto;transform:translateX(-50%);max-width:70vw;text-align:center;font-size:max(20px,3.6vh);font-weight:800;' +
    'background:linear-gradient(90deg,rgba(123,47,247,.92),rgba(255,176,0,.92));border-color:#ffd24a;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)}#nbh b{color:#fff3a0}';
  // ---------- crowd: low-poly spectators beside the track, part of the scrolling segments ----------
  var CB = new THREE.BoxGeometry(1, 1, 1), CS = new THREE.SphereGeometry(1, 8, 6);
  function cm(c, e) { return new THREE.MeshLambertMaterial({ color: c, emissive: e || 0, emissiveIntensity: e ? 0.7 : 0, flatShading: true }); }
  var CPAL = [0xff6b9d, 0xffd24a, 0x7fe3ff, 0x8be36b, 0xc49bff, 0xff9a4a, 0xf2f2f2, 0xc99a5b].map(function (c) { return cm(c); });
  var CDK = cm(0x1b1b24), CWH = cm(0xffffff), CGL = cm(0xffd24a, 0xffb000), COR = cm(0xff8a1a);
  function cpart(g, geo, m, sx, sy, sz, x, y, z, main) { var o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); if (main) o.userData.main = 1; g.add(o); return o; }
  function carm(g, m, x, y) { var a = new THREE.Group(); a.position.set(x, y, 0); cpart(a, CB, m, 0.1, 0.36, 0.1, 0, -0.16, 0, m !== CDK); g.add(a); return a; }
  function mkFan(kind) {
    var g = new THREE.Group(), b = new THREE.Group(), m = CPAL[0], arms = []; g.add(b);
    if (kind === 0) { // llama
      cpart(b, CB, m, 0.5, 0.45, 0.8, 0, 0.7, 0, 1); cpart(b, CB, CDK, 0.12, 0.5, 0.12, -0.15, 0.25, 0.28); cpart(b, CB, CDK, 0.12, 0.5, 0.12, 0.15, 0.25, -0.28);
      cpart(b, CB, m, 0.2, 0.6, 0.2, 0, 1.15, 0.3, 1); cpart(b, CB, m, 0.28, 0.24, 0.36, 0, 1.5, 0.38, 1); cpart(b, CB, CDK, 0.06, 0.18, 0.06, -0.08, 1.7, 0.3); cpart(b, CB, CDK, 0.06, 0.18, 0.06, 0.08, 1.7, 0.3);
    } else if (kind === 1) { // robot
      cpart(b, CS, m, 0.42, 0.42, 0.42, 0, 0.7, 0, 1); cpart(b, CS, CGL, 0.07, 0.07, 0.07, -0.13, 0.78, 0.38); cpart(b, CS, CGL, 0.07, 0.07, 0.07, 0.13, 0.78, 0.38);
      cpart(b, CB, CDK, 0.04, 0.3, 0.04, 0, 1.22, 0); cpart(b, CS, CGL, 0.08, 0.08, 0.08, 0, 1.4, 0); arms.push(carm(b, m, -0.48, 0.82), carm(b, m, 0.48, 0.82));
    } else if (kind === 2) { // penguin
      cpart(b, CS, CDK, 0.36, 0.5, 0.34, 0, 0.55, 0); cpart(b, CS, CWH, 0.28, 0.4, 0.2, 0, 0.5, 0.16); cpart(b, CS, CDK, 0.26, 0.26, 0.26, 0, 1.12, 0);
      cpart(b, CB, COR, 0.1, 0.06, 0.16, 0, 1.1, 0.28); cpart(b, CB, m, 0.5, 0.08, 0.22, 0, 0.92, 0, 1); arms.push(carm(b, CDK, -0.38, 0.75), carm(b, CDK, 0.38, 0.75));
    } else if (kind === 3) { // frog
      cpart(b, CS, m, 0.42, 0.3, 0.36, 0, 0.42, 0, 1); cpart(b, CS, m, 0.12, 0.12, 0.12, -0.16, 0.74, 0.12, 1); cpart(b, CS, m, 0.12, 0.12, 0.12, 0.16, 0.74, 0.12, 1);
      cpart(b, CS, CDK, 0.05, 0.05, 0.05, -0.16, 0.76, 0.23); cpart(b, CS, CDK, 0.05, 0.05, 0.05, 0.16, 0.76, 0.23); arms.push(carm(b, m, -0.4, 0.55), carm(b, m, 0.4, 0.55));
    } else { // cat (4) / bear (5)
      var eh = kind === 4 ? 0.16 : 0.1;
      cpart(b, CB, m, 0.46, 0.55, 0.32, 0, 0.5, 0, 1); cpart(b, CS, m, 0.27, 0.25, 0.25, 0, 1.0, 0, 1); cpart(b, CB, m, 0.1, eh, 0.08, -0.15, 1.24, 0, 1); cpart(b, CB, m, 0.1, eh, 0.08, 0.15, 1.24, 0, 1);
      cpart(b, CS, CDK, 0.04, 0.04, 0.04, -0.09, 1.04, 0.23); cpart(b, CS, CDK, 0.04, 0.04, 0.04, 0.09, 1.04, 0.23); arms.push(carm(b, m, -0.3, 0.72), carm(b, m, 0.3, 0.72));
    }
    return { g: g, b: b, arms: arms, ph: Math.random() * 6.28, on: false, act: 0, at: 0, al: 1, av: 0, nx: 1.5 + Math.random() * 2.5, sp: null, sT: 0 };
  }
  // idle actions + pooled shout sprites (one canvas texture per word, max 3 shouts on screen)
  var SHW = ['GO!', 'RUN!', 'WOO!', 'YEAH!', 'FASTER!', 'JUMP!', 'NICE!', 'OI!'], SHC = ['#ffe14a', '#ff5fa2', '#5ff0ff', '#9dff5f', '#ff9a3c', '#d79bff'], shTex = {}, shPool = [], shOn = 0;
  function shTexOf(w) {
    if (shTex[w]) return shTex[w];
    var c = document.createElement('canvas'); c.width = 256; c.height = 96; var x = c.getContext('2d');
    x.font = '900 64px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 12; x.strokeStyle = '#1b1b24'; x.strokeText(w, 128, 50); x.fillStyle = SHC[SHW.indexOf(w) % SHC.length]; x.fillText(w, 128, 50);
    var t = new THREE.CanvasTexture(c); shTex[w] = t; return t;
  }
  for (var shI = 0; shI < 3; shI++) { var shSp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); shSp.renderOrder = 10; shSp.visible = false; shPool.push(shSp); }
  function shGet(f) {
    if (shOn >= 3) return false;
    for (var i = 0; i < shPool.length; i++) { var sp = shPool[i]; if (sp.visible) continue;
      sp.material.map = shTexOf(SHW[Math.floor(Math.random() * SHW.length)]); sp.material.opacity = 1; sp.material.needsUpdate = true;
      sp.visible = true; f.g.add(sp); f.sp = sp; f.sT = 0; shOn++; return true; }
    return false;
  }
  function shFree(f) { var sp = f.sp; if (!sp) return; sp.visible = false; if (sp.parent) sp.parent.remove(sp); f.sp = null; shOn--; }
  function shDraw(f, dt) {
    var sp = f.sp; if (!sp) return; f.sT += dt; var p = f.sT;
    if (p >= 1) { shFree(f); return; }
    var k = 1 / f.g.scale.x, pop = p < 0.15 ? p / 0.15 * 1.25 : 1.25 - Math.min(1, (p - 0.15) / 0.15) * 0.25;
    sp.position.set(0, 2.05 + p * 0.9, 0.1); sp.scale.set(2.4 * k * pop, 0.9 * k * pop, 1);
    sp.material.opacity = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
  }
  // actions: 1 wave, 2 clap, 3 jump, 4 turn/spin to runner, 5 point, 6 side hop, 7 shout
  var ACTL = [0, 1.4, 1.2, 0.7, 1.4, 1.3, 1.2, 1.0];
  function fanAct(f, fd, md, t, dt) {
    var near = fd > -3 && fd < 20, b = f.b;
    b.position.x = 0; b.rotation.set(0, 0, 0);
    if (md) { f.act = 0; return; } // event reaction overrides idle actions
    if (!f.act) {
      f.nx -= dt * (near ? 2.2 : 1);
      if (f.nx > 0) return;
      f.nx = 1.5 + Math.random() * 2.5; f.act = 1 + Math.floor(Math.random() * 7); f.av = Math.random() < 0.5 ? 1 : 0;
      if (f.act === 7 && !(near || Math.random() < 0.3) || f.act === 7 && !shGet(f)) f.act = 1;
      f.al = ACTL[f.act]; f.at = 0;
    }
    f.at += dt; var p = f.at / f.al; if (p >= 1) { f.act = 0; return; }
    var e = Math.sin(Math.PI * p), ea = Math.min(1, e * 3), A = f.arms, n = A.length, i;
    var yaw = Math.atan2(-f.g.position.x, fd) - f.g.rotation.y; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    switch (f.act) {
      case 1: if (n) A[f.av].rotation.set(0, 0, (f.av ? 1 : -1) * (2.5 + Math.sin(t * 14) * 0.45) * ea); b.rotation.z = Math.sin(t * 7) * 0.06 * ea; break;
      case 2: for (i = 0; i < n; i++) A[i].rotation.set(-1.4 * ea, 0, (i ? -1 : 1) * (0.25 + Math.abs(Math.sin(t * 15)) * 0.45) * ea); b.position.y += Math.abs(Math.sin(t * 15)) * 0.04; break;
      case 3: b.position.y = Math.max(0, Math.sin(Math.PI * Math.min(1, p * 1.15))) * 0.9; for (i = 0; i < n; i++) A[i].rotation.set(0, 0, (i ? 1 : -1) * 2.6 * ea); break;
      case 4: b.rotation.y = f.av ? p * Math.PI * 2 : yaw * ea; break;
      case 5: b.rotation.y = yaw * 0.6 * ea; if (n) A[1].rotation.set(-1.6 * ea, 0, 0.25 * ea); break;
      case 6: b.position.x = Math.sin(p * Math.PI * 4) * 0.28; b.position.y = Math.abs(Math.sin(p * Math.PI * 4)) * 0.22; b.rotation.z = -Math.sin(p * Math.PI * 4) * 0.12; break;
      case 7: b.rotation.x = -0.3 * ea; b.rotation.y = yaw * 0.5 * ea; b.scale.set(1, 1 + 0.06 * ea, 1); for (i = 0; i < n; i++) A[i].rotation.set(0, 0, (i ? 1 : -1) * 1.9 * ea); break;
    }
  }
  function crowdDraw(md, t, dt) {
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      for (var k = 0; k < s.crowd.length; k++) {
        var f = s.crowd[k]; if (!f.g.visible) { if (f.sp) shFree(f); f.act = 0; continue; }
        var ph = f.ph, ay = 0;
        if (md === 'cheer') { f.b.position.y = Math.abs(Math.sin(t * 11 + ph)) * 0.45; f.b.scale.set(1, 1, 1); ay = 2.7 + Math.sin(t * 14 + ph) * 0.3; }
        else if (md === 'ooh') { f.b.position.y = 0.1; f.b.scale.set(1, 1.08, 1); ay = 1.6; }
        else if (md === 'aww') { f.b.position.y = 0; f.b.scale.set(1.08, 0.72, 1.08); ay = -1.9; }
        else { f.b.position.y = Math.max(0, Math.sin(t * 3 + ph)) * 0.06; f.b.scale.set(1, 1, 1); ay = Math.sin(t * 2 + ph) * 0.15; }
        for (var a = 0; a < f.arms.length; a++) { if (md === 'aww') f.arms[a].rotation.set(ay, 0, 0); else f.arms[a].rotation.set(0, 0, (a ? 1 : -1) * ay); }
        fanAct(f, s.d - f.g.position.z, md, t, dt); shDraw(f, dt);
      }
    }
  }
  function crowdDecorate(s) {
    var sd = Math.random() < 0.5 ? -1 : 1, n = Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * 3), z0 = (Math.random() - 0.5) * SEG * 0.6;
    var x0 = sd * (LW * 1.65 + 1.2 + Math.random() * 0.8);
    s.crowd.forEach(function (f, k) {
      f.on = k < n; f.g.visible = f.on; if (!f.on) return;
      var m = CPAL[Math.floor(Math.random() * CPAL.length)];
      f.g.traverse(function (o) { if (o.userData.main) o.material = m; });
      f.g.position.set(x0 + sd * (k % 2) * 1.1, 0, z0 + (k - 1) * 1.2 + (Math.random() - 0.5) * 0.3);
      f.g.scale.setScalar(1.5 + Math.random() * 0.6); f.g.rotation.y = -sd * (0.9 + Math.random() * 0.5);
    });
  }
  var fanK = 0;
  segs.forEach(function (s) { s.crowd = []; for (var k = 0; k < 3; k++) { var f = mkFan((fanK++ + Math.floor(Math.random() * 3)) % 6); s.add(f.g); s.crowd.push(f); } crowdDecorate(s); });
  var cMood = '', cMoodT = 0;
  // crowd sfx from lines.json "sfx" (paths relative to ../voice/); missing files stay silent
  var CRW = { super_multi: 'cheer', level_up: 'cheer', high_score: 'cheer', coin_streak: 'cheer', near_miss: 'ooh', super_pickup: 'wow', super_shot: 'wow', fork: 'wow', hit: 'aww', life_lost: 'aww', game_over: 'aww' };
  var cLastS = {}, cAmb = null;
  function cMuted() { var m = tune('crowdOn', true) === false; try { m = m || (window.sfx && window.sfx.isMuted && window.sfx.isMuted()); } catch (e) {} return m; }
  function crowdReact(ev) {
    var k = CRW[ev]; if (!k) return;
    cMood = k === 'aww' ? 'aww' : k === 'ooh' ? 'ooh' : 'cheer'; cMoodT = 1.1;
    var now = performance.now(), L = nLines && nLines.sfx && nLines.sfx[k];
    if (!L || !L.length || cMuted() || now - (cLastS[k] || 0) < 500) return; cLastS[k] = now;
    var f = L[Math.floor(Math.random() * L.length)].file; if (!f || nBad[f]) return;
    try { var a = new Audio('../voice/' + f); a.volume = 0.6; a.onerror = function () { nBad[f] = 1; }; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function crowdAmb() {
    var L = nLines && nLines.sfx && nLines.sfx.ambient, f = L && L[0] && L[0].file;
    var want = !!f && !nBad[f] && state === 'running' && !isPaused() && !cMuted();
    if (want && !cAmb) { try { cAmb = new Audio('../voice/' + f); cAmb.loop = true; cAmb.onerror = function () { nBad[f] = 1; cAmb = null; }; } catch (e) { nBad[f] = 1; return; } }
    if (!cAmb) return;
    cAmb.volume = nDuck ? 0.1 : 0.25;
    if (want && cAmb.paused) { var p = cAmb.play(); if (p && p.catch) p.catch(function () {}); }
    else if (!want && !cAmb.paused) cAmb.pause();
  }
  // super shot sparkle trail (gold/purple), own pool so coin sparkles are not stolen
  var trail = [], trI = 0, trT = 0;
  for (var ti = 0; ti < 10; ti++) { var tm = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: ti % 2 ? 0xb06bff : 0xffd24a, transparent: true, opacity: 0, depthWrite: false })); tm.visible = false; scene.add(tm); trail.push({ mesh: tm, t: 0 }); }
  function trailDraw(dt) {
    if (shot && shot.sup) { trT -= dt; if (trT <= 0) { trT = 0.05; var p = trail[trI]; trI = (trI + 1) % trail.length; p.t = 0.4; p.mesh.position.set(shot.x + (Math.random() - 0.5) * 0.4, shot.y + (Math.random() - 0.5) * 0.4, shot.z + 0.3); p.mesh.visible = true; } }
    for (var i = 0; i < trail.length; i++) { var q = trail[i]; if (q.t <= 0) continue; q.t -= dt; var k = Math.max(0, q.t / 0.4); q.mesh.material.opacity = k; q.mesh.scale.setScalar(0.3 + k * 0.7); q.mesh.rotation.y += dt * 8; if (q.t <= 0) q.mesh.visible = false; }
  }
  // ---------- narration: event lines (priority) + live commentary (cm_*), optional reply in the other bubble ----------
  var nEnd = 0, cmScore = 0, cmSpeed = 0, cmCoinT = -1e9, cmShootT = -1e9, cmN = 0;
  // live voice: text from real game state -> board 'tts' -> 'tts_audio' {id, ok, b64}; clip fallback on miss
  var lvP = null, lvT = 0, lvFail = 0, lvOffT = 0, lvSock = null, lvN = 0;
  var LT = {
    stats: {
      sunny: ['{name} at {score} points, level {level}, this is incredible!', '{speed} km/h! {name} is flying down this track!', '{coins} coins already for {name}, what a collector!', '{name} has run {dist} metres, and the crowd is on its feet!', 'Level {level}, {lives} lives left, {name} is in total control!', 'Look at that pace, {speed} km/h, unstoppable!', '{score} points and climbing, can {name} beat {best}?', 'Combo times {combo}! {name} is dancing past danger!'],
      gary: ['{speed} km/h and still {lives} lives. Suspicious.', '{score} points. My nan scored more, but fine.', '{name} at level {level}. Wake me when it gets hard.', '{coins} coins. Saving up for running lessons, {name}?', '{dist} metres. The car park was longer.', 'Best is {best}. {name} is at {score}. Do the maths.', '{lives} lives left. Give it a minute.', 'Combo times {combo}. Lucky, if you ask me.']
    },
    milestone: {
      sunny: ['{score} points! {name} smashes another milestone!', 'There it is, {score}! What a run from {name}!'],
      gary: ['{score} points. Someone give {name} a sticker.', '{score}. Fine. That is a number.']
    },
    level_up: {
      sunny: ['Level {level}! {name} goes up a gear!', 'Welcome to level {level}, {name}, this is huge!'],
      gary: ['Level {level}. Now it gets real, {name}.', 'Level {level} at {speed} km/h. What could go wrong.']
    },
    game_over: {
      sunny: ['{name} goes down at {score}! What a fight!', 'And it is over! {score} points for {name}, the crowd loved it!'],
      gary: ['{name} goes down at {score}. Shocking. Not really.', 'Game over at {score}. Back to the bench, {name}.']
    },
    high_score: {
      sunny: ['NEW RECORD! {name} with {score}!', 'History made! {name} posts {score}, a brand new best!'],
      gary: ['NEW RECORD! {name} with {score}. I take it all back.', '{score}, a new best. Even I am impressed, {name}.']
    }
  };
  function lvName() { var n = ''; try { n = (localStorage.getItem('lb_name') || '').trim().slice(0, 12); if (!n) { var ie = document.getElementById('lb-name'); n = ie ? ie.value.trim().slice(0, 12) : ''; } } catch (e) {} return n || 'our runner'; }
  function lvText(kind, who) {
    var g = LT[kind], L = g && g[who === 'sunny' ? 'sunny' : 'gary']; if (!L) return '';
    var v = { name: lvName(), score: Math.floor(score), level: level, speed: Math.round(speed * 3.6), coins: coinCount, lives: lives, combo: Math.max(1, combo), dist: Math.floor(dist), best: Math.floor(Math.max(hi, score)) };
    if (combo < 2) L = L.filter(function (x) { return x.indexOf('{combo}') < 0; });
    if (hi <= score) L = L.filter(function (x) { return x.indexOf('{best}') < 0; }); // no 'beat the best' once the run is the best
    var t = L[Math.floor(Math.random() * L.length)].replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); });
    return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 220);
  }
  function lvReady() {
    var s = window.boardSocket;
    return !!(s && s.connected && typeof s.emit === 'function') && tune('liveVoice', true) !== false && performance.now() >= lvOffT;
  }
  function lvWrap(kind, ln) {
    if (!ln || !lvReady()) return ln;
    if (kind !== 'game_over' && kind !== 'high_score' && lvN >= tn('liveMax', 12)) return ln; // credit cap per run
    var t = lvText(kind, ln.who); if (!t) return ln; lvN++;
    return { who: ln.who, text: ln.text, file: ln.file, reply: ln.reply, live: t };
  }
  function lvHook(s) {
    if (lvSock === s) return; lvSock = s;
    s.on('tts_audio', function (d) {
      if (!d || !lvP || d.id !== lvP.id) return;
      if (!d.ok || !d.b64) { lvMiss(d.id); return; }
      var p = lvP; lvP = null; clearTimeout(lvT); lvFail = 0;
      if (nCur === p.cur) nAudio('data:audio/mpeg;base64,' + d.b64, '', p.nx, p.rep, p.vr);
    });
  }
  function lvMiss(id) {
    if (!lvP || lvP.id !== id) return;
    var p = lvP; lvP = null; clearTimeout(lvT);
    if (++lvFail >= 3) { lvFail = 0; lvOffT = performance.now() + 60000; }
    if (nCur !== p.cur) return;
    nBub[p.cur.who].lastChild.textContent = p.ln.text || '';
    nPlay(p.ln, p.nx, p.rep, p.vr);
  }
  function lvAsk(ln, nx, rep, vr) {
    var s = window.boardSocket, id = 'v' + Math.random().toString(36).slice(2, 10);
    clearTimeout(nTimer); nTimer = setTimeout(nx, 2500 + 2600 / vr);
    lvP = { id: id, ln: ln, nx: nx, rep: rep, vr: vr, cur: nCur };
    lvT = setTimeout(function () { lvMiss(id); }, 2500);
    try { lvHook(s); s.emit('tts', { id: id, text: ln.live, who: nCur.who }); } catch (e) { lvMiss(id); }
  }
  function nAudio(src, bad, nx, rep, vr) {
    try {
      var a = new Audio(src); a.volume = 1; a.playbackRate = vr; a.preservesPitch = true; nAud = a;
      a.onerror = function () { if (bad) nBad[bad] = 1; };
      a.onplaying = function () { if (nAud !== a) return; clearTimeout(nTimer); nTimer = setTimeout(nx, 9000); nDuck = true; msfx('duck', true); };
      a.onended = function () { if (nAud === a) { clearTimeout(nTimer); nTimer = setTimeout(nx, rep ? 100 : Math.max(400, 2500 / vr - (performance.now() - nT))); } };
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function nPlay(ln, nx, rep, vr) { if (ln.file && !nBad[ln.file]) nAudio('../voice/' + ln.file, ln.file, nx, rep, vr); }
  function nHide() {
    if (lvP) { clearTimeout(lvT); lvP = null; }
    if (nTimer) { clearTimeout(nTimer); nTimer = 0; }
    if (nAud) { try { nAud.onended = null; nAud.pause(); } catch (e) {} nAud = null; }
    if (nCur) { nBub[nCur.who].className = 'nb t'; nEnd = performance.now(); }
    nCur = null;
    if (nDuck) { nDuck = false; if (!paused) msfx('duck', false); }
  }
  function nShow(ln, pri) {
    nHide();
    var who = ln.who === 'sunny' || ln.who === 'hero' ? ln.who : 'gary', now = performance.now(), rep = ln.reply && ln.reply.text ? ln.reply : null;
    nCur = { who: who, pri: pri }; nT = now; nLP = pri;
    var lv = !!ln.live && lvReady();
    var b = nBub[who]; b.lastChild.textContent = (lv ? ln.live : ln.text) || ''; b.className = 'nb t on';
    var nx = function () { nTimer = 0; if (rep && nCur) nShow(rep, pri); else nHide(); };
    var vr = Math.max(0.5, tn('voiceRate', 1.2)); nTimer = setTimeout(nx, (rep ? 1800 : 2600) / vr);
    var muted = tune('voiceOn', true) === false; try { muted = muted || (window.sfx && window.sfx.isMuted && window.sfx.isMuted()); } catch (e) {}
    if (muted) { if (lv) b.lastChild.textContent = ln.text || ''; return; }
    if (lv) lvAsk(ln, nx, rep, vr); else nPlay(ln, nx, rep, vr);
  }
  function nPick(ev) {
    var list = nLines && nLines.events && nLines.events[ev]; if (!list || !list.length) return null;
    var i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === nLast[ev]) i = (i + 1) % list.length;
    nLast[ev] = i; return list[i];
  }
  function narrate(ev) {
    crowdReact(ev);
    if (ev === 'start') { cmScore = 0; cmSpeed = speed; cmCoinT = cmShootT = -1e9; cmN = 0; nEnd = performance.now(); }
    var pri = NPRI[ev] || 1, now = performance.now();
    var ln = nPick(ev); if (!ln) return;
    if (nCur && pri <= nCur.pri) return;
    if (!nCur && now - nT < tn('narrCooldown', 2) * 1000 && pri <= nLP && pri < 3) return;
    if (pri === 1 && ev !== 'start' && Math.random() < 0.5) return;
    if (LT[ev]) ln = lvWrap(ev, ln);
    nShow(ln, pri);
  }
  function cmHas(ev) { var l = nLines && nLines.events && nLines.events[ev]; return !!(l && l.length); }
  function cmChoose() {
    var c = [], sc = Math.floor(score / 500);
    if (sc > cmScore) { cmScore = sc; c.push('cm_score'); }
    if (gt - cmShootT < 1000) c.push('cm_shoot');
    if (gt - cmCoinT < 1000) c.push('cm_coin');
    if (gt - lastAct.t < 1000) c.push(lastAct.kind === 'duck' ? 'cm_duck' : 'cm_jump');
    if (gt - lastLaneChg.t < 1000) c.push('cm_lane');
    if (forkIn > 0 && forkIn < 40) c.push('cm_fork');
    for (var i = 0; i < obs.length; i++) if (!obs[i].gone && obs[i].d > 2 && obs[i].d < 25) { c.push('cm_obstacle'); break; }
    if (speed - cmSpeed >= 1) { cmSpeed = speed; c.push('cm_speed'); }
    if (Math.random() < 0.25) c.unshift('cm_banter');
    c.push('cm_filler');
    for (var j = 0; j < c.length; j++) if (cmHas(c[j])) return c[j];
    return null;
  }
  function commTick() {
    if (state !== 'running' || isPaused() || nCur || !nLines || tune('liveComm', true) === false) return;
    if (performance.now() - nEnd < tn('narrCooldown', 2) * 1000) return;
    var ev = cmChoose(); if (!ev) { nEnd = performance.now(); return; }
    var ln = nPick(ev); if (!ln) return;
    if (ev === 'cm_score') ln = lvWrap('milestone', ln); else if (++cmN % 2 === 0) ln = lvWrap('stats', ln);
    nShow(ln, 0);
  }
  function narrDraw(dt) {
    commTick(); crowdAmb(); trailDraw(dt);
    var t = performance.now() * 0.001; if (cMoodT > 0) cMoodT -= dt;
    var md = cMoodT > 0 ? cMood : '';
    crowdDraw(md, t, dt);
  }
  // ---------- end narrators ----------
  function killObs(o) {
    var group = o.type === 'pit' && o.lanes ? obs.filter(function (q) { return q.lanes === o.lanes; }) : [o];
    group.forEach(function (q) { q.gone = true; W.remove(q.mesh); });
  }
  function endShot() { shot = null; projMesh.visible = false; projLight.intensity = 0; }
  function shoot() {
    if (shot) return;
    if (superN > 0) { superShoot(); return; } // super ammo
    if (ammo <= 0) { show('NO AMMO'); return; }
    ammo--; cmShootT = gt; if (slowT <= 0) msfx('slowmo', true); slowT = tn('slowmoSec', SLOW_T); sfx('shoot'); show('SHOOT');
    var t = null;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i]; if (o.gone || o.d < 0.6 || o.d > SHOT_RANGE) continue;
      var inLane = o.lf != null ? Math.abs(o.lf - lane) < (o.type === 'fire' ? 1.0 : 0.75) : hitsLane(o, lane);
      if (inLane && (!t || o.d < t.d)) t = o;
    }
    shot = { x: (lane - 1) * LW, y: 1.25, z: -0.7, target: t };
    projMesh.position.set(shot.x, shot.y, shot.z); projMesh.visible = true; projLight.intensity = 6;
  }
  function updateShot(dt) {
    if (!shot) return;
    if (shot.sup) { superStep(dt); return; } // super ammo
    shot.z -= SHOT_SPEED * dt;
    var t = shot.target;
    if (t && t.gone) t = shot.target = null;
    if (t && shot.z <= -t.d + 0.4) {
      burst(t.type === 'fire' ? shot.x : obsX(t), t.type === 'pit' ? 0.4 : 1.0, -t.d);
      feelBoom(t.type === 'fire' ? shot.x : obsX(t), -t.d, t.mesh.children[0].material.color.getHex());
      killObs(t); score += 20; popup('BOOM +20'); sfx('explode'); fovKick = 6; endShot(); return;
    }
    if (shot.z < -SHOT_RANGE - 3) { endShot(); return; }
    projMesh.position.set(shot.x, shot.y, shot.z); projLight.position.copy(projMesh.position);
  }
  // ---- round 5: moving traps. Hold 0.8 s (arrow pulses = telegraph), slide one lane over 1 s, hold, slide back.
  function reactSec() { return Math.max(0.3, tn('reactSec', 1.1)); }
  function mvUpd(mv) {
    if (mv.t === gt) return; mv.t = gt;
    // one lane step per hold + slide; hold grows so steps are never closer than reactSec
    var H = Math.max(0.8, reactSec() - 1), t = (gt / 1000 + mv.ph) % (2 * H + 2), k, nd;
    function sm(x) { return x * x * (3 - 2 * x); }
    if (t < H) { k = 0; nd = 1; } else if (t < H + 1) { k = sm(t - H); nd = 1; } else if (t < 2 * H + 1) { k = 1; nd = -1; } else { k = 1 - sm(t - 2 * H - 1); nd = -1; }
    mv.k = k; mv.nd = nd * mv.s; mv.warn = (t > H - 0.55 && t < H) || (t > 2 * H + 0.45 && t < 2 * H + 1);
  }
  function addTele(o, y) {
    var a = new THREE.Group(), c = new THREE.Mesh(G.arrowC, TM.tele), gl = new THREE.Mesh(G.arrowC, TM.teleGlow);
    c.scale.set(1.3, 1.6, 1.3); gl.scale.set(2.2, 2.6, 2.2); a.add(gl); a.add(c); a.position.y = y; o.mesh.add(a); o.tele = a;
  }
  function makeMover(o, lane0, s, ph, y) { o.lane0 = lane0; o.lf = lane0; o.mv = ph; o.mv.s = s; addTele(o, y); }
  function spawnTrap(d) {
    var kinds = ['pit']; if (level >= 3) kinds.push('fire'); if (level >= 4) kinds.push('mblock');
    var k = kinds[Math.floor(Math.random() * kinds.length)];
    var moving = level >= 3 && Math.random() < Math.min(0.6, 0.3 + (level - 3) * 0.1), mv = { ph: Math.random() * 3.6, k: 0, nd: 1, t: -1 };
    if (k === 'pit') {
      var two = Math.random() < 0.45, l0 = Math.floor(Math.random() * (two ? 2 : 3)), lanes = two ? [l0, l0 + 1] : [l0];
      var st = lanes[lanes.length - 1] >= 2 ? -1 : lanes[0] <= 0 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      lanes.forEach(function (l) { var o = addObs(l, d, 'pit', { lanes: lanes }); if (moving) makeMover(o, l, st, mv, 0.7); });
    } else if (k === 'fire') {
      var of = addObs(1, d, 'fire');
      if (moving) { var c0 = Math.random() < 0.5 ? 0.5 : 1.5; of.mesh.scale.x = 0.66; makeMover(of, c0, c0 < 1 ? 1 : -1, mv, 1.3); }
    } else {
      var lb = Math.floor(Math.random() * 3), sb = lb === 0 ? 1 : lb === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1);
      makeMover(addObs(lb, d, 'mblock', { lf: lb }), lb, sb, mv, 2.9);
    }
  }
  function obsX(o) { return o.type === 'fire' && !o.mv ? 0 : ((o.lf != null ? o.lf : o.lane) - 1) * LW; }
  function placeObs(o) { place(o.mesh, o.d, obsX(o), 0); }
  function inZone(a) { return (a > forkAbs - speed * 4 - 3 && a < forkAbs + speed * 1.5) || (a > prevForkAbs - speed * 4 - 3 && a < prevForkAbs + speed * 1.5); }
  function sweepZone() { for (var i = obs.length - 1; i >= 0; i--) if (obs[i].d > 8 && inZone(dist + obs[i].d)) { W.remove(obs[i].mesh); obs.splice(i, 1); } }
  function spawn() {
    var r = Math.random(), row = [];
    var type = r < 0.34 ? 'low' : r < 0.6 ? 'high' : 'block';
    if (type === 'block') {
      // double block keeps the middle lane free: one swipe reaches it from any lane
      var n = Math.random() < 0.4 ? 2 : 1, free = 1;
      for (var l = 0; l < 3; l++) if (n === 2 ? l !== free : l === free) row.push(l);
      if (n === 1) row = [Math.floor(Math.random() * 3)];
    } else row = [0, 1, 2];
    function bad(d) { return inZone(dist + d); }
    // spawn far enough to be seen speed * 1.8 s ahead, and at least speed * reactSec behind the farthest pending row
    var D = Math.max(70, speed * 1.8 + 4), far = -1e9, rg = speed * reactSec();
    for (var i = 0; i < obs.length; i++) far = Math.max(far, obs[i].d);
    D = Math.max(D, far + rg);
    if (bad(D)) return 0;
    if (trapsOn() && level >= 2 && Math.random() < Math.min(0.45, 0.18 + (level - 2) * 0.05)) { spawnTrap(D); return D - 70; }
    row.forEach(function (l) { addObs(l, D, type); });
    if (type === 'low' && Math.random() < 0.2) coinArc(Math.floor(Math.random() * 3), D);
    if (level >= 3 && Math.random() < Math.min(0.55, (level - 2) * 0.1)) {
      var t2 = Math.random() < 0.5 ? 'low' : 'high', d2 = D + Math.max(speed * 1.05, rg);
      if (bad(d2)) return D - 70;
      [0, 1, 2].forEach(function (l) { addObs(l, d2, t2); });
      return d2 - 70;
    }
    return D - 70;
  }

  // ---------- update ----------
  function scroll(adv) {
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i]; s.d -= adv;
      if (s.d < -(10 + SEG / 2)) { s.d += NSEG * SEG; decorate(s); if (s.crowd) crowdDecorate(s); }
      placeSeg(s);
    }
  }
  function update(dt) {
    if (state === 'start') { scroll(5 * dt); runPhase += dt * 5; return; }
    if (state !== 'running' || isPaused()) { worldRate = 0; return; }
    var rdt = dt;
    if (invulnT > 0) invulnT = Math.max(0, invulnT - rdt);
    shieldTick(rdt);
    if (slowT > 0) { slowT -= rdt; if (slowT <= 0) { slowT = 0; msfx('slowmo', false); } }
    slowK += ((slowT > 0 ? 1 : 0) - slowK) * Math.min(1, rdt * 10);
    if (ammo < maxAmmo()) { ammoT += rdt; if (ammoT >= tn('ammoRecharge', AMMO_RECHARGE)) { ammoT = 0; ammo++; sfx('life'); } } else ammoT = 0;
    updateShot(rdt);
    var ts = 1 - 0.75 * slowK; dt *= ts; worldRate = speed * ts;
    if (crashT > 0) {
      // stumble into the wall: decelerate until the wall reaches the runner, then game over
      crashT = Math.max(0, crashT - dt); var cp = 1 - crashT / CRASH_T, nf = crashF0 - (crashF0 + 3.0) * (1 - (1 - cp) * (1 - cp));
      var dd = forkIn - nf; forkIn = nf; scroll(dd); runPhase += dt * 8;
      if (crashT <= 0) die(crashCause);
      return;
    }
    gt += dt * 1000;
    if (slideEnd > 0 && gt >= slideEnd) { slideEnd = 0; ducking = false; sfx('stand'); }
    intT += dt; if (intT >= 1) { intT = 0; msfx('setIntensity', Math.max(0, Math.min(1, (speed - 6) / 36))); }
    // round 5: gentle time-based speed curve, soft cap ~22.5
    runT += dt; var s0 = tn('speedStart', 6), s1 = Math.max(s0, tn('speedMax', 16)); speed = Math.min(s1, s0 + (s1 - s0) * (1 - Math.exp(-runT / 125)));
    // obstacles must read clearly at least speed * 1.8 s ahead: never let fog swallow that distance
    if (scene.fog.far < speed * 1.8 + 30) { scene.fog.far = speed * 1.8 + 30; scene.fog.near = Math.min(scene.fog.near, speed * 1.8); }
    var adv = speed * dt; dist += adv; score += adv;
    var lv = levelOf(runT);
    if (lv > level) {
      level = lv; sfx('speedup'); narrate('level_up');
      popup('LEVEL UP ' + lv + ({ 2: ' - PITS!', 3: ' - FIRE + MOVING TRAPS!', 4: ' - MOVING BLOCKS!' }[lv] || ''));
    }
    forkIn -= adv;
    if (pj) { pj.d -= adv; if (pj.d < -45) { pj = null; oldFork.visible = false; } }
    // one-shot per fork: never re-resolve the same junction (P0: repeated TURN popups / +50)
    if (!turn && !forkDone && forkIn <= speed * TURN_T / 2) { forkDone = true; forkResolve(); if (crashT > 0) return; }
    if (turn && forkIn <= -turn.j0) finishTurn();
    BS = brSide();
    feelLane(dt);
    feelJump(dt);
    runPhase += dt * (4 + speed * 0.45);
    scroll(adv);
    sweepZone();
    nextSpawn -= adv;
    if (nextSpawn <= 0) {
      var extra = spawn() || 0;
      var gapK = Math.max(0.7, 1 - (level - 1) * 0.05);
      nextSpawn = extra + Math.max(speed * reactSec(), (Math.max(speed * 0.9, 22 - dist / 60) + Math.random() * (4 + speed * 0.2)) * gapK);
    }
    nextCoin -= adv;
    if (nextCoin <= 0) { spawnCoins(); nextCoin = 50 + Math.random() * 45; }
    var jh = fJy / JH;
    var fireOn = (gt % 1400) < 700;
    for (var i = obs.length - 1; i >= 0; i--) {
      var o = obs[i]; if (o.gone) { obs.splice(i, 1); continue; }
      var pd = o.d; o.d -= adv;
      if (o.mv) {
        mvUpd(o.mv); o.lf = o.lane0 + o.mv.s * o.mv.k; o.lane = Math.round(o.lf);
        o.tele.rotation.z = -o.mv.nd * HP; o.tele.position.x = o.mv.nd * 0.55;
        o.tele.scale.setScalar(o.mv.warn ? 1 + 0.35 * Math.sin(gt * 0.025) : 0.75);
      }
      if (o.type === 'fire') { o.mesh.spikes.scale.y = fireOn ? 1 : 0.15; o.mesh.flame.visible = fireOn; }
      placeObs(o);
      if (!o.done && pd > 0 && o.d <= 0) { o.done = true; checkNear(o); }
      if (o.d < -12) { W.remove(o.mesh); obs.splice(i, 1); continue; }
      if (invulnT > 0 && shieldT <= 0) continue;
      var why = '';
      if (o.type === 'pit') { if (Math.abs(o.d) < 1.1 && Math.abs(px - (o.lf != null ? o.lf : o.lane)) < 0.45 && jh < 0.25) why = 'Fell in a PIT! - jump or change lane'; }
      else if (o.type === 'fire') { if (Math.abs(o.d) < 0.6 && fireOn && jh < 0.35 && (!o.mv || Math.abs(px - o.lf) < 1.0)) why = 'Burned on the FIRE STRIP - jump or wait!'; }
      else if (o.type === 'mblock') { if (Math.abs(o.d) < 0.6 && Math.abs(px - o.lf) < 0.75) why = 'Hit MOVING BLOCK - watch it slide!'; }
      else if (Math.abs(o.d) < 0.55 && Math.abs(px - o.lane) < 0.6) {
        if (o.type === 'block') why = 'Hit BLOCK - change lane!';
        else if (o.type === 'low' && jh < 0.5) why = 'Hit LOW BARRIER - jump!';
        else if (o.type === 'high' && !ducking) why = 'Hit HIGH BAR - duck!';
      }
      if (why && shieldT > 0) { shieldBreak(o); obs.splice(i, 1); continue; }
      if (why && godOn()) continue;
      if (why) {
        if (lives <= 1) { die(why); return; }
        loseLife(why); killObs(o); obs.splice(i, 1); continue;
      }
    }
    var ry = jh * JH + 0.9;
    for (var ci2 = 0; ci2 < coins.length; ci2++) {
      var c = coins[ci2]; if (!c.on) continue;
      c.d -= adv; place(c.mesh, c.d, (c.lane - 1) * LW, c.y);
      if (c.d < -3) { freeCoin(c); continue; }
      if (c.mesh.visible && Math.abs(c.d) < 0.6 && Math.abs(px - c.lane) < 0.5 && Math.abs(c.y - ry) < 0.95) collectCoin(c);
    }
    nextHeart -= dt;
    if (nextHeart <= 0 && !hrt.on) nextHeart = spawnHeart() ? heartGap() : 1.5;
    if (hrt.on) {
      hrt.d -= adv;
      if (hrt.d < -3 || (hrt.d > 8 && inZone(dist + hrt.d))) freeHeart();
      else {
        place(heart, hrt.d, (hrt.lane - 1) * LW, HEART_Y + 0.15 * Math.sin(gt * 0.004));
        heartSpin.rotation.y += dt * 2.6; var hp = (gt % 1200) < 200 ? Math.sin(Math.PI * (gt % 1200) / 200) : 0; heartSpin.scale.setScalar(1 + 0.25 * hp);
        if (heart.visible && Math.abs(hrt.d) < 0.7 && Math.abs(px - hrt.lane) < 0.5 && Math.abs(HEART_Y - ry) < 1.1) collectHeart();
      }
    }
    superUpdate(dt, adv, ry); // super ammo
    report(false);
  }

  // ---------- render ----------
  var camPos = new THREE.Vector3(0, 4, 6.5), camLook = new THREE.Vector3(0, 1, -8), tmp = new THREE.Vector3();
  var camBase = camPos.clone();
  var lastScore = -1, lastSpeed = -1;
  var lastLines = -1, lastCoinTxt = '';
  function draw(now, dt) {
    var x = (px - 1) * LW;
    var cpd = crashT > 0 ? 1 - crashT / CRASH_T : (crashed && state === 'dead' ? 1 : 0);
    x += crashSide * 1.1 * cpd;
    var jh = fJy / JH;
    var running = state !== 'dead';
    runner.position.set(x, jh * JH, 0);
    var sw = running && jh === 0 ? Math.sin(runPhase) : 0;
    legL.rotation.x = sw * 0.9; legR.rotation.x = -sw * 0.9;
    armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
    if (jh > 0) { legL.rotation.x = -0.6; legR.rotation.x = 0.4; armL.rotation.x = armR.rotation.x = -2.4; }
    pose.position.y = running ? Math.abs(Math.cos(runPhase)) * 0.08 : 0;
    var sliding = ducking && slideEnd > 0 && state === 'running';
    slideBlend += ((sliding ? 1 : 0) - slideBlend) * Math.min(1, dt * 14);
    var sy = ducking && !sliding ? 0.5 : 1; pose.scale.y += (sy - pose.scale.y) * Math.min(1, dt * 18);
    pose.scale.x = pose.scale.z = 1 + (1 - pose.scale.y) * 0.35;
    runner.rotation.z = Math.max(-0.45, Math.min(0.45, -fPxV * 0.055));
    if (yawT > 0) runner.rotation.z += -leanDir * 0.5 * Math.sin(Math.PI * (1 - yawT / TURN_T));
    if (crashT > 0) {
      // stumble: pitch forward, then bounce back off the wall
      runner.rotation.x = cpd < 0.75 ? cpd / 0.75 * 0.55 : 0.55 - (cpd - 0.75) / 0.25 * 0.9;
      runner.rotation.z += crashSide * 0.4 * cpd;
      armL.rotation.x = armR.rotation.x = -1.8 * cpd;
    } else if (state === 'running') runner.rotation.x = 0;
    if (slideBlend > 0.01 && state !== 'dead') {
      pose.rotation.x = 1.15 * slideBlend; pose.position.y += 0.3 * slideBlend; runner.position.z = -0.5 * slideBlend;
      legL.rotation.x += (-1.3 - legL.rotation.x) * slideBlend; legR.rotation.x += (-1.1 - legR.rotation.x) * slideBlend;
      armL.rotation.x += (1.2 - armL.rotation.x) * slideBlend; armR.rotation.x += (1.2 - armR.rotation.x) * slideBlend;
    } else { pose.rotation.x = 0; runner.position.z = 0; }
    var aiming = state === 'running' && (slowT > 0 || !!shot);
    gun.visible = aiming; if (aiming) { armR.rotation.x = 1.5; armR.rotation.z = 0.15; } else armR.rotation.z = 0;
    feelPose(dt, jh, sliding, aiming);
    capeDraw(dt, jh, running);
    runner.visible = !(state === 'running' && invulnT > 0 && shieldT <= 0 && Math.floor(invulnT * 10) % 2 === 0);
    if (state === 'dead') { var k = Math.min(1, (now - deadT) / 300); runner.rotation.x = crashed ? -0.35 - k * 1.0 : k * 1.3; }
    shadowBlob.position.x = x; var bs = 1 - jh * 0.45; shadowBlob.scale.set(bs, bs, bs);

    camPos.set(x * 0.55, 4.0 + jh * 0.4, 6.5); camLook.set(x * 0.35, 1.0, -8);
    forkG.position.set(0, 0, -forkIn); forkG.rotation.y = 0; forkG.visible = state !== 'start' && forkIn < 110;
    if (pj) { oldFork.position.set(0, 0, -pj.d); oldFork.rotation.y = pj.sd * HP; oldFork.visible = state !== 'start'; }
    worldXform();
    if (thK < 1) { thK = Math.min(1, thK + dt / 1.0); var tk = thK * thK * (3 - 2 * thK); themeMix(thA, thB, tk); }
    // ---------- fork anticipation ----------
    // choice made => camera yaws/shifts, runner leans/drifts, road bends toward the branch at once, scaled by
    // eased closeness to the junction; signed lsd carries into the turn (turn.li) and decays as the world rotates
    var lsd = 0;
    if (turn) { var tu = Math.max(0, Math.min(1, (turn.j0 - forkIn) / (2 * turn.j0))); lsd = turn.li * (1 - tu * tu * (3 - 2 * tu)); }
    else if (state === 'running') {
      var aTgt = choice ? (choice === 'left' ? -1 : 1) : (BS && forkIn < speed * 1.6 && forkIn > 0 ? BS : 0);
      antS += (aTgt - antS) * Math.min(1, dt * 5);
      var aw0 = speed * forkWin(), aw1 = speed * TURN_T / 2, ak = Math.max(0, Math.min(1, (aw0 - forkIn) / Math.max(0.1, aw0 - aw1)));
      lsd = antS * (0.3 + 0.7 * ak * ak * (3 - 2 * ak));
    } else antS = 0;
    lastHint = lsd; antX = lsd * ANT_BEND; forkG.position.x = antX;
    if (lsd) { camLook.x += lsd * 3.0; camPos.x += lsd * 0.6; runner.rotation.z += -lsd * 0.24; runner.position.x += lsd * 0.45; shadowBlob.position.x += lsd * 0.45; }
    antDim(forkParts.left, 'left', dt); antDim(forkParts.right, 'right', dt);
    // ---------- end fork anticipation ----------
    if (yawT > 0 && !isPaused()) {
      yawT = Math.max(0, yawT - dt);
      var yp = 1 - yawT / TURN_T, ye = yp < 0.5 ? 2 * yp * yp : 1 - Math.pow(-2 * yp + 2, 2) / 2; // easeInOutQuad
      yawOff = yawFrom * (1 - ye);
    } else if (yawT <= 0) yawOff = 0;
    var lo = yawT > 0 ? Math.sin(Math.PI * (1 - yawT / TURN_T)) * 0.9 : 0; lo = Math.round(lo * 20) / 20;
    if (lo !== lastLines) { lastLines = lo; linesEl.style.opacity = String(lo); }
    coinSpin += dt * 4;
    for (var ci3 = 0; ci3 < coins.length; ci3++) if (coins[ci3].on) coins[ci3].mesh.rotation.y = coinSpin;
    for (var si2 = 0; si2 < sparks.length; si2++) {
      var s = sparks[si2]; if (s.t <= 0) continue;
      s.t = Math.max(0, s.t - dt); var sk = 1 - s.t / 0.35;
      s.mesh.scale.setScalar(0.4 + sk * 1.4); s.mesh.rotation.y += dt * 10; s.mesh.material.opacity = 1 - sk; s.mesh.position.y += dt * 1.5;
      if (s.t <= 0) s.mesh.visible = false;
    }
    feelDraw(dt);
    var bf = (camera.aspect < 1 ? 78 : 62) - 7 * slowK;
    if (Math.abs(camera.fov - (bf + fFov)) > 0.01) { camera.fov = bf + fFov; camera.updateProjectionMatrix(); }
    updateParts(dt);
    hurtFx = Math.max(0, hurtFx - dt * 2.2);
    var ho = Math.round(hurtFx * 20) / 20; if (ho !== lastHo) { lastHo = ho; hurtEl.style.opacity = String(ho); }
    var so = state === 'running' ? Math.round(slowK * 20) / 20 : 0; if (so !== lastSo) { lastSo = so; slowEl.style.opacity = String(so); }
    drawHudR4(); superDraw(dt); shieldDraw(); narrDraw(dt);
    tmp.copy(camLook); camera.position.copy(camBase);
    if (yawOff !== 0) {
      var cy = Math.cos(yawOff), sy2 = Math.sin(yawOff), rx = camera.position.x - x, rz = camera.position.z;
      camera.position.x = x + rx * cy + rz * sy2; camera.position.z = -rx * sy2 + rz * cy;
      var lx = tmp.x - x, lz = tmp.z; tmp.x = x + lx * cy + lz * sy2; tmp.z = -lx * sy2 + lz * cy;
    }
    camera.lookAt(tmp);
    sun.position.set(x + 5, 11, 5); sun.target.position.set(x, 0, -3);

    var sc0 = Math.floor(score); if (sc0 !== lastScore) { lastScore = sc0; el.score.textContent = sc0; }
    var sp = Math.round(speed * 3.6); if (sp !== lastSpeed) { lastSpeed = sp; el.speed.textContent = 'SPEED ' + sp + ' KM/H'; }
    el.duck.style.display = ducking && state === 'running' ? 'block' : 'none';
    el.duck.textContent = sliding ? 'SLIDING' : 'DUCKING';
    var inW = state === 'running' && crashT <= 0 && forkIn <= speed * Math.min(2.5, forkWin());
    turnEl.style.display = inW && !choice ? 'block' : 'none';
    if (inW && !choice) turnEl.textContent = forkType === 'left' ? '\u2190 TURN LEFT!' : forkType === 'right' ? 'TURN RIGHT! \u2192' : 'SWIPE \u2190 or \u2192 TO TURN';
    arrowEl.style.display = state === 'running' && choice ? 'block' : 'none'; arrowEl.textContent = choice === 'left' ? '\u25C0 LEFT' : 'RIGHT \u25B6';
    if (choice) arrowEl.style.color = forkType !== 'split' && choice !== forkType ? '#ff5a5a' : '#7CFC9A';
    pauseEl.style.display = state === 'running' && isPaused() ? 'flex' : 'none';
    modeEl.textContent = 'DUCK: ' + (duckMode().slide ? 'SLIDE' : 'HOLD');
    var cOn = state === 'running' && gt - lastNM < 3000 && combo > 0;
    comboEl.style.display = cOn ? 'block' : 'none'; if (cOn) comboEl.textContent = 'COMBO x' + combo;
    var age = now - lastInT;
    if (age < 500) { el.flash.textContent = lastIn; el.flash.style.opacity = String(0.5 * (1 - age / 500)); } else if (el.flash.style.opacity !== '0') el.flash.style.opacity = '0';
    el.start.style.display = state === 'start' ? 'flex' : 'none';
    var mu = !!(window.sfx && window.sfx.isMuted()); if (muteBtn && mu !== muteShown) { muteShown = mu; muteBtn.textContent = mu ? '\uD83D\uDD07' : '\uD83D\uDD0A'; muteBtn.setAttribute('aria-label', mu ? 'Unmute' : 'Mute'); }
    if (state === 'dead') { el.over.style.display = 'flex'; if (!el.ocause) { el.ocause = document.createElement('div'); el.ocause.style.cssText = 'color:#ffd24a;font-size:max(16px,2.4vh);margin:6px 0'; el.oscore.parentNode.insertBefore(el.ocause, el.oscore); } el.ocause.textContent = deathCause; el.oscore.textContent = 'Score ' + Math.floor(score); el.obest.textContent = 'Coins ' + coinCount + ' · Best ' + Math.floor(hi); }
    else el.over.style.display = 'none';
    renderer.render(scene, camera);
  }

  // ---------- game feel ----------
  // Jump physics, lane spring, squash/stretch, camera spring + smooth shake, FOV punch,
  // hit-stop and a pooled particle system. Existing code only calls these hooks.
  // Jump: same apex (JH) and airtime (JD) as the old sine arc, with a slightly faster fall.
  var F_TUP = JD * 0.54, F_GUP = 2 * JH / (F_TUP * F_TUP), F_V0 = F_GUP * F_TUP, F_GDN = 2 * JH / ((JD - F_TUP) * (JD - F_TUP));
  var fJy = 0, fVy = 0, fAir = false, fBuf = 0, fPxV = 0, fSq = 0, fSqV = 0, fHit = 0, fRaw = 0, fT = 0, fFov = 0;
  var fLvl = 1, fShot = false, fYaw = 0, fCam = camBase.clone(), fCamV = new THREE.Vector3();
  function feelTakeoff(buffered) { fAir = true; fVy = F_V0; fJy = 0; fSq = -0.16; fSqV = 9; fJumpN++; fFlipOn = !!buffered || fJumpN % 3 === 0; }
  // called from update() with slow-mo scaled dt; keeps jumpT contract (<0 grounded, >=0 airborne)
  function feelJump(dt) {
    if (jumpT >= 0 && !fAir) feelTakeoff();
    if (!fAir) return;
    jumpT += dt;
    var g = fVy > 0 ? F_GUP : F_GDN;
    fJy += fVy * dt - 0.5 * g * dt * dt; fVy -= g * dt;
    if (fJy <= 0) {
      fJy = 0; fVy = 0; fAir = false; jumpT = -1; fSq = -0.28; fSqV = 0; fFlipOn = false; feelDust();
      // jump buffer: pressed up to 150 ms before landing
      if (fBuf > gt) { fBuf = 0; jumpT = 0; lastAct = { t: gt, kind: 'jump' }; sfx('jump'); feelTakeoff(true); }
    }
  }
  // critically damped spring toward the lane, closed-form step (stable for any dt)
  function feelLane(dt) {
    var w = 22, x0 = px - lane, j = (fPxV + w * x0) * dt, e = Math.exp(-w * dt);
    px = lane + (x0 + j) * e; fPxV = (fPxV - w * j) * e;
  }
  function feelHit() { fHit = Math.max(fHit, 0.07); }
  // loop(): returns 0 while hit-stop runs; freeze counts down in real time
  function feelStep(dt) { fRaw = dt; if (fHit > 0 && !isPaused()) { fHit -= dt; return 0; } return dt; }

  // particles: one InstancedMesh (one draw call), ring-allocated, faded by scale
  var FX_N = 150, fxI = 0, fxLive = 0, fxP = [], fxD = new THREE.Object3D(), fxC = new THREE.Color();
  var fxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), FX_N);
  fxMesh.frustumCulled = false; fxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fxD.scale.setScalar(0); fxD.updateMatrix();
  for (var fi = 0; fi < FX_N; fi++) {
    fxP.push({ t: 0, t0: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, dr: 0, s: 0.1, sz: 1, gr: 0, w: false, b: false, r: 0, sp: 0 });
    fxMesh.setMatrixAt(fi, fxD.matrix); fxMesh.setColorAt(fi, fxC.setHex(0xffffff));
  }
  scene.add(fxMesh);
  function fxSpawn(x, y, z, vx, vy, vz, life, size, hex, g, drag, world, bounce) {
    var p = fxP[fxI]; fxI = (fxI + 1) % FX_N;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.t = p.t0 = life; p.s = size; p.g = g; p.dr = drag;
    p.w = world; p.b = bounce; p.sz = 1; p.gr = 0; p.r = Math.random() * 3; p.sp = 7;
    fxMesh.setColorAt((fxI + FX_N - 1) % FX_N, fxC.setHex(hex)); fxMesh.instanceColor.needsUpdate = true;
    fxLive++; return p;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function feelDust() {
    var x = (px - 1) * LW, hex = THEMES[track].stripe;
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      var p = fxSpawn(x + Math.cos(a) * 0.25, 0.08, Math.sin(a) * 0.2, Math.cos(a) * rnd(1.2, 2.2), rnd(0.4, 1.1), Math.sin(a) * rnd(0.4, 0.9) + 1.2, rnd(0.3, 0.45), rnd(0.08, 0.13), hex, 1.5, 4, false, false);
      p.gr = 1.0; p.sp = 2;
    }
  }
  function feelCoin(x, y) {
    var cols = [0xffd700, 0xfff3a0, 0xffffff];
    for (var i = 0; i < 9; i++) {
      var a = Math.random() * Math.PI * 2, u = rnd(-1, 1), h = Math.sqrt(1 - u * u), r = rnd(2.5, 4.5);
      fxSpawn(x, y, 0, Math.cos(a) * h * r, u * r + 1.5, Math.sin(a) * h * r * 0.5, rnd(0.3, 0.45), rnd(0.07, 0.11), cols[i % 3], 7, 2, false, false);
    }
  }
  function feelBoom(x, z, hex) {
    var cols = [hex, hex, 0x2a2a2a, 0xff7a1a];
    for (var i = 0; i < 22; i++) {
      fxSpawn(x + rnd(-0.5, 0.5), rnd(0.4, 1.4), z + rnd(-0.4, 0.4), rnd(-4.5, 4.5), rnd(4, 9), rnd(-3, 3), rnd(0.9, 1.3), rnd(0.16, 0.32), cols[i % 4], 20, 0.6, true, true);
    }
    feelHit(); shake = Math.max(shake, 0.2);
  }
  function feelWhoosh() {
    for (var i = 0; i < 14; i++) {
      var sd = i % 2 ? 1 : -1, p = fxSpawn(sd * rnd(1.6, 4), rnd(0.4, 3), rnd(-14, -2), 0, 0, rnd(26, 36), rnd(0.22, 0.32), 0.035, 0xffffff, 0, 0, false, false);
      p.sz = 40; p.sp = 0; p.r = 0;
    }
  }
  function fxUpdate(fdt) {
    if (!fxLive) return;
    var flow = state === 'running' && crashT <= 0 ? speed : 0, live = 0;
    for (var i = 0; i < FX_N; i++) {
      var p = fxP[i]; if (p.t <= 0) continue;
      p.t -= fdt; if (p.z > 2.5) p.t = 0; // never let particles reach the camera
      if (p.t <= 0) { fxD.position.set(0, 0, 0); fxD.scale.setScalar(0); fxD.updateMatrix(); fxMesh.setMatrixAt(i, fxD.matrix); continue; }
      live++;
      var dk = Math.exp(-p.dr * fdt); p.vx *= dk; p.vz *= dk; p.vy = p.vy * dk - p.g * fdt;
      p.x += p.vx * fdt; p.y += p.vy * fdt; p.z += (p.vz + (p.w ? flow : 0)) * fdt;
      if (p.y < 0.04) { p.y = 0.04; p.vy = p.b ? -p.vy * 0.35 : 0; p.vx *= 0.7; p.vz *= 0.7; }
      p.r += p.sp * fdt;
      var k = p.t / p.t0, sc = p.s * Math.min(1, k * 2.5) * (1 + p.gr * (1 - k));
      fxD.position.set(p.x, p.y, p.z); fxD.rotation.set(p.r, p.r * 0.7, 0); fxD.scale.set(sc, sc, sc * p.sz);
      fxD.updateMatrix(); fxMesh.setMatrixAt(i, fxD.matrix);
    }
    fxD.rotation.set(0, 0, 0);
    fxLive = live; fxMesh.instanceMatrix.needsUpdate = true;
  }
  // ---- move animations: jump tuck/flip, slide dust + recovery, gun draw/recoil/muzzle flash ----
  var fJumpN = 0, fFlipOn = false, fAirT = 0, fRec = 0, fGun = 0, fSlid = false, fDustT = 0;
  var fMuzzle = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  fMuzzle.position.y = -0.52; fMuzzle.visible = false; gun.add(fMuzzle);
  // shooting poses (arm x/z, legs L/R x, roll = lean (+ left), pitch (- back), yaw = camera-facing twist, dy = crouch)
  var F_POSES = [
    { roll: 0.38, pitch: 0.05, yaw: 0.35, ar: [1.6, 0.35], al: [0.3, -1.1], lg: [0.5, -0.4], dy: -0.06 }, // side lean left, gun arm out
    { roll: -0.38, pitch: 0.05, yaw: -0.35, ar: [1.55, 0.05], al: [1.35, 0.45], lg: [-0.4, 0.5], dy: -0.06 }, // side lean right, two-hand
    { roll: 0.14, pitch: -0.55, yaw: 0.3, ar: [1.95, -0.12], al: [1.95, 0.12], lg: [0.7, -0.2], dy: 0 }, // action-hero lean back, both arms forward
    { roll: -0.12, pitch: 0.18, yaw: -0.2, ar: [1.4, 0.1], al: [1.3, 0.3], lg: [1.45, -1.25], dy: -0.38 } // low crouch / knee slide aim
  ];
  var fPoseI = 0, fPoseK = 0;
  function feelDt(dt) { return isPaused() ? 0 : dt * (state === 'running' ? 1 - 0.75 * slowK : 1); }
  function feelSlideDust(n) {
    var x = (px - 1) * LW, hex = THEMES[track].stripe;
    for (var i = 0; i < n; i++) {
      var p = fxSpawn(x + rnd(-0.3, 0.3), 0.06, rnd(-0.9, -0.4), rnd(-1, 1), rnd(0.6, 1.5), rnd(2.5, 4.5), rnd(0.25, 0.4), rnd(0.07, 0.12), hex, 3, 3, false, false);
      p.gr = 1.2; p.sp = 3;
    }
  }
  // called from draw() after the base pose is set; only adds on top of it
  function feelPose(dt, jh, sliding, aiming) {
    var fdt = feelDt(dt), run = state === 'running';
    // shoot: gun pops in, arm kicks up, muzzle flash, small torso recoil
    if (run && shot && !fShot) { fRec = 1; fovKick = Math.max(fovKick, 5); fPoseI = (fPoseI + 1 + Math.floor(Math.random() * (F_POSES.length - 1))) % F_POSES.length; }
    fShot = !!shot;
    // shooting pose: random hero pose (never the same twice in a row), eased in/out with slow-mo;
    // mid-jump / mid-slide keeps that pose and only adds arm aim + a small lean
    fPoseK += ((run && aiming ? 1 : 0) - fPoseK) * Math.min(1, (isPaused() ? 0 : dt) * 7);
    var P = F_POSES[fPoseI], pk = fPoseK * fPoseK * (3 - 2 * fPoseK), busy = jh > 0 || sliding || ducking, bk = pk * (busy ? 0.3 : 1);
    pose.rotation.z = P.roll * bk; pose.rotation.y = P.yaw * bk;
    armR.rotation.x += (P.ar[0] - armR.rotation.x) * pk; armR.rotation.z += (P.ar[1] - armR.rotation.z) * pk;
    armL.rotation.x += (P.al[0] - armL.rotation.x) * pk; armL.rotation.z = P.al[1] * pk;
    if (!busy) {
      legL.rotation.x += (P.lg[0] - legL.rotation.x) * pk; legR.rotation.x += (P.lg[1] - legR.rotation.x) * pk;
      pose.position.y += P.dy * pk;
    }
    fRec = Math.max(0, fRec - fdt * 5);
    fGun = aiming ? Math.min(1, fGun + fdt * 10) : 0;
    gun.scale.setScalar(aiming ? 0.25 + 0.75 * (1 - Math.pow(1 - fGun, 3)) : 1);
    if (aiming) { armR.rotation.x += 0.75 * fRec * fRec; armR.rotation.z += 0.1 * fRec; }
    fMuzzle.visible = aiming && fRec > 0.5;
    if (fMuzzle.visible) { fMuzzle.scale.setScalar(0.6 + 2.2 * (fRec - 0.5)); fMuzzle.rotation.y += 1.3; }
    var pr = 0.12 * fRec * fRec + P.pitch * bk;
    // jump: legs tuck toward the chest, arms swing forward; every 3rd / buffered jump is a front flip
    if (jh > 0 && run) {
      fAirT += fdt;
      var ap = Math.min(1, fAirT / JD), tk = Math.sin(Math.PI * Math.min(1, ap * 1.25));
      legL.rotation.x += (1.25 - legL.rotation.x) * tk; legR.rotation.x += (1.0 - legR.rotation.x) * tk;
      if (!aiming) { armL.rotation.x += (0.8 - armL.rotation.x) * tk; armR.rotation.x += (0.8 - armR.rotation.x) * tk; }
      if (fFlipOn) { var fe = Math.min(1, ap * 1.1); pr -= 2 * Math.PI * fe * fe * (3 - 2 * fe); } else pr -= 0.3 * tk;
    } else fAirT = 0;
    // pitch around the hips (pivot 1 m up), not the feet
    pose.rotation.x += pr; pose.position.y += 1.0 - Math.cos(pr); pose.position.z = -Math.sin(pr);
    // slide: squash dip + dust burst on drop, dust trail while sliding, pop + dust on stand-up
    var low = run && (sliding || ducking);
    if (low && !fSlid) { fSq = -0.2; fSqV = 0; feelSlideDust(6); fDustT = 0.05; }
    if (!low && fSlid && run) { fSq = 0.14; fSqV = 0; feelSlideDust(4); }
    fSlid = low;
    if (low) { fDustT -= fdt; if (fDustT <= 0) { fDustT = sliding ? 0.05 : 0.12; feelSlideDust(sliding ? 2 : 1); } }
  }
  // called from draw() with raw dt: freezes on pause, follows slow-mo
  function feelDraw(dt) {
    var fdt = feelDt(dt);
    if (!isPaused()) fT += fRaw;
    if (state === 'running') {
      if (level > fLvl) fovKick = Math.max(fovKick, 9);
      if (yawT > fYaw + 0.01) feelWhoosh();
    }
    fLvl = level; fYaw = yawT;
    // squash/stretch: underdamped spring back to rest
    fSqV += (-180 * fSq - 14 * fSqV) * fdt; fSq += fSqV * fdt;
    runner.scale.set(1 - fSq * 0.5, 1 + fSq, 1 - fSq * 0.5);
    runner.rotation.y = -fPxV * 0.025;
    // FOV punch: smooth rise toward fovKick, exponential decay
    fovKick *= Math.exp(-4 * fdt); if (fovKick < 0.02) fovKick = 0;
    fFov += (fovKick - fFov) * Math.min(1, fdt * 16);
    // camera: critically damped spring on x/y, then smooth-noise shake offset
    var w = 9, e = Math.exp(-w * fdt), cx = fCam.x - camPos.x, cy = fCam.y - camPos.y;
    var jx = (fCamV.x + w * cx) * fdt, jy = (fCamV.y + w * cy) * fdt;
    fCam.x = camPos.x + (cx + jx) * e; fCamV.x = (fCamV.x - w * jx) * e;
    fCam.y = camPos.y + (cy + jy) * e; fCamV.y = (fCamV.y - w * jy) * e;
    fCam.z = camPos.z; camBase.copy(fCam);
    if (shake > 0) {
      var a = shake * 0.5;
      camBase.x += a * (Math.sin(fT * 38) * 0.6 + Math.sin(fT * 67 + 1.7) * 0.4);
      camBase.y += a * (Math.sin(fT * 45 + 3.1) * 0.6 + Math.sin(fT * 73 + 4.6) * 0.4);
      shake *= Math.exp(-6 * fdt); if (shake < 0.004) shake = 0;
    }
    fxUpdate(fdt);
  }
  function feelReset() {
    fJy = 0; fVy = 0; fAir = false; fBuf = 0; fPxV = 0; fSq = 0; fSqV = 0; fHit = 0; fLvl = 1; fShot = false;
    fRec = 0; fGun = 0; fPoseK = 0; pose.rotation.set(0, 0, 0); armL.rotation.z = 0; fAirT = 0; fFlipOn = false; fJumpN = 0; fSlid = false; pose.position.z = 0; gun.scale.setScalar(1);
    runner.scale.set(1, 1, 1);
    for (var i = 0; i < FX_N; i++) fxP[i].t = 0;
    fxD.position.set(0, 0, 0); fxD.scale.setScalar(0); fxD.updateMatrix();
    for (var j = 0; j < FX_N; j++) fxMesh.setMatrixAt(j, fxD.matrix);
    fxMesh.instanceMatrix.needsUpdate = true; fxLive = 0;
  }

  applyTheme();
  camera.position.copy(camPos); camera.lookAt(camLook);
  var last = performance.now(), fpsAcc = 0, fpsN = 0, dbgT = 0;
  function loop(now) {
    var raw = (now - last) / 1000, dt = Math.min(0.05, Math.max(0, raw)); last = now;
    if (raw > 0) { fpsAcc += raw; fpsN++; }
    if (now - dbgT > 100) { if (fpsAcc > 0) fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; dbgT = now; if (dbgOn) renderDbg(); }
    dt = feelStep(dt); update(dt); draw(now, dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  report(true);
})();
