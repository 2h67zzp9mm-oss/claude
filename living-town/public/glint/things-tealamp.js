// Kindle's Grid: the Teal Door Lantern (kind "tealamp"). A small teal-glass lantern on a gold wall bracket, fixed to the
// front wall of the First Little House just west of its teal door. Drawn as its own flat thing at (house.x, house.y+0.01)
// so it sorts right after the cottage; geometry copies the cottage's (b = y+0.45s, w = 0.88s, door centre x-0.37s).
// It fades with the house's front wall when the room opens (th.house = cottage name, reads its roomK).
// Lamp Song: things-lampsong.js lists it in heads() with a teal note colour and publishes window.GLINT_SONG
// ({ since, bx, by, step }); when the hum reaches this lantern (delay = distance * step) it swells and rings.
// It also echoes the Humming Lamp's little 4.5 s note a moment later, very softly. Brighter after dark (device clock)
// and when a walker stands on the doorstep. Tap = 4 s hum. `?pose=tune` holds the full hum. Stub in things.js.
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
  const POSE = new URLSearchParams(location.search).get("pose");
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  function darkness() {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  }
  const TEAL = "110,245,225";

  function note(ctx, nx, ny, r, rgb, a) {
    if (a <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    glow(ctx, nx, ny, r * 3, rgb, 0.5 * a);
    ctx.fillStyle = `rgb(${rgb})`; ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.beginPath(); ctx.ellipse(nx, ny, r, r * 0.72, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(nx + r * 0.85, ny); ctx.lineTo(nx + r * 0.85, ny - r * 3.2);
    ctx.quadraticCurveTo(nx + r * 2.2, ny - r * 2.4, nx + r * 1.8, ny - r * 1.4); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.tealamp = function tealamp(ctx, x, y, s, t, th = {}) {
    const W = window.GLINT_WORLD;
    const house = W && W.things.find(o => o.name === (th.house || "First Little House"));
    const ro = house ? (house.roomK || 0) : 0, fade = Math.max(0, 1 - 1.15 * ro * ro * (3 - 2 * ro));
    if (fade <= 0.01) return;

    // the hum: from the Lamp Song (when it reaches here), a tap, or the pose
    const S = window.GLINT_SONG, hx0 = (th.x || 0) - 0.26, hy0 = (th.y || 0) + 0.31;   // world spot of the glass (matches heads())
    let hum = 0;
    if (S && S.since < 90) { const u = S.since - Math.hypot(hx0 - S.bx, hy0 - S.by) * S.step; if (u > 0 && u < 2.4) hum = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 2.15; }
    if (th.tapped != null && t - th.tapped < 4) hum = Math.max(hum, Math.sin(Math.min(1, (t - th.tapped) / 4) * Math.PI));
    if (POSE === "tune") hum = 1;
    // someone on the doorstep
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const step = ws.some(w => { const wx = (w.fx ?? w.x), wy = (w.fy ?? w.y); return wx != null && Math.abs(wy - 18) < 0.6 && wx > 12.4 && wx < 14.6; });
    th._n = (th._n ?? 0) + ((step ? 1 : 0) - (th._n ?? 0)) * 0.05;
    const fl = 0.88 + 0.08 * Math.sin(t * 5.3) + 0.04 * Math.sin(t * 12.1);
    const k = Math.min(1.8, (0.45 + 0.45 * darkness() + 0.35 * th._n + 0.8 * hum) * fl);

    ctx.save(); ctx.globalAlpha = fade;
    const b = y + s * 0.45;
    const mx = x - s * 0.66, my = b - s * 0.8;            // where the bracket meets the wall
    const hx = x - s * 0.76, hy = b - s * 0.86;           // the hook at the end of the arm
    // teal light washing the wall and the doorstep
    glow(ctx, hx, hy + s * 0.2, s * (0.45 + 0.18 * k), TEAL, 0.14 + 0.12 * k);
    ctx.save(); ctx.translate(x - s * 0.45, b + s * 0.12); ctx.scale(1, 0.4);
    glow(ctx, 0, 0, s * (0.5 + 0.15 * k), TEAL, 0.08 + 0.1 * k); ctx.restore();

    // gold wall plate and curled bracket
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(mx - s * 0.025, my - s * 0.07, s * 0.05, s * 0.14);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(mx - s * 0.018, my - s * 0.062, s * 0.022, s * 0.124);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.022); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx - s * 0.04, hy - s * 0.04, hx, hy); ctx.stroke();
    ctx.lineWidth = Math.max(0.7, s * 0.012);
    ctx.beginPath(); ctx.arc(mx - s * 0.05, my + s * 0.01, s * 0.03, -0.3, Math.PI * 1.2); ctx.stroke();   // the little curl under the arm

    // the lantern, swinging a touch (more while it hums)
    const sw = Math.sin(t * 1.4) * 0.05 + hum * 0.12 * Math.sin(t * 8);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw); ctx.scale(1.35, 1.35);
    const lw = s * 0.07, lh = s * 0.17, y0 = s * 0.05, cy = y0 + lh * 0.55;
    glow(ctx, 0, cy, s * (0.2 + 0.14 * k), TEAL, 0.3 + 0.3 * k);
    glow(ctx, 0, cy, s * (0.06 + 0.04 * k), "255,205,130", 0.15 + 0.2 * k);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, s * 0.012);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, y0); ctx.stroke();
    // a pointed gold cap with a ring
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.moveTo(-lw * 1.3, y0 + s * 0.03); ctx.lineTo(0, y0 - s * 0.03); ctx.lineTo(lw * 1.3, y0 + s * 0.03); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(-lw * 1.3, y0 + s * 0.022, lw * 2.6, s * 0.016);
    // teal glass, six-sided, warm in the middle
    const gy = y0 + s * 0.038, gh = lh;
    const g = ctx.createRadialGradient(0, cy, 0, 0, cy, gh * 0.85);
    g.addColorStop(0, "#effffb"); g.addColorStop(0.25, "#9ff7ea"); g.addColorStop(0.7, "#27c9c2"); g.addColorStop(1, "#127a80");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-lw, gy); ctx.lineTo(lw, gy); ctx.lineTo(lw * 1.15, gy + gh * 0.5); ctx.lineTo(lw * 0.8, gy + gh);
    ctx.lineTo(-lw * 0.8, gy + gh); ctx.lineTo(-lw * 1.15, gy + gh * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,209,102,0.9)"; ctx.lineWidth = Math.max(0.5, s * 0.008);
    ctx.beginPath(); ctx.moveTo(-lw * 0.35, gy); ctx.lineTo(-lw * 0.3, gy + gh); ctx.moveTo(lw * 0.35, gy); ctx.lineTo(lw * 0.3, gy + gh); ctx.stroke();
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(-lw * 0.9, gy + gh - s * 0.004, lw * 1.8, s * 0.02);
    // a tiny teal bell hangs underneath: it rings when the lantern hums
    const bs = Math.sin(t * 10) * 0.5 * hum;
    ctx.save(); ctx.translate(0, gy + gh + s * 0.016); ctx.rotate(bs);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(-s * 0.003, 0, s * 0.006, s * 0.02);
    ctx.fillStyle = "#6ff5e1"; ctx.beginPath(); ctx.moveTo(-s * 0.012, s * 0.02); ctx.quadraticCurveTo(-s * 0.016, s * 0.045, -s * 0.03, s * 0.055);
    ctx.lineTo(s * 0.03, s * 0.055); ctx.quadraticCurveTo(s * 0.016, s * 0.045, s * 0.012, s * 0.02); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(0, s * 0.062, s * 0.009, 0, TAU); ctx.fill();
    ctx.restore();
    // the flame
    const fh = lh * (0.32 + 0.08 * fl + 0.14 * hum);
    ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.ellipse(0, cy + lh * 0.12, lw * 0.3, fh * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffbe6"; ctx.beginPath(); ctx.ellipse(0, cy + lh * 0.16, lw * 0.17, fh * 0.36, 0, 0, TAU); ctx.fill();
    ctx.restore();

    const lx = hx, ly = hy + s * 0.22;
    // humming: a teal ring spreads and a note floats up
    if (hum > 0.02) {
      ctx.strokeStyle = `rgba(${TEAL},${0.55 * hum})`; ctx.lineWidth = Math.max(1, s * 0.018);
      const rr = s * (0.14 + ((t * 0.9) % 1) * 0.3);
      ctx.beginPath(); ctx.arc(lx, ly, rr, 0, TAU); ctx.stroke();
      const q = (t * 0.7) % 1;
      note(ctx, lx - s * 0.08 + Math.sin(q * 6) * s * 0.06, ly - s * (0.25 + q * 0.5), s * 0.06, TEAL, hum * Math.sin(q * Math.PI) * 1.4);
    }
    // the echo: just after the Humming Lamp's own little note, a small teal one here
    { const p = ((t - 1.2) % 4.5 + 4.5) % 4.5 / 4.5;
      if (p < 0.6) { const e = p / 0.6; note(ctx, lx + s * 0.05, ly - s * (0.2 + e * 0.35), s * 0.04, TEAL, Math.sin(e * Math.PI) * 0.55); } }
    ctx.restore();
  };
})();
