// Recorder for Edge Impulse training data: label clips of raw PAJ7620 samples.
(function () {
  var LABELS = ["left", "right", "jump", "duck", "idle"];
  var COLORS = ["#38bdf8", "#f472b6", "#facc15", "#4ade80"];
  var MAX = [4096, 4096, 256, 1024]; // per-channel plot scale (12-bit centre, 8-bit brightness)
  var $ = function (id) { return document.getElementById(id); };
  var counts = {}, recording = null, countdownTimer = null;
  var hist = []; // last N samples for the plot
  var HIST_N = 500;
  var lastBatch = 0, batches = 0;

  try { $("who").value = localStorage.getItem("rec_who") || ""; } catch (e) {}
  $("who").addEventListener("change", function () { try { localStorage.setItem("rec_who", $("who").value); } catch (e) {} });

  LABELS.forEach(function (l) {
    var b = document.createElement("button");
    b.className = "lab"; b.id = "lab-" + l;
    b.innerHTML = l + "<small id=\"cnt-" + l + "\">0 clips</small>";
    b.onclick = function () { start(l); };
    $("labels").appendChild(b);
  });

  if (typeof io === "undefined") { $("conn").textContent = "socket.io missing"; return; }
  var socket = io({ transports: ["websocket"] });
  socket.on("connect", function () {
    $("conn").textContent = "socket: on"; $("conn").className = "pill ok";
    socket.emit("raw_on", {});
    socket.emit("clip_counts", {});
  });
  socket.on("disconnect", function () { $("conn").textContent = "socket: off"; $("conn").className = "pill bad"; });

  socket.on("raw", function (d) {
    if (!d || !d.s) return;
    batches++; lastBatch = Date.now();
    for (var i = 0; i < d.s.length; i++) hist.push(d.s[i]);
    if (hist.length > HIST_N) hist.splice(0, hist.length - HIST_N);
  });
  socket.on("debug", function (d) { if (d && d.ai_mode) $("mode").textContent = "mode: " + d.ai_mode + (d.ai_label ? " | " + d.ai_label + " " + d.ai_conf : ""); });
  socket.on("clip_counts", setCounts);
  socket.on("record_progress", function (d) {
    if (!recording) return;
    $("status").textContent = "Recording " + d.label + ": " + d.rows + " / " + d.target + " samples";
  });
  socket.on("record_done", function (d) {
    finish();
    $("status").textContent = "Saved " + d.file + " (" + d.rows + " rows" + (d.reason !== "complete" ? ", " + d.reason : "") + ")";
    if (d.counts) setCounts(d.counts);
  });
  socket.on("record_error", function (d) { finish(); $("status").textContent = "Error: " + (d && d.error); });

  $("stop").onclick = function () { socket.emit("record_stop", {}); finish(); };
  $("ctl").onchange = function () { socket.emit("set_mode", { mode: $("ctl").value }); };

  function setCounts(c) {
    counts = c || {};
    LABELS.forEach(function (l) { $("cnt-" + l).textContent = (counts[l] || 0) + " clips"; });
  }

  function start(label) {
    if (recording) return;
    var secs = Number($("secs").value) || 2;
    recording = label;
    LABELS.forEach(function (l) { $("lab-" + l).disabled = true; });
    $("lab-" + label).classList.add("rec");
    var n = 3;
    $("count").textContent = n;
    $("status").textContent = "Get ready: " + label;
    countdownTimer = setInterval(function () {
      n--;
      if (n > 0) { $("count").textContent = n; return; }
      clearInterval(countdownTimer);
      $("count").textContent = "GO " + label.toUpperCase();
      socket.emit("record_start", { label: label, seconds: secs, name: $("who").value });
    }, 700);
  }

  function finish() {
    clearInterval(countdownTimer);
    recording = null;
    $("count").textContent = "";
    LABELS.forEach(function (l) { var b = $("lab-" + l); b.disabled = false; b.classList.remove("rec"); });
  }

  // Plot
  var cv = $("plot"), ctx = cv.getContext("2d");
  function draw() {
    var w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 1;
    for (var g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, h * g / 4); ctx.lineTo(w, h * g / 4); ctx.stroke(); }
    for (var c = 0; c < 4; c++) {
      ctx.strokeStyle = COLORS[c]; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i < hist.length; i++) {
        var x = w - (hist.length - i) * (w / HIST_N);
        var y = h - Math.min(1, hist[i][c] / MAX[c]) * (h - 4) - 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    var age = lastBatch ? (Date.now() - lastBatch) : -1;
    $("rate").textContent = age < 0 ? "raw: none" : (age < 1000 ? "raw: live (" + batches + ")" : "raw: stale " + Math.round(age / 1000) + "s");
    $("rate").className = "pill " + (age >= 0 && age < 1000 ? "ok" : "bad");
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
