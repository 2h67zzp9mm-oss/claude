// Kindle's Grid: the Bun Table at the street end of the Doorstep Bench (kind "table"). A small round honey-wood table
// with a glowberry-pink cloth and gold rim; on top a warm loaf on a little board (scored crust, steam curls) and a pink
// cup that steams too; on a shelf underneath, a spare folded pink cushion "for whoever comes".
// Golden bread-smell wisps drift off toward Lantern Street. Someone sitting on the Doorstep Bench, or a tap (4 s), makes
// the loaf glow and the steam billow, and the spare cushion lifts with a few pink sparks. `?pose=warm` holds the tap.
// Loads after things.js (which has a stub `table() {}` for the test).
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

  // a curl of steam rising from (x, y): three soft puffs on a wavy line, fading as they rise
  function steam(ctx, x, y, s, t, seed, amount, height) {
    for (let i = 0; i < 4; i++) {
      const f = (t * 0.35 + seed * 0.37 + i / 4) % 1;
      const px = x + Math.sin(t * 1.3 + seed * 2 + f * 5) * s * 0.05 * (0.4 + f);
      glow(ctx, px, y - f * s * height, s * (0.05 + 0.07 * f), "255,248,236", amount * (1 - f) * 0.75);
    }
  }

  T.table = function table(ctx, x, y, s, t, th = {}) {
    const bench = (window.GLINT_WORLD?.things || []).find(b => b.kind === "bench" && b.wood);
    const sat = (window.GLINT_GRID?.walkers || []).some(k => k.seated && k.bench === bench);
    const e = POSE === "warm" ? 1.4 : th.tapped != null ? t - th.tapped : 99;
    const tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    const warm = Math.max(tap, sat ? 0.55 : 0);

    ctx.translate(x, y + s * 0.3); ctx.scale(1.4, 1.4); ctx.translate(-x, -(y + s * 0.3));   // drawn larger so it reads on a small screen
    const b = y + s * 0.3, R = s * 0.17, top = b - s * 0.36, shelf = b - s * 0.12;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.02, R * 1.15, s * 0.07, 0, 0, TAU); ctx.fill();
    glow(ctx, x, top, s * (0.45 + 0.2 * warm), "255,190,110", 0.2 + 0.05 * Math.sin(t * 1.2) + 0.35 * warm);

    // three legs (one behind, two in front) and the little shelf with the spare cushion
    ctx.fillStyle = "#7a4520"; ctx.fillRect(x - s * 0.02, top + s * 0.02, s * 0.04, b - top - s * 0.06);
    poly(ctx, [[x - R * 0.85, shelf], [x + R * 0.85, shelf], [x + R * 0.8, shelf + s * 0.035], [x - R * 0.8, shelf + s * 0.035]], "#b06a32");
    poly(ctx, [[x - R * 0.75, shelf - s * 0.025], [x + R * 0.75, shelf - s * 0.025], [x + R * 0.85, shelf], [x - R * 0.85, shelf]], "#d39248");
    const lift = s * 0.02 * tap, cy = shelf - s * 0.025 - lift;            // the spare cushion, folded, with a gold button
    poly(ctx, [[x - R * 0.62, cy], [x - R * 0.52, cy - s * 0.06], [x + R * 0.52, cy - s * 0.06], [x + R * 0.62, cy]], "#ff78c4");
    poly(ctx, [[x - R * 0.45, cy - s * 0.035], [x - R * 0.4, cy - s * 0.06], [x + R * 0.4, cy - s * 0.06], [x + R * 0.45, cy - s * 0.035]], "#ffb3de");
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x, cy - s * 0.035, Math.max(1, s * 0.012), 0, TAU); ctx.fill();
    glow(ctx, x, cy - s * 0.03, s * 0.16, "255,130,200", 0.15 + 0.12 * Math.sin(t * 1.4) + 0.4 * tap);
    for (const d of [-1, 1]) {
      const lx = x + d * R * 0.72;
      poly(ctx, [[lx - s * 0.022, top + s * 0.03], [lx + s * 0.022, top + s * 0.03], [lx + s * 0.022 + d * s * 0.02, b - s * 0.02], [lx - s * 0.022 + d * s * 0.02, b - s * 0.02]], "#8a4f24");
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(lx - s * 0.022, top + s * 0.04, s * 0.014, b - top - s * 0.08);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - s * 0.03 + d * s * 0.02, b - s * 0.03, s * 0.06, s * 0.03);   // gold feet, like the bench
    }

    // the round top: front edge, honey-wood top, glowberry-pink cloth with a gold rim, scalloped hem
    ctx.fillStyle = "#8a4f24"; ctx.beginPath(); ctx.ellipse(x, top + s * 0.03, R, R * 0.42, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#e0a05a"; ctx.beginPath(); ctx.ellipse(x, top, R, R * 0.42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ff78c4"; ctx.beginPath(); ctx.ellipse(x, top, R * 0.72, R * 0.3, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.15 + 0.7 * i / 4); ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.72, top + Math.sin(a) * R * 0.3, s * 0.018, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012); ctx.beginPath(); ctx.ellipse(x, top, R * 0.72, R * 0.3, 0, 0, TAU); ctx.stroke();

    // the warm loaf on its little board
    const lxp = x - R * 0.2, ly = top - s * 0.005;
    poly(ctx, [[lxp - s * 0.1, ly + s * 0.012], [lxp + s * 0.1, ly + s * 0.012], [lxp + s * 0.085, ly + s * 0.032], [lxp - s * 0.085, ly + s * 0.032]], "#9c5a28");
    glow(ctx, lxp, ly - s * 0.03, s * (0.16 + 0.1 * warm), "255,170,80", 0.3 + 0.1 * Math.sin(t * 2) + 0.5 * warm);
    ctx.fillStyle = "#c9782e"; ctx.beginPath(); ctx.ellipse(lxp, ly - s * 0.02, s * 0.085, s * 0.042, 0, Math.PI, TAU); ctx.fill();
    ctx.fillRect(lxp - s * 0.085, ly - s * 0.02, s * 0.17, s * 0.03);
    ctx.fillStyle = "#e7a24c"; ctx.beginPath(); ctx.ellipse(lxp - s * 0.01, ly - s * 0.035, s * 0.06, s * 0.024, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = "#fff0c8"; ctx.lineWidth = Math.max(1, s * 0.01);
    for (const o of [-0.04, 0, 0.04]) { ctx.beginPath(); ctx.moveTo(lxp + s * (o - 0.015), ly - s * 0.03); ctx.lineTo(lxp + s * (o + 0.015), ly - s * 0.05); ctx.stroke(); }

    // a pink cup with a gold rim
    const cx = x + R * 0.48, cuy = top - s * 0.01;
    ctx.fillStyle = "#d94f9e"; ctx.fillRect(cx - s * 0.03, cuy - s * 0.055, s * 0.06, s * 0.055);
    ctx.fillStyle = "#ff9fd6"; ctx.fillRect(cx - s * 0.03, cuy - s * 0.055, s * 0.018, s * 0.055);
    ctx.strokeStyle = "#d94f9e"; ctx.lineWidth = Math.max(1, s * 0.012); ctx.beginPath(); ctx.arc(cx + s * 0.035, cuy - s * 0.03, s * 0.016, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(cx, cuy - s * 0.055, s * 0.03, s * 0.01, 0, 0, TAU); ctx.fill();

    // steam from the loaf and the cup, and golden wisps of bread smell drifting out toward the street
    steam(ctx, lxp, ly - s * 0.06, s, t, 0, 0.55 + 0.45 * warm, 0.35 + 0.25 * warm);
    steam(ctx, cx, cuy - s * 0.07, s, t, 1.7, 0.35 + 0.3 * warm, 0.25 + 0.15 * warm);
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.12 + i / 3) % 1;
      glow(ctx, lxp + f * s * 0.9, ly - s * 0.15 - Math.sin(f * Math.PI) * s * 0.18 + Math.sin(t + i * 2) * s * 0.03, s * (0.06 + 0.05 * f), "255,205,120", (0.3 + 0.4 * warm) * Math.sin(f * Math.PI));
    }
    if (tap > 0) for (let i = 0; i < 5; i++) {                // pink sparks off the spare cushion
      const f = (t * 0.6 + i / 5) % 1;
      glow(ctx, x + Math.sin(t * 2 + i * 2.1) * R * 0.8 * f, cy - s * 0.04 - f * s * 0.3, s * 0.045, "255,170,220", tap * (1 - f));
    }
  };
})();
