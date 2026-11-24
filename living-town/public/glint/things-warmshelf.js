// Kindle's Grid: the Keeping Shelf (kind "warmshelf"), beside the Morning Hearth. A little warming nook of pale hearth
// stones: an arched cubby whose back glows amber, holding a plate with a slice of toast kept warm for Pip (a pink star tag
// on the plate). On top, a honey-wood plank with a copper kettle, and two cups hanging from gold hooks on its front edge:
// teal for Kindle, pink with a gold star for Pip. It warms with window.GLINT_HEARTH (each warm pulse from the hearth makes
// the cubby flare and the kettle puff). Tap: the kettle lid rattles, a big puff of steam, the cups swing and the toast glows.
// Brighter when someone is near. `?pose=keeping` holds the tapped moment. Loads after things.js (stub `warmshelf() {}`).
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
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function cup(ctx, cx, cy, S, body, rim, swing, starred) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(swing);
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.008);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, S * 0.025); ctx.stroke();               // the gold hook
    const w = S * 0.07, h = S * 0.075, top = S * 0.025;
    ctx.strokeStyle = body; ctx.lineWidth = Math.max(1.5, S * 0.014);
    ctx.beginPath(); ctx.arc(w * 0.55, top + h * 0.45, h * 0.28, -1.2, 1.2); ctx.stroke();      // handle
    ctx.fillStyle = body; ctx.beginPath();
    ctx.moveTo(-w / 2, top); ctx.lineTo(w / 2, top); ctx.lineTo(w * 0.4, top + h); ctx.lineTo(-w * 0.4, top + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rim; ctx.fillRect(-w / 2, top, w, S * 0.012);
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-w * 0.35, top + S * 0.016, w * 0.14, h * 0.6);
    if (starred) star(ctx, 0, top + h * 0.55, S * 0.017, "#ffd166");
    ctx.restore();
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.warmshelf = function warmshelf(ctx, x, y, s, t, th = {}) {
    const H = window.GLINT_HEARTH || { k: 0.6 };
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside && (w.fx ?? w.x) != null);
    const near = ws.some(w => Math.hypot((w.fx ?? w.x) - (th.x + 0.5), (w.fy ?? w.y) - th.y) < 1.6);
    const dt = Math.min(0.1, Math.max(0, t - (th._lt ?? t))); th._lt = t;
    const want = POSE === "keeping" || near ? 1 : 0.5;
    th._k = (th._k ?? want) + (want - (th._k ?? want)) * Math.min(1, dt * 1.5);
    const k = th._k;
    const te = POSE === "keeping" ? 0.7 : th.tapped != null ? t - th.tapped : 99;   // tapped moment
    const tap = te >= 0 && te < 2.4 ? Math.sin(Math.PI * te / 2.4) : 0;
    const we = H.wave != null ? t - H.wave - 0.8 : 99;                            // the hearth's pulse arrives a moment later
    const pulse = we >= 0 && we < 1.8 ? Math.sin(Math.PI * we / 1.8) : 0;
    const heat = Math.min(1, 0.35 + 0.3 * k + 0.5 * pulse + 0.6 * tap);
    const fl = 0.88 + 0.08 * Math.sin(t * 4.7) + 0.04 * Math.sin(t * 10.3);

    const S = s * (th.scale || 1.3);
    const bw = S * 0.46, bh = S * 0.3, bx = x - bw / 2, by = y - bh;      // the stone cubby

    // melted moss and a warm wash on the ground
    ctx.fillStyle = "rgba(14,52,40,0.8)"; ctx.beginPath(); ctx.ellipse(x, y, bw * 0.78, S * 0.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x + S * 0.02, y + S * 0.01, bw * 0.6, S * 0.05, 0, 0, TAU); ctx.fill();
    glow(ctx, x, y - bh * 0.5, S * 0.55, "255,160,80", (0.12 + 0.2 * heat) * fl);

    // the cubby: pale hearth stones laid in courses, an arched opening in front
    ctx.fillStyle = "#8d8782"; rrect(ctx, bx, by, bw, bh, S * 0.03); ctx.fill();
    ctx.fillStyle = "#d6d0c6"; rrect(ctx, bx, by, bw, bh - S * 0.018, S * 0.03); ctx.fill();
    ctx.strokeStyle = "rgba(120,110,100,0.55)"; ctx.lineWidth = Math.max(1, S * 0.006);
    for (let r = 1; r < 3; r++) {
      const ly = by + r * bh / 3; ctx.beginPath(); ctx.moveTo(bx + S * 0.01, ly); ctx.lineTo(bx + bw - S * 0.01, ly); ctx.stroke();
      for (let c = 0; c < 4; c++) { const lx = bx + ((c + (r % 2) * 0.5) / 3.5) * bw; if (lx > bx + 4 && lx < bx + bw - 4) { ctx.beginPath(); ctx.moveTo(lx, ly - bh / 3); ctx.lineTo(lx, ly); ctx.stroke(); } }
    }
    ctx.fillStyle = "rgba(255,190,120,0.3)"; ctx.fillRect(bx + S * 0.01, by + bh * 0.6, bw - S * 0.02, bh * 0.35);    // its warm side
    // the arched opening, glowing amber from the back
    const ow = bw * 0.62, oh = bh * 0.68, ox = x - ow / 2, oy = y - S * 0.03 - oh;
    ctx.beginPath(); ctx.moveTo(ox, y - S * 0.03); ctx.lineTo(ox, oy + ow / 2); ctx.arc(x, oy + ow / 2, ow / 2, Math.PI, TAU); ctx.lineTo(ox + ow, y - S * 0.03); ctx.closePath();
    const g = ctx.createLinearGradient(0, oy, 0, y);
    g.addColorStop(0, `rgb(${120 + 80 * heat | 0},${50 + 40 * heat | 0},${25})`); g.addColorStop(1, `rgb(${210 + 45 * heat | 0},${110 + 70 * heat | 0},${40 + 30 * heat | 0})`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.009); ctx.stroke();                              // a gold rim round the arch
    star(ctx, x, oy - S * 0.012, S * 0.018, "#ffd166");
    // the plate, and the slice of toast kept warm for Pip
    const py = y - S * 0.05;
    ctx.fillStyle = "#f4efe6"; ctx.beginPath(); ctx.ellipse(x, py, ow * 0.4, S * 0.018, 0, 0, TAU); ctx.fill();
    const tg = 0.6 + 0.4 * heat;
    ctx.fillStyle = "#8a4a1c"; rrect(ctx, x - S * 0.05, py - S * 0.085, S * 0.1, S * 0.08, S * 0.025); ctx.fill();          // crust
    ctx.fillStyle = `rgb(${215 + 30 * tg | 0},${150 + 40 * tg | 0},${70 + 20 * tg | 0})`;
    rrect(ctx, x - S * 0.04, py - S * 0.075, S * 0.08, S * 0.066, S * 0.02); ctx.fill();
    ctx.fillStyle = "#fff0b0"; ctx.fillRect(x - S * 0.022, py - S * 0.05, S * 0.03, S * 0.012);                     // a dab of honey butter
    glow(ctx, x, py - S * 0.04, S * 0.1, "255,200,120", 0.25 + 0.4 * heat);
    // a little pink star tag leaning on the plate: this one is Pip's
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + S * 0.045, py - S * 0.02); ctx.lineTo(x + S * 0.075, py - S * 0.045); ctx.stroke();
    star(ctx, x + S * 0.078, py - S * 0.05, S * 0.02, "#ff9ed2");
    // warm curls rising off the toast
    for (let i = 0; i < 3; i++) {
      const f = (t * 0.45 + i / 3) % 1;
      glow(ctx, x + Math.sin(t * 1.6 + i * 2) * S * 0.02, py - S * 0.1 - f * S * 0.08, S * 0.025, "255,240,220", (0.25 + 0.3 * heat) * Math.sin(f * Math.PI));
    }

    // the honey-wood plank on top
    const pw = bw * 1.25, ph = S * 0.045, pyy = by - ph * 0.5;
    ctx.fillStyle = "#8e5f24"; ctx.fillRect(x - pw / 2, pyy, pw, ph);
    ctx.fillStyle = "#d9a24e"; ctx.fillRect(x - pw / 2, pyy, pw, ph * 0.45);
    ctx.strokeStyle = "rgba(140,90,30,0.6)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - pw * 0.3, pyy + ph * 0.2); ctx.lineTo(x + pw * 0.1, pyy + ph * 0.2); ctx.stroke();
    // two little gold brackets
    ctx.fillStyle = "#ffd166"; for (const d of [-1, 1]) ctx.fillRect(x + d * bw * 0.42 - S * 0.008, pyy + ph, S * 0.016, S * 0.03);

    // the copper kettle on the plank, its lid rattling on a tap
    const kx = x - pw * 0.18, ky = pyy, kr = S * 0.075;
    ctx.fillStyle = "#7a3b1e"; ctx.beginPath(); ctx.ellipse(kx, ky - kr * 0.05, kr * 1.05, kr * 0.25, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#c46a3a"; ctx.beginPath(); ctx.ellipse(kx, ky - kr * 0.65, kr, kr * 0.7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#e89a60"; ctx.beginPath(); ctx.ellipse(kx - kr * 0.35, ky - kr * 0.85, kr * 0.25, kr * 0.3, -0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#c46a3a"; ctx.lineWidth = Math.max(2, S * 0.018);
    ctx.beginPath(); ctx.moveTo(kx + kr * 0.8, ky - kr * 0.6); ctx.quadraticCurveTo(kx + kr * 1.3, ky - kr * 0.8, kx + kr * 1.45, ky - kr * 1.25); ctx.stroke();   // spout
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, S * 0.01);
    ctx.beginPath(); ctx.arc(kx, ky - kr * 1.2, kr * 0.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();                    // gold handle
    const rattle = tap > 0 ? Math.sin(t * 40) * S * 0.006 * tap : 0;
    ctx.fillStyle = "#a8552c"; ctx.beginPath(); ctx.ellipse(kx, ky - kr * 1.3 + rattle, kr * 0.35, kr * 0.1, 0, 0, TAU); ctx.fill();
    star(ctx, kx, ky - kr * 1.42 + rattle, S * 0.013, "#ffd166");
    // steam out of the spout: a thin thread, a big puff on a tap or a pulse
    const nS = 4 + Math.round(4 * (tap + pulse));
    for (let i = 0; i < nS; i++) {
      const f = (t * (0.5 + 0.5 * tap) + i / nS) % 1;
      const sx = kx + kr * 1.5 + f * S * 0.08 + Math.sin(t * 2 + i) * S * 0.015, sy = ky - kr * 1.3 - f * S * 0.22;
      glow(ctx, sx, sy, S * (0.025 + 0.03 * f) * (1 + tap), "255,250,240", (0.22 + 0.35 * tap + 0.2 * pulse) * Math.sin(f * Math.PI));
    }

    // a little jar of honey at the other end
    const jx = x + pw * 0.33, jy = pyy;
    ctx.fillStyle = "rgba(255,200,90,0.85)"; rrect(ctx, jx - S * 0.03, jy - S * 0.06, S * 0.06, S * 0.06, S * 0.012); ctx.fill();
    ctx.fillStyle = "#f4efe6"; ctx.fillRect(jx - S * 0.034, jy - S * 0.07, S * 0.068, S * 0.014);
    glow(ctx, jx, jy - S * 0.03, S * 0.05, "255,200,90", 0.2 + 0.2 * heat);

    // two cups on gold hooks along the front edge: teal for Kindle, pink with a gold star for Pip
    const sw = Math.sin(t * 1.3) * 0.05 + tap * Math.sin(t * 7) * 0.3;
    cup(ctx, x + bw * 0.05, pyy + ph, S, "#3fc9b8", "#9ff7ea", sw, false);
    cup(ctx, x + bw * 0.3, pyy + ph, S, "#ff8cc6", "#ffd1ea", -sw * 1.2, true);

    // sparks, when it's warmest
    const n = Math.round(4 * (pulse + tap));
    for (let j = 0; j < n; j++) {
      const ph2 = (t * 0.6 + j / Math.max(1, n)) % 1;
      const sx = x + Math.sin(j * 2.3 + t) * bw * 0.3, sy = oy - ph2 * S * 0.35;
      glow(ctx, sx, sy, S * 0.04, "255,190,100", 0.6 * (1 - ph2));
    }
  };
})();
