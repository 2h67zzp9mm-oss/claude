// Kindle's Grid: the Doorstep Bench by the pink door of the Third Little House. Wraps GLINT_THINGS.bench so a bench
// with `wood: true` is drawn in warm honey wood: three seat planks with grain lines and knots, two back slats, a carved
// glowberry in the middle of the back rail, gold nail-heads, and two glowberry-pink cushions (room for two).
// Kindle sits on the left cushion (`seatX` in grid.js); the right one stays free and glows softly, waiting.
// Someone sitting, or a tap (th.tapped, 4 s), warms the wood: a light runs along the planks and pink sparks lift
// off the empty cushion. Loads after things.js.
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

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const base = T.bench;
  if (!base) return;

  // One plank of honey wood: lit top, darker front edge, grain lines, a knot.
  function plank(ctx, x0, x1, y, h, top, front, grain, knot) {
    poly(ctx, [[x0, y], [x1, y], [x1, y + h], [x0, y + h]], top);
    poly(ctx, [[x0, y + h], [x1, y + h], [x1, y + h * 1.45], [x0, y + h * 1.45]], front);
    ctx.strokeStyle = grain; ctx.lineWidth = Math.max(1, h * 0.12);
    ctx.beginPath();
    ctx.moveTo(x0 + h * 0.4, y + h * 0.35); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.3, y + h * 0.15, x0 + (x1 - x0) * 0.6, y + h * 0.6, x1 - h * 0.4, y + h * 0.4);
    ctx.stroke();
    if (knot != null) { ctx.fillStyle = grain; ctx.beginPath(); ctx.ellipse(x0 + (x1 - x0) * knot, y + h * 0.55, h * 0.28, h * 0.17, 0, 0, TAU); ctx.fill(); }
  }
  const PINK = { mid: "#ff78c4", light: "#ffb3de", dark: "#b3307f", rgb: "255,130,200", spark: "255,170,220", hi: "#ffd0ea" };
  const TEAL = { mid: "#27c9c2", light: "#9ff7ea", dark: "#127a80", rgb: "90,230,215", spark: "160,255,240", hi: "#e0fffa" };
  const NIGHT = { mid: "#3d6fd8", light: "#9cc4ff", dark: "#1f3a8a", rgb: "120,170,255", spark: "200,225,255", hi: "#dcebff" };   // the Star Lookout: night-blue with gold stars
  const VIOLET = { mid: "#9b6bff", light: "#c9a8ff", dark: "#5a36b8", rgb: "170,130,255", spark: "200,170,255", hi: "#ece0ff" };
  function cushion(ctx, cx, cy, w, h, lift, c = PINK) {
    poly(ctx, [[cx - w, cy], [cx - w * 0.85, cy - h - lift], [cx + w * 0.85, cy - h - lift], [cx + w, cy]], c.mid);
    poly(ctx, [[cx - w * 0.8, cy - h * 0.55 - lift], [cx - w * 0.7, cy - h - lift], [cx + w * 0.7, cy - h - lift], [cx + w * 0.8, cy - h * 0.55 - lift]], c.light);
    poly(ctx, [[cx - w, cy], [cx + w, cy], [cx + w * 0.96, cy + h * 0.35], [cx - w * 0.96, cy + h * 0.35]], c.dark);
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(cx, cy - h * 0.55 - lift, Math.max(1, h * 0.18), 0, TAU); ctx.fill();   // a gold button
  }

  // Teal Door Bench: how strongly the Teal Door Lantern above is shining on it (dusk, the Lamp Song reaching the lantern,
  // a tap on the bench). Same hum timing as things-tealamp.js, measured at that lantern's glass.
  const POSE = new URLSearchParams(location.search).get("pose");
  function lanternLight(th, t) {
    const L = (window.GLINT_WORLD?.things || []).find(k => k.kind === "tealamp");
    const lx = L ? L.x - 0.26 : th.x + 0.6, ly = L ? L.y + 0.31 : th.y - 0.1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const dark = h >= 19 || h < 6 ? 1 : h >= 17 ? (h - 17) / 2 : h < 7.5 ? (7.5 - h) / 1.5 : 0;
    let hum = 0;
    const S = window.GLINT_SONG;
    if (S && S.since < 90) { const u = S.since - Math.hypot(lx - S.bx, ly - S.by) * S.step; if (u > 0 && u < 2.4) hum = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 2.15; }
    if (L && L.tapped != null && t - L.tapped < 4) hum = Math.max(hum, Math.sin(Math.min(1, (t - L.tapped) / 4) * Math.PI));
    if (POSE === "tune" || POSE === "lit") hum = 1;
    return { dark, hum };
  }

  T.bench = function bench(ctx, x, y, s, t, th = {}) {
    if (!th.wood) return base(ctx, x, y, s, t, th);
    if (th.scale && !th._scaling) {   // drawn larger so it reads on a small screen, grown from its feet
      const by = y + s * 0.3;
      ctx.save(); ctx.translate(x, by); ctx.scale(th.scale, th.scale); ctx.translate(-x, -by);
      th._scaling = true;
      try { bench(ctx, x, y, s, t, th); } finally { th._scaling = false; ctx.restore(); }
      return;
    }
    const one = !!th.one, C = th.violet ? VIOLET : th.teal ? TEAL : PINK;   // `one`: a small bench with a single soft cushion
    const b = y + s * 0.3, w = s * (one ? 0.36 : 0.5), seat = b - s * 0.24, top = b - s * 0.54;
    const walkers = window.GLINT_GRID?.walkers || [];
    const sat = walkers.some(k => k.seated && k.bench === th);
    const e = th.tapped != null ? t - th.tapped : 99, tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    const warm = Math.max(tap, sat ? 0.6 : 0);
    const run = e >= 0 && e < 1.8 ? e / 1.8 : sat ? (t * 0.3) % 1 : -1;   // a warm light running along the planks

    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.02, s * 0.56, s * 0.1, 0, 0, TAU); ctx.fill();
    glow(ctx, x, seat, s * (0.75 + 0.2 * warm), "255,190,110", 0.18 + 0.06 * Math.sin(t * 1.1) + 0.3 * warm);
    let LL = null;
    if (th.teal) {   // the Teal Door Lantern's light falls on the bench: a soft teal cone from above, a pool on the seat
      LL = lanternLight(th, t);
      const a = 0.16 + 0.12 * LL.dark + 0.35 * LL.hum + 0.04 * Math.sin(t * 1.3);
      const ax = x + s * (th.beamX ?? 0.2), ay = b - s * 1.25, g = ctx.createLinearGradient(ax, ay, ax, b);
      g.addColorStop(0, `rgba(${C.rgb},${a * 0.9})`); g.addColorStop(1, `rgba(${C.rgb},0)`);
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(ax - s * 0.05, ay); ctx.lineTo(ax + s * 0.05, ay); ctx.lineTo(x + w * 1.3, b); ctx.lineTo(x - w * 1.3, b); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      glow(ctx, x, b - s * 0.02, s * 0.6, C.rgb, a * 1.3);
    }

    // back legs / posts, rounded at the top
    for (const d of [-1, 1]) {
      const px = x + d * w * 0.86;
      poly(ctx, [[px - s * 0.035, b - s * 0.1], [px - s * 0.035, top], [px + s * 0.035, top], [px + s * 0.035, b - s * 0.1]], "#8a4f24");
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(px - s * 0.035, top, s * 0.025, b - top - s * 0.12);
      ctx.fillStyle = "#e0a05a"; ctx.beginPath(); ctx.arc(px, top, s * 0.045, 0, TAU); ctx.fill();
    }
    // two back slats and a carved glowberry in the middle of the top rail
    plank(ctx, x - w * 0.95, x + w * 0.95, top + s * 0.02, s * 0.075, "#e0a05a", "#9c5a28", "#a8642e", 0.72);
    plank(ctx, x - w * 0.95, x + w * 0.95, top + s * 0.15, s * 0.065, "#d39248", "#8a4f24", "#9c5a28", 0.2);
    for (const d of [-1, 1]) for (const ry of [0.06, 0.18]) { ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x + d * w * 0.86, top + s * ry, Math.max(1, s * 0.014), 0, TAU); ctx.fill(); }
    const by = top + s * 0.06, pulse = 0.6 + 0.4 * Math.sin(t * 1.6);
    glow(ctx, x, by, s * (0.16 + 0.08 * warm), C.rgb, 0.5 * pulse + 0.4 * warm);
    ctx.fillStyle = C.mid; ctx.beginPath(); ctx.arc(x, by, s * 0.055, 0, TAU); ctx.fill();
    ctx.fillStyle = C.hi; ctx.beginPath(); ctx.arc(x - s * 0.018, by - s * 0.018, s * 0.018, 0, TAU); ctx.fill();
    poly(ctx, [[x, by - s * 0.05], [x + s * 0.06, by - s * 0.09], [x + s * 0.02, by - s * 0.04]], "#35e8a8");   // its leaf

    // seat: three planks seen from above, then the front edge
    const sw = w * 1.06;
    plank(ctx, x - sw * 0.97, x + sw * 0.97, seat - s * 0.11, s * 0.04, "#d39248", "#b06a32", "#a8642e", 0.35);
    plank(ctx, x - sw * 0.985, x + sw * 0.985, seat - s * 0.065, s * 0.04, "#e0a05a", "#b06a32", "#b8763a", null);
    plank(ctx, x - sw, x + sw, seat - s * 0.02, s * 0.05, "#eab06a", "#8a4f24", "#b8763a", 0.8);
    if (run >= 0) glow(ctx, x - sw + sw * 2 * run, seat, s * 0.22, "255,230,160", 0.9 * Math.sin(run * Math.PI));
    // front legs with gold feet
    for (const d of [-1, 1]) {
      const lx = x + d * w * 0.88;
      ctx.fillStyle = "#8a4f24"; ctx.fillRect(lx - s * 0.035, seat + s * 0.05, s * 0.07, b - seat - s * 0.07);
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(lx - s * 0.035, seat + s * 0.05, s * 0.022, b - seat - s * 0.07);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - s * 0.05, b - s * 0.03, s * 0.1, s * 0.04);
    }
    const cw = w * 0.42, ch = s * 0.065, wait = 0.5 + 0.5 * Math.sin(t * 1.4);
    if (LL) {
      glow(ctx, x, seat - s * 0.05, s * (0.45 + 0.15 * LL.hum), C.rgb, 0.15 + 0.1 * LL.dark + 0.45 * LL.hum);
      if (LL.hum > 0.05) for (let i = 0; i < 4; i++) {   // little teal motes drift down from the lantern onto the cushion
        const f = (t * 0.6 + i / 4) % 1;
        glow(ctx, x + s * 0.2 - f * s * 0.2 + Math.sin(t * 3 + i * 1.7) * s * 0.06, seat - s * 0.75 + f * s * 0.62, s * 0.045, C.spark, LL.hum * Math.sin(f * Math.PI));
      }
    }
    if (one) {
      // one soft cushion, plumper than the pink ones, in the middle of the seat. Empty, it breathes a soft light, waiting.
      const cx = x, lift = sat ? 0 : s * 0.008 * wait;
      if (!sat) glow(ctx, cx, seat - s * 0.06, s * 0.3, C.rgb, 0.24 + 0.2 * wait + 0.35 * warm);
      cushion(ctx, cx, seat - s * 0.03, w * 0.78, s * 0.085, lift, C);
      ctx.strokeStyle = C.dark; ctx.lineWidth = Math.max(1, s * 0.012);   // a stitched seam across the top
      ctx.beginPath(); ctx.moveTo(cx - w * 0.5, seat - s * 0.09 - lift); ctx.lineTo(cx + w * 0.5, seat - s * 0.09 - lift); ctx.stroke();
      for (const d of [-1, 1]) {   // gold tassels at the two front corners
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(cx + d * w * 0.74, seat + s * 0.0, Math.max(1, s * 0.018), 0, TAU); ctx.fill();
        ctx.fillRect(cx + d * w * 0.74 - s * 0.006, seat, s * 0.012, s * 0.05);
      }
      if (warm > 0) for (let i = 0; i < 5; i++) {
        const f = (t * 0.5 + i / 5) % 1;
        glow(ctx, cx + Math.sin(t * 2 + i * 2.3) * s * 0.12 * f, seat - s * 0.1 - f * s * 0.45, s * 0.06, C.spark, warm * (1 - f));
      }
      return;
    }
    // two cushions: room for two. The free one breathes a soft light, waiting. (`night`: night-blue with a gold star each)
    const P2 = th.night ? NIGHT : PINK;
    cushion(ctx, x - w * 0.47, seat - s * 0.03, cw, ch, 0, P2);
    glow(ctx, x + w * 0.47, seat - s * 0.06, s * 0.28, P2.rgb, 0.22 + 0.2 * wait + 0.35 * warm);
    cushion(ctx, x + w * 0.47, seat - s * 0.03, cw, ch, s * 0.008 * wait, P2);
    if (th.night) for (const d of [-1, 1]) {   // a little gold star stitched on each
      const sx = x + d * w * 0.47, sy = seat - s * 0.075 - (d > 0 ? s * 0.008 * wait : 0), r = s * 0.028;
      glow(ctx, sx, sy, s * 0.07, "255,214,120", d > 0 ? 0.3 + 0.3 * wait : 0.2);
      ctx.fillStyle = "#ffd166"; ctx.beginPath();
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? r * 0.45 : r; ctx.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); }
      ctx.closePath(); ctx.fill();
    }
    if (th.blanket) {   // a woolly blanket folded over the left end of the back rail, for cold clear nights; its fringe stirs in the breeze
      const bx0 = x - w * 0.95, bx1 = x - w * 0.25, by0 = top - s * 0.01, by1 = top + s * 0.27;
      poly(ctx, [[bx0, by0], [bx1, by0 + s * 0.01], [bx1 + s * 0.02, by1], [bx0 - s * 0.02, by1 - s * 0.01]], "#e8e2f4");
      ctx.fillStyle = "#c9a8ff"; ctx.fillRect(bx0, by0 + s * 0.07, bx1 - bx0 + s * 0.01, s * 0.03);   // violet and teal stripes
      ctx.fillStyle = "#27c9c2"; ctx.fillRect(bx0 - s * 0.01, by0 + s * 0.15, bx1 - bx0 + s * 0.02, s * 0.03);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(bx0 + s * 0.02, by0 + s * 0.01, bx1 - bx0 - s * 0.04, s * 0.025);
      const wh = window.GLINT_WIND ? window.GLINT_WIND(t) : 3.4, blow = Math.cos(wh) * s * 0.03;
      ctx.strokeStyle = "#d8d0ea"; ctx.lineWidth = Math.max(1, s * 0.012);
      for (let i = 0; i <= 6; i++) {
        const fx = bx0 - s * 0.02 + (bx1 - bx0 + s * 0.04) * i / 6, fy = by1 - s * 0.005 * (6 - i) / 6;
        const sway = blow * (0.6 + 0.4 * Math.sin(t * 5 + i * 1.3));
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + sway, fy + s * 0.05); ctx.stroke();
      }
    }
    if (warm > 0) for (let i = 0; i < 5; i++) {               // sparks lift off the empty cushion
      const f = (t * 0.5 + i / 5) % 1;
      glow(ctx, x + w * 0.47 + Math.sin(t * 2 + i * 2.3) * s * 0.12 * f, seat - s * 0.08 - f * s * 0.45, s * 0.06, P2.spark, warm * (1 - f));
    }
  };
})();
