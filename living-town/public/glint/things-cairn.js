// Kindle's Grid: the Waymark Cairn (kind "cairn"). A little stack of smooth slate stones at the top of the North Road,
// past the last lantern, marking the furthest north Kindle has walked. Each stone has a glowing band of its own colour
// (teal, violet, pink, amber from the bottom up) and on top sits a small gold star-pebble kept for Pip.
// Frost glints on the stones on cold clear nights (device clock: dark), and a few faint far stars hang in the dark north
// above it (y < 0, off the edge of the ground). A walker close by makes the bands breathe brighter and the gold pebble
// pulse. Tap (4 s): the bands light one by one from the bottom up with a soft rising chime (Web Audio, unlocked on
// pointerup for iOS), and a spark lifts off the gold pebble into the north. `?pose=climb` holds the light halfway up.
// Opts: th.stars = [[x, y, size]] absolute tile spots of the far stars. Stub `cairn() {}` in things.js.
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
  const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  const darkness = () => {
    if (POSE === "climb") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  // the chime: one soft sine per stone, rising (pentatonic)
  let ac = null;
  addEventListener("pointerup", () => {
    try { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { ac = null; }
  });
  function chime() {
    if (!ac) return;
    try {
      [392, 440, 523.25, 587.33, 783.99].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + 0.05 + i * 0.32;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(i === 4 ? 0.07 : 0.05, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0005, at + (i === 4 ? 2.4 : 1.3));
        o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + 2.6);
      });
    } catch (e) { /* quiet */ }
  }

  // stones bottom -> top: [width, height, x offset, band rgb, band light]
  const STONES = [
    [0.62, 0.27, 0.0, "70,225,205", "#9ff7ea"],
    [0.5, 0.24, 0.035, "175,140,255", "#d8c6ff"],
    [0.4, 0.21, -0.03, "255,140,200", "#ffc6e6"],
    [0.3, 0.17, 0.02, "255,190,100", "#ffe0a8"],
  ];

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill();
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.cairn = function cairn(ctx, x, y, s, t, th = {}) {
    const ox = x - (th.x + 0.5) * s, oy = y - (th.y + 0.5) * s;
    const dark = darkness();

    // far stars in the dark north, over the edge of the ground
    (th.stars || []).forEach(([sx, sy, sz = 1], i) => {
      const px = ox + sx * s, py = oy + sy * s, tw = 0.55 + 0.45 * Math.sin(t * (0.9 + hash(i) * 1.4) + i * 2.3);
      const R = s * 0.05 * sz * (0.8 + 0.3 * tw);
      glow(ctx, px, py, R * 3.2, i % 3 ? "210,230,255" : "255,225,160", (0.15 + 0.25 * tw) * (0.4 + 0.6 * dark));
      ctx.fillStyle = `rgba(245,250,255,${0.45 + 0.5 * tw})`;
      ctx.beginPath(); ctx.moveTo(px, py - R); ctx.lineTo(px + R * 0.28, py); ctx.lineTo(px, py + R); ctx.lineTo(px - R * 0.28, py); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - R, py); ctx.lineTo(px, py + R * 0.28); ctx.lineTo(px + R, py); ctx.lineTo(px, py - R * 0.28); ctx.closePath(); ctx.fill();
    });

    // who is near?
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const near = Math.max(0, ...ws.map(w => 1 - Math.hypot((w.fx ?? w.x) - th.x, (w.fy ?? w.y) - th.y) / 1.8));
    const since = POSE === "climb" ? 1.0 : th.tapped != null ? t - th.tapped : 99;
    if (th.tapped != null && th.tapped !== th._rang) { th._rang = th.tapped; chime(); }
    const lit = i => { const q = since - i * 0.32; return q < 0 || q > 3.2 ? 0 : q < 0.25 ? q / 0.25 : 1 - (q - 0.25) / 2.95; };

    const S = s * (th.scale || 1.15), bx = x, by = y + s * 0.32;
    // ground: a soft pool of light and the shadow
    glow(ctx, bx, by, S * (0.45 + 0.15 * near), "160,220,255", 0.06 + 0.06 * dark + 0.1 * near);
    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.beginPath(); ctx.ellipse(bx, by, S * 0.38, S * 0.1, 0, 0, TAU); ctx.fill();

    let top = by;
    STONES.forEach(([w, h, dx, rgb, light], i) => {
      const cx = bx + dx * S, W = w * S, H = h * S, cy = top - H * 0.5;
      const k = Math.min(1.6, 0.35 + 0.35 * dark + 0.3 * near * (0.7 + 0.3 * Math.sin(t * 2 + i)) + 1.1 * lit(i));
      // the stone: a rounded slate pebble, lit from the top-left
      const g = ctx.createLinearGradient(cx - W / 2, cy - H / 2, cx + W / 3, cy + H / 2);
      g.addColorStop(0, "#8592b0"); g.addColorStop(0.5, "#56617f"); g.addColorStop(1, "#2a3149");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, W / 2, H * 0.56, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(225,235,255,0.22)";
      ctx.beginPath(); ctx.ellipse(cx - W * 0.12, cy - H * 0.22, W * 0.26, H * 0.16, -0.1, 0, TAU); ctx.fill();
      // its glowing band, round the middle
      glow(ctx, cx, cy + H * 0.1, W * (0.36 + 0.16 * k), rgb, 0.05 + 0.12 * k);
      ctx.strokeStyle = light; ctx.globalAlpha = Math.min(1, 0.45 + 0.4 * k); ctx.lineWidth = Math.max(1, H * 0.11);
      ctx.beginPath(); ctx.ellipse(cx, cy + H * 0.02, W * 0.48, H * 0.22, 0, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.globalAlpha = 1;
      // frost glints on the cold upper side
      for (let j = 0; j < 3; j++) {
        const fx = cx + (hash(i * 7 + j) - 0.5) * W * 0.7, fy = cy - H * (0.2 + 0.2 * hash(i * 3 + j + 9));
        const tw = Math.max(0, Math.sin(t * (1.3 + hash(j + i) * 1.5) + i * 4 + j * 2.1));
        if (tw > 0.2) {
          const r = S * 0.02 * tw * (0.4 + 0.6 * dark) + 0.4;
          ctx.fillStyle = `rgba(235,248,255,${0.4 + 0.5 * tw})`;
          ctx.fillRect(fx - r, fy - 0.4, r * 2, 0.8); ctx.fillRect(fx - 0.4, fy - r, 0.8, r * 2);
        }
      }
      top -= H * 0.8;
    });

    // the gold star-pebble on top, kept for Pip
    const kt = 0.5 + 0.3 * dark + 0.5 * near * (0.6 + 0.4 * Math.sin(t * 3)) + 1.2 * lit(4);
    const px = bx + 0.01 * S, py = top - S * 0.055, pr = S * 0.075 * (1 + 0.12 * lit(4));
    glow(ctx, px, py, S * (0.18 + 0.12 * kt), "255,214,120", 0.2 + 0.3 * kt);
    ctx.fillStyle = "#e09a2b"; star(ctx, px, py + S * 0.008, pr);
    ctx.fillStyle = "#ffd166"; star(ctx, px, py, pr * 0.92);
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(px - pr * 0.18, py - pr * 0.15, pr * 0.2, 0, TAU); ctx.fill();

    // a spark lifting off into the north after a tap
    const q = (since - 1.4) / 2.2;
    if (q > 0 && q < 1) {
      const sx = px + Math.sin(q * 7) * S * 0.06, sy = py - q * S * 1.4;
      glow(ctx, sx, sy, S * 0.1 * (1 - q * 0.5), "255,230,160", 0.8 * (1 - q));
      ctx.fillStyle = `rgba(255,250,230,${1 - q})`; ctx.beginPath(); ctx.arc(sx, sy, S * 0.018 + 0.5, 0, TAU); ctx.fill();
    }
  };
})();
