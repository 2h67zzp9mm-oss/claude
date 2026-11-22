// Kindle's Grid: the Table Sign beside the Bakery Table (kind "tablesign"). A little A-frame board of honey wood with
// gold hinges and gold feet, a dark green slate on the front written in chalk: "SIT A WHILE", a chalk honey bun with a
// curl of chalk steam, and a small chalk arrow pointing to the stools. A tiny clay pot of glow flowers sits on top.
// A walker within ~1.6 of the table eases th._near: the chalk warms to gold, the steam curls, the arrow nudges.
// A tap (4 s): the letters light one by one and chalk dust sparkles off the slate. `?pose=chalk` holds both.
// Also wraps GLINT_THINGS.bakerytable to set a flower pot on the table (th.pot). Drawn x1.9 from the feet.
// Loads after things-bakerytable.js (stub `tablesign() {}` in things.js).
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
  const FLOWERS = [["255,130,200", "#ff78c4"], ["255,214,120", "#ffd166"], ["150,200,255", "#8fc8ff"], ["200,150,255", "#c49bff"]];

  // a little clay pot with a gold band and glowing flowers on green stems
  function pot(ctx, x, b, s, t, k) {
    const w = s * 0.032, h = s * 0.04;
    FLOWERS.forEach(([rgb, col], i) => {
      const a = (i - 1.5) * 0.45 + Math.sin(t * 1.4 + i * 1.7) * 0.08, L = s * (0.07 + 0.012 * (i % 2));
      const fx = x + Math.sin(a) * L, fy = b - h - Math.cos(a) * L;
      ctx.strokeStyle = "#3fbf7a"; ctx.lineWidth = Math.max(0.8, s * 0.006);
      ctx.beginPath(); ctx.moveTo(x + (i - 1.5) * w * 0.3, b - h); ctx.quadraticCurveTo(x + Math.sin(a) * L * 0.3, fy + L * 0.4, fx, fy); ctx.stroke();
      glow(ctx, fx, fy, s * (0.035 + 0.02 * k), rgb, 0.45 + 0.35 * k);
      ctx.fillStyle = col;
      for (let p = 0; p < 5; p++) { const pa = p / 5 * TAU + t * 0.2; ctx.beginPath(); ctx.arc(fx + Math.cos(pa) * s * 0.009, fy + Math.sin(pa) * s * 0.009, Math.max(0.8, s * 0.008), 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(fx, fy, Math.max(0.7, s * 0.005), 0, TAU); ctx.fill();
    });
    poly(ctx, [[x - w, b - h], [x + w, b - h], [x + w * 0.75, b], [x - w * 0.75, b]], "#c8643c");
    poly(ctx, [[x - w, b - h], [x - w * 0.2, b - h], [x - w * 0.15, b], [x - w * 0.75, b]], "#e0845a");
    ctx.fillStyle = "#ffd166"; ctx.fillRect(x - w * 1.08, b - h - s * 0.004, w * 2.16, s * 0.01);
  }
  T._tablePot = pot;

  // the Bakery Table gets its flower pot (front corner by the bun plate side, so it never hides the empty plate)
  const baseTable = T.bakerytable;
  if (baseTable && !baseTable._pot) {
    T.bakerytable = function (ctx, x, y, s, t, th = {}) {
      ctx.save(); baseTable(ctx, x, y, s, t, th); ctx.restore();
      if (!th.pot) return;
      const b = y + s * 0.25, k = th._near ?? 0;
      ctx.save(); ctx.translate(x, b); ctx.scale(2.1, 2.1); ctx.translate(-x, -b);
      pot(ctx, x - s * 0.125, b - s * 0.27 - s * 0.012, s * 0.85, t, k);
      ctx.restore();
    };
    T.bakerytable._pot = true;
  }

  T.tablesign = function tablesign(ctx, x, y, s, t, th = {}) {
    const e = POSE === "chalk" ? 2.2 : th.tapped != null ? t - th.tapped : 99;
    const tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    const tx = th.table ? th.table[0] : th.x - 0.6, ty = th.table ? th.table[1] : th.y + 0.6;
    const near = POSE === "chalk" ? 1 : (window.GLINT_GRID?.walkers || []).reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) - tx, (w.fy ?? w.y) - ty) / 1.6), 0);
    th._near = (th._near ?? 0) + (near - (th._near ?? 0)) * 0.06;
    const k = Math.max(th._near, tap);

    const b = y + s * 0.25;
    ctx.translate(x, b); ctx.scale(1.9, 1.9); ctx.translate(-x, -b);

    // shadow and the back leg of the A-frame
    ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.005, s * 0.16, s * 0.04, 0, 0, TAU); ctx.fill();
    const W = s * 0.12, H = s * 0.36, top = b - H;
    poly(ctx, [[x - W * 0.7, top + s * 0.02], [x + W * 0.7, top + s * 0.02], [x + W * 0.95, b - s * 0.03], [x - W * 0.95, b - s * 0.03]], "#6e3d1c");
    // front board: honey frame around a green slate, leaning back a little
    const fw = W, L = x - fw, R = x + fw, sl = s * 0.02;
    poly(ctx, [[L + sl, top], [R - sl, top], [R + s * 0.01, b], [L - s * 0.01, b]], "#b06a32");
    poly(ctx, [[L + sl, top], [L + sl + s * 0.02, top], [L + s * 0.012, b], [L - s * 0.01, b]], "#e0a05a");
    const bt = top + s * 0.03, bb = b - s * 0.06;
    poly(ctx, [[L + sl + s * 0.022, bt], [R - sl - s * 0.022, bt], [R - s * 0.012, bb], [L + s * 0.012, bb]], "#1f3a30");
    glow(ctx, x, (bt + bb) / 2, s * 0.14, "255,200,110", 0.12 + 0.3 * k);
    // gold hinges, gold feet
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(x - s * 0.05, top - s * 0.012, s * 0.024, s * 0.016); ctx.fillRect(x + s * 0.026, top - s * 0.012, s * 0.024, s * 0.016);
    ctx.fillRect(L - s * 0.02, b - s * 0.02, s * 0.04, s * 0.02); ctx.fillRect(R - s * 0.02, b - s * 0.02, s * 0.04, s * 0.02);

    // chalk writing: SIT / A WHILE, the letters light one by one on a tap
    const chalk = (i, n) => {
      const lit = tap > 0 ? Math.min(1, Math.max(0, (e * 1.3 - i * 0.18))) * tap : 0;
      return { lit, col: lit > 0.2 ? "#fff1b8" : k > 0.3 ? "rgba(255,236,190,0.95)" : "rgba(240,244,236,0.88)" };
    };
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const write = (txt, cy, fs, i0) => {
      ctx.font = `bold ${Math.max(5, fs)}px ui-rounded, "Arial Rounded MT Bold", sans-serif`;
      const wd = ctx.measureText(txt).width, n = txt.length;
      for (let i = 0; i < n; i++) {
        const c = chalk(i0 + i, n), cx = x - wd / 2 + ctx.measureText(txt.slice(0, i)).width + ctx.measureText(txt[i]).width / 2;
        if (c.lit > 0.1) glow(ctx, cx, cy, fs * 0.9, "255,214,120", 0.6 * c.lit);
        ctx.fillStyle = c.col; ctx.fillText(txt[i], cx, cy);
      }
    };
    write("SIT", bt + s * 0.05, s * 0.06, 0);
    write("A WHILE", bt + s * 0.105, s * 0.04, 3);

    // a chalk honey bun with a chalk curl of steam
    const cbx = x - s * 0.02, cby = bt + s * 0.2;
    ctx.strokeStyle = k > 0.3 ? "rgba(255,214,120,0.95)" : "rgba(240,244,236,0.85)"; ctx.lineWidth = Math.max(0.8, s * 0.007); ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(cbx, cby, s * 0.04, s * 0.024, 0, Math.PI, TAU); ctx.lineTo(cbx - s * 0.04, cby); ctx.stroke();
    ctx.beginPath(); for (let a = 0; a < TAU * 1.4; a += 0.4) { const r = s * 0.006 * a, px = cbx + Math.cos(a) * r, py = cby - s * 0.01 + Math.sin(a) * r * 0.5; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    const sw = Math.sin(t * 2) * s * 0.008 * (0.4 + k);
    ctx.beginPath(); ctx.moveTo(cbx, cby - s * 0.03); ctx.bezierCurveTo(cbx - s * 0.02 + sw, cby - s * 0.045, cbx + s * 0.02 - sw, cby - s * 0.06, cbx + sw, cby - s * 0.075); ctx.stroke();
    // a small chalk arrow pointing left, to the stools (it nudges when someone comes close)
    const ax = x + s * 0.065 - Math.max(0, Math.sin(t * 4)) * s * 0.012 * k, ay = cby - s * 0.01;
    ctx.beginPath(); ctx.moveTo(ax + s * 0.02, ay); ctx.lineTo(ax - s * 0.02, ay); ctx.moveTo(ax - s * 0.008, ay - s * 0.012); ctx.lineTo(ax - s * 0.02, ay); ctx.lineTo(ax - s * 0.008, ay + s * 0.012); ctx.stroke();
    // the chalk ledge with a stub of chalk on it
    ctx.fillStyle = "#8a4f24"; ctx.fillRect(L + s * 0.012, bb, (R - L) - s * 0.024, s * 0.014);
    ctx.fillStyle = "#f4f1e6"; ctx.fillRect(x + s * 0.03, bb - s * 0.006, s * 0.03, s * 0.008);

    // chalk dust sparkles on a tap
    if (tap > 0) for (let i = 0; i < 7; i++) {
      const f = (e * 0.6 + i / 7) % 1;
      glow(ctx, x + Math.sin(i * 2.3 + t) * fw * 0.8, bt + (bb - bt) * (0.2 + 0.6 * ((i * 0.37) % 1)) - f * s * 0.1, s * 0.03, "255,248,220", 0.7 * tap * (1 - f));
    }

    // the little pot of glow flowers on top of the board
    pot(ctx, x, top - s * 0.006, s * 0.9, t, k);
  };
})();
