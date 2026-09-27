/**
 * Pixel-art house interiors, drawn in code from the floor plans in
 * shared/interiors.js. Exposes `LivingTownRooms` for client.js.
 *
 * Everything is drawn at one canvas pixel per plan pixel; client.js scales
 * it up with smoothing off. The static room (floors, walls, furniture) is
 * drawn once per plan and time of day; lighting is a separate overlay so
 * lamps can switch on and off without redrawing the room.
 */
(function (root) {
  "use strict";
  const { WALL, frontDoorRect } = root.LivingTownInteriors;
  const OUTLINE = "#2a1d18";

  function shade(hex, amount) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    const f = c => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // Small deterministic random numbers, so a room always looks the same.
  function seeded(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function painter(g) {
    const px = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    // A box with a dark outline, a lighter top edge and a darker bottom edge.
    const box = (x, y, w, h, color, { outline = OUTLINE, light = 0.1, dark = -0.12 } = {}) => {
      px(x, y, w, h, outline);
      px(x + 1, y + 1, w - 2, h - 2, color);
      if (light) px(x + 1, y + 1, w - 2, 1, shade(color, light));
      if (dark) px(x + 1, y + h - 2, w - 2, 1, shade(color, dark));
    };
    const shadow = (x, y, w, h) => { g.fillStyle = "rgba(20,10,5,.22)"; g.fillRect(x, y, w, h); };
    return { px, box, shadow };
  }

  // --- Floors and walls ---
  function drawFloor(g, r, rand) {
    const { px } = painter(g);
    const f = { x: r.x, y: r.y + WALL, w: r.w, h: r.h - WALL };
    const base = r.floorColor;
    if (r.floor === "tile") {
      for (let y = f.y; y < f.y + f.h; y += 8) {
        for (let x = f.x; x < f.x + f.w; x += 8) {
          const odd = ((x - f.x) / 8 + (y - f.y) / 8) % 2;
          px(x, y, 8, 8, odd ? shade(base, -0.07) : base);
          px(x, y, 8, 1, shade(base, 0.05));
          px(x, y, 1, 8, shade(base, -0.12));
        }
      }
    } else if (r.floor === "carpet") {
      px(f.x, f.y, f.w, f.h, base);
      for (let i = 0; i < f.w * f.h / 9; i++) {
        px(f.x + Math.floor(rand() * f.w), f.y + Math.floor(rand() * f.h), 1, 1, shade(base, rand() < 0.5 ? -0.05 : 0.04));
      }
    } else {
      // Wooden planks: rows with staggered seams and a little grain.
      for (let y = f.y, row = 0; y < f.y + f.h; y += 5, row++) {
        let x = f.x - Math.floor(rand() * 24);
        while (x < f.x + f.w) {
          const len = 22 + Math.floor(rand() * 18);
          const tone = shade(base, (rand() - 0.5) * 0.08);
          px(Math.max(f.x, x), y, Math.min(len, f.x + f.w - Math.max(f.x, x)), 5, tone);
          px(Math.max(f.x, x), y + 4, Math.min(len, f.x + f.w - Math.max(f.x, x)), 1, shade(base, -0.13));
          if (x + len < f.x + f.w) px(x + len, y, 1, 4, shade(base, -0.16));
          if (rand() < 0.5) px(Math.max(f.x, x) + 4 + Math.floor(rand() * 12), y + 2, 3, 1, shade(tone, -0.06));
          x += len + 1;
        }
      }
    }
    // Soft shadow where the floor meets the back wall and the left wall.
    g.fillStyle = "rgba(20,10,5,.18)";
    g.fillRect(f.x, f.y, f.w, 3);
    g.fillRect(f.x, f.y, 2, f.h);
  }

  function drawWallFace(g, r, rand) {
    const { px } = painter(g);
    const { x, y, w } = r;
    const base = r.wall;
    px(x, y, w, WALL, base);
    // Slightly darker near the ceiling.
    px(x, y, w, 3, shade(base, -0.06));
    switch (r.pattern) {
      case "stripes": for (let i = x + 2; i < x + w; i += 6) px(i, y + 3, 2, WALL - 5, shade(base, 0.05)); break;
      case "dots": for (let j = y + 4; j < y + WALL - 3; j += 4) for (let i = x + 2 + (j % 8 ? 2 : 0); i < x + w; i += 5) px(i, j, 1, 1, shade(base, 0.12)); break;
      case "stars": for (let i = 0; i < w / 5; i++) { const sx = x + 2 + Math.floor(rand() * (w - 4)), sy = y + 4 + Math.floor(rand() * (WALL - 8)); px(sx, sy, 1, 1, shade(base, 0.25)); if (rand() < 0.3) { px(sx - 1, sy, 3, 1, shade(base, 0.15)); px(sx, sy - 1, 1, 3, shade(base, 0.15)); } } break;
      case "tiles": for (let j = y + 7; j < y + WALL - 2; j += 3) { px(x, j, w, 1, shade(base, -0.08)); for (let i = x + ((j / 3) % 2 ? 0 : 3); i < x + w; i += 6) px(i, j - 3, 1, 3, shade(base, -0.08)); } break;
      case "planks": for (let i = x; i < x + w; i += 7) { px(i, y + 3, 1, WALL - 5, shade(base, -0.12)); px(i + 1, y + 3, 1, WALL - 5, shade(base, 0.05)); } break;
      case "stone": for (let j = y + 3, row = 0; j < y + WALL - 2; j += 4, row++) for (let i = x + (row % 2 ? 4 : 0); i < x + w; i += 9) { px(i, j, 8, 3, shade(base, (rand() - 0.5) * 0.12)); px(i, j + 3, 9, 1, shade(base, -0.18)); } break;
    }
    // Crown molding and baseboard.
    px(x, y, w, 2, r.wallTrim);
    px(x, y + 2, w, 1, shade(r.wallTrim, -0.15));
    px(x, y + WALL - 3, w, 3, r.wallTrim);
    px(x, y + WALL - 3, w, 1, shade(r.wallTrim, 0.12));
  }

  // Walls seen from above: a dark cap along every room edge, then doorways
  // cut through it.
  function drawWallCaps(g, plan) {
    const { px } = painter(g);
    for (const r of plan.rooms) {
      px(r.x, r.y, r.w, 2, "#3a2a20");
      px(r.x, r.y, 2, r.h, "#3a2a20");
      px(r.x + r.w - 2, r.y, 2, r.h, "#3a2a20");
      px(r.x, r.y + r.h - 2, r.w, 2, "#3a2a20");
    }
    // Outer walls are thicker.
    px(0, 0, plan.width, 3, OUTLINE); px(0, 0, 3, plan.height, OUTLINE);
    px(plan.width - 3, 0, 3, plan.height, OUTLINE); px(0, plan.height - 3, plan.width, 3, OUTLINE);
  }

  function roomById(plan, id) { return plan.rooms.find(r => r.id === id); }

  function drawDoorways(g, plan) {
    const { px } = painter(g);
    for (const d of plan.doors) {
      const [a, b] = d.rooms.map(id => roomById(plan, id));
      if (d.wall === "back") {
        const upper = a.y < b.y ? a : b, lower = upper === a ? b : a;
        const seam = lower.y;
        px(d.x, seam - 4, d.w, 4, upper.floorColor);
        px(d.x, seam, d.w, WALL + 4, lower.floorColor);
        // Door frame posts and a threshold strip.
        px(d.x - 2, seam, 2, WALL, shade(lower.wallTrim, -0.2));
        px(d.x + d.w, seam, 2, WALL, shade(lower.wallTrim, -0.2));
        px(d.x - 2, seam, d.w + 4, 2, shade(lower.wallTrim, -0.3));
        px(d.x, seam + WALL - 1, d.w, 1, shade(lower.floorColor, -0.2));
      } else {
        const left = a.x < b.x ? a : b;
        px(d.x, d.y, d.w, d.h, left.floorColor);
        px(d.x, d.y - 2, d.w, 2, "#3a2a20");
        px(d.x, d.y + d.h, d.w, 2, "#3a2a20");
        px(d.x + d.w / 2, d.y, 1, d.h, shade(left.floorColor, -0.18));
      }
    }
    // Front door: a gap in the outer wall with a doormat inside.
    const fd = frontDoorRect(plan);
    px(fd.x, plan.height - 3, fd.w, 3, "#d9c29a");
    px(fd.x - 2, plan.height - 5, 2, 5, "#5b3a24");
    px(fd.x + fd.w, plan.height - 5, 2, 5, "#5b3a24");
    px(fd.x + 1, plan.height - 11, fd.w - 2, 7, "#7a5a3a");
    px(fd.x + 2, plan.height - 10, fd.w - 4, 5, "#9c7a52");
    for (let i = fd.x + 3; i < fd.x + fd.w - 3; i += 2) px(i, plan.height - 9, 1, 3, "#7a5a3a");
  }

  // --- Furniture and decor ---
  const BLANKET_PATTERNS = {
    stars: (px, x, y, w, h, c) => { for (let j = y + 2; j < y + h - 1; j += 4) for (let i = x + 2 + (j % 8 ? 2 : 0); i < x + w - 1; i += 5) px(i, j, 1, 1, shade(c, 0.3)); },
    dots: (px, x, y, w, h, c) => { for (let j = y + 2; j < y + h - 1; j += 3) for (let i = x + 2 + (j % 6 ? 1 : 0); i < x + w - 1; i += 3) px(i, j, 1, 1, shade(c, 0.18)); },
    stripes: (px, x, y, w, h, c) => { for (let j = y + 2; j < y + h - 1; j += 4) px(x + 1, j, w - 2, 1, shade(c, 0.15)); },
    plaid: (px, x, y, w, h, c) => { for (let j = y + 2; j < y + h - 1; j += 4) px(x + 1, j, w - 2, 1, shade(c, -0.12)); for (let i = x + 3; i < x + w - 1; i += 5) px(i, y + 1, 1, h - 2, shade(c, -0.12)); }
  };

  function drawBlanket(g, bed) {
    const { px } = painter(g);
    const c = bed.blanket || "#8ab17d";
    const top = bed.y + 11, h = bed.h - 12;
    px(bed.x + 1, top, bed.w - 2, h, c);
    (BLANKET_PATTERNS[bed.pattern] || (() => {}))(px, bed.x + 1, top, bed.w - 2, h, c);
    px(bed.x + 1, top, bed.w - 2, 2, shade(c, 0.22));
    px(bed.x + 1, top + 2, bed.w - 2, 1, shade(c, -0.1));
    px(bed.x + 1, top + h - 1, bed.w - 2, 1, shade(c, -0.18));
  }

  function drawBed(g, o) {
    const { px, box, shadow } = painter(g);
    shadow(o.x + 2, o.y + o.h - 1, o.w, 2);
    box(o.x, o.y, o.w, o.h, "#7a4e2d");
    // Headboard.
    box(o.x, o.y - 3, o.w, 8, "#8a5a36", { light: 0.14 });
    px(o.x + 2, o.y - 1, o.w - 4, 1, shade("#8a5a36", 0.2));
    // Sheet and pillows.
    px(o.x + 1, o.y + 5, o.w - 2, o.h - 7, "#f4f1ea");
    const pillows = o.double ? [o.x + 3, o.x + o.w / 2 + 1] : [o.x + 3];
    const pw = o.double ? o.w / 2 - 4 : o.w - 6;
    for (const x of pillows) { box(x, o.y + 5, pw, 5, "#ffffff", { outline: "#c9c1b3", light: 0, dark: -0.06 }); }
    drawBlanket(g, o);
    px(o.x, o.y + o.h - 2, o.w, 2, "#5b3a24");
  }

  function drawPicture(g, o) {
    const { px, box } = painter(g);
    box(o.x, o.y, o.w, o.h, "#e8dcc0", { outline: "#6b4226", light: 0 });
    const ix = o.x + 2, iy = o.y + 2, iw = o.w - 4, ih = o.h - 4;
    switch (o.art) {
      case "map": px(ix, iy, iw, ih, "#efe2b8"); px(ix + 1, iy + 2, 4, 1, "#6fa8dc"); px(ix + 3, iy + 1, 1, 3, "#6fa8dc"); px(ix + iw - 4, iy + ih - 3, 3, 2, "#6a994e"); px(ix + iw / 2, iy + ih / 2, 1, 1, "#e63946"); break;
      case "duck": px(ix, iy, iw, ih, "#a8dadc"); px(ix + 2, iy + ih - 3, 5, 2, "#ffd166"); px(ix + 5, iy + ih - 5, 3, 2, "#ffd166"); px(ix + 8, iy + ih - 4, 1, 1, "#f4a261"); break;
      case "kids": px(ix, iy, iw, ih, "#fdfcdc"); px(ix + 2, iy + 1, 2, 2, "#e0ac86"); px(ix + 2, iy + 3, 2, 2, "#a98cff"); px(ix + 5, iy + 2, 2, 2, "#e0ac86"); px(ix + 5, iy + 4, 2, 1, "#f28482"); px(ix + iw - 2, iy, 2, 2, "#ffd166"); break;
      case "painting": px(ix, iy, iw, ih, "#264653"); px(ix, iy + ih / 2, iw, ih / 2, "#2a9d8f"); px(ix + 2, iy + 1, 3, 3, "#e9c46a"); px(ix + iw - 5, iy + 2, 4, 2, "#e76f51"); break;
      case "stars": px(ix, iy, iw, ih, "#1d2951"); [[1, 1], [4, 3], [7, 1], [9, 4], [2, 4]].forEach(([a, b]) => px(ix + a, iy + b, 1, 1, "#fff6c2")); break;
      case "flower": px(ix, iy, iw, ih, "#fbeec1"); px(ix + iw / 2, iy + 2, 1, ih - 2, "#4f9d5a"); px(ix + iw / 2 - 1, iy + 1, 3, 2, "#ff6f91"); break;
      case "bird": px(ix, iy, iw, ih, "#cfe3f0"); px(ix + 3, iy + 2, 4, 2, "#b55b36"); px(ix + 7, iy + 1, 2, 2, "#b55b36"); px(ix + 9, iy + 2, 1, 1, "#f4a261"); px(ix, iy + ih - 1, iw, 1, "#6a994e"); break;
    }
  }

  function drawWindow(g, o, light) {
    const { px, box } = painter(g);
    box(o.x, o.y, o.w, o.h, "#f1e6cc", { outline: "#6b4226", light: 0, dark: 0 });
    const gx = o.x + 2, gy = o.y + 2, gw = o.w - 4, gh = o.h - 4;
    if (light === "night") {
      px(gx, gy, gw, gh, "#1f3354");
      px(gx + gw - 3, gy + 1, 1, 1, "#fff6c2"); px(gx + 2, gy + gh - 2, 1, 1, "#cfd8ff");
    } else if (light === "evening") {
      px(gx, gy, gw, gh, "#f4a261"); px(gx, gy, gw, Math.ceil(gh / 2), "#e76f51"); px(gx + 1, gy + gh - 2, 3, 2, "#ffd166");
    } else {
      px(gx, gy, gw, gh, "#9fd3f0"); px(gx, gy + gh - 2, gw, 2, "#bfe3f5");
      px(gx + 1, gy + 1, 1, 3, "#ffffff"); px(gx + 2, gy + 1, 1, 1, "#ffffff");
    }
    // Window bars and sill.
    px(o.x + Math.floor(o.w / 2), o.y + 1, 1, o.h - 2, "#f1e6cc");
    px(o.x + 1, o.y + Math.floor(o.h / 2), o.w - 2, 1, "#f1e6cc");
    px(o.x - 1, o.y + o.h - 1, o.w + 2, 2, "#d9c7a1");
    if (o.curtains !== false) {
      px(o.x - 2, o.y - 1, 3, o.h + 1, "#c65f5f"); px(o.x + o.w - 1, o.y - 1, 3, o.h + 1, "#c65f5f");
      px(o.x - 2, o.y - 1, 1, o.h + 1, "#a14545"); px(o.x + o.w + 1, o.y - 1, 1, o.h + 1, "#a14545");
    }
    if (o.feeder && light !== "night") { px(o.x + o.w - 5, o.y + o.h - 4, 3, 2, "#b55b36"); px(o.x + o.w - 3, o.y + o.h - 5, 1, 1, "#b55b36"); }
  }

  function drawObject(g, o, plan) {
    const { px, box, shadow } = painter(g);
    const { x, y, w, h } = o;
    switch (o.kind) {
      case "bed": drawBed(g, o); break;
      case "desk":
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y + 5, w, h - 5, "#8a5a36");
        px(x + 1, y + 5, w - 2, 3, "#b07a4a");
        px(x + 2, y + h - 1, 2, 1, OUTLINE); px(x + w - 4, y + h - 1, 2, 1, OUTLINE);
        px(x + 3, y + 6, 6, 3, "#fdfcdc"); px(x + 4, y + 7, 4, 1, "#6fa8dc");
        px(x + 11, y + 7, 3, 1, "#e63946"); px(x + 11, y + 8, 3, 1, "#2a9d8f");
        // Desk lamp.
        px(x + w - 5, y + 2, 1, 5, "#555"); box(x + w - 7, y, 5, 3, "#ffd166", { light: 0.1, dark: 0 });
        box(x + w / 2 - 3, y + h + 1, 7, 6, "#7a4e2d");
        break;
      case "toys":
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y + 3, w, h - 3, "#e76f51");
        px(x + 1, y + 3, w - 2, 2, "#f4a261");
        px(x + 3, y, 4, 4, "#2a9d8f"); px(x + 8, y + 1, 3, 3, "#ffd166"); px(x + 12, y, 3, 4, "#a98cff");
        // Teddy bear beside the box.
        px(x + w + 1, y + 4, 5, 6, "#b07a4a"); px(x + w + 2, y + 1, 3, 3, "#b07a4a"); px(x + w + 1, y + 1, 1, 1, "#b07a4a"); px(x + w + 5, y + 1, 1, 1, "#b07a4a"); px(x + w + 3, y + 2, 1, 1, OUTLINE);
        break;
      case "fridge":
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y, w, h, "#eef2f4", { light: 0.05, dark: -0.1 });
        px(x + 1, y + 9, w - 2, 1, "#b8c4cc");
        px(x + w - 3, y + 3, 1, 4, "#7a8a94"); px(x + w - 3, y + 12, 1, 7, "#7a8a94");
        px(x + 2, y + 3, 2, 2, "#e63946"); px(x + 5, y + 4, 2, 2, "#2a9d8f"); px(x + 3, y + 13, 3, 3, "#ffd166");
        break;
      case "stove":
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y, w, h, "#d7dde2");
        px(x + 1, y + 1, w - 2, 5, "#3a3f44");
        px(x + 2, y + 2, 3, 2, "#6b7278"); px(x + w - 5, y + 2, 3, 2, "#6b7278");
        box(x + 2, y + 7, w - 4, h - 9, "#2f3438", { light: 0.08 });
        px(x + 4, y + 9, w - 8, 2, "#ff9f4a");
        // A pot on the back burner.
        box(x + w - 7, y - 2, 6, 5, "#8d99ae", { light: 0.15 });
        break;
      case "table":
        shadow(x + 2, y + h, w, 2);
        box(x, y, w, h - 3, "#a0643a", { light: 0.14 });
        px(x + 1, y + h - 4, w - 2, 1, "#7a4e2d");
        px(x + 1, y + h - 3, 2, 3, "#5b3a24"); px(x + w - 3, y + h - 3, 2, 3, "#5b3a24");
        px(x + 3, y + 2, w - 6, 1, shade("#a0643a", 0.1));
        break;
      case "sofa": case "armchair": {
        const c = o.color || (o.kind === "armchair" ? "#7a4e3a" : plan.id === "miloHouse" ? "#b5523b" : plan.id === "roseCottage" ? "#9d8189" : "#3f6f74");
        shadow(x + 1, y + h - 1, w + 1, 2);
        box(x, y, w, h, shade(c, -0.1));
        box(x + 3, y + 5, w - 6, h - 7, c, { outline: shade(c, -0.3), light: 0.12 });
        px(x + 1, y + 4, 3, h - 5, shade(c, -0.18)); px(x + w - 4, y + 4, 3, h - 5, shade(c, -0.18));
        if (w > 20) px(x + Math.floor(w / 2), y + 6, 1, h - 8, shade(c, -0.2));
        px(x + 5, y + 2, 5, 3, shade(c, 0.2));
        break;
      }
      case "bookshelf": {
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y, w, h, "#6b4226");
        const colors = ["#e76f51", "#2a9d8f", "#e9c46a", "#8ab17d", "#264653", "#f4a261", "#a98cff", "#d62828"];
        const rows = Math.max(2, Math.floor((h - 3) / 7));
        for (let row = 0; row < rows; row++) {
          const sy = y + 2 + row * 7;
          px(x + 1, sy + 5, w - 2, 1, "#4a2c18");
          let bx = x + 2, i = row * 3;
          while (bx < x + w - 3) {
            const bw = 1 + ((i * 7 + row) % 2), bh = 3 + ((i + row) % 3);
            px(bx, sy + 5 - bh, bw, bh, colors[i % colors.length]);
            bx += bw + 1; i++;
          }
        }
        break;
      }
      case "tv":
        shadow(x - 1, y + h - 1, w + 1, 2);
        box(x, y + 6, w, h - 6, "#7a4e2d");
        box(x + 1, y, w - 2, 12, "#22262b", { outline: "#111", light: 0, dark: 0 });
        px(x + 2, y + 1, w - 4, 10, "#2d3f55"); px(x + 3, y + 2, 2, 1, "#6b88a8");
        px(x + 3, y + 14, 4, 2, "#b8b8c0"); px(x + 8, y + 15, 3, 1, "#e63946");
        break;
      case "rug": {
        const c = plan.id === "miloHouse" ? "#ff6f91" : plan.id === "finnCottage" ? "#64b5f6" : plan.id === "roseCottage" ? "#a8dadc" : "#e9c46a";
        px(x, y, w, h, shade(c, -0.18));
        px(x + 2, y + 2, w - 4, h - 4, c);
        px(x + 4, y + 4, w - 8, h - 8, shade(c, 0.12));
        for (let i = x + 6; i < x + w - 6; i += 6) px(i, y + h / 2 - 1, 3, 2, shade(c, -0.14));
        for (let i = x + 1; i < x + w - 1; i += 2) { px(i, y - 1, 1, 1, shade(c, -0.25)); px(i, y + h, 1, 1, shade(c, -0.25)); }
        break;
      }
      case "easel":
        px(x + 2, y + 4, 1, h - 4, "#7a4e2d"); px(x + w - 3, y + 4, 1, h - 4, "#7a4e2d"); px(x + w / 2, y + 2, 1, h - 6, "#5b3a24");
        box(x, y, w, 13, "#fdfcdc", { outline: "#6b4226", light: 0 });
        px(x + 2, y + 2, 4, 3, "#ff6f91"); px(x + 6, y + 5, 5, 3, "#64b5f6"); px(x + 3, y + 8, 6, 2, "#ffd166");
        px(x + 1, y + 13, w - 2, 1, "#5b3a24");
        break;
      case "records":
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y + 5, w, h - 5, "#6b4226");
        px(x + 2, y + 9, w - 4, 1, "#4a2c18");
        box(x + 1, y, w - 2, 7, "#3a2a20", { light: 0.1 });
        px(x + 3, y + 1, 7, 5, "#111"); px(x + 6, y + 3, 1, 1, "#e63946");
        px(x + w - 5, y + 1, 1, 4, "#c0c0c8");
        ["#e63946", "#2a9d8f", "#ffd166", "#a98cff"].forEach((c, i) => px(x + 2 + i * 3, y + 11, 2, 3, c));
        break;
      case "fireplace":
        box(x, y, w, h, "#8d8d8d", { light: 0.12 });
        for (let j = y + 2; j < y + h - 2; j += 4) for (let i = x + 1 + ((j / 4) % 2 ? 3 : 0); i < x + w - 1; i += 6) px(i, j, 5, 3, shade("#8d8d8d", (i * 13 + j) % 3 === 0 ? -0.08 : 0.04));
        box(x + 5, y + 9, w - 10, h - 11, "#1c1410", { outline: "#3a3a3a", light: 0, dark: 0 });
        px(x - 1, y + 6, w + 2, 3, "#6b4226");
        px(x + 3, y + 3, 2, 3, "#fdfcdc"); px(x + 3, y + 2, 1, 1, "#ffd166"); px(x + w - 6, y + 4, 3, 2, "#7ab6a6");
        break;
      case "workbench":
        shadow(x + 1, y + h - 1, w, 2);
        box(x, y + 4, w, h - 4, "#8a6440", { light: 0.16 });
        px(x + 1, y + h - 1, 2, 1, OUTLINE); px(x + w - 3, y + h - 1, 2, 1, OUTLINE);
        px(x + 2, y + 6, 6, 1, "#9aa0a6"); px(x + 7, y + 5, 2, 3, "#5b3a24");
        px(x + w - 10, y + 7, 7, 1, "#9aa0a6"); for (let i = x + w - 10; i < x + w - 3; i += 2) px(i, y + 8, 1, 1, "#9aa0a6");
        break;
      default: drawDecor(g, o);
    }
  }

  function drawDecor(g, o) {
    const { px, box, shadow } = painter(g);
    const { x, y, w, h } = o;
    switch (o.kind) {
      case "counter":
        box(x, y, w, h, "#9c6b43");
        px(x, y, w, 4, "#e6dfd2"); px(x, y + 4, w, 1, "#b8ada0");
        for (let i = x + 2; i < x + w - 4; i += 8) { px(i, y + 6, 6, h - 8, shade("#9c6b43", 0.05)); px(i + 5, y + 8, 1, 2, "#e6c27a"); }
        break;
      case "sink": px(x, y, w, h, "#c3ccd3"); px(x + 1, y + 1, w - 2, h - 2, "#8a99a6"); px(x + w / 2, y - 3, 1, 3, "#9aa6b0"); px(x + w / 2 - 1, y - 3, 3, 1, "#9aa6b0"); break;
      case "chair": shadow(x + 1, y + h - 1, w, 1); box(x, y, w, h, "#7a4e2d"); px(x + 1, y + 1, w - 2, 2, "#9c6b43"); break;
      case "fruit": px(x, y + 1, w, h - 1, "#d9d2c3"); px(x + 1, y, 2, 2, "#e63946"); px(x + 3, y, 2, 2, "#ffd166"); px(x + 5, y, 1, 2, "#8ab17d"); break;
      case "coffeeTable": shadow(x + 1, y + h, w, 1); box(x, y, w, h, "#8a5a36", { light: 0.15 }); px(x + 3, y + 2, 3, 2, "#fdfcdc"); px(x + w - 6, y + 2, 4, 2, "#2a9d8f"); break;
      case "floorLamp": px(x + w / 2, y + 5, 1, h - 5, "#5b4636"); px(x + 1, y + h - 1, w - 2, 1, "#3a2a20"); box(x, y, w, 6, "#f7e1a8", { outline: "#b08d57", light: 0.05, dark: -0.05 }); break;
      case "plant": box(x + 1, y + h - 5, w - 2, 5, "#b5651d", { light: 0.12 }); px(x, y + 2, w, h - 7, "#3a7d44"); px(x + 1, y, 3, 4, "#4f9d5a"); px(x + w - 4, y + 1, 3, 4, "#4f9d5a"); px(x + 2, y + 4, 2, 2, "#6fbf73"); break;
      case "nightstand": shadow(x + 1, y + h - 1, w, 1); box(x, y, w, h, "#8a5a36"); px(x + 2, y + 4, w - 4, 1, "#5b3a24"); if (o.lamp) { px(x + w / 2, y - 3, 1, 3, "#5b4636"); box(x + w / 2 - 3, y - 7, 6, 5, "#f7e1a8", { outline: "#b08d57", light: 0.05, dark: -0.05 }); } break;
      case "dresser": shadow(x + 1, y + h - 1, w, 1); box(x, y, w, h, "#8a5a36"); for (let j = y + 3; j < y + h - 2; j += 4) { px(x + 1, j, w - 2, 1, "#5b3a24"); px(x + w / 2, j + 1, 1, 1, "#e6c27a"); } break;
      case "wardrobe": shadow(x + 1, y + h - 1, w, 2); box(x, y, w, h, "#7a4e2d", { light: 0.14 }); px(x + w / 2, y + 2, 1, h - 3, "#4a2c18"); px(x + w / 2 - 2, y + h / 2, 1, 3, "#e6c27a"); px(x + w / 2 + 2, y + h / 2, 1, 3, "#e6c27a"); break;
      case "poster": case "picture": drawPicture(g, o); break;
      case "fairyLights": for (let i = x; i < x + w; i += 4) { px(i, y + 1 + (i % 8 ? 1 : 0), 4, 1, "#5b4636"); px(i + 1, y + 2 + (i % 8 ? 1 : 0), 1, 1, ["#ffd166", "#ff6f91", "#64b5f6", "#8ab17d"][(i / 4) % 4]); } break;
      case "nightlight": px(x, y, w, h, "#fff6c2"); px(x + 2, y, 2, 2, "#e8d98a"); break;
      case "ball": px(x + 1, y, w - 2, h, "#e63946"); px(x, y + 1, w, h - 2, "#e63946"); px(x + 2, y + 1, 2, 2, "#ffffff"); break;
      case "beanbag": shadow(x + 1, y + h - 1, w, 1); px(x + 1, y + 2, w - 2, h - 2, "#2a9d8f"); px(x + 3, y, w - 6, 3, "#2a9d8f"); px(x + 3, y + 2, 5, 2, "#48b5a8"); break;
      case "clothesRack": px(x, y, w, 1, "#9aa0a6"); px(x, y, 1, h, "#9aa0a6"); px(x + w - 1, y, 1, h, "#9aa0a6"); ["#ff6f91", "#ffd166", "#64b5f6", "#a98cff"].forEach((c, i) => px(x + 2 + i * 3, y + 1, 2, 7 + (i % 2), c)); break;
      case "herbs": [0, 4, 7].forEach(i => { px(x + i, y + 2, 3, 2, "#b5651d"); px(x + i, y, 3, 2, "#6fbf73"); }); break;
      case "birdhouse": px(x + 1, y + 2, w - 2, h - 2, "#b5651d"); px(x, y + 1, w, 1, "#8a3b12"); px(x + 1, y, w - 2, 1, "#8a3b12"); px(x + w / 2 - 1, y + 4, 2, 2, OUTLINE); break;
      case "binoculars": px(x, y, 2, 3, "#333"); px(x + 3, y, 2, 3, "#333"); px(x + 2, y + 1, 1, 1, "#555"); break;
      case "logs": [[0, 4], [4, 4], [2, 1]].forEach(([a, b]) => { px(x + a, y + b, 4, 3, "#8a5a36"); px(x + a + 1, y + b + 1, 2, 1, "#d9b38c"); }); break;
      case "console": px(x, y, w, h, "#b8b8c0"); px(x + 1, y + 1, 2, 1, "#e63946"); break;
    }
  }

  /** Sunlight falling through each window onto the floor, kept inside its room. */
  function drawSunPatches(g, plan, light) {
    if (light === "night") return;
    for (const d of everything(plan).filter(o => o.kind === "window")) {
      const room = plan.rooms.find(r => d.x >= r.x && d.x < r.x + r.w && d.y >= r.y && d.y < r.y + r.h);
      if (!room) continue;
      const floorTop = room.y + WALL, reach = light === "evening" ? 16 : 11, lean = light === "evening" ? 6 : 3;
      g.save();
      g.beginPath(); g.rect(room.x + 2, floorTop, room.w - 4, room.h - WALL - 2); g.clip();
      g.fillStyle = light === "evening" ? "rgba(255,170,90,.13)" : "rgba(255,246,210,.14)";
      g.beginPath();
      g.moveTo(d.x + 2, floorTop); g.lineTo(d.x + d.w - 2, floorTop);
      g.lineTo(d.x + d.w - 2 + lean, floorTop + reach); g.lineTo(d.x + 2 + lean, floorTop + reach);
      g.closePath(); g.fill();
      g.restore();
    }
  }

  function everything(plan) { return [...plan.objects, ...plan.decor]; }

  /** The whole room at one time of day: "day", "evening" or "night". */
  function drawRoom(plan, light) {
    const c = document.createElement("canvas");
    c.width = plan.width; c.height = plan.height;
    const g = c.getContext("2d");
    const rand = seeded(plan.id);
    g.fillStyle = OUTLINE; g.fillRect(0, 0, plan.width, plan.height);
    for (const r of plan.rooms) drawFloor(g, r, rand);
    for (const r of plan.rooms) drawWallFace(g, r, rand);
    drawWallCaps(g, plan);
    drawDoorways(g, plan);
    drawSunPatches(g, plan, light);
    // Wall hangings first, then everything standing on the floor, back to front.
    const hangs = new Set(["window", "poster", "picture", "fairyLights"]);
    for (const o of everything(plan).filter(d => hangs.has(d.kind))) o.kind === "window" ? drawWindow(g, o, light) : drawDecor(g, o);
    const standing = everything(plan).filter(d => !hangs.has(d.kind)).sort((a, b) => (a.kind === "rug" ? -1 : 0) - (b.kind === "rug" ? -1 : 0) || (a.y + a.h) - (b.y + b.h));
    for (const o of standing) drawObject(g, o, plan);
    return c;
  }

  /** Lamps, fairy lights, night-lights and the fire. */
  function lightSources(plan, lampsOn) {
    const lights = [];
    for (const d of everything(plan)) {
      if (d.kind === "nightlight") lights.push({ x: d.x + 2, y: d.y + 2, r: 16, warm: "255,240,190" });
      if (!lampsOn) continue;
      if (d.kind === "floorLamp") lights.push({ x: d.x + d.w / 2, y: d.y + 4, r: 44, warm: "255,214,140" });
      if (d.kind === "nightstand" && d.lamp) lights.push({ x: d.x + d.w / 2, y: d.y - 4, r: 30, warm: "255,214,140" });
      if (d.kind === "fairyLights") for (let i = d.x + 6; i < d.x + d.w; i += 16) lights.push({ x: i, y: d.y + 6, r: 18, warm: "255,190,210" });
    }
    for (const o of everything(plan)) {
      if (o.kind === "fireplace") lights.push({ x: o.x + o.w / 2, y: o.y + o.h - 6, r: 52, warm: "255,150,70" });
      if (o.kind === "desk" && lampsOn) lights.push({ x: o.x + o.w - 4, y: o.y + 3, r: 22, warm: "255,220,150" });
    }
    return lights;
  }

  /**
   * Night and evening lighting as { dark, glow } canvases at 2x plan size:
   * `dark` is drawn over the room normally, `glow` with "lighter".
   */
  function drawLighting(plan, light, lampsOn) {
    if (light === "day") return null;
    const S = 2;
    const make = () => { const c = document.createElement("canvas"); c.width = plan.width * S; c.height = plan.height * S; return c; };
    const dark = make(), glow = make();
    const d = dark.getContext("2d"), gl = glow.getContext("2d");
    d.fillStyle = light === "night" ? "rgba(12,16,44,.62)" : "rgba(60,30,40,.18)";
    d.fillRect(0, 0, dark.width, dark.height);
    const lights = lightSources(plan, lampsOn);
    d.globalCompositeOperation = "destination-out";
    for (const l of lights) {
      const grad = d.createRadialGradient(l.x * S, l.y * S, 0, l.x * S, l.y * S, l.r * S);
      grad.addColorStop(0, "rgba(0,0,0,.9)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      d.fillStyle = grad;
      d.fillRect((l.x - l.r) * S, (l.y - l.r) * S, l.r * 2 * S, l.r * 2 * S);
      const warm = gl.createRadialGradient(l.x * S, l.y * S, 0, l.x * S, l.y * S, l.r * S);
      warm.addColorStop(0, `rgba(${l.warm},.28)`);
      warm.addColorStop(1, `rgba(${l.warm},0)`);
      gl.fillStyle = warm;
      gl.fillRect((l.x - l.r) * S, (l.y - l.r) * S, l.r * 2 * S, l.r * 2 * S);
    }
    return { dark, glow, scale: S };
  }

  /** Things that move: the fire, and steam from a pot while someone cooks. */
  function drawAnimated(g, plan, t, { cooking = false, tvOn = false } = {}) {
    const { px } = painter(g);
    for (const o of everything(plan)) {
      if (o.kind === "fireplace") {
        const fx = o.x + 6, fy = o.y + 10, fw = o.w - 12, fh = o.h - 13;
        for (let i = 0; i < fw; i++) {
          const flick = Math.sin(t * 9 + i * 1.7) * 1.5 + Math.sin(t * 5.3 + i) * 1.2;
          const height = Math.max(1, Math.round(fh * 0.55 + flick));
          px(fx + i, fy + fh - height, 1, height, "#e76f51");
          px(fx + i, fy + fh - Math.max(1, height - 2), 1, Math.max(1, height - 2), "#f4a261");
          if (height > 3) px(fx + i, fy + fh - Math.max(1, height - 4), 1, Math.max(1, height - 4), "#ffd166");
        }
        px(fx, fy + fh - 1, fw, 1, "#5b3a24");
      }
      if (o.kind === "stove" && cooking) {
        for (let i = 0; i < 3; i++) {
          const phase = (t * 0.8 + i / 3) % 1;
          g.globalAlpha = 0.6 * (1 - phase);
          px(o.x + o.w - 5 + Math.round(Math.sin(t * 3 + i * 2) * 1.5), o.y - 4 - Math.round(phase * 10), 2, 2, "#ffffff");
        }
        g.globalAlpha = 1;
      }
      if (o.kind === "tv" && tvOn) {
        const colors = ["#6fd6ff", "#ffd166", "#8ab17d", "#ff6f91"];
        px(o.x + 2, o.y + 1, o.w - 4, 10, "#1b2a44");
        px(o.x + 3 + Math.floor(t * 4) % 5, o.y + 6, 2, 2, colors[Math.floor(t * 2) % 4]);
        px(o.x + 3, o.y + 9, o.w - 6, 1, "#8ab17d");
      }
    }
  }

  root.LivingTownRooms = { drawRoom, drawLighting, drawAnimated, drawBlanket };
})(typeof self !== "undefined" ? self : this);
