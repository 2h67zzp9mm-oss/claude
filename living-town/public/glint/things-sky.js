// Kindle's Grid: the Lantern Sky. Small stars high in the dark sky on both sides of Lantern Street (no threads: they are
// far up, unlike the Lantern Stars), and seven of them in the shape of a lantern over the dark ground south-east of the arch.
// th.sky: [[x, y, size, colour]] absolute tile spots. th.lantern: [[x, y, size, colour]] the lantern's stars,
// th.lines: [[i, j], ...] pairs of lantern stars to join, th.flame: [x, y] the gold heart of the lantern.
// Every star twinkles on its own and now and then flashes a little cross. When someone stands under the Welcome Arch
// (the arch lights up), or a star is touched, faint lines of light join the lantern stars one after another and its
// flame glows; they stay while someone waits under the arch and fade a while after. `?pose=sky` holds them lit.
(() => {
  const TAU = Math.PI * 2;
  const C = [["220,235,255", "#f4f8ff"], ["255,220,140", "#fff1c4"], ["150,235,255", "#dcfaff"], ["255,170,215", "#ffe0f0"]];
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  // one small four-pointed star; b = brightness (about 0.5-1.6)
  function star(ctx, sx, sy, R, ci, b, spin) {
    glow(ctx, sx, sy, R * (2 + 0.8 * b), C[ci][0], 0.18 + 0.22 * Math.min(1.4, b));
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(spin);
    ctx.fillStyle = C[ci][1]; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? R * 0.32 : R; k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  const OVER = window.GLINT_OVER = window.GLINT_OVER || {};
  window.GLINT_THINGS.skystars = function () {};   // drawn on top of everything (they are high up), by GLINT_OVER.skystars
  OVER.skystars = function (ctx, x, y, s, t, th) {
    const arch = (window.GLINT_WORLD.things || []).find(k => k.kind === "arch"), walkers = window.GLINT_GRID?.walkers || [];
    const pose = /[?&]pose=sky\b/.test(location.search);
    const since = Math.min(arch && arch.tapped != null ? t - arch.tapped : 99, th.tapped != null ? t - th.tapped : 99);
    const want = pose || since < 6;
    const dt = Math.min(0.1, Math.max(0, t - (th._t ?? t))); th._t = t;
    if (want && !(th._k > 0.02)) th._drawn = t;                 // the lines start joining again from the first star
    th._k = pose ? 1 : Math.max(0, Math.min(1, (th._k || 0) + (want ? dt * 2 : -dt * 0.6)));
    const K = th._k, X = px => x + (px - th.x - 0.5) * s, Y = py => y + (py - th.y - 0.5) * s;
    const near = (px, py) => walkers.reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) + 0.5 - px, (w.fy ?? w.y) + 0.5 - py) / 2), 0);
    const flash = i => { const p = (t * 0.23 + hash(i + 7)) % 1; return p < 0.06 ? Math.sin(p / 0.06 * Math.PI) : 0; };   // a short sparkle now and then

    // the scattered stars over the dark ground beside the street
    (th.sky || []).forEach(([px, py, sz, ci], i) => {
      const tw = 0.6 + 0.4 * Math.sin(t * (0.9 + hash(i) * 1.6) + i * 2.1), f = flash(i), b = tw + near(px, py) * 0.6 + f * 0.8 + K * 0.15;
      const sx = X(px), sy = Y(py), R = s * 0.13 * sz * (0.85 + 0.2 * b);
      star(ctx, sx, sy, R, ci, b, Math.sin(t * 0.3 + i) * 0.2);
      if (f > 0.1) { const L = R * (2 + 3 * f); ctx.strokeStyle = `rgba(${C[ci][0]},${0.7 * f})`; ctx.lineWidth = Math.max(1, s * 0.012);
        ctx.beginPath(); ctx.moveTo(sx - L, sy); ctx.lineTo(sx + L, sy); ctx.moveTo(sx, sy - L); ctx.lineTo(sx, sy + L); ctx.stroke(); }
    });

    // the lantern of stars: lines join one after another while someone waits under the arch
    const P = th.lantern || [], L = th.lines || [];
    if (K > 0.01) {
      ctx.lineCap = "round";
      L.forEach(([a, b2], i) => {
        const u = Math.max(0, Math.min(1, ((pose ? 9 : t - th._drawn) - i * 0.22) / 0.35)); if (!u) return;
        const [ax, ay] = P[a], [bx, by] = P[b2], ex = ax + (bx - ax) * u, ey = ay + (by - ay) * u;
        ctx.strokeStyle = `rgba(200,225,255,${0.16 * K})`; ctx.lineWidth = Math.max(2, s * 0.07);
        ctx.beginPath(); ctx.moveTo(X(ax), Y(ay)); ctx.lineTo(X(ex), Y(ey)); ctx.stroke();
        ctx.strokeStyle = `rgba(235,245,255,${0.6 * K})`; ctx.lineWidth = Math.max(1, s * 0.018);
        ctx.beginPath(); ctx.moveTo(X(ax), Y(ay)); ctx.lineTo(X(ex), Y(ey)); ctx.stroke();
        if (u < 1) glow(ctx, X(ex), Y(ey), s * 0.15, "235,245,255", 0.8 * K);
      });
    }
    if (th.flame) {                                              // the lantern's heart: a dim gold star that flickers up when it is joined
      const [fx, fy] = th.flame, done = pose ? 1 : Math.max(0, Math.min(1, (t - (th._drawn || 0) - L.length * 0.22) / 0.5)) * K;
      const fl = 0.55 + 0.25 * Math.sin(t * 5.3) + 0.15 * Math.sin(t * 8.1 + 1), sx = X(fx), sy = Y(fy);
      glow(ctx, sx, sy, s * (0.2 + 0.35 * done), "255,200,110", (0.2 + 0.45 * done) * fl);
      star(ctx, sx, sy, s * (0.06 + 0.05 * done) * (0.9 + 0.2 * fl), 1, 0.7 + 0.8 * done, 0);
    }
    P.forEach(([px, py, sz, ci], i) => {
      const tw = 0.65 + 0.35 * Math.sin(t * (1 + hash(i + 30)) + i * 1.7), f = flash(i + 30), b = tw + f * 0.7 + K * 0.6;
      star(ctx, X(px), Y(py), s * 0.14 * sz * (0.85 + 0.2 * b), ci, b, Math.sin(t * 0.25 + i) * 0.2);
    });
  };
})();
