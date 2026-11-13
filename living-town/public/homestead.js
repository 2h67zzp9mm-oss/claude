/* The home plot: your family's own garden, pond, crate and mailbox (lib/homestead.js on the server).
 * Art comes from art/blender (white clay template for now) packed into public/homestead/.
 * Walking works like inside buildings: your phone moves you straight away. */
(function () {
  "use strict";
  let BASE = "homestead/";
  // Worlds: same plot and gameplay, different paint. Art for each lives in homestead/worlds/<id>/.
  const WORLDS = { clay: { name: "Clay", icon: "🤍", dir: "homestead/" }, scifi: { name: "Sci-fi", icon: "🚀", dir: "homestead/worlds/scifi/" }, castle: { name: "Cloud Castle", icon: "🏰", dir: "homestead/worlds/castle/" }, night: { name: "Night Forest", icon: "🌙", dir: "homestead/worlds/night/" }, pirate: { name: "Pirate Cove", icon: "🏴‍☠️", dir: "homestead/worlds/pirate/" } };
  const HOUSE_NAMES = { night: { stump: "🪵 Stump House", shroom: "🍄 Mushroom House", willow: "🌳 Willow Treehouse", moon: "🌙 Moon Crystal Cottage" },
    pirate: { shack: "🛖 Beach Shack", ship: "⛵ Pirate Ship", light: "🗼 Lighthouse", chest: "💰 Treasure Chest" } };
  let houseId = "stump";
  let world = "clay";
  const SPEED = 5;            // metres per second (2.6 felt far too slow on a phone)
  const CELL = 0.25;          // walk grid
  const DIRS = 8;
  let L = null, A = null, imgs = {}, ready = null;
  let opts = null, canvas, ctx, bar, top, el, isOpen = false;
  let grid = null, N = 0;
  const me = { x: 10, y: 12.6, dir: 0, path: [], moving: false, step: 0, target: null };
  const pet = { x: 10.6, y: 12.6, dir: 0, step: 0, moving: false, trail: [] };
  let view = null, others = new Map(), cam = { x: 0, y: 0, z: 0.6 }, lastPos = 0, lastFrame = 0, fishing = null, marker = null, splash = null;

  function load() {
    if (ready) return ready;
    let ver = "";
    const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = BASE + src + ver; });
    ready = Promise.all([fetch("homestead/layout.json", { cache: "no-cache" }).then(r => r.json()), fetch(BASE + "art.json", { cache: "no-cache" }).then(r => r.json())]).then(async ([layout, art]) => {
      ver = "?v=" + (art.version || Date.now());   // new art = new URLs, so phones never mix old pictures with new
      const names = ["ground", "house", "sprites", ...Object.keys(art.walkers).map(k => "walk_" + k), ...(art.sky ? ["sky"] : []), ...Object.keys(art.houses || {}).map(k => "house_" + k)];
      const loaded = await Promise.all(names.map(n => img(n + ".webp")));
      L = layout; A = art; imgs = {}; names.forEach((n, i) => { imgs[n] = loaded[i]; });
      buildGrid();
    });
    return ready;
  }

  // --- geometry: ground metres <-> picture pixels ---
  function P(x, y, z = 0) { const c = A.camera; return [c.origin[0] + c.ex[0] * x + c.ey[0] * y + c.ez[0] * z, c.origin[1] + c.ex[1] * x + c.ey[1] * y + c.ez[1] * z]; }
  function unP(px, py) {
    const c = A.camera, a = c.ex[0], b = c.ey[0], d = c.ex[1], e = c.ey[1], det = a * e - b * d;
    const u = px - c.origin[0], v = py - c.origin[1];
    return { x: (e * u - b * v) / det, y: (a * v - d * u) / det };
  }
  const toScreen = (px, py) => [(px - cam.x) * cam.z, (py - cam.y) * cam.z];
  const fromScreen = (sx, sy) => [sx / cam.z + cam.x, sy / cam.z + cam.y];

  // --- where you can walk ---
  function blockedAt(x, y) {
    const S = L.size;
    if (x < 1.6 || y < 0.15 || x > S - 0.15 || y > S - 1.4) return true;
    const h = L.house; if (x > h.x0 - 0.3 && x < h.x1 + 0.3 && y > h.y0 - 0.3 && y < h.y1 + 0.3) return true;
    const p = L.pond; if (((x - p.x) / (p.rx + 0.15)) ** 2 + ((y - p.y) / (p.ry + 0.15)) ** 2 < 1) return true;
    const g = L.garden, t = 0.18, [gx, gy, gw] = g.gate;
    const nearV = (lx, y0, y1) => Math.abs(x - lx) < t && y > y0 - t && y < y1 + t;
    const nearH = (ly, x0, x1) => Math.abs(y - ly) < t && x > x0 - t && x < x1 + t;
    if (nearH(g.y0, g.x0, g.x1) || nearH(g.y1, g.x0, g.x1) || nearV(g.x0, g.y0, g.y1)) return true;
    if (nearV(g.x1, g.y0, g.y1) && Math.abs(y - gy) > gw / 2) return true;
    // garden beds: walk the paths between them, never over the plants
    for (const [px, py] of g.plots) if (x > px - 0.05 && x < px + g.plot + 0.05 && y > py - 0.05 && y < py + g.plot + 0.05) return true;
    for (const [tx, ty] of L.trees) if (Math.hypot(x - tx, y - ty) < 0.55) return true;
    for (const [bx, by] of L.bushes) if (Math.hypot(x - bx, y - by) < 0.6) return true;
    if (Math.hypot(x - L.mailbox[0], y - L.mailbox[1]) < 0.4) return true;
    for (const [lx, ly] of L.lamps || []) if (Math.hypot(x - lx, y - ly) < 0.3) return true;
    for (const [dx, dy] of L.decor || []) if (Math.hypot(x - dx, y - dy) < 0.35) return true;
    if (Math.abs(x - L.crate[0]) < 0.6 && Math.abs(y - L.crate[1]) < 0.6) return true;
    return false;
  }
  function buildGrid() {
    N = Math.ceil(L.size / CELL); grid = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) grid[j * N + i] = blockedAt((i + 0.5) * CELL, (j + 0.5) * CELL) ? 1 : 0;
  }
  const cellOf = (x, y) => [Math.max(0, Math.min(N - 1, Math.floor(x / CELL))), Math.max(0, Math.min(N - 1, Math.floor(y / CELL)))];
  function nearestFree(x, y) {
    let [ci, cj] = cellOf(x, y);
    if (!grid[cj * N + ci]) return [ci, cj];
    for (let r = 1; r < N; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < N && j < N && !grid[j * N + i]) return [i, j];
    }
    return [ci, cj];
  }
  function lineFree(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL / 2));
    for (let k = 1; k <= n; k++) { const [i, j] = cellOf(ax + (bx - ax) * k / n, ay + (by - ay) * k / n); if (grid[j * N + i]) return false; }
    return true;
  }
  // A* on the grid, then straightened so people walk in natural lines.
  function route(tx, ty) {
    const [si, sj] = nearestFree(me.x, me.y), [gi, gj] = nearestFree(tx, ty);
    const goal = { x: (gi + 0.5) * CELL, y: (gj + 0.5) * CELL };
    if (!grid[cellOf(tx, ty)[1] * N + cellOf(tx, ty)[0]]) { goal.x = tx; goal.y = ty; }
    if (lineFree(me.x, me.y, goal.x, goal.y)) return [goal];
    const start = sj * N + si, end = gj * N + gi, came = new Int32Array(N * N).fill(-1), cost = new Float32Array(N * N).fill(Infinity);
    const open = [start]; cost[start] = 0;
    const hEst = k => Math.hypot(k % N - gi, (k / N | 0) - gj);
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (cost[open[k]] + hEst(open[k]) < cost[open[bi]] + hEst(open[bi])) bi = k;
      const cur = open.splice(bi, 1)[0]; if (cur === end) break;
      const ci = cur % N, cj = cur / N | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = j * N + i; if (grid[k] || (di && dj && (grid[cj * N + i] || grid[j * N + ci]))) continue;
        const c = cost[cur] + (di && dj ? 1.414 : 1); if (c < cost[k]) { cost[k] = c; came[k] = cur; if (!open.includes(k)) open.push(k); }
      }
    }
    if (came[end] < 0 && end !== start) return [goal];
    const pts = []; for (let k = end; k !== start && k >= 0; k = came[k]) pts.unshift({ x: (k % N + 0.5) * CELL, y: ((k / N | 0) + 0.5) * CELL });
    pts.push(goal);
    const out = []; let from = { x: me.x, y: me.y };
    for (let k = 0; k < pts.length; k++) { const next = pts[k + 1]; if (next && lineFree(from.x, from.y, next.x, next.y)) continue; out.push(pts[k]); from = pts[k]; }
    return out;
  }

  // --- things you can tap ---
  function plotRect(k) { const [x, y] = L.garden.plots[k], s = L.garden.plot; return { x0: x, y0: y, x1: x + s, y1: y + s, cx: x + s / 2, cy: y + s / 2 }; }
  function spriteHit(name, x, y, px, py) {
    const s = A.sprites[name]; if (!s) return false; const [sx, sy] = P(x, y);
    return px > sx - s.ax && px < sx - s.ax + s.w && py > sy - s.ay && py < sy - s.ay + s.h;
  }
  // --- pets ---
  function spotPos(u, v) { const S = L.size, [i, j] = nearestFree(2 + u * (S - 4), 1 + v * (S - 3)); return [(i + 0.5) * CELL, (j + 0.5) * CELL]; }
  const petHex = c => view?.pets?.colors?.[c] || "#ffffff";
  function petSheet(species, color) { return window.LivingTownAvatar?.sheet("pets", species, { skin: petHex(color) }) || null; }
  function activePet() { const P2 = view?.pets; return P2?.active ? P2.owned.find(x => x.id === P2.active) || null : null; }
  function drawPet(info, p, idle) {
    const sh = petSheet(info.species, info.color); if (!sh) return;
    const [px, py] = P(p.x, p.y), [cx, cy] = toScreen(px, py), f = p.moving ? Math.floor(p.step * 2.6) % 4 : 4;
    ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.beginPath(); ctx.ellipse(cx, cy, 11 * cam.z * 1.6, 4.5 * cam.z * 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sh.canvas, f * sh.cw, p.dir * sh.ch, sh.cw, sh.ch, cx - sh.ax * cam.z, cy - sh.ay * cam.z, sh.cw * cam.z, sh.ch * cam.z);
    if (idle) { ctx.font = `600 ${Math.max(11, 12 * cam.z * 1.4)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(20,30,50,0.8)"; ctx.fillText(idle, cx, cy - 70 * cam.z); }
  }
  function stepPet(dt) {
    if (!activePet()) return;
    const last = pet.trail[pet.trail.length - 1];
    if (!last || Math.hypot(me.x - last.x, me.y - last.y) > 0.15) { pet.trail.push({ x: me.x, y: me.y }); if (pet.trail.length > 300) pet.trail.shift(); }
    pet.moving = false; let budget = SPEED * 1.05 * dt;
    while (budget > 0 && pet.trail.length && Math.hypot(pet.x - me.x, pet.y - me.y) > 0.85) {
      const n = pet.trail[0], gap = Math.hypot(n.x - pet.x, n.y - pet.y);
      if (gap > 0.01) { const [ax, ay] = P(pet.x, pet.y), [bx, by] = P(n.x, n.y); pet.dir = dirFor(bx - ax, by - ay); pet.moving = true; }
      if (gap <= budget) { pet.x = n.x; pet.y = n.y; budget -= gap; pet.trail.shift(); } else { pet.x += (n.x - pet.x) / gap * budget; pet.y += (n.y - pet.y) / gap * budget; budget = 0; }
    }
    if (!pet.moving && !me.moving && !me.path.length) {   // you stopped: trot round to your side (x + y runs across the screen), so it's never hidden behind you
      pet.still = (pet.still || 0) + dt;
      if (pet.still > 0.4) {
        const sides = [[0.55, 0.55], [-0.55, -0.55], [0.7, 0.2], [-0.2, -0.7]].map(([dx, dy]) => [me.x + dx, me.y + dy]).filter(([x, y]) => { const [i, j] = cellOf(x, y); return !grid[j * N + i] && lineFree(pet.x, pet.y, x, y); });
        const goal = sides.sort((a, b) => Math.hypot(a[0] - pet.x, a[1] - pet.y) - Math.hypot(b[0] - pet.x, b[1] - pet.y))[0];
        if (goal) { const gap = Math.hypot(goal[0] - pet.x, goal[1] - pet.y); if (gap > 0.05) { const k = Math.min(gap, SPEED * 0.6 * dt); const [ax, ay] = P(pet.x, pet.y), [bx, by] = P(...goal); pet.dir = dirFor(bx - ax, by - ay); pet.x += (goal[0] - pet.x) / gap * k; pet.y += (goal[1] - pet.y) / gap * k; pet.moving = true; } }
      }
    } else pet.still = 0;
    if (pet.moving) pet.step += dt * SPEED; else if (!me.moving) { const [ax, ay] = P(pet.x, pet.y), [bx, by] = P(me.x, me.y); if (Math.hypot(bx - ax, by - ay) > 4) pet.dir = dirFor(bx - ax, by - ay); }
  }
  function petTargets() {
    const out = [], v = view?.pets; if (!v || !L) return out;
    for (const s of v.spots) { const [x, y] = spotPos(s.u, s.v); out.push({ kind: "treat", spot: s.i, x, y, hx: x, hy: y, r: 28 }); }
    if (v.wild) { const [x, y] = spotPos(v.wild.u, v.wild.v); out.push({ kind: "wild", x: x + 0.5, y, hx: x, hy: y, r: 36 }); }
    if (activePet()) out.push({ kind: "mypet", x: pet.x + 0.4, y: pet.y, hx: pet.x, hy: pet.y, r: 30 });
    return out;
  }
  function targetAt(px, py) {
    const w = unP(px, py);
    for (const t of petTargets()) { const [sx, sy] = P(t.hx, t.hy, 0.25); if (Math.hypot(px - sx, py - sy) < t.r) return t; }
    if (spriteHit(view?.mail ? "mailbox_up" : "mailbox", L.mailbox[0], L.mailbox[1], px, py)) return { kind: "mailbox", x: L.mailbox[0] + 0.3, y: L.mailbox[1] - 0.6 };
    if (spriteHit("crate", L.crate[0], L.crate[1], px, py)) return { kind: "crate", x: L.crate[0] + 0.9, y: L.crate[1] };
    const h = houseArt().r; if (px > h.x && px < h.x + h.w && py > h.y && py < h.y + h.h) {
      const d = L.house.door; return { kind: "door", x: d[0] + 0.7, y: d[1] };
    }
    for (let k = 0; k < L.garden.plots.length; k++) { const r = plotRect(k); if (w.x > r.x0 - 0.1 && w.x < r.x1 + 0.1 && w.y > r.y0 - 0.1 && w.y < r.y1 + 0.1) return { kind: "plot", plot: k, x: r.cx + 0.2, y: r.y0 - 0.25 }; }
    const p = L.pond, e = ((w.x - p.x) / p.rx) ** 2 + ((w.y - p.y) / p.ry) ** 2;
    if (e < 1.15) { const a = Math.atan2((w.y - p.y) / p.ry, (w.x - p.x) / p.rx); return { kind: "pond", x: p.x + Math.cos(a) * (p.rx + 0.45), y: p.y + Math.sin(a) * (p.ry + 0.45), cast: { x: p.x + Math.cos(a) * p.rx * 0.45, y: p.y + Math.sin(a) * p.ry * 0.45 } }; }
    if (Math.hypot(w.x - L.exit[0], w.y - L.exit[1]) < 1.6) return { kind: "exit", x: L.exit[0], y: L.exit[1] };
    return { kind: "walk", x: w.x, y: w.y };
  }

  // --- the bar of buttons along the bottom (thumbs) ---
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let setBar = function (title, buttons, cls = "") {
    const dock = cls.includes("dock");   // one compact row: a picture with a small word under it
    bar.innerHTML = `${title ? `<div class="home-title">${title}</div>` : ""}<div class="home-actions ${cls}">${buttons.map((b, i) => `<button data-i="${i}" ${b.off ? "disabled" : ""} class="${b.big ? "big" : ""}">${dock ? b.label.replace(/^(\S+)\s+(.*)$/, `<b>$1</b>${b.badge ? `<em>${b.badge}</em>` : ""}<span>$2</span>`) : b.label}</button>`).join("")}</div>`;
    bar.querySelectorAll("button").forEach(btn => { btn.onclick = () => { hidePop(); buttons[Number(btn.dataset.i)].go(); }; });   // a pop-up never lingers over a menu
  };

  // --- juice: sparkles, flying stars and little sounds, so every job feels good ---
  let fx = [], audio = null;
  let soundOn = (() => { try { return localStorage.getItem("lt-sound") !== "off"; } catch { return true; } })();
  function tone(freqs, { type = "sine", len = 0.12, gap = 0.07, vol = 0.12 } = {}) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      freqs.forEach((f, i) => {
        const t0 = audio.currentTime + i * gap, o = audio.createOscillator(), g = audio.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + len + 0.03);
      });
    } catch { /* no sound on this phone */ }
  }
  const SFX = {
    pop: () => tone([660, 990, 1320], { type: "triangle", len: 0.1, gap: 0.05 }),
    water: () => tone([1400, 1000, 1600], { len: 0.06, gap: 0.05, vol: 0.06 }),
    plant: () => tone([280, 400], { type: "triangle", len: 0.09, gap: 0.06, vol: 0.09 }),
    coin: () => tone([988, 1319], { type: "square", len: 0.08, gap: 0.08, vol: 0.04 }),
    goal: () => tone([523, 659, 784, 1047], { type: "triangle", len: 0.2, gap: 0.09 }),
    fish: () => tone([420, 840, 630], { len: 0.09, gap: 0.06, vol: 0.08 })
  };
  // Particles live in picture pixels, so they stay put while the camera moves.
  function burst(x, y, z, { n = 10, emoji = null, color = "#ffe27a", speed = 90, up = 120, life = 800, size = 5, gravity = 300 } = {}) {
    const [px, py] = P(x, y, z), born = performance.now();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.6);
      fx.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - up * (0.6 + Math.random() * 0.6), g: gravity, born,
        life: life * (0.7 + Math.random() * 0.5), emoji, color: Array.isArray(color) ? color[i % color.length] : color, size });
    }
  }
  function floatText(x, y, z, text, color = "#fff") { const [px, py] = P(x, y, z); fx.push({ x: px, y: py, vx: 0, vy: -70, g: 0, born: performance.now(), life: 1300, text, color, size: 20 }); }
  function drawFx(t) {
    fx = fx.filter(p => t - p.born < p.life);
    for (const p of fx) {
      const sec = (t - p.born) / 1000, k = 1 - (t - p.born) / p.life;
      const [sx, sy] = toScreen(p.x + p.vx * sec, p.y + p.vy * sec + p.g * sec * sec / 2);
      ctx.globalAlpha = Math.min(1, k * 1.8); ctx.textAlign = "center";
      if (p.text) { ctx.font = `800 ${p.size}px system-ui`; ctx.lineWidth = 4; ctx.strokeStyle = "#000a"; ctx.strokeText(p.text, sx, sy); ctx.fillStyle = p.color; ctx.fillText(p.text, sx, sy); }
      else if (p.emoji) { ctx.font = `${Math.round(p.size * 4 * (0.8 + 0.4 * Math.min(1, sec * 4)))}px system-ui`; ctx.fillText(p.emoji, sx, sy); }
      else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, p.size * (0.4 + k * 0.6)), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  // Stars fly from where you earned them up to your star counter.
  function flyStars(x, y, z, n) {
    const goal = top.querySelector(".home-stars"); if (!goal) return;
    const [sx, sy] = toScreen(...P(x, y, z)), g = goal.getBoundingClientRect(), box = el.getBoundingClientRect();
    const tx = g.left - box.left + g.width / 2, ty = g.top - box.top + g.height / 2;
    for (let i = 0; i < Math.min(8, Math.max(1, n)); i++) {
      const st = document.createElement("span"); st.className = "home-flystar"; st.textContent = "⭐";
      st.style.left = sx + "px"; st.style.top = sy + "px"; el.appendChild(st);
      const dx = (Math.random() - 0.5) * 80;
      const anim = st.animate([
        { transform: "translate(-50%,-50%) scale(0.5)", opacity: 0.4 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - 50px)) scale(1.25)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(0.7)`, opacity: 1 }
      ], { duration: 800 + i * 80, easing: "ease-in", fill: "forwards" });
      anim.onfinish = () => { st.remove(); goal.animate([{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }], { duration: 260 }); if (i === 0) SFX.coin(); };
    }
  }
  let bannerAt = 0;
  function banner(html, cls = "") {
    const wait = Math.max(0, bannerAt - performance.now()); bannerAt = performance.now() + wait + 1500;
    setTimeout(() => {
      if (!isOpen) return;
      const b = document.createElement("div"); b.className = `home-banner ${cls}`; b.innerHTML = html; el.appendChild(b);
      setTimeout(() => b.remove(), 2600);
    }, wait);
  }
  const CONFETTI = ["#ff6b6b", "#ffd84a", "#4fc3a1", "#64b5f6", "#c38bff", "#ff9ad5"];

  // --- the pop-up menu right at your finger: tap a thing, it lights up, pick what to do ---
  let pop = null, popAt = null, highlight = null;
  const CLOSERS = /^(Done|OK|Stay|Back)$/;
  function near(t) { return Math.hypot(me.x - t.x, me.y - t.y) < 0.6 && !me.path.length; }
  function showPop(t, at) {
    const menu = menuFor(t); if (!menu) return;
    highlight = t; popAt = at; me.popTarget = t;
    const buttons = menu.buttons.map(b => ({ ...b, go: CLOSERS.test(b.label) ? hidePop : () => {
      hidePop(true);
      if (near(t)) b.go(); else { me.pending = b.go; walkTo(t, true); }
    } }));
    pop.innerHTML = `${menu.title ? `<p class="home-title">${menu.title}</p>` : ""}<div class="home-actions">${buttons.map((b, i) => `<button data-i="${i}" ${b.off ? "disabled" : ""} class="${b.big ? "big" : ""}">${b.label}</button>`).join("")}</div>`;
    pop.querySelectorAll("button").forEach(btn => { btn.onclick = e => { e.stopPropagation(); buttons[Number(btn.dataset.i)].go(); }; });
    pop.classList.remove("hidden");
    const W = el.clientWidth, H = el.clientHeight, w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.max(8, Math.min(W - w - 8, at.x - w / 2));
    const y = at.y - h - 24 > 60 ? at.y - h - 24 : Math.min(H - h - 90, at.y + 24);
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }
  function hidePop(keepHighlight) { pop?.classList.add("hidden"); if (!keepHighlight) { highlight = null; popAt = null; } }
  function drawHighlight(t) {
    if (!highlight) return;
    const pulse = 0.55 + 0.45 * Math.sin(t / 180);
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,236,120,${0.6 + 0.4 * pulse})`; ctx.shadowColor = "#ffe27a"; ctx.shadowBlur = 14;
    ctx.beginPath();
    if (highlight.kind === "plot") {
      const r = plotRect(highlight.plot);
      [[r.x0 - 0.06, r.y0 - 0.06], [r.x1 + 0.06, r.y0 - 0.06], [r.x1 + 0.06, r.y1 + 0.06], [r.x0 - 0.06, r.y1 + 0.06]].forEach(([x, y], i) => { const [sx, sy] = toScreen(...P(x, y, 0.25)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.closePath();
    } else {
      const c = highlight.kind === "pond" ? [L.pond.x, L.pond.y, Math.max(L.pond.rx, L.pond.ry) + 0.3] : highlight.kind === "mailbox" ? [L.mailbox[0], L.mailbox[1], 0.6]
        : highlight.kind === "crate" ? [L.crate[0], L.crate[1], 0.8] : highlight.kind === "door" ? [L.house.door[0] + 0.3, L.house.door[1], 1.0] : [highlight.x, highlight.y, 0.8];
      for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; const [sx, sy] = toScreen(...P(c[0] + Math.cos(a) * c[2], c[1] + Math.sin(a) * c[2])); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
    }
    ctx.stroke(); ctx.restore();
  }
  function idleBar() {
    const g = view?.goals || [], left = g.filter(x => x.have < x.n).length;
    setBar("", [{ label: "🎯 Goals", badge: g.length ? (left ? `${g.length - left}/${g.length}` : "✓") : "", big: g.length > 0 && left > 0 && left === g.length, go: goalsBar }, { label: "🐾 Pets", go: petsBar }, { label: "🎒 Bag", go: showBag }, { label: "🎨 Look", go: () => opts.editLook?.() }, { label: "🌍 World", go: worldBar }, { label: "🏘️ Town", go: () => walkTo({ kind: "exit", x: L.exit[0], y: L.exit[1] }) }], "home-dock");
  }
  function goalsBar() {
    const g = view?.goals || [];
    const rows = g.map(x => row(x.icon, esc(x.text), `<small>${x.have}/${x.n} · +${view.goalStars}⭐</small>`, x.have >= x.n)).join("");
    const note = `All 3: +${view?.allBonus ?? 5}⭐${view?.streak ? ` · 🔥 ${view.streak} day${view.streak > 1 ? "s" : ""}${view.streakToday ? "" : ", keep it going!"}` : " and a 🔥 streak"}`;
    const st = view?.story, m = view?.me;
    const more = (st ? (st.done ? row("📖", "Story finished here. Try another world!") : row("📖", esc(st.job), `<small>${st.have}/${st.n} · +${st.stars}⭐</small>`)) : "")
      + (m ? row("⭐", `Level ${m.level} · ${esc(m.title)}`, `${meter(m.into, m.need)}<small>${m.into}/${m.need} XP</small>`) : "");
    setBar(`<span class="home-goals"><span class="home-head"><b>🎯 Today’s goals</b><small>${note}</small></span>${rows}${more}</span>`,
      [{ label: "📖 Story", big: !!st && !st.done, go: () => questBar("story") }, { label: "🔨 Build", go: () => questBar("build") }, { label: "📚 Book", go: () => questBar("book") }, { label: "⭐ Level", go: () => questBar("level") },
        { label: soundOn ? "🔊 Sound" : "🔈 Muted", go: () => { soundOn = !soundOn; try { localStorage.setItem("lt-sound", soundOn ? "on" : "off"); } catch { /* fine */ } if (soundOn) SFX.pop(); goalsBar(); } }, { label: "↩️ Back", go: idleBar }], "home-dock");
  }
  // --- reasons to keep playing: your level, this world's story, the family build and the collection book ---
  // One row in a panel: a picture in its own column, the words, then anything for the right-hand side (a meter, small have/need text).
  const row = (icon, text, tail = "", done = false) => `<span class="home-goal ${done ? "done" : ""}"><i class="home-ico">${done ? "✅" : icon}</i><span>${text}</span>${tail}</span>`;
  const meter = (have, need) => `<i class="home-meter"><i style="width:${Math.round(100 * Math.min(1, have / Math.max(1, need)))}%"></i></i>`;
  const fishIcon = (k, size = 34) => sprIcon("fish_" + k, size) || `<span class="home-icon home-emoji" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.7)}px">${view?.fish[k]?.emoji || "🐟"}</span>`;
  function questBar(p) {
    if (!view?.me) return idleBar();
    const m = view.me, st = view.story, b = view.build, bk = view.book; let html = "", buttons = [];
    if (p === "level") {
      const next = m.perks.filter(k => k.level > m.level).slice(0, 3), got = m.perks.filter(k => k.level <= m.level);
      html = `<b>⭐ Level ${m.level} · ${esc(m.title)}</b>` + row("⭐", "Next level", `${meter(m.into, m.need)}<small>${m.into}/${m.need} XP · +${m.nextStars}⭐</small>`)
        + next.map(k => row(k.icon, esc(k.text), `<small>🔒 Level ${k.level}</small>`)).join("")
        + got.map(k => row(k.icon, esc(k.text), "", true)).join("");
    } else if (p === "story") {
      html = `<b>📖 ${esc(st.title)}</b><span>${st.done ? "The end" : `Chapter ${st.ch} of ${st.total}`} · ${esc(st.guide)} says:</span><span class="home-say">“${esc(st.text)}”</span>`
        + (st.done ? "" : row("👉", esc(st.job), `${meter(st.have, st.n)}<small>${st.have}/${st.n} · +${st.stars}⭐</small>`))
;
    } else if (p === "build") {
      html = `<b>${b.icon} ${esc(b.name)}</b>` + (b.done ? `<span class="home-say">It’s all built. What a family! 🎉</span>`
        : `<span>Stage ${b.stage} of ${b.total}: ${esc(b.stageName)}</span>`
          + b.needs.map(n => row(n.emoji, esc(n.name), `${meter(n.have, n.need)}<small>${n.have}/${n.need}</small>`, n.have >= n.need)).join("")
          + row("⭐", "Stars", `${meter(b.stars.have, b.stars.need)}<small>${b.stars.have}/${b.stars.need}</small>`, b.stars.have >= b.stars.need)
          + `<span>🎁 When it’s built, everyone gets +${b.prize}⭐ and 2 🍪</span>`);
      if (!b.done) buttons = [{ label: "🧺 Give from bag", big: true, go: () => act("give") }, { label: `⭐ Give ${b.gift}`, go: () => act("giveStars") }];
    } else {
      const C = view.crops, K = view.pets?.kinds || {}, page = (k, icon, title, cards) => row(icon, title, `${meter(bk[k].length, bk.totals[k])}<small>${bk[k].length}/${bk.totals[k]}${bk.done[k] ? "" : ` · +${bk.prizes[k]}⭐`}</small>`, bk.done[k]) + `<div class="fish-book">${cards}</div>`;
      const card = (known, icon, name, note = "") => `<div class="fish-card ${known ? "" : "unknown"}">${icon}<b>${known ? esc(name) : "???"}</b><small>${note}</small></div>`;
      const em = e => `<span class="home-icon home-emoji" style="width:34px;height:34px;font-size:24px">${e}</span>`;
      html = `<span class="home-head"><b>📚 Collection book</b><small>A full page pays everyone</small></span>`
        + page("fish", "🐟", "Fish", Object.entries(view.fish).map(([k, f]) => card(bk.fish.includes(k), fishIcon(k), f.name, bk.fish.includes(k) ? `caught ${view.caught[k] || 1}` : f.level > m.level ? `🔒 Level ${f.level}` : f.biting ? "biting now" : "not biting now")).join(""))
        + page("crops", "🌱", "Crops", Object.entries(C).map(([k, c]) => card(bk.crops.includes(k), em(c.emoji), c.name, bk.crops.includes(k) ? "grown" : "grow one")).join(""))
        + page("pets", "🐾", "Pets", Object.entries(K).map(([k, c]) => card(bk.pets.includes(k), em(c.emoji), c.name, bk.pets.includes(k) ? "in the family" : "not yet")).join(""));
    }
    setBar(`<span class="home-goals home-quest" data-p="${p}">${html}</span>`, [...buttons, { label: "Back", go: goalsBar }]);
  }
  function worldBar() {
    setBar("Pick your world. Your family all sees the same one.", [...Object.entries(WORLDS).map(([k, w]) => ({ label: `${w.icon} ${w.name}`, big: k === world, go: () => { act("world", { world: k }); HOUSE_NAMES[k] ? houseBar(k) : idleBar(); } })),
      ...(HOUSE_NAMES[world] ? [{ label: "🏠 Pick house", go: () => houseBar() }] : []), { label: "Back", go: idleBar }]);
  }
  // Night Forest and Pirate Cove have four houses each; the family picks one (everyone sees the same)
  function houseBar(w = world) {
    setBar("Which house do you want to live in?", [...Object.entries(HOUSE_NAMES[w] || {}).map(([k, n]) => ({ label: n, big: k === houseId, go: () => { act("house", { house: k }); idleBar(); } })), { label: "Back", go: idleBar }], "wide");
  }
  function houseArt() { const k = A.houses && A.houses[houseId] ? houseId : null; return k ? { r: A.houses[k], img: imgs["house_" + k] } : { r: A.house, img: imgs.house }; }
  function setWorld(k) {
    if (!WORLDS[k] || k === world) return;
    world = k; BASE = WORLDS[k].dir; const keep = { ...me }; ready = null;
    load().then(() => Object.assign(me, keep)).catch(err => console.error(err));
  }
  function act(action, extra = {}) { opts.send({ type: "home", action, ...extra }); }
  // The menu for a thing, as { title, buttons } (captured from what contextBar would show).
  function menuFor(t) {
    let menu = null; const real = setBar;
    setBar = (title, buttons) => { menu = { title, buttons }; };
    try { contextBarInner(t); } finally { setBar = real; }
    return menu;
  }
  function contextBar(t) { contextBarInner(t); }
  // The seed shop stays open while you buy: every tap buys one, and the stars and counts update in place.
  function shopBar() {
    if (!view) return idleBar();
    const C = view.crops, up = view.upgrade;
    setBar(`<span class="home-goals home-shop"><span class="home-head"><b>🛒 Seed shop</b><small>You have ${view.stars}⭐ · tap to buy one</small></span></span>`,
      [...view.shop.map(k => ({ label: `${C[k].emoji} ${C[k].name} ${C[k].seed}⭐${view.seeds[k] > 0 ? ` <small>×${view.seeds[k]}</small>` : ""}`, off: view.stars < C[k].seed, go: () => act("buy", { crop: k }) })),
        ...(up ? [{ label: `🌱 Bigger garden ${up.cost}⭐`, big: view.stars >= up.cost, off: view.stars < up.cost, go: () => act("upgrade") }] : []), { label: "Back", go: idleBar }], "wide");
  }
  function contextBarInner(t) {
    if (!view) return idleBar();
    const C = view.crops;
    if (t.kind === "plot") {
      const p = view.plots[t.plot];
      if (t.plot >= view.beds) return view.upgrade
        ? setBar(`🔒 Not dug yet. A bigger garden has ${view.upgrade.beds} beds.`, [{ label: `🌱 Bigger garden ${view.upgrade.cost}⭐`, big: view.stars >= view.upgrade.cost, off: view.stars < view.upgrade.cost, go: () => act("upgrade") }, { label: "OK", go: idleBar }])
        : idleBar();
      if (!p.crop) {
        // Seeds you have, then seeds you can buy right here (a price means "buy one and plant it").
        const seeds = Object.entries(view.seeds).filter(([, n]) => n > 0), buy = view.shop.filter(k => !(view.seeds[k] > 0) && view.stars >= C[k].seed);
        if (!seeds.length && !buy.length) return setBar("No seeds, and not enough ⭐ for more. Sell crops or fish at the crate!", [{ label: "OK", go: idleBar }]);
        return setBar(`🌱 Plant · you have ${view.stars}⭐`, [...seeds.map(([k, n]) => ({ label: `${C[k].emoji} ${C[k].name} ×${n}`, go: () => act("plant", { plot: t.plot, crop: k }) })),
          ...buy.map(k => ({ label: `${C[k].emoji} ${C[k].name} ${C[k].seed}⭐`, go: () => act("plant", { plot: t.plot, crop: k }) })), { label: "Done", go: idleBar }]);
      }
      if (p.growth >= 1) return setBar(`${C[p.crop].emoji} Ready to pick!`, [{ label: "🧺 Pick", big: true, go: () => act("harvest", { plot: t.plot }) }]);
      return setBar(`${C[p.crop].emoji} ${C[p.crop].name}: ${Math.round(p.growth * 100)}% grown${p.wet ? " · watered" : ""}`, [{ label: "💧 Water", big: !p.wet, go: () => act("water", { plot: t.plot }) }, { label: "Done", go: idleBar }]);
    }
    if (t.kind === "treat") return setBar("🍪 A pet treat!", [{ label: "🍪 Pick up", big: true, go: () => act("treat", { spot: t.spot }) }, { label: "Done", go: idleBar }]);
    if (t.kind === "wild" && view.pets?.wild) {
      const w = view.pets.wild, k = view.pets.kinds[w.species];
      return setBar(`${k.emoji} A wild ${w.color} ${k.name.toLowerCase()}! It's a bit shy.<br>Feed it ${w.need} treats so it trusts you · fed ${w.fed}/${w.need} · you have ${view.pets.treats} 🍪`,
        [{ label: `🍪 Feed it`, big: view.pets.treats > 0, go: () => act("petFeed") }, { label: "Done", go: idleBar }]);
    }
    if (t.kind === "mypet" && activePet()) {
      const a = activePet(), k = view.pets.kinds[a.species];
      return setBar(`${k.emoji} ${esc(a.name)}`, [{ label: "💕 Cuddle", big: true, go: () => { burst(pet.x, pet.y, 0.8, { n: 6, emoji: "💕", speed: 30, up: 120, life: 1100, size: 5 }); SFX.pop(); navigator.vibrate?.(20); } }, { label: "🐾 Pets", go: petsBar }]);
    }
    if (t.kind === "pond") return setBar("The pond", [{ label: "🎣 Fish", big: true, go: () => startFishing(t) }, { label: "Done", go: idleBar }]);
    if (t.kind === "crate") {
      const n = Object.entries(view.bag).filter(([k]) => C[k] || view.fish[k]).reduce((s, [, v]) => s + v, 0);
      return setBar(`📦 Shipping crate · you have ${view.stars}⭐`, [{ label: `📦 Sell all (${n})`, big: n > 0, off: !n, go: () => act("sell") },
        { label: "🛒 Seed shop", go: shopBar }, { label: "Done", go: idleBar }]);
    }
    if (t.kind === "mailbox") return setBar(view.mail ? "✉️ You've got mail!" : "No new mail today.", [{ label: "✉️ Open", big: view.mail, go: () => act("mail") }, { label: "Done", go: idleBar }]);
    if (t.kind === "door") return setBar("Your house", [{ label: "🏠 Go inside", big: true, go: () => opts.openHouse() }, { label: "Done", go: idleBar }]);
    if (t.kind === "exit") return setBar("The path to town", [{ label: "🏘️ Walk to town", big: true, go: close }, { label: "Stay", go: idleBar }]);
    idleBar();
  }

  // sci-fi sky: a purple twilight with stars and two moons (drawn once, then reused)
  let space = null;
  function drawSpace(cw, ch) {
    if (!space || space.width !== cw || space.height !== ch) {
      space = document.createElement("canvas"); space.width = cw; space.height = ch; const g = space.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 0, ch); grad.addColorStop(0, "#1a1035"); grad.addColorStop(0.55, "#4a2a6e"); grad.addColorStop(1, "#7a4a8e");
      g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 140; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; g.fillStyle = "#fff"; g.fillRect(rnd() * cw, rnd() * ch * 0.7, rnd() < 0.15 ? 2 : 1, rnd() < 0.15 ? 2 : 1); }
      g.globalAlpha = 1;
      for (const [mx, my, mr, col] of [[cw * 0.78, ch * 0.09, Math.min(cw, ch) * 0.075, "#f3c9b8"], [cw * 0.6, ch * 0.05, Math.min(cw, ch) * 0.035, "#e9b7c9"]]) {
        const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr); mg.addColorStop(0, "#fff3ea"); mg.addColorStop(1, col);
        g.shadowColor = col; g.shadowBlur = mr; g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      }
    }
    ctx.drawImage(space, 0, 0);
  }
  // A painted sky (Cloud Castle): fills the screen, drifting a little as you walk so the island feels like it floats.
  function drawSky(cw, ch) {
    const S = imgs.sky, k = Math.max(cw / S.width, ch / S.height) * 1.12;
    const w = S.width * k, h = S.height * k, G = imgs.ground;
    const fx = G ? Math.max(0, Math.min(1, cam.x / Math.max(1, G.width - cw / cam.z))) : 0.5, fy = G ? Math.max(0, Math.min(1, cam.y / Math.max(1, G.height - ch / cam.z))) : 0.5;
    ctx.drawImage(S, -(w - cw) * fx, -(h - ch) * fy, w, h);
  }
  function walkTo(t, keepPending) {
    fishing = null; if (!keepPending) me.pending = null;
    me.target = t; me.path = route(t.x, t.y); marker = { x: t.x, y: t.y, at: performance.now() };
    idleBar();
  }

  // --- fishing: wait for the bobber to dip, then tap Reel! in time ---
  function startFishing(t) {
    const now = performance.now();
    fishing = { x: t.cast.x, y: t.cast.y, castAt: now, biteAt: now + 2200 + Math.random() * 5200, phase: "wait" };
    faceToward(t.cast.x, t.cast.y);
    setBar("Wait for a bite…", [{ label: "🎣 Reel!", big: true, go: reel }, { label: "Stop", go: () => { fishing = null; idleBar(); } }]);
  }
  function reel() {
    if (!fishing) return;
    const now = performance.now();
    if (now < fishing.biteAt) { fishing = null; opts.toast("Too soon! The fish swam off."); return idleBar(); }
    if (now > fishing.biteAt + 1000) { fishing = null; opts.toast("Too slow, it got away!"); return idleBar(); }
    fishing.phase = "caught"; act("fish");
  }

  // --- bag & fish book ---
  function sprIcon(name, size = 44) {
    const s = A.sprites[name]; if (!s) return "";
    const k = size / Math.max(s.w, s.h);
    return `<span class="home-icon" style="width:${size}px;height:${size}px"><i style="width:${s.w * k}px;height:${s.h * k}px;background-image:url(${BASE}sprites.webp);background-size:${imgs.sprites.width * k}px ${imgs.sprites.height * k}px;background-position:-${s.x * k}px -${s.y * k}px"></i></span>`;
  }
  // The pets panel: pick a free starter, or see your pets, treats, today's visitor and the travelling seller.
  let starter = null;
  function petThumb(c, species, color) {
    const sh = petSheet(species, color), g = c.getContext("2d");
    if (!sh) { setTimeout(() => c.isConnected && petThumb(c, species, color), 150); return; }
    g.clearRect(0, 0, c.width, c.height); g.drawImage(sh.canvas, 4 * sh.cw + sh.cw * 0.12, sh.ch * 0.5, sh.cw * 0.76, sh.ch * 0.48, 0, 0, c.width, c.height);
  }
  function petsBar() {
    const v = view?.pets; if (!v) return;
    const K = v.kinds;
    if (!v.owned.length) {
      starter = starter && K[starter.species] ? starter : { species: v.starters[0], color: K[v.starters[0]].colors[0] };
      const kinds = v.starters.map(k => `<button class="pet-kind ${k === starter.species ? "on" : ""}" data-k="${k}">${K[k].emoji} ${K[k].name}</button>`).join("");
      const cols = K[starter.species].colors.filter(c => c !== "gold").map(c => `<button class="pet-col ${c === starter.color ? "on" : ""}" data-c="${c}" style="--c:${petHex(c)}" aria-label="${c}"></button>`).join("");
      bar.innerHTML = `<div class="home-pets"><p class="home-title">🐾 Pick your first pet. It's free!</p><canvas class="pet-big" width="150" height="120"></canvas><div class="pet-row">${kinds}</div><div class="pet-row pet-cols">${cols}</div></div><div class="home-actions"><button class="big" data-go="adopt">💕 Adopt</button><button data-go="back">Back</button></div>`;
      petThumb(bar.querySelector(".pet-big"), starter.species, starter.color);
      bar.querySelectorAll(".pet-kind").forEach(b => b.onclick = () => { starter = { species: b.dataset.k, color: K[b.dataset.k].colors[0] }; petsBar(); });
      bar.querySelectorAll(".pet-col").forEach(b => b.onclick = () => { starter.color = b.dataset.c; petsBar(); });
      bar.querySelector('[data-go="adopt"]').onclick = () => act("petStart", starter);
      bar.querySelector('[data-go="back"]').onclick = idleBar;
      return;
    }
    const cards = v.owned.map(p => `<button class="pet-card ${p.id === v.active ? "on" : ""}" data-id="${p.id}"><canvas width="72" height="58"></canvas><b>${esc(p.name)}</b></button>`).join("");
    const wild = v.wild ? `<p class="home-title">${K[v.wild.species].emoji} A wild ${v.wild.color} ${K[v.wild.species].name.toLowerCase()} is visiting your garden! Find it and feed it ${v.wild.need} 🍪 (fed ${v.wild.fed}).</p>` : `<p class="home-title">🌙 New visitors come tomorrow.</p>`;
    const sell = v.seller ? `<p class="home-title">🧳 The travelling pet seller has a <b>${v.seller.color} ${K[v.seller.species].name.toLowerCase()}</b> today.</p>` : "";
    bar.innerHTML = `<div class="home-pets"><p class="home-title">🐾 Your pets · tap one to bring it along · 🍪 ${v.treats} treat${v.treats === 1 ? "" : "s"}${v.spots.length ? ` · ${v.spots.length} more hiding around your home` : ""}</p><div class="pet-cards">${cards}</div>${wild}${sell}</div>
      <div class="home-actions">${v.seller ? `<button data-go="buy" class="${view.stars >= v.seller.cost ? "big" : ""}">🧳 Buy ${K[v.seller.species].emoji} ${v.seller.cost}⭐</button>` : ""}${v.active ? `<button data-go="name">✏️ Name</button><button data-go="rest">🏠 Rest</button>` : ""}<button data-go="back">Back</button></div>`;
    bar.querySelectorAll(".pet-card").forEach(b => { const p = v.owned.find(x => x.id === Number(b.dataset.id)); petThumb(b.querySelector("canvas"), p.species, p.color); b.onclick = () => { if (p.id !== v.active) { pet.x = me.x + 0.5; pet.y = me.y; pet.trail = []; } act("petActive", { id: p.id }); }; });
    const go = (k, f) => { const b = bar.querySelector(`[data-go="${k}"]`); if (b) b.onclick = f; };
    go("buy", () => act("petBuy")); go("rest", () => act("petActive", { id: null })); go("back", idleBar);
    go("name", () => { const a = activePet(); const n = a && prompt(`A new name for ${a.name}?`, a.name); if (n) act("petName", { id: a.id, name: n }); });
  }

  function showBag() {
    if (!view) return;
    const C = view.crops, F = view.fish;
    const chip = (emoji, name, n) => `<span class="home-chip">${emoji} ${esc(name)} ×${n}</span>`;
    const seeds = Object.entries(view.seeds).filter(([, n]) => n > 0).map(([k, n]) => chip(C[k].emoji, C[k].name, n)).join("") || "<span>None. Tap an empty bed or the crate to buy some.</span>";
    const bag = Object.entries(view.bag).filter(([, n]) => n > 0).map(([k, n]) => chip(C[k]?.emoji || "🐟", (C[k] || F[k])?.name || k, n)).join("") || "<span>Empty. Grow or catch something!</span>";
    const book = Object.entries(F).map(([k, f]) => `<div class="fish-card ${view.caught[k] ? "" : "unknown"}">${fishIcon(k)}<b>${view.caught[k] ? esc(f.name) : "???"}</b><small>${view.caught[k] ? `caught ${view.caught[k]}` : f.level > (view.me?.level || 1) ? `🔒 Level ${f.level}` : f.biting ? "biting now" : "not biting now"}</small></div>`).join("");
    bar.innerHTML = `<div class="home-scroll"><p class="home-title"><b>🌱 Seeds</b>${seeds}</p><p class="home-title"><b>🎒 Bag</b>${bag}</p><p class="home-title"><b>🐟 Fish book</b><span>${Object.keys(view.caught).length}/${Object.keys(F).length}</span></p><div class="fish-book">${book}</div></div><div class="home-actions"><button>Back</button></div>`;
    bar.querySelector(".home-actions button").onclick = idleBar;
  }

  // --- server replies ---
  function onState(msg) {
    if (msg.error) return opts.toast(msg.error);
    view = msg.home;
    if (view.world) setWorld(view.world);
    if (view.house) houseId = view.house;
    for (const o of view.others || []) {
      const cur = others.get(o.id) || { x: o.x, y: o.y, dir: o.dir, step: 0, name: o.name, id: o.id };
      Object.assign(cur, { tx: o.x, ty: o.y, dir: o.dir, name: o.name, seen: performance.now() }); others.set(o.id, cur);
    }
    for (const [id, o] of others) if (performance.now() - o.seen > 6000) others.delete(id);
    if (bar.querySelector("button")?.textContent.startsWith("🎯")) idleBar();   // keep the goals count fresh
    const quest = bar.querySelector(".home-quest"); if (quest) questBar(quest.dataset.p);   // keep an open level, story, build or book panel fresh
    const r = msg.result;
    if (!r) return;
    if (r.toast) opts.toast(r.toast);
    if (r.xp) floatText(me.x, me.y, 2.1, `+${r.xp} XP`, "#b5e3ff");
    if (r.gave || r.gaveStars) { SFX.coin(); burst(me.x, me.y, 1.2, { n: 8, emoji: r.gave ? "🔨" : "⭐", speed: 50, up: 180, life: 900, size: 5 }); }
    if (r.story) {
      banner(r.story.end ? `📖 The end! <b>${esc(r.story.title)}</b><br>+${r.story.stars}⭐ and ${r.story.treats} 🍪` : `📖 Chapter done! <b>+${r.story.stars}⭐</b>`, r.story.end ? "big" : "");
      if (!view.story.done) banner(`${esc(view.story.guide)}: “${esc(view.story.text)}”`);
      flyStars(me.x, me.y, 1.4, Math.min(8, r.story.stars));
    }
    if (r.stage) { banner(`🔨 Built: <b>${esc(r.stage.name)}!</b><br>Everyone gets +${r.stage.stars}⭐ and ${r.stage.treats} 🍪`, "big"); SFX.goal(); burst(me.x, me.y, 1.6, { n: 30, color: CONFETTI, speed: 160, up: 170, life: 1400, size: 4 }); }
    if (r.book) { banner(`📚 Page finished: <b>${{ fish: "Fish", crops: "Crops", pets: "Pets" }[r.book.page]}!</b><br>Everyone gets +${r.book.stars}⭐`, "big"); SFX.goal(); }
    if (r.levelUp) {
      banner(`⭐ Level ${r.levelUp.level}! <b>+${r.levelUp.stars}⭐</b>${r.levelUp.perks.map(k => `<br>${k.icon} ${esc(k.text)}`).join("")}`, "big");
      SFX.goal(); burst(me.x, me.y, 1.6, { n: 30, color: CONFETTI, speed: 160, up: 170, life: 1400, size: 4 }); navigator.vibrate?.([30, 40, 30]);
    }
    if (r.treat && !r.fish) { burst(me.x, me.y, 0.6, { n: 3, emoji: "🍪", speed: 40, up: 200, life: 900, size: 5 }); floatText(me.x, me.y, 1.5, "+1 🍪"); SFX.pop(); navigator.vibrate?.(20); }
    if (r.fed) burst(me.x, me.y, 0.8, { n: 4, emoji: "💕", speed: 40, up: 140, life: 900, size: 4 });
    if (r.pet) {
      const k = view.pets.kinds[r.pet.species]; pet.x = me.x + 0.5; pet.y = me.y; pet.trail = [];
      banner(`${k.emoji} New pet! <b>${esc(r.pet.name)}</b>`, "big"); SFX.goal(); burst(me.x, me.y, 1.4, { n: 26, color: CONFETTI, speed: 150, up: 160, life: 1300, size: 4 });
      return petsBar();
    }
    if (bar.querySelector(".home-pets") && !r.treat) petsBar();
    if (r.bought) { floatText(me.x, me.y, 1.5, `+${r.bought.n} ${view.crops[r.bought.crop]?.emoji || "🌱"}`); SFX.pop(); }
    if (bar.querySelector(".home-shop")) shopBar();
    if (r.splash != null) {
      splash = { plot: r.splash, at: performance.now() }; const pr = plotRect(r.splash);
      burst(pr.cx, pr.cy, 0.9, { n: 14, color: ["#7cc8ff", "#b5e3ff", "#4aa3e8"], speed: 60, up: 60, gravity: 420, life: 700, size: 3 }); SFX.water();
    }
    if (r.planted != null) { const pr = plotRect(r.planted); burst(pr.cx, pr.cy, 0.2, { n: 10, color: ["#8a5a35", "#a8754a", "#6b4426"], speed: 70, up: 70, life: 550, size: 3 }); SFX.plant(); }
    if (r.harvested) {
      const pr = plotRect(r.plot ?? 0), em = view.crops[r.harvested]?.emoji || "✨";
      burst(pr.cx, pr.cy, 0.5, { n: 16, color: ["#fff6b0", "#ffe27a", "#ffffff"], speed: 110, up: 140, life: 900, size: 3 });
      burst(pr.cx, pr.cy, 0.5, { n: r.count || 1, emoji: em, speed: 40, up: 220, life: 1000, size: 6 });
      floatText(pr.cx, pr.cy, 1.4, `+${r.count || 1} ${em}`); SFX.pop(); navigator.vibrate?.(25);
    }
    if (r.fish && me.target?.cast) { burst(me.target.cast.x, me.target.cast.y, 0, { n: 16, color: ["#7cc8ff", "#ffffff"], speed: 80, up: 150, life: 800, size: 3 }); SFX.fish(); }
    if (r.sold) { flyStars(L.crate[0], L.crate[1], 1, Math.ceil(r.sold / 3)); floatText(L.crate[0], L.crate[1], 1.6, `+${r.sold} ⭐`, "#ffe27a"); }
    for (const gl of r.goals || []) {
      banner(`🎯 Goal done! ${gl.icon} ${esc(gl.text)} <b>+${gl.stars}⭐</b>`);
      setTimeout(() => { if (!isOpen) return; SFX.goal(); burst(me.x, me.y, 1.6, { n: 26, color: CONFETTI, speed: 150, up: 160, life: 1300, size: 4 }); flyStars(me.x, me.y, 1.4, gl.stars); }, 200);
    }
    if (r.allGoals) banner(`🎉 All done today! <b>+${r.allGoals.bonus}⭐</b><br>🔥 ${r.allGoals.streak} day${r.allGoals.streak > 1 ? "s" : ""} in a row`, "big");
    if (r.goals || r.allGoals) { if (!bar.querySelector(".home-goals") && !r.letter && !r.fish) idleBar(); else if (bar.querySelector(".home-goals")) goalsBar(); }
    if (r.letter) {
      return setBar(`✉️ From ${esc(r.letter.from)}: “${esc(r.letter.text)}”<br>🎁 ${esc(r.letter.gift)}`, [{ label: "Thanks!", big: true, go: idleBar }]);
    }
    if (r.fish) { fishing = null; return setBar(`${fishIcon(r.fish, 64)} ${esc(view.fish[r.fish].name)}${r.first ? " · new!" : ""}`, [{ label: "🎣 Again", big: true, go: () => startFishing(me.target) }, { label: "Done", go: idleBar }]); }
  }

  // --- drawing ---
  function faceToward(x, y) { const [ax, ay] = P(me.x, me.y), [bx, by] = P(x, y); me.dir = dirFor(bx - ax, by - ay); }
  function dirFor(dx, dy) {
    // sheet rows: 0 S, 1 SW, 2 W, 3 NW, 4 N, 5 NE, 6 E, 7 SE (screen directions); angle 0 = straight down
    const k = ((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) % DIRS) + DIRS) % DIRS;
    return [0, 7, 6, 5, 4, 3, 2, 1][k];
  }
  function walkerFor(id) {
    const r = opts.resident(id); const s = r?.look?.style || "";
    if (id === "hazel" || id === "olive" || (r && Number(r.profile?.age) > 0 && Number(r.profile.age) < 13)) return /long|pigtails|buns|bunny|ribbons|curls/.test(s) || id === "hazel" || id === "olive" ? "kid_female" : "kid_male";
    if (id === "dad") return "male";
    return /long|pigtails|buns|bunny|ribbons|curls/.test(s) ? "female" : "male";
  }
  function drawSprite(name, x, y) {
    const s = A.sprites[name]; if (!s) return; const [px, py] = P(x, y); const [sx, sy] = toScreen(px - s.ax, py - s.ay);
    ctx.drawImage(imgs.sprites, s.x, s.y, s.w, s.h, sx, sy, s.w * cam.z, s.h * cam.z);
  }
  // Each person's own look (character creator), painted onto the 3D walker; falls back to the plain sheet while it loads.
  function avatarFor(id) {
    const r = opts.resident(id), AV = window.LivingTownAvatar; if (!AV) return null;
    const kid = id === "hazel" || id === "olive" || (Number(r?.profile?.age) > 0 && Number(r.profile.age) < 13);
    const look = opts.look?.(id) || r?.look;
    return AV.sheet(world === "scifi" ? "scifi" : "clay", kid ? "kid" : AV.bodyFor(look, 30), look);   // other worlds use the everyday clothes until they get outfits
  }
  function drawWalker(id, p) {
    const key = walkerFor(id), av = avatarFor(id);
    const w = av || A.walkers[key], img = av ? av.canvas : imgs["walk_" + key]; if (!w || !img) return;
    const [px, py] = P(p.x, p.y), f = p.moving ? Math.floor(p.step * 2.2) % 4 : (img.width >= w.cw * 5 ? 4 : 0);   // frame 4: standing, feet together
    const k = id === "olive" ? 1.18 : 1;   // Olive is a bit older and taller than Hazel
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); const [cx, cy] = toScreen(px, py); ctx.ellipse(cx, cy, 15 * cam.z * 1.6, 6 * cam.z * 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(img, f * w.cw, p.dir * w.ch, w.cw, w.ch, cx - w.ax * cam.z * k, cy - w.ay * cam.z * k, w.cw * cam.z * k, w.ch * cam.z * k);
    if (p.name) { const tall = (key.startsWith("kid") ? 92 * k : 135) * cam.z; ctx.font = `600 ${Math.max(11, 13 * cam.z * 1.4)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(20,30,50,0.75)"; ctx.fillText(p.name, cx, cy - tall); }
  }
  function stepWalker(p, dt) {
    let budget = SPEED * dt; p.moving = false;
    while (budget > 0 && p.path?.length) {
      const n = p.path[0], gap = Math.hypot(n.x - p.x, n.y - p.y);
      if (gap > 0.01) { const [ax, ay] = P(p.x, p.y), [bx, by] = P(n.x, n.y); p.dir = dirFor(bx - ax, by - ay); p.moving = true; }
      if (gap <= budget) { p.x = n.x; p.y = n.y; budget -= gap; p.path.shift(); } else { p.x += (n.x - p.x) / gap * budget; p.y += (n.y - p.y) / gap * budget; budget = 0; }
    }
    if (p.moving) p.step += dt * SPEED;
  }
  function frame(t) {
    if (!isOpen) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000); lastFrame = t;
    try {
      const wasMoving = me.path.length > 0;
      stepWalker(me, dt); stepPet(dt);
      if (wasMoving && !me.path.length && me.target) {
        if (me.target.kind === "pond") faceToward(me.target.cast.x, me.target.cast.y);
        highlight = null;
        if (me.pending) { const go = me.pending; me.pending = null; popAt = null; go(); }
        else if (me.target.kind === "exit") close();
      }
      for (const o of others.values()) {
        const gap = Math.hypot(o.tx - o.x, o.ty - o.y);
        o.moving = gap > 0.05;
        if (o.moving) { const k = Math.min(gap, SPEED * dt * 1.1); o.x += (o.tx - o.x) / gap * k; o.y += (o.ty - o.y) / gap * k; o.step += dt * SPEED; }
      }
      if (t - lastPos > 900) { lastPos = t; act("pos", { x: Math.round(me.x * 100) / 100, y: Math.round(me.y * 100) / 100, dir: me.dir, moving: me.moving }); }
      draw(t);
    } catch (err) { console.error(err); }
  }
  function draw(t) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.z = Math.max(0.38, Math.min(1, cw / 880));   // a bit wider so the garden is in view
    const [px, py] = P(me.x, me.y, 0.9), G = imgs.ground;
    const wantX = Math.max(-40, Math.min(G.width - cw / cam.z + 40, px - cw / cam.z / 2));
    const wantY = Math.max(-40, Math.min(G.height - ch / cam.z + 40, py - ch / cam.z * 0.42));
    if (!cam.ready) { cam.x = wantX; cam.y = wantY; cam.ready = true; }
    cam.x += (wantX - cam.x) * 0.12; cam.y += (wantY - cam.y) * 0.12;
    if (imgs.sky) drawSky(cw, ch); else if (world === "scifi") drawSpace(cw, ch); else { ctx.fillStyle = A.bg || "#7d8fae"; ctx.fillRect(0, 0, cw, ch); }
    const [gx, gy] = toScreen(0, 0); ctx.drawImage(G, gx, gy, G.width * cam.z, G.height * cam.z);
    // everything that stands up, back to front
    const items = [];
    (view?.plots || []).forEach((p, k) => {
      const r = plotRect(k);
      if (k >= view.beds) return;   // not dug yet: just ground
      items.push({ d: r.cx - r.cy - 0.8, draw: () => drawSprite("bed", r.cx, r.cy) });
      if (p.wet) items.push({ d: r.cx - r.cy - 0.6, draw: () => drawSprite("wet", r.cx, r.cy) });
      if (p.crop) items.push({ d: r.cx - r.cy, draw: () => drawSprite(`${p.crop}_${p.growth >= 1 ? 2 : p.growth >= 0.4 ? 1 : 0}`, r.cx, r.cy) });
    });
    L.trees.forEach(([x, y]) => items.push({ d: x - y, draw: () => drawSprite("tree", x, y) }));
    L.bushes.forEach(([x, y]) => items.push({ d: x - y, draw: () => drawSprite("bush", x, y) }));
    (L.lamps || []).forEach(([x, y]) => items.push({ d: x - y, draw: () => drawSprite("lamp", x, y) }));
    (L.decor || []).forEach(([x, y, kind, c]) => items.push({ d: x - y, draw: () => drawSprite(`${kind}_${c}`, x, y) }));
    items.push({ d: L.mailbox[0] - L.mailbox[1], draw: () => drawSprite(view?.mail ? "mailbox_up" : "mailbox", L.mailbox[0], L.mailbox[1]) });
    items.push({ d: L.crate[0] - L.crate[1], draw: () => drawSprite("crate", L.crate[0], L.crate[1]) });
    const pv = view?.pets;
    if (pv) {
      for (const sp of pv.spots) { const [x, y] = spotPos(sp.u, sp.v); items.push({ d: x - y, draw: () => { const [sx, sy] = toScreen(...P(x, y, 0.25)); const bob = Math.sin(t / 260 + sp.i) * 3; ctx.font = `${Math.round(26 * cam.z * 1.4)}px system-ui`; ctx.textAlign = "center"; ctx.fillText("🍪", sx, sy + bob); if ((t / 400 + sp.i) % 3 < 0.4) ctx.fillText("✨", sx + 14 * cam.z, sy - 18 * cam.z); } }); }
      if (pv.wild) { const [x, y] = spotPos(pv.wild.u, pv.wild.v), wp = { x, y, dir: 0, moving: false }; const [ax, ay] = P(x, y), [bx, by] = P(me.x, me.y); wp.dir = dirFor(bx - ax, by - ay); items.push({ d: x - y, draw: () => drawPet(pv.wild, wp, pv.wild.fed ? `💕 ${pv.wild.fed}/${pv.wild.need}` : "❔") }); }
      const ap = activePet(); if (ap) items.push({ d: pet.x - pet.y, person: pet, draw: () => drawPet(ap, pet) });
    }
    const people = [{ id: opts.me(), p: me }, ...[...others.values()].map(o => ({ id: o.id, p: o }))];
    people.forEach(({ id, p }) => items.push({ d: p.x - p.y, person: p, draw: () => drawWalker(id, p) }));
    const H = L.house, ha = houseArt(), house = { house: true, draw: () => { const [sx, sy] = toScreen(ha.r.x, ha.r.y); ctx.drawImage(ha.img, sx, sy, ha.r.w * cam.z, ha.r.h * cam.z); } };
    items.sort((a, b) => a.d - b.d);
    // the house goes in just before the first thing standing in front of it
    const inFront = it => { const p = it.person; const x = p ? p.x : it.d, y = p ? p.y : 0; return p ? (x >= H.x1 || y <= H.y0) : it.d > H.x1 - H.y0; };
    let drawnHouse = false;
    for (const it of items) { if (!drawnHouse && inFront(it)) { house.draw(); drawnHouse = true; } it.draw(); }
    if (!drawnHouse) house.draw();
    drawHighlight(t);
    drawFx(t);
    // tap marker, splash, fishing bobber
    if (marker && t - marker.at < 700) { const [sx, sy] = toScreen(...P(marker.x, marker.y)); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 16 * (1 - (t - marker.at) / 900), 7 * (1 - (t - marker.at) / 900), 0, 0, Math.PI * 2); ctx.stroke(); }
    if (splash && t - splash.at < 900) { const r = plotRect(splash.plot); const [sx, sy] = toScreen(...P(r.cx, r.cy)); ctx.font = "26px system-ui"; ctx.textAlign = "center"; ctx.fillText("💧", sx, sy - 30 - (t - splash.at) / 30); }
    if (fishing) {
      const bite = t >= fishing.biteAt && t < fishing.biteAt + 1000, [sx, sy] = toScreen(...P(fishing.x, fishing.y));
      const [hx, hy] = toScreen(...P(me.x, me.y, 1.2));
      ctx.strokeStyle = "rgba(60,60,60,0.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + sx) / 2, Math.min(hy, sy) - 30, sx, sy); ctx.stroke();
      const bob = bite ? 5 : Math.sin(t / 300) * 1.5;
      ctx.fillStyle = "#e5484d"; ctx.beginPath(); ctx.arc(sx, sy + bob, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy + bob - 3, 3, Math.PI, 0); ctx.fill();
      if (bite) { ctx.font = "700 34px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#e5484d"; ctx.fillText("!", sx, sy - 18); if (fishing.phase === "wait") { fishing.phase = "bite"; navigator.vibrate?.(80); bar.querySelector("button.big")?.classList.add("pulse"); } }
      if (t > fishing.biteAt + 1000 && fishing.phase !== "caught") { fishing = null; opts.toast("It got away! Try again."); idleBar(); }
    }
    const topHtml = `<b>🏡 Home</b><span class="home-right">${view?.streak ? `<span class="home-streak">🔥 ${view.streak}</span>` : ""}${view?.me ? `<span class="home-streak">Lv ${view.me.level}</span>` : ""}<span class="home-stars">⭐ ${view?.stars ?? 0}</span></span>`;
    if (top.dataset.html !== topHtml) { top.innerHTML = topHtml; top.dataset.html = topHtml; }
  }

  // --- open / close ---
  function onTap(e) {
    if (!isOpen || !A) return;
    const rect = canvas.getBoundingClientRect(), [px, py] = fromScreen(e.clientX - rect.left, e.clientY - rect.top);
    // Tap another family member: wave.
    for (const o of others.values()) { const [ox, oy] = P(o.x, o.y); if (Math.abs(px - ox) < 30 && py > oy - 140 && py < oy + 10) { opts.toast(`👋 You waved at ${o.name}!`); return; } }
    const t = targetAt(px, py);
    if (t.kind === "walk") { hidePop(); walkTo(t); return; }
    showPop(t, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  }
  function open() {
    if (!opts.me()) return opts.toast("Sign in to visit your home.");
    el.classList.remove("hidden"); isOpen = true; lastFrame = 0;
    load().then(() => {
      if (!me.placed) { me.x = L.spawn[0]; me.y = L.spawn[1]; me.placed = true; pet.x = me.x + 0.5; pet.y = me.y; pet.trail = []; }
      act("enter"); idleBar(); cam.ready = false; requestAnimationFrame(frame);
    }).catch(err => { console.error(err); opts.toast("The home plot couldn't load."); close(); });
  }
  function close() { if (!isOpen) return; isOpen = false; fishing = null; hidePop(); el.classList.add("hidden"); act("leave"); me.placed = false; opts.onClose?.(); }

  window.LivingTownHome = {
    init(o) {
      opts = o;
      el = document.createElement("div"); el.id = "homestead"; el.className = "homestead hidden";
      el.innerHTML = `<canvas></canvas><div class="home-top"></div><div class="home-bar"></div><div class="home-pop hidden"></div>`;
      document.body.appendChild(el);
      canvas = el.querySelector("canvas"); ctx = canvas.getContext("2d"); top = el.querySelector(".home-top"); bar = el.querySelector(".home-bar"); pop = el.querySelector(".home-pop");
      canvas.addEventListener("click", onTap);
    },
    open, close, onState, get isOpen() { return isOpen; },
    _test: { route: (x, y) => route(x, y), blockedAt: (x, y) => blockedAt(x, y), plotTarget: k => { const r = plotRect(k); return { x: r.cx + 0.2, y: r.y0 - 0.25 }; }, screenOf: (x, y) => toScreen(...P(x, y)), plotRect: k => plotRect(k), me, view: () => view, L: () => L, petTargets: () => petTargets(), pet }
  };
})();
