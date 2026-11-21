// Kindle's Grid: the bakery beside the East Gate Tree. Adds GLINT_THINGS.bakery (things.js keeps a stub for it).
// Drawn in a three-quarter view: the front gable faces the lane, the east wall shows on the right with the big
// warm amber window in it, and that window throws a fan of light out along the road to the east.
// th.oven: false/undefined = the oven isn't lit yet (cold chimney); true = it's lit (heat glow and warm puffs).
(() => {
  const TAU = Math.PI * 2;
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function gem(ctx, x, y, w, h, light, mid, dark) {
    poly(ctx, [[x, y - h], [x - w, y], [x, y]], light); poly(ctx, [[x, y - h], [x + w, y], [x, y]], mid);
    poly(ctx, [[x, y + h], [x - w, y], [x, y]], mid); poly(ctx, [[x, y + h], [x + w, y], [x, y]], dark);
  }

  window.GLINT_THINGS = window.GLINT_THINGS || {};
  window.GLINT_THINGS.bakery = function bakery(ctx, x, y, s, t, th = {}) {
    const b = y + s * 0.45, h = s * 0.95, L = x - s * 0.78, R = x + s * 0.5, sd = s * 0.56, k = sd * 0.48;   // front face L..R, side face depth sd rising k
    const rh = s * 0.62, mid = (L + R) / 2, roof = ["#ff9f7a", "#d9624a", "#ffc7a8"];
    // brighter when touched, or when someone stands near the door or under the window
    const since = th.tapped != null ? t - th.tapped : 99, flare = since >= 0 && since < 3.5 ? Math.sin(Math.min(1, since / 3.5) * Math.PI) : 0;
    const near = (window.GLINT_GRID?.walkers || []).reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) - th.x - 0.6, (w.fy ?? w.y) - th.y - 0.9) / 1.8), 0);
    // the stone oven: lit (th.oven). Its fire kindles up over the first moments, flickers, and roars when the oven is touched
    const oth = th.oven ? (window.GLINT_WORLD?.things || []).find(o => o.kind === "oven") : null;
    const os = oth && oth.tapped != null ? t - oth.tapped : 99, roar = os >= 0 && os < 4 ? Math.sin(Math.min(1, os / 4) * Math.PI) : 0;
    const fire = th.oven ? Math.min(1, 0.25 + t / 4) * (0.82 + 0.11 * Math.sin(t * 7.3) + 0.07 * Math.sin(t * 12.7 + 1)) * (1 + 0.55 * roar) : 0;
    const breathe = 0.82 + 0.1 * Math.sin(t * 1.1) + 0.05 * Math.sin(t * 2.9 + 1);
    const lit = Math.min(1.5, breathe + 0.35 * near + 0.5 * flare + (th.oven ? 0.15 + 0.3 * (fire - 0.82) + 0.35 * roar : 0));
    const S = (u, v) => [R + u * sd, b - u * k - v];   // a point on the east wall: u 0..1 along it, v up from the ground

    // shadow, and the fan of amber light the window throws east along the road
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x + s * 0.05, b - s * 0.05, s * 1.05, s * 0.25, 0, 0, TAU); ctx.fill();
    const [w0x, w0y] = S(0.2, 0), [w1x, w1y] = S(0.84, 0);
    const fan = ctx.createLinearGradient(R + sd * 0.5, b, R + sd + s * 1.9, b);
    fan.addColorStop(0, `rgba(255,178,80,${0.42 * lit})`); fan.addColorStop(1, "rgba(255,178,80,0)");
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = fan; ctx.beginPath();
    ctx.moveTo(w0x, w0y + s * 0.02); ctx.lineTo(w1x, w1y);
    ctx.lineTo(R + sd + s * 2.0 * (0.9 + 0.1 * lit), b - s * 0.2); ctx.lineTo(R + sd + s * 1.7 * (0.9 + 0.1 * lit), b + s * 0.55); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    glow(ctx, x - s * 0.2, b + s * 0.15, s * 0.9, "255,200,110", 0.2);   // a little warmth on the doorstep

    // plinth, front wall (lighter), east wall (darker), cyan trim
    poly(ctx, [[L - s * 0.06, b], [R, b], [R + sd + s * 0.04, b - k - s * 0.02], [R + sd + s * 0.04, b - k - s * 0.1], [R, b - s * 0.1], [L - s * 0.06, b - s * 0.1]], "#33508f");
    poly(ctx, [[L, b - s * 0.1], [R, b - s * 0.1], [R, b - h], [L, b - h]], "#213a78");
    poly(ctx, [S(0, 0.1), S(1, 0.1), S(1, h), S(0, h)], "#172a5a");
    ctx.fillStyle = "#57e1ff"; ctx.fillRect(L, b - s * 0.17, R - L, s * 0.05); ctx.fillRect(L, b - h, R - L, s * 0.05);
    ctx.strokeStyle = "#57e1ff"; ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath(); ctx.moveTo(...S(0, 0.15)); ctx.lineTo(...S(1, 0.15)); ctx.moveTo(...S(0, h - s * 0.02)); ctx.lineTo(...S(1, h - s * 0.02)); ctx.stroke();
    ctx.strokeStyle = "rgba(87,225,255,0.55)"; ctx.lineWidth = Math.max(1, s * 0.02); ctx.beginPath(); ctx.moveTo(R, b - s * 0.1); ctx.lineTo(R, b - h); ctx.stroke();

    // roof: the front gable and the east slope, with tile rows and a gold ridge
    const top = [mid, b - h - rh], back = [mid + sd, b - h - rh - k];
    poly(ctx, [[L - s * 0.1, b - h + s * 0.02], [R + s * 0.1, b - h + s * 0.02], top], roof[1]);
    poly(ctx, [[R + s * 0.1, b - h + s * 0.02], [R + sd + s * 0.1, b - h - k + s * 0.02], back, top], roof[0]);
    ctx.lineWidth = Math.max(1, s * 0.02);
    for (let i = 1; i < 4; i++) {
      const f = i / 4, ax = top[0] + (R + s * 0.1 - top[0]) * f, ay = top[1] + (b - h + s * 0.02 - top[1]) * f;
      ctx.strokeStyle = "rgba(90,20,30,0.3)"; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + sd, ay - k); ctx.stroke();
    }
    ctx.strokeStyle = roof[2]; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(L - s * 0.1, b - h + s * 0.02); ctx.lineTo(...top); ctx.lineTo(R + s * 0.1, b - h + s * 0.02); ctx.stroke();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.035); ctx.beginPath(); ctx.moveTo(...top); ctx.lineTo(...back); ctx.stroke();

    // the chimney for the oven, on the east slope. Cold until the oven is lit.
    const cx = mid + sd * 0.62 + s * 0.16, cb = b - h - rh * 0.55 - k * 0.62;
    poly(ctx, [[cx - s * 0.1, cb + s * 0.06], [cx + s * 0.1, cb], [cx + s * 0.1, cb - s * 0.42], [cx - s * 0.1, cb - s * 0.42]], "#213a78");
    ctx.fillStyle = "#57e1ff"; ctx.fillRect(cx - s * 0.12, cb - s * 0.46, s * 0.24, s * 0.06);
    if (th.oven) {
      glow(ctx, cx, cb - s * 0.46, s * 0.22, "255,150,60", 0.35 * fire);   // the chimney mouth glows warm
      for (let i = 0; i < 3; i++) { const f = (t * 0.3 + i / 3) % 1; glow(ctx, cx + Math.sin(f * 5 + i) * s * 0.1 + f * s * 0.25, cb - s * 0.5 - f * s * 0.8, s * (0.1 + f * 0.14), "255,190,120", 0.6 * (1 - f)); }
      const nsp = roar > 0.05 ? 7 : 2;   // a few sparks fly up out of the chimney (a shower of them when the fire roars)
      for (let i = 0; i < nsp; i++) {
        const f = (t * (0.55 + (i % 3) * 0.12) + i * 0.37) % 1, sx2 = cx + Math.sin(i * 2.3 + f * 6) * s * 0.12 * f, sy2 = cb - s * 0.48 - f * s * (0.7 + 0.2 * (i % 2));
        ctx.fillStyle = `rgba(255,${200 + (i % 3) * 20},120,${(1 - f) * (roar > 0.05 ? 0.95 : 0.6)})`; ctx.beginPath(); ctx.arc(sx2, sy2, s * (0.016 + 0.01 * (1 - f)), 0, TAU); ctx.fill();
      }
    }

    // a round gold-rimmed vent in the gable with a little wheat-ear gem
    const gx = mid, gy = b - h - rh * 0.66, q = 0.7 + 0.3 * Math.sin(t * 1.7);
    glow(ctx, gx, gy, s * 0.3 * q, "255,214,120", 0.45);
    gem(ctx, gx, gy, s * 0.07, s * 0.1, "#fff6d6", "#ffd166", "#e09a2b");

    // the name board, up in the gable over the door
    const py = b - h - rh * 0.24, pw = s * 0.4, ph = s * 0.095;
    poly(ctx, [[mid - pw, py - ph], [mid + pw, py - ph], [mid + pw, py + ph], [mid - pw, py + ph]], "#ffd166");
    poly(ctx, [[mid - pw + s * 0.025, py - ph + s * 0.025], [mid + pw - s * 0.025, py - ph + s * 0.025], [mid + pw - s * 0.025, py + ph - s * 0.025], [mid - pw + s * 0.025, py + ph - s * 0.025]], "#0d1838");
    ctx.fillStyle = `rgba(255,${Math.round(200 + 30 * Math.min(1, lit - 0.6))},120,1)`; ctx.font = "bold " + (s * 0.12).toFixed(1) + "px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("BAKERY", mid, py + s * 0.005, pw * 2 - s * 0.08);

    // a striped awning over the door that flutters in the breeze
    const dx = mid - s * 0.05, dw = s * 0.2, dTop = b - s * 0.6, dBot = b - s * 0.1, aw = s * 0.36, ay = dTop - s * 0.1;
    for (let i = 0; i < 4; i++) {
      const x0 = dx - aw + i * aw / 2, x1 = x0 + aw / 2, fl = Math.sin(t * 3.1 + i * 1.3) * s * 0.018;
      poly(ctx, [[x0 + s * 0.02, ay - s * 0.08], [x1 + s * 0.02, ay - s * 0.08], [x1, ay + s * 0.04 + fl], [x0, ay + s * 0.04 + fl]], i % 2 ? "#ffe9c7" : "#ff8f6b");
      ctx.fillStyle = i % 2 ? "#ffe9c7" : "#ff8f6b"; ctx.beginPath(); ctx.arc((x0 + x1) / 2, ay + s * 0.04 + fl, aw / 4, 0, Math.PI); ctx.fill();
    }
    // a honey-wood door, split in two halves like a baker's door, in a gold frame
    poly(ctx, [[dx - dw, dBot], [dx + dw, dBot], [dx + dw, dTop], [dx - dw, dTop]], "#d98a3c");
    poly(ctx, [[dx - dw, dTop], [dx - dw * 0.2, dTop], [dx - dw * 0.5, dBot], [dx - dw, dBot]], "rgba(255,220,160,0.25)");
    ctx.fillStyle = "#8a4a1c"; ctx.fillRect(dx - dw, (dTop + dBot) / 2 - s * 0.012, dw * 2, s * 0.024);
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(dx + dw * 0.6, (dTop + dBot) / 2 + s * 0.06, s * 0.028, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.04); ctx.strokeRect(dx - dw, dTop, dw * 2, dBot - dTop);
    // a small front window beside the door
    const fx = mid + s * 0.4, fy = b - s * 0.42, fr = s * 0.12;
    glow(ctx, fx, fy, s * 0.4, "255,190,100", 0.25 * lit);
    ctx.fillStyle = "#57e1ff"; ctx.fillRect(fx - fr - s * 0.03, fy - fr - s * 0.03, fr * 2 + s * 0.06, fr * 2 + s * 0.06);
    ctx.fillStyle = "#ffb04a"; ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
    ctx.fillStyle = "#213a78"; ctx.fillRect(fx - s * 0.012, fy - fr, s * 0.024, fr * 2);

    // THE warm amber window, set into the east wall, looking down the road
    const U0 = 0.12, U1 = 0.9, V0 = s * 0.24, V1 = s * 0.84, wc = S((U0 + U1) / 2, (V0 + V1) / 2);
    glow(ctx, wc[0] + s * 0.15, wc[1], s * 1.1 * (0.85 + 0.15 * lit), "255,170,70", 0.38 * lit);
    poly(ctx, [S(U0 - 0.07, V0 - s * 0.05), S(U1 + 0.07, V0 - s * 0.05), S(U1 + 0.07, V1 + s * 0.05), S(U0 - 0.07, V1 + s * 0.05)], "#ffd166");   // gold frame
    const pane = ctx.createLinearGradient(...S(U0, V1), ...S(U1, V0));
    pane.addColorStop(0, `rgba(255,${Math.round(214 + 30 * (lit - 0.8))},140,1)`); pane.addColorStop(0.55, "#ffae45"); pane.addColorStop(1, "#e8822a");
    poly(ctx, [S(U0, V0), S(U1, V0), S(U1, V1), S(U0, V1)], pane);
    // inside, through the glass: a shelf waiting for loaves, and the small stone oven with its fire lit
    ctx.save(); ctx.beginPath(); [S(U0, V0), S(U1, V0), S(U1, V1), S(U0, V1)].forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = "rgba(140,60,20,0.55)"; ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath(); ctx.moveTo(...S(U0 + 0.04, V0 + s * 0.44)); ctx.lineTo(...S(U0 + 0.3, V0 + s * 0.44)); ctx.stroke();
    for (const u of [0.1, 0.19, 0.28]) {   // the first loaves on the shelf, baked in the oven below
      const [lx, ly] = S(U0 + u - 0.03, V0 + s * 0.455);
      ctx.fillStyle = "#c9782e"; ctx.beginPath(); ctx.ellipse(lx, ly, s * 0.04, s * 0.03, -0.25, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = "#f2c070"; ctx.beginPath(); ctx.ellipse(lx - s * 0.008, ly - s * 0.014, s * 0.022, s * 0.01, -0.25, Math.PI, TAU); ctx.fill();
    }
    const [obx, oby] = S(0.56, V0 - s * 0.01), ow = s * 0.17, oh = s * 0.29;
    poly(ctx, [S(U0, V0), S(U1, V0), S(U1, V0 + s * 0.36), S(U0, V0 + s * 0.36)], "rgba(110,40,15,0.55)");   // the shadowy back of the room   // the oven's floor point, half-width, height
    poly(ctx, [[obx - s * 0.035, oby - oh * 0.8], [obx + s * 0.035, oby - oh * 0.8], [obx + s * 0.035, oby - s * 0.8], [obx - s * 0.035, oby - s * 0.8]], "#8a6f5c");   // its flue, up to the chimney
    glow(ctx, obx, oby - oh * 0.35, s * 0.42, "255,120,40", 0.25 + 0.45 * fire);   // the room behind glows with the fire
    const stone = ctx.createLinearGradient(obx - ow, oby - oh, obx + ow, oby);
    stone.addColorStop(0, th.oven ? "#e8c49a" : "#a89888"); stone.addColorStop(0.45, th.oven ? "#9c6a48" : "#7a6a5c"); stone.addColorStop(1, "#4a2c20");
    ctx.fillStyle = stone; ctx.beginPath(); ctx.moveTo(obx - ow, oby); ctx.bezierCurveTo(obx - ow, oby - oh * 1.32, obx + ow, oby - oh * 1.32, obx + ow, oby); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#3a2018"; ctx.lineWidth = Math.max(1, s * 0.022); ctx.stroke();
    ctx.setLineDash([s * 0.05, s * 0.022]);   // rows of stones laid round the dome
    for (const k2 of [0.72, 0.45]) { ctx.beginPath(); ctx.moveTo(obx - ow * k2 - ow * 0.12, oby); ctx.bezierCurveTo(obx - ow * k2, oby - oh * 1.32 * (k2 + 0.18), obx + ow * k2, oby - oh * 1.32 * (k2 + 0.18), obx + ow * k2 + ow * 0.12, oby); ctx.stroke(); }
    ctx.setLineDash([]);
    // the arched mouth, rimmed in gold, with the fire inside
    const mw = ow * 0.52, mh = oh * 0.5;
    const mouth = () => { ctx.beginPath(); ctx.moveTo(obx - mw, oby); ctx.lineTo(obx - mw, oby - mh * 0.45); ctx.quadraticCurveTo(obx - mw, oby - mh, obx, oby - mh); ctx.quadraticCurveTo(obx + mw, oby - mh, obx + mw, oby - mh * 0.45); ctx.lineTo(obx + mw, oby); ctx.closePath(); };
    const fg = ctx.createRadialGradient(obx, oby - mh * 0.2, 0, obx, oby - mh * 0.2, mw * 1.3);
    if (th.oven) { fg.addColorStop(0, "#fff3b8"); fg.addColorStop(0.35, `rgba(255,${Math.round(150 + 50 * fire)},50,1)`); fg.addColorStop(1, "#6e1a06"); } else { fg.addColorStop(0, "#3a1e14"); fg.addColorStop(1, "#1a0c08"); }
    ctx.fillStyle = fg; mouth(); ctx.fill();
    if (th.oven) {
      ctx.save(); mouth(); ctx.clip(); ctx.globalCompositeOperation = "lighter";
      for (let i = -2; i <= 2; i++) {   // little tongues of flame that dance
        const fx2 = obx + i * mw * 0.36, fh = mh * (0.55 + 0.25 * Math.sin(t * 9 + i * 2.1)) * fire * (1 - Math.abs(i) * 0.18), fw = mw * 0.26;
        ctx.fillStyle = i % 2 ? "rgba(255,170,60,0.85)" : "rgba(255,225,120,0.9)";
        ctx.beginPath(); ctx.moveTo(fx2 - fw, oby); ctx.quadraticCurveTo(fx2 - fw * 0.6, oby - fh * 0.6, fx2 + Math.sin(t * 5 + i) * fw * 0.5, oby - fh); ctx.quadraticCurveTo(fx2 + fw * 0.6, oby - fh * 0.6, fx2 + fw, oby); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,90,30,0.9)"; ctx.fillRect(obx - mw, oby - s * 0.02, mw * 2, s * 0.02);   // the bed of embers
      ctx.restore();
    }
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.022); mouth(); ctx.stroke();
    gem(ctx, obx, oby - mh - s * 0.012, s * 0.022, s * 0.03, "#fff6d6", "#ffd166", "#e09a2b");   // a gold keystone over the mouth
    if (th.oven) glow(ctx, obx, oby - mh * 0.3, s * 0.25 * (0.8 + 0.4 * fire), "255,170,70", 0.5 * fire);
    ctx.restore();
    // a transom bar across the top of the window, and a mullion in the upper panes only, so the oven shows whole
    ctx.strokeStyle = "#a8551f"; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(...S((U0 + U1) / 2, V1)); ctx.lineTo(...S((U0 + U1) / 2, V0 + s * 0.4)); ctx.moveTo(...S(U0, V0 + s * 0.4)); ctx.lineTo(...S(U1, V0 + s * 0.4)); ctx.stroke();
    poly(ctx, [S(U0 + 0.03, V1 - s * 0.03), S(U0 + 0.2, V1 - s * 0.03), S(U0 + 0.03, V1 - s * 0.16)], `rgba(255,248,220,${0.55 + 0.3 * Math.sin(t * 1.3)})`);
    poly(ctx, [S(U0 - 0.1, V0 - s * 0.03), S(U1 + 0.1, V0 - s * 0.03), S(U1 + 0.12, V0 - s * 0.09), S(U0 - 0.08, V0 - s * 0.09)], "#e09a2b");
    // warm motes drift out of the window toward the road (a few more when someone comes close or touches it)
    const n = 4 + Math.round(4 * Math.min(1, near + flare));
    for (let i = 0; i < n; i++) {
      const f = (t * 0.22 + i / n) % 1, [mx, my] = S(0.25 + (i * 0.37) % 0.6, V0 + s * (0.1 + (i * 0.23) % 0.4));
      const px = mx + f * s * 1.3, pyy = my + f * s * 0.2 - Math.sin(f * Math.PI) * s * 0.15, a = Math.sin(f * Math.PI) * (0.5 + 0.4 * lit);
      glow(ctx, px, pyy, s * 0.09, "255,200,120", a);
      ctx.fillStyle = `rgba(255,240,200,${a})`; ctx.beginPath(); ctx.arc(px, pyy, s * 0.018, 0, TAU); ctx.fill();
    }
  };
})();
