// Kindle's Grid: the Lamp Spot (kind "lampspot"), out in the West Meadow where the West Lamp's fan of light ends.
// Three flat stepping stones lead west from the lamp to a round pale footing stone with a socket in the middle and a
// gold star ring round it. Four little gold pegs stand round it, joined by a gold thread, and a paper lamp sketch is
// tied to the north-east peg. The socket glows softly at night. When the West Lamp's wave arrives (its tap), when
// someone walks up, or on a tap, the thread lights peg by peg and a dotted gold outline of the lamp-to-be shimmers
// up out of the socket. `?pose=lampspot` holds that. Loads after things.js (stub `lampspot() {}`).
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
  function star(ctx, x, y, r, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let j = 0; j < 10; j++) { const rr = j % 2 ? r * 0.45 : r, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const smooth = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  function darkness() {
    if (POSE === "lampspot") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  }
  function flatStone(ctx, x, y, rx, ry, lit) {
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x + rx * 0.08, y + ry * 0.35, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#8f98a8"; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.18, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#d9dee6"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.3, 0, 0, TAU); ctx.fill();
    if (lit > 0) glow(ctx, x, y, rx * 1.6, "255,205,120", 0.45 * lit);
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.lampspot = function lampspot(ctx, x, y, s, t, th = {}) {
    const things = window.GLINT_WORLD?.things || [];
    const lamp = things.find(o => o.kind === "westlamp");
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const near = Math.min(99, ...ws.map(w => Math.hypot((w.fx ?? w.x) - (th.x + 0.5), (w.fy ?? w.y) - (th.y + 0.5))));
    const le = lamp && lamp.tapped != null ? t - lamp.tapped : 99;       // the West Lamp's wave reaches here ~1.4 s after its tap
    const e = POSE === "lampspot" ? 2.5 : Math.min(th.tapped != null ? t - th.tapped : 99, le - 1.3);
    const want = Math.max(e >= 0 && e < 6 ? 1 : 0, Math.max(0, 1 - near / 1.4));
    th._w = (th._w ?? want) + (want - (th._w ?? want)) * 0.05;
    const w = th._w, dark = darkness();
    const S = s * (th.scale || 1.3);

    // stepping stones back toward the West Lamp (east), lighting in turn as the wave passes
    const steps = th.steps || [];
    steps.forEach(([sx, sy], i) => {
      const px = x + (sx - th.x) * s, py = y + (sy - th.y) * s;
      const lit = le > 0.3 + i * 0.35 && le < 4 + i * 0.3 ? Math.sin(Math.min(1, (le - 0.3 - i * 0.35) / 2) * Math.PI) : 0;
      flatStone(ctx, px, py, s * 0.17, s * 0.1, Math.max(lit, w * 0.3));
    });

    // the footing stone: round, pale, with a socket and a gold star ring
    const R = S * 0.3, ry = R * 0.62;
    glow(ctx, x, y, R * 2.2, "255,200,110", 0.08 + 0.12 * dark + 0.3 * w);
    flatStone(ctx, x, y, R, ry, 0);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.014);
    ctx.beginPath(); ctx.ellipse(x, y, R * 0.72, ry * 0.72, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const an = i / 8 * TAU + 0.2;
      star(ctx, x + Math.cos(an) * R * 0.72, y + Math.sin(an) * ry * 0.72, S * 0.028, "#ffd166");
    }
    // the socket where the post will stand
    const sk = 0.35 + 0.35 * dark + 0.5 * w + 0.08 * Math.sin(t * 2.2);
    ctx.fillStyle = "#5a5f6c"; ctx.beginPath(); ctx.ellipse(x, y, R * 0.2, ry * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,210,130,${Math.min(1, sk)})`; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.03, R * 0.13, ry * 0.12, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y, R * 0.6, "255,215,140", 0.3 * sk);

    // four gold pegs round it, joined by a gold thread that lights peg by peg
    const pegs = [[-1, -0.9], [1, -0.9], [1, 0.95], [-1, 0.95]].map(([a, b]) => [x + a * R * 1.2, y + b * ry * 1.25]);
    const lineK = (i) => e >= 0 && e < 6 ? smooth(i * 0.25, i * 0.25 + 0.4, e) * (e > 5 ? 6 - e : 1) : 0;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = pegs[i], [bx, by] = pegs[(i + 1) % 4], mx = (ax + bx) / 2, my = (ay + by) / 2 + S * 0.02;
      const k = Math.max(lineK(i), 0.25 * dark);
      ctx.strokeStyle = `rgba(255,209,102,${0.55 + 0.45 * k})`; ctx.lineWidth = Math.max(0.8, S * 0.01);
      ctx.beginPath(); ctx.moveTo(ax, ay - S * 0.07); ctx.quadraticCurveTo(mx, my - S * 0.07, bx, by - S * 0.07); ctx.stroke();
      if (k > 0.05) glow(ctx, mx, my - S * 0.07, S * 0.12, "255,215,130", 0.35 * k);
    }
    pegs.forEach(([px, py], i) => {
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(px, py, S * 0.025, S * 0.01, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#c9893f"; ctx.fillRect(px - S * 0.012, py - S * 0.09, S * 0.024, S * 0.09);
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(px, py - S * 0.095, S * 0.02, 0, TAU); ctx.fill();
      if (lineK(i) > 0.1) glow(ctx, px, py - S * 0.095, S * 0.09, "255,225,150", 0.5 * lineK(i));
    });
    // the lamp sketch, tied to the north-east peg, fluttering in the cold breeze
    const [nx, ny] = pegs[1], fl = Math.sin(t * 2.6) * 0.15;
    ctx.save(); ctx.translate(nx + S * 0.01, ny - S * 0.08); ctx.rotate(0.15 + fl);
    ctx.fillStyle = "#fff4dc"; ctx.fillRect(0, 0, S * 0.11, S * 0.13);
    ctx.strokeStyle = "#c9893f"; ctx.lineWidth = Math.max(0.6, S * 0.007);
    ctx.beginPath(); ctx.moveTo(S * 0.045, S * 0.115); ctx.lineTo(S * 0.045, S * 0.035); ctx.quadraticCurveTo(S * 0.045, S * 0.015, S * 0.075, S * 0.02); ctx.stroke();
    ctx.fillStyle = "#e09a2b"; ctx.fillRect(S * 0.065, S * 0.03, S * 0.025, S * 0.03);
    ctx.restore();

    // the lamp-to-be: a dotted gold outline that shimmers up out of the socket
    const ghost = e >= 0.8 && e < 6 ? smooth(0.8, 2, e) * (e > 5 ? 6 - e : 1) : 0;
    if (ghost > 0.02) {
      const H = S * 0.85 * smooth(0, 1, ghost * 1.3), topY = y - H;
      ctx.save(); ctx.globalAlpha = ghost * (0.75 + 0.2 * Math.sin(t * 6));
      ctx.setLineDash([S * 0.025, S * 0.02]); ctx.lineDashOffset = -t * S * 0.1;
      ctx.strokeStyle = "#ffe29a"; ctx.lineWidth = Math.max(1.5, S * 0.02);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, topY + S * 0.05);
      ctx.quadraticCurveTo(x, topY - S * 0.08, x - S * 0.16, topY); ctx.stroke();
      const lx = x - S * 0.17, ly = topY + S * 0.04;
      ctx.beginPath(); ctx.moveTo(lx - S * 0.07, ly); ctx.lineTo(lx + S * 0.07, ly); ctx.lineTo(lx + S * 0.055, ly + S * 0.17); ctx.lineTo(lx - S * 0.055, ly + S * 0.17); ctx.closePath(); ctx.stroke();
      ctx.restore();
      glow(ctx, lx, ly + S * 0.09, S * 0.28, "255,220,140", 0.45 * ghost);
      star(ctx, x, topY - S * 0.1, S * 0.045 * ghost, `rgba(255,225,140,${ghost})`);
    }
  };
})();
