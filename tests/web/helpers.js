// Shared helpers for the web tests. ?offline makes the local server behave like a static host (no board).
const engine = (u) => /\/socket\.io\/\?/.test(u); // Socket.IO handshake, not the vendored lib file

function watch(page) {
  const w = { errors: [], sockets: [], urls: [] };
  page.on('pageerror', (e) => w.errors.push(String(e)));
  page.on('request', (r) => w.urls.push(r.url()));
  page.on('websocket', (ws) => w.sockets.push(ws.url()));
  return w;
}

// Reads the ?debug panel of proto/b.html (state, lane, jump, duck, score, ...).
function dbg(page) {
  return page.evaluate(() => {
    const o = {};
    document.querySelectorAll('#dbg .r').forEach((r) => {
      const s = r.querySelectorAll('span');
      if (s.length >= 2) o[s[0].textContent] = s[1].textContent;
    });
    return o;
  });
}

module.exports = { engine, watch, dbg };
