// Kindle's Grid: the Ember Seat (kind "emberseat"), a small one-person seat of honey wood just west of the Ember Pot, so
// someone walking out to the Spark Lamp can stop halfway and warm their hands. Round seat on three splayed legs with gold
// feet, a low curved back with a gold flame in the rail, one round ember cushion with a stitched flame, and a pair of
// knitted mittens on a gold peg on the post nearest the pot. Warm wisps drift from the pot to the seat all the time
// (stronger at night / with someone near); when the pot puffs (window.GLINT_EMBER.wave) the warmth reaches the seat
// ~0.6 s later: a gold ring runs round the rim, the mittens steam, sparks lift off the cushion. Tap = the same.
// It is `seat: true` (grid.js BENCHES), so Kindle sits on it. `?pose=emberseat` holds night + warm.
// Stub `emberseat() {}` in things.js; loads after things-emberpot.js.
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
  function flame(ctx, x, y, r, outer, inner) {
    ctx.fillStyle = outer; ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * 0.7, y, x + r * 0.45, y + r * 0.45);
    ctx.quadraticCurveTo(x, y + r * 0.75, x - r * 0.45, y + r * 0.45); ctx.quadraticCurveTo(x - r * 0.7, y, x, y - r); ctx.fill();
    ctx.fillStyle = inner; ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.2, r * 0.3, 0, 0, TAU); ctx.fill();
  }
  // a knitted mitten hanging by its cuff from (x, y), thumb toward `side`
  function mitten(ctx, x, y, s, side, sway, col, dark) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, s * 0.11, s * 0.05, s * 0.07, 0, 0, TAU); ctx.fill();          // the hand
    ctx.beginPath(); ctx.ellipse(side * s * 0.045, s * 0.09, s * 0.02, s * 0.035, side * 0.6, 0, TAU); ctx.fill();   // thumb
    ctx.fillStyle = dark; ctx.fillRect(-s * 0.045, s * 0.13, s * 0.09, Math.max(1, s * 0.012));   // a knitted stripe
    ctx.fillStyle = "#fff0d8"; ctx.fillRect(-s * 0.048, s * 0.015, s * 0.096, s * 0.04);            // cream cuff
    ctx.restore();
  }

  T.emberseat = function emberseat(ctx, x, y, s, t, th = {}) {
    const E = window.GLINT_EMBER;
    const S = s * (th.scale || 1);
    const wcx = th.x + 0.5, wcy = th.y + 0.5;
    const walkers = window.GLINT_GRID?.walkers || [];
    const sat = walkers.some(k => k.seated && k.bench === th);
    const near = walkers.some(w => !w.inside && Math.hypot((w.fx ?? w.x) + 0.5 - wcx, (w.fy ?? w.y) - wcy) < 1.4);
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const dark = POSE === "emberseat" ? 1 : h >= 17 || h < 7 ? 1 : 0.5;
    // the pot's puff reaches the seat a moment later; a tap does it at once
    let e = 99;
    if (E && E.wave != null) e = t - (E.wave - 0.45 + 0.6);
    if (th.tapped != null && t - th.tapped >= 0 && t - th.tapped < e) e = t - th.tapped;
    if (POSE === "emberseat") e = (t % 3);
    const warmT = e >= 0 && e < 2.6 ? Math.sin(Math.PI * Math.min(1, e / 2.6)) : 0;
    const warm = Math.max(warmT, sat ? 0.55 : 0, near ? 0.35 : 0);
    const k = (E ? E.k : 0.6) * (0.6 + 0.4 * dark);

    // pot screen position (the wisps start there)
    const pot = (window.GLINT_WORLD?.things || []).find(q => q.kind === "emberpot");
    const px = pot ? x + (pot.x + 0.5 - wcx) * s : x + s, py = pot ? y + (pot.y + 0.5 - wcy) * s - s * 0.45 : y - s * 0.4;

    const b = y + S * 0.3, seat = b - S * 0.24, rx = S * 0.27, ry = S * 0.1, top = b - S * 0.58;
    // shadow and a warm pool on the moss between pot and seat
    ctx.fillStyle = "rgba(0,0,0,0.33)"; ctx.beginPath(); ctx.ellipse(x, b + S * 0.02, S * 0.34, S * 0.08, 0, 0, TAU); ctx.fill();
    glow(ctx, (x + px) / 2, b, S * 0.75, "255,150,70", 0.12 * k + 0.25 * warm);
    glow(ctx, x, seat, S * (0.6 + 0.2 * warm), "255,190,110", 0.16 + 0.05 * Math.sin(t * 1.2) + 0.3 * warm);

    // three splayed legs: one at the back, two in front, gold feet
    const leg = (x0, y0, x1, y1, w, c, hi) => {
      poly(ctx, [[x0 - w, y0], [x0 + w, y0], [x1 + w, y1], [x1 - w, y1]], c);
      ctx.strokeStyle = hi; ctx.lineWidth = Math.max(1, w * 0.6); ctx.beginPath(); ctx.moveTo(x0 - w * 0.4, y0); ctx.lineTo(x1 - w * 0.4, y1); ctx.stroke();
      ctx.fillStyle = "#ffd166"; ctx.fillRect(x1 - w * 1.5, y1 - S * 0.02, w * 3, S * 0.035);
    };
    leg(x, seat, x, b - S * 0.06, S * 0.028, "#7a4420", "#a8642e");   // back leg, half hidden
    // the low back: two spindles rising from the back of the seat, joined by a curved rail
    for (const dd of [-1, 1]) {
      const sx = x + dd * rx * 0.72;
      poly(ctx, [[sx - S * 0.026, seat - ry * 0.4], [sx - S * 0.022, top + S * 0.04], [sx + S * 0.022, top + S * 0.04], [sx + S * 0.026, seat - ry * 0.4]], "#8a4f24");
      ctx.fillStyle = "#c27a3a"; ctx.fillRect(sx - S * 0.022, top + S * 0.05, S * 0.016, seat - top - S * 0.08);
    }
    ctx.lineCap = "round";
    ctx.strokeStyle = "#9c5a28"; ctx.lineWidth = S * 0.075;
    ctx.beginPath(); ctx.moveTo(x - rx * 0.85, top + S * 0.07); ctx.quadraticCurveTo(x, top - S * 0.05, x + rx * 0.85, top + S * 0.07); ctx.stroke();
    ctx.strokeStyle = "#e0a05a"; ctx.lineWidth = S * 0.04;
    ctx.beginPath(); ctx.moveTo(x - rx * 0.82, top + S * 0.055); ctx.quadraticCurveTo(x, top - S * 0.065, x + rx * 0.82, top + S * 0.055); ctx.stroke();
    for (const dd of [-1, 1]) { ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x + dd * rx * 0.72, top + S * 0.05, Math.max(1, S * 0.016), 0, TAU); ctx.fill(); }
    // a gold flame set in the middle of the rail, breathing with the pot
    const fy = top + S * 0.005, pulse = 0.6 + 0.4 * Math.sin(t * 1.7);
    glow(ctx, x, fy, S * (0.13 + 0.08 * warm), "255,190,90", 0.4 * pulse + 0.5 * warm);
    flame(ctx, x, fy, S * 0.045, "#ffd166", "#ff8a3a");

    // the round seat: front rim, then the top with grain rings
    ctx.fillStyle = "#8a4f24"; ctx.beginPath(); ctx.ellipse(x, seat + S * 0.03, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#e0a05a"; ctx.beginPath(); ctx.ellipse(x, seat, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#b8763a"; ctx.lineWidth = Math.max(1, S * 0.01);
    for (const f of [0.75, 0.5]) { ctx.beginPath(); ctx.ellipse(x - rx * 0.05, seat + ry * 0.05, rx * f, ry * f, 0, 0, TAU); ctx.stroke(); }
    if (warmT > 0.02) {   // a warm gold light running round the rim
      const a = (e / 2.6) * TAU * 1.2 + Math.PI / 2;
      glow(ctx, x + Math.cos(a) * rx, seat + S * 0.015 + Math.sin(a) * ry, S * 0.13, "255,225,150", warmT);
      glow(ctx, x + Math.cos(a + Math.PI) * rx, seat + S * 0.015 + Math.sin(a + Math.PI) * ry, S * 0.1, "255,225,150", warmT * 0.7);
    }
    // two front legs, splayed
    leg(x - rx * 0.55, seat + ry * 0.6, x - rx * 0.85, b, S * 0.03, "#8a4f24", "#c27a3a");
    leg(x + rx * 0.55, seat + ry * 0.6, x + rx * 0.85, b, S * 0.03, "#8a4f24", "#c27a3a");
    ctx.strokeStyle = "#a8642e"; ctx.lineWidth = Math.max(1, S * 0.022);   // a stretcher between them
    ctx.beginPath(); ctx.moveTo(x - rx * 0.72, b - S * 0.08); ctx.lineTo(x + rx * 0.72, b - S * 0.08); ctx.stroke();

    // one round ember cushion with a stitched gold flame; empty, it breathes a soft light, waiting
    const wait = 0.5 + 0.5 * Math.sin(t * 1.4), lift = sat ? 0 : S * 0.006 * wait;
    if (!sat) glow(ctx, x, seat - S * 0.04, S * 0.26, "255,160,80", 0.2 + 0.18 * wait + 0.35 * warm);
    ctx.fillStyle = "#b8561c"; ctx.beginPath(); ctx.ellipse(x, seat - S * 0.005 - lift, rx * 0.8, ry * 0.85, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ff9a3c"; ctx.beginPath(); ctx.ellipse(x, seat - S * 0.03 - lift, rx * 0.76, ry * 0.78, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd08a"; ctx.beginPath(); ctx.ellipse(x - rx * 0.15, seat - S * 0.045 - lift, rx * 0.4, ry * 0.35, 0, 0, TAU); ctx.fill();
    glow(ctx, x, seat - S * 0.035 - lift, S * 0.07, "255,200,110", 0.25 + 0.3 * wait + 0.3 * warm);
    flame(ctx, x, seat - S * 0.035 - lift, S * 0.03, "#ffe08a", "#ff7a2a");

    // the mittens on a gold peg, on the post nearest the pot; they sway a little and steam when warm
    const side = pot && pot.x < th.x ? -1 : 1;
    const mx = x + side * rx * 0.72, my = top + S * 0.16;
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(mx + side * S * 0.03, my, Math.max(1, S * 0.014), 0, TAU); ctx.fill();
    const sw = 0.12 * Math.sin(t * 1.3) + 0.15 * warmT * Math.sin(t * 6);
    mitten(ctx, mx + side * S * 0.02, my, S * 1.35, -1, sw, "#ff8a5a", "#c84a2a");
    mitten(ctx, mx + side * S * 0.1, my + S * 0.01, S * 1.35, 1, -sw * 0.8, "#ffb04a", "#c86a1a");
    glow(ctx, mx + side * S * 0.05, my + S * 0.11, S * 0.12, "255,170,90", 0.15 + 0.4 * warm);
    if (warm > 0.05) for (let i = 0; i < 3; i++) {
      const f = (t * 0.45 + i / 3) % 1;
      glow(ctx, mx + side * S * 0.05 + Math.sin(t * 2 + i * 2.1) * S * 0.03, my + S * 0.05 - f * S * 0.3, S * 0.04, "255,240,220", 0.5 * warm * Math.sin(f * Math.PI));
    }

    // warm wisps drifting from the pot across to the seat, curling up round it
    const n = 4;
    for (let i = 0; i < n; i++) {
      const f = (t * 0.22 + i / n) % 1;
      const u = f, v = 1 - u;
      const cx = px + (x + side * rx * 0.3 - px) * u + Math.sin(t * 1.3 + i * 1.9) * S * 0.04;
      const cy = py * v + (seat - S * 0.1) * u - Math.sin(u * Math.PI) * S * 0.18;
      glow(ctx, cx, cy, S * (0.05 + 0.03 * u), "255,180,100", (0.18 * k + 0.45 * warm) * Math.sin(u * Math.PI));
    }
    // sparks lifting off the cushion when the warmth arrives
    if (warmT > 0.05) for (let i = 0; i < 5; i++) {
      const f = (e * 0.6 + i / 5) % 1;
      glow(ctx, x + Math.sin(t * 2 + i * 2.3) * S * 0.12 * f, seat - S * 0.08 - f * S * 0.4, S * 0.05, "255,200,120", warmT * (1 - f));
    }
  };
})();
