// Kindle's Grid: the Traveler's Window (kind "glowwindow"), the first wall of the first West Meadow house, west of the
// Spark Lamp. A short wall of pale hearth stone with a round-topped window of four panes, a honey-wood sill with a box of
// frost-flowers and two little icicles, teal shutters with star cut-outs, a candle on the inner sill, frost ferns on the
// glass melted round the flame. Gold pegs and string behind it mark out the rest of the house to come.
// Shutters open at dusk/night, when someone is near, or on a tap; open, the window throws a pool of four warm panes onto
// the frost in front, and little gold motes drift out toward whoever is close. Tap = candle flares + motes.
// `?pose=glowwindow` holds night + open + flare. Stub `glowwindow() {}` in things.js; loads after things-emberseat.js.
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
  // the window opening: a rectangle with a round top (centre x, top of the arch ty, width w, total height h)
  function opening(ctx, x, ty, w, h) {
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(x - r, ty + h); ctx.lineTo(x - r, ty + r); ctx.arc(x, ty + r, r, Math.PI, 0); ctx.lineTo(x + r, ty + h); ctx.closePath();
  }

  T.glowwindow = function glowwindow(ctx, x, y, s, t, th = {}) {
    const S = s * (th.scale || 1);
    const wcx = th.x + 0.5, wcy = th.y + 0.5;
    const walkers = window.GLINT_GRID?.walkers || [];
    let nearW = null, nd = 99;
    for (const w of walkers) {
      if (w.inside) continue;
      const d = Math.hypot((w.fx ?? w.x) + 0.5 - wcx, (w.fy ?? w.y) - wcy - 0.3);
      if (d < nd) { nd = d; nearW = w; }
    }
    const near = nd < 1.8;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const night = POSE === "glowwindow" ? 1 : h >= 17 || h < 7 ? 1 : h >= 16 || h < 8 ? 0.6 : 0;
    let e = th.tapped != null ? t - th.tapped : 99;
    if (POSE === "glowwindow") e = 0.6 + (t % 3);
    const flare = e >= 0 && e < 3 ? Math.sin(Math.PI * Math.min(1, e / 3)) : 0;
    // shutters ease open and shut
    const want = Math.max(night > 0.5 ? 1 : 0, near ? 1 : 0, e >= 0 && e < 8 ? 1 : 0);
    th._o = th._o == null ? want : th._o + (want - th._o) * 0.04;
    const o = POSE === "glowwindow" ? 1 : th._o;
    const flick = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1);
    const lit = Math.min(1.3, (0.45 + 0.4 * night + 0.25 * (near ? 1 : 0) + 0.5 * flare) * flick);

    const b = y + S * 0.3, W = S * 0.78, H = S * 0.72, top = b - H;
    const ww = S * 0.34, wh = S * 0.38, wy = top + S * 0.13, sill = wy + wh;

    // the plot for the rest of the house: gold pegs and string behind the wall
    const back = b - S * 0.5, sideX = S * 0.6;
    const westX = th.plotWest != null ? x + (th.plotWest + 0.5 - wcx) * s : null;   // the Way-In Door widened the plot west
    const pegs = [[westX ?? x - sideX, b - S * 0.06], [westX != null ? westX + S * 0.04 : x - sideX * 0.92, back], [x + sideX * 0.92, back], [x + sideX, b - S * 0.06]];
    ctx.strokeStyle = "rgba(255,209,102,0.65)"; ctx.lineWidth = Math.max(1, S * 0.008);
    ctx.beginPath(); pegs.forEach(([px, py], i) => i ? ctx.lineTo(px, py - S * 0.05) : ctx.moveTo(px, py - S * 0.05)); ctx.stroke();
    for (const [px, py] of pegs) {
      ctx.fillStyle = "#b8862a"; ctx.fillRect(px - S * 0.012, py - S * 0.07, S * 0.024, S * 0.07);
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(px, py - S * 0.07, Math.max(1, S * 0.016), 0, TAU); ctx.fill();
    }

    // the pool of window light on the frost in front: four warm panes, stretched out toward the viewer
    const pool = o * lit;
    if (pool > 0.02) {
      glow(ctx, x, b + S * 0.2, S * 0.75, "255,170,80", 0.3 * pool);
      ctx.globalCompositeOperation = "lighter";
      const py0 = b + S * 0.05, py1 = b + S * 0.5, gap = S * 0.02;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const f0 = j / 2, f1 = (j + 1) / 2;
        const ya = py0 + (py1 - py0) * f0 + (j ? gap : 0), yb = py0 + (py1 - py0) * f1 - (j ? 0 : gap);
        const wa = ww * (0.55 + 0.6 * f0) / 2, wb = ww * (0.55 + 0.6 * f1) / 2;
        const xa0 = i ? x + gap : x - wa, xa1 = i ? x + wa : x - gap, xb0 = i ? x + gap : x - wb, xb1 = i ? x + wb : x - gap;
        poly(ctx, [[xa0, ya], [xa1, ya], [xb1, yb], [xb0, yb]], `rgba(255,175,80,${0.3 * pool * (1 - 0.4 * f0)})`);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // shadow, then the wall of pale hearth stone with a gently rounded top
    ctx.fillStyle = "rgba(0,0,0,0.33)"; ctx.beginPath(); ctx.ellipse(x, b, W * 0.62, S * 0.07, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x - W / 2, b); ctx.lineTo(x - W / 2, top + S * 0.1);
    ctx.quadraticCurveTo(x, top - S * 0.08, x + W / 2, top + S * 0.1); ctx.lineTo(x + W / 2, b); ctx.closePath();
    ctx.fillStyle = "#cfc6b4"; ctx.fill(); ctx.clip();
    const rows = 6, rh = H / rows;
    for (let r = 0; r < rows + 1; r++) {
      const ry = b - (r + 1) * rh, off = r % 2 ? 0.5 : 0, n = 4;
      for (let c = -1; c < n + 1; c++) {
        const sx = x - W / 2 + (c + off) * (W / n);
        const shade = ["#e2dacb", "#d6cdbc", "#ddd4c3", "#cbc1ae"][(r * 3 + c + 8) % 4];
        ctx.fillStyle = shade; ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(sx + S * 0.01, ry + S * 0.01, W / n - S * 0.02, rh - S * 0.02, S * 0.025) : ctx.rect(sx + S * 0.01, ry + S * 0.01, W / n - S * 0.02, rh - S * 0.02);
        ctx.fill();
      }
    }
    // warm light soaking into the stones round the window
    glow(ctx, x, wy + wh * 0.55, S * 0.42, "255,170,90", 0.18 * lit * (0.4 + 0.6 * o));
    // a little frost settled along the top
    ctx.fillStyle = "rgba(235,245,255,0.75)";
    ctx.beginPath(); ctx.moveTo(x - W / 2, top + S * 0.1); ctx.quadraticCurveTo(x, top - S * 0.08, x + W / 2, top + S * 0.1);
    ctx.lineTo(x + W / 2, top + S * 0.13); ctx.quadraticCurveTo(x, top - S * 0.04, x - W / 2, top + S * 0.13); ctx.fill();
    ctx.restore();
    // a gold star on the top of the wall, where the roof will meet it one day
    glow(ctx, x, top - S * 0.02, S * 0.1, "255,210,120", 0.35 + 0.2 * Math.sin(t * 1.5));
    star(ctx, x, top - S * 0.02, S * 0.035, "#ffd166");

    // the window: warm glass, the candle inside, frost ferns melted round the flame
    ctx.fillStyle = "#6a4422"; opening(ctx, x, wy - S * 0.018, ww + S * 0.036, wh + S * 0.018); ctx.fill();   // honey-wood frame
    ctx.save(); opening(ctx, x, wy, ww, wh); ctx.clip();
    const g = ctx.createLinearGradient(0, wy, 0, sill);
    g.addColorStop(0, `rgba(255,${Math.round(150 + 50 * lit)},90,1)`); g.addColorStop(1, `rgba(255,${Math.round(110 + 60 * lit)},60,1)`);
    ctx.fillStyle = "#2a1a10"; ctx.fillRect(x - ww, wy, ww * 2, wh);
    ctx.globalAlpha = Math.min(1, 0.35 + 0.6 * lit); ctx.fillStyle = g; ctx.fillRect(x - ww, wy, ww * 2, wh); ctx.globalAlpha = 1;
    // the candle on the inner sill
    const cx = x + ww * 0.12, cb = sill - S * 0.02, ch = S * 0.08;
    ctx.fillStyle = "#fff4dc"; ctx.fillRect(cx - S * 0.018, cb - ch, S * 0.036, ch);
    ctx.fillStyle = "#e8d4b0"; ctx.fillRect(cx + S * 0.006, cb - ch, S * 0.012, ch);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(cx - S * 0.03, cb - S * 0.008, S * 0.06, S * 0.012);
    const fh = S * (0.035 + 0.02 * flare) * flick, fx = cx + Math.sin(t * 3.1) * S * 0.004, fy = cb - ch - S * 0.004;
    glow(ctx, fx, fy - fh * 0.5, S * (0.12 + 0.08 * flare), "255,220,140", 0.6 * lit);
    ctx.fillStyle = "#ffcf5a"; ctx.beginPath(); ctx.ellipse(fx, fy - fh * 0.5, S * 0.012, fh * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffbe8"; ctx.beginPath(); ctx.ellipse(fx, fy - fh * 0.35, S * 0.006, fh * 0.3, 0, 0, TAU); ctx.fill();
    // frost ferns creeping in from the edges; the candle keeps a round clear patch
    const clear = S * (0.09 + 0.05 * lit);
    ctx.strokeStyle = "rgba(235,248,255,0.55)"; ctx.lineWidth = Math.max(1, S * 0.006); ctx.lineCap = "round";
    const fern = (x0, y0, ang, len) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      if (Math.hypot(x1 - fx, y1 - fy) < clear) return;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      for (let k = 1; k < 4; k++) {
        const px = x0 + (x1 - x0) * k / 4, py = y0 + (y1 - y0) * k / 4, l = len * 0.3 * (1 - k / 5);
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ang - 0.7) * l, py + Math.sin(ang - 0.7) * l);
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ang + 0.7) * l, py + Math.sin(ang + 0.7) * l);
      }
      ctx.stroke();
    };
    const L = ww / 2;
    fern(x - L, sill, -0.8, S * 0.09); fern(x - L, sill - S * 0.08, -0.3, S * 0.07); fern(x + L, sill, -2.4, S * 0.09);
    fern(x + L, sill - S * 0.1, -2.9, S * 0.06); fern(x - L, wy + L, 0.4, S * 0.06); fern(x + L, wy + L, 2.7, S * 0.06);
    ctx.restore();
    // mullions: a honey-wood cross making four panes
    ctx.fillStyle = "#8a5a2c";
    ctx.fillRect(x - S * 0.008, wy, S * 0.016, wh);
    ctx.fillRect(x - ww / 2, wy + wh * 0.52, ww, S * 0.016);
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(x - ww / 2 + S * 0.02, wy + S * 0.06, S * 0.012, wh * 0.35);   // a glint on the glass

    // teal shutters on gold hinges, star cut-outs that glow when they're shut
    for (const side of [-1, 1]) {
      const hx = x + side * (ww / 2 + S * 0.018);
      const c = Math.cos(o * Math.PI * 0.95);   // 1 shut .. -1 flat open against the wall
      const ex = hx - side * (ww / 2 + S * 0.005) * c;
      const skew = Math.sin(o * Math.PI * 0.95) * S * 0.035;
      const y0 = wy + S * 0.03, y1 = sill;
      const shade = c > 0 ? "#2f9c95" : "#257c78";
      poly(ctx, [[hx, y0], [ex, y0 - skew], [ex, y1 + skew * 0.4], [hx, y1]], shade);
      if (Math.abs(ex - hx) > S * 0.04) {
        ctx.strokeStyle = "#1d5f5c"; ctx.lineWidth = Math.max(1, S * 0.006);
        const mx = (hx + ex) / 2;
        for (const f of [0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(hx, y0 + (y1 - y0) * f); ctx.lineTo(ex, y0 + (y1 - y0) * f - skew * (1 - f)); ctx.stroke(); }
        const sy = (y0 + y1) / 2 - skew * 0.3, sr = Math.min(S * 0.028, Math.abs(ex - hx) * 0.3);
        star(ctx, mx, sy, sr, c > 0 ? `rgba(255,${Math.round(190 + 40 * lit)},110,${0.6 + 0.4 * lit})` : "#ffd166");
        if (c > 0) glow(ctx, mx, sy, S * 0.07, "255,200,110", 0.35 * lit);
      }
      ctx.fillStyle = "#ffd166";
      for (const f of [0.15, 0.85]) ctx.fillRect(hx - S * 0.012, y0 + (y1 - y0) * f - S * 0.008, S * 0.024, S * 0.016);
    }

    // the honey-wood sill, a box of frost-flowers, and two little icicles
    ctx.fillStyle = "#8a4f24"; ctx.fillRect(x - ww / 2 - S * 0.05, sill, ww + S * 0.1, S * 0.03);
    ctx.fillStyle = "#e0a05a"; ctx.fillRect(x - ww / 2 - S * 0.05, sill, ww + S * 0.1, S * 0.013);
    ctx.fillStyle = "#9c5a28"; ctx.fillRect(x - ww / 2 - S * 0.02, sill + S * 0.03, ww + S * 0.04, S * 0.05);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(x - ww / 2 - S * 0.02, sill + S * 0.045, ww + S * 0.04, S * 0.008);
    const fl = [["150,210,255", -0.36], ["220,240,255", -0.18], ["190,160,255", 0], ["150,230,220", 0.18], ["220,240,255", 0.36]];
    fl.forEach(([rgb, f], i) => {
      const bx = x + f * ww, by = sill - S * 0.005 + Math.sin(t * 1.4 + i) * S * 0.003;
      ctx.strokeStyle = "#4a8a6a"; ctx.lineWidth = Math.max(1, S * 0.006);
      ctx.beginPath(); ctx.moveTo(bx, sill + S * 0.01); ctx.lineTo(bx, by - S * 0.02); ctx.stroke();
      glow(ctx, bx, by - S * 0.025, S * 0.045, rgb, 0.3 + 0.3 * night + 0.3 * flare);
      ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath(); ctx.arc(bx, by - S * 0.025, Math.max(1, S * 0.013), 0, TAU); ctx.fill();
    });
    for (const [f, len] of [[-0.42, 0.05], [0.4, 0.035]]) {
      const ix = x + f * ww, iy = sill + S * 0.08;
      poly(ctx, [[ix - S * 0.01, iy], [ix + S * 0.01, iy], [ix, iy + S * len]], "rgba(225,242,255,0.85)");
      if (lit > 0.6) { const dr = (t * 0.5 + f) % 1; glow(ctx, ix, iy + S * len + dr * S * 0.06, S * 0.012, "255,220,160", 0.6 * (1 - dr) * o); }
    }

    // gold motes drifting out of the open window toward whoever is close (or just up into the cold air)
    const call = o * Math.max(near ? 1 : 0, flare, night * 0.4);
    if (call > 0.03) {
      const tx = nearW && near ? x + ((nearW.fx ?? nearW.x) + 0.5 - wcx) * s : x + S * 0.3;
      const ty = nearW && near ? y + ((nearW.fy ?? nearW.y) - wcy) * s : top - S * 0.3;
      for (let i = 0; i < 5; i++) {
        const f = (t * 0.25 + i / 5) % 1;
        const mx = x + (tx - x) * f + Math.sin(t * 1.7 + i * 2.2) * S * 0.05;
        const my = (wy + wh * 0.5) + (ty - (wy + wh * 0.5)) * f - Math.sin(f * Math.PI) * S * 0.2;
        glow(ctx, mx, my, S * 0.05, "255,215,130", call * Math.sin(f * Math.PI) * 0.8);
      }
    }
  };
})();
