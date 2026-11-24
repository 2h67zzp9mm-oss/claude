// Kindle's Grid: the Spark-flowers (kind "westflowers"), star-flowers lining both sides of the stepping stones from the
// West Lamp out to the Spark Lamp, plus a little arc in front of the Spark Lamp's footing stone. Same flower as
// things-starflowers.js (frosted bud by day, five-pointed star at night), but these catch the Spark Lamp's colour: every
// time a spark lands in its globe, a flush of that colour runs east along the flowers from the lamp. The West Lamp's tap
// wave blooms them east->west; a tap on the flowers blooms them west->east (from the Spark Lamp back to the ring).
// Everything (solids + glows) draws in GLINT_OVER so the front arc sits in front of the footing stone. The thing itself
// is a flat stub at (4,2). Positions are world-centre coords (screen = toScreen(wx, wy)). `?pose=sparkbloom` = night.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const O = window.GLINT_OVER = window.GLINT_OVER || {};
  const COLS = [["214,240,255", "#e6f6ff", "#8fb9e8"], ["205,175,255", "#e3d4ff", "#8a6bd1"], ["255,220,150", "#fff0c8", "#d9a441"], ["170,245,230", "#d8fff6", "#3fae9c"]];
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0.005 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  const darkness = () => {
    if (POSE === "sparkbloom") return 1;
    if (POSE === "sparkbud") return 0;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const find = k => (window.GLINT_WORLD?.things || []).find(th => th.kind === k);
  const toHex = rgb => "#" + rgb.split(",").map(v => (+v).toString(16).padStart(2, "0")).join("");

  // the line of the stepping stones (world-centre coords), Spark Lamp end (west) to West Lamp end (east)
  const LINE = [[3.95, 2.88], [4.5, 2.92], [5.1, 2.8], [5.65, 2.9], [6.0, 2.86]];
  const lineY = x => {
    for (let i = 1; i < LINE.length; i++) if (x <= LINE[i][0]) { const [ax, ay] = LINE[i - 1], [bx, by] = LINE[i]; return ay + (by - ay) * (x - ax) / (bx - ax); }
    return LINE[LINE.length - 1][1];
  };
  // flowers: [wx, wy, colour, size, phase, along (0 at the Spark Lamp .. ~2.4 at the West Lamp)]
  const FL = [];
  for (let i = 0; i < 6; i++) {   // north side
    const wx = 4.08 + i * 0.29 + (hash(i, 1) - 0.5) * 0.06;
    FL.push([wx, lineY(wx) - 0.27 - hash(i, 2) * 0.05, i % 4, 0.85 + hash(i, 3) * 0.25, hash(i, 4) * TAU, wx - 3.5]);
  }
  for (let i = 0; i < 6; i++) {   // south side, staggered
    const wx = 4.22 + i * 0.29 + (hash(i, 5) - 0.5) * 0.06;
    FL.push([wx, lineY(wx) + 0.27 + hash(i, 6) * 0.04, (i + 2) % 4, 0.9 + hash(i, 7) * 0.25, hash(i, 8) * TAU, wx - 3.5]);
  }
  [[3.08, 3.24], [3.5, 3.34], [3.92, 3.24]].forEach(([wx, wy], i) =>   // a little arc in front of the Spark Lamp
    FL.push([wx, wy, (i * 3 + 1) % 4, 1.05, hash(i, 9) * TAU, 0.15]));
  FL.sort((a, b) => a[1] - b[1]);

  function state(f, t, th) {
    const wl = find("westlamp"), sl = find("sparklamp");
    const hit = (start, pos) => {   // a wave at 3 tiles/s: opens as it arrives, holds ~4 s, then settles
      if (start == null || t < start) return 0;
      const d = (t - start) * 3 - pos;
      return d < 0 ? Math.max(0, 1 + d * 2.5) : d < 12 ? 1 : Math.max(0, 1 - (d - 12) / 6);
    };
    let bloom = 0;
    if (wl?.tapped != null) bloom = Math.max(bloom, hit(wl.tapped + 0.4, 2.6 - f[5]));
    if (th.tapped != null) bloom = Math.max(bloom, hit(th.tapped, f[5]));
    if (POSE === "sparkwave") bloom = Math.max(bloom, hit(t - 0.8, f[5]));
    // the spark flush: when a spark lands in the Spark Lamp, its colour runs east along the flowers and fades
    let tint = 0, tcol = null;
    if (sl && sl._land != null && sl._col) {
      const d = (t - sl._land) * 2.2 - f[5];
      tint = d < 0 ? 0 : d < 0.4 ? d / 0.4 : Math.max(0, 1 - (d - 0.4) / 5);
      tcol = sl._col;
    }
    const dark = darkness();
    const open = Math.max(dark * (0.92 + 0.08 * Math.sin(t * 0.7 + f[4])), bloom, tint * 0.55);
    return { open, bloom, dark, tint, tcol };
  }

  function drawFlower(ctx, x, y, s, t, f, st) {
    const { open, bloom, tint, tcol } = st, [, light0, deep0] = COLS[f[2]], sz = f[3];
    const light = tint > 0.35 && tcol ? toHex(tcol) : light0, deep = deep0;
    const wh = window.GLINT_WIND ? window.GLINT_WIND(t) : 3.4, sway = Math.cos(wh) * s * 0.012 * Math.sin(t * 2.1 + f[4]);
    const h = s * (0.2 + 0.04 * open) * sz, hx = x + sway, hy = y - h;
    ctx.strokeStyle = "#2f8f72"; ctx.lineWidth = Math.max(1, s * 0.022); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.01, y - h * 0.5, hx, hy); ctx.stroke();
    ctx.fillStyle = "#37a27f";
    ctx.beginPath(); ctx.ellipse(x - s * 0.025, y - h * 0.3, s * 0.045 * sz, s * 0.016 * sz, -0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.025, y - h * 0.45, s * 0.04 * sz, s * 0.015 * sz, 0.6, 0, TAU); ctx.fill();
    const R = s * 0.12 * sz;
    if (open < 0.98) {   // frosted bud with a gold tip
      ctx.globalAlpha = 1 - open;
      ctx.fillStyle = deep; ctx.beginPath(); ctx.ellipse(hx, hy, R * 0.32, R * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(230,248,255,0.8)"; ctx.beginPath(); ctx.ellipse(hx - R * 0.1, hy - R * 0.15, R * 0.12, R * 0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(hx, hy - R * 0.55, Math.max(0.8, R * 0.1), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (open > 0.02) {   // five pointed petals, gold heart
      const ro = R * (0.35 + 0.65 * open), ri = ro * (0.42 + 0.1 * open), rot = -Math.PI / 2 + f[4] * 0.1 + 0.15 * Math.sin(t * 0.5 + f[4]);
      const star = (r1, r2, fill) => { ctx.fillStyle = fill; ctx.beginPath();
        for (let j = 0; j < 10; j++) { const r = j % 2 ? r2 : r1, an = rot + j * Math.PI / 5; ctx.lineTo(hx + Math.cos(an) * r, hy + Math.sin(an) * r * 0.8); }
        ctx.closePath(); ctx.fill(); };
      ctx.globalAlpha = Math.min(1, open * 1.6);
      star(ro, ri, deep); star(ro * 0.82, ri * 0.8, bloom > 0.5 ? "#ffffff" : light);
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(hx, hy, Math.max(0.8, ro * 0.22), 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff8e0"; ctx.beginPath(); ctx.arc(hx - ro * 0.05, hy - ro * 0.05, Math.max(0.5, ro * 0.09), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  T.westflowers = function westflowers() {};   // drawn in GLINT_OVER (below)

  O.westflowers = function (ctx, x, y, s, t, th = {}) {
    const scr = (wx, wy) => [x + (wx - th.x - 0.5) * s, y + (wy - th.y - 0.5) * s];
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const [cx, cy] = scr(4.7, 2.9); if (cx < -3 * s || cx > innerWidth + 3 * s || cy < -2 * s || cy > innerHeight + 2 * s) return;
    for (const f of FL) {
      const st = state(f, t, th), [px, py] = scr(f[0], f[1]), rgb0 = COLS[f[2]][0];
      const near = ws.some(w => Math.hypot((w.x ?? w.fx) + 0.5 - f[0], (w.y ?? w.fy) + 0.5 - f[1]) < 0.9) ? 1 : 0;
      const rgb = st.tint > 0.2 && st.tcol ? st.tcol : rgb0, hy = py - s * (0.2 + 0.04 * st.open) * f[3];
      // light underneath first, then the flower, then its halo and mote
      glow(ctx, px, py, s * 0.28, rgb, (0.1 * st.open * (0.5 + 0.5 * st.dark)) + 0.18 * st.tint);
      ctx.save(); try { drawFlower(ctx, px, py, s, t, f, st); } finally { ctx.restore(); }
      if (st.open < 0.05) continue;
      const tw = 0.8 + 0.2 * Math.sin(t * 1.7 + f[4] * 3);
      glow(ctx, px, hy, s * (0.26 + 0.08 * near + 0.12 * st.bloom + 0.08 * st.tint) * f[3], rgb, (0.4 * st.open + 0.2 * near + 0.4 * st.bloom + 0.35 * st.tint) * tw);
      const q = (t * 0.25 + f[4] / TAU) % 1;
      if (st.open > 0.6) glow(ctx, px + Math.sin(q * 6 + f[4]) * s * 0.05, hy - q * s * 0.7, s * 0.035, rgb, 0.6 * st.open * Math.sin(q * Math.PI));
    }
  };
})();
