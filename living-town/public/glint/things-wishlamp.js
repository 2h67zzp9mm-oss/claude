// Kindle's Grid: the Wish Lantern (kind "wishlamp"), standing just behind the Star Lookout bench in the North Meadow.
// A honey-wood post (gold bands, gold star on top) with a gold crook leaning west, so the lantern hangs over the
// bench: night-blue glass with a gold star cut in each side and a warm flame. On the post, just above the bench back,
// a little honey-wood Wish Box with a slot and a gold star latch; wish cards (pink, gold, teal) peek out of it.
// Lights: brighter at dusk (device clock), when a walker is on/near the bench, and when the Lamp Song reaches it
// (listed in things-lampsong.js heads() at [x + 0.08, y - 0.37], violet-blue note). Its light pool on the two
// cushions is drawn in GLINT_OVER (the bench draws after it). Tap (6 s): the lid lifts, a glowing wish card rises,
// passes through the lantern (which flares) and flies up into the dark, where it becomes a little star that stays
// twinkling over the Lookout for a minute (up to 6 at once), with three soft rising notes (Web Audio, tap-only).
// `?pose=wishcard` holds a card mid-flight. Stub `wishlamp() {}` in things.js. Tap point = th.spot (the lantern).
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
  function starPath(ctx, x, y, r, rot = 0) {
    ctx.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + rot + j * Math.PI / 5, q = j % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath();
  }
  const POSE = new URLSearchParams(location.search).get("pose");
  const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  const darkness = () => {
    if (POSE === "wishcard") return 1;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    return h >= 12 ? smooth(16.5, 18.5, h) : 1 - smooth(6, 8, h);
  };
  const CARDS = [["#ffb3d9", "255,160,210"], ["#ffe08a", "255,214,120"], ["#9ff7ea", "110,245,225"]];
  const FLIGHT = 5;

  let ac = null;
  addEventListener("pointerup", () => {
    try { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { ac = null; }
  });
  function chime() {
    if (!ac) return;
    try {
      [[783.99, 0], [1046.5, 0.35], [1567.98, 0.7], [2093, 3.2]].forEach(([f, d], i) => {
        const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + 0.05 + d;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(i === 3 ? 0.03 : 0.04, at + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0005, at + (i === 3 ? 2 : 1.2));
        o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + 2.1);
      });
    } catch (e) { /* quiet */ }
  }

  // shared per-frame state so the over-pass draws the same lantern spot and card
  function state(th, x, y, s, t) {
    const S = s * (th.scale || 1.3), g0 = y + s * 0.3, px = x + s * 0.05, top = g0 - S * 1.3;
    const ws = (window.GLINT_GRID?.walkers || []).filter(w => !w.inside);
    const near = Math.max(0, ...ws.map(w => 1 - Math.hypot((w.fx ?? w.x) - (th.x + 0.5), (w.fy ?? w.y) - (th.y + 1.6)) / 1.8));
    th._near = (th._near ?? 0) + (near - (th._near ?? 0)) * 0.05;
    let hum = 0;
    const song = window.GLINT_SONG;
    if (song && song.since != null && song.since < 90) {
      const u = song.since - Math.hypot(th.x + 0.08 - song.bx, th.y - 0.37 - song.by) * song.step;
      if (u > 0 && u < 2.4) hum = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 2.15;
    }
    const since = POSE === "wishcard" ? 3.5 : th.tapped != null ? t - th.tapped : 99;
    if (th.tapped != null && th.tapped !== th._made && POSE !== "wishcard") {
      th._made = th.tapped; chime();
      th._wishes = (th._wishes || []).filter(w => t - w.at < 60).slice(-5);
      const n = th._wishes.length;
      th._wishes.push({ at: th.tapped + FLIGHT, dx: [-0.9, 0.7, -0.3, 1.2, -1.4, 0.2][n % 6], dy: [-1.9, -2.2, -2.5, -1.8, -2.3, -2.7][n % 6], c: CARDS[n % 3] });
    }
    const pass = since > 1.6 && since < 3.2 ? Math.sin((since - 1.6) / 1.6 * Math.PI) : 0;   // the card passing through the glass
    const fl = 0.88 + 0.08 * Math.sin(t * 5.1) + 0.04 * Math.sin(t * 11.7);
    const k = Math.min(1.9, (0.4 + 0.5 * darkness() + 0.45 * th._near + 0.8 * hum + 0.9 * pass) * fl);
    const sw = Math.sin(t * 1.3) * 0.05 + Math.sin(t * 0.47) * 0.03;
    const cx = px - S * 0.36, cy = top + S * 0.02;                      // tip of the crook
    const lx = cx + Math.sin(sw) * S * 0.14, ly = cy + S * 0.14;          // top of the lantern
    return { S, g0, px, top, cx, cy, lx, ly, sw, k, hum, since, pass, gy: S * 0.17 * 1.4 };
  }

  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  T.wishlamp = function wishlamp(ctx, x, y, s, t, th = {}) {
    const st = state(th, x, y, s, t), { S, g0, px, top, cx, cy, lx, ly, sw, k, since } = st;
    th._st = st;

    // shadow and gold foot
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(px, g0, S * 0.18, S * 0.05, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(px, g0 - S * 0.01, S * 0.06, S * 0.025, 0, 0, TAU); ctx.fill();
    // the post
    const pw = Math.max(2, S * 0.065);
    const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
    pg.addColorStop(0, "#e6a862"); pg.addColorStop(1, "#9c5a28");
    ctx.fillStyle = pg; ctx.fillRect(px - pw / 2, top, pw, g0 - top);
    ctx.fillStyle = "#ffd166";
    for (const f of [0.12, 0.72, 0.95]) ctx.fillRect(px - pw * 0.65, g0 - (g0 - top) * f, pw * 1.3, Math.max(1, S * 0.025));
    // the crook, leaning west over the bench
    ctx.strokeStyle = "#e8b24a"; ctx.lineWidth = Math.max(1.4, S * 0.032); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px, top + S * 0.05); ctx.quadraticCurveTo(px, top - S * 0.14, (px + cx) / 2, top - S * 0.12);
    ctx.quadraticCurveTo(cx, top - S * 0.1, cx, cy); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, S * 0.014);
    ctx.beginPath(); ctx.arc(px - S * 0.08, top + S * 0.02, S * 0.04, -0.2, Math.PI * 1.1); ctx.stroke();   // little curl
    // gold star on top of the post
    ctx.fillStyle = "#ffd166"; starPath(ctx, px, top - S * 0.08, S * 0.055); ctx.fill();
    glow(ctx, px, top - S * 0.08, S * 0.1, "255,214,120", 0.2 + 0.3 * darkness());

    // the Wish Box on the post, above the bench back
    const bx = px, by = g0 - S * 0.62, bw = S * 0.26, bh = S * 0.17;
    const lid = since < 2.2 ? Math.sin(Math.min(1, since / 2.2) * Math.PI) : 0;
    ctx.fillStyle = "#8a4f22"; ctx.fillRect(bx - bw / 2 + S * 0.015, by - bh / 2 + S * 0.015, bw, bh);   // depth
    const bg = ctx.createLinearGradient(0, by - bh / 2, 0, by + bh / 2);
    bg.addColorStop(0, "#f0b870"); bg.addColorStop(1, "#b8733a");
    ctx.fillStyle = bg; ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(bx - bw / 2, by + bh / 2 - S * 0.02, bw, S * 0.02);
    // cards peeking out of the top (behind the lid)
    for (let i = 0; i < 3; i++) {
      const [c] = CARDS[i], ox = bx + (i - 1) * bw * 0.26, lift = (i === 1 ? lid * 0.06 : 0) * S;
      ctx.save(); ctx.translate(ox, by - bh / 2 - lift); ctx.rotate((i - 1) * 0.18);
      ctx.fillStyle = c; ctx.fillRect(-S * 0.035, -S * 0.07, S * 0.07, S * 0.08); ctx.restore();
    }
    // the lid, tipping back when a wish goes out
    ctx.save(); ctx.translate(bx - bw / 2, by - bh / 2); ctx.scale(1, 1 - lid * 1.6);
    ctx.fillStyle = "#c9824a"; ctx.fillRect(-S * 0.01, -S * 0.04, bw + S * 0.02, S * 0.045);
    ctx.fillStyle = "#ffd166"; ctx.fillRect(bw * 0.3, -S * 0.012, bw * 0.4, Math.max(1, S * 0.01));   // the slot's gold rim
    ctx.restore();
    // star latch, glowing softly
    glow(ctx, bx, by + S * 0.005, S * 0.06, "255,214,120", 0.25 + 0.2 * k);
    ctx.fillStyle = "#ffe08a"; starPath(ctx, bx, by + S * 0.005, S * 0.035, 0); ctx.fill();

    // the lantern hanging from the crook
    ctx.strokeStyle = "rgba(255,230,160,0.85)"; ctx.lineWidth = Math.max(0.8, S * 0.01);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(-sw); ctx.scale(1.4, 1.4);
    const lw = S * 0.11, lh = S * 0.2, gy = S * 0.17;
    glow(ctx, 0, gy, S * (0.28 + 0.16 * k), "150,140,255", 0.22 + 0.22 * k);
    glow(ctx, 0, gy, S * (0.1 + 0.06 * k), "255,205,130", 0.25 + 0.25 * k);
    // cap and ring
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.8, S * 0.012);
    ctx.beginPath(); ctx.arc(0, S * 0.02, S * 0.025, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#e8b24a";
    ctx.beginPath(); ctx.moveTo(-lw * 0.75, S * 0.075); ctx.lineTo(lw * 0.75, S * 0.075); ctx.lineTo(0, S * 0.035); ctx.closePath(); ctx.fill();
    // night-blue glass
    const glass = ctx.createLinearGradient(-lw / 2, 0, lw / 2, 0);
    glass.addColorStop(0, `rgba(70,80,190,${0.8})`); glass.addColorStop(0.5, `rgba(${110 + 60 * Math.min(1, k)},${110 + 50 * Math.min(1, k)},255,0.85)`); glass.addColorStop(1, "rgba(40,45,140,0.85)");
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.moveTo(-lw / 2, S * 0.075); ctx.lineTo(lw / 2, S * 0.075); ctx.lineTo(lw * 0.42, S * 0.075 + lh); ctx.lineTo(-lw * 0.42, S * 0.075 + lh); ctx.closePath(); ctx.fill();
    // gold frame
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(0.8, S * 0.012); ctx.stroke();
    // the flame showing through a gold star window
    ctx.fillStyle = `rgba(255,${200 + 40 * Math.min(1, k) | 0},140,${0.6 + 0.3 * Math.min(1, k)})`;
    starPath(ctx, 0, gy, S * (0.045 + 0.008 * Math.sin(t * 6)), t * 0.2); ctx.fill();
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.ellipse(0, gy + S * 0.005, S * 0.012, S * 0.02, 0, 0, TAU); ctx.fill();
    // base
    ctx.fillStyle = "#e8b24a"; ctx.fillRect(-lw * 0.55, S * 0.075 + lh, lw * 1.1, Math.max(1.2, S * 0.025));
    ctx.fillStyle = "#ffd166"; starPath(ctx, 0, S * 0.075 + lh + S * 0.05, S * 0.025); ctx.fill();   // a tiny star dangling below
    ctx.restore();
  };

  const O = window.GLINT_OVER = window.GLINT_OVER || {};
  O.wishlamp = function wishlampOver(ctx, x, y, s, t, th) {
    const st = th._st; if (!st) return;
    const { S, g0, px, lx, gy, k, since } = st;
    // warm light falling on the bench cushions in front
    ctx.save(); ctx.translate(lx + S * 0.12, g0 + s * 0.5); ctx.scale(1, 0.38);
    glow(ctx, 0, 0, S * (0.55 + 0.15 * k), "170,160,255", 0.05 + 0.06 * k);
    glow(ctx, 0, 0, S * (0.3 + 0.1 * k), "255,215,150", 0.04 + 0.05 * k);
    ctx.restore();

    // wish stars already made, twinkling over the Lookout for a minute
    for (const w of th._wishes || []) {
      const age = t - w.at; if (age < 0 || age > 60) continue;
      const a = Math.min(1, age / 0.6) * (age > 55 ? (60 - age) / 5 : 1), tw = 0.75 + 0.25 * Math.sin(t * 3 + w.dx * 5);
      const wx = x + w.dx * s, wy = y + w.dy * s;
      glow(ctx, wx, wy, s * 0.22 * tw, w.c[1], 0.45 * a);
      ctx.globalAlpha = a; ctx.fillStyle = "#fffbe8"; starPath(ctx, wx, wy, s * 0.085 * tw, t * 0.3); ctx.fill(); ctx.globalAlpha = 1;
    }

    // a card on its way: out of the box, up through the lantern, off into the dark
    if (since >= 0 && since < FLIGHT + 0.6) {
      const n = (th._wishes || []).length, w = (th._wishes || [])[n - 1] || { dx: -0.9, dy: -1.9, c: CARDS[0] };
      const box = [px, g0 - S * 0.72], lamp = [lx, st.ly + gy], sky = [x + w.dx * s, y + w.dy * s];
      let cxp, cyp, rot, card = 1;
      if (since < 2.4) {                         // rising from the box to the lantern, rocking like a leaf
        const f = smooth(0.2, 2.4, since);
        cxp = box[0] + (lamp[0] - box[0]) * f + Math.sin(since * 4) * S * 0.06; cyp = box[1] + (lamp[1] - box[1]) * f; rot = Math.sin(since * 4) * 0.4;
      } else {                                   // past the lantern it folds into a star and flies up
        const f = smooth(2.4, FLIGHT, since), arc = Math.sin(f * Math.PI) * S * 0.4;
        cxp = lamp[0] + (sky[0] - lamp[0]) * f - arc * 0.3; cyp = lamp[1] + (sky[1] - lamp[1]) * f - arc; rot = since * 2; card = 1 - smooth(2.4, 3.2, since);
      }
      const fade = since > FLIGHT ? 1 - (since - FLIGHT) / 0.6 : 1;
      glow(ctx, cxp, cyp, S * 0.22, w.c[1], 0.55 * fade);
      ctx.save(); ctx.translate(cxp, cyp); ctx.rotate(rot); ctx.globalAlpha = fade;
      if (card > 0.02) {
        ctx.globalAlpha = fade * card; ctx.fillStyle = w.c[0]; ctx.fillRect(-S * 0.05, -S * 0.035, S * 0.1, S * 0.07);
        ctx.fillStyle = "rgba(120,80,40,0.55)"; for (let j = 0; j < 3; j++) ctx.fillRect(-S * 0.035, -S * 0.02 + j * S * 0.017, S * (0.07 - j * 0.015), Math.max(0.7, S * 0.006));
      }
      ctx.globalAlpha = fade * (1 - card); ctx.fillStyle = "#fffbe8"; starPath(ctx, 0, 0, S * 0.08); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
      // a short trail of sparkles behind it once it's a star
      if (since > 2.6) for (let j = 1; j < 6; j++) {
        const u = since - j * 0.09, f = smooth(2.4, FLIGHT, u), arc = Math.sin(f * Math.PI) * S * 0.4;
        glow(ctx, lamp[0] + (sky[0] - lamp[0]) * f - arc * 0.3, lamp[1] + (sky[1] - lamp[1]) * f - arc, S * 0.05, w.c[1], 0.4 * fade * (1 - j / 6));
      }
    }
  };
})();
