// Board <-> game glue. Needs libs/socket.io.min.js loaded first (arduino.js not required).
(function () {
  window.onGameState = function () {};
  // Static host (GitHub Pages, file://) or ?offline: no board, skip the socket entirely.
  window.BM_OFFLINE = window.BM_OFFLINE || location.protocol === "file:" || /(^|\.)github\.io$/.test(location.hostname) || /[?&]offline(=|&|$)/.test(location.search);
  if (window.BM_OFFLINE) return;
  if (typeof io === "undefined") {
    console.warn("bridge.js: socket.io missing, keyboard only");
    return;
  }

  let socket;
  try {
    // websocket only: lower latency, avoids polling payload overflow; give up after 5 tries until the board answers once
    socket = io({ transports: ['websocket'], reconnectionAttempts: 5 });
  } catch (e) {
    console.warn("bridge.js: socket.io init failed", e);
    return;
  }
  window.boardSocket = socket;
  const ui = {
    on_message: (ev, cb) => socket.on(ev, cb),
    send_message: (ev, data) => socket.emit(ev, data ?? {}),
  };

  let warned = false;
  socket.on("connect", () => {
    console.log("bridge: connected to board");
    document.documentElement.classList.add("bm-board"); // pages show gesture/sensor copy only with a board
    socket.io.reconnectionAttempts(Infinity); // board seen: keep reconnecting forever, as before
  });
  socket.on("connect_error", () => {
    if (!warned) console.warn("bridge: no board, keyboard only");
    warned = true;
  });
  socket.on("disconnect", () => {
    console.log("bridge: disconnected");
    document.documentElement.classList.remove("bm-board");
  });

  let lastState = null; // last game state reported by the page

  ui.on_message("move", (data) => {
    let move = data && data.move;
    if (!move) return;
    // Push starts or restarts the run when not running (start screen or game over).
    if (move === "shoot" && lastState !== "running") move = "start";
    if (move === "wave") move = "shield";
    console.log("bridge: move", move);
    if (window.game && typeof window.game.input === "function") {
      window.game.input(move, (data && data.source) || "gesture");
    }
  });

  ui.on_message("debug", (data) => {
    if (data && window.game && typeof window.game.debug === "function") {
      window.game.debug(data);
    }
  });

  let lastSent = 0;
  window.onGameState = function (state) {
    if (state && state.state) lastState = state.state;
    const now = Date.now();
    if (state && state.state === "running" && now - lastSent < 500) return;
    lastSent = now;
    ui.send_message("game_state", state);
  };

  // Debug helper: window.boardMove("jump") round-trips through the board.
  window.boardMove = (move) => ui.send_message("test_move", { move });
})();
