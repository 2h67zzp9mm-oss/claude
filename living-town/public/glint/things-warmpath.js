// Kindle's Grid: the Window Path (kind "warmpath"), warm pale stones from the Spark Lamp's footing west to the Traveler's Window.
// `stones` are absolute [x, y] (drawn at x+0.5 like the Spark Lamp's steps); the last one is the wide Welcome Stone under the
// window. Each stone sits in a melted ring in the frost with a buried ember heart, joined by a faint ember line under the moss.
// Warm runs go lamp -> window: the Ember Pot pulse carries on from the Spark Lamp (GLINT_EMBER.wave, same 2.6 tiles/s), a tap,
// or a walker stepping on the first stone. When a run reaches the Welcome Stone, its gold star lights and motes rise to the
// panes (GLINT_OVER). Stones brighten under a walker's feet; at night the window light gilds them. `?pose=warmpath`.
// The `tiles` listed are "f" ground (walkable): this file draws them as plain glow-moss instead of the lit garden path.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  function darkness() {
    if (POSE === "warmpath") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  }
  const SPEED = 2.6, LAMP_AT = 2.15;   // the Ember Pot pulse reaches the Spark Lamp 2.15 tiles after it leaves the east step
  const pathOf = () => (window.GLINT_WORLD?.things || []).find(o => o.kind === "warmpath");

  // the path tiles are walkable "f" ground, but should look like the meadow moss around them
  const G = window.GLINT_GROUND || {};
  const oldF = G.f && G.f.draw;
  if (G.f) G.f.draw = function (ctx, sx, sy, s, t, tx, ty) {
    const th = pathOf();
    if (!th || !(th.tiles || []).some(([x, y]) => x === tx && y === ty)) { if (oldF) oldF.call(this, ctx, sx, sy, s, t, tx, ty); return; }
    ctx.fillStyle = G.g.fill; ctx.fillRect(sx, sy, s, s);
    ctx.strokeStyle = G.g.line; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
  };

  // distance along the run for each stone (from the Spark Lamp), cached on the thing
  function layout(th) {
    if (th._along) return th._along;
    let prev = [th.from?.[0] ?? 3.0, th.from?.[1] ?? 2.35], d = 0;
    th._along = th.stones.map(p => { d += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; return d; });
    return th._along;
  }
  // where the warm run is right now, in tiles past the Spark Lamp (or -9)
  function runAt(th, t) {
    if (POSE === "warmpath") return layout(th).at(-1) * 0.55;
    const EM = window.GLINT_EMBER;
    let best = -9;
    if (EM && EM.wave != null) { const d = (t - EM.wave) * SPEED - LAMP_AT; if (d > -0.5 && d < 4) best = d; }
    if (th._run != null) { const d = (t - th._run) * SPEED; if (d > -0.5 && d < 4 && (best < -1 || d > best)) best = d; }
    return best;
  }
  function stoneShape(ctx, x, y, rx, ry, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const O = window.GLINT_OVER = window.GLINT_OVER || {};

  T.warmpath = function warmpath(ctx, x, y, s, t, th = {}) {
    const st = th.stones || []; if (!st.length) return;
    const along = layout(th), total = along.at(-1);
    const toPx = ([px, py]) => [x + (px - th.x) * s, y + (py - th.y) * s];
    const dark = darkness(), EM = window.GLINT_EMBER, ek = EM ? 0.55 + 0.45 * EM.k : 0.6;
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);

    // a tap, or someone stepping onto the first stone, sends a warm run out to the window
    if (th.tapped != null && th._tapSeen !== th.tapped) { th._tapSeen = th.tapped; th._run = t; }
    const onFirst = ws.some(w => Math.hypot((w.fx ?? w.x) - st[0][0], (w.fy ?? w.y) - st[0][1]) < 0.45);
    if (onFirst && !th._onFirst && !(t - (th._run ?? -99) < 3)) th._run = t;
    th._onFirst = onFirst;
    const run = runAt(th, t);
    if (run > total - 0.2 && !(t - (th._arrive ?? -99) < 2.5)) th._arrive = t;

    // the ember line under the moss, stone to stone, with a slow amber shimmer
    const pts = [[th.from?.[0] ?? 3.0, (th.from?.[1] ?? 2.35) + 0.25], ...st].map(toPx);
    ctx.lineCap = "round";
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], mx = (ax + bx) / 2, my = (ay + by) / 2 + s * 0.04;
      const mid = ((i >= 2 ? along[i - 2] : 0) + along[i - 1]) / 2, hp = run > -1 ? Math.max(0, 1 - Math.abs(mid - run) / 0.6) : 0;
      ctx.strokeStyle = `rgba(255,${140 + 70 * hp | 0},60,${0.16 + 0.1 * ek + 0.4 * hp})`; ctx.lineWidth = Math.max(1, s * (0.018 + 0.02 * hp));
      ctx.setLineDash([s * 0.05, s * 0.06]); ctx.lineDashOffset = -t * s * 0.05;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);

    // frost glints on the moss round the path, fewer near the warm stones
    for (let k = 0; k < 26; k++) {
      const fx = 1.0 + hash(k, 3.1) * 2.6, fy = 2.75 + hash(7.7, k) * 1.15;
      const near = Math.min(...st.map(([px, py]) => Math.hypot(px - fx, py - fy)));
      if (near < 0.22) continue;
      const tw = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.2 + k * 1.9));
      const [gx, gy] = toPx([fx, fy]);
      ctx.fillStyle = `rgba(220,245,255,${(0.2 + 0.4 * tw) * Math.min(1, near / 0.6)})`;
      ctx.fillRect(gx, gy, Math.max(1, s * 0.02), Math.max(1, s * 0.02));
    }

    st.forEach((p, i) => {
      const [px, py] = toPx(p), last = i === st.length - 1;
      const rx = s * (last ? 0.29 : 0.18 + 0.02 * hash(i, 5)), ry = rx * (last ? 0.5 : 0.6), rot = (hash(i, 9) - 0.5) * 0.5;
      const hp = run > -1 ? Math.max(0, 1 - Math.abs(along[i] - run) / 0.5) : 0;
      const foot = ws.some(w => Math.hypot((w.fx ?? w.x) - p[0], (w.fy ?? w.y) - p[1]) < 0.35) ? 1 : 0;
      th._f = th._f || []; th._f[i] = (th._f[i] ?? 0) + (foot - (th._f[i] ?? 0)) * 0.08;
      const b = Math.min(1.6, 0.35 * ek + 0.75 * hp + 0.6 * th._f[i] + 0.25 * dark);
      // melted ring in the frost
      ctx.fillStyle = "rgba(14,52,40,0.85)"; stoneShape(ctx, px, py + s * 0.02, rx * 1.55, ry * 1.6, rot); ctx.fill();
      ctx.fillStyle = "rgba(36,100,64,0.55)"; stoneShape(ctx, px, py + s * 0.02, rx * 1.3, ry * 1.32, rot); ctx.fill();
      // the stone: shadow, warm-pale side, top, highlight
      ctx.fillStyle = "rgba(0,0,0,0.32)"; stoneShape(ctx, px + rx * 0.08, py + ry * 0.38, rx, ry, rot); ctx.fill();
      ctx.fillStyle = "#a89a88"; stoneShape(ctx, px, py + ry * 0.2, rx, ry, rot); ctx.fill();
      ctx.fillStyle = "#efe4d2"; stoneShape(ctx, px, py, rx, ry, rot); ctx.fill();
      ctx.fillStyle = `rgba(255,${200 + 30 * Math.min(1, hp) | 0},150,${0.18 + 0.3 * Math.min(1, b)})`; stoneShape(ctx, px, py, rx * 0.8, ry * 0.75, rot); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)"; stoneShape(ctx, px - rx * 0.28, py - ry * 0.3, rx * 0.4, ry * 0.28, rot); ctx.fill();
      // the ember heart showing through the middle
      const beat = 0.75 + 0.25 * Math.sin(t * 1.6 + i * 2.1);
      ctx.fillStyle = `rgba(255,${150 + 60 * Math.min(1, hp) | 0},70,${0.3 + 0.3 * beat * Math.min(1, b)})`;
      stoneShape(ctx, px, py + s * 0.005, rx * 0.42, ry * 0.4, rot); ctx.fill();
      glow(ctx, px, py, s * (0.22 + 0.15 * hp + 0.08 * th._f[i]) * (last ? 1.4 : 1), "255,170,90", 0.12 * beat + 0.3 * hp + 0.22 * th._f[i] + 0.05 * dark);
      if (dark > 0.2) glow(ctx, px, py, rx * 1.3, "255,215,140", 0.06 * dark);    // the window's light on the stones at night
      // warm breath curling up off the stones on a cold day
      for (let j = 0; j < 2; j++) {
        const q = (t * 0.28 + j * 0.5 + i * 0.31) % 1, cx = px + Math.sin(q * 6 + i + j) * s * 0.03, cy = py - s * 0.03 - q * s * (0.2 + 0.18 * hp);
        ctx.strokeStyle = `rgba(255,236,210,${(0.24 + 0.3 * hp) * (1 - q)})`; ctx.lineWidth = Math.max(1, s * 0.01);
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.024, 0.3, Math.PI * 1.5); ctx.stroke();
      }
      if (last) {   // the Welcome Stone: a gold star set in the middle, a gold rim, lit when a run arrives
        const ar = POSE === "warmpath" ? 0.6 : Math.max(0, 1 - (t - (th._arrive ?? -99)) / 2.4);
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012);
        stoneShape(ctx, px, py, rx * 0.86, ry * 0.82, rot); ctx.stroke();
        if (ar > 0) glow(ctx, px, py, s * (0.3 + 0.25 * ar), "255,225,140", 0.6 * ar);
        star(ctx, px, py - ry * 0.05, s * (0.05 + 0.025 * ar), "#ffd166");
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(px - s * 0.012, py - ry * 0.12, Math.max(0.6, s * 0.008), 0, TAU); ctx.fill();
      }
    });
  };

  // over everything: when a warm run arrives, gold motes drift up from the Welcome Stone to the window's panes
  O.warmpath = function (ctx, x, y, s, t, th = {}) {
    const st = th.stones || [], win = (window.GLINT_WORLD?.things || []).find(o => o.kind === "glowwindow");
    if (!st.length || !win) return;
    const e = POSE === "warmpath" ? 1.0 : t - (th._arrive ?? -99);
    if (e < 0 || e > 2.6) return;
    const toPx = ([px, py]) => [x + (px - th.x) * s, y + (py - th.y) * s];
    const [ax, ay] = toPx(st.at(-1)), [bx, by] = toPx([win.x, win.y - 0.25]);
    for (let j = 0; j < 7; j++) {
      const q = (e - j * 0.13) / 1.6; if (q < 0 || q > 1) continue;
      const mx = ax + (bx - ax) * q + Math.sin(q * 7 + j) * s * 0.08, my = ay + (by - ay) * q - Math.sin(q * Math.PI) * s * 0.15;
      const a = Math.sin(q * Math.PI);
      glow(ctx, mx, my, s * 0.07, "255,215,120", 0.7 * a);
      ctx.fillStyle = `rgba(255,251,230,${a})`; ctx.beginPath(); ctx.arc(mx, my, Math.max(0.8, s * 0.01), 0, TAU); ctx.fill();
    }
    const fl = smooth(1.2, 1.6, e) * (1 - smooth(1.8, 2.6, e));
    if (fl > 0) glow(ctx, bx, by, s * 0.5, "255,210,130", 0.35 * fl);
  };
})();
