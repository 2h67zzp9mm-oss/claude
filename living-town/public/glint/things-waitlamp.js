// Kindle's Grid: the Waiting Lamp (kind "waitlamp"). A slim honey-wood post just east of the Violet Door Bench, with a
// gold crook curling back west over the bench and a violet-glass lantern (amber flame) hanging above the cushion.
// States: low ember by day, brighter after dark (device clock); "listening" while any traveler walker is in the Grid
// (a little spark drifts up from the lantern every few seconds, like a call); "welcome" when a walker (traveler or
// Kindle) is within ~1.6 of the bench: flame swells, light pools on the cushion and a ring of violet glints circles.
// Tap flares it for 5 s. `?pose=listen` holds the welcome state. Loads after things.js (stub `waitlamp() {}`).
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
  function pool(ctx, x, y, rx, ry, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); glow(ctx, 0, 0, rx, rgb, a); ctx.restore();
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  const POSE = new URLSearchParams(location.search).get("pose");
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  function darkness() {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  }

  function lantern(ctx, cx, top, S, k, fl, w) {    // violet glass, gold cap, amber flame
    const lw = S * 0.085, lh = S * 0.17, y0 = top + S * 0.03, cy = y0 + lh * 0.55;
    glow(ctx, cx, cy, S * (0.2 + 0.14 * k), "170,110,255", 0.3 + 0.3 * k);
    glow(ctx, cx, cy, S * (0.07 + 0.05 * k), "255,200,120", 0.15 + 0.2 * k);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, S * 0.012);
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, y0 - S * 0.02); ctx.stroke();
    // little dome cap with a ring on top
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(cx, y0 + S * 0.01, lw * 1.25, S * 0.035, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(cx - lw * 1.25, y0 + S * 0.006, lw * 2.5, S * 0.014);
    // glass: violet, warm in the middle
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, lh * 0.85);
    g.addColorStop(0, "#f4e6ff"); g.addColorStop(0.22, "#c9a0ff"); g.addColorStop(0.7, "#8a5ce8"); g.addColorStop(1, "#5a36b8");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - lw, y0 + S * 0.02); ctx.lineTo(cx + lw, y0 + S * 0.02);
    ctx.quadraticCurveTo(cx + lw * 1.15, cy, cx + lw * 0.75, y0 + lh); ctx.lineTo(cx - lw * 0.75, y0 + lh);
    ctx.quadraticCurveTo(cx - lw * 1.15, cy, cx - lw, y0 + S * 0.02); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,209,102,0.85)"; ctx.lineWidth = Math.max(0.5, S * 0.008);
    ctx.beginPath(); ctx.moveTo(cx, y0 + S * 0.02); ctx.lineTo(cx, y0 + lh); ctx.stroke();
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(cx - lw * 0.85, y0 + lh - S * 0.004, lw * 1.7, S * 0.02);
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(cx, y0 + lh + S * 0.03, S * 0.012, 0, TAU); ctx.fill();   // gold drop
    // the flame
    const fh = lh * (0.3 + 0.08 * fl + 0.16 * w);
    ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.ellipse(cx, cy + lh * 0.1, lw * 0.32, fh * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffbe6"; ctx.beginPath(); ctx.ellipse(cx, cy + lh * 0.14, lw * 0.18, fh * 0.36, 0, 0, TAU); ctx.fill();
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.waitlamp = function waitlamp(ctx, x, y, s, t, th = {}) {
    const ox = x - s / 2 - th.x * s, oy = y - s / 2 - th.y * s;
    const at = (wx, wy) => [ox + wx * s, oy + wy * s];
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const pos = w => [(w.fx ?? w.x) + 0.5, (w.fy ?? w.y) + 0.5];
    const B = th.seat || [11.4, 17.7];
    const near = Math.min(99, ...ws.map(w => { const [a, b] = pos(w); return Math.hypot(a - B[0], b - B[1]); }));
    const listening = POSE === "listen" || ws.some(w => w.kind === "traveler");
    const tap = th.tapped != null && t - th.tapped < 5 ? Math.sin(Math.min(1, (t - th.tapped) / 5) * Math.PI) : 0;
    const want = POSE === "listen" ? 1 : Math.max(tap, Math.max(0, 1 - near / 1.6));
    th._w = (th._w ?? 0) + (want - (th._w ?? 0)) * 0.06;
    const w = th._w, dark = POSE === "listen" ? 0.8 : darkness();
    const fl = 0.86 + 0.09 * Math.sin(t * 6.1) + 0.05 * Math.sin(t * 13.7);
    const k = Math.min(1.7, (0.4 + 0.45 * dark + (listening ? 0.15 : 0) + 0.7 * w) * fl);

    const S = s * (th.scale || 1.85);
    const [gx, gy] = at(th.foot?.[0] ?? th.x, th.foot?.[1] ?? th.y);
    const H = S * 0.82, topY = gy - H, reach = -S * 0.22;
    const hx = gx + reach, hy = topY + S * 0.03;

    // light on the cushion and the stones
    const [px, py] = at(B[0] - 0.1, B[1] - 0.15);
    pool(ctx, px, py, s * (0.45 + 0.2 * k), s * 0.22, "210,160,255", 0.1 + 0.16 * k);
    pool(ctx, px, py, s * (0.25 + 0.1 * k), s * 0.12, "255,190,110", 0.06 + 0.14 * k);

    // shadow, gold foot, slim honey post with gold bands and a carved glowberry
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(gx, gy, S * 0.06, S * 0.022, 0, 0, TAU); ctx.fill();
    const pw = S * 0.024;
    poly(ctx, [[gx - pw * 2, gy], [gx + pw * 2, gy], [gx + pw * 1.2, gy - S * 0.045], [gx - pw * 1.2, gy - S * 0.045]], "#e09a2b");
    ctx.fillStyle = "#c9893f"; ctx.fillRect(gx - pw, topY + S * 0.05, pw * 2, gy - S * 0.045 - topY - S * 0.05);
    ctx.fillStyle = "#e7ad62"; ctx.fillRect(gx - pw, topY + S * 0.05, pw * 0.8, gy - S * 0.045 - topY - S * 0.05);
    ctx.fillStyle = "#ffd166"; [0.22, 0.6].forEach(q => ctx.fillRect(gx - pw * 1.2, gy - H * q, pw * 2.4, S * 0.016));
    const by = gy - H * 0.41;
    glow(ctx, gx, by, S * 0.05, "190,140,255", 0.15 + 0.25 * k);
    ctx.fillStyle = "#9b6bff"; ctx.beginPath(); ctx.arc(gx, by, S * 0.022, 0, TAU); ctx.fill();
    ctx.fillStyle = "#e3ccff"; ctx.beginPath(); ctx.arc(gx - S * 0.007, by - S * 0.007, S * 0.007, 0, TAU); ctx.fill();

    // the crook, curling west over the bench
    ctx.strokeStyle = "#e09a2b"; ctx.lineWidth = Math.max(1, S * 0.022); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(gx, topY + S * 0.07);
    ctx.quadraticCurveTo(gx, topY - S * 0.05, gx + reach * 0.6, topY - S * 0.04);
    ctx.quadraticCurveTo(gx + reach, topY - S * 0.03, hx, hy); ctx.stroke();
    // gold curl at the top of the post
    ctx.lineWidth = Math.max(0.8, S * 0.014);
    ctx.beginPath(); ctx.arc(gx + S * 0.025, topY + S * 0.02, S * 0.022, Math.PI, TAU * 0.95); ctx.stroke();

    const sw = Math.sin(t * 1.2) * 0.06 + w * 0.04 * Math.sin(t * 5);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw); ctx.translate(-hx, -hy);
    lantern(ctx, hx, hy, S, k, fl, w);
    ctx.restore();

    // listening: a small violet spark drifts up from the lantern every few seconds, like a call down the street
    if (listening) {
      const q = (t / 3.2) % 1;
      if (q < 0.7) { const e = q / 0.7; glow(ctx, hx + Math.sin(e * 5) * S * 0.04, hy - e * S * 0.5, S * 0.035 * (1 - e) + 1.2, "220,180,255", (1 - e) * 0.9); }
    }
    // welcome: violet glints circle the lantern
    if (w > 0.15) for (let j = 0; j < 4; j++) {
      const a = t * 1.6 + j * TAU / 4, cyl = hy + S * 0.1;
      glow(ctx, hx + Math.cos(a) * S * 0.14, cyl + Math.sin(a) * S * 0.05, S * 0.03 + 1, j % 2 ? "255,210,130" : "210,170,255", w * 0.85);
    }
  };
})();
