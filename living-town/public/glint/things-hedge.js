// Kindle's Grid: the Glowing Hedge. A low hedge of crystal leaves with glowing flowers along its top, laid along the
// edge of the road from the East Gate Tree's flower ring, along the front of the Crystal Bench (with a gap to step
// through, marked by two little gem posts) and up the east side of Lantern Street to the arch post.
// th.hedge: [[x, y], ...] absolute tile points (n+0.5 = tile centre). th.gap: [x0, x1] gap on the first stretch.
// Flowers near a walker (1.3 tiles) brighten and open; a tap, or the arch lighting up, runs a wave of light along it
// from the tree to the arch and lifts petals. Drawn in the hedge's own sort slot (th.y between the bench and the road).
(() => {
  const TAU = Math.PI * 2;
  const COLS = [["255,140,205", "#ff8fd0"], ["120,225,255", "#7fe6ff"], ["255,214,120", "#ffd166"], ["190,150,255", "#b48cff"]];
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function gem(ctx, x, y, w, h, light, mid, dark) {
    poly(ctx, [[x, y - h], [x - w, y], [x, y]], light); poly(ctx, [[x, y - h], [x + w, y], [x, y]], mid);
    poly(ctx, [[x, y + h], [x - w, y], [x, y]], mid); poly(ctx, [[x, y + h], [x + w, y], [x, y]], dark);
  }
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  // Sample the hedge line every `step` tiles: [x, y, distance along, index].
  function samples(th, step) {
    if (th._samp) return th._samp;
    const out = [], P = th.hedge; let along = 0, i = 0;
    for (let k = 0; k < P.length - 1; k++) {
      const [ax, ay] = P[k], [bx, by] = P[k + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
      for (let j = (k ? 1 : 0); j <= n; j++) {
        const f = j / n, x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
        if (!(k === 0 && th.gap && x > th.gap[0] && x < th.gap[1])) out.push([x, y, along + len * f, i]);
        i++;
      }
      along += len;
    }
    th._len = along;
    return (th._samp = out);
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.hedge = function hedge(ctx, x, y, s, t, th = {}) {
    if (!th.hedge) return;
    const ox = x - s / 2 - th.x * s, oy = y - s / 2 - th.y * s;      // world tile point -> screen
    const at = (wx, wy) => [ox + wx * s, oy + wy * s];
    const walkers = window.GLINT_GRID?.walkers || [];
    const arch = (window.GLINT_WORLD?.things || []).find(k => k.kind === "arch");
    const own = th.tapped != null ? t - th.tapped : 99, fromArch = arch?.tapped != null ? t - arch.tapped : 99;
    const e = Math.min(own, fromArch);                                // the wave runs for ~3 s, tree to arch
    const pts = samples(th, 0.1), L = th._len || 1;
    const wave = d => { if (!(e >= 0 && e < 3)) return 0; const front = e / 2.2 * (L + 0.6); const q = (front - d) / 0.5; return q > 0 && q < 2 ? Math.sin(q * Math.PI / 2) : 0; };
    const near = (wx, wy) => { let m = 99; for (const w of walkers) m = Math.min(m, Math.hypot((w.fx ?? w.x) + 0.5 - wx, (w.fy ?? w.y) + 0.5 - wy)); return Math.max(0, 1 - m / 1.3); };
    const hH = s * 0.3, rr = s * 0.13;

    // a soft glow on the ground under the whole hedge
    for (let k = 0; k < pts.length; k += 3) { const [px, py] = at(pts[k][0], pts[k][1]); glow(ctx, px, py, s * 0.32, "110,255,200", 0.08 + 0.05 * Math.sin(t + k)); }

    // leaves: mounds of crystal leaves, back (small y) to front
    const order = [...pts].sort((a, b) => a[1] - b[1]);
    for (const [wx, wy, d, i] of order) {
      const [px, py] = at(wx, wy), h = hH * (0.85 + 0.3 * hash(i)), sway = Math.sin(t * 1.4 + i * 0.7) * s * 0.008;
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(px, py + s * 0.02, rr * 1.2, rr * 0.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#137a70"; ctx.beginPath(); ctx.ellipse(px + sway, py - h * 0.45, rr * 1.1, h * 0.62, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#2cc4ac"; ctx.beginPath(); ctx.ellipse(px - rr * 0.25 + sway, py - h * 0.62, rr * 0.8, h * 0.45, 0, 0, TAU); ctx.fill();
      poly(ctx, [[px - rr * 0.6 + sway, py - h * 0.75], [px - rr * 0.1 + sway, py - h * 1.05], [px + rr * 0.2 + sway, py - h * 0.7]], "#4fe0bd");   // a crystal leaf catching the light
      const lit = wave(d);
      if (lit) glow(ctx, px, py - h * 0.5, s * 0.22, "180,255,230", 0.55 * lit);
    }

    // flowers along the top, every other sample, each its own colour, bobbing and opening when someone is near
    for (const [wx, wy, d, i] of order) {
      if (i % 2) continue;
      const [px, py] = at(wx, wy), [rgb, col] = COLS[(i / 2) % 4 | 0], lit = wave(d), nr = near(wx, wy);
      const open = 0.75 + 0.35 * nr + 0.4 * lit, h = hH * (0.85 + 0.3 * hash(i));
      const fx = px + Math.sin(t * 1.4 + i * 0.7) * s * 0.01 + (hash(i + 9) - 0.5) * s * 0.04;
      const fy = py - h * 1.02 - Math.sin(t * 2 + i) * s * 0.008 - lit * s * 0.04;
      glow(ctx, fx, fy, s * (0.12 + 0.08 * nr + 0.12 * lit), rgb, 0.3 + 0.15 * Math.sin(t * 1.7 + i * 1.3) + 0.3 * nr + 0.5 * lit);
      const pr = s * 0.048 * open;
      ctx.fillStyle = col;
      for (let p = 0; p < 5; p++) { const a = p * TAU / 5 + i; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * pr, fy + Math.sin(a) * pr * 0.7, pr * 0.85, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(fx, fy, pr * 0.6, 0, TAU); ctx.fill();
      if (lit > 0.6) {   // the wave shakes a petal loose
        const f = (e * 1.3 + hash(i)) % 1;
        glow(ctx, fx + Math.sin(f * 5 + i) * s * 0.06, fy - f * s * 0.4, s * 0.05 * (1 - f) + 1, rgb, 1 - f);
      }
    }

    // two little gem posts either side of the gap in front of the bench
    if (th.gap) for (const gx of th.gap) {
      const [px, py] = at(gx, th.hedge[0][1]), on = Math.max(near(gx, th.hedge[0][1]), wave(Math.abs(th.hedge[0][0] - gx)));
      ctx.fillStyle = "#ffd166"; ctx.fillRect(px - s * 0.025, py - s * 0.05, s * 0.05, s * 0.05);
      poly(ctx, [[px - s * 0.02, py - s * 0.05], [px - s * 0.02, py - s * 0.16], [px, py - s * 0.19], [px, py - s * 0.05]], "#7dffd2");
      poly(ctx, [[px, py - s * 0.05], [px, py - s * 0.19], [px + s * 0.02, py - s * 0.16], [px + s * 0.02, py - s * 0.05]], "#1f9f9a");
      gem(ctx, px, py - s * 0.22, s * 0.035, s * 0.05, "#fff6d6", "#ffd166", "#e09a2b");
      glow(ctx, px, py - s * 0.22, s * (0.14 + 0.1 * on), "255,214,120", 0.55 + 0.25 * Math.sin(t * 2.2 + gx * 3) + 0.4 * on);
    }
  };
})();
