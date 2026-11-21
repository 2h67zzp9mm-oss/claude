// Kindle's Grid: the Bread Basket by the bakery door (kind "basket"). A round woven basket of honey wicker with a gold
// handle arch, lined with a pink-and-cream checked cloth, heaped with a round loaf, honey buns and glowberry rolls, all
// steaming. A little honey-wood tag on the handle says WARM. Anyone near (within ~1.4) makes one honey bun lift up
// out of the basket and glow, as if offered. A tap (4 s) makes the bread hop, a gold bun-shaped puff rise, and it
// kindles the Corner Lamp's Bread Trail too (sets that thing's `tapped`), so the warm light starts where the bread does.
// `?pose=offer` holds the tap. Drawn larger (x1.8 from the feet). Loads after things.js (stub `basket() {}`).
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
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};

  function bun(ctx, x, y, s, k) {
    ctx.fillStyle = "#c97a32"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.05, s * 0.038, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#e6a250"; ctx.beginPath(); ctx.ellipse(x - s * 0.01, y - s * 0.016, s * 0.03, s * 0.016, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = k > 0.3 ? "#fff1b8" : "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.009);
    ctx.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.4) { const r = s * 0.008 * a, px = x + Math.cos(a) * r, py = y - s * 0.02 + Math.sin(a) * r * 0.5; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  }
  function roll(ctx, x, y, s) {
    ctx.fillStyle = "#d48a3e"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.045, s * 0.038, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#ff78c4"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.027, s * 0.03, s * 0.016, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#ffd0ea"; ctx.beginPath(); ctx.arc(x - s * 0.009, y - s * 0.036, Math.max(0.8, s * 0.007), 0, TAU); ctx.fill();
  }
  function loaf(ctx, x, y, s) {
    ctx.fillStyle = "#b8682a"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.085, s * 0.062, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = "#e3a04e"; ctx.beginPath(); ctx.ellipse(x - s * 0.015, y - s * 0.026, s * 0.058, s * 0.03, 0, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,240,200,0.9)"; ctx.lineWidth = Math.max(1, s * 0.01);
    ctx.beginPath(); ctx.moveTo(x - s * 0.04, y - s * 0.034); ctx.lineTo(x + s * 0.04, y - s * 0.034); ctx.stroke();
  }

  T.basket = function basket(ctx, x, y, s, t, th = {}) {
    const e = POSE === "offer" ? 1.5 : th.tapped != null ? t - th.tapped : 99;
    const tap = e >= 0 && e < 4 ? Math.sin(Math.PI * Math.min(1, e / 4)) : 0;
    if (th.tapped != null && th.tapped !== th._lit) {   // the trail kindles from the basket
      th._lit = th.tapped;
      const lamp = (window.GLINT_WORLD?.things || []).find(o => o.kind === "cornerlamp");
      if (lamp) lamp.tapped = th.tapped;
    }
    const bx = th.x + 0.5, by = th.y + 0.7;
    const near = (window.GLINT_GRID?.walkers || []).reduce((m, w) => Math.max(m, 1 - Math.hypot((w.fx ?? w.x) - bx, (w.fy ?? w.y) - by) / 1.4), 0);
    th._near = (th._near ?? 0) + (near - (th._near ?? 0)) * 0.08;
    const offer = Math.max(tap, th._near);
    const hop = k => -Math.max(0, Math.sin(t * 9 + k)) * s * 0.022 * tap;

    const b = y + s * 0.22;   // where the basket sits
    ctx.translate(x, b); ctx.scale(1.8, 1.8); ctx.translate(-x, -b);
    const R = s * 0.17, rimY = b - s * 0.14;

    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.01, R * 1.15, s * 0.045, 0, 0, TAU); ctx.fill();
    glow(ctx, x, rimY, s * (0.42 + 0.12 * offer), "255,180,90", 0.22 + 0.05 * Math.sin(t * 1.3) + 0.3 * offer);

    // back of the rim and the cloth inside
    ctx.fillStyle = "#7a4520"; ctx.beginPath(); ctx.ellipse(x, rimY, R, R * 0.36, 0, 0, TAU); ctx.fill();
    // bread heaped inside (back to front)
    loaf(ctx, x + s * 0.03, rimY + s * 0.005 + hop(0), s);
    roll(ctx, x - s * 0.085, rimY + s * 0.02 + hop(1), s);
    roll(ctx, x + s * 0.1, rimY + s * 0.025 + hop(2), s);
    // the offered bun lifts out of the basket
    const lift = offer * s * 0.12 + Math.sin(t * 2.4) * s * 0.008 * offer;
    glow(ctx, x - s * 0.02, rimY + s * 0.03 - lift - s * 0.02, s * (0.08 + 0.12 * offer), "255,214,120", 0.2 + 0.4 * offer);
    bun(ctx, x - s * 0.02, rimY + s * 0.035 - lift + hop(3), s, offer);
    // checked cloth corners folding over the rim
    const cloth = (cx, cy, dir) => {
      ctx.save(); ctx.beginPath(); ctx.moveTo(cx - dir * s * 0.07, cy - s * 0.005); ctx.lineTo(cx + dir * s * 0.03, cy - s * 0.01);
      ctx.lineTo(cx + dir * s * 0.005, cy + s * 0.09); ctx.closePath(); ctx.clip();
      ctx.fillStyle = "#fff0f6"; ctx.fillRect(cx - s * 0.1, cy - s * 0.02, s * 0.2, s * 0.13);
      ctx.fillStyle = "#ff8fcf"; const q = s * 0.022;
      for (let i = -5; i < 5; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2 === 0) ctx.fillRect(cx + i * q, cy - s * 0.02 + j * q, q, q);
      ctx.restore();
    };
    // front body: woven honey wicker
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x - R, rimY); ctx.ellipse(x, rimY, R, R * 0.36, 0, Math.PI, 0, true);
    ctx.lineTo(x + R * 0.82, b - s * 0.01); ctx.ellipse(x, b - s * 0.01, R * 0.82, R * 0.3, 0, 0, Math.PI); ctx.closePath();
    ctx.fillStyle = "#c98a3e"; ctx.fill(); ctx.clip();
    ctx.strokeStyle = "#8a5226"; ctx.lineWidth = Math.max(1, s * 0.01);
    for (let r = 1; r < 4; r++) { const yy = rimY + (b - rimY) * r / 4; ctx.beginPath(); ctx.ellipse(x, yy, R, R * 0.33, 0, 0, Math.PI); ctx.stroke(); }
    ctx.strokeStyle = "#e9b468"; ctx.lineWidth = Math.max(1, s * 0.008);
    for (let i = -4; i <= 4; i++) { const px = x + i * R * 0.22; ctx.beginPath(); ctx.moveTo(px, rimY); ctx.lineTo(px * 0.9 + x * 0.1, b + s * 0.05); ctx.stroke(); }
    ctx.restore();
    // gold rim band
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.beginPath(); ctx.ellipse(x, rimY, R, R * 0.36, 0, 0, Math.PI); ctx.stroke();
    cloth(x - R * 0.75, rimY + s * 0.02, 1); cloth(x + R * 0.78, rimY + s * 0.02, -1);
    // gold handle arch
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, s * 0.022);
    ctx.beginPath(); ctx.ellipse(x, rimY, R * 0.95, s * 0.22, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = "#fff6d6"; ctx.lineWidth = Math.max(1, s * 0.007);
    ctx.beginPath(); ctx.ellipse(x, rimY - s * 0.004, R * 0.95, s * 0.22, 0, Math.PI * 1.2, Math.PI * 1.6); ctx.stroke();
    // a honey-wood tag hanging from the handle
    const tx = x + R * 0.62, ty = rimY - s * 0.17 + Math.sin(t * 1.8) * s * 0.006;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(0.15 + Math.sin(t * 1.8) * 0.06);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(-s * 0.003, -s * 0.03, s * 0.006, s * 0.03);
    ctx.fillStyle = "#e3a04e"; ctx.fillRect(-s * 0.06, 0, s * 0.12, s * 0.05);
    ctx.fillStyle = "#7a3f1a"; ctx.font = `bold ${Math.max(5, s * 0.036)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("WARM", 0, s * 0.026);
    ctx.restore();

    // steam
    for (let i = 0; i < 4; i++) {
      const f = (t * 0.3 + i / 4) % 1, px = x + (i - 1.5) * s * 0.06 + Math.sin(t * 1.3 + i * 2 + f * 5) * s * 0.03;
      glow(ctx, px, rimY - s * 0.04 - f * s * (0.26 + 0.14 * offer), s * (0.04 + 0.06 * f), "255,248,236", (0.45 + 0.4 * offer) * (1 - f) * 0.75);
    }
    // on a tap a little gold puff of bread smell rises and drifts off down the road toward the trail
    if (tap > 0) for (let i = 0; i < 3; i++) {
      const f = Math.min(1, e / 4 + i * 0.12);
      glow(ctx, x - f * s * 0.5, rimY - s * 0.1 - f * s * 0.35, s * (0.06 + 0.05 * f), "255,205,120", 0.7 * (1 - f));
    }
  };
})();
