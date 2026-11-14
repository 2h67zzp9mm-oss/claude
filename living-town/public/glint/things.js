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

  window.GLINT_GROUND = {
    ".": { fill: "#0a1020", line: "#12305a" },   // empty grid
    "p": { fill: "#1b3a63", line: "#3fd0ff" },   // light path
    "o": { fill: "#1d2f66", line: "#7f8dff" },   // plaza
    "g": { fill: "#0c2a2c", line: "#1c6b5c" }    // glow-moss
  };

  window.GLINT_THINGS = {
    home(ctx, x, y, s, t) {
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
    },

    // A little house for a friend: teal roof, a door on the left and one big round window.
    cottage(ctx, x, y, s, t) {
      const b = y + s * 0.45, w = s * 0.88, h = s * 0.95, dx = x - w * 0.42, wx = x + w * 0.4, wy = b - h * 0.56;
      shadow(ctx, x, b, w * 1.15, s * 0.22);
      glow(ctx, dx, b + s * 0.15, s * 1.0, "255,200,90", 0.22);
      poly(ctx, [[x - w * 1.08, b], [x + w * 1.08, b], [x + w * 1.08, b - s * 0.1], [x - w * 1.08, b - s * 0.1]], "#33508f");
      poly(ctx, [[x - w, b - s * 0.1], [x, b - s * 0.1], [x, b - h], [x - w, b - h]], "#213a78");
      poly(ctx, [[x, b - s * 0.1], [x + w, b - s * 0.1], [x + w, b - h], [x, b - h]], "#182c5e");
      ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - w, b - s * 0.17, w * 2, s * 0.05); ctx.fillRect(x - w, b - h, w * 2, s * 0.05);
      const rt = b - h - s * 0.85;
      poly(ctx, [[x - w * 1.25, b - h], [x, b - h], [x, rt]], "#27c9c2");
      poly(ctx, [[x, b - h], [x + w * 1.25, b - h], [x, rt]], "#178f96");
      poly(ctx, [[x - w * 1.25, b - h], [x - w * 0.6, b - h], [x, rt]], "#6dffc6");
      const p = 0.75 + 0.25 * Math.sin(t * 2 + 1);
      glow(ctx, x, rt - s * 0.12, s * 0.55 * p, "255,110,190", 0.5);
      gem(ctx, x, rt - s * 0.12, s * 0.11, s * 0.18, "#ffe3f3", "#ff78c4", "#d0419a");
      // door
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.moveTo(dx - s * 0.19, b - s * 0.1); ctx.lineTo(dx - s * 0.19, b - s * 0.5); ctx.arc(dx, b - s * 0.5, s * 0.19, Math.PI, 0); ctx.lineTo(dx + s * 0.19, b - s * 0.1); ctx.fill();
      ctx.fillStyle = "#b9791f"; ctx.beginPath(); ctx.arc(dx + s * 0.1, b - s * 0.36, s * 0.03, 0, TAU); ctx.fill();
      // the round window, with a soft light that breathes
      const R = s * 0.25, q = 0.8 + 0.2 * Math.sin(t * 1.3);
      glow(ctx, wx, wy, s * 0.7, "255,209,102", 0.34 * q);
      ctx.fillStyle = "#57e1ff"; ctx.beginPath(); ctx.arc(wx, wy, R + s * 0.05, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(wx, wy, R, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff0b8"; ctx.beginPath(); ctx.arc(wx - R * 0.3, wy - R * 0.3, R * 0.35, 0, TAU); ctx.fill();
      ctx.fillStyle = "#213a78"; ctx.fillRect(wx - s * 0.015, wy - R, s * 0.03, R * 2); ctx.fillRect(wx - R, wy - s * 0.015, R * 2, s * 0.03);
    },

    lamp(ctx, x, y, s, t, th) {
      const b = y + s * 0.3, top = b - s * 1.05, p = 0.85 + 0.15 * Math.sin(t * 3 + th.x * 2 + th.y);
      shadow(ctx, x, b, s * 0.2, s * 0.08);
      glow(ctx, x, b, s * 1.5, "255,214,120", 0.16 * p);            // pool of light on the ground
      ctx.fillStyle = "#2a3f7a"; ctx.fillRect(x - s * 0.035, top, s * 0.07, s * 1.05); ctx.fillRect(x - s * 0.13, b - s * 0.07, s * 0.26, s * 0.07);
      ctx.fillStyle = "#57e1ff"; ctx.fillRect(x - s * 0.12, top, s * 0.24, s * 0.05);
      glow(ctx, x, top - s * 0.14, s * 0.75 * p, "255,214,120", 0.75);
      ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(x, top - s * 0.14, s * 0.17, 0, TAU); ctx.fill();
    },

    tree(ctx, x, y, s, t, th) {
      const b = y + s * 0.35, sway = Math.sin(t * 0.9 + th.x) * s * 0.03;
      shadow(ctx, x, b, s * 0.5, s * 0.16);
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

    sign(ctx, x, y, s) {
      const b = y + s * 0.3;
      shadow(ctx, x, b, s * 0.22, s * 0.08);
      ctx.fillStyle = "#5b46a0"; ctx.fillRect(x - s * 0.04, b - s * 0.75, s * 0.08, s * 0.75);
      poly(ctx, [[x - s * 0.4, b - s * 0.85], [x + s * 0.3, b - s * 0.85], [x + s * 0.45, b - s * 0.67], [x + s * 0.3, b - s * 0.5], [x - s * 0.4, b - s * 0.5]], "#ffd166");
      ctx.fillStyle = "#7a4d0e"; ctx.fillRect(x - s * 0.3, b - s * 0.76, s * 0.5, s * 0.045); ctx.fillRect(x - s * 0.3, b - s * 0.64, s * 0.36, s * 0.045);
    },

    // Glint himself, in the body he made: crystal head, crystal tunic, his gold ring worn as a belt, two arms, two legs.
    // th.dx/th.dy is which way he's heading, th.moving is true while he walks, th.tapped is when he was last tapped (he waves),
    // and when GLINT_LIFE says he's asleep he sits down with his eyes shut.
    glint(ctx, x, y, s, t, th) {
      const life = window.GLINT_LIFE, asleep = !!(life && life.ready && life.awake === false) || th.asleep;
      const walk = th.moving && !asleep, ph = t * 9, dir = th.dx || 0, look = asleep ? 0 : dir * s * 0.05;
      const wave = !asleep && th.tapped != null && t - th.tapped >= 0 && t - th.tapped < 2.2;
      const b = y + s * 0.3, sit = asleep ? s * 0.16 : 0;
      const bob = asleep ? Math.sin(t * 1.2) * s * 0.012 : walk ? Math.abs(Math.sin(ph)) * s * 0.04 : Math.sin(t * 2.2) * s * 0.015;
      const hip = b - s * 0.2 + sit - bob, sh = hip - s * 0.3, hy = sh - s * 0.25 + (asleep ? s * 0.03 : 0), lw = Math.max(1.5, s * 0.07);
      shadow(ctx, x, b, s * 0.3, s * 0.1);
      glow(ctx, x, sh, s * (asleep ? 0.8 : 1.05), "87,225,255", asleep ? 0.22 : 0.36);
      if (walk) for (let i = 1; i <= 3; i++) glow(ctx, x - dir * s * 0.22 * i, b - s * 0.1 - (th.dy || 0) * s * 0.22 * i, s * 0.1, "87,225,255", 0.4 / i);   // trail of light
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // legs and feet
      for (const d of [-1, 1]) {
        const sw = walk ? Math.sin(ph + (d > 0 ? Math.PI : 0)) : 0, hx = x + d * s * 0.075;
        const fx = asleep ? hx + d * s * 0.16 : hx + sw * s * 0.09 * (dir || 0), fy = asleep ? b - s * 0.02 : b - s * 0.03 - Math.max(0, sw) * s * 0.07;
        ctx.strokeStyle = "#2f8fd8"; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(hx, hip - s * 0.02); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.ellipse(fx + (asleep ? d : dir) * s * 0.025, fy, s * 0.075, s * 0.045, 0, 0, TAU); ctx.fill();
      }
      // far arm (behind the tunic), tunic, belt
      const arm = (d, front) => {
        const sw = walk ? Math.sin(ph + (d > 0 ? 0 : Math.PI)) : 0, ax = x + d * s * 0.13, ay = sh + s * 0.05;
        let hx2 = ax + d * s * 0.1 + sw * s * 0.08 * (dir || 0), hy2 = ay + s * 0.2 - Math.abs(sw) * s * 0.03;
        if (asleep) { hx2 = ax + d * s * 0.05; hy2 = ay + s * 0.2; }
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
