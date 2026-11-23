// Kindle's Grid: the Giggle Chimes (kind "chimes"), in the North Meadow on the east side of the North Road.
// A honey-wood post with gold bands and a gold crook; from the crook hangs a gold hoop with five crystal tubes
// (teal, violet, pink, amber, blue, different lengths) round a glowing star clapper with a little teal wind-sail.
// The tubes and sail sway with the breeze (same breeze sum as things-flags.js, heading from window.GLINT_WIND);
// when the clapper swings into a tube it sparks. A walker near makes them tinkle (sparks only). The Lamp Song
// (window.GLINT_SONG) lights them as it passes. Tap (4 s): they all swing wide, a run of giggly chime notes plays
// (Web Audio, only after a tap, unlocked on pointerup for iOS) and little coloured notes float up. `?pose=giggle`
// holds the swing. Stub `chimes() {}` in things.js.
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
  const POSE = new URLSearchParams(location.search).get("pose");
  const breeze = t => 0.55 + 0.25 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67 + 2.1) + 0.08 * Math.sin(t * 1.7);
  const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  const darkness = () => {
    if (POSE === "giggle") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  // tubes: [fill, light, glow rgb, length, note Hz]
  const TUBES = [
    ["#3fd8c8", "#c8fff6", "90,230,215", 0.62, 1318.5],
    ["#b48cff", "#e6d8ff", "185,150,255", 0.78, 1046.5],
    ["#ff8fc8", "#ffd6ea", "255,150,205", 0.52, 1568],
    ["#ffc94d", "#fff0b8", "255,214,110", 0.70, 1174.7],
    ["#57e1ff", "#d2f6ff", "110,225,255", 0.58, 1396.9],
  ];

  let ac = null;
  addEventListener("pointerup", () => {
    try { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { ac = null; }
  });
  // a giggle: the tubes skip up and down quickly, a little hiccup, then two long bright ones
  function ring() {
    if (!ac) return;
    try {
      const seq = [2, 4, 0, 3, 2, 4, 1, -1, 2, 4, 2, 4];
      seq.forEach((k, i) => {
        if (k < 0) return;
        const f = TUBES[k][4], o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
        const at = ac.currentTime + 0.05 + i * 0.075 + (i > 7 ? 0.12 : 0), last = i >= seq.length - 2;
        o.type = "sine"; o.frequency.value = f; o2.type = "sine"; o2.frequency.value = f * 2.76;   // a bell-ish overtone
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(last ? 0.045 : 0.03, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, at + (last ? 1.6 : 0.3));
        o.connect(g); o2.connect(g); g.connect(ac.destination); o.start(at); o2.start(at); o.stop(at + 1.7); o2.stop(at + 1.7);
      });
    } catch (e) { /* quiet */ }
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.chimes = function chimes(ctx, x, y, s, t, th = {}) {
    const S = s * (th.scale || 1.3), dark = darkness(), b = breeze(t);
    const wind = (window.GLINT_WIND || (() => 3.4))(t), side = Math.cos(wind);
    const since = POSE === "giggle" ? 1.0 : th.tapped != null ? t - th.tapped : 99;
    if (th.tapped != null && th.tapped !== th._rang && POSE !== "giggle") { th._rang = th.tapped; ring(); }
    const swing = since >= 0 && since < 4 ? Math.sin(Math.PI * since / 4) : 0;
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const near = Math.max(0, ...ws.map(w => 1 - Math.hypot((w.fx ?? w.x) - th.x, (w.fy ?? w.y) - th.y) / 2.2));
    let hum = 0;
    const song = window.GLINT_SONG;
    if (song && song.since != null) {
      const u = song.since - Math.hypot(th.x + 0.5 - song.bx, th.y - 0.5 - song.by) * song.step;
      if (u > 0 && u < 2.4) hum = Math.sin(u / 2.4 * Math.PI);
    }

    // the post: honey wood, gold bands, a gold crook curling west over the hoop
    const g0 = y + s * 0.3, px = x + S * 0.22, top = g0 - S * 1.45;
    glow(ctx, x, g0 - S * 0.6, S * 0.7, "170,200,255", 0.04 + 0.06 * dark + 0.06 * near + 0.15 * swing);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(px - S * 0.12, g0, S * 0.32, S * 0.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(px, g0 - S * 0.01, S * 0.07, S * 0.03, 0, 0, TAU); ctx.fill();
    const pw = Math.max(2, S * 0.06);
    const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
    pg.addColorStop(0, "#e0a05a"); pg.addColorStop(1, "#9c5a28");
    ctx.fillStyle = pg; ctx.fillRect(px - pw / 2, top, pw, g0 - top);
    ctx.fillStyle = "#ffd166";
    for (const f of [0.15, 0.55, 0.9]) ctx.fillRect(px - pw * 0.65, g0 - (g0 - top) * f, pw * 1.3, Math.max(1, S * 0.025));
    // crook
    const cx = x - S * 0.12, cy = top + S * 0.08;
    ctx.strokeStyle = "#e8b24a"; ctx.lineWidth = Math.max(1.4, S * 0.03); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px, top + S * 0.05); ctx.quadraticCurveTo(px, top - S * 0.12, (px + cx) / 2, top - S * 0.1);
    ctx.quadraticCurveTo(cx, top - S * 0.08, cx, cy); ctx.stroke();
    // a little gold star on top of the post
    ctx.fillStyle = "#ffd166"; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? S * 0.025 : S * 0.055; ctx.lineTo(px + Math.cos(a) * q, top - S * 0.06 + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill();
    glow(ctx, px, top - S * 0.06, S * 0.1, "255,214,120", 0.25 + 0.4 * dark);

    // the hoop sways a little with the wind; everything below hangs from it
    const sway = side * (0.05 + 0.12 * b) + Math.sin(t * 1.7) * 0.04 * b + swing * Math.sin(since * 9) * 0.18;
    const hx = cx + Math.sin(sway) * S * 0.12, hy = cy + S * 0.16;
    ctx.strokeStyle = "rgba(255,230,160,0.8)"; ctx.lineWidth = Math.max(0.8, S * 0.01);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
    const R = S * 0.2;
    // back half of the hoop
    ctx.strokeStyle = "#c98f2e"; ctx.lineWidth = Math.max(1.4, S * 0.028);
    ctx.beginPath(); ctx.ellipse(hx, hy, R, R * 0.3, 0, Math.PI, TAU); ctx.stroke();

    // the clapper: a glowing star on a gold thread, with a teal sail to catch the breeze
    const cAng = sway * 1.6 + side * 0.25 * b + Math.sin(t * 2.3 + 1) * 0.22 * b + swing * Math.sin(since * 11) * 0.5;
    const cL = S * 0.5, kx = hx + Math.sin(cAng) * cL, ky = hy + Math.cos(cAng) * cL;
    ctx.strokeStyle = "rgba(255,230,160,0.8)"; ctx.lineWidth = Math.max(0.6, S * 0.008);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(kx + Math.sin(cAng) * S * 0.22, ky + Math.cos(cAng) * S * 0.22); ctx.stroke();

    // the tubes, hung round the hoop, back ones first
    const order = TUBES.map((tb, i) => ({ tb, i, a: i / TUBES.length * TAU + 0.5 })).sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
    const sparks = [], tubes = [];
    for (const { tb, i, a } of order) {
      const ax = hx + Math.cos(a) * R, ay = hy + Math.sin(a) * R * 0.3;
      const ta = sway * 1.2 + Math.sin(t * (2 + i * 0.37) + i * 1.9) * 0.08 * (0.3 + b) + swing * Math.sin(since * 10 + i) * 0.35
        + near * Math.sin(t * 7 + i * 2) * 0.06;
      const L = S * tb[3], ex = ax + Math.sin(ta) * L, ey = ay + Math.cos(ta) * L;
      // does the clapper touch it? (horizontal distance near the clapper's height)
      const fT = Math.min(1, Math.max(0, (ky - ay) / L)), tx = ax + Math.sin(ta) * L * fT;
      const touch = Math.max(0, 1 - Math.abs(tx - kx) / (S * 0.06)) * (Math.abs(Math.sin(t * 5 + i * 2.4)) > 0.5 ? 1 : 0.4);
      const lit = Math.min(1, 0.25 * dark + 0.8 * hum + 0.7 * swing + 0.5 * touch + 0.2 * near);
      tubes.push({ tb, ax, ay, ta, L, ex, ey, lit });
      if (touch > 0.6) sparks.push([tx, ky, tb[2]]);
    }
    for (const u of tubes) if (u.lit > 0.05) glow(ctx, (u.ax + u.ex) / 2, (u.ay + u.ey) / 2, u.L * 0.45, u.tb[2], 0.08 + 0.22 * u.lit);
    for (const { tb, ax, ay, ta, L, lit } of tubes) {
      const w = Math.max(2, S * 0.055);
      ctx.strokeStyle = "rgba(255,230,160,0.7)"; ctx.lineWidth = Math.max(0.6, S * 0.008);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(-ta);
      const tg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      tg.addColorStop(0, tb[1]); tg.addColorStop(0.4, tb[0]); tg.addColorStop(1, tb[0]);
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, 0, w, L, w / 2) : ctx.rect(-w / 2, 0, w, L); ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,${0.25 - 0.15 * lit})`; ctx.lineWidth = Math.max(0.6, S * 0.006); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.4 * lit})`; ctx.fillRect(-w * 0.28, L * 0.08, Math.max(0.8, w * 0.16), L * 0.75);   // shine
      ctx.fillStyle = "#ffd166"; ctx.fillRect(-w * 0.6, 0, w * 1.2, Math.max(1, S * 0.03));                             // gold cap
      ctx.restore();
    }
    // front half of the hoop
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.4, S * 0.028);
    ctx.beginPath(); ctx.ellipse(hx, hy, R, R * 0.3, 0, 0, Math.PI); ctx.stroke();
    // clapper star and sail drawn over the tubes
    const sx = kx + Math.sin(cAng) * S * 0.22, sy = ky + Math.cos(cAng) * S * 0.22;
    ctx.fillStyle = "#27c9c2";
    ctx.beginPath(); ctx.moveTo(sx - S * 0.07, sy); ctx.lineTo(sx + S * 0.07, sy); ctx.lineTo(sx + side * S * 0.04, sy + S * 0.16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#9ff7ea"; ctx.beginPath(); ctx.moveTo(sx - S * 0.07, sy); ctx.lineTo(sx, sy); ctx.lineTo(sx + side * S * 0.04, sy + S * 0.16); ctx.closePath(); ctx.fill();
    const kl = 0.5 + 0.3 * dark + 0.5 * swing + 0.4 * hum;
    glow(ctx, kx, ky, S * (0.08 + 0.05 * kl), "255,240,200", 0.25 + 0.25 * kl);
    ctx.fillStyle = "#fff6d6"; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5 + t * 0.6, q = j % 2 ? S * 0.022 : S * 0.05; ctx.lineTo(kx + Math.cos(a) * q, ky + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill();
    for (const [qx, qy, rgb] of sparks) glow(ctx, qx, qy, S * 0.07, rgb, 0.8);

    // after a tap, little coloured notes float up and drift downwind, like giggles
    if (since < 4.5) {
      for (let k = 0; k < 7; k++) {
        const f = (since - k * 0.22) / 2.4; if (f <= 0 || f >= 1) continue;
        const tb = TUBES[k % TUBES.length], nx = hx + (k - 3) * S * 0.06 + side * f * S * 0.5 + Math.sin(f * 9 + k) * S * 0.06;
        const ny = hy - f * S * 1.0, a = Math.sin(f * Math.PI);
        glow(ctx, nx, ny, S * 0.09, tb[2], 0.6 * a);
        ctx.fillStyle = tb[1]; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.ellipse(nx, ny, S * 0.035, S * 0.026, -0.4, 0, TAU); ctx.fill();
        ctx.fillRect(nx + S * 0.025, ny - S * 0.11, Math.max(1, S * 0.012), S * 0.11);
        ctx.globalAlpha = 1;
      }
    }
    // a breath of cold clear air drifting past now and then
    const f = (t * 0.12) % 1, al = Math.sin(f * Math.PI) * 0.25 * b, wx = hx - S * 0.6 + f * S * 1.2;
    ctx.strokeStyle = `rgba(210,232,250,${al})`; ctx.lineWidth = Math.max(1, S * 0.012);
    ctx.beginPath(); ctx.moveTo(wx - S * 0.12, hy + S * 0.3); ctx.quadraticCurveTo(wx, hy + S * 0.26, wx + S * 0.12, hy + S * 0.3); ctx.stroke();
  };
})();
