// Kindle's Grid: the Corner Lamp where the east road meets Lantern Street (kind "cornerlamp"), and the Bread Trail.
// A honey-wood post with gold bands, a gold-caged lantern with amber glass and a rose cap (bakery colours), a bun-shaped
// gold finial, and a crossarm with two little way-boards: a loaf one pointing east (the bakery) and a pink one with a
// cushion pointing west (the Doorstep Bench). Two light-moths, amber and pink.
// The Bread Trail: `trail: [[x, y], ...]` road tiles from the bakery door to the bench. Each gets two amber road studs
// (drawn by wrapping GLINT_GROUND.p.draw, so they sit under everything) and a warm wave runs along them, bakery -> bench,
// every few seconds. It runs brighter (th._k eases to 1) when a walker is on the trail / near the lamp, or 5 s after a tap.
// `?pose=trail` holds it bright. Loads after things.js (stub `cornerlamp() {}`).
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

  const lampOf = () => (window.GLINT_WORLD?.things || []).find(th => th.kind === "cornerlamp");
  // how awake the trail is: walkers on it or near the lamp, or a recent tap
  function awake(th, t) {
    const ws = window.GLINT_GRID?.walkers || [];
    const trail = th.trail || [];
    const near = ws.some(w => {
      const wx = w.fx ?? w.x, wy = w.fy ?? w.y;
      if (wx == null || w.inside) return false;
      return Math.hypot(wx - th.x, wy - th.y) < 1.8 || trail.some(([tx, ty]) => Math.abs(wx - tx) < 0.6 && Math.abs(wy - ty) < 0.6);
    });
    const e = th.tapped != null ? t - th.tapped : 99;
    const want = POSE === "trail" ? 1 : Math.max(near ? 1 : 0, e >= 0 && e < 5 ? 1 : 0);
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 2.5);
    return th._k;
  }

  // the road studs: two per trail tile, on the edges of the road, lit by a wave that runs from the bakery to the bench
  const oldP = G.p && G.p.draw;
  if (G.p) G.p.draw = function (ctx, sx, sy, s, t, tx, ty) {
    if (oldP) oldP.call(this, ctx, sx, sy, s, t, tx, ty);
    const th = lampOf(); if (!th || !th.trail) return;
    const i = th.trail.findIndex(([x, y]) => x === tx && y === ty); if (i < 0) return;
    const k = th._k ?? 0, n = th.trail.length;
    const [ax, ay] = th.trail[Math.max(0, i - 1)], [bx, by] = th.trail[Math.min(n - 1, i + 1)];
    const across = Math.abs(bx - ax) >= Math.abs(by - ay);           // road runs east-west here: studs at top and bottom edges
    const studs = across ? [[0.5, 0.14], [0.5, 0.86]] : [[0.14, 0.5], [0.86, 0.5]];
    const ph = (t * (0.45 + 0.35 * k)) % 1.6;                          // wave position along the trail, 0..1 (then a rest)
    const wave = Math.max(0, 1 - Math.abs(ph * n - i) / 1.6);
    for (const [fx, fy] of studs) {
      const px = sx + fx * s, py = sy + fy * s, tw = 0.6 + 0.4 * Math.sin(t * 2.2 + tx * 3.1 + ty * 1.7 + fx * 5);
      glow(ctx, px, py, s * (0.2 + 0.15 * wave + 0.08 * k), "255,190,100", 0.25 + 0.2 * k * tw + 0.6 * wave);
      ctx.fillStyle = "#7a4520"; ctx.beginPath(); ctx.ellipse(px, py + s * 0.012, s * 0.09, s * 0.05, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = wave > 0.4 ? "#fff3c4" : k > 0.5 ? "#ffd27a" : "#e0a05a";
      ctx.beginPath(); ctx.ellipse(px, py, s * 0.075, s * 0.042, 0, 0, TAU); ctx.fill();
    }
    if (wave > 0.05) glow(ctx, sx + s * 0.5, sy + s * 0.5, s * 0.6, "255,205,120", 0.18 * wave * (0.6 + 0.4 * k));
  };

  T.cornerlamp = function cornerlamp(ctx, x, y, s, t, th = {}) {
    const k = awake(th, t);
    const e = POSE === "trail" ? 1.2 : th.tapped != null ? t - th.tapped : 99;
    const tap = e >= 0 && e < 2.5 ? Math.sin(Math.PI * Math.min(1, e / 2.5)) : 0;
    ctx.translate(x, y + s * 0.3); ctx.scale(1.25, 1.25); ctx.translate(-x, -(y + s * 0.3));
    const b = y + s * 0.3, top = b - s * 1.15, fl = 0.88 + 0.08 * Math.sin(t * 3.3) + 0.04 * Math.sin(t * 7.7);

    // shadow and the warm pool of light on the corner
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b, s * 0.2, s * 0.07, 0, 0, TAU); ctx.fill();
    glow(ctx, x, b, s * (1.4 + 0.3 * k), "255,190,100", (0.16 + 0.12 * k) * fl);

    // honey-wood post on a gold-capped stone foot, with two gold bands
    poly(ctx, [[x - s * 0.13, b], [x + s * 0.13, b], [x + s * 0.1, b - s * 0.09], [x - s * 0.1, b - s * 0.09]], "#2a3f7a");
    ctx.fillStyle = "#ffd166"; ctx.fillRect(x - s * 0.1, b - s * 0.1, s * 0.2, s * 0.025);
    ctx.fillStyle = "#8a4f24"; ctx.fillRect(x - s * 0.04, top, s * 0.08, b - top - s * 0.09);
    ctx.fillStyle = "#c27a3a"; ctx.fillRect(x - s * 0.04, top, s * 0.025, b - top - s * 0.09);
    ctx.fillStyle = "#ffd166"; for (const f of [0.35, 0.7]) ctx.fillRect(x - s * 0.05, b - (b - top) * f, s * 0.1, s * 0.022);

    // the crossarm and its two way-boards
    const ay = top + s * 0.3;
    ctx.fillStyle = "#8a4f24"; ctx.fillRect(x - s * 0.5, ay, s * 1.0, s * 0.035);
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x - s * 0.5, ay + s * 0.017, s * 0.02, 0, TAU); ctx.arc(x + s * 0.5, ay + s * 0.017, s * 0.02, 0, TAU); ctx.fill();
    const swing = d => Math.sin(t * 1.1 + d) * 0.06 + d * tap * 0.12;
    for (const d of [1, -1]) {             // east board: a gold loaf (the bakery). West board: a pink cushion (the bench).
      const hx = x + d * s * 0.3, hy = ay + s * 0.035, w = s * 0.4, h = s * 0.2;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(swing(d));
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.01);
      ctx.beginPath(); ctx.moveTo(-w * 0.3, 0); ctx.lineTo(-w * 0.3, s * 0.04); ctx.moveTo(w * 0.3, 0); ctx.lineTo(w * 0.3, s * 0.04); ctx.stroke();
      const by0 = s * 0.04, tipx = d * w * 0.62;
      poly(ctx, [[-d * w * 0.5, by0], [d * w * 0.4, by0], [tipx, by0 + h / 2], [d * w * 0.4, by0 + h], [-d * w * 0.5, by0 + h]], d > 0 ? "#e0a05a" : "#ff78c4");
      poly(ctx, [[-d * w * 0.5, by0], [d * w * 0.4, by0], [tipx, by0 + h / 2], [d * w * 0.45, by0 + h * 0.5], [-d * w * 0.5, by0 + h * 0.5]], d > 0 ? "#f2c07a" : "#ffb3de");
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012);
      ctx.beginPath(); ctx.moveTo(-d * w * 0.5, by0); ctx.lineTo(d * w * 0.4, by0); ctx.lineTo(tipx, by0 + h / 2); ctx.lineTo(d * w * 0.4, by0 + h); ctx.lineTo(-d * w * 0.5, by0 + h); ctx.closePath(); ctx.stroke();
      const ex = -d * w * 0.05, ey = by0 + h / 2;
      if (d > 0) {                         // a little loaf with score marks
        ctx.fillStyle = "#9c5a28"; ctx.beginPath(); ctx.ellipse(ex, ey + h * 0.12, w * 0.2, h * 0.3, 0, Math.PI, TAU); ctx.fill();
        ctx.strokeStyle = "#fff0c8"; ctx.lineWidth = Math.max(1, s * 0.008);
        for (const o of [-0.08, 0, 0.08]) { ctx.beginPath(); ctx.moveTo(ex + w * (o - 0.03), ey + h * 0.02); ctx.lineTo(ex + w * (o + 0.03), ey - h * 0.14); ctx.stroke(); }
      } else {                             // a pink cushion with a gold button
        poly(ctx, [[ex - w * 0.2, ey + h * 0.25], [ex - w * 0.16, ey - h * 0.22], [ex + w * 0.16, ey - h * 0.22], [ex + w * 0.2, ey + h * 0.25]], "#d94f9e");
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(ex, ey, Math.max(1, s * 0.014), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    // the lantern: rose cap with a gold bun on top, gold cage, amber glass and a flame
    const ly = top - s * 0.16, lw = s * 0.16, lh = s * 0.24;
    glow(ctx, x, ly, s * (0.8 + 0.25 * k + 0.3 * tap) * fl, "255,190,100", 0.7 + 0.2 * k);
    poly(ctx, [[x - lw * 0.55, ly + lh / 2], [x + lw * 0.55, ly + lh / 2], [x + lw * 0.45, ly + lh / 2 + s * 0.04], [x - lw * 0.45, ly + lh / 2 + s * 0.04]], "#ffd166");
    ctx.fillStyle = `rgba(255,${170 + 40 * k | 0},90,0.95)`; ctx.fillRect(x - lw / 2, ly - lh / 2, lw, lh);
    ctx.fillStyle = "#fff6d6"; ctx.beginPath();
    const fh = lh * (0.45 + 0.08 * Math.sin(t * 9) + 0.15 * tap);
    ctx.moveTo(x, ly + lh * 0.3 - fh); ctx.quadraticCurveTo(x + lw * 0.22, ly + lh * 0.15, x, ly + lh * 0.3); ctx.quadraticCurveTo(x - lw * 0.22, ly + lh * 0.15, x, ly + lh * 0.3 - fh); ctx.fill();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.014);
    ctx.strokeRect(x - lw / 2, ly - lh / 2, lw, lh); ctx.beginPath(); ctx.moveTo(x, ly - lh / 2); ctx.lineTo(x, ly + lh / 2); ctx.stroke();
    poly(ctx, [[x - lw * 0.7, ly - lh / 2], [x + lw * 0.7, ly - lh / 2], [x, ly - lh / 2 - s * 0.13]], "#d94f9e");
    poly(ctx, [[x - lw * 0.7, ly - lh / 2], [x, ly - lh / 2 - s * 0.13], [x - lw * 0.1, ly - lh / 2]], "#ff8fcf");
    const fy = ly - lh / 2 - s * 0.15;     // the gold bun finial
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(x, fy, s * 0.045, s * 0.032, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(x - s * 0.045, fy - s * 0.002, s * 0.09, s * 0.012);
    glow(ctx, x, fy - s * 0.01, s * 0.12, "255,214,120", 0.5 + 0.3 * Math.sin(t * 2));

    // two light-moths, amber and pink
    [["255,190,100", "#ffb04a"], ["255,130,200", "#ff6fc0"]].forEach(([rgb, wing], i) => {
      const a = t * (i ? -1.2 : 1.0) + i * 2.4, r = s * (0.42 + 0.08 * Math.sin(t * 0.7 + i));
      const mx = x + Math.cos(a) * r * 1.2, my = ly + Math.sin(a) * r * 0.55 + Math.sin(t * 3 + i) * s * 0.04;
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + i * 2)), w = s * 0.11, h = s * 0.08;
      glow(ctx, mx, my, s * 0.18, rgb, 0.4);
      poly(ctx, [[mx, my - h * 0.2], [mx - w * flap, my - h], [mx - w * flap * 0.8, my + h * 0.6], [mx, my + h * 0.3]], wing);
      poly(ctx, [[mx, my - h * 0.2], [mx + w * flap, my - h], [mx + w * flap * 0.8, my + h * 0.6], [mx, my + h * 0.3]], wing);
      ctx.fillStyle = "#fffdf0"; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.016, s * 0.045, 0, 0, TAU); ctx.fill();
    });
    if (tap > 0) for (let i = 0; i < 6; i++) {   // warm sparks lift off the lantern on a tap
      const f = (t * 0.7 + i / 6) % 1;
      glow(ctx, x + Math.sin(t * 2 + i * 1.9) * s * 0.3 * f, ly - lh / 2 - f * s * 0.5, s * 0.05, "255,214,140", tap * (1 - f));
    }
  };
})();
