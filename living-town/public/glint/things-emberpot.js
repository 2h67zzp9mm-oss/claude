// Kindle's Grid: the Ember Pot (kind "emberpot"), a squat pot of pale hearth stone just south of the West Meadow stepping
// stones, filled with embers carried from the Morning Hearth. A thin line of buried embers runs from it up under the moss
// to the stepping stones, and it keeps them warm: it publishes window.GLINT_EMBER = { k, wave, at } and
// things-sparklamp.js draws each step with a melted ring, an amber heart and warm breath, plus a pulse that runs west.
// The hearth's own pulse (window.GLINT_HEARTH.wave) reaches the pot ~2 s later (after it runs out to the Star Ring); then
// the lid lifts with a puff and the warmth runs up the ember line and along the steps to the Spark Lamp. Tap = same at once.
// `?pose=ember` holds night + a pulse mid-way. Loads after things-sparklamp.js; stub `emberpot() {}` in things.js.
(() => {
  const TAU = Math.PI * 2;
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const E = window.GLINT_EMBER = { k: 0.6, wave: null, at: [5.25, 3.85], line: [] };
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0.005 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const darkness = () => {
    if (POSE === "ember") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const DELAY = 2.0, LINE_T = 0.45;   // hearth pulse -> pot; seconds for the warmth to climb the ember line

  T.emberpot = function emberpot(ctx, x, y, s, t, th = {}) {
    const HE = window.GLINT_HEARTH;
    const wcx = th.x + 0.5, wcy = th.y + 0.5;
    E.at = [wcx, wcy];
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const near = ws.some(w => Math.hypot((w.fx ?? w.x) + 0.5 - wcx, (w.fy ?? w.y) - wcy) < 1.5);
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    const want = POSE === "ember" || near ? 1 : 0.6;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 1.5);
    // the pot's own puff: when the hearth's pulse has had time to run out here, or on a tap
    if (HE && HE.wave != null && HE.wave !== th._seenHearth) { th._seenHearth = HE.wave; th._wave = HE.wave + DELAY; }
    if (th.tapped != null && th.tapped !== th._seenTap) { th._seenTap = th.tapped; th._wave = t; }
    if (POSE === "ember") th._wave = t - 0.9;
    const e = th._wave != null ? t - th._wave : 99;
    E.k = th._k; E.wave = th._wave != null ? th._wave + LINE_T : null;
    const k = th._k, dark = darkness();
    const puff = e >= 0 && e < 1.8 ? Math.sin(Math.PI * Math.min(1, e / 1.8)) : 0;
    const fl = 0.85 + 0.1 * Math.sin(t * 4.7) + 0.05 * Math.sin(t * 12.3);
    const S = s * (th.scale || 1);

    // the ember line: a thread of melted moss from the pot up to the middle stepping stone, with embers along it
    const to = th.to || [5.6, 2.98];
    const ax = x, ay = y - S * 0.05, bx = x + (to[0] - wcx) * s, by = y + (to[1] - wcy) * s;
    const cx1 = ax + (bx - ax) * 0.3 + s * 0.18, cy1 = ay + (by - ay) * 0.35, cx2 = ax + (bx - ax) * 0.7 - s * 0.12, cy2 = ay + (by - ay) * 0.7;
    const bez = u => { const v = 1 - u; return [v * v * v * ax + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * bx, v * v * v * ay + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u * u * u * by]; };
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(14,52,40,0.8)"; ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, bx, by); ctx.stroke();
    ctx.strokeStyle = "rgba(60,30,18,0.75)"; ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, bx, by); ctx.stroke();
    const lp = e >= 0 && e < 2 ? e / LINE_T : -9;   // pulse position along the line, 0..1
    for (let j = 0; j < 9; j++) {
      const u = (j + 0.5) / 9, [px, py] = bez(u);
      const hit = lp > -1 ? Math.max(0, 1 - Math.abs(lp - u) / 0.3) : 0;
      const b = 0.5 + 0.35 * Math.sin(t * (1.3 + hash(j, 2)) + j * 2.1) + 0.6 * hit;
      glow(ctx, px, py, s * (0.07 + 0.06 * hit), "255,150,70", (0.18 + 0.12 * dark) * b * (0.7 + 0.3 * k));
      ctx.fillStyle = `rgb(${215 + 40 * Math.min(1, b) | 0},${90 + 100 * Math.min(1, b) | 0},${40 + 40 * hit | 0})`;
      ctx.beginPath(); ctx.ellipse(px + (hash(j, 5) - 0.5) * s * 0.02, py, s * 0.014, s * 0.009, hash(j, 6), 0, TAU); ctx.fill();
    }

    // melted moss round the pot and a warm wash on the ground
    ctx.fillStyle = "rgba(14,52,40,0.85)"; ctx.beginPath(); ctx.ellipse(x, y, S * 0.34, S * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(34,96,62,0.6)"; ctx.beginPath(); ctx.ellipse(x, y, S * 0.27, S * 0.115, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y - S * 0.06, S * (0.5 + 0.15 * puff), "255,160,80", (0.1 + 0.08 * k + 0.06 * dark + 0.18 * puff) * fl);

    // three little feet and the shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x + S * 0.02, y + S * 0.005, S * 0.17, S * 0.05, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#8a8580";
    [-0.11, 0, 0.11].forEach((fx, i) => { ctx.beginPath(); ctx.ellipse(x + S * fx, y - S * (i === 1 ? 0.0 : 0.012), S * 0.035, S * 0.022, 0, 0, TAU); ctx.fill(); });

    // the pot: a squat round belly of pale hearth stone, warm on the lower side
    const bw = S * 0.16, bh = S * 0.13, bcy = y - S * 0.12;
    ctx.fillStyle = "#b9b3ab"; ctx.beginPath(); ctx.ellipse(x, bcy, bw, bh, 0, 0, TAU); ctx.fill();
    const pg = ctx.createRadialGradient(x - bw * 0.35, bcy - bh * 0.4, 0, x, bcy, bw * 1.1);
    pg.addColorStop(0, "#f2eee6"); pg.addColorStop(0.6, "#d4cec4"); pg.addColorStop(1, "#9c958c");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(x, bcy, bw * 0.97, bh * 0.96, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,170,90,${0.25 + 0.15 * k + 0.3 * puff})`;
    ctx.beginPath(); ctx.ellipse(x, bcy + bh * 0.35, bw * 0.8, bh * 0.5, 0, 0, Math.PI); ctx.fill();
    // a gold band round the belly with three star vents that glow from the embers inside
    ctx.strokeStyle = "#e0a93a"; ctx.lineWidth = Math.max(1, S * 0.018);
    ctx.beginPath(); ctx.ellipse(x, bcy - bh * 0.05, bw * 0.98, bh * 0.28, 0, 0.1, Math.PI - 0.1); ctx.stroke();
    [-0.5, 0, 0.5].forEach((vx, i) => {
      const px = x + bw * vx, py = bcy + bh * (0.22 - Math.abs(vx) * 0.08);
      const b = (0.6 + 0.4 * Math.sin(t * 2.3 + i * 1.9)) * fl + puff;
      glow(ctx, px, py, S * (0.06 + 0.03 * puff), "255,150,60", 0.35 * b + 0.15 * dark);
      star(ctx, px, py, S * 0.028, "#4a2414");
      star(ctx, px, py, S * 0.02, `rgb(255,${150 + 70 * Math.min(1, b) | 0},${70 + 60 * puff | 0})`);
    });
    // rim
    const ry = bcy - bh * 0.78;
    ctx.fillStyle = "#c9a14a"; ctx.beginPath(); ctx.ellipse(x, ry, bw * 0.72, bh * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3a1d12"; ctx.beginPath(); ctx.ellipse(x, ry, bw * 0.6, bh * 0.19, 0, 0, TAU); ctx.fill();
    for (let j = 0; j < 5; j++) {   // embers peeking out under the lid
      const ex = x + (hash(j, 1) - 0.5) * bw * 0.9, b = 0.55 + 0.45 * Math.sin(t * (1.5 + hash(j, 3)) + j * 1.7);
      ctx.fillStyle = `rgb(${200 + 55 * b | 0},${80 + 90 * b | 0},40)`;
      ctx.beginPath(); ctx.ellipse(ex, ry + (hash(j, 2) - 0.5) * bh * 0.12, S * 0.022, S * 0.011, 0, 0, TAU); ctx.fill();
    }
    glow(ctx, x, ry, S * (0.1 + 0.1 * puff), "255,150,60", (0.35 + 0.3 * puff) * fl);
    // gold carrying handle, arching over
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.016);
    ctx.beginPath(); ctx.moveTo(x - bw * 0.72, ry); ctx.bezierCurveTo(x - bw * 0.8, ry - S * 0.2, x + bw * 0.8, ry - S * 0.2, x + bw * 0.72, ry); ctx.stroke();
    // the lid: a gold dome tilted open on the right, lifting higher on a puff
    const lift = S * (0.012 + 0.006 * Math.sin(t * 3.1) * k + 0.06 * puff), tilt = -0.12 - 0.25 * puff;
    ctx.save(); ctx.translate(x + bw * 0.55, ry - lift); ctx.rotate(tilt); ctx.translate(-bw * 0.55, 0);
    ctx.fillStyle = "#e09a2b"; ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.66, bh * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(0, -bh * 0.05, bw * 0.6, bh * 0.4, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.ellipse(-bw * 0.2, -bh * 0.22, bw * 0.16, bh * 0.08, -0.3, 0, TAU); ctx.fill();
    star(ctx, 0, -bh * 0.55, S * (0.03 + 0.01 * puff), "#fff2b0");
    ctx.restore();
    if (puff > 0) glow(ctx, x + bw * 0.4, ry - lift, S * 0.2, "255,200,120", 0.5 * puff);

    // warm breath curling up, and a few embers drifting off on a puff
    for (let j = 0; j < 3; j++) {
      const q = ((t * 0.35 + j / 3) % 1), cx = x + Math.sin(q * 5 + j * 2) * S * 0.05 + S * 0.03, cy = ry - S * 0.05 - q * S * (0.35 + 0.2 * puff);
      ctx.strokeStyle = `rgba(255,236,210,${(0.32 + 0.3 * puff) * (1 - q)})`; ctx.lineWidth = Math.max(1, S * 0.012);
      ctx.beginPath(); ctx.arc(cx, cy, S * 0.035, 0.3, Math.PI * 1.5); ctx.stroke();
    }
    if (puff > 0) for (let j = 0; j < 6; j++) {
      const q = Math.min(1, e / 1.8), px = x + (hash(j, 7) - 0.4) * S * 0.5 * q, py = ry - S * (0.1 + 0.5 * q * (0.6 + hash(j, 8) * 0.6));
      glow(ctx, px, py, S * 0.04, "255,170,80", 0.8 * (1 - q));
      ctx.fillStyle = `rgba(255,230,160,${1 - q})`; ctx.beginPath(); ctx.arc(px, py, Math.max(0.8, S * 0.008), 0, TAU); ctx.fill();
    }
  };
})();
