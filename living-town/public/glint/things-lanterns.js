// Kindle's Grid: the Hedge Lanterns (kind "hedgelamps"). A row of little amber lanterns on gold shepherd's-crook stakes,
// standing in the Glowing Hedge from the East Gate Tree, along the east road and up Lantern Street to the arch post.
// th.lamps: [[x, y, side], ...] absolute tile points (n+0.5 = tile centre), ordered tree -> arch. side "s" throws its
// pool of light south onto the east road, "w" west onto Lantern Street.
// Always lit softly; brighter after dark by the clock (dusk 16:30-18:30 ramps up, dawn 6:00-8:00 ramps down). At dusk
// they kindle one after another, tree to arch, every few seconds. A tap, or a walker coming near the row, runs the same
// kindling along them. Someone standing beside one makes it glow bigger. `?pose=dusk` holds the kindling halfway along.
// Drawn in its own sort slot (th.y just after the east hedge). Loads after things.js (stub `hedgelamps() {}`).
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
  function pool(ctx, x, y, rx, ry, rgb, a) {   // a flat oval of light on the ground
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    glow(ctx, 0, 0, rx, rgb, a);
    ctx.restore();
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  const POSE = new URLSearchParams(location.search).get("pose");
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };

  // how dark it is by the clock, 0 (day) .. 1 (night), and whether it's dusk (the time they kindle on their own)
  function sky() {
    if (POSE === "dusk") return { dark: 0.8, dusk: true };
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const dark = h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
    return { dark, dusk: h >= 16.5 && h < 19.5 };
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.hedgelamps = function hedgelamps(ctx, x, y, s, t, th = {}) {
    const L = th.lamps; if (!L) return;
    const ox = x - s / 2 - th.x * s, oy = y - s / 2 - th.y * s;
    const at = (wx, wy) => [ox + wx * s, oy + wy * s];
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const dist = (wx, wy) => Math.min(99, ...ws.map(w => Math.hypot((w.fx ?? w.x) + 0.5 - wx, (w.fy ?? w.y) + 0.5 - wy)));
    const { dark, dusk } = sky();

    // the kindling: a run of light from the tree to the arch. Started by a tap, by someone arriving near the row,
    // and on its own every 9 s at dusk.
    const anyNear = L.some(([lx, ly]) => dist(lx, ly) < 1.2);
    if (anyNear && !th._was && !(t - (th._run ?? -99) < 3)) th._run = t;
    th._was = anyNear;
    if (th.tapped != null && th.tapped > (th._run ?? -99)) th._run = th.tapped;
    const runs = [t - (th._run ?? -99)];
    if (dusk) runs.push(POSE === "dusk" ? 0.75 : t % 9);
    const flare = i => Math.max(0, ...runs.map(e => { const q = (e - i * 0.32) / 0.9; return q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0; }));

    const base = 0.4 + 0.6 * dark;
    L.forEach(([lx, ly, side], i) => {
      const nr = Math.max(0, 1 - dist(lx, ly) / 1.3), f = flare(i);
      const fl = 0.85 + 0.1 * Math.sin(t * 7.3 + i * 2.1) + 0.05 * Math.sin(t * 13.1 + i);   // the flame flickers
      const k = Math.min(1.6, (base + 0.35 * nr + 0.7 * f) * fl);
      const [gx, gy] = at(lx, ly);
      const S = s * 1.75;
      const H = S * 0.5, hx = gx + S * 0.1, hy = gy - H + S * 0.07;          // crook top; the lantern hangs from its tip
      const ly0 = hy + S * 0.04, lw = S * 0.075, lh = S * 0.12;            // lantern body top, half width, height
      const cy = ly0 + lh * 0.55;

      // warm pool of light on the road beside the hedge (this is what makes the east road glow)
      const [px, py] = side === "w" ? at(lx - 0.38, ly + 0.05) : at(lx + 0.02, ly + 0.36);
      pool(ctx, px, py, s * (0.42 + 0.12 * k), s * 0.2, "255,180,90", 0.16 + 0.22 * k);

      // the stake: a thin gold rod with a crook at the top
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(gx, gy + S * 0.01, S * 0.05, S * 0.018, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#e09a2b"; ctx.lineWidth = Math.max(1, S * 0.028); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - H + S * 0.04);
      ctx.quadraticCurveTo(gx, gy - H - S * 0.02, gx + S * 0.06, gy - H - S * 0.015);
      ctx.quadraticCurveTo(hx, gy - H - S * 0.01, hx, hy); ctx.stroke();
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, S * 0.012);
      ctx.beginPath(); ctx.moveTo(gx - S * 0.006, gy - S * 0.02); ctx.lineTo(gx - S * 0.006, gy - H + S * 0.05); ctx.stroke();

      // the lantern swings a little on its hook
      const sw = Math.sin(t * 1.6 + i * 1.3) * 0.08 + f * 0.05 * Math.sin(t * 9);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw); ctx.translate(-hx, -hy);
      const lx2 = hx;
      glow(ctx, lx2, cy, S * (0.2 + 0.12 * k), "255,190,100", 0.25 + 0.3 * k);
      // little ring and cap
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, S * 0.012);
      ctx.beginPath(); ctx.arc(lx2, hy + S * 0.012, S * 0.014, 0, TAU); ctx.stroke();
      poly(ctx, [[lx2, ly0 - S * 0.03], [lx2 - lw * 1.2, ly0 + S * 0.012], [lx2 + lw * 1.2, ly0 + S * 0.012]], "#ffd166");
      poly(ctx, [[lx2, ly0 - S * 0.03], [lx2 + lw * 1.2, ly0 + S * 0.012], [lx2, ly0 + S * 0.012]], "#e09a2b");
      // amber glass, brighter in the middle
      const g = ctx.createRadialGradient(lx2, cy, 0, lx2, cy, lh * 0.75);
      g.addColorStop(0, k > 1 ? "#fffbe6" : "#fff1b8"); g.addColorStop(0.45, "#ffc24a"); g.addColorStop(1, "#c96a1c");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(lx2 - lw, ly0 + S * 0.012); ctx.lineTo(lx2 + lw, ly0 + S * 0.012);
      ctx.quadraticCurveTo(lx2 + lw * 1.25, cy, lx2 + lw * 0.85, ly0 + lh); ctx.lineTo(lx2 - lw * 0.85, ly0 + lh);
      ctx.quadraticCurveTo(lx2 - lw * 1.25, cy, lx2 - lw, ly0 + S * 0.012); ctx.fill();
      // gold ribs and base
      ctx.strokeStyle = "rgba(224,154,43,0.9)"; ctx.lineWidth = Math.max(0.5, S * 0.008);
      ctx.beginPath(); ctx.moveTo(lx2, ly0 + S * 0.012); ctx.lineTo(lx2, ly0 + lh); ctx.stroke();
      ctx.fillStyle = "#e09a2b"; ctx.fillRect(lx2 - lw * 0.95, ly0 + lh - S * 0.005, lw * 1.9, S * 0.02);
      // the flame
      const fh = lh * (0.35 + 0.1 * fl + 0.15 * f);
      ctx.fillStyle = "#fffbe6";
      ctx.beginPath(); ctx.ellipse(lx2, cy + lh * 0.08, lw * 0.32, fh * 0.5, 0, 0, TAU); ctx.fill();
      ctx.restore();

      // a spark lifts when it kindles
      if (f > 0.3) { const q = (t * 1.4 + i * 0.37) % 1; glow(ctx, hx + Math.sin(q * 6 + i) * S * 0.04, ly0 - q * S * 0.35, S * 0.04 * (1 - q) + 1, "255,220,150", (1 - q) * f); }
    });
  };
})();
