// Glint's Grid: how each ground type and each kind of thing is drawn. Glint adds new kinds here.
// draw(ctx, x, y, s, t, th): (x, y) is the centre of the thing's tile on screen, s is one tile in pixels,
// t is time in seconds, th is the thing itself (from world.js). Everything is drawn with shapes, no pictures.
(() => {
  const TAU = Math.PI * 2;
  // A soft pool of light. Cheap (one gradient) and it adds up where lights overlap.
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function gem(ctx, x, y, w, h, light, mid, dark) {   // a cut crystal: four facets
    poly(ctx, [[x, y - h], [x - w, y], [x, y]], light); poly(ctx, [[x, y - h], [x + w, y], [x, y]], mid);
    poly(ctx, [[x, y + h], [x - w, y], [x, y]], mid); poly(ctx, [[x, y + h], [x + w, y], [x, y]], dark);
  }
  function shadow(ctx, x, y, w, h) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill(); }
  const rnd = n => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

  // The room inside a cottage, seen through its opened front wall. (x, b) = middle of the ground line, w/h = half width
  // and height of the walls, k = how open (0..1), m = 1 or -1 (mirrors it like the house). An empty room, ready to be furnished:
  // warm floor, a teal rug, a crystal hearth, a hanging lantern, a little back window with a star, and two marked spots
  // where furniture could go (dashed gold outlines with a sparkle).
  function room(ctx, x, b, w, h, s, t, k, m) {
    const L = x - w, R = x + w, T = b - h, B = b - s * 0.1, d = s * 0.17, fy = B - s * 0.27, bl = L + d, br = R - d, bt = T + d * 0.8;
    const X = f => x + m * f * w;   // f: -1 door side .. +1 window side
    ctx.save(); ctx.globalAlpha = k;
    ctx.beginPath(); ctx.rect(L, T, w * 2, B - T); ctx.clip();
    poly(ctx, [[L, T], [R, T], [br, bt], [bl, bt]], "#101c44");                        // ceiling
    poly(ctx, [[L, T], [bl, bt], [bl, fy], [L, B]], "#1b2d66");                         // side walls
    poly(ctx, [[R, T], [br, bt], [br, fy], [R, B]], "#162657");
    poly(ctx, [[bl, bt], [br, bt], [br, fy], [bl, fy]], "#22377a");                    // back wall
    ctx.fillStyle = "#57e1ff"; ctx.fillRect(bl, bt, br - bl, s * 0.025); ctx.fillRect(bl, fy - s * 0.03, br - bl, s * 0.03);
    poly(ctx, [[bl, fy], [br, fy], [R, B], [L, B]], "#3a2f6e");                         // floor, with boards
    ctx.strokeStyle = "rgba(255,214,120,0.22)"; ctx.lineWidth = Math.max(1, s * 0.015);
    for (let i = 1; i < 6; i++) { const f = i / 6; ctx.beginPath(); ctx.moveTo(bl + (br - bl) * f, fy); ctx.lineTo(L + (R - L) * f, B); ctx.stroke(); }
    // the warm light of the hearth over everything
    const fl = 0.8 + 0.12 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 11.1);
    const hx = X(0.55), hb = fy + s * 0.02;
    glow(ctx, hx, hb - s * 0.15, s * 0.95 * fl, "255,170,110", 0.4);
    // little back window, with a star in it
    const wx = X(-0.2), wy = bt + (fy - bt) * 0.42, r = s * 0.1;
    ctx.fillStyle = "#57e1ff"; ctx.beginPath(); ctx.arc(wx, wy, r + s * 0.025, 0, TAU); ctx.fill();
    ctx.fillStyle = "#070c22"; ctx.beginPath(); ctx.arc(wx, wy, r, 0, TAU); ctx.fill();
    const st = 0.5 + 0.5 * Math.sin(t * 2.1);
    glow(ctx, wx + r * 0.3, wy - r * 0.25, s * 0.07, "255,246,214", 0.5 + 0.4 * st);
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(wx + r * 0.3, wy - r * 0.25, s * 0.015, 0, TAU); ctx.fill();
    // the crystal hearth: a little arched stove with a pink and gold flame
    const hw = s * 0.2, hh = s * 0.36;
    poly(ctx, [[hx - hw, hb], [hx + hw, hb], [hx + hw, hb - hh], [hx - hw, hb - hh]], "#2b4596");
    ctx.fillStyle = "#57e1ff"; ctx.fillRect(hx - hw - s * 0.03, hb - hh - s * 0.04, hw * 2 + s * 0.06, s * 0.045);
    ctx.fillStyle = "#0d1838"; ctx.beginPath(); ctx.moveTo(hx - hw * 0.6, hb); ctx.lineTo(hx - hw * 0.6, hb - hh * 0.45); ctx.arc(hx, hb - hh * 0.45, hw * 0.6, Math.PI, 0); ctx.lineTo(hx + hw * 0.6, hb); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const fx = hx + (i - 1) * hw * 0.3, fh = hh * (0.32 + 0.1 * Math.sin(t * 8 + i * 2.3)) * (i === 1 ? 1.3 : 1);
      poly(ctx, [[fx - hw * 0.17, hb - s * 0.01], [fx + hw * 0.17, hb - s * 0.01], [fx + Math.sin(t * 5 + i) * hw * 0.08, hb - fh]], i === 1 ? "#ffd166" : "#ff78c4");
    }
    gem(ctx, hx, hb - hh - s * 0.1, s * 0.035, s * 0.05, "#e8fbff", "#57e1ff", "#1f9fd0");
    // the rug
    const ry = fy + (B - fy) * 0.55;
    ctx.fillStyle = "#178f96"; ctx.beginPath(); ctx.ellipse(x, ry, w * 0.5, s * 0.075, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#6dffc6"; ctx.lineWidth = Math.max(1, s * 0.018); ctx.beginPath(); ctx.ellipse(x, ry, w * 0.4, s * 0.05, 0, 0, TAU); ctx.stroke();
    // two empty spots, marked out in gold, waiting for whatever goes there
    for (const [f, yy, sw, sh, ph] of [[-0.62, fy + (B - fy) * 0.35, s * 0.22, s * 0.075, 0], [0.05, bt + (fy - bt) * 0.82, s * 0.2, s * 0.12, 2.4]]) {
      const cx = X(f), q = 0.5 + 0.5 * Math.sin(t * 1.8 + ph);
      ctx.setLineDash([s * 0.035, s * 0.03]); ctx.strokeStyle = `rgba(255,214,120,${(0.45 + 0.4 * q).toFixed(2)})`; ctx.lineWidth = Math.max(1, s * 0.016);
      ctx.strokeRect(cx - sw / 2, yy - sh / 2, sw, sh); ctx.setLineDash([]);
      const sx = cx + sw * 0.3, sy = yy - sh * 0.5, L2 = s * 0.06 * q;
      glow(ctx, sx, sy, s * 0.1, "255,214,120", 0.5 * q);
      ctx.strokeStyle = "rgba(255,246,214,0.9)"; ctx.beginPath(); ctx.moveTo(sx - L2, sy); ctx.lineTo(sx + L2, sy); ctx.moveTo(sx, sy - L2); ctx.lineTo(sx, sy + L2); ctx.stroke();
    }
    // a lantern hanging from the ceiling, swinging a little
    const a = Math.sin(t * 1.2) * 0.12, cx = x - m * w * 0.05, len = s * 0.26, lx = cx + Math.sin(a) * len, ly = T + Math.cos(a) * len;
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.012); ctx.beginPath(); ctx.moveTo(cx, T); ctx.lineTo(lx, ly); ctx.stroke();
    glow(ctx, lx, ly + s * 0.05, s * 0.4, "255,214,120", 0.55);
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(lx, ly + s * 0.05, s * 0.045, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.fillRect(lx - s * 0.04, ly - s * 0.005, s * 0.08, s * 0.02);
    ctx.restore();
  }

  // Things drawn on top of everything else, after the normal pass. Same arguments as a normal draw.
  // hive: its glow-bees. Each bee leaves the door, flies in an arc to one of the flower beds in `visits` (tile positions),
  // hovers from flower to flower, flies home and rests a moment inside. A tap on the hive calls them all out to dance in a ring.
  window.GLINT_OVER = {
    hive(ctx, x, y, s, t, th) {
      const door = [0, -0.22], beds = th.visits || [], n = th.bees || 4;
      const since = th.tapped != null ? t - th.tapped : 99, dance = since >= 0 && since < 3 ? Math.sin(Math.min(1, since / 3) * Math.PI) : 0;
      const ease = k => k * k * (3 - 2 * k);
      for (let i = 0; i < n; i++) {
        const P = 8.5 + i * 1.7, c = (t + i * 3.3 + rnd(i + th.x) * 5) / P, lap = Math.floor(c), u = c - lap;
        const bed = beds.length ? beds[(lap + i) % beds.length] : [th.x, th.y];
        const spot = [bed[0] - th.x + Math.sin(t * 0.9 + i * 2.1) * 0.26, bed[1] - th.y - 0.3 + Math.sin(t * 1.7 + i) * 0.07];
        let px, py, show = 1;
        if (u < 0.25) { const k = ease(u / 0.25); px = door[0] + (spot[0] - door[0]) * k; py = door[1] + (spot[1] - door[1]) * k - Math.sin(k * Math.PI) * 0.45; show = Math.min(1, u / 0.03); }
        else if (u < 0.68) { px = spot[0]; py = spot[1]; }
        else if (u < 0.93) { const k = ease((u - 0.68) / 0.25); px = spot[0] + (door[0] - spot[0]) * k; py = spot[1] + (door[1] - spot[1]) * k - Math.sin(k * Math.PI) * 0.45; show = Math.min(1, (0.93 - u) / 0.03); }
        else { px = door[0]; py = door[1]; show = 0; }
        if (dance) {                                               // the ring dance over the hive
          const a = t * 3.2 + i * TAU / n, rx = Math.cos(a) * 0.5, ry = -0.95 + Math.sin(a) * 0.22;
          px += (rx - px) * dance; py += (ry - py) * dance; show = Math.max(show, dance);
        }
        if (show <= 0.02) continue;
        const bx = x + px * s + Math.sin(t * 5.3 + i * 1.9) * s * 0.02, by = y + py * s + Math.sin(t * 6.1 + i * 2.7) * s * 0.025;
        const R = s * 0.068 * (0.5 + 0.5 * show), flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 22 + i));
        glow(ctx, bx, by, s * 0.2, "255,214,120", 0.5 * show);
        ctx.fillStyle = "rgba(190,240,255,0.85)";
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(bx + d * R * 0.7, by - R * (0.5 + 0.7 * flap), R * 0.75, R * 0.45 + R * 0.5 * flap, d * 0.5, 0, TAU); ctx.fill(); }
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(bx, by, R * 1.25, R * 0.9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#6a3d0a"; ctx.fillRect(bx - R * 0.45, by - R * 0.8, R * 0.3, R * 1.6); ctx.fillRect(bx + R * 0.2, by - R * 0.8, R * 0.3, R * 1.6);
        ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(bx + R * 1.0, by - R * 0.1, R * 0.4, 0, TAU); ctx.fill();
        if (dance) glow(ctx, bx, by + s * 0.1, s * 0.06, "255,130,200", 0.7 * dance);
      }
    }
  };

  window.GLINT_GROUND = {
    ".": { fill: "#0a1020", line: "#12305a" },   // empty grid
    "p": { fill: "#1b3a63", line: "#3fd0ff" },   // light path
    "o": { fill: "#1d2f66", line: "#7f8dff" },   // plaza
    "g": { fill: "#0c2a2c", line: "#1c6b5c" },   // glow-moss
    "f": { fill: "#1a2350", line: "#6a58c8",     // lit garden path: pale stepping stones, and little lights that run toward the door one after another
      draw(ctx, sx, sy, s, t, tx, ty) {
        const i = tx + ty;                                           // how far along the path this tile is
        const wave = Math.max(0, Math.sin(t * 1.6 - i * 0.9));       // the running light
        const stones = [[0.3, 0.3, 0.2, 0.14, -0.3], [0.68, 0.5, 0.19, 0.13, 0.25], [0.34, 0.74, 0.18, 0.12, 0.1]];
        for (const [fx, fy, rw, rh, rot] of stones) {
          ctx.fillStyle = "#2f3f86"; ctx.beginPath(); ctx.ellipse(sx + fx * s, sy + fy * s + s * 0.025, rw * s, rh * s, rot, 0, TAU); ctx.fill();
          ctx.fillStyle = wave > 0.5 ? "#a9c4ff" : "#7f9be6"; ctx.beginPath(); ctx.ellipse(sx + fx * s, sy + fy * s, rw * s, rh * s, rot, 0, TAU); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(sx + (fx - 0.04) * s, sy + (fy - 0.035) * s, rw * s * 0.5, rh * s * 0.4, rot, 0, TAU); ctx.fill();
        }
        glow(ctx, sx + s * 0.5, sy + s * 0.5, s * 0.75, "255,214,120", 0.10 + 0.22 * wave);
        for (const [fx, fy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {     // tiny lights at the corners
          const k = 0.55 + 0.45 * Math.sin(t * 2.4 + (tx * 3 + ty * 5 + fx * 7 + fy * 11));
          glow(ctx, sx + fx * s, sy + fy * s, s * (0.1 + 0.06 * wave), "255,236,170", 0.5 + 0.4 * k);
          ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(sx + fx * s, sy + fy * s, s * 0.028, 0, TAU); ctx.fill();
        }
      } }
  };

  window.GLINT_THINGS = {
    home(ctx, x, y, s, t, th = {}) {
      const b = y + s * 0.45, w = s * 1.15, h = s * 1.25;           // b = ground line
      shadow(ctx, x, b, w * 1.15, s * 0.28);
      glow(ctx, x, b + s * 0.2, s * 1.5, "255,200,90", 0.28);       // warm light from the door
      poly(ctx, [[x - w * 1.08, b], [x + w * 1.08, b], [x + w * 1.08, b - s * 0.12], [x - w * 1.08, b - s * 0.12]], "#33508f");
      poly(ctx, [[x - w, b - s * 0.12], [x, b - s * 0.12], [x, b - h], [x - w, b - h]], "#213a78");
      poly(ctx, [[x, b - s * 0.12], [x + w, b - s * 0.12], [x + w, b - h], [x, b - h]], "#182c5e");
      ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - w, b - s * 0.2, w * 2, s * 0.06); ctx.fillRect(x - w, b - h, w * 2, s * 0.06);
      // chimney and its puffs
      ctx.fillStyle = "#213a78"; ctx.fillRect(x + w * 0.45, b - h - s * 1.0, s * 0.22, s * 0.7);
      for (let i = 0; i < 3; i++) { const f = (t * 0.25 + i / 3) % 1, px = x + w * 0.45 + s * 0.11 + Math.sin(f * 5 + i) * s * 0.12, py = b - h - s * 1.05 - f * s * 0.9; glow(ctx, px, py, s * (0.12 + f * 0.14), "255,120,200", 0.7 * (1 - f)); }
      // roof
      const rt = b - h - s * 1.25;
      poly(ctx, [[x - w * 1.25, b - h], [x, b - h], [x, rt]], "#8a63ff");
      poly(ctx, [[x, b - h], [x + w * 1.25, b - h], [x, rt]], "#5e3fd0");
      poly(ctx, [[x - w * 1.25, b - h], [x - w * 0.6, b - h], [x, rt]], "#a98bff");
      const p = 0.75 + 0.25 * Math.sin(t * 2);
      glow(ctx, x, rt - s * 0.2, s * 0.9 * p, "87,225,255", 0.5);
      gem(ctx, x, rt - s * 0.2, s * 0.17, s * 0.28, "#e8fbff", "#57e1ff", "#1f9fd0");
      // door and windows
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.moveTo(x - s * 0.24, b - s * 0.12); ctx.lineTo(x - s * 0.24, b - s * 0.62); ctx.arc(x, b - s * 0.62, s * 0.24, Math.PI, 0); ctx.lineTo(x + s * 0.24, b - s * 0.12); ctx.fill();
      ctx.fillStyle = "#b9791f"; ctx.beginPath(); ctx.arc(x + s * 0.13, b - s * 0.42, s * 0.035, 0, TAU); ctx.fill();
      for (const d of [-1, 1]) { const wx = x + d * w * 0.62; ctx.fillStyle = "#ffd166"; ctx.fillRect(wx - s * 0.16, b - s * 0.95, s * 0.32, s * 0.32); ctx.fillStyle = "#213a78"; ctx.fillRect(wx - s * 0.015, b - s * 0.95, s * 0.03, s * 0.32); ctx.fillRect(wx - s * 0.16, b - s * 0.805, s * 0.32, s * 0.03); glow(ctx, wx, b - s * 0.8, s * 0.45, "255,209,102", 0.3); }
      if (th.plate) {   // a gold name plate over the door
        const py = b - s * 1.05, pw = s * 0.44, ph = s * 0.11;
        glow(ctx, x, py, s * 0.5, "255,209,102", 0.25);
        poly(ctx, [[x - pw, py - ph], [x + pw, py - ph], [x + pw, py + ph], [x - pw, py + ph]], "#57e1ff");
        poly(ctx, [[x - pw + s * 0.025, py - ph + s * 0.025], [x + pw - s * 0.025, py - ph + s * 0.025], [x + pw - s * 0.025, py + ph - s * 0.025], [x - pw + s * 0.025, py + ph - s * 0.025]], "#0d1838");
        ctx.fillStyle = "#ffd166"; ctx.font = "bold " + (s * 0.16).toFixed(1) + "px -apple-system, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(th.plate, x, py + s * 0.005, pw * 2 - s * 0.08);
      }
    },

    // A little house for a friend: teal roof, a door on the left and one big round window.
    // A little house with a round window. th.flip puts the door on the right (for the west side of the street),
    // th.roof = [left, right, shine] gives it its own roof colours, th.stage "walls" is a house with no roof or door yet.
    cottage(ctx, x, y, s, t, th = {}) {
      const m = th.flip ? -1 : 1, walls = th.stage === "walls", nodoor = walls || th.stage === "roof", roof = th.roof || ["#27c9c2", "#178f96", "#6dffc6"];
      const b = y + s * 0.45, w = s * 0.88, h = s * 0.95, dx = x - m * w * 0.42, wx = x + m * w * 0.4, wy = b - h * 0.56;
      shadow(ctx, x, b, w * 1.15, s * 0.22);
      if (!nodoor) glow(ctx, dx, b + s * 0.15, s * 1.0, "255,200,90", 0.22);
      poly(ctx, [[x - w * 1.08, b], [x + w * 1.08, b], [x + w * 1.08, b - s * 0.1], [x - w * 1.08, b - s * 0.1]], "#33508f");
      const rt = b - h - s * 0.85;
      if (walls) {   // no roof yet: we see the back wall's top edge and the dark inside, with two bare roof beams
        const lip = s * 0.2, iw = w * 0.86;
        poly(ctx, [[x - w, b - h], [x + w, b - h], [x + iw, b - h - lip], [x - iw, b - h - lip]], "#0d1838");
        ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - iw, b - h - lip, iw * 2, s * 0.035);
      }
      poly(ctx, [[x - w, b - s * 0.1], [x, b - s * 0.1], [x, b - h], [x - w, b - h]], "#213a78");
      poly(ctx, [[x, b - s * 0.1], [x + w, b - s * 0.1], [x + w, b - h], [x, b - h]], "#182c5e");
      ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - w, b - s * 0.17, w * 2, s * 0.05); ctx.fillRect(x - w, b - h, w * 2, s * 0.05);
      if (walls) {   // the freshly raised corners still sparkle
        for (let i = 0; i < 4; i++) {
          const cx = x + (i < 2 ? -w : w), cy = i % 2 ? b - h : b - s * 0.12, p = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.6);
          glow(ctx, cx, cy, s * 0.24 * (0.6 + 0.4 * p), "255,110,190", 0.75);
          ctx.fillStyle = "#ffe3f3"; ctx.beginPath(); ctx.arc(cx, cy, s * 0.035, 0, TAU); ctx.fill();
        }
      } else {
        poly(ctx, [[x - w * 1.25, b - h], [x, b - h], [x, rt]], roof[0]);
        poly(ctx, [[x, b - h], [x + w * 1.25, b - h], [x, rt]], roof[1]);
        poly(ctx, [[x - w * 1.25, b - h], [x - w * 0.6, b - h], [x, rt]], roof[2]);
        if (th.settled) {   // a roof that has been eased down and locked: tile rows, an eave band, gold corner caps, a collar for the gem
          const rh = b - h - rt, hw = w * 1.25;
          ctx.lineWidth = Math.max(1, s * 0.022);
          for (let i = 1; i < 5; i++) {
            const f = i / 5, yy = rt + rh * f;
            ctx.strokeStyle = "rgba(20,10,60,0.28)"; ctx.beginPath(); ctx.moveTo(x - hw * f, yy); ctx.lineTo(x + hw * f, yy); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.beginPath(); ctx.moveTo(x - hw * f, yy + s * 0.022); ctx.lineTo(x, yy + s * 0.022); ctx.stroke();
          }
          ctx.fillStyle = roof[2]; ctx.fillRect(x - hw - s * 0.04, b - h - s * 0.035, hw + s * 0.04, s * 0.085);
          ctx.fillStyle = roof[0]; ctx.fillRect(x, b - h - s * 0.035, hw + s * 0.04, s * 0.085);
          for (let i = -1; i <= 1; i++) {
            const cx = x + i * hw, cy = b - h + s * 0.008, q = 0.6 + 0.4 * Math.sin(t * 1.6 + i * 2.1);
            glow(ctx, cx, cy, s * 0.2 * q, "255,214,120", 0.55);
            gem(ctx, cx, cy, s * 0.055, s * 0.075, "#fff6d6", "#ffd166", "#e09a2b");
          }
          poly(ctx, [[x - s * 0.1, rt + s * 0.1], [x + s * 0.1, rt + s * 0.1], [x + s * 0.05, rt - s * 0.02], [x - s * 0.05, rt - s * 0.02]], "#e09a2b");
          ctx.fillStyle = "#ffd166"; ctx.fillRect(x - s * 0.1, rt + s * 0.07, s * 0.2, s * 0.035);
        }
        const p = 0.75 + 0.25 * Math.sin(t * 2 + 1);
        const g = th.gem || ["255,110,190", "#ffe3f3", "#ff78c4", "#d0419a"];
        glow(ctx, x, rt - s * 0.12, s * 0.55 * p, g[0], 0.5);
        gem(ctx, x, rt - s * 0.12, s * 0.11, s * 0.18, g[1], g[2], g[3]);
        if (th.gem) {   // a freshly set gem throws off a slow twinkle
          const k = (t * 0.5 + (th.x || 0) * 0.37) % 1, a = Math.sin(k * Math.PI), L = s * 0.3 * a;
          ctx.strokeStyle = "rgba(255,246,214," + (0.9 * a).toFixed(2) + ")"; ctx.lineWidth = Math.max(1, s * 0.025);
          ctx.beginPath(); ctx.moveTo(x - L, rt - s * 0.12); ctx.lineTo(x + L, rt - s * 0.12); ctx.moveTo(x, rt - s * 0.12 - L); ctx.lineTo(x, rt - s * 0.12 + L); ctx.stroke();
        }
      }
      // th.room: the front wall can open to show the room inside (grid.js eases th.roomK 0..1 on a tap or someone on the step)
      const ro = th.room ? (th.roomK || 0) : 0, rk = ro * ro * (3 - 2 * ro);
      if (rk > 0.01) { room(ctx, x, b, w, h, s, t, rk, m); ctx.globalAlpha = Math.max(0, 1 - 1.15 * rk); }
      // door (an open doorway with a gold frame until the door is hung)
      const doorway = () => { ctx.beginPath(); ctx.moveTo(dx - s * 0.19, b - s * 0.1); ctx.lineTo(dx - s * 0.19, b - s * 0.5); ctx.arc(dx, b - s * 0.5, s * 0.19, Math.PI, 0); ctx.lineTo(dx + s * 0.19, b - s * 0.1); };
      if (nodoor) { ctx.fillStyle = "#0d1838"; doorway(); ctx.fill(); ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.035); doorway(); ctx.stroke(); }
      else if (th.door) {   // a coloured door hung in a gold frame: th.door = [light, mid, dark]. A tap swings it open for a moment.
        const D = th.door, dw = s * 0.19, top = b - s * 0.5, bot = b - s * 0.1, hx = dx - m * dw;
        const e = th.tapped != null ? t - th.tapped : 99, open = e >= 0 && e < 2.6 ? Math.min(1, e / 0.45, (2.6 - e) / 0.45) : 0, k = 1 - 0.72 * open;
        const X = f => hx + m * dw * (1 + f) * k;   // f: -1 at the hinge side, +1 at the latch side
        ctx.fillStyle = open ? "#ffe9a8" : D[2]; doorway(); ctx.fill();   // the warm inside shows while it is open
        if (open) glow(ctx, dx, b - s * 0.4, s * 0.75, "255,220,140", 0.5 * open);
        // the leaf: arched, hinged on the outer side
        ctx.fillStyle = D[1]; ctx.beginPath(); ctx.moveTo(X(-1), bot); ctx.lineTo(X(-1), top);
        for (let i = 0; i <= 10; i++) { const a = Math.PI * (1 - i / 10); ctx.lineTo(X(Math.cos(a)), top - Math.sin(a) * dw); }
        ctx.lineTo(X(1), bot); ctx.closePath(); ctx.fill();
        ctx.fillStyle = D[0]; ctx.beginPath(); ctx.moveTo(X(-1), bot); ctx.lineTo(X(-1), top);
        for (let i = 0; i <= 4; i++) { const a = Math.PI * (1 - i / 10); ctx.lineTo(X(Math.cos(a)), top - Math.sin(a) * dw); }
        ctx.lineTo(X(-0.3), bot); ctx.closePath(); ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
        // two sunk panels and a little gold-rimmed window in the arch
        ctx.fillStyle = D[2];
        const pan = (f0, f1, y0, y1) => poly(ctx, [[X(f0), y0], [X(f1), y0], [X(f1), y1], [X(f0), y1]], D[2]);
        pan(-0.62, -0.1, top + s * 0.06, bot - s * 0.05); pan(0.1, 0.62, top + s * 0.06, bot - s * 0.05);
        const wr = s * 0.055, wq = 0.8 + 0.2 * Math.sin(t * 1.7);
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(X(0), top - s * 0.055, (wr + s * 0.018) * k, wr + s * 0.018, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff0b8"; ctx.globalAlpha = wq; ctx.beginPath(); ctx.ellipse(X(0), top - s * 0.055, wr * k, wr, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        // gold hinges, knob and latch
        ctx.fillStyle = "#ffd166";
        for (const hy of [top + s * 0.03, bot - s * 0.09]) ctx.fillRect(Math.min(X(-1), X(-0.55)), hy, Math.abs(X(-0.55) - X(-1)), s * 0.03);
        ctx.beginPath(); ctx.arc(X(0.66), b - s * 0.33, s * 0.032, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(X(0.66) - s * 0.01, b - s * 0.34, s * 0.012, 0, TAU); ctx.fill();
        // the gold frame and a gold sill
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, s * 0.045); ctx.lineJoin = "round"; doorway(); ctx.stroke();
        ctx.strokeStyle = "#fff6d6"; ctx.lineWidth = Math.max(0.5, s * 0.012); doorway(); ctx.stroke();
        ctx.fillStyle = "#e09a2b"; ctx.fillRect(dx - dw - s * 0.05, bot - s * 0.015, dw * 2 + s * 0.1, s * 0.04);
        // a keystone gem that twinkles over the arch
        const kq = 0.6 + 0.4 * Math.sin(t * 1.9 + 0.7);
        glow(ctx, dx, top - dw, s * 0.2 * kq + s * 0.12 * open, "255,214,120", 0.55);
        gem(ctx, dx, top - dw - s * 0.005, s * 0.04, s * 0.055, "#fff6d6", "#ffd166", "#e09a2b");
      }
      else { ctx.fillStyle = "#ffd166"; doorway(); ctx.fill(); ctx.fillStyle = "#b9791f"; ctx.beginPath(); ctx.arc(dx + m * s * 0.1, b - s * 0.36, s * 0.03, 0, TAU); ctx.fill(); }
      // the round window, with a soft light that breathes
      const R = s * 0.25, q = 0.8 + 0.2 * Math.sin(t * 1.3 + (th.x || 0));
      glow(ctx, wx, wy, s * 0.7, "255,209,102", 0.34 * q);
      ctx.fillStyle = "#57e1ff"; ctx.beginPath(); ctx.arc(wx, wy, R + s * 0.05, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(wx, wy, R, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff0b8"; ctx.beginPath(); ctx.arc(wx - R * 0.3, wy - R * 0.3, R * 0.35, 0, TAU); ctx.fill();
      ctx.fillStyle = "#213a78"; ctx.fillRect(wx - s * 0.015, wy - R, s * 0.03, R * 2); ctx.fillRect(wx - R, wy - s * 0.015, R * 2, s * 0.03);
      ctx.globalAlpha = 1;
      if (rk > 0.01) {   // the front wall's frame stays: cyan edges round the opening, and a soft spill of warm light onto the step
        ctx.strokeStyle = "#57e1ff"; ctx.lineWidth = Math.max(1, s * 0.04); ctx.strokeRect(x - w, b - h, w * 2, h - s * 0.1);
        glow(ctx, x, b, s * 1.1, "255,200,110", 0.3 * rk);
      }
    },

    lamp(ctx, x, y, s, t, th) {
      const b = y + s * 0.3, top = b - s * 1.05, p = 0.85 + 0.15 * Math.sin(t * 3 + th.x * 2 + th.y);
      shadow(ctx, x, b, s * 0.2, s * 0.08);
      glow(ctx, x, b, s * 1.5, "255,214,120", 0.16 * p);            // pool of light on the ground
      ctx.fillStyle = "#2a3f7a"; ctx.fillRect(x - s * 0.035, top, s * 0.07, s * 1.05); ctx.fillRect(x - s * 0.13, b - s * 0.07, s * 0.26, s * 0.07);
      ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - s * 0.12, top, s * 0.24, s * 0.05);
      glow(ctx, x, top - s * 0.14, s * 0.75 * p, "255,214,120", 0.75);
      ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(x, top - s * 0.14, s * 0.17, 0, TAU); ctx.fill();
      // Light-moths: `moths: [[glowRGB, wingColour], ...]` on a lamp. Each one loops around the lamp head on its own
      // wobbly path, drifts out and back, and flaps two little wings.
      (th.moths || []).forEach(([rgb, wing], i) => {
        const ph = rnd(th.x * 7 + th.y * 13 + i * 3.7) * TAU, sp = (0.9 + rnd(ph) * 0.7) * (i % 2 ? -1 : 1), a = t * sp + ph;
        const r = s * (0.5 + 0.14 * Math.sin(t * 0.63 + ph * 2) + 0.1 * Math.sin(t * 0.21 + ph));
        const mx = x + Math.cos(a) * r * 1.25 + Math.sin(t * 2.3 + ph) * s * 0.04, my = top - s * 0.16 + Math.sin(a) * r * 0.6 + Math.sin(t * 3.1 + ph * 3) * s * 0.05;
        const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + ph)), w = s * 0.13, h = s * 0.09;
        glow(ctx, mx, my, s * 0.2, rgb, 0.4);
        poly(ctx, [[mx, my - h * 0.2], [mx - w * flap, my - h], [mx - w * flap * 0.8, my + h * 0.6], [mx, my + h * 0.3]], wing);
        poly(ctx, [[mx, my - h * 0.2], [mx + w * flap, my - h], [mx + w * flap * 0.8, my + h * 0.6], [mx, my + h * 0.3]], wing);
        ctx.fillStyle = "#fffdf0"; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.018, s * 0.05, 0, 0, TAU); ctx.fill();
      });
    },

    tree(ctx, x, y, s, t, th) {
      const b = y + s * 0.35;
      if (th.young) s *= 0.7;                                        // a newly planted tree: smaller, with a ring of fresh soil
      const sway = Math.sin(t * 0.9 + th.x) * s * 0.03;
      shadow(ctx, x, b, s * 0.5, s * 0.16);
      if (th.young) {
        ctx.fillStyle = "#3a2c6e"; ctx.beginPath(); ctx.ellipse(x, b, s * 0.36, s * 0.13, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#5b46a0"; ctx.beginPath(); ctx.ellipse(x, b - s * 0.02, s * 0.26, s * 0.085, 0, 0, TAU); ctx.fill();
        glow(ctx, x, b - s * 1.2, s * 1.1, "109,255,198", 0.16 + 0.06 * Math.sin(t * 1.3 + th.x));
      }
      poly(ctx, [[x - s * 0.09, b], [x + s * 0.09, b], [x + s * 0.05 + sway * 0.5, b - s * 0.75], [x - s * 0.05 + sway * 0.5, b - s * 0.75]], "#5b46a0");
      const blobs = [[0, -0.95, 0.5, "#35e8a8", "#1fae86"], [0.32, -1.25, 0.36, "#27c9c2", "#178f96"], [-0.32, -1.3, 0.34, "#27c9c2", "#178f96"], [0.02, -1.6, 0.33, "#6dffc6", "#35e8a8"]];
      for (const [dx, dy, r, light, dark] of blobs) {
        const cx = x + dx * s + sway * (-dy), cy = b + dy * s, R = r * s, pts = [];
        for (let i = 0; i < 6; i++) pts.push([cx + Math.cos(i * TAU / 6 + 0.5) * R, cy + Math.sin(i * TAU / 6 + 0.5) * R]);
        poly(ctx, pts, dark); poly(ctx, [pts[2], pts[3], pts[4], pts[5], [cx, cy]], light);
      }
      for (let i = 0; i < 4; i++) {                                  // glowberries
        const fx = x + (rnd(th.x * 7 + i) - 0.5) * s * 0.9 + sway, fy = b - s * (0.8 + rnd(th.y * 3 + i * 5) * 0.8), p = 0.6 + 0.4 * Math.sin(t * 2.5 + i * 1.7 + th.x);
        glow(ctx, fx, fy, s * 0.22 * p, "255,110,190", 0.9); ctx.fillStyle = "#ffd0ea"; ctx.beginPath(); ctx.arc(fx, fy, s * 0.045, 0, TAU); ctx.fill();
      }
    },

    fountain(ctx, x, y, s, t) {
      const b = y + s * 0.25;
      glow(ctx, x, b, s * 2.3, "87,225,255", 0.2);
      ctx.fillStyle = "#1a2c63"; ctx.beginPath(); ctx.ellipse(x, b + s * 0.16, s * 0.95, s * 0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#33508f"; ctx.beginPath(); ctx.ellipse(x, b, s * 0.95, s * 0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#57e1ff"; ctx.beginPath(); ctx.ellipse(x, b, s * 0.8, s * 0.33, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 2; i++) { const f = (t * 0.4 + i / 2) % 1; ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.ellipse(x, b, s * 0.8 * f, s * 0.33 * f, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#2a3f7a"; ctx.fillRect(x - s * 0.1, b - s * 0.4, s * 0.2, s * 0.42);
      const cy = b - s * 0.85 + Math.sin(t * 1.6) * s * 0.06;
      glow(ctx, x, cy, s * 0.85, "255,110,190", 0.55);
      gem(ctx, x, cy, s * 0.22, s * 0.36, "#ffe3f3", "#ff78c4", "#d0419a");
      for (let i = 0; i < 7; i++) {                                  // sparks hop out and fall back in
        const f = (t * 0.6 + i / 7) % 1, a = i * 2.4, px = x + Math.cos(a) * s * 0.6 * f, py = cy - Math.sin(f * Math.PI) * s * 0.75 + f * s * 0.8 + Math.sin(a) * s * 0.12 * f;
        glow(ctx, px, py, s * 0.13, "255,250,200", 1 - f * 0.7);
      }
    },

    // A bench for sitting on. It faces us; whoever sits on it is drawn just after it, on the seat.
    bench(ctx, x, y, s, t) {
      const b = y + s * 0.3, w = s * 0.46, seat = b - s * 0.2, top = b - s * 0.56;
      shadow(ctx, x, b + s * 0.02, s * 0.5, s * 0.1);
      glow(ctx, x, seat, s * 0.75, "150,120,255", 0.16);
      ctx.fillStyle = "#3b2f7a";                                                                    // back legs and back posts
      for (const d of [-1, 1]) ctx.fillRect(x + d * w * 0.86 - s * 0.03, top + s * 0.05, s * 0.06, b - top - s * 0.1);
      poly(ctx, [[x - w, top + s * 0.03], [x - w * 0.5, top - s * 0.03], [x + w * 0.5, top - s * 0.03], [x + w, top + s * 0.03], [x + w, top + s * 0.2], [x - w, top + s * 0.2]], "#6d55c9");   // back rest
      poly(ctx, [[x - w, top + s * 0.03], [x - w * 0.5, top - s * 0.03], [x + w * 0.5, top - s * 0.03], [x + w, top + s * 0.03], [x + w, top + s * 0.07], [x - w, top + s * 0.07]], "#a48cff");
      for (const d of [-1, 0, 1]) gem(ctx, x + d * w * 0.55, top + s * 0.13, s * 0.035, s * 0.05, "#fff3c9", "#ffd166", "#d99a2b");
      poly(ctx, [[x - w, seat - s * 0.07], [x + w, seat - s * 0.07], [x + w * 1.08, seat + s * 0.03], [x - w * 1.08, seat + s * 0.03]], "#33508f");      // seat
      poly(ctx, [[x - w * 1.08, seat + s * 0.03], [x + w * 1.08, seat + s * 0.03], [x + w * 1.08, seat + s * 0.09], [x - w * 1.08, seat + s * 0.09]], "#1a2c63");
      ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - w * 1.08, seat + s * 0.02, w * 2.16, Math.max(1, s * 0.025));
      for (const d of [-1, 1]) {                                                                    // front legs with gold feet
        ctx.fillStyle = "#2a3f7a"; ctx.fillRect(x + d * w * 0.9 - s * 0.035, seat + s * 0.09, s * 0.07, b - seat - s * 0.1);
        ctx.fillStyle = "#ffd166"; ctx.fillRect(x + d * w * 0.9 - s * 0.05, b - s * 0.03, s * 0.1, s * 0.04);
        glow(ctx, x + d * w * 1.08, seat, s * 0.1 * (0.8 + 0.2 * Math.sin(t * 2 + d)), "87,225,255", 0.7);
      }
    },

    flowers(ctx, x, y, s, t, th) {   // a bed of glowing flowers; a tap makes them puff up and shed sparks
      const b = y + s * 0.34, since = th.tapped != null ? t - th.tapped : 99, puff = since < 1.6 ? Math.sin(Math.min(1, since / 1.6) * Math.PI) : 0;
      const cols = th.colours || [["255,130,200", "#ff78c4", "#ffd0ea"], ["120,225,255", "#57e1ff", "#d6f8ff"], ["255,214,120", "#ffd166", "#fff6d6"], ["190,150,255", "#a678ff", "#e2d2ff"]];
      ctx.fillStyle = "#3a2c6e"; ctx.beginPath(); ctx.ellipse(x, b, s * 0.47, s * 0.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#4b3a8c"; ctx.beginPath(); ctx.ellipse(x, b - s * 0.02, s * 0.4, s * 0.15, 0, 0, TAU); ctx.fill();
      const spots = [[-0.28, -0.05, 0.3], [0.0, -0.09, 0.44], [0.27, -0.05, 0.33], [-0.14, 0.05, 0.36], [0.15, 0.06, 0.27]];
      spots.forEach(([dx, dy, h], i) => {
        const n = th.x * 7 + th.y * 13 + i, c = cols[(i + th.x + th.y) % cols.length];
        const sway = Math.sin(t * 1.2 + n) * s * 0.03, fx = x + dx * s, fy = b + dy * s, hh = h * s * (1 + 0.25 * puff), hx = fx + sway, hy = fy - hh;
        ctx.strokeStyle = "#35e8a8"; ctx.lineWidth = Math.max(1, s * 0.035); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx, fy - hh * 0.6, hx, hy); ctx.stroke();
        poly(ctx, [[fx, fy - hh * 0.35], [fx + s * 0.1, fy - hh * 0.55], [fx + s * 0.02, fy - hh * 0.3]], "#1fae86");
        const R = s * (0.085 + 0.03 * puff), pulse = 0.6 + 0.4 * Math.sin(t * 1.7 + n * 1.3);
        glow(ctx, hx, hy, R * 4.2, c[0], 0.3 + 0.25 * pulse + 0.3 * puff);
        ctx.fillStyle = c[1];
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + n + t * 0.15; ctx.beginPath(); ctx.ellipse(hx + Math.cos(a) * R * 0.85, hy + Math.sin(a) * R * 0.85, R * 0.62, R * 0.4, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = c[2]; ctx.beginPath(); ctx.arc(hx, hy, R * 0.48, 0, TAU); ctx.fill();
        if (puff) for (let k = 0; k < 3; k++) { const f = Math.min(1, since / 1.6), a = rnd(n + k * 3.1) * TAU; glow(ctx, hx + Math.cos(a) * f * s * 0.35, hy - f * s * (0.5 + rnd(n + k) * 0.5), s * 0.07 * (1 - f) + 1, c[0], 1 - f); }
      });
    },
    // The Glow-bee Hive: a little gold skep on a post. Its bees are drawn by GLINT_OVER.hive (after everything else, so
    // they fly in front of the flowers they visit).
    hive(ctx, x, y, s, t, th) {
      const b = y + s * 0.32, top = b - s * 0.42, pulse = 0.6 + 0.4 * Math.sin(t * 1.5 + th.x);
      shadow(ctx, x, b, s * 0.3, s * 0.1);
      ctx.fillStyle = "#5b46a0"; ctx.fillRect(x - s * 0.045, top, s * 0.09, b - top);
      poly(ctx, [[x - s * 0.3, top], [x + s * 0.3, top], [x + s * 0.24, top + s * 0.07], [x - s * 0.24, top + s * 0.07]], "#7f6ad0");
      glow(ctx, x, top - s * 0.25, s * 0.85, "255,214,120", 0.22 + 0.12 * pulse);
      const bands = [[0.27, 0.0, "#e09a2b", "#ffb92e"], [0.25, 0.13, "#ffb92e", "#ffd166"], [0.2, 0.26, "#e09a2b", "#ffb92e"], [0.13, 0.37, "#ffb92e", "#ffe29a"]];
      for (const [w, up, dark, light] of bands) {
        const cy = top - s * (up + 0.07);
        ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x, cy, s * w, s * 0.085, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(x - s * w * 0.18, cy - s * 0.02, s * w * 0.7, s * 0.045, 0, 0, TAU); ctx.fill();
      }
      gem(ctx, x, top - s * 0.56, s * 0.055, s * 0.09, "#ffd0ea", "#ff78c4", "#d0419a");
      ctx.fillStyle = "#3a2466"; ctx.beginPath(); ctx.ellipse(x, top - s * 0.12, s * 0.075, s * 0.085, 0, 0, TAU); ctx.fill();   // the little round door
      glow(ctx, x, top - s * 0.12, s * 0.16, "255,240,180", 0.35 + 0.3 * pulse);
    },
    // A coat stand with a finished coat hanging on it (th.coat = [light, mid, dark]). The coat's trim, cuffs, collar and
    // buttons glow white and breathe slowly; little white sparks lift off it. A tap makes it sway and flare bright for 2 s.
    coatstand(ctx, x, y, s, t, th) {
      const b = y + s * 0.32, top = b - s * 1.08, c = th.coat || ["#4f7dff", "#2f4fc4", "#1c2f86"];
      const since = th.tapped != null ? t - th.tapped : 99, flare = since >= 0 && since < 2 ? Math.sin(Math.min(1, since / 2) * Math.PI) : 0;
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.3 + th.x), lit = Math.min(1, 0.55 + 0.3 * pulse + 0.6 * flare);
      const sway = Math.sin(t * 0.9) * 0.012 + Math.sin(since * 7) * 0.05 * flare;
      shadow(ctx, x, b, s * 0.3, s * 0.1);
      poly(ctx, [[x - s * 0.2, b], [x + s * 0.2, b], [x + s * 0.12, b - s * 0.06], [x - s * 0.12, b - s * 0.06]], "#7f6ad0");   // foot
      ctx.fillStyle = "#5b46a0"; ctx.fillRect(x - s * 0.035, top, s * 0.07, b - top - s * 0.04);                               // post
      ctx.fillStyle = "#7f6ad0"; ctx.fillRect(x - s * 0.24, top + s * 0.07, s * 0.48, s * 0.05);                               // peg bar
      ctx.fillRect(x - s * 0.26, top + s * 0.02, s * 0.05, s * 0.1); ctx.fillRect(x + s * 0.21, top + s * 0.02, s * 0.05, s * 0.1);
      gem(ctx, x, top - s * 0.03, s * 0.045, s * 0.07, "#fff6d6", "#ffd166", "#e09a2b");
      glow(ctx, x, top + s * 0.5, s * (0.95 + 0.25 * flare), "235,245,255", 0.2 + 0.16 * pulse + 0.35 * flare);
      const sh = top + s * 0.15, hem = top + s * 0.86, k = (px, py) => [x + px * s + sway * s * (py - sh) / (hem - sh) * 3, py];   // hangs from the bar, sways at the hem
      poly(ctx, [k(-0.2, sh), k(-0.36, sh + s * 0.42), k(-0.25, sh + s * 0.46), k(-0.13, sh + s * 0.14)], c[2]);               // sleeves
      poly(ctx, [k(0.2, sh), k(0.36, sh + s * 0.42), k(0.25, sh + s * 0.46), k(0.13, sh + s * 0.14)], c[2]);
      poly(ctx, [k(-0.2, sh), k(0.2, sh), k(0.26, hem), k(-0.26, hem)], c[1]);                                                 // body
      poly(ctx, [k(-0.2, sh), k(0, sh), k(0, hem), k(-0.26, hem)], c[0]);
      const w = `rgba(255,255,255,${lit})`;
      poly(ctx, [k(-0.265, hem - s * 0.05), k(0.265, hem - s * 0.05), k(0.27, hem + s * 0.015), k(-0.27, hem + s * 0.015)], w); // glowing hem
      poly(ctx, [k(-0.37, sh + s * 0.39), k(-0.25, sh + s * 0.43), k(-0.245, sh + s * 0.485), k(-0.375, sh + s * 0.44)], w);   // cuffs
      poly(ctx, [k(0.37, sh + s * 0.39), k(0.25, sh + s * 0.43), k(0.245, sh + s * 0.485), k(0.375, sh + s * 0.44)], w);
      poly(ctx, [k(-0.2, sh - s * 0.02), k(0, sh + s * 0.13), k(0.2, sh - s * 0.02), k(0.12, sh - s * 0.045), k(0, sh + s * 0.05), k(-0.12, sh - s * 0.045)], w);   // collar
      poly(ctx, [k(-0.012, sh + s * 0.1), k(0.012, sh + s * 0.1), k(0.012, hem - s * 0.05), k(-0.012, hem - s * 0.05)], `rgba(255,255,255,${lit * 0.7})`);
      for (let i = 0; i < 3; i++) { const [bx, by] = k(0.06, sh + s * (0.24 + i * 0.15)); ctx.fillStyle = w; ctx.beginPath(); ctx.arc(bx, by, s * 0.025, 0, TAU); ctx.fill(); glow(ctx, bx, by, s * 0.09, "255,255,255", 0.5 * lit); }
      glow(ctx, x, hem - s * 0.02, s * 0.42, "255,255,255", 0.3 * lit); glow(ctx, x, sh + s * 0.03, s * 0.3, "255,255,255", 0.28 * lit);
      for (let i = 0; i < 5; i++) {                                                                                           // sparks lifting off
        const f = (t * (0.22 + 0.05 * i) + rnd(i + 3.7)) % 1, px = x + (rnd(i * 2.3 + 1) - 0.5) * s * 0.7 + Math.sin(t * 1.4 + i) * s * 0.04;
        glow(ctx, px, hem - s * 0.1 - f * s * 0.95, s * (0.035 + 0.03 * flare) * (1 - f) + 1, "255,255,255", (1 - f) * (0.55 + 0.45 * flare));
      }
    },
    // A welcome mat lying flat on a doorstep (th.ox shifts it sideways, in tiles, to sit under a door; th.mat = [light, mid, dark]).
    // Woven stripes, a gold border with tassels at both ends and a gold spark in the middle. It is flat, so walkers step on it.
    // A tap sends a ring of gold light out from the spark and round the border for 2 s.
    mat(ctx, x, y, s, t, th) {
      const c = th.mat || ["#c9a8ff", "#9b6bff", "#5a36b8"], cx = x + (th.ox || 0) * s, cy = y - s * 0.25, w = s * 0.42, h = s * 0.18;
      const since = th.tapped != null ? t - th.tapped : 99, f = since >= 0 && since < 2 ? since / 2 : -1, flare = f >= 0 ? Math.sin(f * Math.PI) : 0;
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.4 + th.x);
      glow(ctx, cx, cy, s * (0.6 + 0.2 * flare), "255,214,120", 0.12 + 0.08 * pulse + 0.3 * flare);
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.022);                                  // tassels
      for (let i = 0; i < 6; i++) { const ty = cy - h * 0.8 + i * h * 0.32; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * w, ty); ctx.lineTo(cx + d * (w + s * 0.055), ty + s * 0.01); ctx.stroke(); } }
      const rr = (px, py, pw, ph, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(px + r, py); ctx.arcTo(px + pw, py, px + pw, py + ph, r); ctx.arcTo(px + pw, py + ph, px, py + ph, r); ctx.arcTo(px, py + ph, px, py, r); ctx.arcTo(px, py, px + pw, py, r); ctx.closePath(); ctx.fill(); };
      rr(cx - w, cy - h + s * 0.025, w * 2, h * 2, s * 0.04, "rgba(0,0,0,0.35)");                             // it lies on the step
      rr(cx - w, cy - h, w * 2, h * 2, s * 0.04, "#e09a2b");
      rr(cx - w + s * 0.012, cy - h + s * 0.012, w * 2 - s * 0.024, h * 2 - s * 0.03, s * 0.035, "#ffd166");   // gold border
      const iw = w - s * 0.045, ih = h - s * 0.04;
      rr(cx - iw, cy - ih, iw * 2, ih * 2, s * 0.02, c[1]);
      ctx.fillStyle = c[2]; for (let i = 0; i < 4; i++) ctx.fillRect(cx - iw, cy - ih + (i * 2 + 1) * ih / 4 - s * 0.004, iw * 2, ih / 4 * 0.55);   // woven stripes
      ctx.fillStyle = c[0]; ctx.fillRect(cx - iw, cy - ih, iw * 2, s * 0.018);
      for (const d of [-1, 1]) gem(ctx, cx + d * iw * 0.68, cy, s * 0.028, s * 0.04, "#fff6d6", "#ffd166", "#e09a2b");
      const R = s * (0.075 + 0.02 * pulse + 0.03 * flare);                                                  // the gold spark in the middle
      poly(ctx, [[cx, cy - R], [cx + R * 0.28, cy - R * 0.28], [cx + R * 1.5, cy], [cx + R * 0.28, cy + R * 0.28], [cx, cy + R], [cx - R * 0.28, cy + R * 0.28], [cx - R * 1.5, cy], [cx - R * 0.28, cy - R * 0.28]], "#fff6d6");
      glow(ctx, cx, cy, s * 0.2, "255,236,170", 0.45 + 0.3 * pulse + 0.25 * flare);
      if (f >= 0) {                                                                                         // the welcome: a ring of light and sparks lifting off
        ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(255,230,150,${(1 - f) * 0.9})`; ctx.lineWidth = Math.max(1.5, s * 0.035);
        ctx.beginPath(); ctx.ellipse(cx, cy, w * (0.2 + f * 1.5), h * (0.3 + f * 2.2), 0, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 7; i++) { const a = rnd(i * 1.7 + 2) * TAU; glow(ctx, cx + Math.cos(a) * w * (0.3 + f), cy + Math.sin(a) * h - f * s * (0.35 + rnd(i) * 0.5), s * 0.06 * (1 - f) + 1, i % 2 ? "255,214,120" : "201,168,255", 1 - f); }
      }
    },
    sign(ctx, x, y, s) {
      const b = y + s * 0.3;
      shadow(ctx, x, b, s * 0.22, s * 0.08);
      ctx.fillStyle = "#5b46a0"; ctx.fillRect(x - s * 0.04, b - s * 0.75, s * 0.08, s * 0.75);
      poly(ctx, [[x - s * 0.4, b - s * 0.85], [x + s * 0.3, b - s * 0.85], [x + s * 0.45, b - s * 0.67], [x + s * 0.3, b - s * 0.5], [x - s * 0.4, b - s * 0.5]], "#ffd166");
      ctx.fillStyle = "#7a4d0e"; ctx.fillRect(x - s * 0.3, b - s * 0.76, s * 0.5, s * 0.045); ctx.fillRect(x - s * 0.3, b - s * 0.64, s * 0.36, s * 0.045);
    },

    // The welcome arch over the end of Lantern Street: two navy posts (one tile either side), a violet arch between them,
    // a gold board with KINDLE'S carved into it, a lit lamp on top of each post and a pink gem at the crown.
    // th.tapped (a touch, or someone walking under it) lights the letters one by one and lifts sparks off the lamps.
    arch(ctx, x, y, s, t, th) {
      const b = y + s * 0.1, px = s * 1.0, pw = s * 0.11, ph = s * 1.45, top = b - ph;
      const f = th.tapped != null && t - th.tapped >= 0 && t - th.tapped < 4 ? (t - th.tapped) / 4 : -1;
      const fl = d => 0.85 + 0.1 * Math.sin(t * 3.1 + d * 2) + 0.05 * Math.sin(t * 7.3 + d);   // each lamp flickers on its own
      for (const d of [-1, 1]) { shadow(ctx, x + d * px, b, s * 0.26, s * 0.09); glow(ctx, x + d * px, b, s * 1.2, "255,214,120", 0.12 * fl(d)); }
      // the arch: a violet band curving between the post tops, with a pale top edge and a cyan underside
      const ay = top + s * 0.06, crown = top - s * 0.42;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#5a36b8"; ctx.lineWidth = s * 0.2; ctx.beginPath(); ctx.moveTo(x - px, ay); ctx.quadraticCurveTo(x, crown - s * 0.2, x + px, ay); ctx.stroke();
      ctx.strokeStyle = "#9b6bff"; ctx.lineWidth = s * 0.11; ctx.beginPath(); ctx.moveTo(x - px, ay - s * 0.03); ctx.quadraticCurveTo(x, crown - s * 0.25, x + px, ay - s * 0.03); ctx.stroke();
      ctx.strokeStyle = "#57e1ff"; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(x - px, ay + s * 0.1); ctx.quadraticCurveTo(x, crown - s * 0.02, x + px, ay + s * 0.1); ctx.stroke();
      // posts: navy with cyan trim, a wider foot and a gold collar under each lamp
      for (const d of [-1, 1]) {
        const cx = x + d * px;
        ctx.fillStyle = "#1c2a5c"; ctx.fillRect(cx - pw * 1.5, b - s * 0.14, pw * 3, s * 0.14);
        ctx.fillStyle = "#2a3f7a"; ctx.fillRect(cx - pw, top, pw * 2, ph);
        ctx.fillStyle = "#3b57a3"; ctx.fillRect(cx - pw, top, pw * 0.6, ph);
        ctx.fillStyle = "#57e1ff"; ctx.fillRect(cx - pw * 1.5, b - s * 0.16, pw * 3, s * 0.03); ctx.fillRect(cx - pw, top + ph * 0.45, pw * 2, s * 0.025);
        ctx.fillStyle = "#ffd166"; ctx.fillRect(cx - pw * 1.35, top - s * 0.04, pw * 2.7, s * 0.07);
      }
      // the name board, hung under the crown of the arch
      const bw = s * 0.78, bh = s * 0.27, by = top - s * 0.12;
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.025);
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + d * bw * 0.6, by - bh / 2); ctx.lineTo(x + d * bw * 0.55, by - bh / 2 - s * 0.13); ctx.stroke(); }
      glow(ctx, x, by, s * 0.9, "255,214,120", 0.18 + (f >= 0 ? 0.25 * Math.sin(f * Math.PI) : 0));
      ctx.fillStyle = "#e09a2b"; ctx.beginPath(); ctx.roundRect(x - bw, by - bh / 2, bw * 2, bh, s * 0.05); ctx.fill();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.roundRect(x - bw + s * 0.03, by - bh / 2 + s * 0.03, bw * 2 - s * 0.06, bh - s * 0.06, s * 0.04); ctx.fill();
      const word = "KINDLE'S", fs = Math.max(5, s * 0.2), step = (bw * 2 - s * 0.2) / word.length;
      ctx.font = `800 ${fs}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      [...word].forEach((ch, i) => {
        const lx = x - bw + s * 0.1 + step * (i + 0.5), ly = by + s * 0.01;
        const lit = f >= 0 ? Math.max(0, Math.min(1, (f * 1.6 - i / word.length) * 4)) * (f > 0.75 ? (1 - f) * 4 : 1) : 0;   // one by one, then fade
        ctx.fillStyle = "#fff6d6"; ctx.fillText(ch, lx + s * 0.012, ly + s * 0.014);       // the bright lower edge of the cut
        if (lit > 0.05) glow(ctx, lx, ly, s * 0.16, "255,130,200", 0.5 * lit);
        if (lit > 0) { ctx.strokeStyle = "#7a4d0e"; ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeText(ch, lx, ly); }     // lit: the cut keeps its dark edge
        ctx.fillStyle = lit > 0 ? `rgb(${122 + 133 * lit},${77 + 163 * lit},${14 + 236 * lit})` : "#7a4d0e"; ctx.fillText(ch, lx, ly);
      });
      // pink gem at the crown
      const gp = 0.8 + 0.2 * Math.sin(t * 2.2);
      glow(ctx, x, crown - s * 0.18, s * 0.35 * gp, "255,110,190", 0.6);
      gem(ctx, x, crown - s * 0.18, s * 0.09, s * 0.13, "#ffd0ea", "#ff6fc0", "#c23f8f");
      // a lit lamp on each post
      for (const d of [-1, 1]) {
        const cx = x + d * px, ly = top - s * 0.2, p = fl(d);
        ctx.fillStyle = "#57e1ff"; ctx.fillRect(cx - s * 0.1, top - s * 0.06, s * 0.2, s * 0.04);
        glow(ctx, cx, ly, s * 0.7 * p, "255,214,120", 0.75);
        ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(cx, ly, s * 0.13, 0, TAU); ctx.fill();
        ctx.fillStyle = "#57e1ff"; poly(ctx, [[cx - s * 0.08, ly - s * 0.11], [cx + s * 0.08, ly - s * 0.11], [cx, ly - s * 0.2]], "#57e1ff");
        if (f >= 0) for (let i = 0; i < 4; i++) { const g = (f * 1.5 + i / 4) % 1; glow(ctx, cx + Math.sin(i * 2.1 + g * 5) * s * 0.15, ly - g * s * 0.8, s * 0.05 * (1 - g) + 1, i % 2 ? "255,214,120" : "255,130,200", (1 - g) * (1 - f)); }
      }
    },

    // Glint himself, in the body he made: crystal head, crystal tunic, his gold ring worn as a belt, two arms, two legs.
    // th.dx/th.dy is which way he's heading, th.moving is true while he walks, th.tapped is when he was last tapped (he waves),
    // and when GLINT_LIFE says he's asleep he sits down with his eyes shut.
    glint(ctx, x, y, s, t, th) {
      const life = window.GLINT_LIFE, asleep = !!(life && life.ready && life.awake === false) || th.asleep;
      const walk = th.moving && !asleep && !th.seated, ph = t * 9, dir = th.dx || 0, look = asleep || th.seated ? 0 : dir * s * 0.05;
      const wave = !asleep && th.tapped != null && t - th.tapped >= 0 && t - th.tapped < 2.2;
      const bench = th.seated && !th.moving, down = asleep || bench;     // down: sitting, on the ground (asleep) or on a bench
      const b = y + s * 0.3, sit = bench ? s * 0.03 : asleep ? s * 0.16 : 0;
      const bob = asleep ? Math.sin(t * 1.2) * s * 0.012 : walk ? Math.abs(Math.sin(ph)) * s * 0.04 : Math.sin(t * 2.2) * s * 0.015;
      const hip = b - s * 0.2 + sit - bob, sh = hip - s * 0.3, hy = sh - s * 0.25 + (asleep ? s * 0.03 : 0), lw = Math.max(1.5, s * 0.07);
      shadow(ctx, x, b, s * 0.3, s * 0.1);
      glow(ctx, x, sh, s * (asleep ? 0.8 : 1.05), "87,225,255", asleep ? 0.22 : 0.36);
      if (walk) for (let i = 1; i <= 3; i++) glow(ctx, x - dir * s * 0.22 * i, b - s * 0.1 - (th.dy || 0) * s * 0.22 * i, s * 0.1, "87,225,255", 0.4 / i);   // trail of light
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // legs and feet
      for (const d of [-1, 1]) {
        const sw = walk ? Math.sin(ph + (d > 0 ? Math.PI : 0)) : 0, hx = x + d * s * 0.075;
        const kick = bench && !asleep ? Math.sin(t * 2.4 + d) * s * 0.025 : 0;                                   // feet swing a little on the bench
        const fx = down ? hx + d * s * (bench ? 0.07 : 0.16) + kick : hx + sw * s * 0.09 * (dir || 0), fy = down ? b - s * 0.02 : b - s * 0.03 - Math.max(0, sw) * s * 0.07;
        ctx.strokeStyle = "#2f8fd8"; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(hx, hip - s * 0.02); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(fx + (down ? d : dir) * s * 0.025, fy, s * 0.075, s * 0.045, 0, 0, TAU); ctx.fill();
      }
      // far arm (behind the tunic), tunic, belt
      const arm = (d, front) => {
        const sw = walk ? Math.sin(ph + (d > 0 ? 0 : Math.PI)) : 0, ax = x + d * s * 0.13, ay = sh + s * 0.05;
        let hx2 = ax + d * s * 0.1 + sw * s * 0.08 * (dir || 0), hy2 = ay + s * 0.2 - Math.abs(sw) * s * 0.03;
        if (down) { hx2 = ax + d * s * 0.05; hy2 = ay + s * 0.2; }
        if (wave && d > 0) { const a = -1.0 + Math.sin(t * 11) * 0.4; hx2 = ax + Math.cos(a) * s * 0.27; hy2 = ay + Math.sin(a) * s * 0.27; }
        ctx.strokeStyle = front ? "#8fefff" : "#2f8fd8"; ctx.lineWidth = lw * 0.85; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx2, hy2); ctx.stroke();
        glow(ctx, hx2, hy2, s * 0.13, "255,250,200", 0.8);
        ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(hx2, hy2, s * 0.05, 0, TAU); ctx.fill();
      };
      arm(-1, false);
      poly(ctx, [[x - s * 0.12, sh], [x, sh], [x, hip + s * 0.03], [x - s * 0.2, hip]], "#8fefff");
      poly(ctx, [[x, sh], [x + s * 0.12, sh], [x + s * 0.2, hip], [x, hip + s * 0.03]], "#2fb4e6");
      poly(ctx, [[x - s * 0.2, hip], [x, hip + s * 0.03], [x + s * 0.2, hip], [x + s * 0.17, hip - s * 0.07], [x - s * 0.17, hip - s * 0.07]], "#1f9fd0");
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1.5, s * 0.05);                                    // his ring, worn as a belt
      ctx.beginPath(); ctx.moveTo(x - s * 0.17, hip - s * 0.1); ctx.quadraticCurveTo(x, hip - s * 0.04, x + s * 0.17, hip - s * 0.1); ctx.stroke();
      const hp = 0.7 + 0.3 * Math.sin(t * (asleep ? 1.2 : 2.6));                                               // the little light inside
      glow(ctx, x, sh + s * 0.1, s * 0.16 * hp, "255,110,190", 0.9);
      ctx.fillStyle = "#ffd0ea"; ctx.beginPath(); ctx.arc(x, sh + s * 0.1, s * 0.03, 0, TAU); ctx.fill();
      arm(1, true);
      // head: the crystal he always was
      gem(ctx, x, hy, s * 0.25, s * 0.33, "#e8fbff", "#57e1ff", "#1f9fd0");
      const ey = hy - s * 0.03;
      if (asleep) {
        ctx.strokeStyle = "#0a1a3a"; ctx.lineWidth = Math.max(1, s * 0.025);
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(x + d * s * 0.09, ey, s * 0.045, 0.15, Math.PI - 0.15); ctx.stroke(); }
        ctx.fillStyle = "#dff8ff"; ctx.textAlign = "center";
        for (let i = 0; i < 3; i++) { const f = (t * 0.3 + i / 3) % 1; ctx.globalAlpha = Math.sin(f * Math.PI) * 0.9; ctx.font = `700 ${Math.round(s * (0.16 + f * 0.14))}px system-ui`; ctx.fillText("z", x + s * (0.28 + f * 0.3), hy - s * (0.3 + f * 0.6)); }
        ctx.globalAlpha = 1;
      } else {
        const blink = (t % 3.7) < 0.14 ? 0.15 : 1;
        for (const d of [-1, 1]) {
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x + d * s * 0.09 + look, ey, s * 0.06, s * 0.078 * blink, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = "#0a1a3a"; ctx.beginPath(); ctx.ellipse(x + d * s * 0.09 + look * 1.5, ey + s * 0.01, s * 0.028, s * 0.042 * blink, 0, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = "#0a1a3a"; ctx.lineWidth = Math.max(1, s * 0.025); ctx.beginPath(); ctx.arc(x + look, hy + s * 0.08, s * (wave ? 0.075 : 0.055), 0.2, Math.PI - 0.2); ctx.stroke();
      }
      // spark on top
      const p = asleep ? 0.45 : 0.7 + 0.3 * Math.sin(t * 5);
      glow(ctx, x, hy - s * 0.47, s * 0.26 * p, "255,250,200", asleep ? 0.6 : 1);
    }
  };
})();
