// Kindle's Grid: the Meadow Path (pale stepping stones winding west off the North Road) and the Meadow Lamp at its first step.
// The path tiles are "f" ground (walkable for grid.js and glint-life.js). This file wraps GLINT_GROUND.f.draw: tiles listed
// in the meadowlamp's `path` are drawn as frosty meadow moss with pale stones along a curve from the tile it comes from to
// the tile it goes to (so the path visibly winds). Other "f" tiles (the lit garden path) draw as before.
// meadowlamp: a short pale-stone pillar with a gold-capped lantern of cream glass. Glows brighter (th._k) when a walker is on
// the path or near; a tap (or a walker stepping on the first stone) sends a warm wave west along the stones. `?pose=stones`
// holds the wave halfway. In the Lamp Song heads() (things-lampsong.js). meadowpath: flat named stub at the far end.
(() => {
  const TAU = Math.PI * 2;
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const G = window.GLINT_GROUND || {};
  const lampOf = () => (window.GLINT_WORLD?.things || []).find(th => th.kind === "meadowlamp");
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const walkers = () => (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);

  // where the wave is: 0..n along the path (or -1 when resting)
  function waveAt(th, t) {
    if (POSE === "stones") return (th.path || []).length * 0.5;
    const e = th._wave != null ? t - th._wave : 99;
    return e >= 0 && e < 3.2 ? e * 3 : -9;
  }

  const oldF = G.f && G.f.draw;
  if (G.f) G.f.draw = function (ctx, sx, sy, s, t, tx, ty) {
    const th = lampOf(), path = th?.path || [];
    const i = path.findIndex(([x, y]) => x === tx && y === ty);
    if (i < 0) { if (oldF) oldF.call(this, ctx, sx, sy, s, t, tx, ty); return; }
    // meadow moss under the stones, with the same faint grid line as the rest of the meadow
    ctx.fillStyle = "#0c2a2c"; ctx.fillRect(sx, sy, s, s);
    ctx.strokeStyle = "#1c6b5c"; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
    // frost glints and little grass tufts on the bare moss (fewer since the Morning Hearth warms the stones)
    const HE = window.GLINT_HEARTH, warm = HE ? 0.55 + 0.45 * HE.k : 0;
    for (let k = 0; k < 5; k++) {
      const fx = hash(tx * 7 + k, ty * 3), fy = hash(ty * 5 + k, tx * 11 + k);
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.3 + k * 2.1 + tx));
      ctx.fillStyle = `rgba(220,245,255,${(0.25 + 0.4 * tw) * (1 - 0.6 * warm)})`; ctx.fillRect(sx + fx * s, sy + fy * s, Math.max(1, s * 0.022), Math.max(1, s * 0.022));
    }
    ctx.strokeStyle = "#2f8f72"; ctx.lineWidth = Math.max(1, s * 0.018); ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const fx = hash(tx + k * 3, ty * 9 + 1), fy = hash(ty + k * 5, tx * 2 + 7);
      const gx = sx + fx * s, gy = sy + fy * s;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - s * 0.03, gy - s * 0.07); ctx.moveTo(gx, gy); ctx.lineTo(gx + s * 0.025, gy - s * 0.08); ctx.stroke();
    }
    // the curve the stones follow: from the edge it comes in by, through the middle, to the edge it leaves by
    const prev = i === 0 ? th.from || [tx + 1, ty] : path[i - 1];
    const next = path[i + 1];
    const edge = ([nx, ny]) => [0.5 + (nx - tx) * 0.5, 0.5 + (ny - ty) * 0.5];
    const a = edge(prev), b = next ? edge(next) : [0.5 + (tx - prev[0]) * 0.2, 0.5 + (ty - prev[1]) * 0.2];
    const c = [0.5 + (hash(tx, ty) - 0.5) * 0.18, 0.5 + (hash(ty, tx) - 0.5) * 0.18];
    const at = u => { const v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; };
    const us = next ? [0.17, 0.5, 0.83] : [0.25, 0.7];
    const wv = waveAt(th, t), k = th._k ?? 0;
    us.forEach((u, j) => {
      const [px, py] = at(u), along = i + u;
      const lit = Math.max(0, 1 - Math.abs(wv - along) / 1.2);
      const side = (j % 2 ? 1 : -1) * 0.05, rw = (0.15 + hash(tx * 3 + j, ty) * 0.05) * (next ? 1 : 1.15), rh = rw * 0.66, rot = hash(j, tx + ty) * 1.2 - 0.6;
      const cx = sx + (px + side) * s, cy = sy + (py + side * 0.6) * s;
      // the Morning Hearth's warmth: a pulse running both ways from the bend, a melted ring of dark moss, an amber heart
      const hr = HE && HE.wave != null ? (t - HE.wave) * 2.6 : -9, hp = HE && hr < 7 ? Math.max(0, 1 - Math.abs(Math.abs(along - HE.from) - hr) / 1.1) : 0;
      if (warm > 0) {
        ctx.fillStyle = "rgba(14,52,40,0.8)"; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, rw * s * 1.45, rh * s * 1.6, rot, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(34,96,62,0.5)"; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, rw * s * 1.25, rh * s * 1.35, rot, 0, TAU); ctx.fill();
        glow(ctx, cx, cy, s * rw * (1.9 + 0.8 * hp), "255,160,80", 0.1 * warm + 0.5 * hp);
      }
      if (lit > 0.05 || k > 0.05) glow(ctx, cx, cy, s * rw * 2.2, "255,214,140", 0.15 * k + 0.55 * lit);
      ctx.fillStyle = "#5d6b78"; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.025, rw * s, rh * s, rot, 0, TAU); ctx.fill();   // the stone's dark side
      ctx.fillStyle = lit > 0.4 ? "#fff6dc" : "#d6dbd4"; ctx.beginPath(); ctx.ellipse(cx, cy, rw * s, rh * s, rot, 0, TAU); ctx.fill();
      if (warm > 0) {   // warm stone: an amber heart showing through, a soft shine instead of frost, and curls of warm breath
        ctx.fillStyle = `rgba(255,${150 + 40 * hp | 0},80,${0.3 + 0.15 * warm + 0.35 * hp})`; ctx.beginPath(); ctx.ellipse(cx + rw * s * 0.1, cy + rh * s * 0.15, rw * s * 0.55, rh * s * 0.45, rot, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,240,215,0.45)"; ctx.beginPath(); ctx.ellipse(cx - rw * s * 0.35, cy - rh * s * 0.35, rw * s * 0.3, rh * s * 0.22, rot, 0, TAU); ctx.fill();
        const ph = (t * 0.22 + hash(tx * 5 + j, ty * 3)) % 1;
        if (ph < 0.6 || hp > 0.3) {
          const u = hp > 0.3 ? Math.max(ph, 0.2) : ph / 0.6, wy = cy - s * 0.04 - u * s * 0.32, wx = cx + Math.sin(u * 5 + j) * s * 0.03;
          ctx.strokeStyle = `rgba(255,236,210,${0.4 * Math.sin(u * Math.PI)})`; ctx.lineWidth = Math.max(1, s * 0.012);
          ctx.beginPath(); ctx.moveTo(wx, wy + s * 0.07); ctx.quadraticCurveTo(wx + s * 0.035, wy + s * 0.035, wx, wy); ctx.quadraticCurveTo(wx - s * 0.035, wy - s * 0.035, wx, wy - s * 0.06); ctx.stroke();
        }
      } else { ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(cx - rw * s * 0.3, cy - rh * s * 0.3, rw * s * 0.45, rh * s * 0.35, rot, 0, TAU); ctx.fill(); }   // frost on top
    });
  };

  T.meadowpath = function meadowpath() {};   // the far end of the path: the stones are drawn by the ground

  T.meadowlamp = function meadowlamp(ctx, x, y, s, t, th = {}) {
    const path = th.path || [];
    // awake when someone is on the path or close by; a step onto the first stone, or a tap, sends the wave west
    const ws = walkers();
    const onPath = ws.some(w => path.some(([px, py]) => Math.abs((w.fx ?? w.x) - px) < 0.6 && Math.abs((w.fy ?? w.y) - py) < 0.6));
    const near = onPath || ws.some(w => Math.hypot((w.fx ?? w.x) - (th.x + 0.5), (w.fy ?? w.y) - th.y) < 1.6);
    const onFirst = path[0] && ws.some(w => Math.round(w.fx ?? w.x) === path[0][0] && Math.round(w.fy ?? w.y) === path[0][1]);
    if (th.tapped != null && th.tapped !== th._seenTap) { th._seenTap = th.tapped; th._wave = th.tapped; }
    if (onFirst && !th._wasFirst && !(t - (th._wave ?? -99) < 4)) th._wave = t;
    th._wasFirst = onFirst;
    const want = POSE === "stones" || near ? 1 : 0;
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 2);
    const k = th._k, e = th._wave != null ? t - th._wave : 99, flare = e >= 0 && e < 1.5 ? Math.sin(Math.PI * e / 1.5) : POSE === "stones" ? 0.6 : 0;
    const fl = 0.88 + 0.08 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 8.3);

    const sc = th.scale || 1;
    ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    const b = y, ly = b - s * 0.5;   // foot, lantern centre

    // warm pool on the first stones, then shadow
    glow(ctx, x - s * 0.25, b - s * 0.15, s * (1.0 + 0.25 * k + 0.3 * flare), "255,200,120", (0.18 + 0.12 * k + 0.2 * flare) * fl);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b, s * 0.15, s * 0.05, 0, 0, TAU); ctx.fill();

    // a short pillar of pale stone, two stones stacked, frost on the top edges
    poly(ctx, [[x - s * 0.12, b], [x + s * 0.12, b], [x + s * 0.11, b - s * 0.13], [x - s * 0.11, b - s * 0.13]], "#9aa3a6");
    poly(ctx, [[x - s * 0.12, b], [x - s * 0.04, b], [x - s * 0.04, b - s * 0.13], [x - s * 0.11, b - s * 0.13]], "#c9cec9");
    poly(ctx, [[x - s * 0.08, b - s * 0.13], [x + s * 0.08, b - s * 0.13], [x + s * 0.07, b - s * 0.31], [x - s * 0.07, b - s * 0.31]], "#aeb5b5");
    poly(ctx, [[x - s * 0.08, b - s * 0.13], [x - s * 0.02, b - s * 0.13], [x - s * 0.02, b - s * 0.31], [x - s * 0.07, b - s * 0.31]], "#dfe3dc");
    ctx.fillStyle = "rgba(235,250,255,0.8)"; ctx.fillRect(x - s * 0.11, b - s * 0.135, s * 0.22, s * 0.014); ctx.fillRect(x - s * 0.07, b - s * 0.315, s * 0.14, s * 0.014);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(x - s * 0.09, b - s * 0.345, s * 0.18, s * 0.03);   // gold collar

    // the lantern: cream glass in a gold frame, a little peaked gold roof and a star on top
    glow(ctx, x, ly, s * (0.55 + 0.15 * k + 0.25 * flare), "255,210,130", (0.3 + 0.18 * k + 0.22 * flare) * fl);
    ctx.fillStyle = "#b8862e"; ctx.fillRect(x - s * 0.085, ly - s * 0.13, s * 0.17, s * 0.26);
    ctx.fillStyle = `rgba(255,243,205,${0.75 + 0.2 * k})`; ctx.fillRect(x - s * 0.065, ly - s * 0.11, s * 0.13, s * 0.22);
    // the flame
    const fh = s * (0.09 + 0.02 * Math.sin(t * 6.2) + 0.03 * flare);
    ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.ellipse(x, ly + s * 0.03, s * 0.035, fh * 0.75, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff8e0"; ctx.beginPath(); ctx.ellipse(x, ly + s * 0.045, s * 0.017, fh * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.fillRect(x - s * 0.006, ly - s * 0.11, s * 0.012, s * 0.22); ctx.fillRect(x - s * 0.065, ly - s * 0.006, s * 0.13, s * 0.012);   // gold cross bars
    poly(ctx, [[x - s * 0.12, ly - s * 0.13], [x + s * 0.12, ly - s * 0.13], [x, ly - s * 0.24]], "#ffd166");
    poly(ctx, [[x - s * 0.12, ly - s * 0.13], [x, ly - s * 0.13], [x, ly - s * 0.24]], "#e09a2b");
    ctx.fillStyle = "rgba(235,250,255,0.85)"; ctx.fillRect(x - s * 0.1, ly - s * 0.145, s * 0.2, s * 0.012);   // frost on the roof's edge
    const st = ly - s * 0.28, sr = s * (0.045 + 0.01 * flare);
    glow(ctx, x, st, s * 0.14, "255,236,170", 0.5 + 0.3 * Math.sin(t * 2.3));
    ctx.fillStyle = "#fff6d6"; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const r = j % 2 ? sr * 0.45 : sr, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * r, st + Math.sin(an) * r); }
    ctx.closePath(); ctx.fill();

    // when the wave goes, a few sparks lift from the lantern and drift west with it
    if (e >= 0 && e < 3) for (let j = 0; j < 4; j++) {
      const u = Math.min(1, e / 3 + j * 0.06), px = x - u * s * 2.4 - j * s * 0.1, py = ly - s * 0.2 - Math.sin(u * Math.PI) * s * 0.5 - j * s * 0.05;
      glow(ctx, px, py, s * 0.08, "255,220,150", 0.8 * (1 - u));
    }
  };
})();
