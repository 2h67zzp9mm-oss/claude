// Kindle's Grid: the Third Little House's light-moths. Wraps GLINT_THINGS.cottage so a cottage with
// `moths: [[glowRGB, wingColour], ...]` has its own light-moths looping round the gem on its roof, and with
// `glowWindow: "r,g,b"` its round window glows that colour. A tap (th.tapped, 4 s) sends the moths out in a wide,
// fast swirl over the roof with a puff of sparks. Loads after things.js.
(() => {
  const TAU = Math.PI * 2;
  const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
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
  const base = T.cottage;
  if (!base) return;

  T.cottage = function cottage(ctx, x, y, s, t, th = {}) {
    base(ctx, x, y, s, t, th);
    if (!th.moths && !th.glowWindow) return;
    const m = th.flip ? -1 : 1, b = y + s * 0.45, w = s * 0.88, h = s * 0.95, rt = b - h - s * 0.85, gy = rt - s * 0.12;
    const e = th.tapped != null ? t - th.tapped : 99, k = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    if (th.glowWindow) {   // the round window glows from inside, breathing slowly
      const wx = x + m * w * 0.4, wy = b - h * 0.56;
      glow(ctx, wx, wy, s * (0.42 + 0.12 * k), th.glowWindow, 0.45 + 0.1 * Math.sin(t * 1.4) + 0.3 * k);
    }
    (th.moths || []).forEach(([rgb, wing], i) => {
      const ph = rnd(th.x * 5 + th.y * 11 + i * 2.9) * TAU, sp = (0.8 + rnd(ph) * 0.6) * (i % 2 ? -1 : 1) * (1 + 1.4 * k), a = t * sp + ph;
      const r = s * (0.45 + 0.12 * Math.sin(t * 0.57 + ph * 2) + 0.6 * k);
      const mx = x + Math.cos(a) * r * 1.3 + Math.sin(t * 2.1 + ph) * s * 0.04;
      const my = gy - s * 0.05 + Math.sin(a) * r * 0.55 + Math.sin(t * 2.9 + ph * 3) * s * 0.05 - k * s * 0.35;
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + ph)), mw = s * 0.12, mh = s * 0.085;
      glow(ctx, mx, my, s * 0.2, rgb, 0.45);
      poly(ctx, [[mx, my - mh * 0.2], [mx - mw * flap, my - mh], [mx - mw * flap * 0.8, my + mh * 0.6], [mx, my + mh * 0.3]], wing);
      poly(ctx, [[mx, my - mh * 0.2], [mx + mw * flap, my - mh], [mx + mw * flap * 0.8, my + mh * 0.6], [mx, my + mh * 0.3]], wing);
      ctx.fillStyle = "#fffdf0"; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.017, s * 0.047, 0, 0, TAU); ctx.fill();
    });
    if (k > 0.02) for (let i = 0; i < 10; i++) {   // a puff of pink sparks off the roof when touched
      const f = (e * 0.6 + rnd(i * 3.3)) % 1, sx = x + (rnd(i * 7.1) - 0.5) * s * 1.6, sy = gy - f * s * 1.0;
      ctx.globalAlpha = k * (1 - f); ctx.fillStyle = i % 3 ? "#ffc2e6" : "#fff6d6";
      ctx.beginPath(); ctx.arc(sx, sy, s * 0.028, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  };
})();
