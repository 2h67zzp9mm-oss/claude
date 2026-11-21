// Kindle's Grid: the Cooling Shelf beside the bakery's amber window (kind "cooling"). A honey-wood rack of three
// slatted shelves with gold posts, standing in the window's fan of light. Top: glowberry rolls (pink caps), middle:
// two round scored loaves, bottom: honey buns with a gold spiral glaze. Every tier steams, and golden wisps of bread
// smell drift off west toward Lantern Street. A tap (4 s) or anyone standing close makes the bread glow, the steam
// billow and the loaves give a little hop. `?pose=cool` holds the tap. Loads after things.js (stub `cooling() {}`).
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

  function steam(ctx, x, y, s, t, seed, amount, height) {
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.32 + seed * 0.41 + i / 3) % 1;
      const px = x + Math.sin(t * 1.2 + seed * 2.3 + f * 5) * s * 0.05 * (0.4 + f);
      glow(ctx, px, y - f * s * height, s * (0.04 + 0.06 * f), "255,248,236", amount * (1 - f) * 0.7);
    }
  }
  function roundLoaf(ctx, x, y, s, k) {   // a round scored loaf sitting on y
    ctx.fillStyle = "#b8682a"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.085, s * 0.06, 0, Math.PI, TAU); ctx.fill();
    ctx.fillRect(x - s * 0.085, y - s * 0.002, s * 0.17, s * 0.014);
    ctx.fillStyle = "#e3a04e"; ctx.beginPath(); ctx.ellipse(x - s * 0.015, y - s * 0.025, s * 0.058, s * 0.03, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,240,200,${0.8 + 0.2 * k})`; ctx.lineWidth = Math.max(1, s * 0.01);
    ctx.beginPath(); ctx.moveTo(x - s * 0.045, y - s * 0.03); ctx.lineTo(x + s * 0.045, y - s * 0.03); ctx.moveTo(x - s * 0.02, y - s * 0.05); ctx.lineTo(x + s * 0.02, y - s * 0.012); ctx.stroke();
  }
  function bun(ctx, x, y, s) {             // a honey bun with a gold spiral of glaze
    ctx.fillStyle = "#c97a32"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.045, s * 0.035, 0, Math.PI, TAU); ctx.fill();
    ctx.fillRect(x - s * 0.045, y - s * 0.002, s * 0.09, s * 0.01);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.009);
    ctx.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.4) { const r = s * 0.008 * a, px = x + Math.cos(a) * r, py = y - s * 0.018 + Math.sin(a) * r * 0.5; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  }
  function roll(ctx, x, y, s, t, i) {      // a glowberry roll: small, with a pink cap and a sparkle
    ctx.fillStyle = "#d48a3e"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.05, s * 0.042, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#ff78c4"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.03, s * 0.034, s * 0.018, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#ffd0ea"; ctx.beginPath(); ctx.arc(x - s * 0.01, y - s * 0.04, Math.max(0.8, s * 0.008), 0, TAU); ctx.fill();
    glow(ctx, x, y - s * 0.03, s * 0.1, "255,130,200", 0.25 + 0.15 * Math.sin(t * 2 + i * 1.7));
  }

  T.cooling = function cooling(ctx, x, y, s, t, th = {}) {
    const e = POSE === "cool" ? 1.5 : th.tapped != null ? t - th.tapped : 99;
    const tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    const near = (window.GLINT_GRID?.walkers || []).reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) - th.x, (w.fy ?? w.y) - th.y - 0.6) / 1.6), 0);
    const warm = Math.max(tap, 0.6 * near);
    const hop = k => -Math.max(0, Math.sin(t * 9 + k)) * s * 0.025 * tap;

    const ox = x - s * 0.26, b = y + s * 0.3;
    ctx.translate(ox, b); ctx.scale(1.6, 1.6); ctx.translate(-ox, -b);   // drawn larger so it reads on a small screen
    const W = s * 0.3, dpx = s * 0.09, dpy = s * 0.06, H = s * 0.84;      // half width, depth offset (back is up-right), height
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(ox + dpx / 2, b + s * 0.01, W * 1.25, s * 0.07, 0, 0, TAU); ctx.fill();
    glow(ctx, ox, b - H * 0.5, s * (0.6 + 0.15 * warm), "255,180,90", 0.18 + 0.04 * Math.sin(t * 1.1) + 0.3 * warm);

    // back posts
    ctx.fillStyle = "#7a4520";
    for (const d of [-1, 1]) ctx.fillRect(ox + d * W + dpx - s * 0.018, b - dpy - H, s * 0.036, H);
    // three slatted shelves, bottom to top, each with its bread
    const tiers = [0.14, 0.4, 0.66];
    tiers.forEach((v, n) => {
      const yy = b - s * v;   // the shelf's front edge
      poly(ctx, [[ox - W, yy], [ox + W, yy], [ox + W + dpx, yy - dpy], [ox - W + dpx, yy - dpy]], "#d39248");
      ctx.strokeStyle = "rgba(122,69,32,0.7)"; ctx.lineWidth = Math.max(1, s * 0.008);
      for (let i = 1; i < 3; i++) { const f = i / 3; ctx.beginPath(); ctx.moveTo(ox - W + dpx * f, yy - dpy * f); ctx.lineTo(ox + W + dpx * f, yy - dpy * f); ctx.stroke(); }
      poly(ctx, [[ox - W, yy], [ox + W, yy], [ox + W, yy + s * 0.025], [ox - W, yy + s * 0.025]], "#9c5a28");
      ctx.fillStyle = "#ffd166"; ctx.fillRect(ox - W, yy + s * 0.022, W * 2, Math.max(1, s * 0.008));   // gold lip
      const by = yy - dpy * 0.45;
      if (n === 0) [-0.7, -0.24, 0.24, 0.7].forEach((f, i) => bun(ctx, ox + f * W + dpx * 0.45, by + hop(i), s));
      if (n === 1) [-0.45, 0.45].forEach((f, i) => { const lx = ox + f * W + dpx * 0.45; glow(ctx, lx, by - s * 0.04, s * (0.14 + 0.08 * warm), "255,170,80", 0.25 + 0.08 * Math.sin(t * 2 + i) + 0.45 * warm); roundLoaf(ctx, lx, by + hop(i + 2), s, warm); });
      if (n === 2) [-0.62, 0, 0.62].forEach((f, i) => roll(ctx, ox + f * W + dpx * 0.45, by + hop(i + 4), s, t, i));
      [-0.45, 0.45].forEach((f, i) => steam(ctx, ox + f * W + dpx * 0.45, by - s * 0.06, s, t, n * 2 + i, 0.4 + 0.5 * warm, 0.22 + 0.18 * warm));
    });
    // front posts with gold caps and feet
    for (const d of [-1, 1]) {
      const px = ox + d * W;
      ctx.fillStyle = "#8a4f24"; ctx.fillRect(px - s * 0.022, b - H, s * 0.044, H);
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(px - s * 0.022, b - H, s * 0.014, H);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(px - s * 0.03, b - s * 0.03, s * 0.06, s * 0.03);
      ctx.beginPath(); ctx.arc(px, b - H - s * 0.012, s * 0.026, 0, TAU); ctx.fill();
    }
    // a little gold wheat gem on a crossbar at the top
    ctx.fillStyle = "#9c5a28"; ctx.fillRect(ox - W, b - H + s * 0.01, W * 2, s * 0.022);
    const gy = b - H - s * 0.02;
    glow(ctx, ox, gy, s * 0.12, "255,214,120", 0.4 + 0.2 * Math.sin(t * 1.6) + 0.3 * warm);
    poly(ctx, [[ox, gy - s * 0.06], [ox - s * 0.035, gy], [ox, gy]], "#fff6d6"); poly(ctx, [[ox, gy - s * 0.06], [ox + s * 0.035, gy], [ox, gy]], "#ffd166");
    poly(ctx, [[ox, gy + s * 0.04], [ox - s * 0.035, gy], [ox, gy]], "#ffd166"); poly(ctx, [[ox, gy + s * 0.04], [ox + s * 0.035, gy], [ox, gy]], "#e09a2b");

    // golden wisps of bread smell, drifting west toward Lantern Street and the Doorstep Bench
    for (let i = 0; i < 4; i++) {
      const f = (t * 0.1 + i / 4) % 1;
      glow(ctx, ox - f * s * 1.4, b - H * (0.4 + 0.25 * (i % 2)) - Math.sin(f * Math.PI) * s * 0.2 + Math.sin(t + i * 2) * s * 0.03,
        s * (0.06 + 0.06 * f), "255,205,120", (0.3 + 0.4 * warm) * Math.sin(f * Math.PI));
    }
  };
})();
