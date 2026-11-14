// Glint's Grid: the engine. Draws the ground and things, pans with a finger drag, zooms with a pinch, and a tap on a thing says what it is.
addEventListener("error", e => { document.body.dataset.error = String(e.message || e.error || "error").slice(0, 200); });
(() => {
  const W = window.GLINT_WORLD, GROUND = window.GLINT_GROUND, THINGS = window.GLINT_THINGS, LOG = window.GLINT_LOG || [];
  const cv = document.getElementById("grid"), ctx = cv.getContext("2d");
  const say = document.getElementById("say"), logPanel = document.getElementById("logPanel");
  const START = W.start || { x: W.size / 2, y: W.size / 2, s: 28 };
  const cam = { ...START };
  const WALKERS = W.walkers || [];
  let follow = null, lastT = 0;

  // Walkers stroll from tile to tile along paths and plaza, around anything standing there.
  const blocked = new Set(W.things.map(th => th.x + "," + th.y));
  const walkable = (x, y) => "po".includes((W.tiles[y] || "")[x] || ".") && !blocked.has(x + "," + y);
  for (const w of WALKERS) Object.assign(w, { fx: w.x, fy: w.y, tx: w.x, ty: w.y, px: w.x, py: w.y, wait: 1, dx: 0, dy: 0, moving: false });
  function stepWalker(w, dt) {
    if (w.wait > 0) { w.wait -= dt; w.moving = false; return; }
    const ddx = w.tx - w.fx, ddy = w.ty - w.fy, d = Math.hypot(ddx, ddy), go = dt * (w.speed || 1.3);
    if (d > go) { w.fx += ddx / d * go; w.fy += ddy / d * go; w.moving = true; return; }
    w.fx = w.tx; w.fy = w.ty;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ax, ay]) => [w.tx + ax, w.ty + ay]).filter(([nx, ny]) => walkable(nx, ny));
    const fresh = opts.filter(([nx, ny]) => nx !== w.px || ny !== w.py), pick = (fresh.length ? fresh : opts)[Math.floor(Math.random() * (fresh.length || opts.length))];
    if (!pick) { w.wait = 1; return; }
    w.px = w.tx; w.py = w.ty; w.dx = pick[0] - w.tx; w.dy = pick[1] - w.ty; w.tx = pick[0]; w.ty = pick[1];
    if (Math.random() < 0.18) w.wait = 0.6 + Math.random() * 1.8;      // stop and look around now and then
  }
  let dpr = 1, sayTimer = 0;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  addEventListener("resize", resize); resize();
  const toScreen = (x, y) => [innerWidth / 2 + (x - cam.x) * cam.s, innerHeight / 2 + (y - cam.y) * cam.s];
  const toWorld = (sx, sy) => [cam.x + (sx - innerWidth / 2) / cam.s, cam.y + (sy - innerHeight / 2) / cam.s];

  function frame(ms) {
    const t = ms / 1000, dt = Math.min(0.1, t - lastT); lastT = t;
    for (const w of WALKERS) { stepWalker(w, dt); w.x = w.fx; w.y = w.fy; }
    if (follow) { cam.x += (follow.fx + 0.5 - cam.x) * Math.min(1, dt * 4); cam.y += (follow.fy - cam.y) * Math.min(1, dt * 4); }
    const s = cam.s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#05070f"; ctx.fillRect(0, 0, innerWidth, innerHeight);
    for (let y = 0; y < W.size; y++) for (let x = 0; x < W.size; x++) {
      const g = GROUND[(W.tiles[y] || "")[x]] || GROUND["."], [sx, sy] = toScreen(x, y);
      if (sx > innerWidth || sy > innerHeight || sx + s < 0 || sy + s < 0) continue;
      ctx.fillStyle = g.fill; ctx.fillRect(sx, sy, s, s);
      ctx.strokeStyle = g.line; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
    }
    for (const th of [...W.things, ...WALKERS].sort((a, b) => a.y - b.y)) {
      const k = THINGS[th.kind]; if (!k?.draw) continue;
      const [sx, sy] = toScreen(th.x, th.y);
      try { ctx.save(); k.draw(ctx, sx + s / 2, sy + s / 2, s, t, th); } catch (e) { console.error(th.kind, e); } finally { ctx.restore(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.getElementById("count").textContent = `${W.things.length} built · ${WALKERS.length} living here`;

  // Touch: drag to look around, pinch to zoom, tap a thing to hear about it.
  const pts = new Map(); let moved = 0, pinch = 0;
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; });
  cv.addEventListener("pointermove", e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const [c, d] = [...pts.values()], d1 = Math.hypot(c[0] - d[0], c[1] - d[1]);
      if (d0 > 0) cam.s = Math.max(10, Math.min(80, cam.s * d1 / d0)); pinch = 1; return;
    }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 8) follow = null;
    cam.x -= dx / cam.s; cam.y -= dy / cam.s; pts.set(e.pointerId, [e.clientX, e.clientY]);
  });
  cv.addEventListener("pointerup", e => {
    pts.delete(e.pointerId); if (moved > 8 || pinch) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const hit = [...W.things, ...WALKERS].filter(th => Math.hypot(th.x + 0.5 - wx, th.y + 0.5 - wy) < (th.r || 1)).sort((a, b) => Math.hypot(a.x + 0.5 - wx, a.y + 0.5 - wy) - Math.hypot(b.x + 0.5 - wx, b.y + 0.5 - wy))[0];
    if (hit) { const line = hit.lines ? hit.lines[hit.lineAt = ((hit.lineAt ?? -1) + 1) % hit.lines.length] : hit.say; if (hit.lines) hit.wait = 2.5;
      say.innerHTML = `<b>${esc(hit.name || hit.kind)}</b>${line ? "<br>" + esc(line) : ""}`; say.classList.remove("hidden"); clearTimeout(sayTimer); sayTimer = setTimeout(() => say.classList.add("hidden"), 5000); }
  });
  cv.addEventListener("pointercancel", e => pts.delete(e.pointerId));
  cv.addEventListener("wheel", e => { e.preventDefault(); cam.s = Math.max(10, Math.min(80, cam.s * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  document.getElementById("homeBtn").onclick = () => { follow = null; Object.assign(cam, START); };
  document.getElementById("glintBtn").onclick = () => { follow = WALKERS[0] || null; cam.s = Math.max(cam.s, 40); };
  document.getElementById("logBtn").onclick = () => {
    document.getElementById("log").innerHTML = LOG.map(l => `<li>${esc(l.text)} <small>${esc(l.when || "")}</small></li>`).join("");
    logPanel.classList.toggle("hidden");
  };
  window.GLINT_GRID = { cam, ready: true, walkers: WALKERS };   // for the test bot
  document.body.dataset.ready = "1";
})();
