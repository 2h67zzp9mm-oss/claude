// Kindle's Grid: the West Lamp (kind "westlamp"), a low honey-wood lamp at the west edge of the Star Ring.
// Short honey post with gold bands, a gold crook leaning west, and a honey-glass lantern with a gold hood that is open
// on its west side, so its light falls in a long warm fan across the bare meadow past the ring (the way out stays easy
// to find). Motes of light drift west along the fan. Brighter after dark (device clock), when Kindle sits in the ring,
// or when any walker is close. Tap: a bright wave runs west along the fan and a little gold star blinks where it ends.
// `?pose=westlamp` holds the night + wave state. Loads after things.js (stub `westlamp() {}`). th.reach = fan length (tiles).
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
  function pool(ctx, x, y, rx, ry, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); glow(ctx, 0, 0, rx, rgb, a); ctx.restore();
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  function darkness() {
    if (POSE === "westlamp") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.westlamp = function westlamp(ctx, x, y, s, t, th = {}) {
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const ring = (window.GLINT_WORLD?.things || []).find(o => o.kind === "starring");
    const sitting = ws.some(w => w.seated && w.bench === ring);
    const near = Math.min(99, ...ws.map(w => Math.hypot((w.fx ?? w.x) - th.x, (w.fy ?? w.y) - th.y)));
    const e = POSE === "westlamp" ? 1.5 : th.tapped != null ? t - th.tapped : 99;
    const want = Math.max(e < 4 ? 1 : 0, Math.max(0, 1 - near / 1.8), sitting ? 0.6 : 0);
    th._w = (th._w ?? want) + (want - (th._w ?? want)) * 0.05;
    const w = th._w, dark = darkness();
    const fl = 0.88 + 0.08 * Math.sin(t * 5.3) + 0.04 * Math.sin(t * 12.1);
    const k = Math.min(1.6, (0.45 + 0.5 * dark + 0.5 * w) * fl);

    const S = s * (th.scale || 1.5);
    const H = S * 0.5, topY = y - H, reach = -S * 0.2;
    const hx = x + reach, hy = topY + S * 0.02;
    const L = s * (th.reach || 2.4);          // how far west the light falls
    const gy = y + s * 0.04;                  // ground line of the fan

    // the fan of light across the bare meadow, pointing west (drawn first, under the lamp)
    const x0 = hx - S * 0.04, x1 = x0 - L;
    const a0 = 0.1 + 0.13 * k;
    for (let i = 0; i < 7; i++) {             // soft overlapping pools, widening and fading as they go west
      const f = (i + 0.5) / 7;
      pool(ctx, x0 - f * L, gy, s * (0.4 + 0.3 * f), s * (0.16 + 0.32 * f), "255,185,100", a0 * 1.3 * (1 - f * 0.7));
    }
    pool(ctx, hx - s * 0.3, gy, s * (0.5 + 0.15 * k), s * 0.2, "255,200,120", 0.12 + 0.16 * k);   // bright spot under the lantern
    // a soft ray from the open side of the lantern down onto the meadow
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createLinearGradient(hx, hy + S * 0.1, hx - s * 0.9, gy);
    rg.addColorStop(0, `rgba(255,215,140,${0.1 + 0.14 * k})`); rg.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = rg;
    poly(ctx, [[hx - S * 0.03, hy + S * 0.06], [hx - S * 0.03, hy + S * 0.16], [hx - s * 1.1, gy + s * 0.12], [hx - s * 1.1, gy - s * 0.22]], rg);
    ctx.restore();
    // motes drifting west along the light
    for (let i = 0; i < 5; i++) {
      const q = (t * 0.18 + i / 5) % 1, mx = x0 - q * L, my = gy - s * (0.05 + 0.18 * Math.sin(q * Math.PI)) + Math.sin(t * 2 + i * 1.9) * s * 0.05;
      glow(ctx, mx, my, s * 0.045 + 1, "255,215,150", (0.25 + 0.35 * k) * Math.sin(q * Math.PI));
    }
    // the tap: a bright wave runs west along the fan, and a gold star blinks where the light ends
    if (e < 4) {
      const q = Math.min(1, e / 1.6), wx = x0 - q * L * 0.92;
      if (e < 1.8) pool(ctx, wx, gy, s * 0.45, s * 0.2, "255,220,150", 0.55 * (1 - q * 0.4));
      if (e > 1.0) {
        const b = Math.sin(Math.min(1, (e - 1.0) / 3) * Math.PI);
        const sx = x1 + L * 0.1, sy = gy;
        glow(ctx, sx, sy, s * 0.35 * b, "255,209,102", 0.6 * b);
        star(ctx, sx, sy - s * 0.02, s * 0.09 * b, `rgba(255,225,140,${b})`);
      }
    }

    // shadow, gold foot, short honey-wood post with gold bands
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, y, S * 0.07, S * 0.025, 0, 0, TAU); ctx.fill();
    const pw = S * 0.03;
    poly(ctx, [[x - pw * 2, y], [x + pw * 2, y], [x + pw * 1.2, y - S * 0.045], [x - pw * 1.2, y - S * 0.045]], "#e09a2b");
    ctx.fillStyle = "#c9893f"; ctx.fillRect(x - pw, topY + S * 0.04, pw * 2, H - S * 0.085);
    ctx.fillStyle = "#e7ad62"; ctx.fillRect(x - pw, topY + S * 0.04, pw * 0.8, H - S * 0.085);
    ctx.fillStyle = "#ffd166"; [0.3, 0.68].forEach(q => ctx.fillRect(x - pw * 1.25, y - H * q, pw * 2.5, S * 0.018));

    // the gold crook, leaning west
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.024); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, topY + S * 0.06);
    ctx.quadraticCurveTo(x, topY - S * 0.06, x + reach * 0.6, topY - S * 0.05);
    ctx.quadraticCurveTo(x + reach, topY - S * 0.04, hx, hy); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, S * 0.015);
    ctx.beginPath(); ctx.arc(x + S * 0.028, topY + S * 0.015, S * 0.024, Math.PI, TAU * 0.95); ctx.stroke();
    star(ctx, x, topY - S * 0.075, S * 0.028, "#ffd166");

    // the lantern: honey glass under a gold hood that's open to the west
    const sw = Math.sin(t * 1.1) * 0.05 + (e < 2 ? Math.sin(e * 7) * 0.12 * (1 - e / 2) : 0);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw); ctx.translate(-hx, -hy);
    const lw = S * 0.075, lh = S * 0.15, y0 = hy + S * 0.03, cy = y0 + lh * 0.55;
    glow(ctx, hx - lw * 0.6, cy, S * (0.2 + 0.12 * k), "255,180,90", 0.25 + 0.3 * k);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.6, S * 0.012);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, y0); ctx.stroke();
    const g = ctx.createRadialGradient(hx - lw * 0.4, cy, 0, hx, cy, lh * 0.9);
    g.addColorStop(0, "#fff6dc"); g.addColorStop(0.3, "#ffd27a"); g.addColorStop(0.75, "#e89a3a"); g.addColorStop(1, "#b8691f");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(hx - lw, y0 + S * 0.02); ctx.lineTo(hx + lw, y0 + S * 0.02);
    ctx.quadraticCurveTo(hx + lw * 1.1, cy, hx + lw * 0.8, y0 + lh); ctx.lineTo(hx - lw * 0.8, y0 + lh);
    ctx.quadraticCurveTo(hx - lw * 1.1, cy, hx - lw, y0 + S * 0.02); ctx.closePath(); ctx.fill();
    // the hood: gold, wrapping the east side, so the open face looks west
    ctx.fillStyle = "#e09a2b";
    ctx.beginPath(); ctx.moveTo(hx - lw * 0.1, y0 + S * 0.02); ctx.lineTo(hx + lw, y0 + S * 0.02);
    ctx.quadraticCurveTo(hx + lw * 1.1, cy, hx + lw * 0.8, y0 + lh); ctx.lineTo(hx + lw * 0.25, y0 + lh);
    ctx.quadraticCurveTo(hx + lw * 0.45, cy, hx - lw * 0.1, y0 + S * 0.02); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.moveTo(hx - lw * 1.35, y0 + S * 0.025); ctx.quadraticCurveTo(hx, y0 - S * 0.06, hx + lw * 1.25, y0 + S * 0.03); ctx.closePath(); ctx.fill();
    ctx.fillRect(hx - lw * 0.85, y0 + lh - S * 0.004, lw * 1.7, S * 0.02);
    // flame
    const fh = lh * (0.32 + 0.08 * fl + 0.12 * w);
    ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.ellipse(hx - lw * 0.3, cy + lh * 0.1, lw * 0.3, fh * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffbe6"; ctx.beginPath(); ctx.ellipse(hx - lw * 0.3, cy + lh * 0.14, lw * 0.17, fh * 0.36, 0, 0, TAU); ctx.fill();
    ctx.restore();
    glow(ctx, hx - lw, cy, S * 0.08, "255,235,180", 0.25 + 0.25 * k);
  };
})();
