// Kindle's Grid: the Glass Windmill beside the bakery (kind "mill"). A slim tapering tower of gold wire lattice on a
// round stone footing, a rose cap like the bakery roof, a little pink pennant streaming with the wind, and four glass
// vanes in gold-wire frames turning on a gold hub. The vanes turn with the breeze (speed from a slow gusty sum of
// sines; the pennant follows the same heading as the Bakery Weather Vane via window.GLINT_WIND), a few rain beads run
// down the glass, and a small amber lantern inside the lattice glows brighter the faster the vanes turn.
// Tap (4 s): a gust whirls the vanes and the lantern flares. `?pose=whirl` holds the gust. Stub `mill() {}` in things.js.
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
  const breeze = t => 0.55 + 0.25 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67 + 2.1) + 0.08 * Math.sin(t * 1.7);   // ~0.1 .. 1
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};

  T.mill = function mill(ctx, x, y, s, t, th = {}) {
    s *= th.scale || 1;
    const cx = x, base = y + s * 0.22;                       // foot of the tower, a little below the tile centre
    const since = POSE === "whirl" ? 1 : th.tapped != null ? t - th.tapped : 99;
    const gust = since >= 0 && since < 4 ? Math.sin(Math.min(1, since / 0.5) * Math.PI / 2) * (1 - Math.max(0, since - 1.5) / 2.5) : 0;
    const speed = 0.9 + 1.6 * breeze(t) + 9 * gust;          // radians per second
    const dt = th.lastT != null ? Math.min(0.1, Math.max(0, t - th.lastT)) : 0;
    th.lastT = t; th.ang = ((th.ang || 0) + speed * dt) % TAU;
    const spinK = Math.min(1, (speed - 0.9) / 5);             // 0 calm .. 1 whirling
    const heading = (window.GLINT_WIND || (() => 3.4))(t);

    const H = s * 1.45, bw = s * 0.2, tw = s * 0.06, top = base - H;
    const legX = (k, f) => cx + k * (bw + (tw - bw) * f);     // k = -1 / 1, f = 0 (foot) .. 1 (top)

    // shadow and round stone footing ringed in gold
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(cx + s * 0.05, base + s * 0.04, s * 0.36, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#4a4f6e"; ctx.beginPath(); ctx.ellipse(cx, base + s * 0.02, s * 0.29, s * 0.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#6c7398"; ctx.beginPath(); ctx.ellipse(cx, base - s * 0.01, s * 0.27, s * 0.085, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.014); ctx.beginPath(); ctx.ellipse(cx, base - s * 0.01, s * 0.27, s * 0.085, 0, 0, TAU); ctx.stroke();

    // the little amber lantern inside the lattice: brighter the faster the vanes turn
    const ly = base - s * 0.2, lit = 0.5 + 0.5 * spinK + 0.15 * Math.sin(t * 3.1);
    glow(ctx, cx, ly, s * (0.35 + 0.25 * spinK), "255,190,90", 0.35 * lit);
    ctx.fillStyle = "#b8741f"; ctx.fillRect(cx - s * 0.05, ly - s * 0.1, s * 0.1, s * 0.02);
    ctx.fillStyle = `rgba(255,${Math.round(180 + 50 * spinK)},90,${0.75 + 0.25 * spinK})`;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - s * 0.04, ly - s * 0.08, s * 0.08, s * 0.11, s * 0.02) : ctx.rect(cx - s * 0.04, ly - s * 0.08, s * 0.08, s * 0.11); ctx.fill();
    ctx.fillStyle = "#fff3c4"; ctx.beginPath(); ctx.ellipse(cx, ly - s * 0.02, s * 0.015, s * 0.03, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#b8741f"; ctx.fillRect(cx - s * 0.05, ly + s * 0.03, s * 0.1, s * 0.018);

    // gold-wire lattice tower: two outer legs, a back leg, and X braces
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#a8691c"; ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath(); ctx.moveTo(cx, base - s * 0.08); ctx.lineTo(cx, top); ctx.stroke();      // the back leg, a shade darker
    const rungs = 5;
    ctx.strokeStyle = "#e3a640"; ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath();
    for (let i = 0; i < rungs; i++) {
      const f0 = i / rungs, f1 = (i + 1) / rungs, y0 = base - H * f0, y1 = base - H * f1;
      ctx.moveTo(legX(-1, f0), y0); ctx.lineTo(legX(1, f1), y1);
      ctx.moveTo(legX(1, f0), y0); ctx.lineTo(legX(-1, f1), y1);
    }
    ctx.stroke();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, s * 0.026);
    ctx.beginPath();
    for (const k of [-1, 1]) { ctx.moveTo(legX(k, 0), base); ctx.lineTo(legX(k, 1), top); }
    for (let i = 1; i <= rungs; i++) { const f = i / rungs; ctx.moveTo(legX(-1, f), base - H * f); ctx.lineTo(legX(1, f), base - H * f); }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,246,214,0.8)"; ctx.lineWidth = Math.max(0.8, s * 0.009);   // shine on the left leg
    ctx.beginPath(); ctx.moveTo(legX(-1, 0) + s * 0.006, base - s * 0.02); ctx.lineTo(legX(-1, 1) + s * 0.006, top + s * 0.02); ctx.stroke();
    for (const k of [-1, 1]) { ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(legX(k, 0), base, s * 0.025, 0, TAU); ctx.fill(); }

    // the cap: a little rose roof like the bakery's, banded in gold
    const capY = top - s * 0.02;
    ctx.fillStyle = "#c95a6e"; ctx.beginPath(); ctx.moveTo(cx - s * 0.13, capY); ctx.lineTo(cx, capY - s * 0.16); ctx.lineTo(cx + s * 0.13, capY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f08a9b"; ctx.beginPath(); ctx.moveTo(cx - s * 0.13, capY); ctx.lineTo(cx, capY - s * 0.16); ctx.lineTo(cx - s * 0.02, capY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.fillRect(cx - s * 0.14, capY - s * 0.005, s * 0.28, s * 0.03);
    // the pennant on top, streaming the way the wind goes
    const pTop = capY - s * 0.16, mastY = pTop - s * 0.16, dir = Math.cos(heading) >= 0 ? 1 : -1;
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012); ctx.beginPath(); ctx.moveTo(cx, pTop); ctx.lineTo(cx, mastY); ctx.stroke();
    const flap = Math.sin(t * (4 + 4 * spinK)), fl = s * (0.16 + 0.04 * breeze(t));
    ctx.fillStyle = "#ff8fc8"; ctx.beginPath(); ctx.moveTo(cx, mastY + s * 0.005);
    ctx.quadraticCurveTo(cx + dir * fl * 0.5, mastY + s * 0.01 + flap * s * 0.025, cx + dir * fl, mastY + s * 0.035 + flap * s * 0.015);
    ctx.quadraticCurveTo(cx + dir * fl * 0.5, mastY + s * 0.06 - flap * s * 0.02, cx, mastY + s * 0.065); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(cx, mastY, s * 0.018, 0, TAU); ctx.fill();

    // four glass vanes on the hub, just in front of the cap
    const hx = cx, hy = top + s * 0.06, R = s * 0.62, r0 = s * 0.07;
    glow(ctx, hx, hy, R * 1.05, "150,220,255", 0.08 + 0.12 * spinK);
    for (let i = 0; i < 4; i++) {
      const a = th.ang + i * TAU / 4, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
      const at = (d, w) => [hx + ca * d + nx * w, hy + sa * d + ny * w];
      const root = r0 + s * 0.06, wR = s * 0.05, wT = s * 0.13;
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.2, s * 0.018);
      ctx.beginPath(); ctx.moveTo(...at(r0, 0)); ctx.lineTo(...at(R, 0)); ctx.stroke();       // the arm
      const q = [at(root, 0), at(root, wR), at(R, wT), at(R, 0)];                              // the glass sail on one side of its arm
      const g = ctx.createLinearGradient(...at(root, 0), ...at(R, wT));
      g.addColorStop(0, "rgba(200,245,255,0.8)"); g.addColorStop(0.6, "rgba(140,220,255,0.65)"); g.addColorStop(1, "rgba(215,190,255,0.75)");
      ctx.fillStyle = g; ctx.beginPath(); q.forEach(([px, py], j) => j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012); ctx.stroke();
      ctx.strokeStyle = "rgba(255,214,102,0.7)"; ctx.lineWidth = Math.max(0.7, s * 0.007);   // two little cross-wires in the glass
      ctx.beginPath();
      for (const f of [0.45, 0.72]) { const d = root + (R - root) * f, w = wR + (wT - wR) * ((d - root) / (R - root)); ctx.moveTo(...at(d, 0)); ctx.lineTo(...at(d, w)); }
      ctx.stroke();
      // a white shine along the glass, brighter when the vane sweeps up past the lamp light
      const sh = 0.35 + 0.4 * Math.max(0, -sa);
      ctx.strokeStyle = `rgba(255,255,255,${sh})`; ctx.lineWidth = Math.max(0.8, s * 0.01);
      ctx.beginPath(); ctx.moveTo(...at(root + s * 0.05, wR * 0.6)); ctx.lineTo(...at(R - s * 0.06, wT * 0.55)); ctx.stroke();
      // a rain bead running out along the glass
      const f = (t * 0.35 + i * 0.29) % 1, d = root + (R - root) * f, [bx, by] = at(d, (wR + (wT - wR) * f) * 0.5);
      ctx.fillStyle = `rgba(230,248,255,${0.8 * Math.sin(f * Math.PI)})`; ctx.beginPath(); ctx.arc(bx, by, s * 0.014, 0, TAU); ctx.fill();
      // a glint at the tip, trailing when it spins fast
      const [tx2, ty2] = at(R, wT * 0.5);
      glow(ctx, tx2, ty2, s * (0.06 + 0.06 * spinK), "200,240,255", 0.4 + 0.4 * spinK);
    }
    // the hub: gold disc with a bright centre
    ctx.fillStyle = "#b8741f"; ctx.beginPath(); ctx.arc(hx, hy, r0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(hx, hy, r0 * 0.78, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(hx - r0 * 0.25, hy - r0 * 0.25, r0 * 0.28, 0, TAU); ctx.fill();
    glow(ctx, hx, hy, s * 0.16, "255,220,140", 0.3 + 0.4 * spinK);

    // breeze wisps blowing through the vanes, the same way as the pennant
    for (let i = 0; i < 3; i++) {
      const f = (t * (0.18 + 0.1 * breeze(t)) + i * 0.33) % 1, al = Math.sin(f * Math.PI) * (0.25 + 0.3 * gust);
      const wx = hx + dir * (f - 0.5) * s * 1.8, wy = hy + (i - 1) * s * 0.28 + Math.sin(f * 6 + i) * s * 0.03;
      ctx.strokeStyle = `rgba(210,230,250,${al})`; ctx.lineWidth = Math.max(1, s * 0.015);
      ctx.beginPath(); ctx.moveTo(wx - dir * s * 0.14, wy); ctx.quadraticCurveTo(wx, wy - s * 0.035, wx + dir * s * 0.14, wy); ctx.stroke();
    }
  };
})();
