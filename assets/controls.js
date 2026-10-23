(function () {
  'use strict';
  var ROWS = [
    ['↔️', 'Move left/right', 'Swipe left/right', '← →'],
    ['⬆️', 'Jump', 'Swipe up', '↑'],
    ['⬇️', 'Duck / slide', 'Swipe down', '↓'],
    ['🔫', 'Shoot (slow-mo)', 'Push toward sensor', 'X / Enter'],
    ['🛡️', 'Shield', 'Wave', 'Z'],
    ['🔀', 'Turn at fork', 'Swipe left/right (or circle)', '← → / Q E'],
    ['⏸️', 'Pause', 'Pull away from sensor', 'P / Esc'],
    ['▶️', 'Start / restart', 'Push / tap', 'Space / Enter'],
    ['🔁', 'Restart run', '-', 'Backspace', 'restart'],
    ['🎵', 'Next / prev song', '-', 'N / B'],
    ['🔇', 'Mute', '-', 'M'],
    ['⚙️', 'Settings', '-', 'S'],
    ['🐞', 'Debug', '-', 'D']
  ];

  function build() {
    var css = document.createElement('style');
    css.textContent =
      '#controls-panel{position:fixed;left:1.2vw;bottom:2vh;z-index:30;' +
      'max-width:27vw;max-height:70vh;overflow:hidden;box-sizing:border-box;padding:clamp(8px,1.2vw,18px);' +
      'background:rgba(8,10,18,.78);color:#e8ecf5;border-radius:14px;pointer-events:none;' +
      'border:1px solid rgba(255,255,255,.12);font-family:system-ui,sans-serif;' +
      'font-size:clamp(9px,0.9vw,14px);line-height:1.25;transition:opacity .2s}' +
      '#controls-panel.hidden{opacity:0;visibility:hidden}' +
      '#controls-panel h3{margin:0 0 .4em;font-size:1.15em;letter-spacing:.06em;text-transform:uppercase}' +
      '#controls-panel table{border-collapse:collapse;width:100%}' +
      '#controls-panel th{text-align:left;font-weight:600;opacity:.6;font-size:.85em;padding:0 .4em .3em}' +
      '#controls-panel td{padding:.22em .4em;border-top:1px solid rgba(255,255,255,.08);vertical-align:middle}' +
      '#controls-panel td.i{width:1.6em;text-align:center}' +
      '#controls-panel td.k{white-space:nowrap;font-weight:700;color:#7fe0ff}' +
      '#controls-panel .tip{margin-top:.6em;font-size:.8em;opacity:.7;display:none}.bm-board #controls-panel .tip{display:block}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.id = 'controls-panel';
    var h = '<h3>Controls</h3><table><thead><tr><th></th><th>Action</th><th>Key</th><th>Swipe / gesture</th></tr></thead><tbody>';
    ROWS.forEach(function (r) {
      if (r[4] && !(window.game && typeof window.game[r[4]] === 'function')) return; // only if this game supports it
      h += '<tr><td class="i">' + r[0] + '</td><td>' + r[1] + '</td><td class="k">' + r[3] + '</td><td>' + r[2] + '</td></tr>';
    });
    h += '</tbody></table><div class="tip">Tip: hand 5-15 cm above the sensor, flat palm.</div>'; // shown only with a board
    el.innerHTML = h;
    document.body.appendChild(el);
    return el;
  }

  function init() {
    var el = build();
    var reported = false;
    function show(v) { el.classList.toggle('hidden', !v); }
    show(true);
    var prev = window.onGameState;
    window.onGameState = function (s) {
      try { if (typeof prev === 'function') prev.apply(this, arguments); } catch (e) {}
      try {
        if (s && typeof s === 'object') {
          reported = true;
          show(s.state !== 'running' || !!s.paused);
        }
      } catch (e) {}
    };
    setInterval(function () {
      try {
        var g = window.game;
        if (g && g.paused === true) show(true);
        else if (g && g.paused === false && !reported) { /* wait for report */ }
      } catch (e) {}
    }, 300);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
