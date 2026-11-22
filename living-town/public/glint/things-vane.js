// Kindle's Grid: the Bakery Weather Vane (kind "vane"). A little honey-wood post standing on the bakery's front gable
// peak, gold-wire compass arms (N E S W letters) and a glowing gold-wire arrow that turns slowly with a wandering
// "wind" (no real wind data: a slow sum of sines). Pale wind wisps and motes drift past in the direction it points.
// Geometry follows things-bakery.js: th.on = [bx, by] the bakery's tile (default 16,21); the peak is at
// (tile centre x - 0.14s, tile centre y - 1.12s). Tap: a gust spins it round once and it settles back.
// `?pose=gust` holds it mid-spin. Loads after things.js (stub `vane() {}`).
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
  // the wind's heading (radians, 0 = east, PI/2 = south on the ground), drifting slowly like a real breeze
  const wind = t => 3.4 + 0.7 * Math.sin(t * 0.045) + 0.35 * Math.sin(t * 0.13 + 1.7) + 0.06 * Math.sin(t * 1.9);

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.vane = function vane(ctx, x, y, s, t, th = {}) {
    const [bx, by] = th.on || [16, 21];
    const cxT = x + (bx - th.x) * s, cyT = y + (by - th.y) * s;   // the bakery tile's centre on screen
    const px = cxT - s * 0.14, py = cyT - s * 1.1;                // the front gable peak
    s *= th.scale || 1.45;                                        // storybook-big, so it reads on a small screen
    const since = POSE === "gust" ? 1.1 : th.tapped != null ? t - th.tapped : 99;
    const gust = since >= 0 && since < 3.2 ? since / 3.2 : 1;
    const spin = gust < 1 ? TAU * (1 - Math.pow(1 - gust, 3)) : 0;   // one full turn, easing out
    const flare = gust < 1 ? Math.sin(gust * Math.PI) : 0;
    const a = wind(t) + spin;
    const P = (ang, r, lift) => [px + Math.cos(ang) * r, py - lift + Math.sin(ang) * r * 0.45];   // ground-plane ellipse

    const H = s * 0.5, armY = H * 0.55, arrowY = H * 0.86;
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2) + 0.6 * flare;

    // wind wisps and motes, drifting the way the arrow points (behind and around the vane)
    const dx = Math.cos(wind(t)), dy = Math.sin(wind(t)) * 0.45;
    for (let i = 0; i < 4; i++) {
      const f = (t * 0.12 + i * 0.27) % 1, off = (i - 1.5) * s * 0.22;
      const wx = px - dx * s * 0.9 + dx * f * s * 1.8 - dy * off, wy = py - arrowY - s * 0.15 + dy * (f * 1.8 - 0.9) * s + dx * off * 0.45;
      const al = Math.sin(f * Math.PI) * 0.35;
      ctx.strokeStyle = `rgba(210,225,245,${al})`; ctx.lineWidth = Math.max(1, s * 0.02); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(wx - dx * s * 0.16, wy - dy * s * 0.16);
      ctx.quadraticCurveTo(wx, wy - s * 0.03, wx + dx * s * 0.16, wy + dy * s * 0.16); ctx.stroke();
      glow(ctx, wx + dx * s * 0.2, wy + dy * s * 0.2, s * 0.05, "255,220,140", al * 1.4);
    }

    // a small gold foot on the ridge, and the honey-wood post with a gold band
    ctx.fillStyle = "#e09a2b"; ctx.beginPath(); ctx.ellipse(px, py, s * 0.06, s * 0.025, 0, 0, TAU); ctx.fill();
    const pw = s * 0.022;
    ctx.fillStyle = "#c9893f"; ctx.fillRect(px - pw, py - H, pw * 2, H);
    ctx.fillStyle = "#e7ad62"; ctx.fillRect(px - pw, py - H, pw * 0.8, H);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(px - pw * 1.3, py - H * 0.3, pw * 2.6, s * 0.018);

    // gold-wire compass arms with little letters (they stay put; only the arrow turns)
    const arm = s * 0.2, dirs = [["E", 0], ["S", Math.PI / 2], ["W", Math.PI], ["N", -Math.PI / 2]];
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.014);
    ctx.beginPath();
    for (const [, d] of dirs) { const [ex, ey] = P(d, arm, armY); ctx.moveTo(px, py - armY); ctx.lineTo(ex, ey); }
    ctx.stroke();
    ctx.font = "bold " + (s * 0.085).toFixed(1) + "px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const [l, d] of dirs) {
      const [ex, ey] = P(d, arm + s * 0.07, armY);
      ctx.fillStyle = "rgba(20,30,60,0.6)"; ctx.fillText(l, ex + 0.6, ey + 0.6);
      ctx.fillStyle = "#ffe9a8"; ctx.fillText(l, ex, ey);
    }

    // the arrow: gold wire, a glowing amber core, a pointed head and a feathered tail
    const L = s * 0.27, [hx, hy] = P(a, L, arrowY), [tx, ty] = P(a + Math.PI, L * 0.9, arrowY);
    const n = [-Math.sin(a), Math.cos(a) * 0.45];   // sideways on the ground plane
    const nl = Math.hypot(n[0], n[1]) || 1, nx = n[0] / nl, ny = n[1] / nl;
    const side = s * 0.07, head = s * 0.1;
    const ux = (hx - tx), uy = (hy - ty), ul = Math.hypot(ux, uy) || 1;   // screen direction tail -> head
    const fx = ux / ul, fy = uy / ul, lenK = Math.min(1, ul / (L * 1.9));   // foreshortening when it points at us
    glow(ctx, (hx + tx) / 2, (hy + ty) / 2, s * (0.3 + 0.12 * flare), "255,200,100", 0.22 * pulse);
    glow(ctx, hx, hy, s * 0.13, "255,230,150", 0.45 * pulse);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const shaft = () => { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx - fx * head * 0.6 * lenK, hy - fy * head * 0.6 * lenK); };
    ctx.strokeStyle = "#b8741f"; ctx.lineWidth = Math.max(2, s * 0.04); shaft(); ctx.stroke();
    ctx.strokeStyle = `rgba(255,${Math.round(200 + 40 * Math.min(1, pulse - 0.5))},120,1)`; ctx.lineWidth = Math.max(1, s * 0.022); shaft(); ctx.stroke();
    // head
    const hb = [hx - fx * head * lenK, hy - fy * head * lenK];
    ctx.fillStyle = "#ffd166"; ctx.strokeStyle = "#b8741f"; ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hb[0] + nx * side, hb[1] + ny * side); ctx.lineTo(hb[0] - nx * side, hb[1] - ny * side); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(255,250,220,${0.6 + 0.3 * Math.min(1, pulse)})`; ctx.beginPath(); ctx.arc(hb[0] + fx * head * 0.4 * lenK, hb[1] + fy * head * 0.4 * lenK, s * 0.018, 0, TAU); ctx.fill();
    // tail feathers: two little wire fins
    for (const k of [0, 0.12]) {
      const qx = tx + fx * k * ul, qy = ty + fy * k * ul, fs = side * 1.1;
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.016);
      ctx.beginPath(); ctx.moveTo(qx + nx * fs - fx * s * 0.04, qy + ny * fs - fy * s * 0.04); ctx.lineTo(qx + fx * s * 0.03, qy + fy * s * 0.03);
      ctx.lineTo(qx - nx * fs - fx * s * 0.04, qy - ny * fs - fy * s * 0.04); ctx.stroke();
    }
    // the gold pivot ball the arrow turns on, and a tiny star on top
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(px, py - arrowY, s * 0.028, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(px - s * 0.008, py - arrowY - s * 0.008, s * 0.01, 0, TAU); ctx.fill();
    const sy = py - H - s * 0.06;
    ctx.fillStyle = "#ffd166"; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.018 : s * 0.042, an = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(px + Math.cos(an) * r, sy + Math.sin(an) * r); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.014); ctx.beginPath(); ctx.moveTo(px, py - arrowY); ctx.lineTo(px, sy); ctx.stroke();
    glow(ctx, px, sy, s * 0.08, "255,220,140", 0.3 + 0.3 * flare);
  };
})();
