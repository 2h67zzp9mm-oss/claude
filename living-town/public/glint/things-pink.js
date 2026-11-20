// Kindle's Grid: the Third Little House's light-moths. Wraps GLINT_THINGS.cottage so a cottage with
// `moths: [[glowRGB, wingColour], ...]` has its own light-moths looping round the gem on its roof, and with
// `glowWindow: "r,g,b"` its round window glows that colour. A tap (th.tapped, 4 s) sends the moths out in a wide,
// fast swirl over the roof with a puff of sparks. Loads after things.js.
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

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const base = T.cottage;
  if (!base) return;

  T.cottage = function cottage(ctx, x, y, s, t, th = {}) {
    base(ctx, x, y, s, t, th);
    if (!th.moths && !th.glowWindow) return;
    const m = th.flip ? -1 : 1, b = y + s * 0.45, w = s * 0.88, h = s * 0.95, rt = b - h - s * 0.85, gy = rt - s * 0.12;
    const e = th.tapped != null ? t - th.tapped : 99, k = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    if (th.glowWindow) {   // the round window glows from inside, breathing slowly
      const wx = x + m * w * 0.4, wy = b - h * 0.56;
      glow(ctx, wx, wy, s * (0.42 + 0.12 * k), th.glowWindow, 0.45 + 0.1 * Math.sin(t * 1.4) + 0.3 * k);
    }
    (th.moths || []).forEach(([rgb, wing], i) => {
      const ph = rnd(th.x * 5 + th.y * 11 + i * 2.9) * TAU, sp = (0.8 + rnd(ph) * 0.6) * (i % 2 ? -1 : 1) * (1 + 1.4 * k), a = t * sp + ph;
      const r = s * (0.45 + 0.12 * Math.sin(t * 0.57 + ph * 2) + 0.6 * k);
      const mx = x + Math.cos(a) * r * 1.3 + Math.sin(t * 2.1 + ph) * s * 0.04;
      const my = gy - s * 0.05 + Math.sin(a) * r * 0.55 + Math.sin(t * 2.9 + ph * 3) * s * 0.05 - k * s * 0.35;
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + ph)), mw = s * 0.12, mh = s * 0.085;
      glow(ctx, mx, my, s * 0.2, rgb, 0.45);
      poly(ctx, [[mx, my - mh * 0.2], [mx - mw * flap, my - mh], [mx - mw * flap * 0.8, my + mh * 0.6], [mx, my + mh * 0.3]], wing);
      poly(ctx, [[mx, my - mh * 0.2], [mx + mw * flap, my - mh], [mx + mw * flap * 0.8, my + mh * 0.6], [mx, my + mh * 0.3]], wing);
      ctx.fillStyle = "#fffdf0"; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.017, s * 0.047, 0, 0, TAU); ctx.fill();
    });
    if (k > 0.02) for (let i = 0; i < 10; i++) {   // a puff of pink sparks off the roof when touched
      const f = (e * 0.6 + rnd(i * 3.3)) % 1, sx = x + (rnd(i * 7.1) - 0.5) * s * 1.6, sy = gy - f * s * 1.0;
      ctx.globalAlpha = k * (1 - f); ctx.fillStyle = i % 3 ? "#ffc2e6" : "#fff6d6";
      ctx.beginPath(); ctx.arc(sx, sy, s * 0.028, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  };
})();

// Kindle's Grid: the Homecoming Light by the pink door of the Third Little House (`kind: "homelight"`, anchored on the
// house's own tile so the numbers match the cottage drawing). A gold bracket on the wall holds a little pink-glass
// lantern with a gold star inside. While nobody is near it waits: a slow, soft heartbeat glow. When a traveler comes
// within ~3.2 tiles (or anyone stands on the pink mat, or it is tapped) it wakes: the star brightens, a warm pool of
// pink-gold light spills down over the doorstep and little star-sparks float up. Kindle alone nearby warms it a little.
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
  function star(ctx, x, y, R, fill) {
    const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    poly(ctx, p, fill);
  }
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};

  T.homelight = function homelight(ctx, x, y, s, t, th) {
    // how awake the light is: travelers close by wake it fully, Kindle alone a little
    const ws = (window.GLINT_GRID && window.GLINT_GRID.walkers) || [], dx = 10.9, dy = 25;
    let want = 0;
    for (const w of ws) {
      const d = Math.hypot((w.fx ?? w.x) - dx, (w.fy ?? w.y) - dy);
      if (d < 3.2) want = Math.max(want, w.kind === "glint" ? 0.45 : 1);
    }
    if (th.tapped != null && t - th.tapped < 5) want = 1;
    if (POSE === "home") want = 1;
    const dt = th._t != null ? Math.min(0.1, Math.max(0, t - th._t)) : 0; th._t = t;
    th._k = POSE === "home" ? 1 : Math.max(0, Math.min(1, (th._k || 0) + (want > (th._k || 0) ? dt * 1.5 : -dt * 0.5)));
    if (th._k > want && want > 0) th._k = Math.max(want, th._k - dt * 0.5);
    const k = th._k, beat = Math.pow(0.5 + 0.5 * Math.sin(t * 1.6), 3);   // a slow heartbeat while it waits

    // geometry, matching the cottage: b = foot of the wall, h = wall height (things.js / things-pink.js cottage)
    const cx = x, b = y + s * 0.45, h = s * 0.95;
    const wallX = cx + s * 0.86, armY = b - h * 0.86, lx = cx + s * 1.16, ly = b - h * 0.55;

    // the pool of light on the doorstep and the street in front of the door
    glow(ctx, cx + s * 0.55, b + s * 0.42, s * (0.7 + 0.5 * k), "255,170,215", 0.08 + 0.05 * beat + 0.4 * k);
    // the bracket: a plate on the wall, an arm with a curl, a short chain
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(wallX - s * 0.03, armY - s * 0.06, s * 0.06, s * 0.14);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(wallX, armY); ctx.lineTo(lx, armY); ctx.stroke();
    ctx.beginPath(); ctx.arc(wallX + s * 0.1, armY + s * 0.07, s * 0.07, -Math.PI / 2, Math.PI * 0.7); ctx.stroke();   // the curl under the arm
    const sw = Math.sin(t * 1.1) * s * 0.012 * (1 - 0.5 * k);
    ctx.lineWidth = Math.max(1, s * 0.016); ctx.beginPath(); ctx.moveTo(lx, armY); ctx.lineTo(lx + sw, ly - s * 0.17); ctx.stroke();

    // the lantern: gold cap, pink glass, a gold star inside, gold base
    const L = lx + sw, gw = s * 0.15, gh = s * 0.26, gt = ly - gh / 2;
    glow(ctx, L, ly, s * (0.5 + 0.6 * k), "255,120,196", 0.2 + 0.12 * beat + 0.3 * k);
    poly(ctx, [[L - gw * 0.55, gt - s * 0.05], [L + gw * 0.55, gt - s * 0.05], [L + gw * 1.05, gt], [L - gw * 1.05, gt]], "#ffd166");
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(L, gt - s * 0.07, s * 0.025, 0, TAU); ctx.fill();
    const glass = ctx.createLinearGradient(L - gw, 0, L + gw, 0);
    glass.addColorStop(0, `rgba(255,120,196,${0.75 + 0.2 * k})`); glass.addColorStop(0.5, `rgba(255,214,236,${0.8 + 0.2 * k})`); glass.addColorStop(1, `rgba(217,79,158,${0.8 + 0.2 * k})`);
    poly(ctx, [[L - gw, gt], [L + gw, gt], [L + gw * 0.8, gt + gh], [L - gw * 0.8, gt + gh]], glass);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.014);
    ctx.beginPath(); ctx.moveTo(L, gt); ctx.lineTo(L, gt + gh); ctx.stroke();
    poly(ctx, [[L - gw * 0.9, gt + gh], [L + gw * 0.9, gt + gh], [L + gw * 0.6, gt + gh + s * 0.04], [L - gw * 0.6, gt + gh + s * 0.04]], "#e09a2b");
    const R = s * (0.075 + 0.02 * beat + 0.03 * k);
    star(ctx, L, ly, R, k > 0.5 ? "#fffbe8" : "#ffe7a3");
    glow(ctx, L, ly, s * (0.12 + 0.06 * k), "255,236,170", 0.35 + 0.2 * beat + 0.2 * k);

    // awake: little star-sparks lift off the lantern and drift up toward the roof
    if (k > 0.05) for (let i = 0; i < 6; i++) {
      const f = (t * (0.25 + 0.04 * i) + rnd(i * 2.7)) % 1, px = L + (rnd(i * 4.1) - 0.5) * s * 0.3 + Math.sin(t * 1.3 + i) * s * 0.06;
      const py = gt - f * s * 0.9;
      ctx.globalAlpha = k * (1 - f); star(ctx, px, py, s * 0.035 * (1 - f * 0.5), i % 2 ? "#ffc6e8" : "#fff6d6"); ctx.globalAlpha = 1;
    }
  };
})();
