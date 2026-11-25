// Kindle's Grid: the Spark Lamp (kind "sparklamp"), standing in the Lamp Spot's socket out in the West Meadow.
// Same footing stone, gold star ring and three stepping stones as the Lamp Spot (which it replaces), now with a slim
// honey post banded in gold, a gold crown, and a round clear-glass globe on top. The globe holds sparks that swirl
// inside. Every few seconds a new spark drifts in from the east (from the Spark Fountain, his wish) on a long arc,
// drops into the globe, and the globe takes on its colour; the light pool on the moss follows. Tap, a walker close,
// or the West Lamp's wave: the sparks whirl faster, the star ring lights round, and an extra spark arrives at once.
// `?pose=sparklamp` holds night + a spark in flight. Loads after things.js (stub `sparklamp() {}`).
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  const COLS = ["120,235,220", "190,150,255", "255,150,205", "255,190,90", "255,225,120", "140,200,255"];
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function pool(ctx, x, y, rx, ry, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); glow(ctx, 0, 0, rx, rgb, a); ctx.restore();
  }
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  const mix = (a, b, k) => a.split(",").map((v, i) => Math.round(+v + (+b.split(",")[i] - v) * k)).join(",");
  function darkness() {
    if (POSE === "sparklamp") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  }
  function flatStone(ctx, x, y, rx, ry, lit, rgb) {
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x + rx * 0.08, y + ry * 0.35, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#8f98a8"; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.18, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#d9dee6"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.3, 0, 0, TAU); ctx.fill();
    if (lit > 0) glow(ctx, x, y, rx * 1.6, rgb || "255,205,120", 0.45 * lit);
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.sparklamp = function sparklamp(ctx, x, y, s, t, th = {}) {
    const things = window.GLINT_WORLD?.things || [];
    const lamp = things.find(o => o.kind === "westlamp");
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const near = Math.min(99, ...ws.map(w => Math.hypot((w.fx ?? w.x) - (th.x + 0.5), (w.fy ?? w.y) - (th.y + 0.5))));
    const le = lamp && lamp.tapped != null ? t - lamp.tapped : 99;
    const e = POSE === "sparklamp" ? 1.2 : Math.min(th.tapped != null ? t - th.tapped : 99, le - 1.3);
    const want = Math.max(e >= 0 && e < 5 ? 1 : 0, Math.max(0, 1 - near / 1.4));
    th._w = (th._w ?? want) + (want - (th._w ?? want)) * 0.05;
    const w = th._w, dark = darkness();
    const S = s * (th.scale || 1.3);

    // --- the spark arrivals: one every PERIOD seconds, plus an extra one on a tap / wave ---
    const PERIOD = 6, FLY = 2.6;
    if (th._next == null) { th._next = t + 1; th._col = COLS[3]; th._prev = COLS[3]; th._land = -99; th._flights = []; }
    if (POSE === "sparklamp" && !th._posed) { th._posed = 1; th._flights.push({ t0: t - 1.4, c: COLS[1] }); th._col = th._prev = COLS[0]; }
    if (t >= th._next) { th._next = t + PERIOD; th._flights.push({ t0: t, c: COLS[(Math.floor(t / PERIOD) * 5 + 1) % COLS.length] }); }
    if (e >= 0 && e < 1 && th._burst !== t - e) { th._burst = t - e; th._flights.push({ t0: t, c: COLS[Math.floor(t * 7) % COLS.length], fast: 1 }); }
    const H = S * 0.72, gx = x, gy = y - H - S * 0.07, GR = S * 0.12;     // globe centre + radius
    th._flights = th._flights.filter(f => {
      const fly = f.fast ? FLY * 0.6 : FLY;
      if (t - f.t0 >= fly) { th._prev = mix(th._prev, th._col, smooth(0, 1.5, t - th._land)); th._col = f.c; th._land = t; return false; }
      return true;
    });
    const ck = smooth(0, 1.5, t - th._land), col = mix(th._prev, th._col, ck);
    const flash = Math.max(0, 1 - (t - th._land) / 1.2);
    const k = Math.min(1.6, 0.4 + 0.5 * dark + 0.45 * w + 0.4 * flash);

    // light on the moss, in the globe's colour (drawn first, under everything)
    pool(ctx, x, y + s * 0.03, s * (0.75 + 0.2 * k), s * 0.32, col, 0.1 + 0.16 * k);
    pool(ctx, x, y + s * 0.03, s * 0.4, s * 0.17, "255,225,160", 0.08 + 0.1 * k);

    // stepping stones back toward the West Lamp (east), lighting in turn as its wave passes
    // Ember Pot warmth (things-emberpot.js): melted moss ring, amber heart, warm breath, a pulse running west from the pot
    const EM = window.GLINT_EMBER;
    const steps = th.steps || [];
    steps.forEach(([sx, sy], i) => {
      const px = x + (sx - th.x) * s, py = y + (sy - th.y) * s;
      const lit = le > 0.3 + i * 0.35 && le < 4 + i * 0.3 ? Math.sin(Math.min(1, (le - 0.3 - i * 0.35) / 2) * Math.PI) : 0;
      let hp = 0;
      if (EM) {
        // the pulse comes up the ember line at the east step, then runs west to the Spark Lamp
        const d = EM.wave != null ? (t - EM.wave) * 2.6 : -9, along = Math.abs(sx - steps[Math.min(2, steps.length - 1)][0]);
        hp = d > -1 && d < 5 ? Math.max(0, 1 - Math.abs(along - d) / 0.55) : 0;
        ctx.fillStyle = "rgba(14,52,40,0.8)"; ctx.beginPath(); ctx.ellipse(px, py + s * 0.02, s * 0.26, s * 0.15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(34,96,62,0.55)"; ctx.beginPath(); ctx.ellipse(px, py + s * 0.02, s * 0.21, s * 0.12, 0, 0, TAU); ctx.fill();
      }
      flatStone(ctx, px, py, s * 0.17, s * 0.1, Math.max(lit, 0.15 + 0.25 * dark), i === 0 ? col : null);
      if (EM) {
        const wk = 0.55 + 0.45 * EM.k, b = (0.75 + 0.25 * Math.sin(t * 1.7 + i * 2.3)) * wk + hp;
        ctx.fillStyle = `rgba(255,${150 + 60 * Math.min(1, hp) | 0},70,${0.32 + 0.25 * b})`;
        ctx.beginPath(); ctx.ellipse(px, py + s * 0.01, s * 0.08, s * 0.045, 0, 0, TAU); ctx.fill();
        glow(ctx, px, py, s * (0.2 + 0.12 * hp), "255,160,80", 0.18 * b + 0.15 * dark);
        for (let j = 0; j < 2; j++) {   // little curls of warm breath
          const q = ((t * 0.3 + j * 0.5 + i * 0.27) % 1), cx = px + Math.sin(q * 6 + i + j) * s * 0.03, cy = py - s * 0.04 - q * s * (0.22 + 0.15 * hp);
          ctx.strokeStyle = `rgba(255,236,210,${(0.28 + 0.3 * hp) * (1 - q)})`; ctx.lineWidth = Math.max(1, s * 0.01);
          ctx.beginPath(); ctx.arc(cx, cy, s * 0.025, 0.3, Math.PI * 1.5); ctx.stroke();
        }
      }
    });

    // the footing stone with its gold star ring; the stars light round on a tap
    const R = S * 0.3, ry = R * 0.62;
    flatStone(ctx, x, y, R, ry, 0);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.014);
    ctx.beginPath(); ctx.ellipse(x, y, R * 0.72, ry * 0.72, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const an = i / 8 * TAU + 0.2, sx = x + Math.cos(an) * R * 0.72, sy = y + Math.sin(an) * ry * 0.72;
      const lit = e >= 0 && e < 5 ? Math.sin(Math.min(1, Math.max(0, (e - i * 0.12) / 1.6)) * Math.PI) : 0;
      if (lit > 0.05) glow(ctx, sx, sy, S * 0.09, COLS[i % COLS.length], 0.6 * lit);
      star(ctx, sx, sy, S * (0.028 + 0.015 * lit), "#ffd166");
    }

    // the post: slim honey wood from the socket, gold foot, gold bands
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x + S * 0.02, y + S * 0.01, S * 0.07, S * 0.025, 0, 0, TAU); ctx.fill();
    const pw = S * 0.032;
    ctx.fillStyle = "#e09a2b";
    ctx.beginPath(); ctx.moveTo(x - pw * 2.2, y); ctx.lineTo(x + pw * 2.2, y); ctx.lineTo(x + pw * 1.2, y - S * 0.05); ctx.lineTo(x - pw * 1.2, y - S * 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c9893f"; ctx.fillRect(x - pw, gy + GR, pw * 2, y - S * 0.045 - gy - GR);
    ctx.fillStyle = "#e7ad62"; ctx.fillRect(x - pw, gy + GR, pw * 0.8, y - S * 0.045 - gy - GR);
    ctx.fillStyle = "#ffd166"; [0.25, 0.55].forEach(q => ctx.fillRect(x - pw * 1.3, y - H * q, pw * 2.6, S * 0.018));
    // gold cup that holds the globe
    ctx.fillStyle = "#e09a2b";
    ctx.beginPath(); ctx.moveTo(x - GR * 0.9, gy + GR * 0.55); ctx.quadraticCurveTo(x, gy + GR * 1.6, x + GR * 0.9, gy + GR * 0.55); ctx.closePath(); ctx.fill();

    // the globe: clear glass tinted by the last spark, with sparks swirling inside
    glow(ctx, gx, gy, S * (0.26 + 0.12 * k), col, 0.3 + 0.3 * k);
    const gg = ctx.createRadialGradient(gx - GR * 0.3, gy - GR * 0.35, 0, gx, gy, GR);
    gg.addColorStop(0, "rgba(255,255,255,0.85)"); gg.addColorStop(0.3, `rgba(${col},0.85)`); gg.addColorStop(1, `rgba(${mix(col, "40,30,80", 0.35)},0.9)`);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, GR, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = Math.max(0.8, S * 0.008);
    ctx.beginPath(); ctx.arc(gx, gy, GR, 0, TAU); ctx.stroke();
    const spin = 1.4 + 3 * w;
    for (let i = 0; i < 5; i++) {
      const an = t * spin + i * TAU / 5, rr = GR * (0.35 + 0.25 * Math.sin(t * 1.3 + i));
      const px = gx + Math.cos(an) * rr, py = gy + Math.sin(an) * rr * 0.75;
      glow(ctx, px, py, S * 0.03 + 1, COLS[i], 0.7);
      ctx.fillStyle = "#fffbe6"; ctx.beginPath(); ctx.arc(px, py, Math.max(0.7, S * 0.007), 0, TAU); ctx.fill();
    }
    glow(ctx, gx, gy, GR * (0.4 + 0.5 * flash), "255,250,230", 0.25 + 0.5 * flash);
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.ellipse(gx - GR * 0.38, gy - GR * 0.4, GR * 0.2, GR * 0.12, -0.6, 0, TAU); ctx.fill();
    // gold crown and star on top
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.moveTo(gx - GR * 0.55, gy - GR * 0.82); ctx.quadraticCurveTo(gx, gy - GR * 1.35, gx + GR * 0.55, gy - GR * 0.82); ctx.closePath(); ctx.fill();
    star(ctx, gx, gy - GR * 1.55, S * (0.032 + 0.012 * flash), "#ffd166");
    if (flash > 0) glow(ctx, gx, gy - GR * 1.55, S * 0.12, "255,225,140", 0.6 * flash);

    // sparks in flight: a long arc in from the east (from the fountain), with a little trail
    th._flights.forEach(f => {
      const fly = f.fast ? FLY * 0.6 : FLY, q = (t - f.t0) / fly;
      const sx0 = x + s * 3.4, sy0 = y - s * 1.1;
      const pt = (u) => {
        const ex = gx + (sx0 - gx) * (1 - u), ey = gy + (sy0 - gy) * (1 - u) - Math.sin(u * Math.PI) * s * 0.8;
        return [ex + Math.sin(u * 9 + f.t0) * s * 0.04 * (1 - u), ey];
      };
      const fade = smooth(0, 0.18, q);
      for (let j = 6; j >= 0; j--) {
        const u = Math.max(0, q - j * 0.025), [px, py] = pt(u);
        glow(ctx, px, py, S * (0.07 - j * 0.008), f.c, (0.75 - j * 0.1) * fade);
      }
      const [px, py] = pt(q);
      ctx.fillStyle = `rgba(255,251,230,${fade})`; ctx.beginPath(); ctx.arc(px, py, Math.max(1, S * 0.012), 0, TAU); ctx.fill();
    });
  };
})();
