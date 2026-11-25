// Kindle's Grid: the Stone Walls (kind "westwalls") of the first West Meadow house: the two side walls and the back wall,
// pale hearth stone like the window and door walls, standing along where the gold string was. No roof yet, so from the
// front you see the warm inner face of the back wall over the top of the front walls, and the frosted caps of the side walls
// running back to it. A round Star Pane is set high in the back wall, and a gold star on the back wall's cap lines up with
// the star on the window wall: the roof's ridge will run from one to the other.
// Warm light from inside soaks the inner stones (more at night and while the Way-In Door is open), and in the cold air
// little wisps of warmth rise out of the open top. When the Window Path's warm run arrives (warmpath `_arrive`), or on a
// tap, a gold glow runs round the wall caps: door side, back, window side. `?pose=westwalls` holds night + the run.
// Draws BEFORE the window/door walls (y 2.19 < 2.2) so they cover its lower part. Geometry is in absolute tile units
// (tile centre = n + 0.5, same frame as the window/door: front base 3.68, front top ~2.53).
// Stub `westwalls() {}` in things.js; loads after things-westdoor.js.
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
  function star(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  const lerp = (a, b, f) => a + (b - a) * f;

  T.westwalls = function westwalls(ctx, x, y, s, t, th = {}) {
    const P = (ax, ay) => [x + (ax - th.x - 0.5) * s, y + (ay - th.y - 0.5) * s];
    const g = th.geo || {};
    const xL = g.xL ?? 0.08, xR = g.xR ?? 2.324, fTop = g.fTop ?? 2.53, fBase = 3.68;
    const ins = 0.13, xLb = xL + ins, xRb = xR - ins, bBase = 2.88, bTop = g.bTop ?? 1.73;
    const cap = 0.07, thick = 0.1;
    const W = window.GLINT_WORLD?.things || [];
    const door = W.find(o => o.kind === "westdoor"), path = W.find(o => o.kind === "warmpath");
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    const night = POSE === "westwalls" ? 1 : h >= 17 || h < 7 ? 1 : h >= 16 || h < 8 ? 0.6 : 0;
    const open = door?._o ?? 0;
    // the warm run round the caps: from the warm path arriving, or a tap
    const arrive = path && path._arrive != null ? t - path._arrive - 1.0 : 99;
    const tap = th.tapped != null ? t - th.tapped : 99;
    let e = Math.min(arrive >= 0 ? arrive : 99, tap >= 0 ? tap : 99);
    if (POSE === "westwalls") e = (t % 4);
    const runF = e < 3 ? e / 2.2 : -1;   // 0..1 along the caps, a little tail after
    const flick = 0.88 + 0.08 * Math.sin(t * 5.1) + 0.04 * Math.sin(t * 11.7);
    const warm = Math.min(1.4, (0.45 + 0.35 * night + 0.35 * open + (e < 3 ? 0.35 * Math.sin(Math.PI * Math.min(1, e / 3)) : 0)) * flick);

    const pFL = P(xL, fTop), pFR = P(xR, fTop), pBL = P(xLb, bTop), pBR = P(xRb, bTop);
    const pBLb = P(xLb, bBase), pBRb = P(xRb, bBase), pFLb = P(xL, fBase), pFRb = P(xR, fBase);
    const u = s;   // one tile in pixels

    // shadow the walls throw on the frost to the north-east (just a soft dark behind)
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse((pBL[0] + pBR[0]) / 2, pBLb[1] - u * 0.05, (pBR[0] - pBL[0]) * 0.58, u * 0.12, 0, 0, TAU); ctx.fill();

    // the inside floor (mostly hidden), then the back wall's inner face: pale stones washed warm from inside
    poly(ctx, [pBLb, pBRb, pFRb, pFLb], "#5a4632");
    ctx.save();
    poly(ctx, [pBL, pBR, pBRb, pBLb], "#cbbfa8"); ctx.clip();
    const bw = pBR[0] - pBL[0], bh = pBLb[1] - pBL[1], rows = 6, rh = bh / rows, n = 6;
    for (let r = 0; r < rows; r++) {
      const ry = pBL[1] + r * rh, off = r % 2 ? 0.5 : 0;
      for (let c = -1; c < n + 1; c++) {
        const sx = pBL[0] + (c + off) * (bw / n);
        ctx.fillStyle = ["#ddd2bf", "#d2c6b1", "#d8ccb8", "#c6b9a2"][(r * 5 + c + 9) % 4];
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(sx + u * 0.012, ry + u * 0.012, bw / n - u * 0.024, rh - u * 0.024, u * 0.03); else ctx.rect(sx, ry, bw / n - 2, rh - 2);
        ctx.fill();
      }
    }
    // inside the top of the wall is in the cool of the sky; lower down the warmth from the room soaks in
    const sh = ctx.createLinearGradient(0, pBL[1], 0, pBLb[1]);
    sh.addColorStop(0, `rgba(40,60,110,${0.35 - 0.1 * warm})`); sh.addColorStop(1, "rgba(40,60,110,0)");
    ctx.fillStyle = sh; ctx.fillRect(pBL[0], pBL[1], bw, bh);
    glow(ctx, (pBL[0] + pBR[0]) / 2, pBLb[1], u * 1.1, "255,160,80", 0.32 * warm);
    glow(ctx, P(0.6, 2.9)[0], P(0.6, 2.9)[1], u * 0.6, "255,170,90", 0.25 * open * warm);   // the open door lets in a little more
    // the round Star Pane high in the back wall: night sky, and one star that twinkles
    const [spx, spy] = P(1.2, 2.06), sr = u * 0.12;
    ctx.fillStyle = "#6a4422"; ctx.beginPath(); ctx.arc(spx, spy, sr + u * 0.025, 0, TAU); ctx.fill();
    const sky = ctx.createLinearGradient(0, spy - sr, 0, spy + sr);
    sky.addColorStop(0, "#0d1640"); sky.addColorStop(1, "#24306a");
    ctx.fillStyle = sky; ctx.beginPath(); ctx.arc(spx, spy, sr, 0, TAU); ctx.fill();
    const tw = 0.6 + 0.4 * Math.sin(t * 2.3);
    glow(ctx, spx + sr * 0.25, spy - sr * 0.2, sr * 0.9, "200,220,255", 0.5 * tw);
    star(ctx, spx + sr * 0.25, spy - sr * 0.2, sr * 0.32, "#eaf2ff");
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(spx - sr * 0.5, spy + sr * 0.25, u * 0.012, u * 0.012);
    ctx.strokeStyle = "#8a5a2c"; ctx.lineWidth = Math.max(1, u * 0.012);
    ctx.beginPath(); ctx.moveTo(spx - sr, spy); ctx.lineTo(spx + sr, spy); ctx.moveTo(spx, spy - sr); ctx.lineTo(spx, spy + sr); ctx.stroke();
    ctx.restore();

    // the side walls' inner faces: slanting back from the front corners to the back wall
    for (const side of [-1, 1]) {
      const fT = side < 0 ? pFL : pFR, bT = side < 0 ? pBL : pBR, bB = side < 0 ? pBLb : pBRb, fB = side < 0 ? pFLb : pFRb;
      ctx.save();
      poly(ctx, [fT, bT, bB, fB], side < 0 ? "#c2b59e" : "#b8ab93"); ctx.clip();
      // stone courses following the slope
      for (let r = 1; r < 8; r++) {
        const f = r / 8;
        ctx.strokeStyle = "rgba(120,100,78,0.45)"; ctx.lineWidth = Math.max(1, u * 0.01);
        ctx.beginPath(); ctx.moveTo(fT[0], lerp(fT[1], fB[1], f)); ctx.lineTo(bT[0], lerp(bT[1], bB[1], f)); ctx.stroke();
        for (let k = 0; k < 3; k++) {   // joints between stones, staggered
          const q = (k + (r % 2 ? 0.5 : 0.15)) / 3, jx = lerp(fT[0], bT[0], q);
          const jy = lerp(lerp(fT[1], fB[1], f), lerp(bT[1], bB[1], f), q);
          ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(jx, jy + (fB[1] - fT[1]) / 8 * 0.9); ctx.stroke();
        }
      }
      const sg = ctx.createLinearGradient(fT[0], 0, bT[0], 0);
      sg.addColorStop(0, "rgba(30,40,80,0.28)"); sg.addColorStop(1, "rgba(30,40,80,0.05)");
      ctx.fillStyle = sg; ctx.fillRect(Math.min(fT[0], bT[0]) - 2, bT[1], Math.abs(bT[0] - fT[0]) + 4, fB[1] - bT[1]);
      glow(ctx, bB[0], bB[1], u * 0.7, "255,165,85", 0.2 * warm);
      ctx.restore();
    }

    // the wall caps, seen from above: pale stone with frost on top. Walk the run of gold along them.
    // cap path: front-left -> back-left -> back-right -> front-right (outer edge offset by the wall thickness)
    const capPts = [
      [pFL, [pFL[0] - thick * u, pFL[1] - cap * u * 0.5], pBL, [pBL[0] - thick * u * 0.8, pBL[1] - cap * u]],
      [pBL, [pBL[0] - thick * u * 0.8, pBL[1] - cap * u], pBR, [pBR[0] + thick * u * 0.8, pBR[1] - cap * u]],
      [pBR, [pBR[0] + thick * u * 0.8, pBR[1] - cap * u], pFR, [pFR[0] + thick * u, pFR[1] - cap * u * 0.5]],
    ];
    const lens = capPts.map(([a, , b]) => Math.hypot(b[0] - a[0], b[1] - a[1])), total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    capPts.forEach(([a, ao, b, bo], i) => {
      poly(ctx, [a, b, bo, ao], "#e4dccd");
      ctx.strokeStyle = "rgba(245,250,255,0.9)"; ctx.lineWidth = Math.max(1.5, u * 0.03); ctx.lineCap = "round";   // frost along the cap
      ctx.beginPath(); ctx.moveTo((a[0] + ao[0]) / 2, (a[1] + ao[1]) / 2); ctx.lineTo((b[0] + bo[0]) / 2, (b[1] + bo[1]) / 2); ctx.stroke();
      ctx.strokeStyle = "rgba(110,95,75,0.6)"; ctx.lineWidth = Math.max(1, u * 0.01);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      // the gold run
      if (runF >= 0) {
        for (let k = 0; k <= 10; k++) {
          const q = k / 10, along = (acc + lens[i] * q) / total, dd = runF - along;
          if (dd < 0 || dd > 0.35) continue;
          const a2 = (1 - dd / 0.35) * (runF > 1 ? Math.max(0, 1 - (runF - 1) * 2.5) : 1);
          const mx = lerp((a[0] + ao[0]) / 2, (b[0] + bo[0]) / 2, q), my = lerp((a[1] + ao[1]) / 2, (b[1] + bo[1]) / 2, q);
          glow(ctx, mx, my, u * 0.1, "255,200,110", 0.55 * a2);
        }
      }
      acc += lens[i];
    });
    // little frost-flowers tucked along the back cap, and the gold star where the ridge will land
    [0.2, 0.42, 0.78].forEach((q, i) => {
      const fx = lerp(pBL[0], pBR[0], q), fy = pBL[1] - cap * u * 0.6 + Math.sin(t * 1.3 + i) * u * 0.004;
      const rgb = ["150,210,255", "190,160,255", "150,230,220"][i];
      glow(ctx, fx, fy, u * 0.06, rgb, 0.3 + 0.35 * night);
      ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath(); ctx.arc(fx, fy, Math.max(1, u * 0.018), 0, TAU); ctx.fill();
    });
    const [rsx, rsy] = P(1.7, bTop - cap * 0.9);
    const lit = runF > 0.4 && runF < 1.4 ? 1 : 0;
    glow(ctx, rsx, rsy, u * 0.14, "255,210,120", 0.35 + 0.2 * Math.sin(t * 1.5 + 1) + 0.4 * lit);
    star(ctx, rsx, rsy, u * 0.05, "#ffd166");

    // warmth rising out of the open top into the cold air: soft pale wisps, and a few gold motes at night
    if (!W.some(o => o.kind === "westroof")) for (let i = 0; i < 4; i++) {
      const f = (t * 0.12 + i / 4) % 1, wx = lerp(pBL[0], pBR[0], 0.2 + 0.2 * i) + Math.sin(t * 0.9 + i * 1.7) * u * 0.08;
      const wy = lerp(pFL[1] + u * 0.1, pBL[1] - u * 0.7, f);
      const a = Math.sin(f * Math.PI) * (0.1 + 0.08 * warm);
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      ctx.beginPath(); ctx.ellipse(wx, wy, u * (0.06 + 0.08 * f), u * (0.035 + 0.04 * f), 0, 0, TAU); ctx.fill();
      if (night > 0.5) glow(ctx, wx + u * 0.05, wy + u * 0.08, u * 0.04, "255,210,130", a * 3);
    }
  };
})();
