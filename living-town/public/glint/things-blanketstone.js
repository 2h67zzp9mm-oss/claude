// Kindle's Grid: the Blanket Stone, a low flat stone inside the Star Ring, just west of Kindle's seat, for Pip.
// blanketstone (fractional x/y inside the ring's tile; drawn at x+0.5 like any thing). A warm amber heart glows through
// the stone, the frost around it has melted to dark green moss, and a woolly violet-and-teal blanket (like the Star
// Lookout's) lies folded on top with a gold star stitched on it. Heat shimmers rise off it, brighter at night.
// Warmer (th._k) while Kindle sits in the ring (waiting beside it) or a traveler is close; a tap makes it "breathe":
// the blanket puffs up, a warm ring spreads and sparks lift. `?pose=warmstone` holds the tap glow and full warmth.
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
    if (POSE === "warmstone") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};

  T.blanketstone = function blanketstone(ctx, x, y, s, t, th = {}) {
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const ring = (window.GLINT_WORLD?.things || []).find(o => o.kind === "starring");
    const waiting = ws.some(w => w.seated && w.bench === ring);
    const near = ws.some(w => w.kind === "traveler" && Math.abs((w.x ?? w.fx) - th.x) < 1.2 && Math.abs((w.y ?? w.fy) - th.y) < 1.2);
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    const want = POSE === "warmstone" || near ? 1 : waiting ? 0.75 : 0.45;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 1.2);
    const k = th._k, dark = darkness();
    const e = POSE === "warmstone" ? 0.9 : th.tapped != null ? t - th.tapped : 99;
    const puff = e < 3 ? Math.sin(Math.min(1, e / 3) * Math.PI) : 0;   // the tap: a warm breath that swells and settles
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.3);                   // the stone's warmth pulses slowly, like a hearth

    const sc = th.scale || 1; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    const w = s * 0.2, h = s * 0.075;   // a low flat stone (half width, half height of the top)
    // the frost has melted in a ring around it: dark soft moss, and a warm wash on the ground
    ctx.fillStyle = "rgba(14,52,40,0.85)"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.02, w * 1.45, h * 2.0, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(30,90,60,0.55)"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.02, w * 1.25, h * 1.7, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y, s * (0.38 + 0.12 * puff), "255,170,90", (0.12 + 0.18 * k + 0.12 * dark) * breathe + 0.3 * puff);
    if (puff > 0.02) {   // a ring of warmth spreading out over the frost
      const rr = Math.min(1, e / 2.2);
      ctx.strokeStyle = `rgba(255,190,120,${0.5 * (1 - rr)})`; ctx.lineWidth = Math.max(1, s * 0.015);
      ctx.beginPath(); ctx.ellipse(x, y + s * 0.02, w * (1 + rr * 1.6), h * (1.6 + rr * 2.4), 0, 0, TAU); ctx.stroke();
    }
    // the stone: shadow, warm dark side, pale warm top
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.035, w * 1.05, h * 1.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7a6f6a"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.018, w, h * 1.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,150,70,${(0.25 + 0.35 * k) * breathe})`;   // the warm heart showing through the side
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.03, w * 0.75, h * 0.45, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#e6dcd2"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.005, w * 0.97, h, 0, 0, TAU); ctx.fill();

    // the folded blanket on top, violet and teal like the one at the Star Lookout; it puffs up when touched
    const bw = w * 0.78, bh = s * (0.06 + 0.02 * puff), by = y - s * 0.005, bt = by - bh;
    const fold = [[x - bw, by + s * 0.01], [x - bw * 0.95, bt + s * 0.01], [x + bw * 0.9, bt], [x + bw, by + s * 0.005]];
    ctx.fillStyle = "#5a3f8c"; ctx.beginPath(); ctx.moveTo(x - bw, by + s * 0.012); ctx.lineTo(x + bw, by + s * 0.007); ctx.lineTo(x + bw * 0.98, by + s * 0.022); ctx.lineTo(x - bw * 0.98, by + s * 0.026); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e8e2f4"; ctx.beginPath(); fold.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.quadraticCurveTo(x, by + s * 0.03, fold[0][0], fold[0][1]); ctx.closePath(); ctx.fill();
    const stripe = (f, col) => { const yy = bt + (by - bt) * f; ctx.fillStyle = col; ctx.fillRect(x - bw * 0.97, yy, bw * 1.95, Math.max(1, s * 0.016)); };
    stripe(0.3, "#c9a8ff"); stripe(0.62, "#27c9c2");
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(x - bw * 0.85, bt + s * 0.004, bw * 1.65, Math.max(1, s * 0.01));   // the soft top fold
    star(ctx, x + bw * 0.45, bt + (by - bt) * 0.47, s * 0.026, `rgba(255,209,102,${0.8 + 0.2 * k})`);   // a gold star stitched on, like the cushions
    // the fringe at the open end stirs in the breeze
    const wh = window.GLINT_WIND ? window.GLINT_WIND(t) : 3.4, blow = Math.cos(wh) * s * 0.02;
    ctx.strokeStyle = "#d8d0ea"; ctx.lineWidth = Math.max(1, s * 0.01);
    for (let i = 0; i <= 4; i++) {
      const fy = bt + s * 0.006 + (by - bt) * i / 4.5, sway = blow * (0.6 + 0.4 * Math.sin(t * 5 + i * 1.7));
      ctx.beginPath(); ctx.moveTo(x - bw, fy); ctx.lineTo(x - bw - s * 0.03 + sway, fy + s * 0.008); ctx.stroke();
    }
    glow(ctx, x, bt + s * 0.02, s * 0.16, "255,200,140", (0.1 + 0.15 * k) * breathe * (0.5 + 0.5 * dark) + 0.25 * puff);

    // warmth shimmering up off it into the cold air, and a few sparks when it breathes
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const q = (t * 0.4 + i / 3) % 1, px = x + (i - 1) * w * 0.5, al = (0.2 + 0.25 * k + 0.15 * dark) * Math.sin(q * Math.PI);
      ctx.strokeStyle = `rgba(255,215,170,${al})`; ctx.lineWidth = Math.max(1, s * 0.012);
      ctx.beginPath();
      for (let j = 0; j <= 6; j++) { const f = j / 6, yy = bt - s * 0.03 - (q * 0.3 + f * 0.16) * s, xx = px + Math.sin(f * 5 + t * 3 + i) * s * 0.02; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    if (puff > 0.02 || k > 0.9) for (let i = 0; i < 6; i++) {
      const f = (t * 0.6 + i / 6) % 1;
      glow(ctx, x + Math.sin(t * 2 + i * 2.3) * s * 0.12 * f, bt - f * s * 0.5, s * 0.05, "255,200,120", Math.max(puff, (k - 0.9) * 5) * (1 - f));
    }
    ctx.restore();
  };
})();
