// Kindle's Grid: Star-flowers, a row of blossoms along both sides of the Meadow Path that only open under the far stars.
// Positions come from the meadowlamp's `path` (same curve as the stones in things-meadowpath.js, offset sideways), two per
// tile, none on the Star Ring's tile. Solid stems/buds/petals draw in the ground pass (this file wraps GLINT_GROUND.f.draw,
// each flower kept inside its own tile so the next tile's fill can't cut it). Glows and rising motes draw in GLINT_OVER.
// Openness: darkness by device clock (dusk 16.5-18.5, dawn 6-8), plus a bloom wave: the Meadow Lamp's wave (east->west)
// or a tap on the starflowers thing (west->east, from the Star Ring back home). Bloomed flowers stay open ~5 s then settle.
// A walker within 0.9 tiles makes nearby flowers brighter. `?pose=starbloom` = full night bloom.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const O = window.GLINT_OVER = window.GLINT_OVER || {};
  const G = window.GLINT_GROUND || {};
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
    if (POSE === "starbloom") return 1;
    if (POSE === "starbud") return 0;   // daytime buds, for checking
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const things = () => window.GLINT_WORLD?.things || [];
  const lampOf = () => things().find(th => th.kind === "meadowlamp");
  const bedOf = () => things().find(th => th.kind === "starflowers");

  // where every flower sits: [tile x, tile y, fx, fy (0..1 in the tile), along (path index), colour, size, phase]
  let FL = null;
  function flowers() {
    if (FL) return FL;
    const lamp = lampOf(), path = lamp?.path || []; FL = [];
    path.forEach(([tx, ty], i) => {
      if (i === path.length - 1) return;   // the Star Ring's own tile
      const prev = i === 0 ? lamp.from || [tx + 1, ty] : path[i - 1], next = path[i + 1];
      const edge = ([nx, ny]) => [0.5 + (nx - tx) * 0.5, 0.5 + (ny - ty) * 0.5];
      const a = edge(prev), b = edge(next), c = [0.5 + (hash(tx, ty) - 0.5) * 0.18, 0.5 + (hash(ty, tx) - 0.5) * 0.18];
      [[0.25, 1, 1], [0.5, -1, 0.75], [0.78, 1, 1]].forEach(([u, side, big], j) => {
        const v = 1 - u, px = v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], py = v * v * a[1] + 2 * v * u * c[1] + u * u * b[1];
        let dx = 2 * v * (c[0] - a[0]) + 2 * u * (b[0] - c[0]), dy = 2 * v * (c[1] - a[1]) + 2 * u * (b[1] - c[1]);
        const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const off = 0.3 + hash(tx * 5 + j, ty * 3) * 0.06;
        const fx = Math.max(0.17, Math.min(0.83, px - dy * off * side)), fy = Math.max(0.3, Math.min(0.9, py + dx * off * side));
        FL.push([tx, ty, fx, fy, i + u, Math.floor(hash(tx * 3 + j, ty * 7) * 4), big * (0.85 + hash(j + tx, ty * 2) * 0.3), hash(tx + j * 9, ty) * TAU]);
      });
    });
    return FL;
  }

  // how open a flower is right now (0 bud .. 1 wide open), and how lit
  function state(f, t) {
    const lamp = lampOf(), bed = bedOf(), n = (lamp?.path || []).length;
    let bloom = 0;
    const waveHit = (start, pos) => {   // the wave runs 3 tiles/s; a flower opens as it arrives, holds ~5 s, then settles
      if (start == null || t < start) return 0;
      const d = (t - start) * 3 - pos;
      return d < 0 ? Math.max(0, 1 + d * 2.5) : d < 15 ? 1 : Math.max(0, 1 - (d - 15) / 6);
    };
    if (lamp?._wave != null) bloom = Math.max(bloom, waveHit(lamp._wave, f[4]));
    if (bed?.tapped != null) bloom = Math.max(bloom, waveHit(bed.tapped, n - 1 - f[4]));
    const dark = darkness();
    const open = Math.max(dark * (0.92 + 0.08 * Math.sin(t * 0.7 + f[7])), bloom);
    return { open, bloom, dark };
  }

  function drawFlower(ctx, x, y, s, t, f) {
    const { open, bloom } = state(f, t), [, light, deep] = COLS[f[5]], sz = f[6];
    const wh = window.GLINT_WIND ? window.GLINT_WIND(t) : 3.4, sway = Math.cos(wh) * s * 0.012 * Math.sin(t * 2.1 + f[7]);
    const h = s * (0.2 + 0.04 * open) * sz, hx = x + sway, hy = y - h;
    ctx.strokeStyle = "#2f8f72"; ctx.lineWidth = Math.max(1, s * 0.022); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.01, y - h * 0.5, hx, hy); ctx.stroke();
    ctx.fillStyle = "#37a27f";   // two little leaves
    ctx.beginPath(); ctx.ellipse(x - s * 0.025, y - h * 0.3, s * 0.045 * sz, s * 0.016 * sz, -0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.025, y - h * 0.45, s * 0.04 * sz, s * 0.015 * sz, 0.6, 0, TAU); ctx.fill();
    const R = s * 0.12 * sz;
    if (open < 0.98) {   // the closed bud, frosted, with a gold tip: fades as it opens
      ctx.globalAlpha = 1 - open;
      ctx.fillStyle = deep; ctx.beginPath(); ctx.ellipse(hx, hy, R * 0.32, R * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(230,248,255,0.8)"; ctx.beginPath(); ctx.ellipse(hx - R * 0.1, hy - R * 0.15, R * 0.12, R * 0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(hx, hy - R * 0.55, Math.max(0.8, R * 0.1), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (open > 0.02) {   // the blossom: five pointed petals unfolding into a star, a gold heart in the middle
      const ro = R * (0.35 + 0.65 * open), ri = ro * (0.42 + 0.1 * open), rot = -Math.PI / 2 + f[7] * 0.1 + 0.15 * Math.sin(t * 0.5 + f[7]);
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

  const oldF = G.f && G.f.draw;
  if (G.f) G.f.draw = function (ctx, sx, sy, s, t, tx, ty) {
    if (oldF) oldF.call(this, ctx, sx, sy, s, t, tx, ty);
    for (const f of flowers()) if (f[0] === tx && f[1] === ty) {
      ctx.save(); try { drawFlower(ctx, sx + f[2] * s, sy + f[3] * s, s, t, f); } finally { ctx.restore(); }
    }
  };

  T.starflowers = function starflowers() {};   // the flowers are drawn by the ground (solids) and GLINT_OVER (their light)

  // their light: a soft halo on each open blossom, brighter near a walker or when the bloom wave passes, and tiny motes
  // that drift up off them toward the far stars
  O.starflowers = function (ctx, x, y, s, t, th = {}) {
    const cam = window.GLINT_GRID?.cam; if (!cam) return;
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const scr = (wx, wy) => [innerWidth / 2 + (wx - cam.x) * cam.s, innerHeight / 2 + (wy - cam.y) * cam.s];
    for (const f of flowers()) {
      const { open, bloom, dark } = state(f, t); if (open < 0.05) continue;
      const wx = f[0] + f[2], wy = f[1] + f[3];
      const near = ws.some(w => Math.hypot((w.x ?? w.fx) + 0.5 - wx, (w.y ?? w.fy) + 0.5 - wy) < 0.9) ? 1 : 0;
      const [px, py] = scr(wx, wy); if (px < -s || py < -s || px > innerWidth + s || py > innerHeight + s) continue;
      const hy = py - s * (0.2 + 0.04 * open) * f[6], rgb = COLS[f[5]][0];
      const tw = 0.8 + 0.2 * Math.sin(t * 1.7 + f[7] * 3);
      glow(ctx, px, hy, s * (0.26 + 0.08 * near + 0.12 * bloom) * f[6], rgb, (0.4 * open + 0.2 * near + 0.4 * bloom) * tw);
      glow(ctx, px, py, s * 0.28, rgb, 0.1 * open * (0.5 + 0.5 * dark));   // a little light on the moss below
      const q = (t * 0.25 + f[7] / TAU) % 1;   // a mote drifting up toward the far stars
      if (open > 0.6) glow(ctx, px + Math.sin(q * 6 + f[7]) * s * 0.05, hy - q * s * 0.7, s * 0.035, rgb, 0.6 * open * Math.sin(q * Math.PI));
    }
  };
})();
