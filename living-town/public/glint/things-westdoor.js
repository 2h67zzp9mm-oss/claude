// Kindle's Grid: the Way-In Door (kind "westdoor"), the second piece of the first West Meadow house, a short wall of the same
// pale hearth stone just west of the Traveler's Window (it abuts the window wall: same scale, same base line), with a
// round-topped teal plank door, gold strap hinges, a gold star knocker, a little round pane that glows warm, a honey-wood
// lintel with a frost-flower sprig, and a small lantern on a gold bracket. In front: one more warm stone from the Welcome
// Stone and a wide Doorstep with a gold half-moon in it (`stones` absolute, drawn at x+0.5; the last one is the doorstep).
// The door swings in when someone stands on the doorstep, on a tap, or when the Window Path's warm run arrives (it reads the
// warmpath thing's `_arrive`), spilling warm light out onto the doorstep. `?pose=westdoor` holds night + open.
// Stub `westdoor() {}` in things.js; loads after things-warmpath.js. Draws after the window (y 2.21 > 2.2) so it covers
// the window's gold string on its side.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0.005 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function arch(ctx, x, ty, w, h) {
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(x - r, ty + h); ctx.lineTo(x - r, ty + r); ctx.arc(x, ty + r, r, Math.PI, 0); ctx.lineTo(x + r, ty + h); ctx.closePath();
  }
  const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); };

  T.westdoor = function westdoor(ctx, x, y, s, t, th = {}) {
    const S = s * (th.scale || 1);
    const toPx = ([px, py]) => [x + (px - th.x) * s, y + (py - th.y) * s];
    const walkers = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const st = th.stones || [];
    const step = st.at(-1) || [th.x, th.y + 0.8];
    const onStep = walkers.some(w => Math.hypot((w.fx ?? w.x) - step[0], (w.fy ?? w.y) - step[1]) < 0.5);
    const near = walkers.some(w => Math.hypot((w.fx ?? w.x) - step[0], (w.fy ?? w.y) - step[1]) < 1.4);
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const night = POSE === "westdoor" ? 1 : h >= 17 || h < 7 ? 1 : h >= 16 || h < 8 ? 0.6 : 0;
    const path = (window.GLINT_WORLD?.things || []).find(o => o.kind === "warmpath");
    const arrive = path && path._arrive != null ? t - path._arrive - 0.5 : 99;   // the warm run reaches the doorstep just after the Welcome Stone
    const tap = th.tapped != null ? t - th.tapped : 99;
    const want = POSE === "westdoor" ? 1 : Math.max(onStep ? 1 : 0, tap >= 0 && tap < 6 ? 1 : 0, arrive >= 0 && arrive < 3 ? 0.35 : 0);
    th._o = th._o == null ? want : th._o + (want - th._o) * 0.05;
    const o = th._o;
    const run = arrive >= 0 && arrive < 2.4 ? Math.sin(Math.PI * arrive / 2.4) : 0;
    const flick = 0.88 + 0.08 * Math.sin(t * 6.1) + 0.04 * Math.sin(t * 11.7);
    const warm = Math.min(1.4, (0.45 + 0.35 * night + 0.2 * (near ? 1 : 0) + 0.5 * run) * flick);

    const b = y + S * 0.3, W = S * 0.625, H = S * 0.72, top = b - H;
    const dw = S * 0.27, dh = S * 0.47, dTop = b - dh, dx = x + S * 0.02;

    // stones in front: the little warm stone from the Welcome Stone, then the wide Doorstep
    st.forEach((p, i) => {
      const [px, py] = toPx(p), last = i === st.length - 1;
      const rx = s * (last ? 0.32 : 0.17), ry = rx * (last ? 0.46 : 0.6), rot = last ? 0.04 : -0.15;
      const foot = walkers.some(w => Math.hypot((w.fx ?? w.x) - p[0], (w.fy ?? w.y) - p[1]) < 0.35) ? 1 : 0;
      ctx.fillStyle = "rgba(14,52,40,0.85)"; ell(ctx, px, py + s * 0.02, rx * 1.5, ry * 1.6, rot); ctx.fill();
      ctx.fillStyle = "rgba(36,100,64,0.55)"; ell(ctx, px, py + s * 0.02, rx * 1.27, ry * 1.3, rot); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.32)"; ell(ctx, px + rx * 0.08, py + ry * 0.38, rx, ry, rot); ctx.fill();
      ctx.fillStyle = "#a89a88"; ell(ctx, px, py + ry * 0.2, rx, ry, rot); ctx.fill();
      ctx.fillStyle = "#efe4d2"; ell(ctx, px, py, rx, ry, rot); ctx.fill();
      const beat = 0.75 + 0.25 * Math.sin(t * 1.6 + i * 2.1);
      ctx.fillStyle = `rgba(255,${150 + 60 * run | 0},70,${0.3 + 0.25 * beat + 0.3 * run + 0.2 * foot})`; ell(ctx, px, py + s * 0.005, rx * 0.42, ry * 0.4, rot); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ell(ctx, px - rx * 0.28, py - ry * 0.3, rx * 0.4, ry * 0.28, rot); ctx.fill();
      glow(ctx, px, py, s * (last ? 0.36 : 0.22), "255,170,90", 0.12 * beat + 0.3 * run + 0.25 * foot);
      if (last) {   // a gold rim and a gold half-moon set in the doorstep, for "come in, it's late"
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012); ell(ctx, px, py, rx * 0.86, ry * 0.8, rot); ctx.stroke();
        const mr = s * 0.055;
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, mr, 0, TAU); ctx.clip();
        ctx.fillStyle = "#ffd166"; ctx.fillRect(px - mr, py - mr, mr * 2, mr * 2);
        ctx.fillStyle = "#efe4d2"; ctx.beginPath(); ctx.arc(px + mr * 0.55, py - mr * 0.25, mr, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // warm breath off the stones
      const q = (t * 0.3 + i * 0.45) % 1;
      ctx.strokeStyle = `rgba(255,236,210,${(0.25 + 0.3 * run) * (1 - q)})`; ctx.lineWidth = Math.max(1, s * 0.01);
      ctx.beginPath(); ctx.arc(px + Math.sin(q * 6 + i) * s * 0.03, py - s * 0.03 - q * s * 0.22, s * 0.024, 0.3, Math.PI * 1.5); ctx.stroke();
    });
    // the ember line joining the little stone to the doorstep
    if (st.length > 1) {
      ctx.setLineDash([s * 0.05, s * 0.06]); ctx.lineDashOffset = -t * s * 0.05;
      ctx.strokeStyle = `rgba(255,${150 + 60 * run | 0},60,${0.25 + 0.4 * run})`; ctx.lineWidth = Math.max(1, s * 0.018);
      ctx.beginPath(); st.forEach((p, i) => { const [px, py] = toPx(p); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
      ctx.setLineDash([]);
    }
    // the light that spills out of the open door onto the frost and the doorstep
    const spill = o * warm;
    if (spill > 0.02) {
      glow(ctx, dx, b + S * 0.12, S * 0.5, "255,175,85", 0.35 * spill);
      ctx.globalCompositeOperation = "lighter";
      poly(ctx, [[dx - dw * 0.45, b], [dx + dw * 0.45, b], [dx + dw * 0.9, b + S * 0.36], [dx - dw * 0.8, b + S * 0.36]], `rgba(255,180,90,${0.22 * spill})`);
      ctx.globalCompositeOperation = "source-over";
    }

    // shadow, then the wall: pale hearth stone, six rows, matching the window wall it joins
    ctx.fillStyle = "rgba(0,0,0,0.33)"; ell(ctx, x, b, W * 0.6, S * 0.07); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x - W / 2, b); ctx.lineTo(x - W / 2, top + S * 0.12);
    ctx.quadraticCurveTo(x, top - S * 0.02, x + W / 2, top + S * 0.1); ctx.lineTo(x + W / 2, b); ctx.closePath();
    ctx.fillStyle = "#cfc6b4"; ctx.fill(); ctx.clip();
    const rows = 6, rh = H / rows, n = 3;
    for (let r = 0; r < rows + 1; r++) {
      const ry = b - (r + 1) * rh, off = r % 2 ? 0.5 : 0;
      for (let c = -1; c < n + 1; c++) {
        const sx = x - W / 2 + (c + off) * (W / n);
        ctx.fillStyle = ["#ddd4c3", "#cbc1ae", "#e2dacb", "#d6cdbc"][(r * 3 + c + 9) % 4]; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(sx + S * 0.01, ry + S * 0.01, W / n - S * 0.02, rh - S * 0.02, S * 0.025) : ctx.rect(sx + S * 0.01, ry + S * 0.01, W / n - S * 0.02, rh - S * 0.02);
        ctx.fill();
      }
    }
    glow(ctx, dx, dTop + dh * 0.4, S * 0.4, "255,170,90", 0.16 * warm * (0.5 + 0.5 * o));
    ctx.fillStyle = "rgba(235,245,255,0.75)";   // frost along the top
    ctx.beginPath(); ctx.moveTo(x - W / 2, top + S * 0.12); ctx.quadraticCurveTo(x, top - S * 0.02, x + W / 2, top + S * 0.1);
    ctx.lineTo(x + W / 2, top + S * 0.13); ctx.quadraticCurveTo(x, top + S * 0.02, x - W / 2, top + S * 0.15); ctx.fill();
    ctx.restore();
    // a soft seam where this wall meets the window wall
    ctx.fillStyle = "rgba(120,105,85,0.35)"; ctx.fillRect(x + W / 2 - S * 0.006, top + S * 0.12, S * 0.012, b - top - S * 0.12);

    // the doorway: honey-wood frame, warm inside when open
    ctx.fillStyle = "#6a4422"; arch(ctx, dx, dTop - S * 0.022, dw + S * 0.044, dh + S * 0.022); ctx.fill();
    ctx.save(); arch(ctx, dx, dTop, dw, dh); ctx.clip();
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(dx - dw, dTop, dw * 2, dh);
    const ig = ctx.createLinearGradient(0, dTop, 0, b);
    ig.addColorStop(0, `rgba(255,${170 + 40 * warm | 0},90,1)`); ig.addColorStop(1, `rgba(255,${120 + 50 * warm | 0},60,1)`);
    ctx.globalAlpha = Math.min(1, o * (0.5 + 0.5 * warm)); ctx.fillStyle = ig; ctx.fillRect(dx - dw, dTop, dw * 2, dh); ctx.globalAlpha = 1;
    // inside: the far floor and a glimpse of the hearth-glow to come
    if (o > 0.05) { ctx.fillStyle = `rgba(150,90,45,${0.6 * o})`; ctx.fillRect(dx - dw, b - dh * 0.18, dw * 2, dh * 0.18); glow(ctx, dx - dw * 0.15, b - dh * 0.3, S * 0.12, "255,220,150", 0.5 * o * warm); }
    ctx.restore();

    // the door leaf: teal planks hinged on the left, swinging inward (it narrows toward the hinge as it opens)
    const hx = dx - dw / 2, c = Math.cos(o * Math.PI * 0.42), ex = hx + dw * c, skew = Math.sin(o * Math.PI * 0.42) * S * 0.03;
    ctx.save(); arch(ctx, dx, dTop, dw, dh); ctx.clip();
    poly(ctx, [[hx, dTop - S * 0.2], [ex, dTop - S * 0.2 + skew], [ex, b - skew * 0.5], [hx, b]], "#2f9c95");
    ctx.strokeStyle = "#1d5f5c"; ctx.lineWidth = Math.max(1, S * 0.006);
    for (let k = 1; k < 4; k++) { const px = hx + (ex - hx) * k / 4; ctx.beginPath(); ctx.moveTo(px, dTop - S * 0.2); ctx.lineTo(px, b); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(hx + S * 0.006, dTop, Math.max(1, (ex - hx) * 0.12), dh);
    // gold strap hinges
    ctx.fillStyle = "#ffd166";
    for (const f of [0.38, 0.8]) { const yy = dTop + dh * f; poly(ctx, [[hx, yy - S * 0.01], [hx + (ex - hx) * 0.6, yy - S * 0.006 + skew * 0.6], [hx + (ex - hx) * 0.6, yy + S * 0.006 + skew * 0.6], [hx, yy + S * 0.01]], "#ffd166"); }
    // the little round pane, warm from inside
    const fw = Math.abs(ex - hx) / dw;
    if (fw > 0.25) {
      const px = hx + (ex - hx) * 0.5, py = dTop + dh * 0.22 + skew * 0.5, pr = S * 0.04;
      ctx.fillStyle = "#6a4422"; ell(ctx, px, py, pr * 1.25 * fw, pr * 1.25); ctx.fill();
      ctx.fillStyle = `rgb(255,${160 + 50 * Math.min(1, warm) | 0},80)`; ell(ctx, px, py, pr * fw, pr); ctx.fill();
      ctx.fillStyle = "#8a5a2c"; ctx.fillRect(px - S * 0.004, py - pr, S * 0.008, pr * 2); ctx.fillRect(px - pr * fw, py - S * 0.004, pr * 2 * fw, S * 0.008);
      glow(ctx, px, py, S * 0.09, "255,200,110", 0.4 * warm);
      // the gold star knocker and the handle
      const kx = hx + (ex - hx) * 0.5, ky = dTop + dh * 0.5 + skew * 0.5;
      star(ctx, kx, ky, S * 0.026 * (1 + 0.25 * run), "#ffd166");
      if (run > 0) glow(ctx, kx, ky, S * 0.08, "255,225,140", 0.6 * run);
      ctx.fillStyle = "#ffd166"; ell(ctx, hx + (ex - hx) * 0.84, dTop + dh * 0.62 + skew * 0.8, S * 0.012, S * 0.012); ctx.fill();
    }
    ctx.restore();

    // the honey-wood lintel, with a sprig of frost-flowers tucked on it
    ctx.fillStyle = "#8a4f24"; ctx.fillRect(dx - dw / 2 - S * 0.04, dTop - S * 0.045, dw + S * 0.08, S * 0.028);
    ctx.fillStyle = "#e0a05a"; ctx.fillRect(dx - dw / 2 - S * 0.04, dTop - S * 0.045, dw + S * 0.08, S * 0.011);
    [["150,210,255", -0.3], ["190,160,255", -0.1], ["150,230,220", 0.12], ["220,240,255", 0.3]].forEach(([rgb, f], i) => {
      const bx = dx + f * dw, by = dTop - S * 0.06 + Math.sin(t * 1.3 + i) * S * 0.003;
      glow(ctx, bx, by, S * 0.04, rgb, 0.3 + 0.35 * night);
      ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath(); ctx.arc(bx, by, Math.max(1, S * 0.012), 0, TAU); ctx.fill();
    });

    // a small lantern on a gold bracket beside the door
    const lx = dx + dw / 2 + S * 0.09, ly = dTop + S * 0.04;
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.01);
    ctx.beginPath(); ctx.moveTo(lx + S * 0.035, ly - S * 0.05); ctx.lineTo(lx, ly - S * 0.05); ctx.lineTo(lx, ly - S * 0.03); ctx.stroke();
    const sw = Math.sin(t * 1.1) * S * 0.004;
    glow(ctx, lx + sw, ly + S * 0.02, S * (0.16 + 0.06 * run), "255,200,110", 0.45 * warm);
    ctx.fillStyle = "#b8862a"; poly(ctx, [[lx - S * 0.03 + sw, ly - S * 0.025], [lx + S * 0.03 + sw, ly - S * 0.025], [lx + sw, ly - S * 0.05]], "#ffd166");
    ctx.fillStyle = `rgb(255,${190 + 40 * Math.min(1, warm) | 0},110)`; ctx.fillRect(lx - S * 0.022 + sw, ly - S * 0.025, S * 0.044, S * 0.06);
    ctx.fillStyle = "#b8862a"; ctx.fillRect(lx - S * 0.026 + sw, ly + S * 0.035, S * 0.052, S * 0.01);
    ctx.fillStyle = "#fffbe8"; ell(ctx, lx + sw, ly + S * 0.008, S * 0.007, S * 0.014); ctx.fill();
  };
})();
