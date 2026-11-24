// Kindle's Grid: the Star Chart, a tall pale standing stone in the North Meadow, north of the Star-flowers, with a slate face
// where Kindle chalks the shapes he finds in the far stars. starchart (fractional x/y; drawn at x+0.5 like any thing).
// th.shapes: [{ name, rgb, pts: [[x, y, size], ...] absolute (y < 0, the dark north), lines: [[a, b], ...], heart: index }].
// All shapes' stars twinkle faintly all the time (they read as ordinary far stars). th._i is the shape being shown, th._go
// when it started: threads draw star to star (0.3 s apart), hold, then fade by ~11 s; the slate shows the same shape in
// gold dots and one of three chalk ticks under it. Next shape: a tap, a walker arriving beside the stone, or on its own every
// ~16 s once it is dark (device clock, same curve as the ring), softer. `?pose=starchart0|1|2` holds shape 0/1/2 lit at night.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose") || "";
  const PI = /^starchart(\d)$/.exec(POSE);
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
    if (PI) return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const HOLD = 11;

  function state(th, t, n) {
    const dark = darkness();
    if (PI) return { i: +PI[1] % n, e: 4, soft: 1, dark };
    if (th._i == null) { th._i = -1; th._go = -99; }
    const e0 = t - th._go;
    const next = soft => { th._i = (th._i + 1) % n; th._go = t; th._soft = soft; };
    if (th.tapped != null && th.tapped !== th._seenTap) { th._seenTap = th.tapped; next(1); }
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const near = ws.some(w => Math.hypot((w.x ?? w.fx) - (th.x + 0.5), (w.y ?? w.fy) - (th.y + 0.5)) < 1.1);
    if (near && !th._wasNear && e0 > 4) next(1);
    th._wasNear = near;
    if (dark > 0.5 && t - th._go > 16) next(0.6);
    return { i: th._i, e: t - th._go, soft: th._soft ?? 1, dark };
  }

  T.starchart = function starchart(ctx, x, y, s, t, th = {}) {
    const shapes = th.shapes || []; if (!shapes.length) return;
    const ox = x - (th.x + 0.5) * s, oy = y - (th.y + 0.5) * s;
    const { i, e, soft, dark } = state(th, t, shapes.length);
    const fade = e < 0 ? 0 : e > HOLD - 2 ? Math.max(0, 1 - (e - (HOLD - 2)) / 2) : 1;
    const sky = 0.35 + 0.65 * dark;

    // every shape's stars, faint far stars until their shape is found
    shapes.forEach((sh, si) => sh.pts.forEach(([sx, sy, sz = 1], j) => {
      const on = si === i ? Math.min(1, Math.max(0, (e - j * 0.3) * 2.5)) * fade * soft : 0;
      const px = ox + sx * s, py = oy + sy * s, tw = 0.55 + 0.45 * Math.sin(t * (0.7 + hash(si * 10 + j) * 1.2) + j * 2.1 + si);
      const R = s * 0.05 * sz * (0.8 + 0.3 * tw) * (1 + 0.35 * on), heart = sh.heart === j;
      glow(ctx, px, py, R * (3 + 2.5 * on + (heart ? 2 * on : 0)), on > 0.2 ? sh.rgb : "210,230,255", (0.13 + 0.22 * tw + 0.5 * on) * sky);
      ctx.fillStyle = `rgba(245,250,255,${(0.4 + 0.45 * tw) * (0.6 + 0.4 * dark) + 0.15 * on})`;
      ctx.beginPath(); ctx.moveTo(px, py - R); ctx.lineTo(px + R * 0.28, py); ctx.lineTo(px, py + R); ctx.lineTo(px - R * 0.28, py); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - R, py); ctx.lineTo(px, py + R * 0.28); ctx.lineTo(px + R, py); ctx.lineTo(px, py - R * 0.28); ctx.closePath(); ctx.fill();
    }));
    // the found shape: threads in its own colour, drawn one after another
    const sh = shapes[i];
    if (sh && fade > 0) {
      sh.lines.forEach(([a, b], j) => {
        const A = sh.pts[a], B = sh.pts[b]; if (!A || !B) return;
        const grow = Math.max(0, Math.min(1, (e - 0.6 - j * 0.3) / 0.35)); if (grow <= 0) return;
        const ax = ox + A[0] * s, ay = oy + A[1] * s, bx = ax + (ox + B[0] * s - ax) * grow, by = ay + (oy + B[1] * s - ay) * grow;
        ctx.strokeStyle = `rgba(${sh.rgb},${0.85 * fade * soft * sky})`; ctx.lineWidth = Math.max(1.2, s * 0.022); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (grow < 1) glow(ctx, bx, by, s * 0.13, "255,240,200", 0.9 * soft);
      });
      if (sh.heart != null && e > 0.6 + sh.lines.length * 0.3) {   // the heart star: a little flame in the lantern, a warm crumb in the loaf, a bud on the tree
        const H = sh.pts[sh.heart], hx = ox + H[0] * s, hy = oy + H[1] * s, fl = 0.75 + 0.25 * Math.sin(t * 6.3) * Math.sin(t * 2.1);
        glow(ctx, hx, hy, s * 0.3 * fl, sh.rgb, 0.7 * fade * soft * sky);
      }
    }

    // the stone itself
    const sc = th.scale || 1; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    const lit = sh ? fade * soft : 0, W = s * 0.2, H = s * 0.62, base = y + s * 0.22;
    glow(ctx, x, base - H * 0.55, s * 0.55, sh ? sh.rgb : "200,225,255", 0.06 + 0.06 * dark + 0.22 * lit);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, base + s * 0.01, W * 1.4, W * 0.42, 0, 0, TAU); ctx.fill();
    // frost-melted moss and two small star-flower buds at its foot
    ctx.fillStyle = "rgba(60,150,110,0.35)"; ctx.beginPath(); ctx.ellipse(x, base, W * 1.25, W * 0.35, 0, 0, TAU); ctx.fill();
    // the standing stone: dark side, pale face, rounded top
    const slab = (w, h, lean) => { ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x - w * 0.92 + lean, base - h * 0.8); ctx.quadraticCurveTo(x + lean * 0.5, base - h * 1.12, x + w * 0.92 + lean, base - h * 0.8); ctx.lineTo(x + w, base); ctx.closePath(); };
    ctx.fillStyle = "#66727c"; slab(W * 1.08, H, s * 0.01); ctx.fill();
    ctx.fillStyle = "#d4dad4"; slab(W, H * 0.98, 0); ctx.fill();
    ctx.fillStyle = "#b3bcb8"; ctx.beginPath(); ctx.moveTo(x + W * 0.55, base); ctx.lineTo(x + W * 0.5, base - H * 0.78); ctx.lineTo(x + W * 0.92, base - H * 0.78); ctx.lineTo(x + W, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(235,250,255,0.9)"; ctx.beginPath(); ctx.ellipse(x - W * 0.05, base - H * 0.99, W * 0.55, H * 0.05, 0, 0, TAU); ctx.fill();
    // the slate face, framed in gold
    const fx = x - W * 0.66, fy = base - H * 0.78, fw = W * 1.2, fh = H * 0.5;
    ctx.fillStyle = "#c9a24a"; ctx.fillRect(fx - s * 0.012, fy - s * 0.012, fw + s * 0.024, fh + s * 0.024);
    ctx.fillStyle = "#16243a"; ctx.fillRect(fx, fy, fw, fh);
    // a tiny copy of the shape in gold dots on the slate (the last one found stays chalked there faintly)
    const show = sh || shapes[0], xs = show.pts.map(p => p[0]), ys = show.pts.map(p => p[1]);
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const k = Math.min((fw * 0.72) / (mxx - mnx || 1), (fh * 0.75) / (mxy - mny || 1));
    const mx = p => fx + fw / 2 + (p[0] - (mnx + mxx) / 2) * k, my = p => fy + fh / 2 + (p[1] - (mny + mxy) / 2) * k;
    const chalk = sh ? 0.35 + 0.65 * lit : 0.3;
    ctx.strokeStyle = `rgba(${show.rgb},${0.35 + 0.5 * chalk})`; ctx.lineWidth = Math.max(0.8, s * 0.008);
    show.lines.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(mx(show.pts[a]), my(show.pts[a])); ctx.lineTo(mx(show.pts[b]), my(show.pts[b])); ctx.stroke(); });
    show.pts.forEach(p => { ctx.fillStyle = `rgba(255,230,160,${0.55 + 0.45 * chalk})`; ctx.fillRect(mx(p) - s * 0.008, my(p) - s * 0.008, s * 0.016, s * 0.016); });
    // three chalk ticks under the slate, one for each shape found; the one being shown is gold
    shapes.forEach((_, j) => {
      const tx = x - W * 0.06 + (j - (shapes.length - 1) / 2) * W * 0.36, ty = base - H * 0.18;
      ctx.fillStyle = j === i ? `rgba(255,209,102,${0.6 + 0.4 * lit})` : "rgba(90,100,110,0.8)";
      ctx.beginPath(); ctx.arc(tx, ty, s * 0.018, 0, TAU); ctx.fill();
    });
    // a little gold star on the very top, brightest while a shape is up
    glow(ctx, x, base - H * 1.06, s * 0.16, "255,214,120", 0.25 + 0.5 * lit);
    star(ctx, x, base - H * 1.06, s * 0.05, "#ffd166");
    const tw = Math.max(0, Math.sin(t * 1.5 + 1.3));   // a frost glint
    if (tw > 0.88) { ctx.fillStyle = `rgba(255,255,255,${(tw - 0.88) * 8})`; ctx.fillRect(x + W * 0.3, base - H * 0.95, Math.max(1, s * 0.025), Math.max(1, s * 0.025)); }
    ctx.restore();
  };
})();
