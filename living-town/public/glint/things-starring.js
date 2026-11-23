// Kindle's Grid: the Star Ring, a little seat of pale stones in a ring at the far west end of the Meadow Path.
// starring (th.x, th.y = the ring's tile, which is an "f" tile and the last entry of the meadowlamp's `path`, so the path's
// stones curve into it and the Meadow Lamp's wave runs all the way in). flat: walkers step inside. th.seat makes grid.js treat
// it like a bench: Kindle stops inside and sits on the middle stone. Drawn in two halves: floor, back stones and far stars in
// the normal pass; the front stones in GLINT_OVER so they stand in front of whoever sits inside.
// th.stars: absolute far stars in the dark north (y < 0); th.shape: index pairs joined by gold threads (a little house).
// Lights (th._go): a tap, someone settling inside, or the Meadow Lamp's wave arriving. Stones light round the ring, then the
// threads draw star to star and hold. While someone sits inside, the threads stay faintly drawn. `?pose=ring` holds it lit.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  const darkness = () => {
    if (POSE === "ring") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const O = window.GLINT_OVER = window.GLINT_OVER || {};
  const G = window.GLINT_GROUND || {};
  const ringOf = () => (window.GLINT_WORLD?.things || []).find(th => th.kind === "starring");
  const lampOf = () => (window.GLINT_WORLD?.things || []).find(th => th.kind === "meadowlamp");
  const N = 9, RX = 0.6, RY = 0.36;   // nine stones round an ellipse (tiles)

  // the ring's own tile: frosty meadow moss, worn a little paler inside the ring (stones are drawn by the thing)
  const oldF = G.f && G.f.draw;
  if (G.f) G.f.draw = function (ctx, sx, sy, s, t, tx, ty) {
    const r = ringOf();
    if (!r || r.x !== tx || r.y !== ty) { if (oldF) oldF.call(this, ctx, sx, sy, s, t, tx, ty); return; }
    ctx.fillStyle = "#0c2a2c"; ctx.fillRect(sx, sy, s, s);
    ctx.strokeStyle = "#1c6b5c"; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
  };

  // stone k: its spot round the ring (k = 0 just south of the gap, going clockwise); back stones have sin < 0
  // ten places round the ring, the east one left open where the path comes in
  const stone = (k, x, y, s) => { const a = (k + 1) * TAU / (N + 1); return { a, px: x + Math.cos(a) * RX * s, py: y + Math.sin(a) * RY * s, back: Math.sin(a) < -0.05 }; };

  function state(th, t) {
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const inside = ws.some(w => Math.abs((w.x ?? w.fx) - th.x) < 0.45 && Math.abs((w.y ?? w.fy) - th.y) < 0.45);
    const sitting = ws.some(w => w.seated && w.bench === th);
    if (th.tapped != null && th.tapped !== th._seenTap) { th._seenTap = th.tapped; th._go = th.tapped; }
    if (sitting && !th._wasSit && !(t - (th._go ?? -99) < 8)) th._go = t;
    th._wasSit = sitting;
    const lamp = lampOf(), lw = lamp?._wave != null ? t - lamp._wave : 99;   // the lamp's light reaches the ring
    if (lw > 2.6 && lw < 3.2 && th._fromWave !== lamp._wave) { th._fromWave = lamp._wave; if (!(t - (th._go ?? -99) < 8)) th._go = t; }
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    const want = POSE === "ring" || sitting ? 1 : inside ? 0.6 : 0;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 1.5);
    const e = POSE === "ring" ? 2.6 : th._go != null ? t - th._go : 99;
    return { k: th._k, e, dark: darkness() };
  }
  // how lit stone k is: a light runs round the ring (0.18 s apart), then they all stay warm while the threads hold
  const lit = (k, e) => { if (e < 0 || e > 9) return 0; const q = e - k * 0.18; if (q < 0) return 0; return q < 0.3 ? q / 0.3 : Math.max(0.45, 1 - (q - 0.3) * 0.5) * (e > 7 ? 1 - (e - 7) / 2 : 1); };

  function drawStone(ctx, px, py, s, k, l, t, dark) {
    const w = s * (0.1 + hash(k) * 0.03), h = s * (0.1 + hash(k + 9) * 0.05), lean = (hash(k + 3) - 0.5) * s * 0.03;
    if (l > 0.02) glow(ctx, px, py - h * 0.5, s * 0.3, "255,220,150", 0.55 * l);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(px, py + s * 0.01, w * 1.15, w * 0.4, 0, 0, TAU); ctx.fill();
    // a low rounded stone: dark side, pale face, frosty cap
    ctx.fillStyle = "#6e7a84";
    ctx.beginPath(); ctx.moveTo(px - w, py); ctx.quadraticCurveTo(px - w * 1.05 + lean, py - h * 1.1, px + lean, py - h); ctx.quadraticCurveTo(px + w * 1.05 + lean, py - h * 1.1, px + w, py); ctx.closePath(); ctx.fill();
    ctx.fillStyle = l > 0.5 ? "#fff3d6" : "#d9ded8";
    ctx.beginPath(); ctx.moveTo(px - w, py); ctx.quadraticCurveTo(px - w * 1.05 + lean, py - h * 1.1, px + lean, py - h); ctx.quadraticCurveTo(px + w * 0.3 + lean, py - h * 0.6, px + w * 0.15, py); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(235,250,255,0.85)"; ctx.beginPath(); ctx.ellipse(px + lean, py - h * 0.95, w * 0.55, h * 0.16, 0, 0, TAU); ctx.fill();
    const tw = Math.max(0, Math.sin(t * 1.7 + k * 2.3));   // a frost glint
    if (tw > 0.85) { ctx.fillStyle = `rgba(255,255,255,${(tw - 0.85) * 6 * (0.5 + 0.5 * dark)})`; ctx.fillRect(px + lean - w * 0.3, py - h * 0.98, Math.max(1, s * 0.025), Math.max(1, s * 0.025)); }
    // a little gold star set into the face of each stone, bright when it's lit
    star(ctx, px - w * 0.25 + lean * 0.5, py - h * 0.45, s * 0.022, `rgba(255,209,102,${0.45 + 0.55 * l})`);
  }
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }

  T.starring = function starring(ctx, x, y, s, t, th = {}) {
    const ox = x - (th.x + 0.5) * s, oy = y - (th.y + 0.5) * s;
    const { k, e, dark } = state(th, t);
    const stars = th.stars || [], shape = th.shape || [];

    // the far stars over the edge of the ground, faint by day, bright at night
    stars.forEach(([sx, sy, sz = 1], i) => {
      const px = ox + sx * s, py = oy + sy * s, tw = 0.55 + 0.45 * Math.sin(t * (0.8 + hash(i + 20) * 1.3) + i * 1.9);
      const R = s * 0.055 * sz * (0.8 + 0.3 * tw), on = Math.max(k * 0.5, e < 9 ? Math.min(1, Math.max(0, e - 1.6 - i * 0.25) * 2) * (e > 7 ? 1 - (e - 7) / 2 : 1) : 0);
      glow(ctx, px, py, R * (3.2 + 2 * on), on > 0.3 ? "255,225,160" : "210,230,255", (0.15 + 0.25 * tw + 0.35 * on) * (0.4 + 0.6 * dark));
      ctx.fillStyle = `rgba(245,250,255,${0.45 + 0.5 * tw})`;
      ctx.beginPath(); ctx.moveTo(px, py - R); ctx.lineTo(px + R * 0.28, py); ctx.lineTo(px, py + R); ctx.lineTo(px - R * 0.28, py); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - R, py); ctx.lineTo(px, py + R * 0.28); ctx.lineTo(px + R, py); ctx.lineTo(px, py - R * 0.28); ctx.closePath(); ctx.fill();
    });
    // gold threads star to star: drawn one after another once the ring is lit, faint while someone sits inside
    shape.forEach(([a, b], j) => {
      const A = stars[a], B = stars[b]; if (!A || !B) return;
      const grow = e < 9 ? Math.max(0, Math.min(1, (e - 1.8 - j * 0.35) / 0.4)) : 0, fade = e > 7 ? Math.max(0, 1 - (e - 7) / 2) : 1;
      const u = Math.max(grow, k > 0.5 ? 1 : 0), al = Math.max(grow * fade * 0.85, k * 0.35) * (0.5 + 0.5 * dark);
      if (u <= 0 || al <= 0.02) return;
      const ax = ox + A[0] * s, ay = oy + A[1] * s, bx = ax + (ox + B[0] * s - ax) * u, by = ay + (oy + B[1] * s - ay) * u;
      ctx.strokeStyle = `rgba(255,214,130,${al})`; ctx.lineWidth = Math.max(1, s * 0.018); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (grow > 0 && grow < 1) glow(ctx, bx, by, s * 0.12, "255,230,170", 0.8 * fade);
    });

    const sc = th.scale || 1; ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    // a soft light rising from inside the ring toward the stars while it is lit
    const all = e < 9 ? Math.min(1, e / 1.6) * (e > 7 ? 1 - (e - 7) / 2 : 1) : 0;
    glow(ctx, x, y, s * (0.6 + 0.1 * k), "200,225,255", 0.08 + 0.06 * dark + 0.1 * k + 0.12 * all);
    if (all > 0.05) for (let j = 0; j < 5; j++) {
      const q = ((t * 0.35 + j / 5) % 1), px = x + Math.sin(j * 2.1 + t) * s * 0.2, py = y - q * s * 1.6;
      glow(ctx, px, py, s * 0.07, "255,230,170", 0.6 * all * (1 - q));
    }
    // the floor of the ring: paler frosty moss, a few frost sparkles
    ctx.fillStyle = "rgba(150,200,200,0.12)"; ctx.beginPath(); ctx.ellipse(x, y, RX * s * 0.95, RY * s * 0.95, 0, 0, TAU); ctx.fill();
    for (let j = 0; j < 7; j++) {
      const a = hash(j + 40) * TAU, rr = Math.sqrt(hash(j + 50)) * 0.8, tw = Math.max(0, Math.sin(t * 1.4 + j * 2.7));
      ctx.fillStyle = `rgba(225,245,255,${0.2 + 0.5 * tw})`; ctx.fillRect(x + Math.cos(a) * RX * rr * s, y + Math.sin(a) * RY * rr * s, Math.max(1, s * 0.02), Math.max(1, s * 0.02));
    }
    // the middle stone: broad and flat, the seat, with a gold star laid into its top
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.03, s * 0.2, s * 0.08, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7d8891"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.015, s * 0.19, s * 0.08, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#dfe3dc"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.01, s * 0.18, s * 0.07, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y - s * 0.01, s * 0.14, "255,214,120", 0.2 + 0.4 * all);
    ctx.save(); ctx.translate(x, y - s * 0.01); ctx.scale(1, 0.42); star(ctx, 0, 0, s * 0.1, "#ffd166"); ctx.restore();
    // the back stones
    for (let j = 0; j < N; j++) { const st = stone(j, x, y, s); if (st.back) drawStone(ctx, st.px, st.py, s, j, lit(j, e), t, dark); }
  };
  // the front stones stand in front of whoever sits inside
  O.starring = function (ctx, x, y, s, t, th = {}) {
    const e = POSE === "ring" ? 2.6 : th._go != null ? t - th._go : 99, dark = darkness();
    const sc = th.scale || 1; ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    const front = [];
    for (let j = 0; j < N; j++) { const st = stone(j, x, y, s); if (!st.back) front.push([st, j]); }
    front.sort((a, b) => a[0].py - b[0].py).forEach(([st, j]) => drawStone(ctx, st.px, st.py, s, j, lit(j, e), t, dark));
  };
})();
