/* Inside your house: a cozy room in your world's colours, today's decoration shop, your box of stored
 * things, and a decorate mode (tap a thing, drag it to move, turn it or put it away).
 * The server side is lib/decor.js; the catalog and fit check are shared/decor.js (LivingTownDecor).
 * The room borrows the home plot's top display, bottom bar and pop-up (public/homestead.js opens it). */
(function () {
  "use strict";
  const DC = window.LivingTownDecor;
  const R = DC.ROOM, BY = DC.BY_ID;
  // Art styles for Hazel to pick from: A soft clay, B storybook (ink lines), C cozy pixel. ?roomstyle=b to preview.
  const STYLES = { a: "clay", b: "story", c: "pixel" };
  let STYLE = "clay";
  try { STYLE = STYLES[new URLSearchParams(location.search).get("roomstyle")] || STYLE; } catch { /* fine */ }

  const PAL = {
    clay: { wall: "#f4e7d4", wall2: "#ead6bb", trim: "#c99c6e", floor: "#dcb88e", floor2: "#cfa97d", side: "#e3ccad", wood: "#b9875a", fabric: "#ec8f7c", fabric2: "#8cc5d8", accent: "#f6c95b", leaf: "#6fb27a", metal: "#c9c2b8", pot: "#d9825b", ink: "#5a3d2b", sky: ["#a9dcff", "#e6f5ff"], sun: true, dark: 0 },
    scifi: { wall: "#3d3470", wall2: "#4a3f86", trim: "#5ef2d6", floor: "#2c2d4d", floor2: "#35375e", side: "#2a2450", wood: "#7b7fb0", fabric: "#ff7ab8", fabric2: "#5ef2d6", accent: "#ffd84a", leaf: "#7fe0a0", metal: "#b8c0e0", pot: "#8a7fd0", ink: "#140f2e", sky: ["#120a2e", "#3a1f5e"], stars: true, dark: 0.18 },
    castle: { wall: "#ece6f6", wall2: "#dcd2ee", trim: "#b9a3d9", floor: "#f5ecf3", floor2: "#e2d2ea", side: "#d6cbe8", wood: "#c49a6c", fabric: "#f29ac0", fabric2: "#9ec9f2", accent: "#ffd36b", leaf: "#7cc48a", metal: "#d4d8e4", pot: "#c98fb5", ink: "#4a3a66", sky: ["#a8d8ff", "#fff0fb"], sun: true, dark: 0 },
    night: { wall: "#3e4d3c", wall2: "#334132", trim: "#6b5236", floor: "#5a4532", floor2: "#4e3b2b", side: "#2d3a2c", wood: "#8a6440", fabric: "#c58ad6", fabric2: "#7fb2d9", accent: "#ffe08a", leaf: "#5fa06a", metal: "#9aa5a0", pot: "#9a6a4a", ink: "#151a14", sky: ["#0d1838", "#22305e"], moon: true, dark: 0.34 },
    pirate: { wall: "#5d4232", wall2: "#4b3527", trim: "#2e2018", floor: "#6b4c33", floor2: "#5c412b", side: "#3c2a1e", wood: "#8b5e3c", fabric: "#c94f4f", fabric2: "#e8c66a", accent: "#ffd36b", leaf: "#5c9a5e", metal: "#b7a88a", pot: "#7a5236", ink: "#120c08", sky: ["#0b1530", "#1d3158"], moon: true, sea: true, dark: 0.34 }
  };

  // --- colour helpers ---
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, k) => { const x = hexRgb(a), y = hexRgb(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
  const dark = (c, k) => mix(c, "#000000", k), light = (c, k) => mix(c, "#ffffff", k);

  function rr(c, x, y, w, h, r) {
    c.beginPath(); r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (!r) { c.rect(x, y, w, h); return; }
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // fill the current path in the chosen style: soft light on top (clay), an ink line (storybook) or flat (pixel)
  function fill(g, col, y0, y1, glow = 0.2) {
    const c = g.c;
    if (g.style === "clay" && y1 > y0) { const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, light(col, glow)); gr.addColorStop(1, col); c.fillStyle = gr; } else c.fillStyle = col;
    c.fill();
    if (g.style === "story") { c.lineWidth = Math.max(1, g.T * 0.045); c.lineJoin = "round"; c.strokeStyle = g.pal.ink; c.stroke(); }
  }
  const radius = (g, k = 0.14) => g.style === "pixel" ? 0 : g.style === "story" ? g.T * 0.06 : g.T * k;

  // --- the room's screen layout: tiles across, a squashed floor, heights going up ---
  function layout(cw, top, bottom, scale = 1, cap = 48) {
    const K = 0.64, wallH = 2.5, side = 0.42, slab = 0.3;
    const T = Math.min(cap, (cw - 16) / (R.w + side * 2), (bottom - top) / (wallH + R.d * K + slab + 0.2)) * scale;
    const roomH = (wallH + R.d * K + slab) * T, y0 = top * scale + Math.max(0, ((bottom - top) * scale - roomH) / 2);
    return { T, K, Z: T * 0.85, wallH, side, slab, ox: (cw * scale - R.w * T) / 2, fy: y0 + wallH * T, y0 };
  }
  const sx = (g, x) => g.ox + x * g.T, sy = (g, y) => g.fy + y * g.T * g.K;

  // local spot (u along the thing, v from its back) to room tiles, for each quarter turn
  function toRoom(it, d, u, v) {
    const r = it.rot || 0, x = it.x, y = it.y;
    return r === 1 ? [x + d.h - v, y + u] : r === 2 ? [x + d.w - u, y + d.h - v] : r === 3 ? [x + v, y + d.w - u] : [x + u, y + v];
  }
  // A thing is drawn from parts: boxes, cylinders, balls, flat shapes and little custom touches.
  function maker(g, it, d) {
    const parts = [];
    const rect = (u0, v0, u1, v1) => { const [ax, ay] = toRoom(it, d, u0, v0), [bx, by] = toRoom(it, d, u1, v1); return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]; };
    const P = {
      box(u0, v0, u1, v1, z, h, col, o = {}) {
        const [x0, y0, x1, y1] = rect(u0, v0, u1, v1);
        parts.push({ z, f: y1, draw: () => {
          const c = g.c, X0 = sx(g, x0), X1 = sx(g, x1), Yb = sy(g, y0), Yf = sy(g, y1), top = (z + h) * g.Z, bot = z * g.Z, r = o.r ?? radius(g, 0.1);
          rr(c, X0, Yb - top, X1 - X0, (Yf - Yb) + (top - bot), r); fill(g, dark(col, 0.2), Yf - top, Yf - bot, 0.05);
          rr(c, X0, Yb - top, X1 - X0, Yf - Yb, r); fill(g, o.top || col, Yb - top, Yf - top);
          o.front?.(c, X0, Yf - top, X1, Yf - bot); o.deco?.(c, X0, Yb - top, X1, Yf - top);
        } });
      },
      cyl(u, v, rad, z, h, col, o = {}) {
        const [x, y] = toRoom(it, d, u, v);
        parts.push({ z, f: y + rad, draw: () => {
          const c = g.c, X = sx(g, x), Y = sy(g, y), rx = rad * g.T, ry = rad * g.T * g.K, top = (z + h) * g.Z, bot = z * g.Z;
          c.beginPath(); c.ellipse(X, Y - bot, rx, ry, 0, 0, Math.PI); c.lineTo(X - rx, Y - top); c.ellipse(X, Y - top, rx, ry, 0, Math.PI, 0, true); c.closePath(); fill(g, dark(col, 0.18), Y - top, Y - bot, 0.05);
          c.beginPath(); c.ellipse(X, Y - top, rx, ry, 0, 0, Math.PI * 2); fill(g, o.top || col, Y - top - ry, Y - top + ry);
        } });
      },
      ball(u, v, z, rad, col, o = {}) {
        const [x, y] = toRoom(it, d, u, v);
        parts.push({ z: z + (o.lift || 0), f: y, draw: () => {
          const c = g.c, X = sx(g, x), r = rad * g.T, Y = sy(g, y) - z * g.Z - r * (o.sq || 1);
          c.beginPath(); c.ellipse(X, Y, r, r * (o.sq || 1), 0, 0, Math.PI * 2);
          if (g.style === "clay") { const gr = c.createRadialGradient(X - r * 0.35, Y - r * 0.4, r * 0.1, X, Y, r); gr.addColorStop(0, light(col, 0.35)); gr.addColorStop(1, col); c.fillStyle = gr; c.fill(); }
          else fill(g, col, Y, Y);
        } });
      },
      flat(u0, v0, u1, v1, col, o = {}) {
        const [x0, y0, x1, y1] = rect(u0, v0, u1, v1);
        parts.push({ z: o.z ?? -1, f: y0, draw: () => {
          const c = g.c, X0 = sx(g, x0), X1 = sx(g, x1), Y0 = sy(g, y0), Y1 = sy(g, y1);
          if (o.round) { c.beginPath(); c.ellipse((X0 + X1) / 2, (Y0 + Y1) / 2, (X1 - X0) / 2, (Y1 - Y0) / 2, 0, 0, Math.PI * 2); } else rr(c, X0, Y0, X1 - X0, Y1 - Y0, radius(g, 0.12));
          fill(g, col, Y0, Y1, 0.12);
        } });
      },
      poly(pts, col, z = -0.5) {   // a flat shape on the floor, points in local tiles
        const rp = pts.map(([u, v]) => toRoom(it, d, u, v));
        parts.push({ z, f: 0, draw: () => { const c = g.c; c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, sx(g, x), sy(g, y))); c.closePath(); fill(g, col, 0, 0); } });
      },
      at(u, v, z, fn, zk = z) {   // a custom touch drawn at a spot: fn(ctx, x, y, tileSize)
        const [x, y] = toRoom(it, d, u, v);
        parts.push({ z: zk, f: y, draw: () => fn(g.c, sx(g, x), sy(g, y) - z * g.Z, g.T) });
      }
    };
    P.parts = parts; return P;
  }

  // --- how each thing looks (u across, v from the back, in tiles; z and h are heights) ---
  const ART = {
    chair(P, p) { P.box(0.18, 0.12, 0.82, 0.28, 0, 1.0, dark(p.wood, 0.08)); P.box(0.18, 0.22, 0.82, 0.86, 0, 0.45, p.wood); },
    armchair(P, p) { P.box(0.08, 0.06, 0.92, 0.34, 0, 1.0, dark(p.fabric, 0.06)); P.box(0.08, 0.25, 0.92, 0.92, 0, 0.42, p.fabric); P.box(0.04, 0.2, 0.24, 0.92, 0, 0.62, p.fabric); P.box(0.76, 0.2, 0.96, 0.92, 0, 0.62, p.fabric); P.box(0.24, 0.35, 0.76, 0.85, 0.42, 0.1, light(p.fabric, 0.2)); },
    sofa(P, p) {
      P.box(0.04, 0.04, 2.96, 0.38, 0, 0.95, dark(p.fabric2, 0.08)); P.box(0.04, 0.3, 2.96, 0.94, 0, 0.4, p.fabric2);
      [0.25, 1.05, 1.85].forEach(u => P.box(u, 0.36, u + 0.9, 0.88, 0.4, 0.12, light(p.fabric2, 0.18)));
      P.box(0, 0.22, 0.24, 0.96, 0, 0.62, p.fabric2); P.box(2.76, 0.22, 3, 0.96, 0, 0.62, p.fabric2);
      P.ball(0.6, 0.42, 0.62, 0.17, p.accent, { lift: 0.2 });
    },
    stool(P, p) { P.cyl(0.5, 0.5, 0.08, 0, 0.5, dark(p.wood, 0.1)); P.cyl(0.5, 0.5, 0.38, 0.5, 0.08, p.wood); P.cyl(0.5, 0.48, 0.1, 0.58, 0.1, "#ffffff"); P.at(0.62, 0.48, 0.66, (c, x, y, T) => { c.strokeStyle = "#ffffff"; c.lineWidth = T * 0.04; c.beginPath(); c.arc(x, y, T * 0.05, -1.2, 1.2); c.stroke(); }, 0.7); },
    plant(P, p) { P.cyl(0.5, 0.55, 0.24, 0, 0.42, p.pot); P.ball(0.5, 0.55, 0.42, 0.28, p.leaf); P.ball(0.34, 0.5, 0.6, 0.18, light(p.leaf, 0.12)); P.ball(0.66, 0.52, 0.66, 0.18, dark(p.leaf, 0.06)); P.ball(0.5, 0.48, 0.8, 0.16, light(p.leaf, 0.2)); },
    bigplant(P, p) { P.cyl(0.5, 0.58, 0.28, 0, 0.5, light(p.pot, 0.1)); [[0.5, 0.55, 0.5, 0.3], [0.3, 0.5, 0.85, 0.22], [0.7, 0.55, 0.9, 0.22], [0.45, 0.45, 1.2, 0.22], [0.6, 0.5, 1.45, 0.18]].forEach(([u, v, z, r], i) => P.ball(u, v, z, r, i % 2 ? dark(p.leaf, 0.12) : p.leaf)); },
    sunpot(P, p) { P.cyl(0.5, 0.58, 0.22, 0, 0.38, p.pot); P.box(0.47, 0.55, 0.53, 0.6, 0.38, 0.65, p.leaf, { r: 0 }); P.ball(0.32, 0.58, 0.6, 0.1, p.leaf); P.ball(0.5, 0.56, 0.95, 0.24, "#ffcf3a"); P.ball(0.5, 0.56, 1.03, 0.11, "#8a5a2b", { lift: 0.1 }); },
    teddy(P, p) { const b = "#c08850"; P.ball(0.5, 0.6, 0, 0.3, b); P.ball(0.5, 0.62, 0.12, 0.15, light(b, 0.35), { lift: 0.1 }); P.ball(0.5, 0.58, 0.55, 0.22, b, { lift: 0.2 }); P.ball(0.32, 0.56, 0.88, 0.08, b, { lift: 0.1 }); P.ball(0.68, 0.56, 0.88, 0.08, b, { lift: 0.1 }); P.at(0.5, 0.6, 0.76, (c, x, y, T) => { c.fillStyle = "#2a1a10"; [-0.07, 0.07].forEach(k => { c.beginPath(); c.arc(x + k * T, y, T * 0.025, 0, 7); c.fill(); }); c.beginPath(); c.arc(x, y + T * 0.06, T * 0.03, 0, 7); c.fill(); }, 2); },
    lamp(P, p) { P.cyl(0.5, 0.55, 0.2, 0, 0.05, p.metal); P.box(0.47, 0.53, 0.53, 0.58, 0.05, 1.3, dark(p.metal, 0.2), { r: 0 }); P.cyl(0.5, 0.55, 0.28, 1.25, 0.32, "#fff3d0"); },
    beanbag(P, p) { P.ball(0.5, 0.62, 0, 0.42, p.fabric, { sq: 0.75 }); P.ball(0.45, 0.5, 0.25, 0.2, light(p.fabric, 0.18), { sq: 0.7, lift: 0.1 }); },
    toybox(P, p) { P.box(0.08, 0.2, 0.92, 0.9, 0, 0.55, p.fabric2, { front: (c, x0, y0, x1, y1) => { c.fillStyle = p.accent; const s = (y1 - y0) * 0.35; c.beginPath(); c.arc((x0 + x1) / 2, (y0 + y1) / 2, s, 0, 7); c.fill(); } }); P.ball(0.32, 0.45, 0.5, 0.15, "#ff6b6b"); P.ball(0.66, 0.5, 0.52, 0.12, "#4fc3a1"); P.box(0.4, 0.3, 0.62, 0.5, 0.55, 0.22, p.accent); },
    dresser(P, p) { P.box(0.05, 0.2, 1.95, 0.9, 0, 0.95, p.wood, { front: (c, x0, y0, x1, y1) => { c.strokeStyle = dark(p.wood, 0.35); c.lineWidth = Math.max(1, (y1 - y0) * 0.03); for (let i = 1; i < 3; i++) { const y = y0 + (y1 - y0) * i / 3; c.beginPath(); c.moveTo(x0 + 3, y); c.lineTo(x1 - 3, y); c.stroke(); } c.fillStyle = p.accent; for (let i = 0; i < 3; i++) { const y = y0 + (y1 - y0) * (i + 0.5) / 3; c.beginPath(); c.arc((x0 + x1) / 2, y, (y1 - y0) * 0.05, 0, 7); c.fill(); } } }); P.ball(1.5, 0.45, 0.95, 0.12, p.fabric); },
    desk(P, p) { P.box(0.08, 0.2, 0.2, 0.9, 0, 0.7, dark(p.wood, 0.1)); P.box(1.3, 0.2, 1.92, 0.9, 0, 0.7, p.wood); P.box(0.05, 0.15, 1.95, 0.92, 0.7, 0.08, light(p.wood, 0.08)); P.box(0.5, 0.35, 1.0, 0.7, 0.78, 0.02, "#ffffff"); P.box(1.2, 0.4, 1.6, 0.46, 0.78, 0.04, p.accent, { r: 0 }); },
    books(P, p) { P.box(0.05, 0.35, 1.95, 0.95, 0, 1.75, p.wood, { front: (c, x0, y0, x1, y1) => { const cols = [p.fabric, p.fabric2, p.accent, p.leaf, light(p.fabric, 0.3)]; const rows = 3, rh = (y1 - y0) / rows; for (let r = 0; r < rows; r++) { let x = x0 + 4; c.fillStyle = dark(p.wood, 0.3); c.fillRect(x0 + 2, y0 + r * rh + 2, x1 - x0 - 4, rh - 4); let i = r; while (x < x1 - 8) { const w = 3 + (i * 7 % 4); c.fillStyle = cols[i % cols.length]; c.fillRect(x, y0 + r * rh + rh * (0.25 + (i % 3) * 0.06), w, rh * (0.7 - (i % 3) * 0.06) - 2); x += w + 1; i++; } } } }); },
    table(P, p) { [[0.25, 0.3], [1.75, 0.3], [0.25, 1.75], [1.75, 1.75]].forEach(([u, v]) => P.box(u - 0.06, v - 0.06, u + 0.06, v + 0.06, 0, 0.66, dark(p.wood, 0.15), { r: 0 })); P.box(0.12, 0.15, 1.88, 1.88, 0.66, 0.1, p.wood); P.cyl(0.6, 0.7, 0.2, 0.76, 0.02, "#ffffff"); P.cyl(1.4, 1.2, 0.2, 0.76, 0.02, "#ffffff"); P.ball(1.0, 0.95, 0.78, 0.16, p.fabric); },
    bed(P, p, canopy) {
      P.box(0.05, 0, 1.95, 0.2, 0, 1.0, dark(p.wood, 0.05)); P.box(0.05, 0.1, 1.95, 2.95, 0, 0.35, p.wood);
      P.box(0.12, 0.2, 1.88, 2.88, 0.35, 0.12, "#fbf6ee"); P.box(0.3, 0.3, 1.7, 0.85, 0.47, 0.12, "#ffffff");
      P.box(0.08, 1.05, 1.92, 2.92, 0.38, 0.14, canopy ? "#f29ac0" : p.fabric, { deco: (c, x0, y0, x1, y1) => { c.fillStyle = "#ffffff55"; for (let i = 0; i < 3; i++) c.fillRect(x0, y0 + (y1 - y0) * (0.2 + i * 0.28), x1 - x0, (y1 - y0) * 0.08); } });
    },
    bunk(P, p) {
      ART.bed(P, p); [[0.08, 0.15], [1.92, 0.15], [0.08, 2.85], [1.92, 2.85]].forEach(([u, v]) => P.box(u - 0.06, v - 0.06, u + 0.06, v + 0.06, 0, 1.75, dark(p.wood, 0.1), { r: 0 }));
      P.box(0.05, 0.1, 1.95, 2.9, 1.3, 0.14, p.wood); P.box(0.1, 1.0, 1.9, 2.88, 1.44, 0.12, p.fabric2); P.box(0.3, 0.2, 1.7, 0.8, 1.44, 0.12, "#ffffff");
      P.at(1.95, 2.0, 0, (c, x, y, T) => { c.strokeStyle = light(p.wood, 0.1); c.lineWidth = T * 0.06; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - T * 1.3); c.moveTo(x + T * 0.18, y); c.lineTo(x + T * 0.18, y - T * 1.3); for (let i = 1; i < 5; i++) { c.moveTo(x, y - i * T * 0.26); c.lineTo(x + T * 0.18, y - i * T * 0.26); } c.stroke(); }, 3);
    },
    canopy(P, p) {
      ART.bed(P, p, true); [[0.08, 0.1], [1.92, 0.1], [0.08, 2.9], [1.92, 2.9]].forEach(([u, v]) => P.box(u - 0.05, v - 0.05, u + 0.05, v + 0.05, 0, 2.0, "#f6d77a", { r: 0 }));
      P.at(1, 2.9, 2.0, (c, x, y, T) => { c.fillStyle = "#ffffffaa"; c.beginPath(); c.moveTo(x - T, y); for (let i = 0; i <= 4; i++) c.quadraticCurveTo(x - T + (i - 0.5) * T / 2, y + T * 0.25, x - T + i * T / 2, y); c.lineTo(x + T, y - T * 1.8); c.lineTo(x - T, y - T * 1.8); c.closePath(); c.fill(); c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(x, y - T * 0.95, T * 0.14, 0, 7); c.fill(); }, 5);
    },
    telescope(P, p) { P.at(0.5, 0.6, 0, (c, x, y, T) => { c.strokeStyle = dark(p.wood, 0.2); c.lineWidth = T * 0.06; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y - T * 0.75); c.lineTo(x - T * 0.3, y); c.moveTo(x, y - T * 0.75); c.lineTo(x + T * 0.3, y); c.moveTo(x, y - T * 0.75); c.lineTo(x, y + T * 0.05); c.stroke(); c.save(); c.translate(x, y - T * 0.8); c.rotate(-0.6); rr(c, -T * 0.45, -T * 0.11, T * 0.9, T * 0.22, T * 0.08); c.fillStyle = p.metal; c.fill(); c.fillStyle = p.accent; c.fillRect(-T * 0.05, -T * 0.12, T * 0.1, T * 0.24); c.restore(); }); },
    tank(P, p) {
      P.box(0.05, 0.25, 1.95, 0.92, 0, 0.5, p.wood); P.box(0.1, 0.3, 1.9, 0.88, 0.5, 0.72, "#9fdcf2", { r: 2, front: (c, x0, y0, x1, y1) => {
        const t = performance.now() / 1000; c.fillStyle = "#4fa8d8"; c.fillRect(x0 + 2, y0 + (y1 - y0) * 0.15, x1 - x0 - 4, (y1 - y0) * 0.85 - 2);
        c.fillStyle = "#6fc47a"; for (let i = 0; i < 4; i++) { const x = x0 + (x1 - x0) * (0.15 + i * 0.23); c.beginPath(); c.ellipse(x, y1 - 4, 2.5, (y1 - y0) * 0.35, Math.sin(t + i) * 0.2, 0, 7); c.fill(); }
        [["#ffa23a", 0], ["#ff6b9a", 2.1], ["#ffe14a", 4.2]].forEach(([col, ph]) => { const k = (Math.sin(t * 0.6 + ph) + 1) / 2, x = x0 + 8 + (x1 - x0 - 16) * k, y = y0 + (y1 - y0) * (0.35 + 0.15 * Math.sin(ph + t)); const dir = Math.cos(t * 0.6 + ph) > 0 ? 1 : -1, q = Math.max(1.5, (y1 - y0) * 0.09); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, q * 1.6, q, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - dir * q * 1.2, y); c.lineTo(x - dir * q * 2.5, y - q); c.lineTo(x - dir * q * 2.5, y + q); c.fill(); });
      } });
    },
    piano(P, p) { const b = "#3a2a2e"; P.box(0.05, 0.1, 1.95, 0.55, 0, 1.25, b); P.box(0.05, 0.45, 1.95, 0.95, 0, 0.72, b); P.box(0.12, 0.52, 1.88, 0.8, 0.72, 0.04, "#ffffff", { r: 0, deco: (c, x0, y0, x1, y1) => { c.fillStyle = "#1a1214"; const n = 14, w = (x1 - x0) / n; for (let i = 0; i < n; i++) if (![2, 6, 9, 13].includes(i)) c.fillRect(x0 + i * w + w * 0.6, y0, w * 0.6, (y1 - y0) * 0.6); } }); P.box(0.7, 0.98, 1.3, 1.0, 0, 0.42, dark(b, 0.2)); },
    horse(P, p) { P.at(0.5, 0.65, 0, (c, x, y, T) => { c.strokeStyle = dark(p.wood, 0.25); c.lineWidth = T * 0.08; c.lineCap = "round"; c.beginPath(); c.arc(x, y - T * 0.9, T * 0.95, Math.PI * 0.35, Math.PI * 0.65); c.stroke(); }); P.box(0.38, 0.45, 0.42, 0.6, 0, 0.45, p.wood, { r: 0 }); P.box(0.58, 0.45, 0.62, 0.6, 0, 0.45, p.wood, { r: 0 }); P.ball(0.5, 0.55, 0.42, 0.25, "#f5f0e6", { sq: 0.7 }); P.ball(0.5, 0.45, 0.72, 0.15, "#f5f0e6", { lift: 0.3 }); P.ball(0.5, 0.42, 0.92, 0.07, p.fabric, { lift: 0.4 }); },
    robot(P, p) { P.box(0.25, 0.4, 0.75, 0.8, 0, 0.6, p.metal); P.box(0.3, 0.42, 0.7, 0.78, 0.62, 0.32, light(p.metal, 0.1), { front: (c, x0, y0, x1, y1) => { c.fillStyle = "#5ef2d6"; [0.33, 0.67].forEach(k => { c.beginPath(); c.arc(x0 + (x1 - x0) * k, (y0 + y1) / 2, (y1 - y0) * 0.16, 0, 7); c.fill(); }); } }); P.ball(0.5, 0.6, 1.0, 0.07, "#ff7ab8"); },
    spacelamp(P, p) { P.cyl(0.5, 0.55, 0.22, 0, 0.12, p.metal); P.ball(0.5, 0.55, 0.15, 0.3, "#c38bff"); P.at(0.5, 0.55, 0.45, (c, x, y, T) => { c.strokeStyle = "#ffd84a"; c.lineWidth = T * 0.05; c.beginPath(); c.ellipse(x, y, T * 0.45, T * 0.1, -0.25, 0, 7); c.stroke(); }, 1); },
    armour(P, p) { P.cyl(0.5, 0.6, 0.3, 0, 0.08, dark(p.wood, 0.1)); P.box(0.38, 0.5, 0.48, 0.65, 0.08, 0.6, p.metal, { r: 1 }); P.box(0.52, 0.5, 0.62, 0.65, 0.08, 0.6, p.metal, { r: 1 }); P.box(0.28, 0.45, 0.72, 0.7, 0.68, 0.55, light(p.metal, 0.08)); P.ball(0.5, 0.55, 1.22, 0.17, p.metal); P.ball(0.5, 0.5, 1.48, 0.08, p.fabric, { lift: 0.2 }); },
    shroom(P, p) { P.cyl(0.5, 0.6, 0.12, 0, 0.55, "#f3ead2"); P.ball(0.5, 0.58, 0.45, 0.36, "#7fd6ff", { sq: 0.55 }); P.at(0.5, 0.58, 0.68, (c, x, y, T) => { c.fillStyle = "#ffffffcc"; [[-0.15, 0], [0.12, -0.05], [0, 0.07]].forEach(([a, b]) => { c.beginPath(); c.arc(x + a * T, y + b * T, T * 0.05, 0, 7); c.fill(); }); }, 2); },
    lantern(P, p) { P.cyl(0.5, 0.6, 0.2, 0, 0.5, "#d9f2ff"); P.cyl(0.5, 0.6, 0.2, 0.5, 0.08, p.wood); P.at(0.5, 0.6, 0.25, (c, x, y, T) => { const t = performance.now() / 600; c.fillStyle = "#fff59a"; for (let i = 0; i < 4; i++) { c.globalAlpha = 0.5 + 0.5 * Math.sin(t + i * 1.7); c.beginPath(); c.arc(x + Math.sin(t * 0.7 + i * 2) * T * 0.1, y + Math.cos(t * 0.9 + i) * T * 0.12, T * 0.035, 0, 7); c.fill(); } c.globalAlpha = 1; }, 1); },
    chest(P, p) { P.box(0.1, 0.25, 1.9, 0.9, 0, 0.5, p.wood, { front: (c, x0, y0, x1, y1) => { c.fillStyle = p.accent; c.fillRect(x0 + (x1 - x0) * 0.2, y0, 4, y1 - y0); c.fillRect(x1 - (x1 - x0) * 0.2 - 4, y0, 4, y1 - y0); c.fillRect((x0 + x1) / 2 - 5, y0 + 2, 10, 9); } }); P.box(0.1, 0.25, 1.9, 0.9, 0.5, 0.18, dark(p.wood, 0.08), { r: radius({ style: STYLE, T: 30 }, 0.3) }); P.ball(0.5, 0.3, 0.68, 0.1, p.accent); P.ball(0.75, 0.3, 0.7, 0.08, light(p.accent, 0.3)); },
    globe(P, p) { P.cyl(0.5, 0.6, 0.18, 0, 0.3, "#f6d77a"); P.ball(0.5, 0.6, 0.3, 0.3, "#5b5fe0"); P.at(0.5, 0.6, 0.6, (c, x, y, T) => { const t = performance.now() / 900; c.fillStyle = "#ffffff"; for (let i = 0; i < 5; i++) { c.globalAlpha = 0.6 + 0.4 * Math.sin(t + i); c.beginPath(); c.arc(x + Math.cos(t * 0.5 + i * 1.3) * T * 0.17, y + Math.sin(i * 2.1) * T * 0.15, T * 0.03, 0, 7); c.fill(); } c.globalAlpha = 1; }, 2); },
    // rugs
    rug_round(P, p) { P.flat(0.1, 0.1, 1.9, 1.9, p.fabric2, { round: true }); P.flat(0.45, 0.45, 1.55, 1.55, light(p.fabric2, 0.3), { round: true, z: -0.9 }); },
    rug_stripe(P, p) { P.flat(0.05, 0.1, 2.95, 1.9, p.fabric); [0.45, 0.95, 1.45].forEach((v, i) => P.flat(0.05, v, 2.95, v + 0.25, i === 1 ? p.accent : light(p.fabric, 0.4), { z: -0.9 })); },
    rug_star(P, p) { P.flat(0.1, 0.1, 2.9, 2.9, dark(p.fabric2, 0.1), { round: true }); const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.55 : 1.25; pts.push([1.5 + Math.cos(a) * r, 1.5 + Math.sin(a) * r]); } P.poly(pts, p.accent, -0.9); },
    rainbow(P) { ["#ff6b6b", "#ffb547", "#ffe14a", "#6fd17a", "#64b5f6", "#c38bff"].forEach((col, i) => P.flat(0.05 + i * 0.22, 0.05 + i * 0.22, 2.95 - i * 0.22, 2.95 - i * 0.22, col, { round: true, z: -1 + i * 0.01 })); }
  };
  // things on the back wall: drawn in their slot (x0..x1 across, y the middle of the wall)
  const WALL = {
    pic_flower(c, g, x0, x1, y) { framePic(c, g, x0 + g.T * 0.12, y - g.T * 0.38, x1 - x0 - g.T * 0.24, g.T * 0.76, "#fff8e8", (X, Y, W, H) => { c.fillStyle = g.pal.leaf; c.fillRect(X + W / 2 - 1, Y + H * 0.45, 2, H * 0.5); c.fillStyle = g.pal.fabric; for (let i = 0; i < 5; i++) { const a = i * 1.256; c.beginPath(); c.arc(X + W / 2 + Math.cos(a) * W * 0.16, Y + H * 0.38 + Math.sin(a) * W * 0.16, W * 0.12, 0, 7); c.fill(); } c.fillStyle = g.pal.accent; c.beginPath(); c.arc(X + W / 2, Y + H * 0.38, W * 0.1, 0, 7); c.fill(); }); },
    pic_sun(c, g, x0, x1, y) { framePic(c, g, x0 + g.T * 0.15, y - g.T * 0.4, x1 - x0 - g.T * 0.3, g.T * 0.8, "#bfe6ff", (X, Y, W, H) => { c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(X + W * 0.7, Y + H * 0.4, H * 0.18, 0, 7); c.fill(); c.fillStyle = "#7cc48a"; c.beginPath(); c.moveTo(X, Y + H); c.quadraticCurveTo(X + W * 0.3, Y + H * 0.45, X + W * 0.6, Y + H); c.fill(); c.fillStyle = "#5fa06a"; c.beginPath(); c.moveTo(X + W * 0.35, Y + H); c.quadraticCurveTo(X + W * 0.75, Y + H * 0.55, X + W, Y + H); c.fill(); }); },
    clock(c, g, x0, x1, y) { const X = (x0 + x1) / 2, r = g.T * 0.34; c.beginPath(); c.arc(X, y, r, 0, 7); fill(g, g.pal.wood, y - r, y + r); c.beginPath(); c.arc(X, y, r * 0.8, 0, 7); fill(g, "#fffaf0", y - r, y + r, 0); const d = new Date(), h = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * 7 - 1.57, m = d.getMinutes() / 60 * 6.283 - 1.57; c.strokeStyle = "#333"; c.lineWidth = Math.max(1, g.T * 0.04); c.lineCap = "round"; c.beginPath(); c.moveTo(X, y); c.lineTo(X + Math.cos(h) * r * 0.42, y + Math.sin(h) * r * 0.42); c.moveTo(X, y); c.lineTo(X + Math.cos(m) * r * 0.65, y + Math.sin(m) * r * 0.65); c.stroke(); },
    shelf(c, g, x0, x1, y) { const p = g.pal, T = g.T; rr(c, x0 + T * 0.1, y + T * 0.2, x1 - x0 - T * 0.2, T * 0.14, radius(g, 0.05)); fill(g, p.wood, y + T * 0.2, y + T * 0.34); [[0.3, p.fabric, 0.5], [0.45, p.fabric2, 0.42], [0.58, p.accent, 0.48]].forEach(([k, col, h]) => { rr(c, x0 + T * k, y + T * (0.2 - h), T * 0.12, T * h, 0); fill(g, col, 0, 0); }); c.beginPath(); c.arc(x1 - T * 0.55, y + T * 0.06, T * 0.14, 0, 7); fill(g, p.pot, 0, 0); c.beginPath(); c.arc(x1 - T * 0.55, y - T * 0.12, T * 0.16, 0, 7); fill(g, p.leaf, 0, 0); },
    flags(c, g, x0, x1, y) { const T = g.T, cols = [g.pal.fabric, g.pal.accent, g.pal.fabric2, g.pal.leaf]; c.strokeStyle = g.pal.ink; c.lineWidth = Math.max(1, T * 0.03); c.beginPath(); c.moveTo(x0 + 2, y - T * 0.4); c.quadraticCurveTo((x0 + x1) / 2, y - T * 0.1, x1 - 2, y - T * 0.4); c.stroke(); const n = 6; for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, X = x0 + (x1 - x0) * k, Y = y - T * 0.4 + Math.sin(k * Math.PI) * T * 0.15; c.beginPath(); c.moveTo(X - T * 0.13, Y); c.lineTo(X + T * 0.13, Y); c.lineTo(X, Y + T * 0.34); c.closePath(); fill(g, cols[i % 4], Y, Y + T * 0.3); } },
    banner(c, g, x0, x1, y) { const T = g.T, X = (x0 + x1) / 2; c.beginPath(); c.moveTo(X - T * 0.3, y - T * 0.6); c.lineTo(X + T * 0.3, y - T * 0.6); c.lineTo(X + T * 0.3, y + T * 0.45); c.lineTo(X, y + T * 0.25); c.lineTo(X - T * 0.3, y + T * 0.45); c.closePath(); fill(g, g.pal.fabric, y - T * 0.6, y + T * 0.4); c.fillStyle = g.pal.accent; c.beginPath(); c.arc(X, y - T * 0.12, T * 0.13, 0, 7); c.fill(); rr(c, X - T * 0.38, y - T * 0.66, T * 0.76, T * 0.08, 2); fill(g, g.pal.wood, 0, 0); },
    wheel(c, g, x0, x1, y) { const T = g.T, X = (x0 + x1) / 2, r = T * 0.6; c.strokeStyle = g.pal.wood; c.lineWidth = T * 0.09; c.lineCap = "round"; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(X, y); c.lineTo(X + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15); } c.stroke(); c.lineWidth = T * 0.11; c.beginPath(); c.arc(X, y, r * 0.8, 0, 7); c.stroke(); c.beginPath(); c.arc(X, y, T * 0.12, 0, 7); fill(g, g.pal.accent, 0, 0); }
  };
  function framePic(c, g, x, y, w, h, bg, inner) {
    rr(c, x, y, w, h, radius(g, 0.06)); fill(g, g.pal.wood, y, y + h);
    const b = Math.max(2, g.T * 0.07); c.save(); rr(c, x + b, y + b, w - 2 * b, h - 2 * b, 0); c.fillStyle = bg; c.fill(); c.clip(); inner(x + b, y + b, w - 2 * b, h - 2 * b); c.restore();
  }

  // --- the room itself: walls, window, door, floor ---
  function drawShell(g, t) {
    const c = g.c, p = g.pal, T = g.T, X0 = g.ox, X1 = g.ox + R.w * T, top = g.fy - g.wallH * T, F1 = sy(g, R.d), s = g.side * T, slab = g.slab * T;
    // side walls and the floor's edge, like looking into a doll's house
    c.beginPath(); c.moveTo(X0 - s, top - s * 0.5); c.lineTo(X0, top); c.lineTo(X0, F1); c.lineTo(X0 - s, F1 + slab); c.closePath(); fill(g, p.side, top, F1);
    c.beginPath(); c.moveTo(X1 + s, top - s * 0.5); c.lineTo(X1, top); c.lineTo(X1, F1); c.lineTo(X1 + s, F1 + slab); c.closePath(); fill(g, dark(p.side, 0.08), top, F1);
    rr(c, X0 - s, F1, X1 - X0 + 2 * s, slab, radius(g, 0.12)); fill(g, dark(p.floor, 0.35), F1, F1 + slab);
    // back wall
    c.fillStyle = p.wall; c.fillRect(X0, top, X1 - X0, g.wallH * T);
    const w = g.world;
    c.save(); c.beginPath(); c.rect(X0, top, X1 - X0, g.wallH * T); c.clip();
    if (w === "clay") { c.fillStyle = dark(p.wall, 0.05); for (let y = top + T * 0.3; y < g.fy - T * 0.8; y += T * 0.42) for (let x = X0 + ((y / T * 2.4 | 0) % 2) * T * 0.25 + T * 0.12; x < X1; x += T * 0.5) { c.beginPath(); c.arc(x, y, T * 0.04, 0, 7); c.fill(); } c.fillStyle = p.wall2; c.fillRect(X0, g.fy - T * 0.8, X1 - X0, T * 0.8); c.fillStyle = p.trim; c.fillRect(X0, g.fy - T * 0.84, X1 - X0, T * 0.06); }
    if (w === "scifi") { c.strokeStyle = p.wall2; c.lineWidth = 2; for (let x = X0; x < X1; x += T * 1.5) { c.strokeRect(x + 3, top + 3, T * 1.5 - 6, g.wallH * T - 6); } c.fillStyle = p.trim; c.globalAlpha = 0.6 + 0.3 * Math.sin(t / 700); c.fillRect(X0, g.fy - T * 0.5, X1 - X0, 2); c.globalAlpha = 1; }
    if (w === "castle") { c.strokeStyle = p.wall2; c.lineWidth = Math.max(1, T * 0.04); for (let r = 0, y = top; y < g.fy; r++, y += T * 0.5) { c.beginPath(); c.moveTo(X0, y); c.lineTo(X1, y); c.stroke(); for (let x = X0 + (r % 2) * T * 0.5; x < X1; x += T) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + T * 0.5); c.stroke(); } } }
    if (w === "night") { for (let y = top, i = 0; y < g.fy; y += T * 0.42, i++) { c.fillStyle = i % 2 ? p.wall2 : p.wall; rr(c, X0 - 4, y, X1 - X0 + 8, T * 0.4, T * 0.2); c.fill(); } }
    if (w === "pirate") { for (let x = X0, i = 0; x < X1; x += T * 0.6, i++) { c.fillStyle = i % 2 ? p.wall2 : p.wall; c.fillRect(x, top, T * 0.58, g.wallH * T); c.fillStyle = dark(p.wall, 0.3); c.beginPath(); c.arc(x + T * 0.3, top + T * 0.3, 1.5, 0, 7); c.arc(x + T * 0.3, g.fy - T * 0.3, 1.5, 0, 7); c.fill(); } }
    c.restore();
    c.fillStyle = dark(p.wall, 0.18); c.fillRect(X0, g.fy - T * 0.12, X1 - X0, T * 0.12);   // skirting board
    rr(c, X0 - s, top - s * 0.5 - T * 0.1, X1 - X0 + 2 * s, T * 0.16, 2); c.fillStyle = p.trim; c.fill();   // top trim
    // floor
    c.save(); c.beginPath(); c.rect(X0, g.fy, X1 - X0, F1 - g.fy); c.clip();
    c.fillStyle = p.floor; c.fillRect(X0, g.fy, X1 - X0, F1 - g.fy);
    for (let y = 0; y < R.d; y++) for (let x = 0; x < R.w; x++) {
      const odd = w === "castle" || w === "scifi" ? (x + y) % 2 : y % 2;
      if (w === "castle" || w === "scifi") { if (odd) { c.fillStyle = p.floor2; c.fillRect(sx(g, x), sy(g, y), T, T * g.K); } }
      else { c.fillStyle = (y + (x + y * 3) % 4) % 3 ? p.floor : p.floor2; const off = (y % 2) * T * 0.5; c.fillRect(sx(g, x) + off, sy(g, y), T * (x === R.w - 1 ? 0.5 : 1), T * g.K); c.fillStyle = dark(p.floor, 0.18); c.fillRect(sx(g, x) + off, sy(g, y), 1, T * g.K); }
    }
    if (w !== "castle" && w !== "scifi") { c.fillStyle = dark(p.floor, 0.18); for (let y = 0; y <= R.d; y++) c.fillRect(X0, sy(g, y), X1 - X0, 1); }
    if (w === "scifi") { c.strokeStyle = p.trim + "55"; c.lineWidth = 1; for (let x = 0; x <= R.w; x += 3) { c.beginPath(); c.moveTo(sx(g, x), g.fy); c.lineTo(sx(g, x), F1); c.stroke(); } }
    // a soft shadow along the back wall
    const sh = c.createLinearGradient(0, g.fy, 0, g.fy + T * 0.6); sh.addColorStop(0, "rgba(0,0,0,0.18)"); sh.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = sh; c.fillRect(X0, g.fy, X1 - X0, T * 0.6);
    c.restore();
    // the window
    const [wx, ww] = R.window, WX = sx(g, wx) + T * 0.18, WW = ww * T - T * 0.36, WY = g.fy - g.wallH * T + T * 0.45, WH = T * 1.25;
    rr(c, WX - 4, WY - 4, WW + 8, WH + 8, radius(g, 0.1)); fill(g, w === "pirate" ? p.wood : light(p.trim, 0.2), WY, WY + WH);
    c.save(); rr(c, WX, WY, WW, WH, w === "castle" || w === "night" ? WW / 2 : radius(g, 0.06)); c.clip();
    const sk = c.createLinearGradient(0, WY, 0, WY + WH); sk.addColorStop(0, p.sky[0]); sk.addColorStop(1, p.sky[1]); c.fillStyle = sk; c.fillRect(WX, WY, WW, WH);
    if (p.sun) { c.fillStyle = "#ffe27a"; c.beginPath(); c.arc(WX + WW * 0.72, WY + WH * 0.32, T * 0.2, 0, 7); c.fill(); c.fillStyle = "#ffffffdd"; [[0.3, 0.55], [0.48, 0.5]].forEach(([a, b]) => { c.beginPath(); c.arc(WX + WW * a, WY + WH * b, T * 0.15, 0, 7); c.fill(); }); }
    if (p.stars || p.moon) { c.fillStyle = "#fff"; for (let i = 0; i < 9; i++) { c.globalAlpha = 0.5 + 0.5 * Math.sin(t / 500 + i * 2); c.fillRect(WX + (i * 37 % 100) / 100 * WW, WY + (i * 53 % 70) / 100 * WH, 1.6, 1.6); } c.globalAlpha = 1; }
    if (p.moon) { c.fillStyle = "#fff6cf"; c.beginPath(); c.arc(WX + WW * 0.7, WY + WH * 0.3, T * 0.18, 0, 7); c.fill(); }
    if (g.world === "scifi") { c.fillStyle = "#ffb3e0"; c.beginPath(); c.arc(WX + WW * 0.3, WY + WH * 0.35, T * 0.2, 0, 7); c.fill(); c.fillStyle = "#b5e3ff"; c.beginPath(); c.arc(WX + WW * 0.72, WY + WH * 0.55, T * 0.1, 0, 7); c.fill(); }
    if (p.sea) { c.fillStyle = "#1c3f6e"; c.fillRect(WX, WY + WH * 0.68, WW, WH); c.fillStyle = "#fff6cf55"; c.fillRect(WX + WW * 0.6, WY + WH * 0.72, WW * 0.2, 2); }
    c.restore();
    c.fillStyle = w === "pirate" ? p.wood : light(p.trim, 0.2); c.fillRect(WX + WW / 2 - 1.5, WY, 3, WH); c.fillRect(WX, WY + WH / 2 - 1.5, WW, 3);
    // curtains
    [[WX - T * 0.22, 1], [WX + WW + T * 0.22, -1]].forEach(([x, k]) => { c.beginPath(); c.moveTo(x, WY - T * 0.15); c.lineTo(x + k * T * 0.42, WY - T * 0.15); c.quadraticCurveTo(x + k * T * 0.12, WY + WH * 0.5, x + k * T * 0.3, WY + WH + T * 0.2); c.lineTo(x, WY + WH + T * 0.2); c.closePath(); fill(g, p.fabric, WY, WY + WH); });
    // the door (out to the garden)
    const [dx, dw] = R.door, DX = sx(g, dx) + T * 0.3, DW = dw * T - T * 0.6, DH = T * 1.85, DY = g.fy - DH;
    c.beginPath(); if (w === "castle" || w === "night") { c.moveTo(DX - 3, g.fy); c.lineTo(DX - 3, DY + DW / 2); c.arc(DX + DW / 2, DY + DW / 2, DW / 2 + 3, Math.PI, 0); c.lineTo(DX + DW + 3, g.fy); c.closePath(); } else rr(c, DX - 3, DY - 3, DW + 6, DH + 3, radius(g, 0.08));
    fill(g, dark(p.wood, 0.25), DY, g.fy);
    c.beginPath(); if (w === "castle" || w === "night") { c.moveTo(DX, g.fy); c.lineTo(DX, DY + DW / 2); c.arc(DX + DW / 2, DY + DW / 2, DW / 2, Math.PI, 0); c.lineTo(DX + DW, g.fy); c.closePath(); } else rr(c, DX, DY, DW, DH, radius(g, 0.06));
    fill(g, w === "scifi" ? "#6c63b5" : p.wood, DY, g.fy);
    c.fillStyle = dark(w === "scifi" ? "#6c63b5" : p.wood, 0.15); c.fillRect(DX + DW * 0.15, DY + DH * 0.3, DW * 0.7, 2); c.fillRect(DX + DW * 0.15, DY + DH * 0.62, DW * 0.7, 2);
    c.fillStyle = p.accent; c.beginPath(); c.arc(DX + DW * 0.82, DY + DH * 0.55, T * 0.06, 0, 7); c.fill();
    // doormat
    const m = R.mat; rr(c, sx(g, m.x) + T * 0.2, sy(g, m.y) + T * 0.1, m.w * T - T * 0.4, m.h * T * g.K - T * 0.12, radius(g, 0.1)); fill(g, w === "scifi" ? "#5ef2d644" : "#8a6a4a", 0, 0);
  }

  // --- drawing a whole scene: shell, rugs, wall things, then furniture and people back to front ---
  function drawItem(g, it) {
    const d = BY[it.id]; if (!d) return;
    if (d.kind === "wall") { const fn = WALL[d.id]; if (fn) fn(g.c, g, sx(g, it.x), sx(g, it.x + d.w), g.fy - g.wallH * g.T * 0.42); return; }
    const art = ART[d.id]; if (!art) return;
    const P = maker(g, it, d); art(P, g.pal);
    if (d.kind === "floor") {   // a soft shadow under it
      const f = DC.footprint(d, it.rot || 0), c = g.c; c.fillStyle = "rgba(0,0,0,0.13)";
      rr(c, sx(g, it.x) + g.T * 0.06, sy(g, it.y) + g.T * g.K * 0.25, f.w * g.T - g.T * 0.12, f.h * g.T * g.K - g.T * g.K * 0.15, g.T * 0.2); c.fill();
    }
    P.parts.sort((a, b) => a.z - b.z || a.f - b.f).forEach(pt => pt.draw());
  }
  function drawScene(g, scene, t) {
    drawShell(g, t);
    const items = scene.items || [];
    for (const it of items) if (BY[it.id]?.kind === "rug") drawItem(g, it);
    for (const it of items) if (BY[it.id]?.kind === "wall") drawItem(g, it);
    const stand = items.filter(it => BY[it.id]?.kind === "floor").map(it => ({ y: it.y + DC.footprint(BY[it.id], it.rot || 0).h, x: it.x, draw: () => drawItem(g, it) }));
    if (scene.person) stand.push({ y: scene.person.y + 0.3, x: scene.person.x, draw: () => drawPerson(g, scene.person) });
    stand.sort((a, b) => a.y - b.y || a.x - b.x).forEach(s => s.draw());
    // night worlds: the room is dim, and lamps, mushrooms and the moon glow
    if (g.pal.dark) {
      const c = g.c, top = g.fy - g.wallH * g.T - g.T, bot = sy(g, R.d) + g.slab * g.T;
      c.fillStyle = `rgba(8,12,40,${g.pal.dark})`; c.fillRect(g.ox - g.side * g.T, top, (R.w + 2 * g.side) * g.T, bot - top);
      c.save(); c.globalCompositeOperation = "lighter";
      const glow = (x, y, r, col) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); };
      glow(sx(g, R.window[0] + 1), g.fy - g.T * 1.2, g.T * 2.4, "rgba(120,150,255,0.22)"); glow(sx(g, R.w / 2), sy(g, R.d * 0.45), g.T * 5, "rgba(255,190,120,0.16)");
      for (const it of items) { const d = BY[it.id]; if (!d?.glow) continue; const f = DC.footprint(d, it.rot || 0); glow(sx(g, it.x + f.w / 2), sy(g, it.y + f.h / 2) - g.T * 0.9, g.T * 2.2, d.id === "shroom" ? "rgba(110,210,255,0.35)" : d.id === "robot" || d.id === "spacelamp" ? "rgba(200,140,255,0.32)" : "rgba(255,200,110,0.38)"); }
      c.restore();
    }
  }
  function drawPerson(g, p) {
    const w = p.sheet?.w, img = p.sheet?.img; const c = g.c, X = sx(g, p.x), Y = sy(g, p.y);
    c.fillStyle = "rgba(0,0,0,0.16)"; c.beginPath(); c.ellipse(X, Y, g.T * 0.32, g.T * 0.12, 0, 0, 7); c.fill();
    if (!w || !img) return;
    const k = g.T * 1.7 / 135, f = p.moving ? Math.floor(p.step * 2.2) % 4 : (img.width >= w.cw * 5 ? 4 : 0);
    c.drawImage(img, f * w.cw, p.dir * w.ch, w.cw, w.ch, X - w.ax * k, Y - w.ay * k, w.cw * k, w.ch * k);
  }
  // Pixel style: draw small, then blow it up with crisp edges.
  let low = null;
  function render(c, cw, ch, opts, scene, t) {
    if (opts.style !== "pixel") { const g = { c, style: opts.style, pal: PAL[opts.world] || PAL.clay, world: opts.world, ...layout(cw, opts.top, opts.bottom, 1, opts.cap) }; drawScene(g, scene, t); return g; }
    const k = 0.34; low ||= document.createElement("canvas");
    const lw = Math.ceil(cw * k), lh = Math.ceil(ch * k); if (low.width !== lw || low.height !== lh) { low.width = lw; low.height = lh; }
    const lc = low.getContext("2d"); lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, lw, lh); lc.imageSmoothingEnabled = false;
    const gl = { c: lc, style: "pixel", pal: PAL[opts.world] || PAL.clay, world: opts.world, ...layout(cw, opts.top, opts.bottom, k, opts.cap) };
    drawScene(gl, scene, t);
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(low, 0, 0, lw, lh, 0, 0, lw / k, lh / k); c.restore();
    return { c, style: "pixel", pal: gl.pal, world: opts.world, ...layout(cw, opts.top, opts.bottom, 1, opts.cap) };
  }

  // ===================== the live room =====================
  let host = null, isOpen = false, canvas = null, ctx = null, G = null, mode = "look", sel = null, drag = null, items = [], barKind = "idle", fx = [], lastT = 0;
  const me = { x: 1, y: 0.8, dir: 0, step: 0, moving: false, path: [] };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const V = () => host?.view()?.decor || { stock: [], storage: [], room: [] };
  const stars = () => host?.view()?.stars ?? 0;

  function open(h) {
    host = h; isOpen = true; mode = "look"; sel = null; drag = null; fx = [];
    if (!canvas) {
      canvas = document.createElement("canvas"); canvas.className = "house-room";
      canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", () => { drag = null; });
      ctx = canvas.getContext("2d");
    }
    host.el.insertBefore(canvas, host.top); canvas.classList.remove("hidden");
    Object.assign(me, { x: 1, y: 0.8, dir: 0, path: [], moving: false });
    items = V().room.map(x => ({ ...x }));
    idle(); requestAnimationFrame(frame);
  }
  function close(silent) {
    if (!isOpen) return; isOpen = false; hideRing(); canvas?.classList.add("hidden");
    if (!silent) host?.onClose?.();
  }
  function onState(view, result) {
    if (!isOpen) return;
    if (!drag) items = (view?.decor?.room || []).map(x => ({ ...x }));
    if (sel && !items.some(i => i.uid === sel)) { sel = null; hideRing(); }
    if (result?.decorBought) { host.sfx?.coin(); puff(BY[result.decorBought.id]?.emoji || "✨"); }
    if (result?.decorPlaced) { host.sfx?.pop(); sel = result.decorPlaced; showRing(); }
    if (result && result.ok === false && sel) showRing();
    refreshBar();
  }
  function refreshBar() { ({ idle, shop, stored, decorate })[barKind]?.(); }

  // --- the bottom bar ---
  const count = id => [...V().storage, ...items].filter(x => x.id === id).length;
  function idle() {
    barKind = "idle"; mode = "look"; sel = null; hideRing();
    const n = V().storage.length;
    host.setBar("", [{ label: "🛋️ Decorate", big: n > 0, go: decorate }, { label: "🛒 Shop", big: !n && !items.length, go: shop }, { label: "📦 Stored", badge: n ? String(n) : "", go: stored }, { label: "↩️ Back", go: () => close() }], "home-dock");
  }
  function shop() {
    barKind = "shop"; mode = "look"; sel = null; hideRing();
    const st = stars();
    host.setBar(`<span class="home-goals"><span class="home-head"><b>🛒 Today’s shop</b><small>You have ${st}⭐ · new things tomorrow</small></span></span>`,
      [...V().stock.map(s => { const d = BY[s.id], have = count(s.id); return { label: `${d.rare ? "✨" : d.emoji} ${esc(d.name)} ${s.soldOut ? "<small>sold out</small>" : `${d.price}⭐`}${have ? ` <small>×${have}</small>` : ""}`, off: s.soldOut || st < d.price, go: () => host.act("decorBuy", { item: s.id }) }; }),
        { label: "Back", go: idle }], "wide");
  }
  // stored things grouped by kind, as buttons in the panel's scrolling part (tap one to put it out)
  function pickList() {
    const groups = new Map(), w = host.world();
    for (const s of V().storage) { const g = groups.get(s.id) || { id: s.id, uids: [] }; g.uids.push(s.uid); groups.set(s.id, g); }
    return [...groups.values()].map(g => { const d = BY[g.id], here = DC.inWorld(d, w); return `<button data-pick="${g.uids[0]}" ${here ? "" : "disabled"}>${d.emoji} ${esc(d.name)}${g.uids.length > 1 ? ` <small>×${g.uids.length}</small>` : ""}${here ? "" : " <small>🌍 other world</small>"}</button>`; }).join("");
  }
  function wirePicks() { host.bar.querySelectorAll("[data-pick]").forEach(b => { b.onclick = () => putOut(Number(b.dataset.pick)); }); }
  function stored() {
    barKind = "stored"; mode = "look"; sel = null; hideRing();
    const list = pickList();
    if (!list) return host.setBar("📦 Your box is empty. Buy something in the shop!", [{ label: "🛒 Shop", big: true, go: shop }, { label: "Back", go: idle }]);
    host.setBar(`<span class="home-head"><b>📦 Stored</b><small>Tap one to put it out</small></span><div class="home-actions wide room-picks">${list}</div>`, [{ label: "Back", go: idle }]);
    wirePicks();
  }
  function decorate() {
    barKind = "decorate"; mode = "decorate";
    const list = pickList();
    host.setBar(`<span class="home-head"><b>🛋️ Decorate</b><small>Drag things to move them</small></span>${list ? `<div class="home-actions wide room-picks">${list}</div>` : `<span>Tap a thing to turn it or put it away.</span>`}`,
      [...(list ? [] : [{ label: "🛒 Shop", go: shop }]), { label: "Back", go: idle }]);
    wirePicks();
    if (sel) showRing();
  }
  function putOut(uid) {
    const s = V().storage.find(x => x.uid === uid); if (!s) return;
    const spot = DC.freeSpot(items, s.id);
    if (!spot) return host.toast("No room! Put something away first.");
    if (barKind !== "decorate") decorate();
    host.act("decorPlace", { uid, x: spot.x, y: spot.y, rot: spot.rot });
  }

  // --- the ring of buttons on the thing you picked ---
  function showRing() {
    const it = items.find(i => i.uid === sel); if (!it || !G) return hideRing();
    const d = BY[it.id], b = boxOf(it), pop = host.pop;
    pop.className = "home-pop room-ring";
    pop.innerHTML = `<p class="home-title">${d.emoji} ${esc(d.name)}</p><div class="home-actions"><button data-k="turn" ${d.kind === "wall" ? "disabled" : ""}>↻ Turn</button><button data-k="store">📦 Store</button><button data-k="done">Done</button></div>`;
    pop.querySelector('[data-k="turn"]').onclick = e => { e.stopPropagation(); host.act("decorRotate", { uid: it.uid }); host.sfx?.pop(); };
    pop.querySelector('[data-k="store"]').onclick = e => { e.stopPropagation(); host.act("decorStore", { uid: it.uid }); sel = null; hideRing(); };
    pop.querySelector('[data-k="done"]').onclick = e => { e.stopPropagation(); sel = null; hideRing(); };
    const W = host.el.clientWidth, w = pop.offsetWidth, h = pop.offsetHeight, barTop = host.bar.offsetTop;
    const x = Math.max(8, Math.min(W - w - 8, (b.x0 + b.x1) / 2 - w / 2));
    let y = b.y1 + 12; if (y + h > barTop - 8) y = Math.max(56, b.y0 - h - 10);   // under the thing, nearer your thumb, if there's room
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }
  function hideRing() { const pop = host?.pop; if (pop && pop.classList.contains("room-ring")) { pop.className = "home-pop hidden"; pop.innerHTML = ""; } }

  // --- tapping and dragging ---
  const TALL = { bed: 1, bunk: 1.9, canopy: 2.1, books: 1.8, piano: 1.3, lamp: 1.6, bigplant: 1.7, sunpot: 1.3, armour: 1.6, sofa: 1, chair: 1, armchair: 1 };
  function boxOf(it) {
    const d = BY[it.id];
    if (d.kind === "wall") { const y = G.fy - G.wallH * G.T * 0.42; return { x0: sx(G, it.x), x1: sx(G, it.x + d.w), y0: y - G.T * 0.65, y1: y + G.T * 0.65 }; }
    const f = DC.footprint(d, it.rot || 0), tall = d.kind === "rug" ? 0 : (TALL[d.id] || 0.9);
    return { x0: sx(G, it.x), x1: sx(G, it.x + f.w), y0: sy(G, it.y) - tall * G.Z, y1: sy(G, it.y + f.h) };
  }
  function itemAt(px, py) {
    // front things first, then wall things, rugs last
    const order = [...items].sort((a, b) => { const ka = BY[a.id].kind, kb = BY[b.id].kind, rank = k => k === "floor" ? 0 : k === "wall" ? 1 : 2; return rank(ka) - rank(kb) || (b.y + DC.footprint(BY[b.id], b.rot || 0).h) - (a.y + DC.footprint(BY[a.id], a.rot || 0).h); });
    return order.find(it => { const b = boxOf(it); return px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1; }) || null;
  }
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const tileAt = (px, py) => [(px - G.ox) / G.T, (py - G.fy) / (G.T * G.K)];
  function onDown(e) {
    if (!G) return; const [px, py] = local(e), it = itemAt(px, py);
    if (mode === "decorate" && it) {
      const [tx, ty] = tileAt(px, py); sel = it.uid; hideRing();
      drag = { uid: it.uid, id: it.id, dx: tx - it.x, dy: ty - it.y, from: [it.x, it.y], px, py, moved: false, ok: true };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* a pretend finger (the test bot) */ }
    } else drag = { tap: true, px, py, it };
  }
  function onMove(e) {
    if (!drag || drag.tap) return; const [px, py] = local(e);
    if (!drag.moved && Math.hypot(px - drag.px, py - drag.py) < 6) return;
    drag.moved = true; const it = items.find(i => i.uid === drag.uid); if (!it) return;
    const [tx, ty] = tileAt(px, py), d = BY[it.id];
    it.x = Math.round(tx - drag.dx); it.y = d.kind === "wall" ? 0 : Math.round(ty - drag.dy);
    const f = DC.footprint(d, it.rot || 0); it.x = Math.max(0, Math.min(R.w - f.w, it.x)); if (d.kind !== "wall") it.y = Math.max(0, Math.min(R.d - f.h, it.y));
    drag.ok = DC.fits(items, it.id, it.x, it.y, it.rot || 0, it.uid);
  }
  function onUp(e) {
    const dr = drag; drag = null; if (!dr || !G) return;
    if (dr.tap) return tap(dr);
    const it = items.find(i => i.uid === dr.uid); if (!it) return;
    if (!dr.moved) return showRing();
    if (dr.ok && (it.x !== dr.from[0] || it.y !== dr.from[1])) { host.act("decorMove", { uid: it.uid, x: it.x, y: it.y }); host.sfx?.plant?.(); }
    else if (!dr.ok) { [it.x, it.y] = dr.from; host.toast("It doesn't fit there."); }
    showRing();
    void e;
  }
  function tap(dr) {
    const [tx, ty] = tileAt(dr.px, dr.py);
    if (mode === "decorate") { sel = null; hideRing(); return; }
    // the door: walk out to the garden
    if (dr.py < G.fy && dr.py > G.fy - G.T * 1.9 && tx >= R.door[0] && tx < R.door[0] + R.door[1]) { walkTo(1, 0, () => close()); return; }
    if (dr.it) { const d = BY[dr.it.id]; float(`${d.emoji} ${d.name}`); host.sfx?.pop(); return; }
    if (tx >= 0 && tx < R.w && ty >= 0 && ty < R.d) walkTo(Math.floor(tx), Math.floor(ty));
  }
  // walk tile to tile around the furniture
  function walkTo(gx, gy, then) {
    const block = new Set(); for (const it of items) { const d = BY[it.id]; if (d.kind !== "floor") continue; const f = DC.footprint(d, it.rot || 0); for (let x = it.x; x < it.x + f.w; x++) for (let y = it.y; y < it.y + f.h; y++) block.add(x + "," + y); }
    const start = [Math.max(0, Math.min(R.w - 1, Math.floor(me.x))), Math.max(0, Math.min(R.d - 1, Math.floor(me.y)))], key = (x, y) => x + "," + y;
    if (block.has(key(gx, gy))) return;
    const prev = new Map([[key(...start), null]]), q = [start];
    while (q.length) { const [x, y] = q.shift(); if (x === gx && y === gy) break; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay, k = key(nx, ny); if (nx < 0 || ny < 0 || nx >= R.w || ny >= R.d || block.has(k) || prev.has(k)) continue; prev.set(k, [x, y]); q.push([nx, ny]); } }
    if (!prev.has(key(gx, gy))) return;
    const path = []; for (let c = [gx, gy]; c && key(...c) !== key(...start); c = prev.get(key(...c))) path.unshift({ x: c[0] + 0.5, y: c[1] + 0.55 });
    if (!path.length) path.push({ x: gx + 0.5, y: gy + 0.55 });
    me.path = path; me.then = then || null;
  }
  function step(dt) {
    let budget = 3.4 * dt; me.moving = false;
    while (budget > 0 && me.path.length) {
      const n = me.path[0], gap = Math.hypot(n.x - me.x, n.y - me.y);
      if (gap > 0.01) { const dx = n.x - me.x, dy = (n.y - me.y) * G.K, k = ((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) % 8) + 8) % 8; me.dir = [0, 7, 6, 5, 4, 3, 2, 1][k]; me.moving = true; }
      if (gap <= budget) { me.x = n.x; me.y = n.y; budget -= gap; me.path.shift(); } else { me.x += (n.x - me.x) / gap * budget; me.y += (n.y - me.y) / gap * budget; budget = 0; }
    }
    if (me.moving) me.step += dt * 4;
    else if (me.then) { const go = me.then; me.then = null; go(); }
  }
  function float(text) { fx.push({ text, at: performance.now(), x: sx(G, me.x), y: sy(G, me.y) - G.T * 2.6 }); }
  function puff(emoji) { fx.push({ text: emoji, big: true, at: performance.now(), x: host.el.clientWidth / 2, y: G ? G.fy - G.T : 200 }); }

  function frame(t) {
    if (!isOpen) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1), cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pal = PAL[host.world()] || PAL.clay;
      ctx.fillStyle = mix(pal.side, "#000000", 0.55); ctx.fillRect(0, 0, cw, ch);
      if (G) step(dt);
      const sheet = host.person?.();
      G = render(ctx, cw, ch, { style: STYLE, world: host.world(), top: 64, bottom: host.bar.offsetTop - 8 }, { items, person: { ...me, sheet } }, t);
      // decorate mode: the tiles, the picked thing glowing, and green or red where it's going
      if (mode === "decorate") {
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
        for (let x = 0; x <= R.w; x++) { ctx.beginPath(); ctx.moveTo(sx(G, x), G.fy); ctx.lineTo(sx(G, x), sy(G, R.d)); ctx.stroke(); }
        for (let y = 0; y <= R.d; y++) { ctx.beginPath(); ctx.moveTo(G.ox, sy(G, y)); ctx.lineTo(sx(G, R.w), sy(G, y)); ctx.stroke(); }
        const it = items.find(i => i.uid === sel);
        if (it) {
          const d = BY[it.id], f = DC.footprint(d, it.rot || 0), ok = !drag || drag.ok, pulse = 0.6 + 0.4 * Math.sin(t / 180);
          ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = ok ? `rgba(255,236,120,${pulse})` : "rgba(255,90,90,0.95)"; ctx.fillStyle = ok ? "rgba(79,195,161,0.22)" : "rgba(255,90,90,0.25)";
          ctx.shadowColor = ok ? "#ffe27a" : "#ff5a5a"; ctx.shadowBlur = 12;
          if (d.kind === "wall") { const b = boxOf(it); rr(ctx, b.x0 + 2, b.y0, b.x1 - b.x0 - 4, b.y1 - b.y0, 8); }
          else rr(ctx, sx(G, it.x) + 1, sy(G, it.y) + 1, f.w * G.T - 2, f.h * G.T * G.K - 2, 6);
          ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      fx = fx.filter(f => t - f.at < 1400);
      for (const f of fx) { const k = (t - f.at) / 1400; ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = "center"; ctx.font = f.big ? `${40 + 20 * k}px system-ui` : "800 16px system-ui"; if (!f.big) { ctx.lineWidth = 4; ctx.strokeStyle = "#000a"; ctx.strokeText(f.text, f.x, f.y - k * 40); ctx.fillStyle = "#fff"; } ctx.fillText(f.text, f.x, f.y - k * 60); ctx.globalAlpha = 1; }
      const topHtml = `<b>🏠 Inside</b><span class="home-right"><span class="home-stars">⭐ ${stars()}</span></span>`;
      if (host.top.dataset.html !== topHtml) { host.top.innerHTML = topHtml; host.top.dataset.html = topHtml; }
    } catch (err) { console.error(err); }
  }

  /** Draw a still room into any canvas (for the style picker picture). */
  function paint(cv, { style = "clay", world = "clay", items: list = [], person = null } = {}) {
    const c = cv.getContext("2d"); c.setTransform(1, 0, 0, 1, 0, 0); const pal = PAL[world] || PAL.clay;
    c.fillStyle = mix(pal.side, "#000000", 0.55); c.fillRect(0, 0, cv.width, cv.height);
    render(c, cv.width, cv.height, { style, world, top: 8, bottom: cv.height - 8, cap: 400 }, { items: list, person }, 0);
  }

  window.LivingTownRoom = {
    open, close, onState, paint, STYLES,
    get isOpen() { return isOpen; },
    _test: { items: () => items, sel: () => sel, mode: () => mode, me, screenOf: (x, y) => G ? [sx(G, x), sy(G, y)] : null, boxOf: uid => { const it = items.find(i => i.uid === uid); return it && G ? boxOf(it) : null } }
  };
})();
