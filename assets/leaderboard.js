// Shared leaderboard overlay. Load after bridge.js; uses window.boardSocket, falls back to localStorage.
(function () {
  var NAME_K = 'lb_name', LOCAL_K = 'lb_local', TOP = 10;
  var sock = window.boardSocket || null;
  var uiName = (location.pathname.split('/').pop() || 'game').replace(/\.html?$/i, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || 'game';
  var state = 'start', pending = false, top = [], last = null;
  function online() { return !!(sock && sock.connected); }

  function clean(v) {
    var n = String(v || '').trim().toUpperCase().replace(/[^A-Z0-9 _.-]/g, '').trim().slice(0, 12);
    return n || 'PLAYER';
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var css = document.createElement('style');
  css.textContent =
    '#lb-panel{position:fixed;right:1.2vw;bottom:2vh;z-index:30;width:min(320px,27vw);max-height:60vh;overflow:auto;' +
    'background:rgba(8,10,20,.82);color:#e8f0ff;border:1px solid rgba(120,160,255,.35);border-radius:12px;padding:12px 14px;' +
    'font:14px/1.35 system-ui,Arial,sans-serif;box-sizing:border-box;box-shadow:0 6px 24px rgba(0,0,0,.5)}' +
    '#lb-panel.hide{display:none}' +
    '#lb-panel label{display:block;font-size:.8em;opacity:.7;margin-bottom:4px;letter-spacing:.05em;text-transform:uppercase}' +
    '#lb-panel .row{display:flex;gap:6px}' +
    '#lb-panel input{flex:1;min-width:0;font:inherit;font-size:1.1em;font-weight:700;padding:6px 8px;border-radius:6px;border:1px solid #3a4670;background:#111830;color:#fff;text-transform:uppercase}' +
    '#lb-panel button{font:inherit;font-weight:700;padding:6px 12px;border-radius:6px;border:0;background:#4fd1ff;color:#001018;cursor:pointer}' +
    '#lb-panel .res{margin:10px 0 4px;font-weight:700}' +
    '#lb-panel .nb{color:#ffd24a;font-size:1.3em;letter-spacing:.05em}' +
    '#lb-panel h3{margin:10px 0 4px;font-size:.85em;letter-spacing:.08em;opacity:.8}' +
    '#lb-panel table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}' +
    '#lb-panel td,#lb-panel th{padding:2px 4px;text-align:left;white-space:nowrap}' +
    '#lb-panel th{font-size:.75em;opacity:.6;font-weight:600}' +
    '#lb-panel td.n{text-align:right}' +
    '#lb-panel tr.me td{color:#ffd24a}' +
    '#lb-panel .off{font-size:.75em;opacity:.55;margin-top:6px}' +
    '@media (max-width:700px){#lb-panel{top:auto;bottom:8px;right:8px;left:8px;width:auto;transform:none;max-height:42vh;font-size:13px}}';
  document.head.appendChild(css);

  var panel = document.createElement('div');
  panel.id = 'lb-panel';
  panel.innerHTML =
    '<label for="lb-name">Your name</label>' +
    '<div class="row"><input id="lb-name" maxlength="12" autocomplete="off" spellcheck="false"><button type="button" id="lb-ok">OK</button></div>' +
    '<div class="res" id="lb-res"></div>' +
    '<h3>TOP 10</h3>' +
    '<table><thead><tr><th>#</th><th>Name</th><th class="n">Score</th><th class="n">Lvl</th></tr></thead><tbody id="lb-body"></tbody></table>' +
    '<div class="off" id="lb-off"></div>';
  (document.body || document.documentElement).appendChild(panel);
  var input = panel.querySelector('#lb-name'), okBtn = panel.querySelector('#lb-ok');
  var resEl = panel.querySelector('#lb-res'), body = panel.querySelector('#lb-body'), offEl = panel.querySelector('#lb-off');
  input.value = lsGet(NAME_K) || '';

  function myName() { return clean(input.value); }
  function sendPlayer() {
    var n = myName();
    if (input.value.trim()) lsSet(NAME_K, n);
    if (sock) { try { sock.emit('set_player', { name: n, ui: uiName }); } catch (e) {} }
  }

  // Keys typed in the box must not reach the game's window listeners.
  ['keydown', 'keyup', 'keypress'].forEach(function (t) {
    input.addEventListener(t, function (e) {
      e.stopPropagation();
      if (t === 'keydown' && e.key === 'Enter') { e.preventDefault(); submit(); }
      if (t === 'keydown' && e.key === 'Escape') input.blur();
    });
  });
  // Taps on the panel must not start a run via the game's window touch handler.
  ['touchstart', 'touchend'].forEach(function (t) { panel.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
  function submit() { input.value = myName(); sendPlayer(); input.blur(); }
  okBtn.addEventListener('click', function () { submit(); okBtn.blur(); });

  function render() {
    var me = myName();
    while (body.firstChild) body.removeChild(body.firstChild);
    (top || []).slice(0, TOP).forEach(function (e, i) {
      var tr = document.createElement('tr');
      if (last && e && e.name === last.name && e.score === last.score) tr.className = 'me';
      else if (!last && e && e.name === me) tr.className = 'me';
      [String(i + 1), e.name, String(e.score), String(e.level == null ? '' : e.level)].forEach(function (v, j) {
        var td = document.createElement('td');
        td.textContent = v;
        if (j >= 2) td.className = 'n';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    if (!top || !top.length) {
      var tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 4; td.textContent = 'No runs yet'; td.style.opacity = '.6';
      tr.appendChild(td); body.appendChild(tr);
    }
    resEl.textContent = '';
    if (last && state === 'dead') {
      if (last.isBest) {
        var nb = document.createElement('div');
        nb.className = 'nb'; nb.textContent = 'NEW BEST!';
        resEl.appendChild(nb);
      }
      var r = document.createElement('div');
      r.textContent = last.name + ': ' + last.score + ' · rank #' + last.rank;
      resEl.appendChild(r);
    }
    offEl.textContent = online() ? '' : 'offline: local scores only';
  }

  function onBoard(msg) {
    if (!msg) return;
    top = msg.top || [];
    if (msg.last && pending && msg.last.name === myName()) { last = msg.last; pending = false; }
    render();
  }

  // Offline fallback: same shape as the board's data/leaderboard.json.
  function localRecord(s) {
    var d;
    try { d = JSON.parse(lsGet(LOCAL_K) || ''); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = { best: {}, top: [] };
    d.best = d.best || {}; d.top = d.top || [];
    var name = myName(), score = Math.max(0, Math.floor(+s.score || 0));
    var entry = { name: name, score: score, coins: +s.coins || 0, level: +s.level || 0, ui: uiName, ts: Math.floor(Date.now() / 1000) };
    var prev = d.best[name], isBest = !prev || score > (+prev.score || 0);
    if (isBest) d.best[name] = entry;
    d.top = d.top.concat([entry]).sort(function (a, b) { return b.score - a.score; }).slice(0, TOP);
    var rank = 1;
    Object.keys(d.best).forEach(function (n) { if (n !== name && (+d.best[n].score || 0) > score) rank++; });
    lsSet(LOCAL_K, JSON.stringify(d));
    onBoard({ top: d.top, last: { name: name, score: score, rank: rank, isBest: isBest } });
  }
  function localLoad() {
    try { var d = JSON.parse(lsGet(LOCAL_K) || ''); top = (d && d.top) || []; } catch (e) { top = []; }
    render();
  }

  function setVisible() { panel.classList.toggle('hide', state === 'running'); }

  var orig = window.onGameState;
  window.onGameState = function (s) {
    var ns = s && s.state ? String(s.state) : state;
    var was = state;
    if (ns === 'running' && was !== 'running') { sendPlayer(); last = null; pending = false; input.blur(); }
    if (ns === 'dead' && was === 'running') {
      pending = true;
      if (!online()) { state = ns; localRecord(s); }
    }
    state = ns;
    setVisible();
    if (ns === 'dead' && was === 'running') render();
    if (typeof orig === 'function') return orig.apply(this, arguments);
  };

  localLoad(); // local runs until the board answers
  if (sock) {
    sock.on('leaderboard', onBoard);
    var hello = function () { sendPlayer(); try { sock.emit('leaderboard_get', {}); } catch (e) {} render(); };
    sock.on('connect', hello);
    sock.on('disconnect', render);
    if (sock.connected) hello();
  }
  setVisible();
  render();
})();
