// Glint's Grid: the engine. Draws the ground and things, pans with a finger drag, zooms with a pinch, and a tap on a thing says what it is.
addEventListener("error", e => { document.body.dataset.error = String(e.message || e.error || "error").slice(0, 200); });
(() => {
  const W = window.GLINT_WORLD, GROUND = window.GLINT_GROUND, THINGS = window.GLINT_THINGS, LOG = window.GLINT_LOG || [];
  const cv = document.getElementById("grid"), ctx = cv.getContext("2d");
  const say = document.getElementById("say"), logPanel = document.getElementById("logPanel");
  const cam = { x: W.size / 2, y: W.size / 2, s: 28 };
  let dpr = 1, sayTimer = 0;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  addEventListener("resize", resize); resize();
  const toScreen = (x, y) => [innerWidth / 2 + (x - cam.x) * cam.s, innerHeight / 2 + (y - cam.y) * cam.s];
  const toWorld = (sx, sy) => [cam.x + (sx - innerWidth / 2) / cam.s, cam.y + (sy - innerHeight / 2) / cam.s];

  function frame(ms) {
    const t = ms / 1000, s = cam.s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#05070f"; ctx.fillRect(0, 0, innerWidth, innerHeight);
    for (let y = 0; y < W.size; y++) for (let x = 0; x < W.size; x++) {
      const g = GROUND[(W.tiles[y] || "")[x]] || GROUND["."], [sx, sy] = toScreen(x, y);
      if (sx > innerWidth || sy > innerHeight || sx + s < 0 || sy + s < 0) continue;
      ctx.fillStyle = g.fill; ctx.fillRect(sx, sy, s, s);
      ctx.strokeStyle = g.line; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
    }
    for (const th of [...W.things].sort((a, b) => a.y - b.y)) {
      const k = THINGS[th.kind]; if (!k?.draw) continue;
      const [sx, sy] = toScreen(th.x, th.y);
      try { ctx.save(); k.draw(ctx, sx + s / 2, sy + s / 2, s, t, th); } catch (e) { console.error(th.kind, e); } finally { ctx.restore(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.getElementById("count").textContent = `${W.things.length} built`;

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
    cam.x -= dx / cam.s; cam.y -= dy / cam.s; pts.set(e.pointerId, [e.clientX, e.clientY]);
  });
  cv.addEventListener("pointerup", e => {
    pts.delete(e.pointerId); if (moved > 8 || pinch) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const hit = W.things.filter(th => Math.hypot(th.x + 0.5 - wx, th.y + 0.5 - wy) < 1).sort((a, b) => Math.hypot(a.x + 0.5 - wx, a.y + 0.5 - wy) - Math.hypot(b.x + 0.5 - wx, b.y + 0.5 - wy))[0];
    if (hit) { say.innerHTML = `<b>${esc(hit.name || hit.kind)}</b>${hit.say ? "<br>" + esc(hit.say) : ""}`; say.classList.remove("hidden"); clearTimeout(sayTimer); sayTimer = setTimeout(() => say.classList.add("hidden"), 4000); }
  });
  cv.addEventListener("pointercancel", e => pts.delete(e.pointerId));
  cv.addEventListener("wheel", e => { e.preventDefault(); cam.s = Math.max(10, Math.min(80, cam.s * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  document.getElementById("homeBtn").onclick = () => { cam.x = W.size / 2; cam.y = W.size / 2; cam.s = 28; };
  document.getElementById("logBtn").onclick = () => {
    document.getElementById("log").innerHTML = LOG.map(l => `<li>${esc(l.text)} <small>${esc(l.when || "")}</small></li>`).join("");
    logPanel.classList.toggle("hidden");
  };
  window.GLINT_GRID = { cam, ready: true };   // for the test bot
  document.body.dataset.ready = "1";
})();
