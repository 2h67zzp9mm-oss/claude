// Kindle's Grid: the Wind Flags (kind "flags"). A gold thread strung from the Glass Windmill's lattice to the post of the
// Bakery Weather Vane, hung with little cloth pennants (pink, gold, teal, violet, cyan). The thread sags less and the
// flags stream out further the harder the breeze blows (same breeze sum as things-mill.js; flutter side from
// window.GLINT_WIND). Each flag has a tiny glow-thread stitched along its edge that shows after dark (device clock).
// When the Lamp Song (window.GLINT_SONG) passes, each flag lights in turn like a lamp. Tap (3 s): a ripple of light and
// a little hop runs along the string from the windmill to the bakery. `?pose=ripple` holds the ripple.
// Opts: from [x,y], to [x,y] absolute tile coords of the two ends; n = number of flags. Stub `flags() {}` in things.js.
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
  const breeze = t => 0.55 + 0.25 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67 + 2.1) + 0.08 * Math.sin(t * 1.7);
  const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  const darkness = () => {
    if (POSE === "ripple" || POSE === "tune") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  // cloth colours: [fill, light edge, glow rgb]
  const CLOTH = [
    ["#ff8fc8", "#ffc2e0", "255,150,205"], ["#ffd166", "#fff0b8", "255,214,110"], ["#3fd8c8", "#a8f5ec", "90,230,215"],
    ["#b48cff", "#dcc8ff", "185,150,255"], ["#57e1ff", "#c2f4ff", "110,225,255"], ["#f08a9b", "#ffc6cf", "245,150,165"],
  ];
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};

  T.flags = function flags(ctx, x, y, s, t, th = {}) {
    const ox = x - (th.x + 0.5) * s, oy = y - (th.y + 0.5) * s;           // screen position of tile (0,0)
    const [ax, ay] = th.from || [18.45, 19.2], [bx, by] = th.to || [16.39, 20.12];
    const A = [ox + ax * s, oy + ay * s], B = [ox + bx * s, oy + by * s];
    const b = breeze(t), wind = (window.GLINT_WIND || (() => 3.4))(t), side = Math.cos(wind);   // -1 west .. 1 east
    const since = POSE === "ripple" ? 1.2 : th.tapped != null ? t - th.tapped : 99;
    const sag = s * (0.32 - 0.12 * b);
    const P = f => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f + sag * 4 * f * (1 - f) + Math.sin(t * 1.3 + f * 5) * s * 0.012 * b];
    const dark = darkness();
    const song = window.GLINT_SONG;

    // the thread: gold, with a soft shine
    ctx.lineCap = "round";
    ctx.strokeStyle = "#c98f2e"; ctx.lineWidth = Math.max(1, s * 0.016);
    ctx.beginPath(); for (let i = 0; i <= 24; i++) { const [px, py] = P(i / 24); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,160,0.7)"; ctx.lineWidth = Math.max(0.6, s * 0.007);
    ctx.beginPath(); for (let i = 0; i <= 24; i++) { const [px, py] = P(i / 24); i ? ctx.lineTo(px, py - s * 0.004) : ctx.moveTo(px, py - s * 0.004); } ctx.stroke();
    // little gold knots where it is tied at each end
    for (const [px, py] of [A, B]) { ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(px, py, s * 0.026, 0, TAU); ctx.fill(); }

    const n = th.n || 7;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.7) / (n + 0.9), [px, py] = P(f), [qx, qy] = P(f + 0.075);
      const c = CLOTH[i % CLOTH.length];
      // the ripple from a tap runs windmill -> bakery
      const ru = since - f * 1.2, rip = ru > 0 && ru < 0.8 ? Math.sin(ru / 0.8 * Math.PI) : 0;
      // the Lamp Song: each flag answers in turn, like the lamps
      let hum = 0;
      if (song && song.since != null) {
        const tx = ax + (bx - ax) * f, ty = ay + (by - ay) * f, u = song.since - Math.hypot(tx - song.bx, ty - song.by) * song.step;
        if (u > 0 && u < 2.4) hum = Math.sin(u / 2.4 * Math.PI);
      }
      const lit = Math.min(1, 0.35 * dark + hum * 0.8 + rip);
      // flutter: the tip swings out the way the wind blows, harder with more breeze
      const flap = Math.sin(t * (3.5 + 3 * b) + i * 1.3), len = s * (0.3 + 0.03 * Math.sin(i * 2.1));
      const lean = side * (0.15 + 0.55 * b) + flap * 0.12 * (0.4 + b) + rip * 0.4;   // radians off straight down
      const hop = rip * s * 0.05;
      const tipX = (px + qx) / 2 + Math.sin(lean) * len, tipY = py - hop + Math.cos(lean) * len;
      const L = [px, py - hop], R = [qx, qy - hop];
      const midBend = flap * s * 0.012;
      if (lit > 0.05) glow(ctx, (L[0] + R[0] + tipX) / 3, (L[1] + tipY) / 2, s * (0.14 + 0.08 * lit), c[2], 0.25 + 0.45 * lit);
      ctx.fillStyle = c[0];
      ctx.beginPath(); ctx.moveTo(...L); ctx.lineTo(...R);
      ctx.quadraticCurveTo((R[0] + tipX) / 2 + midBend, (R[1] + tipY) / 2, tipX, tipY);
      ctx.quadraticCurveTo((L[0] + tipX) / 2 + midBend, (L[1] + tipY) / 2, L[0], L[1]); ctx.closePath(); ctx.fill();
      // light half of the cloth, and the stitched glow-thread on its edge
      ctx.fillStyle = c[1]; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(...L); ctx.lineTo(L[0] + (qx - px) * 0.35, L[1] + (qy - py) * 0.35); ctx.lineTo(tipX, tipY); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,246,214,${0.25 + 0.7 * lit})`; ctx.lineWidth = Math.max(0.6, s * 0.008);
      ctx.beginPath(); ctx.moveTo(...L); ctx.lineTo(tipX, tipY); ctx.lineTo(...R); ctx.stroke();
      // a tiny gold bead where each flag is sewn on
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc((px + qx) / 2, (py + qy) / 2 - hop, s * 0.012, 0, TAU); ctx.fill();
      if (lit > 0.4) glow(ctx, tipX, tipY, s * 0.05, "255,246,214", lit * 0.6);   // a spark at the tip
    }
    // a breath of cool clear air drifting along the string now and then
    for (let k = 0; k < 2; k++) {
      const f = (t * 0.09 + k * 0.5) % 1, [wx, wy] = P(f), al = Math.sin(f * Math.PI) * 0.22 * b;
      ctx.strokeStyle = `rgba(210,232,250,${al})`; ctx.lineWidth = Math.max(1, s * 0.012);
      ctx.beginPath(); ctx.moveTo(wx - s * 0.12, wy - s * 0.12); ctx.quadraticCurveTo(wx, wy - s * 0.16, wx + s * 0.12, wy - s * 0.12); ctx.stroke();
    }
  };
})();
