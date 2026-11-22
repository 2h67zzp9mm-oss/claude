// Kindle's Grid: the East Road Lanterns (kind "roadlamps"). Tall honey-wood posts on a moss strip along the south edge
// of the east road, past the cooling shelf and on to where the road ends. Each has gold bands, a crook arm reaching out
// over the road and an amber lantern hanging from it that pools light on the stones. The last post (far east) is the
// tallest and carries a little board pointing back west with a painted honey bun: "bread this way".
// th.lamps: [[x, y], ...] absolute tile points (feet), ordered bakery -> east end.
// Kindling runs from the far east end back toward the bakery (the way in, shown to someone arriving): at dusk by the
// device clock every 10 s, on a tap, or when a walker steps onto the road past the cooling shelf. A walker beside a
// post makes it glow bigger. `?pose=way` holds the run halfway along. Loads after things.js (stub `roadlamps() {}`).
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
  function sky() {
    if (POSE === "way") return { dark: 0.8, dusk: true };
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return { dark: h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h), dusk: h >= 16.5 && h < 20 };
  }

  function lantern(ctx, cx, top, S, k, fl, f) {     // hanging amber lantern, top = hook point
    const lw = S * 0.09, lh = S * 0.16, y0 = top + S * 0.035, cy = y0 + lh * 0.55;
    glow(ctx, cx, cy, S * (0.22 + 0.14 * k), "255,190,100", 0.25 + 0.32 * k);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, S * 0.012);
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, y0 - S * 0.02); ctx.stroke();
    poly(ctx, [[cx, y0 - S * 0.035], [cx - lw * 1.3, y0 + S * 0.012], [cx + lw * 1.3, y0 + S * 0.012]], "#ffd166");
    poly(ctx, [[cx, y0 - S * 0.035], [cx + lw * 1.3, y0 + S * 0.012], [cx, y0 + S * 0.012]], "#e09a2b");
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, lh * 0.8);
    g.addColorStop(0, k > 1 ? "#fffbe6" : "#fff1b8"); g.addColorStop(0.45, "#ffc24a"); g.addColorStop(1, "#c96a1c");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - lw, y0 + S * 0.012); ctx.lineTo(cx + lw, y0 + S * 0.012);
    ctx.lineTo(cx + lw * 0.8, y0 + lh); ctx.lineTo(cx - lw * 0.8, y0 + lh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(224,154,43,0.9)"; ctx.lineWidth = Math.max(0.5, S * 0.008);
    ctx.beginPath(); ctx.moveTo(cx - lw * 0.33, y0 + S * 0.012); ctx.lineTo(cx - lw * 0.28, y0 + lh);
    ctx.moveTo(cx + lw * 0.33, y0 + S * 0.012); ctx.lineTo(cx + lw * 0.28, y0 + lh); ctx.stroke();
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(cx - lw * 0.95, y0 + lh - S * 0.006, lw * 1.9, S * 0.022);
    ctx.fillStyle = "#fffbe6";
    const fh = lh * (0.34 + 0.1 * fl + 0.18 * f);
    ctx.beginPath(); ctx.ellipse(cx, cy + lh * 0.08, lw * 0.3, fh * 0.5, 0, 0, TAU); ctx.fill();
  }

  function bunBoard(ctx, x, y, S, k) {             // little board pointing west, with a painted honey bun
    const w = S * 0.3, h = S * 0.12;
    poly(ctx, [[x - w * 0.62, y], [x - w * 0.42, y - h / 2], [x + w * 0.42, y - h / 2], [x + w * 0.42, y + h / 2], [x - w * 0.42, y + h / 2]], "#c9893f");
    poly(ctx, [[x - w * 0.62, y], [x - w * 0.42, y - h / 2], [x + w * 0.42, y - h / 2], [x + w * 0.42, y - h * 0.15], [x - w * 0.5, y - h * 0.15]], "#e2a95a");
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, S * 0.01);
    ctx.beginPath(); ctx.moveTo(x - w * 0.62, y); ctx.lineTo(x - w * 0.42, y - h / 2); ctx.lineTo(x + w * 0.42, y - h / 2);
    ctx.lineTo(x + w * 0.42, y + h / 2); ctx.lineTo(x - w * 0.42, y + h / 2); ctx.closePath(); ctx.stroke();
    const bx = x + w * 0.05, by = y + h * 0.05;
    glow(ctx, bx, by, S * 0.07, "255,200,110", 0.2 + 0.3 * k);
    ctx.fillStyle = "#f2b45a"; ctx.beginPath(); ctx.ellipse(bx, by, S * 0.045, S * 0.032, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#a8611f"; ctx.lineWidth = Math.max(0.5, S * 0.008);
    ctx.beginPath(); ctx.arc(bx, by, S * 0.018, 0.3, TAU - 0.6); ctx.stroke();
    ctx.strokeStyle = `rgba(255,246,214,${0.4 + 0.4 * k})`; ctx.lineWidth = Math.max(0.5, S * 0.008);   // a curl of steam
    ctx.beginPath(); ctx.moveTo(bx, by - S * 0.035); ctx.quadraticCurveTo(bx + S * 0.02, by - S * 0.05, bx, by - S * 0.065); ctx.stroke();
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.roadlamps = function roadlamps(ctx, x, y, s, t, th = {}) {
    const L = th.lamps; if (!L) return;
    const ox = x - s / 2 - th.x * s, oy = y - s / 2 - th.y * s;
    const at = (wx, wy) => [ox + wx * s, oy + wy * s];
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const pos = w => [(w.fx ?? w.x) + 0.5, (w.fy ?? w.y) + 0.5];
    const dist = (wx, wy) => Math.min(99, ...ws.map(w => { const [a, b] = pos(w); return Math.hypot(a - wx, b - wy); }));
    const { dark, dusk } = sky();

    // someone on the far stretch of road (past the cooling shelf) starts a run of light from the east end back in
    const onRoad = ws.some(w => { const [a, b] = pos(w); return a > 18.6 && a < 25.2 && b > 21.6 && b < 23.4; });
    if (onRoad && !th._was && !(t - (th._run ?? -99) < 4)) th._run = t;
    th._was = onRoad;
    if (th.tapped != null && th.tapped > (th._run ?? -99)) th._run = th.tapped;
    const runs = [t - (th._run ?? -99)];
    if (dusk) runs.push(POSE === "way" ? 0.95 : t % 10);
    const n = L.length;
    const flare = i => Math.max(0, ...runs.map(e => { const q = (e - (n - 1 - i) * 0.45) / 1.0; return q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0; }));

    const base = 0.45 + 0.55 * dark;
    L.forEach(([lx, ly], i) => {
      const last = i === n - 1;
      const nr = Math.max(0, 1 - dist(lx, ly - 0.4) / 1.3), f = flare(i);
      const fl = 0.85 + 0.1 * Math.sin(t * 6.7 + i * 1.9) + 0.05 * Math.sin(t * 12.3 + i);
      const k = Math.min(1.7, (base + 0.35 * nr + 0.75 * f) * fl);
      const S = s * 1.6;
      const [gx, gy] = at(lx, ly);
      const H = S * (last ? 1.02 : 0.9);
      const topY = gy - H;

      // light on the road stones and the moss
      const [px, py] = at(lx, ly - 0.42);
      pool(ctx, px, py, s * (0.5 + 0.14 * k), s * 0.24, "255,180,90", 0.14 + 0.22 * k);
      pool(ctx, gx, gy + S * 0.02, s * 0.3, s * 0.1, "255,190,110", 0.08 + 0.1 * k);

      // shadow, gold foot, honey post with gold bands
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(gx, gy, S * 0.07, S * 0.025, 0, 0, TAU); ctx.fill();
      const pw = S * 0.028;
      poly(ctx, [[gx - pw * 2, gy], [gx + pw * 2, gy], [gx + pw * 1.3, gy - S * 0.05], [gx - pw * 1.3, gy - S * 0.05]], "#e09a2b");
      ctx.fillStyle = "#c9893f"; ctx.fillRect(gx - pw, topY + S * 0.06, pw * 2, gy - S * 0.05 - topY - S * 0.06);
      ctx.fillStyle = "#e7ad62"; ctx.fillRect(gx - pw, topY + S * 0.06, pw * 0.8, gy - S * 0.05 - topY - S * 0.06);
      ctx.fillStyle = "#ffd166";
      [0.25, 0.55].forEach(q => ctx.fillRect(gx - pw * 1.2, gy - H * q, pw * 2.4, S * 0.018));

      // the crook arm, curling over the road side, with the lantern hanging from its tip
      ctx.strokeStyle = "#e09a2b"; ctx.lineWidth = Math.max(1, S * 0.026); ctx.lineCap = "round";
      const reach = S * 0.2;
      ctx.beginPath(); ctx.moveTo(gx, topY + S * 0.08);
      ctx.quadraticCurveTo(gx, topY - S * 0.05, gx + reach * 0.6, topY - S * 0.04);
      ctx.quadraticCurveTo(gx + reach, topY - S * 0.03, gx + reach, topY + S * 0.03); ctx.stroke();
      // a little gold star finial on top of the post
      const sx = gx, sy = topY + S * 0.02, sr = S * 0.035 * (1 + 0.25 * f);
      glow(ctx, sx, sy, S * 0.09, "255,220,140", 0.15 + 0.35 * f);
      ctx.fillStyle = "#ffe08a"; ctx.beginPath();
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? sr * 0.45 : sr; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();

      if (last) bunBoard(ctx, gx - S * 0.02, gy - H * 0.42, S, k);

      const hx = gx + reach, hy = topY + S * 0.03;
      const sw = Math.sin(t * 1.4 + i * 1.1) * 0.07 + f * 0.05 * Math.sin(t * 8);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw); ctx.translate(-hx, -hy);
      lantern(ctx, hx, hy, S, k, fl, f);
      ctx.restore();

      if (f > 0.3) { const q = (t * 1.3 + i * 0.41) % 1; glow(ctx, hx + Math.sin(q * 6 + i) * S * 0.05, hy - q * S * 0.4, S * 0.04 * (1 - q) + 1, "255,220,150", (1 - q) * f); }
    });
  };
})();
