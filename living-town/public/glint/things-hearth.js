// Kindle's Grid: the Morning Hearth, a low ring of pale stones with a bed of embers, beside the bend of the Meadow Path
// (just south of the stones at (10,3)/(11,3)). It keeps the Meadow Path stones warm: things-meadowpath.js reads
// window.GLINT_HEARTH = { k, wave, from } and draws each stone with an amber heart, a melted ring of dark moss instead of a
// frost cap, and little curls of warm breath rising. Every so often (more often in the early morning, by the device clock)
// and on a tap, a warm pulse runs both ways along the stones from the bend (`from`, path index). Brighter (th._k) when a
// walker is on the path or near. `?pose=hearth` holds a pulse mid-way and the embers flared.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const H = window.GLINT_HEARTH = { k: 0.6, wave: null, from: 3.6 };
  const morning = () => { const h = new Date().getHours(); return h >= 5 && h < 10; };

  function stone(ctx, cx, cy, rw, rh, j) {
    ctx.fillStyle = "#6c6866"; ctx.beginPath(); ctx.ellipse(cx, cy + rh * 0.45, rw, rh, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = j % 2 ? "#d9d4cc" : "#cfd3cf"; ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,190,120,0.35)"; ctx.beginPath(); ctx.ellipse(cx, cy + rh * 0.25, rw * 0.7, rh * 0.5, 0, 0, Math.PI); ctx.fill();   // warm side
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.ellipse(cx - rw * 0.3, cy - rh * 0.3, rw * 0.4, rh * 0.35, 0, 0, TAU); ctx.fill();
  }

  T.hearth = function hearth(ctx, x, y, s, t, th = {}) {
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const near = ws.some(w => Math.hypot((w.fx ?? w.x) - (th.x + 0.5), (w.fy ?? w.y) - th.y) < 1.8);
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    const want = POSE === "hearth" || near ? 1 : 0.55;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 1.5);
    // a warm pulse along the stones: on a tap, and on its own every little while (twice as often in the early morning)
    if (th.tapped != null && th.tapped !== th._seenTap) { th._seenTap = th.tapped; th._wave = t; }
    const every = morning() ? 9 : 18;
    if (th._wave == null || t - th._wave > every) th._wave = t;
    H.k = th._k; H.from = th.from ?? 3.6;
    H.wave = POSE === "hearth" ? t - 1.2 : th._wave;
    const k = th._k, e = POSE === "hearth" ? 0.5 : t - th._wave;
    const flare = e >= 0 && e < 1.6 ? Math.sin(Math.PI * e / 1.6) : 0;
    const fl = 0.85 + 0.1 * Math.sin(t * 5.3) + 0.05 * Math.sin(t * 11.7);

    const sc = th.scale || 1;
    ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    const rx = s * 0.26, ry = s * 0.12;   // the ring of stones

    // the frost has melted all round it: dark soft moss, and a warm wash on the ground
    ctx.fillStyle = "rgba(14,52,40,0.85)"; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.75, ry * 2.0, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(34,96,62,0.6)"; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.45, ry * 1.65, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y - s * 0.05, s * (0.75 + 0.2 * flare), "255,160,80", (0.22 + 0.15 * k + 0.25 * flare) * fl);

    // two honey-wood logs stacked beside it, ready for the morning
    ctx.save(); ctx.translate(x + rx * 1.35, y + ry * 0.4);
    for (let j = 0; j < 2; j++) {
      const ly = -j * s * 0.045, lx = j * s * 0.015;
      ctx.fillStyle = "#a8742e"; ctx.fillRect(lx - s * 0.075, ly - s * 0.022, s * 0.15, s * 0.044);
      ctx.fillStyle = "#d9a24e"; ctx.fillRect(lx - s * 0.075, ly - s * 0.022, s * 0.15, s * 0.014);
      ctx.fillStyle = "#f1cf8a"; ctx.beginPath(); ctx.ellipse(lx + s * 0.075, ly, s * 0.016, s * 0.022, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#b8862e"; ctx.lineWidth = Math.max(1, s * 0.006); ctx.beginPath(); ctx.ellipse(lx + s * 0.075, ly, s * 0.008, s * 0.011, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // the stones round the back half of the ring
    const N = 9, ring = [];
    for (let j = 0; j < N; j++) { const a = Math.PI + (j / N) * TAU; ring.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry, Math.sin(a), j]); }
    ring.filter(p => p[2] <= 0).forEach(([cx, cy, , j]) => stone(ctx, cx, cy, s * 0.06, s * 0.04, j));

    // the bed of embers, glowing and breathing
    ctx.fillStyle = "#3a1d12"; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.85, ry * 0.8, 0, 0, TAU); ctx.fill();
    for (let j = 0; j < 11; j++) {
      const ex = x + (hash(j, 1) - 0.5) * rx * 1.4, ey = y + (hash(j, 2) - 0.5) * ry * 1.1;
      const b = 0.55 + 0.45 * Math.sin(t * (1.4 + hash(j, 3)) + j * 1.7);
      ctx.fillStyle = `rgb(${200 + 55 * b | 0},${70 + 90 * b | 0},${30 + 30 * b | 0})`;
      ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.03, s * 0.017, hash(j, 4), 0, TAU); ctx.fill();
    }
    glow(ctx, x, y, rx * 1.1, "255,140,60", (0.45 + 0.25 * flare) * fl);

    // little flames, licking up from the embers
    for (let j = 0; j < 3; j++) {
      const fx = x + (j - 1) * s * 0.07, fh = s * (0.13 + 0.04 * Math.sin(t * 6 + j * 2.1) + 0.07 * flare + 0.03 * k) * (j === 1 ? 1.25 : 0.9);
      const sway = Math.sin(t * 3.3 + j) * s * 0.012;
      ctx.fillStyle = "#ff8a3a"; ctx.beginPath();
      ctx.moveTo(fx - s * 0.04, y); ctx.quadraticCurveTo(fx - s * 0.03, y - fh * 0.6, fx + sway, y - fh);
      ctx.quadraticCurveTo(fx + s * 0.03, y - fh * 0.6, fx + s * 0.04, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffd36b"; ctx.beginPath();
      ctx.moveTo(fx - s * 0.02, y); ctx.quadraticCurveTo(fx - s * 0.015, y - fh * 0.4, fx + sway * 0.6, y - fh * 0.65);
      ctx.quadraticCurveTo(fx + s * 0.015, y - fh * 0.4, fx + s * 0.02, y); ctx.closePath(); ctx.fill();
    }
    glow(ctx, x, y - s * 0.1, s * 0.3, "255,200,110", (0.35 + 0.3 * flare) * fl);

    // a little gold grate across the top, with a gold star on its handle
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath(); ctx.moveTo(x - rx * 0.75, y - s * 0.02); ctx.lineTo(x + rx * 0.75, y - s * 0.02); ctx.stroke();
    for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(x + j * rx * 0.28, y - s * 0.02); ctx.lineTo(x + j * rx * 0.28, y + s * 0.012); ctx.stroke(); }

    // a round loaf toasting on the grate (`toast`), its crust going golden, a thread of steam rising from it
    if (th.toast) {
      const lx = x - rx * 0.15, ly = y - s * 0.06, gold = 0.5 + 0.5 * Math.sin(t * 0.4);
      ctx.fillStyle = "#7a3e18"; ctx.beginPath(); ctx.ellipse(lx, ly + s * 0.012, s * 0.095, s * 0.04, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgb(${200 + 30 * gold | 0},${120 + 30 * gold | 0},${50 + 10 * gold | 0})`;
      ctx.beginPath(); ctx.ellipse(lx, ly, s * 0.09, s * 0.06, 0, Math.PI, TAU); ctx.ellipse(lx, ly, s * 0.09, s * 0.025, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = "#f7d79a"; ctx.lineWidth = Math.max(1, s * 0.008);
      for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(lx + d * s * 0.025 - s * 0.01, ly - s * 0.035); ctx.lineTo(lx + d * s * 0.025 + s * 0.01, ly - s * 0.015); ctx.stroke(); }
      glow(ctx, lx, ly - s * 0.02, s * 0.1, "255,200,120", 0.3 + 0.2 * flare);
      for (let i = 0; i < 3; i++) {
        const f = (t * 0.4 + i / 3) % 1;
        glow(ctx, lx + Math.sin(t * 1.5 + i * 2) * s * 0.025, ly - s * 0.06 - f * s * 0.3, s * 0.035, "255,245,230", 0.4 * Math.sin(f * Math.PI));
      }
    }
    // the stones round the front half
    ring.filter(p => p[2] > 0).forEach(([cx, cy, , j]) => stone(ctx, cx, cy, s * 0.065, s * 0.045, j));
    // a gold star set in the front stone
    const fsx = x, fsy = y + ry - s * 0.005, sr = s * 0.022;
    ctx.fillStyle = "#ffd166"; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const r = j % 2 ? sr * 0.45 : sr, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(fsx + Math.cos(an) * r, fsy + Math.sin(an) * r); }
    ctx.closePath(); ctx.fill();

    // sparks lifting off, more when it flares
    const n = 5 + Math.round(5 * flare);
    for (let j = 0; j < n; j++) {
      const ph = (t * 0.45 + hash(j, 9)) % 1, px = x + (hash(j, 7) - 0.5) * rx + Math.sin(t * 2 + j) * s * 0.04 * ph, py = y - s * 0.1 - ph * s * 0.6;
      glow(ctx, px, py, s * 0.05, "255,190,100", 0.7 * (1 - ph));
      ctx.fillStyle = `rgba(255,240,200,${0.9 * (1 - ph)})`; ctx.fillRect(px - 1, py - 1, 2, 2);
    }
  };
})();
