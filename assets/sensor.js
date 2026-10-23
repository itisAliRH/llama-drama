// Sensor test page: defines window.game for bridge.js. No game.
(function () {
  // tile id -> [label, sub, move, key]
  var TILES = [
    ['left', 'LEFT', 'left', 'ArrowLeft'],
    ['up', 'UP', 'jump', 'ArrowUp'],
    ['right', 'RIGHT', 'right', 'ArrowRight'],
    ['ccw', 'ANTICLOCKWISE', 'track_prev', 'r'],
    ['down', 'DOWN', 'duck', 'ArrowDown'],
    ['cw', 'CLOCKWISE', 'track', 't'],
    ['fwd', 'FORWARD (push)', 'shoot', 'f'],
    ['back', 'BACKWARD (pull)', 'pause', 'p'],
    ['wave', 'WAVE', 'wave', 'w']
  ];
  var SUB = { left: 'left', jump: 'jump', right: 'right', duck: 'duck', track: 'track', track_prev: 'track_prev', shoot: 'shoot', pause: 'pause', wave: 'wave' };
  var byMove = {}, counts = {}, done = {}, checklist = false;
  var lastDebug = 0, debugData = {}, lastGestureT = 0, gap = null, log = [];
  var $ = function (id) { return document.getElementById(id); };
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function hms(t) { var d = new Date(t); return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '.' + pad(d.getMilliseconds(), 3); }

  var grid = $('grid');
  TILES.forEach(function (t) {
    var el = document.createElement('button');
    el.className = 'tile'; el.type = 'button';
    el.innerHTML = '<span class="chk">&#10003;</span><span class="n">' + t[1] + '</span><span class="s">' + SUB[t[2]] + ' [' + t[3] + ']</span><span class="c">0</span>';
    el.addEventListener('click', function () { input(t[2], 'touch'); });
    grid.appendChild(el);
    byMove[t[2]] = el; counts[t[2]] = 0; done[t[2]] = false;
  });

  function flash(el) {
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 250);
  }

  function input(move, source) {
    source = source || 'keyboard';
    // bridge.js renames these for the games; show them on their gesture tiles.
    if (move === 'shield') move = 'wave';
    else if (move === 'start' && source !== 'keyboard' && source !== 'touch') move = 'shoot';
    var now = Date.now();
    gap = lastGestureT ? now - lastGestureT : null;
    lastGestureT = now;
    log.unshift({ t: now, m: String(move), s: String(source) });
    if (log.length > 20) log.length = 20;
    var el = byMove[move];
    if (el) {
      counts[move]++;
      el.querySelector('.c').textContent = counts[move];
      flash(el);
      if (checklist && !done[move]) { done[move] = true; el.classList.add('done'); checkDone(); }
    }
    renderLog();
  }

  function debug(data) {
    if (!data || typeof data !== 'object') return;
    debugData = data; lastDebug = Date.now();
  }

  function checkDone() {
    var left = Object.keys(done).filter(function (k) { return !done[k]; });
    $('msg').textContent = left.length ? left.length + ' left: ' + left.join(', ') : 'ALL GESTURES OK';
  }

  function renderLog() {
    $('log').innerHTML = log.map(function (e) {
      return '<div><span class="t">' + hms(e.t) + '</span><span>' + e.m + '</span><span class="t">' + e.s + '</span></div>';
    }).join('');
  }

  function render() {
    var now = Date.now();
    var connEl = $('conn');
    var age = lastDebug ? now - lastDebug : null;
    var okAge = age !== null && age <= 2000;
    connEl.textContent = 'socket: ' + (typeof io === 'undefined' ? 'no socket.io' : (okAge ? 'receiving' : 'no data'));
    connEl.className = 'pill ' + (okAge ? 'ok' : 'bad');
    var ageEl = $('age');
    ageEl.textContent = 'last debug: ' + (age === null ? 'never' : (age / 1000).toFixed(1) + ' s ago');
    ageEl.className = 'pill ' + (okAge ? 'ok' : 'bad');
    var sEl = $('sens');
    sEl.textContent = 'sensor: ' + (debugData.sensor || '-');
    sEl.className = 'pill ' + (debugData.sensor === 'ok' ? 'ok' : (debugData.sensor ? 'bad' : ''));
    $('info').innerHTML =
      '<b>raw</b> ' + (debugData.raw !== undefined && debugData.raw !== '' ? debugData.raw : '-') +
      ' &nbsp; <b>i2c</b> ' + (debugData.i2c || '-') +
      ' &nbsp; <b>last gesture</b> ' + (debugData.gesture || '-') +
      '<br><b>since previous gesture</b> ' + (gap === null ? '-' : gap + ' ms') +
      ' &nbsp; <b>board msgs</b> ' + (debugData.msgs !== undefined ? debugData.msgs : '-') +
      ' &nbsp; <b>uptime</b> ' + (debugData.uptime !== undefined ? debugData.uptime + ' s' : '-');
  }
  setInterval(render, 200);

  $('reset').addEventListener('click', function () {
    Object.keys(counts).forEach(function (k) {
      counts[k] = 0; done[k] = false;
      byMove[k].querySelector('.c').textContent = '0';
      byMove[k].classList.remove('done');
    });
    log = []; gap = null; lastGestureT = 0; $('msg').textContent = checklist ? 'Do each gesture once' : '';
    renderLog();
  });
  $('check').addEventListener('click', function () {
    checklist = !checklist;
    this.textContent = 'Checklist mode: ' + (checklist ? 'on' : 'off');
    this.classList.toggle('on', checklist);
    $('msg').textContent = checklist ? 'Do each gesture once' : '';
  });

  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    for (var i = 0; i < TILES.length; i++) {
      if (TILES[i][3] === k) { e.preventDefault(); input(TILES[i][2], 'keyboard'); return; }
    }
  });

  window.game = { input: input, debug: debug };
  render();
})();
