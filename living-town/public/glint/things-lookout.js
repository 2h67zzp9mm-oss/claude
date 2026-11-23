// Kindle's Grid: the Star Lookout's spyglass (kind "spyglass"), in the North Meadow beside the Lookout Bench.
// A honey-wood tripod with gold feet holding a tapered brass spyglass (three sections, gold rings, blue lens) that
// points up into the dark north and drifts slowly, as if looking. A teal ribbon tied round it streams in the breeze
// (GLINT_WIND from things-vane.js). A walker near makes the lens glint and a star twinkle in it.
// Tap (5 s): the glass tips up, a shooting star streaks across the far sky (th.from -> th.to, absolute tile spots,
// y < 0 = the black north past the ground's edge) and bursts into sparkles, with a giggly little run of bell notes
// (Web Audio, unlocked on pointerup for iOS). At dusk (device clock) a quiet shooting star also falls on its own
// every ~40 s. `?pose=wish` holds a shooting star mid-flight. Stub `spyglass() {}` in things.js.
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
    if (POSE === "wish") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };

  // a giggle of bells: quick high notes skipping up and down, then one long one
  let ac = null;
  addEventListener("pointerup", () => {
    try { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { ac = null; }
  });
  function giggle() {
    if (!ac) return;
    try {
      [1046.5, 1318.5, 1174.7, 1568, 1396.9, 1760, 2093].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + 0.6 + i * 0.085, last = i === 6;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(last ? 0.05 : 0.035, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0005, at + (last ? 1.8 : 0.22));
        o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + 2);
      });
    } catch (e) { /* quiet */ }
  }

  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill();
  }

  // a shooting star at progress q (0..1) from A to B (screen px); head, fading tail, burst at the end
  function shoot(ctx, A, B, q, S, a = 1) {
    if (q <= 0 || q >= 1.35) return;
    const e = Math.min(1, q), k = 1 - Math.pow(1 - e, 2);
    const hx = A[0] + (B[0] - A[0]) * k, hy = A[1] + (B[1] - A[1]) * k;
    if (q < 1) {
      const tl = 0.28, tk = Math.max(0, k - tl), tx = A[0] + (B[0] - A[0]) * tk, ty = A[1] + (B[1] - A[1]) * tk;
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, "rgba(255,230,170,0)"); g.addColorStop(1, `rgba(255,248,225,${0.9 * a})`);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = g; ctx.lineCap = "round"; ctx.lineWidth = Math.max(1.5, S * 0.035);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      glow(ctx, hx, hy, S * 0.16, "255,225,150", 0.7 * a);
      star(ctx, hx, hy, S * 0.05, `rgba(255,252,235,${a})`);
    } else {   // it bursts into a little ring of sparkles
      const f = (q - 1) / 0.35;
      for (let i = 0; i < 7; i++) {
        const an = i / 7 * TAU + 0.4, r = S * (0.06 + 0.22 * f);
        glow(ctx, hx + Math.cos(an) * r, hy + Math.sin(an) * r, S * 0.05, i % 2 ? "255,214,120" : "160,240,255", (1 - f) * a);
      }
      glow(ctx, hx, hy, S * 0.2 * (1 - f), "255,240,200", (1 - f) * 0.6 * a);
    }
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.spyglass = function spyglass(ctx, x, y, s, t, th = {}) {
    const ox = x - (th.x + 0.5) * s, oy = y - (th.y + 0.5) * s;
    const dark = darkness(), S = s * (th.scale || 1.2);
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const near = Math.max(0, ...ws.map(w => 1 - Math.hypot((w.fx ?? w.x) - th.x, (w.fy ?? w.y) - th.y) / 1.8));
    const since = POSE === "wish" ? 1.5 : th.tapped != null ? t - th.tapped : 99;
    if (th.tapped != null && th.tapped !== th._rang) { th._rang = th.tapped; giggle(); }
    const tip = since >= 0 && since < 5 ? Math.sin(Math.PI * Math.min(1, since / 5)) : 0;

    // shooting stars in the far north: one after a tap, and quiet ones on their own at dusk
    const from = th.from || [16.8, -2.2], to = th.to || [11.6, -0.7];
    const A = [ox + from[0] * s, oy + from[1] * s], B = [ox + to[0] * s, oy + to[1] * s];
    shoot(ctx, A, B, (since - 0.7) / 1.3, S);
    if (dark > 0.5) {
      const per = 40, n = Math.floor(t / per), q = (t - n * per) / 1.6, j = Math.sin(n * 91.7) * 0.5;
      shoot(ctx, [A[0] - j * s * 2, A[1] + j * s * 0.4], [B[0] - j * s * 1.5, B[1] + j * s * 0.3], q, S * 0.8, 0.7 * dark);
    }

    // the tripod: three honey-wood legs from a gold head down to gold feet
    const g0 = y + s * 0.3, hx = x, hy = g0 - S * 0.62;
    glow(ctx, x, g0 - S * 0.05, S * 0.5, "140,190,255", 0.08 + 0.1 * dark + 0.15 * near);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, g0, S * 0.3, S * 0.07, 0, 0, TAU); ctx.fill();
    for (const [fx, fy, c] of [[-0.24, 0, "#9c5a28"], [0.24, 0, "#9c5a28"], [0.03, -0.07, "#c27a3a"]]) {
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.5, S * 0.045); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x + fx * S, g0 + fy * S); ctx.stroke();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x + fx * S, g0 + fy * S, Math.max(1.2, S * 0.03), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#e0a05a"; ctx.beginPath(); ctx.arc(hx, hy, S * 0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(hx, hy, S * 0.032, 0, TAU); ctx.fill();

    // the brass glass: pointing up into the north, drifting slowly, tipping higher after a tap
    const ang = -1.15 - 0.08 * Math.sin(t * 0.23) - 0.03 * Math.sin(t * 0.61) - 0.3 * tip;   // radians, screen (up is negative)
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const at = (d, w) => [hx + ca * d * S + nx * w * S, hy + sa * d * S + ny * w * S];
    const quad = (d0, d1, w0, w1, fill) => {
      const p = [at(d0, -w0), at(d1, -w1), at(d1, w1), at(d0, w0)];
      ctx.beginPath(); p.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    };
    const brass = (d0, d1, w0, w1) => {
      const [ax, ay] = at(d0, -w0), [bx, by] = at(d0, w0), g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, "#fff0b8"); g.addColorStop(0.35, "#e8b24a"); g.addColorStop(1, "#8a5a1c");
      quad(d0, d1, w0, w1, g);
    };
    quad(-0.3, -0.2, 0.03, 0.035, "#5a3a14");     // eyepiece
    brass(-0.22, 0.08, 0.045, 0.055);
    brass(0.08, 0.34, 0.058, 0.07);
    brass(0.34, 0.62, 0.075, 0.09);
    for (const [d, w] of [[0.08, 0.062], [0.34, 0.078], [0.6, 0.098]]) quad(d - 0.018, d + 0.018, w, w, "#ffd166");   // gold rings
    // the lens: blue glass on the big end, catching starlight
    const [lx, ly] = at(0.63, 0), lr = S * 0.09;
    const glint = 0.35 + 0.35 * dark + 0.6 * near * (0.6 + 0.4 * Math.sin(t * 3)) + 1.2 * tip;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
    ctx.fillStyle = "#c48a2a"; ctx.beginPath(); ctx.ellipse(0, 0, lr * 0.38, lr * 1.02, 0, 0, TAU); ctx.fill();
    const lg = ctx.createRadialGradient(-lr * 0.1, -lr * 0.3, 0, 0, 0, lr);
    lg.addColorStop(0, "#d8f4ff"); lg.addColorStop(0.5, "#4f8fe0"); lg.addColorStop(1, "#1d3a7a");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 0, lr * 0.3, lr * 0.86, 0, 0, TAU); ctx.fill();
    ctx.restore();
    glow(ctx, lx, ly, S * (0.12 + 0.1 * glint), "170,215,255", 0.15 + 0.3 * glint);
    if (glint > 0.6) { const r = S * 0.04 * Math.min(1.6, glint); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(lx - r, ly - 0.6, r * 2, 1.2); ctx.fillRect(lx - 0.6, ly - r, 1.2, r * 2); }

    // a teal ribbon tied round the middle, streaming downwind
    const [rx, ry] = at(0.2, 0.06), wh = window.GLINT_WIND ? window.GLINT_WIND(t) : 3.4;
    const wx = Math.cos(wh), wy = Math.sin(wh) * 0.4 + 0.35;
    for (const [len, off, c] of [[0.3, 0, "#27c9c2"], [0.24, 0.9, "#9ff7ea"]]) {
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.2, S * 0.022); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(rx, ry);
      for (let i = 1; i <= 6; i++) {
        const f = i / 6, wav = Math.sin(t * 6 + f * 5 + off) * S * 0.03 * f;
        ctx.lineTo(rx + wx * len * S * f - wy * wav, ry + wy * len * S * f + wx * wav);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#127a80"; ctx.beginPath(); ctx.arc(rx, ry, Math.max(1.2, S * 0.022), 0, TAU); ctx.fill();
  };
})();
