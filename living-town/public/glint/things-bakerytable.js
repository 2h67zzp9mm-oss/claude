// Kindle's Grid: the Bakery Table across the east road from the bakery door (kind "bakerytable"). A small square table
// of honey wood with gold corner caps and four legs on gold feet, and a round three-legged stool either side of it
// with a plump amber cushion. On the table: a cream plate with a honey bun (gold swirl, steaming), a second empty plate
// waiting, and a little amber lantern-jar with a flame. A warm amber pool of light lies on the moss under it all, the
// "warm amber light" Kindle wanted, as if spilled from the bakery window.
// A walker within ~1.5 eases th._near: the cushions glow (a seat is ready), the bun steams harder, the jar brightens.
// A tap (4 s): the flame leaps, the bun hops, and amber motes drift from the bakery door across the road to the table.
// `?pose=sit` holds the tap. Drawn larger (x2.1 from the feet). Loads after things.js (stub `bakerytable() {}`).
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
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};

  // a round honey-wood stool: three legs, gold feet, an amber cushion with a gold button
  function stool(ctx, x, b, s, seat) {
    const R = s * 0.085, top = b - s * 0.17;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.01, R * 1.2, s * 0.03, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7a4520"; ctx.fillRect(x - s * 0.012, top, s * 0.024, b - top - s * 0.02);           // back leg
    for (const d of [-1, 1]) {
      const lx = x + d * R * 0.6;
      poly(ctx, [[lx - s * 0.014, top + s * 0.01], [lx + s * 0.014, top + s * 0.01], [lx + s * 0.014 + d * s * 0.016, b - s * 0.015], [lx - s * 0.014 + d * s * 0.016, b - s * 0.015]], "#8a4f24");
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(lx - s * 0.014, top + s * 0.015, s * 0.008, b - top - s * 0.04);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - s * 0.02 + d * s * 0.016, b - s * 0.022, s * 0.04, s * 0.02);
    }
    ctx.fillStyle = "#b06a32"; ctx.fillRect(x - R * 0.7, top + s * 0.07, R * 1.4, s * 0.014);                // a rung
    ctx.fillStyle = "#8a4f24"; ctx.beginPath(); ctx.ellipse(x, top + s * 0.018, R, R * 0.4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#e0a05a"; ctx.beginPath(); ctx.ellipse(x, top, R, R * 0.4, 0, 0, TAU); ctx.fill();
    // the cushion: plump amber, glows when someone is near, as if saying "sit here"
    glow(ctx, x, top - s * 0.02, s * (0.12 + 0.06 * seat), "255,170,70", 0.12 + 0.45 * seat);
    ctx.fillStyle = "#e08a2a"; ctx.beginPath(); ctx.ellipse(x, top - s * 0.012, R * 0.86, R * 0.42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = seat > 0.3 ? "#ffd27a" : "#ffb347"; ctx.beginPath(); ctx.ellipse(x - R * 0.1, top - s * 0.024, R * 0.62, R * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x, top - s * 0.018, Math.max(1, s * 0.01), 0, TAU); ctx.fill();
  }

  // a honey bun with a gold swirl on a cream plate
  function bun(ctx, x, y, s, k) {
    ctx.fillStyle = "#c97a32"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.042, s * 0.032, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#e6a250"; ctx.beginPath(); ctx.ellipse(x - s * 0.008, y - s * 0.014, s * 0.026, s * 0.013, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = k > 0.3 ? "#fff1b8" : "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.4) { const r = s * 0.0065 * a, px = x + Math.cos(a) * r, py = y - s * 0.017 + Math.sin(a) * r * 0.5; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  }
  function plate(ctx, x, y, s) {
    ctx.fillStyle = "#d9c8a8"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.004, s * 0.058, s * 0.02, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff6e4"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.056, s * 0.018, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.8, s * 0.005); ctx.beginPath(); ctx.ellipse(x, y, s * 0.045, s * 0.013, 0, 0, TAU); ctx.stroke();
  }

  T.bakerytable = function bakerytable(ctx, x, y, s, t, th = {}) {
    const e = POSE === "sit" ? 1.5 : th.tapped != null ? t - th.tapped : 99;
    const tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    const bx = th.x + 0.5, by = th.y + 0.6;
    const near = POSE === "sit" ? 1 : (window.GLINT_GRID?.walkers || []).reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) - bx, (w.fy ?? w.y) - by) / 1.5), 0);
    th._near = (th._near ?? 0) + (near - (th._near ?? 0)) * 0.06;
    const seat = Math.max(th._near, tap * 0.8), warm = Math.max(tap, th._near * 0.7);

    // motes of amber light drift from the bakery door across the road on a tap (drawn before scaling, in tile units)
    if (tap > 0) for (let i = 0; i < 5; i++) {
      const f = Math.min(1, Math.max(0, e / 2.2 - i * 0.12));
      if (f <= 0 || f >= 1) continue;
      glow(ctx, x + s * (0.1 - 0.1 * f) + Math.sin(t * 3 + i) * s * 0.05, y - s * 1.1 + f * s * 1.25, s * 0.07, "255,200,110", 0.8 * Math.sin(Math.PI * f));
    }

    const b = y + s * 0.25;
    ctx.translate(x, b); ctx.scale(2.1, 2.1); ctx.translate(-x, -b);

    // the warm amber pool of light on the moss
    ctx.save(); ctx.translate(x, b - s * 0.02); ctx.scale(1, 0.4);
    glow(ctx, 0, 0, s * (0.5 + 0.08 * warm), "255,165,70", 0.45 + 0.06 * Math.sin(t * 1.1) + 0.25 * warm);
    ctx.restore();

    stool(ctx, x - s * 0.27, b - s * 0.01, s, seat);
    stool(ctx, x + s * 0.27, b - s * 0.01, s, seat);

    // the square table: shadow, four legs on gold feet, an apron, the honey-wood top with gold corner caps
    const W2 = s * 0.15, top = b - s * 0.27, D = s * 0.06;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.01, W2 * 1.15, s * 0.04, 0, 0, TAU); ctx.fill();
    for (const d of [-1, 1]) {                                     // back legs
      ctx.fillStyle = "#6e3d1c"; ctx.fillRect(x + d * W2 * 0.8 - s * 0.012, top, s * 0.024, b - top - s * 0.04);
    }
    for (const d of [-1, 1]) {                                     // front legs
      const lx = x + d * W2 * 0.9;
      ctx.fillStyle = "#8a4f24"; ctx.fillRect(lx - s * 0.016, top + D, s * 0.032, b - top - D - s * 0.018);
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(lx - s * 0.016, top + D, s * 0.01, b - top - D - s * 0.022);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - s * 0.022, b - s * 0.024, s * 0.044, s * 0.022);
    }
    ctx.fillStyle = "#9c5a28"; ctx.fillRect(x - W2 * 0.95, top + D, W2 * 1.9, s * 0.03);                      // apron
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x, top + D + s * 0.015, Math.max(1, s * 0.01), 0, TAU); ctx.fill();   // a gold knob: a little drawer
    poly(ctx, [[x - W2, top + D * 0.5], [x + W2, top + D * 0.5], [x + W2, top + D], [x - W2, top + D]], "#a8642c");  // front edge
    poly(ctx, [[x - W2 * 0.8, top - D * 0.5], [x + W2 * 0.8, top - D * 0.5], [x + W2, top + D * 0.5], [x - W2, top + D * 0.5]], "#e0a05a");  // top
    ctx.strokeStyle = "#c98a46"; ctx.lineWidth = Math.max(0.8, s * 0.005);    // wood grain
    for (const g of [-0.25, 0.3]) { ctx.beginPath(); ctx.moveTo(x - W2 * 0.85, top + D * g); ctx.lineTo(x + W2 * 0.85, top + D * g); ctx.stroke(); }
    ctx.fillStyle = "#ffd166";
    for (const [cx, cy] of [[x - W2, top + D * 0.5], [x + W2, top + D * 0.5], [x - W2 * 0.8, top - D * 0.5], [x + W2 * 0.8, top - D * 0.5]]) { ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, s * 0.011), 0, TAU); ctx.fill(); }

    // the amber lantern-jar in the middle, at the back
    const jx = x + s * 0.005, jy = top - s * 0.012, fl = 0.75 + 0.2 * Math.sin(t * 7) + 0.1 * Math.sin(t * 11.3) + 0.6 * tap;
    glow(ctx, jx, jy - s * 0.03, s * (0.16 + 0.1 * warm), "255,170,60", 0.35 * fl + 0.25 * warm);
    ctx.fillStyle = "rgba(255,170,70,0.75)"; ctx.fillRect(jx - s * 0.02, jy - s * 0.05, s * 0.04, s * 0.05);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(jx - s * 0.024, jy - s * 0.058, s * 0.048, s * 0.01); ctx.fillRect(jx - s * 0.022, jy - s * 0.003, s * 0.044, s * 0.006);
    ctx.fillStyle = "#fff3c4"; ctx.beginPath(); ctx.ellipse(jx, jy - s * 0.024, s * 0.008, s * 0.016 * fl, 0, 0, TAU); ctx.fill();

    // two plates: one with a honey bun (it hops on a tap), one empty and waiting
    const p1 = x - s * 0.075, p2 = x + s * 0.08, py = top + D * 0.15;
    plate(ctx, p2, py, s);
    plate(ctx, p1, py, s);
    const hop = -Math.max(0, Math.sin(t * 9)) * s * 0.02 * tap;
    glow(ctx, p1, py - s * 0.03, s * (0.08 + 0.06 * warm), "255,214,120", 0.25 + 0.35 * warm);
    bun(ctx, p1, py - s * 0.002 + hop, s, warm);
    for (let i = 0; i < 4; i++) {                                   // steam from the bun
      const f = (t * 0.35 + i / 4) % 1, px = p1 + Math.sin(t * 1.3 + i * 2 + f * 5) * s * 0.025 * (0.4 + f);
      glow(ctx, px, py - s * 0.05 - f * s * (0.22 + 0.12 * warm), s * (0.035 + 0.05 * f), "255,248,236", (0.45 + 0.4 * warm) * (1 - f) * 0.75);
    }
  };
})();
