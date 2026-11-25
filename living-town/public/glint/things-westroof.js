// Kindle's Grid: the Honey Roof (kind "westroof") of the first West Meadow house. Two gables side by side, both running
// front-to-back over the Stone Walls: a tall one over the Traveler's Window (ridge at abs x 1.7, from the window's star to
// the back wall's star) and a smaller one over the Way-In Door. Honey-wood shingles in rows, frost dusting the ridges, a
// honey-board gable face over each front wall with a little round Loft Pane glowing warm, barge boards with gold trim and
// gold stars at both ends of the main ridge. When the Window Path's warm run arrives (warmpath `_arrive` + 1.6 s, after the
// wall caps), or on a tap, gold runs up the barge boards and along the ridges. A thin curl of warm air leaks from the
// ridge vent. Draws AFTER the window/door walls (y 2.25) so the gable faces sit on their tops.
// Geometry uses the westwalls frame (abs tile units, P(ax, ay)). `?pose=westroof` holds night + the run.
// Stub `westroof() {}` in things.js; loads after things-westwalls.js.
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
  function line(ctx, a, b, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  const lerp = (a, b, f) => a + (b - a) * f;
  const L = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  const SHING = ["#e0a650", "#d69a44", "#e8b25e", "#cf9140", "#dba24c"];

  T.westroof = function westroof(ctx, x, y, s, t, th = {}) {
    const P = (ax, ay) => [x + (ax - th.x - 0.5) * s, y + (ay - th.y - 0.5) * s];
    const u = s;
    const xL = 0.08, xR = 2.324, fTop = 2.15, bTop = 1.73, ins = 0.13, xLb = xL + ins, xRb = xR - ins;
    // a point on the roof: across (0 = west wall, 1 = east wall), depth (0 = front, 1 = back), lift in tiles
    const R = (a, d, z) => {
      const ax = lerp(lerp(xL, xR, a), lerp(xLb, xRb, a), d), ay = lerp(fTop, bTop, d) - z * lerp(1, 0.9, d);
      return P(ax, ay);
    };
    const W = window.GLINT_WORLD?.things || [];
    const path = W.find(o => o.kind === "warmpath"), door = W.find(o => o.kind === "westdoor");
    const d0 = new Date(), h = d0.getHours() + d0.getMinutes() / 60;
    const night = POSE === "westroof" ? 1 : h >= 17 || h < 7 ? 1 : h >= 16 || h < 8 ? 0.6 : 0;
    const open = door?._o ?? 0;
    const arrive = path && path._arrive != null ? t - path._arrive - 1.6 : 99;
    const tap = th.tapped != null ? t - th.tapped : 99;
    let e = Math.min(arrive >= 0 ? arrive : 99, tap >= 0 ? tap : 99);
    if (POSE === "westroof") e = t % 4;
    const runF = e < 3 ? e / 2.0 : -1;   // 0..1 up the barge boards and back along the ridge
    const flick = 0.88 + 0.08 * Math.sin(t * 5.1) + 0.04 * Math.sin(t * 11.7);
    const warm = (0.5 + 0.35 * night + 0.25 * open) * flick;

    const wDiv = (1.08 - xL) / (xR - xL), wMain = (1.7 - xL) / (xR - xL);
    const gables = [
      { a0: 0, a1: wDiv, m: wDiv / 2, hz: 0.36 },        // over the Way-In Door
      { a0: wDiv, a1: 1, m: wMain, hz: 0.56, main: true }, // over the Traveler's Window
    ];
    const oh = 0.035, ez = 0.025, fo = -0.035, bo = 1.04;   // eave overhang, eave drop, front/back overhang (depth)

    // soft shadow of the eaves on the walls' tops
        poly(ctx, [R(-oh, 0.02, -0.12), R(1 + oh, 0.02, -0.12), R(1 + oh, 0, 0), R(-oh, 0, 0)], "rgba(10,10,30,0.22)");

    gables.forEach((G) => {
      const fA = R(G.a0 - (G.main ? 0 : oh), fo, -ez), fB = R(G.a1 + (G.main ? oh : 0), fo, -ez), fM = R(G.m, fo, G.hz);
      const bA = R(G.a0 - (G.main ? 0 : oh), bo, -ez), bB = R(G.a1 + (G.main ? oh : 0), bo, -ez), bM = R(G.m, bo, G.hz);
      // two slopes: west first (it faces a little away), then east
      const planes = [[fA, fM, bM, bA, 0], [fM, fB, bB, bM, 1]];
      planes.forEach(([p0, p1, p2, p3, side]) => {
        poly(ctx, [p0, p1, p2, p3], side ? "#c98a3c" : "#b97a32");
        ctx.save(); poly(ctx, [p0, p1, p2, p3], "rgba(0,0,0,0)"); ctx.clip();
        // shingle rows run front-to-back; each row is a strip from eave toward ridge
        const rows = G.main ? 5 : 4, cols = 7;
        for (let r = 0; r < rows; r++) {
          // fraction from the eave (0) to the ridge (1)
          const f0 = r / rows, f1 = (r + 1) / rows;
          // side 0: eave is p0/p3, ridge p1/p2. side 1: ridge is p0(fM)/p3(bM), eave p1/p2
          const eaveF = side ? p1 : p0, eaveB = side ? p2 : p3, ridgeF = side ? p0 : p1, ridgeB = side ? p3 : p2;
          const aF = L(eaveF, ridgeF, f0), aB = L(eaveB, ridgeB, f0), cF = L(eaveF, ridgeF, f1 + 0.04), cB = L(eaveB, ridgeB, f1 + 0.04);
          for (let c = 0; c < cols; c++) {
            const off = r % 2 ? 0.5 : 0, q0 = (c - off) / cols, q1 = (c + 1 - off) / cols;
            const s0 = L(aF, aB, Math.max(0, q0)), s1 = L(aF, aB, Math.min(1, q1)), s2 = L(cF, cB, Math.min(1, q1)), s3 = L(cF, cB, Math.max(0, q0));
            poly(ctx, [s0, s1, s2, s3], SHING[(r * 3 + c * 2 + (side ? 1 : 0) + (G.main ? 2 : 0)) % SHING.length]);
            // rounded lower lip of each shingle
            const mid = L(s0, s1, 0.5);
            ctx.fillStyle = side ? "rgba(255,230,170,0.22)" : "rgba(120,70,20,0.25)";
            ctx.beginPath(); ctx.arc(mid[0], mid[1], Math.max(1, Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) * 0.28), 0, TAU); ctx.fill();
          }
          line(ctx, aF, aB, "rgba(110,60,20,0.55)", Math.max(1, u * 0.012));
        }
        // the slope turned away from the moon is a touch darker; warmth glows through on the east side at night
        const sg = ctx.createLinearGradient(p0[0], p0[1], p2[0], p2[1]);
        sg.addColorStop(0, side ? "rgba(255,190,110,0.06)" : "rgba(30,30,80,0.22)");
        sg.addColorStop(1, side ? "rgba(30,40,90,0.12)" : "rgba(30,30,80,0.32)");
        ctx.fillStyle = sg; ctx.fillRect(Math.min(p0[0], p1[0], p2[0], p3[0]) - 2, Math.min(p0[1], p1[1], p2[1], p3[1]) - 2, u * 3, u * 3);
        // frost dusting near the ridge and along the eave
        ctx.fillStyle = "rgba(240,246,255,0.55)";
        for (let k = 0; k < 14; k++) {
          const q = (k * 0.618 + (side ? 0.3 : 0)) % 1, fr = (k * 0.37) % 0.22;
          const ridgeF = side ? p0 : p1, ridgeB = side ? p3 : p2, eaveF = side ? p1 : p0, eaveB = side ? p2 : p3;
          const pt = L(L(ridgeF, eaveF, fr), L(ridgeB, eaveB, fr), q);
          ctx.beginPath(); ctx.arc(pt[0], pt[1], Math.max(0.8, u * 0.011), 0, TAU); ctx.fill();
        }
        ctx.restore();
        // eave edge: a honey-wood fascia with a frost line
        const eaveF = side ? p1 : p0, eaveB = side ? p2 : p3;
        line(ctx, eaveF, eaveB, "#7a4a1e", Math.max(1.5, u * 0.03));
        line(ctx, [eaveF[0], eaveF[1] - u * 0.012], [eaveB[0], eaveB[1] - u * 0.012], "rgba(240,248,255,0.8)", Math.max(1, u * 0.012));
      });

      // the ridge: a honey-wood beam with frost on top
      line(ctx, fM, bM, "#8a5424", Math.max(2, u * 0.045));
      line(ctx, [fM[0], fM[1] - u * 0.01], [bM[0], bM[1] - u * 0.01], "rgba(245,250,255,0.85)", Math.max(1, u * 0.015));

      // the gable face over the front wall: honey boards, a round Loft Pane, barge boards with gold trim
      const gA = R(G.a0 + (G.main ? 0.005 : 0.012), 0, 0), gB = R(G.a1 - (G.main ? 0.012 : 0.005), 0, 0), gM = R(G.m, 0, G.hz - 0.045);
      ctx.save();
      poly(ctx, [gA, gM, gB], "#c79250"); ctx.clip();
      const nb = G.main ? 7 : 5;
      for (let k = 0; k <= nb; k++) {
        const bx = lerp(gA[0], gB[0], k / nb);
        line(ctx, [bx, gM[1]], [bx, gA[1]], "rgba(110,62,24,0.55)", Math.max(1, u * 0.01));
      }
      const gg = ctx.createLinearGradient(0, gM[1], 0, gA[1]);
      gg.addColorStop(0, "rgba(30,30,80,0.3)"); gg.addColorStop(1, "rgba(255,170,80,0.12)");
      ctx.fillStyle = gg; ctx.fillRect(gA[0], gM[1], gB[0] - gA[0], gA[1] - gM[1]);
      ctx.restore();
      // the Loft Pane: a little round window, warm from the room below
      const lp = L(L(gA, gB, 0.5), gM, 0.42), lr = u * (G.main ? 0.085 : 0.06);
      glow(ctx, lp[0], lp[1], lr * 3.2, "255,180,90", 0.28 * warm);
      ctx.fillStyle = "#6a4422"; ctx.beginPath(); ctx.arc(lp[0], lp[1], lr + u * 0.02, 0, TAU); ctx.fill();
      const lg = ctx.createRadialGradient(lp[0], lp[1] + lr * 0.3, 0, lp[0], lp[1], lr);
      lg.addColorStop(0, `rgba(255,${Math.round(215 + 20 * warm)},140,1)`); lg.addColorStop(1, "rgba(235,140,60,1)");
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lp[0], lp[1], lr, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#8a5a2c"; ctx.lineWidth = Math.max(1, u * 0.012);
      ctx.beginPath(); ctx.moveTo(lp[0] - lr, lp[1]); ctx.lineTo(lp[0] + lr, lp[1]); ctx.moveTo(lp[0], lp[1] - lr); ctx.lineTo(lp[0], lp[1] + lr); ctx.stroke();
      // frost ferns in the pane's corner
      ctx.strokeStyle = "rgba(235,245,255,0.6)";
      ctx.beginPath(); ctx.arc(lp[0], lp[1], lr * 0.82, Math.PI * 0.6, Math.PI * 1.1); ctx.stroke();

      // barge boards along the front edge of the roof, with a gold trim line, and the gold run climbing them
      for (const [a, b] of [[fA, fM], [fB, fM]]) {
        line(ctx, a, b, "#7a4a1e", Math.max(2, u * 0.05));
        line(ctx, [a[0], a[1] + u * 0.018], [b[0], b[1] + u * 0.018], "#ffd166", Math.max(1, u * 0.012));
        line(ctx, [a[0], a[1] - u * 0.02], [b[0], b[1] - u * 0.02], "rgba(240,248,255,0.85)", Math.max(1, u * 0.014));
        if (runF >= 0) {
          for (let k = 0; k <= 8; k++) {
            const q = k / 8, dd = runF * 2 - q;   // first half of the run climbs the boards
            if (dd < 0 || dd > 0.6) continue;
            const pt = L(a, b, q), a2 = (1 - dd / 0.6) * (runF > 1 ? Math.max(0, 1 - (runF - 1) * 2.5) : 1);
            glow(ctx, pt[0], pt[1], u * 0.09, "255,200,110", 0.6 * a2);
          }
        }
      }
      // the second half runs back along the ridge
      if (runF >= 0.5) {
        for (let k = 0; k <= 10; k++) {
          const q = k / 10, dd = (runF - 0.5) * 2 - q;
          if (dd < 0 || dd > 0.6) continue;
          const pt = L(fM, bM, q), a2 = (1 - dd / 0.6) * (runF > 1 ? Math.max(0, 1 - (runF - 1) * 2.5) : 1);
          glow(ctx, pt[0], pt[1], u * 0.09, "255,205,120", 0.55 * a2);
        }
      }
      G.fM = fM; G.bM = bM;
    });

    // the main ridge's two gold stars: the window's star at the front peak, the back wall's star at the back
    const M = gables[1], lit = runF > 0.45 && runF < 1.5 ? 1 : 0, litB = runF > 0.9 && runF < 1.6 ? 1 : 0;
    const fs = [M.fM[0], M.fM[1] - u * 0.07], bs = [M.bM[0], M.bM[1] - u * 0.06];
    line(ctx, M.fM, fs, "#c89a3a", Math.max(1, u * 0.015));
    line(ctx, M.bM, bs, "#c89a3a", Math.max(1, u * 0.015));
    glow(ctx, bs[0], bs[1], u * 0.14, "255,210,120", 0.3 + 0.15 * Math.sin(t * 1.5 + 1) + 0.45 * litB);
    star(ctx, bs[0], bs[1], u * 0.045, "#ffd166");
    glow(ctx, fs[0], fs[1], u * 0.2, "255,210,120", 0.4 + 0.2 * Math.sin(t * 1.5) + 0.5 * lit);
    star(ctx, fs[0], fs[1], u * 0.065, "#ffd166");
    // the little gem on the door gable's peak
    const D = gables[0];
    glow(ctx, D.fM[0], D.fM[1] - u * 0.03, u * 0.08, "120,220,255", 0.25 + 0.2 * night);
    ctx.fillStyle = "#7fe6ff"; ctx.beginPath(); ctx.arc(D.fM[0], D.fM[1] - u * 0.03, Math.max(1, u * 0.02), 0, TAU); ctx.fill();

    // a thin curl of warm air from the ridge vent, bent east by the breeze
    const vent = L(M.fM, M.bM, 0.55);
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.15 + i / 3) % 1;
      const wx = vent[0] + f * u * 0.35 + Math.sin(t * 1.1 + i * 2) * u * 0.04, wy = vent[1] - f * u * 0.55;
      const a = Math.sin(f * Math.PI) * (0.08 + 0.06 * warm);
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      ctx.beginPath(); ctx.ellipse(wx, wy, u * (0.04 + 0.06 * f), u * (0.025 + 0.03 * f), 0, 0, TAU); ctx.fill();
    }
  };
})();
