// Kindle's Grid: the Crystal Bench under the East Gate Tree. Wraps GLINT_THINGS.bench so a bench with
// `crystal: true` is drawn in crystal wood (mint-teal like the gate tree's leaves): faceted crystal legs on gold feet,
// three translucent seat planks with a light that runs along their grain, a back rail of little crystal points with an
// amber gem in the middle. Warm wisps of bakery smell drift in from the east (the bakery) and curl over the seat.
// Someone sitting on it, or a tap (th.tapped, 4 s), makes the planks chime light end to end and the wisps thicken.
// Loads after things.js.
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
  function gem(ctx, x, y, w, h, light, mid, dark) {
    poly(ctx, [[x, y - h], [x - w, y], [x, y]], light); poly(ctx, [[x, y - h], [x + w, y], [x, y]], mid);
    poly(ctx, [[x, y + h], [x - w, y], [x, y]], mid); poly(ctx, [[x, y + h], [x + w, y], [x, y]], dark);
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const base = T.bench;
  if (!base) return;

  // A slab of crystal wood: lit top face, darker front face, faint grain, and a sheen that slides along it.
  function plank(ctx, x0, x1, y, d, h, t, i, chime) {
    ctx.globalAlpha = 0.92;
    poly(ctx, [[x0 + d, y - h], [x1 + d, y - h], [x1, y], [x0, y]], "#7dffd2");                    // top face
    poly(ctx, [[x0, y], [x1, y], [x1, y + h * 0.9], [x0, y + h * 0.9]], "#1f9f9a");                  // front face
    poly(ctx, [[x0, y], [x0 + (x1 - x0) * 0.3, y], [x0 + (x1 - x0) * 0.22, y + h * 0.9], [x0, y + h * 0.9]], "#2fc9b4");   // a facet
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(220,255,245,0.45)"; ctx.lineWidth = Math.max(1, h * 0.12);              // grain
    ctx.beginPath(); ctx.moveTo(x0 + d * 0.7 + h * 0.4, y - h * 0.55); ctx.lineTo(x1 - h * 0.6, y - h * 0.4); ctx.stroke();
    const f = (t * 0.35 + i * 0.27) % 1, sx = x0 + (x1 - x0) * f;                                    // the sheen sliding along
    glow(ctx, sx + d * 0.5, y - h * 0.4, h * 2.4, "200,255,240", 0.35 * Math.sin(f * Math.PI));
    if (chime > 0) glow(ctx, x0 + (x1 - x0) * chime, y - h * 0.3, h * 3.4, "255,230,160", 0.9 * Math.sin(chime * Math.PI));
  }

  T.bench = function bench(ctx, x, y, s, t, th = {}) {
    if (!th.crystal) return base(ctx, x, y, s, t, th);
    const b = y + s * 0.3, w = s * 0.44, seat = b - s * 0.22, top = b - s * 0.62, d = s * 0.05;
    const walkers = window.GLINT_GRID?.walkers || [];
    const sat = walkers.some(k => k.seated && k.bench === th);
    const e = th.tapped != null ? t - th.tapped : 99, tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    const warm = Math.max(tap, sat ? 0.7 : 0);
    const chime = e >= 0 && e < 1.6 ? e / 1.6 : sat ? (t * 0.4) % 1 : 0;   // a light runs end to end along the planks

    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.02, s * 0.5, s * 0.1, 0, 0, TAU); ctx.fill();
    glow(ctx, x, seat, s * (0.8 + 0.2 * warm), "110,255,210", 0.2 + 0.15 * Math.sin(t * 1.3) + 0.25 * warm);
    glow(ctx, x, seat, s * 0.6, "255,200,120", 0.3 * warm);

    // back posts: two tall crystal prisms
    for (const sd of [-1, 1]) {
      const px = x + sd * w * 0.86;
      poly(ctx, [[px - s * 0.035, b - s * 0.12], [px - s * 0.035, top + s * 0.02], [px, top - s * 0.05], [px, b - s * 0.12]], "#5fe8c4");
      poly(ctx, [[px, b - s * 0.12], [px, top - s * 0.05], [px + s * 0.035, top + s * 0.02], [px + s * 0.035, b - s * 0.12]], "#1d8f8f");
      gem(ctx, px, top - s * 0.07, s * 0.04, s * 0.06, "#e9fff8", "#7dffd2", "#27c9b2");
      glow(ctx, px, top - s * 0.07, s * 0.12, "150,255,220", 0.5 + 0.3 * Math.sin(t * 2 + sd));
    }
    // back rail with a row of little crystal points, an amber gem in the middle
    plank(ctx, x - w, x + w, top + s * 0.16, d * 0.6, s * 0.06, t, 3, chime);
    for (let i = 0; i < 7; i++) {
      const u = -0.75 + i * 0.25, cx = x + u * w, hh = s * (0.06 + 0.035 * (1 - Math.abs(u)));
      if (i === 3) continue;
      poly(ctx, [[cx - s * 0.025, top + s * 0.1], [cx, top + s * 0.1 - hh], [cx + s * 0.025, top + s * 0.1]], i % 2 ? "#8affda" : "#4fd8bd");
    }
    plank(ctx, x - w, x + w, top + s * 0.06, d * 0.6, s * 0.05, t, 4, chime);
    gem(ctx, x, top + s * 0.03, s * 0.06, s * 0.085, "#fff3c9", "#ffb347", "#d07a1f");
    glow(ctx, x, top + s * 0.03, s * (0.2 + 0.1 * warm), "255,190,100", 0.55 + 0.35 * warm);

    // seat: three planks stepping forward
    for (let i = 0; i < 3; i++) plank(ctx, x - w * 1.06, x + w * 1.06, seat - s * 0.08 + i * s * 0.05, d, s * 0.045, t, i, chime);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(x - w * 1.06, seat + s * 0.06, w * 2.12, Math.max(1, s * 0.018));   // a gold edge

    // front legs: faceted crystal on gold feet, with gem caps at the seat ends
    for (const sd of [-1, 1]) {
      const lx = x + sd * w * 0.9, ly = seat + s * 0.08;
      poly(ctx, [[lx - s * 0.045, ly], [lx, ly], [lx, b - s * 0.03], [lx - s * 0.03, b - s * 0.03]], "#5fe8c4");
      poly(ctx, [[lx, ly], [lx + s * 0.045, ly], [lx + s * 0.03, b - s * 0.03], [lx, b - s * 0.03]], "#1f9f9a");
      ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - s * 0.055, b - s * 0.035, s * 0.11, s * 0.04);
      gem(ctx, x + sd * w * 1.08, seat - s * 0.04, s * 0.035, s * 0.05, "#fff6d6", "#ffd166", "#e09a2b");
    }

    // warm wisps of bakery smell drifting in from the east and curling up over the seat
    const n = 4 + Math.round(3 * warm);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const f0 = (t * 0.12 + i / n) % 1, fade = Math.sin(f0 * Math.PI);
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const f = f0 - k * 0.02; if (f < 0) break;
        const px = x + s * (1.5 - 1.8 * f), py = seat - s * (0.25 + 0.75 * f * f) + Math.sin(f * 9 + i * 2.1) * s * 0.07;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.strokeStyle = `rgba(255,214,150,${(0.42 + 0.3 * warm) * fade})`; ctx.lineWidth = s * (0.035 + 0.02 * warm); ctx.stroke();
    }
    ctx.lineCap = "butt";
    if (tap) for (let i = 0; i < 6; i++) {   // a tap shakes a few crystal sparkles loose
      const f = Math.min(1, e / 2), a = i * TAU / 6 + 0.4;
      glow(ctx, x + Math.cos(a) * s * 0.5 * f, seat - s * 0.2 - Math.sin(f * Math.PI) * s * 0.4 + Math.sin(a) * s * 0.1, s * 0.07 * (1 - f) + 1, "170,255,230", 1 - f);
    }
  };
})();
