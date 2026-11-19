// Kindle's Grid: the Amber Oven, a little outdoor oven of amber stones beside the Second Little House,
// and the warm loaf resting on the Welcome Mat. Adds GLINT_THINGS.amberoven (things.js keeps a stub for it)
// and wraps GLINT_THINGS.mat so a mat with `loaf: true` has a loaf lying on it.
// The oven: a stone plinth, a dome laid in courses of amber stones, a gold-rimmed arched mouth with a fire inside,
// a short flue with warm puffs. It warms the frost on the moss around it (frost glints fade near it).
// Brightens when tapped (4 s) or when a walker is within ~1.8 tiles; ?pose=roar holds it bright too.
(() => {
  const TAU = Math.PI * 2;
  const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function gem(ctx, x, y, w, h, light, mid, dark) {
    poly(ctx, [[x, y - h], [x - w, y], [x, y]], light); poly(ctx, [[x, y - h], [x + w, y], [x, y]], mid);
    poly(ctx, [[x, y + h], [x - w, y], [x, y]], mid); poly(ctx, [[x, y + h], [x + w, y], [x, y]], dark);
  }
  function stone(ctx, cx, cy, w, h, fill, edge) {   // one rounded amber stone
    ctx.fillStyle = edge; ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.12, w, h, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.92, h * 0.85, 0, 0, TAU); ctx.fill();
  }

  window.GLINT_THINGS = window.GLINT_THINGS || {};

  window.GLINT_THINGS.amberoven = function amberoven(ctx, x, y, s, t, th = {}) {
    const since = th.tapped != null ? t - th.tapped : 99, flare = since >= 0 && since < 4 ? Math.sin(Math.min(1, since / 4) * Math.PI) : 0;
    const near = (window.GLINT_GRID?.walkers || []).reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) - th.x, (w.fy ?? w.y) - th.y) / 1.8), 0);
    const fire = Math.min(1, 0.3 + t / 3) * (0.8 + 0.12 * Math.sin(t * 6.1) + 0.08 * Math.sin(t * 11.3 + 2)) * (1 + 0.6 * flare + 0.2 * near);
    const b = y + s * 0.36, cx = x, W = s * 0.47;          // ground line and half-width of the oven
    const domeY = b - s * 0.32, dr = s * 0.44, dh = s * 0.5;   // dome sits on a plinth s*0.3 tall

    // frost on the cold moss: little white glints that fade where the oven's warmth reaches
    for (let i = 0; i < 14; i++) {
      const a = rnd(i + 3) * TAU, d = s * (0.55 + rnd(i + 9) * 0.5), fx = cx + Math.cos(a) * d, fy = b - s * 0.1 + Math.sin(a) * d * 0.45;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + rnd(i) * 2) + i * 2.1), melt = Math.min(1, (d / s - 0.5) / 0.5) * (1 - 0.5 * flare);
      if (melt > 0.05) glow(ctx, fx, fy, s * 0.035 + 1, "220,240,255", 0.5 * tw * melt);
    }
    // warm pool on the ground, and shadow
    glow(ctx, cx, b, s * (0.95 + 0.15 * flare), "255,170,70", 0.22 * fire);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(cx, b, W * 1.15, s * 0.11, 0, 0, TAU); ctx.fill();

    // the plinth: two courses of square-ish stones
    const pl = ["#c9772a", "#e0913a"];
    for (let r = 0; r < 2; r++) {
      const ry = b - s * 0.07 - r * s * 0.13, n = 4, off = r % 2 ? 0.5 : 0;
      for (let i = 0; i < n + (off ? -1 : 0); i++) {
        const sx = cx - W + (i + 0.5 + off) * (2 * W / n);
        stone(ctx, sx, ry, W / n * 0.95, s * 0.068, pl[(i + r) % 2], "#7a3f12");
      }
    }
    // gold band on top of the plinth
    ctx.fillStyle = "#ffd166"; ctx.fillRect(cx - W * 1.02, domeY - s * 0.02, W * 2.04, s * 0.035);

    // the flue at the back, behind the dome top, with warm puffs
    const fx = cx + dr * 0.42, fTop = domeY - dh - s * 0.12;
    ctx.fillStyle = "#8c4a17"; ctx.fillRect(fx - s * 0.06, fTop, s * 0.12, s * 0.22);
    ctx.fillStyle = "#e0913a"; ctx.fillRect(fx - s * 0.06, fTop, s * 0.05, s * 0.22);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(fx - s * 0.075, fTop - s * 0.025, s * 0.15, s * 0.035);
    for (let i = 0; i < 4; i++) {
      const p = ((t * (0.35 + 0.25 * flare) + i / 4) % 1), px = fx + Math.sin(p * 5 + i) * s * 0.07, py = fTop - p * s * 0.75;
      glow(ctx, px, py, s * (0.06 + p * 0.12), "255,225,180", (1 - p) * (0.35 + 0.3 * flare));
    }

    // the dome: an amber half-ellipse laid in courses of stones
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, domeY, dr, dh, 0, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = "#7a3f12"; ctx.fill();
    ctx.clip();
    const courses = 4, cols = ["#ffb347", "#f2a03d", "#ffc56b", "#e8892e"];
    for (let r = 0; r < courses; r++) {
      const v0 = r / courses, v1 = (r + 1) / courses, yy = domeY - dh * (v0 + v1) / 2, half = dr * Math.sqrt(1 - ((v0 + v1) / 2) ** 2);
      const n = Math.max(2, 6 - r), sw = (2 * half) / n;
      for (let i = 0; i < n; i++) stone(ctx, cx - half + (i + 0.5 + (r % 2 ? 0.15 : 0)) * sw, yy, sw * 0.52, dh / courses * 0.55, cols[(i + r * 2) % 4], "#7a3f12");
    }
    // the warmth shining through the stones from inside
    const inner = ctx.createRadialGradient(cx, domeY, 0, cx, domeY, dr);
    inner.addColorStop(0, `rgba(255,190,90,${0.35 * fire})`); inner.addColorStop(1, "rgba(255,150,60,0)");
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = inner; ctx.fillRect(cx - dr, domeY - dh, dr * 2, dh);
    ctx.restore();
    // highlight along the dome's top edge
    ctx.strokeStyle = "rgba(255,230,170,0.7)"; ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath(); ctx.ellipse(cx, domeY, dr * 0.97, dh * 0.97, 0, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();

    // the mouth: a gold-rimmed arch with fire inside
    const mw = dr * 0.42, mh = dh * 0.6, my = domeY;
    const mouth = () => { ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.lineTo(cx - mw, my - mh * 0.45); ctx.ellipse(cx, my - mh * 0.45, mw, mh * 0.55, 0, Math.PI, TAU); ctx.lineTo(cx + mw, my); ctx.closePath(); };
    ctx.fillStyle = "#ffd166"; ctx.save(); ctx.translate(cx, my); ctx.scale(1.18, 1.12); ctx.translate(-cx, -my); mouth(); ctx.fill(); ctx.restore();
    mouth(); ctx.fillStyle = "#2a0f05"; ctx.fill();
    ctx.save(); mouth(); ctx.clip();
    glow(ctx, cx, my, mw * 1.6, "255,120,40", 0.7 * fire);
    for (let i = 0; i < 5; i++) {                       // dancing flame tongues
      const fxi = cx + (i - 2) * mw * 0.38, hh = mh * (0.45 + 0.35 * Math.abs(Math.sin(t * (4 + i) + i * 1.7))) * Math.min(1.3, fire);
      poly(ctx, [[fxi - mw * 0.2, my], [fxi + Math.sin(t * 5 + i) * mw * 0.1, my - hh], [fxi + mw * 0.2, my]], i % 2 ? "#ffb347" : "#ff7a2e");
      poly(ctx, [[fxi - mw * 0.1, my], [fxi, my - hh * 0.55], [fxi + mw * 0.1, my]], "#fff0b0");
    }
    ctx.fillStyle = "#ff9a3c"; ctx.fillRect(cx - mw, my - s * 0.025, mw * 2, s * 0.025);   // ember bed
    ctx.restore();
    // keystone gem over the mouth
    gem(ctx, cx, my - mh * 1.08, s * 0.045, s * 0.06, "#fff6d6", "#ffd166", "#e09a2b");
    // light spilling out of the mouth onto the ground in front
    glow(ctx, cx, b + s * 0.05, s * (0.45 + 0.2 * flare), "255,170,70", 0.3 * fire);

    // sparks when touched
    if (flare > 0) for (let i = 0; i < 8; i++) {
      const p = ((since * 0.6 + rnd(i)) % 1), a = -Math.PI / 2 + (rnd(i + 5) - 0.5) * 1.4;
      glow(ctx, fx + Math.cos(a) * p * s * 0.5, fTop - Math.abs(Math.sin(a)) * p * s * 0.9, s * 0.04 + 1, i % 2 ? "255,214,120" : "255,150,80", (1 - p) * flare);
    }
  };

  // the warm loaf lying on a mat (th.loaf): a round golden loaf with three scores and a thin curl of warmth
  const mat = window.GLINT_THINGS.mat;
  if (mat && !mat.loafy) {
    const withLoaf = function (ctx, x, y, s, t, th) {
      mat.call(this, ctx, x, y, s, t, th);
      if (!th || !th.loaf) return;
      const lx = x + (th.ox || 0) * s + s * 0.2, ly = y - s * 0.27, lw = s * 0.15, lh = s * 0.1;
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(lx, ly + lh * 0.7, lw * 1.05, lh * 0.45, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#a5561a"; ctx.beginPath(); ctx.ellipse(lx, ly + lh * 0.1, lw, lh, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#e0913a"; ctx.beginPath(); ctx.ellipse(lx, ly - lh * 0.05, lw * 0.92, lh * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffc56b"; ctx.beginPath(); ctx.ellipse(lx - lw * 0.2, ly - lh * 0.35, lw * 0.5, lh * 0.35, -0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#fff0c8"; ctx.lineWidth = Math.max(1, s * 0.014);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(lx + i * lw * 0.42 - lw * 0.12, ly - lh * 0.45); ctx.lineTo(lx + i * lw * 0.42 + lw * 0.12, ly + lh * 0.25); ctx.stroke(); }
      const p = (t * 0.3) % 1;
      glow(ctx, lx + Math.sin(p * 6) * s * 0.03, ly - lh - p * s * 0.3, s * 0.05, "255,235,200", 0.25 * (1 - p));
    };
    withLoaf.loafy = true;
    window.GLINT_THINGS.mat = withLoaf;
  }
})();
