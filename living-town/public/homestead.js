/* The home plot: your family's own garden, pond, crate and mailbox (lib/homestead.js on the server).
 * Art comes from art/blender (white clay template for now) packed into public/homestead/.
 * Walking works like inside buildings: your phone moves you straight away. */
(function () {
  "use strict";
  let BASE = "homestead/";
  // Worlds: same plot and gameplay, different paint. Art for each lives in homestead/worlds/<id>/.
  const WORLDS = { clay: { name: "Clay", icon: "🤍", dir: "homestead/" }, scifi: { name: "Sci-fi", icon: "🚀", dir: "homestead/worlds/scifi/" } };
  let world = "clay";
  const SPEED = 5;            // metres per second (2.6 felt far too slow on a phone)
  const CELL = 0.25;          // walk grid
  const DIRS = 8;
  let L = null, A = null, imgs = {}, ready = null;
  let opts = null, canvas, ctx, bar, top, el, isOpen = false;
  let grid = null, N = 0;
  const me = { x: 10, y: 12.6, dir: 0, path: [], moving: false, step: 0, target: null };
  let view = null, others = new Map(), cam = { x: 0, y: 0, z: 0.6 }, lastPos = 0, lastFrame = 0, fishing = null, marker = null, splash = null;

  function load() {
    if (ready) return ready;
    const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = BASE + src; });
    ready = Promise.all([fetch("homestead/layout.json").then(r => r.json()), fetch(BASE + "art.json").then(r => r.json())]).then(async ([layout, art]) => {
      const names = ["ground", "house", "sprites", ...Object.keys(art.walkers).map(k => "walk_" + k)];
      const loaded = await Promise.all(names.map(n => img(n + ".webp")));
      L = layout; A = art; names.forEach((n, i) => { imgs[n] = loaded[i]; });
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
  function targetAt(px, py) {
    const w = unP(px, py);
    if (spriteHit(view?.mail ? "mailbox_up" : "mailbox", L.mailbox[0], L.mailbox[1], px, py)) return { kind: "mailbox", x: L.mailbox[0] + 0.3, y: L.mailbox[1] - 0.6 };
    if (spriteHit("crate", L.crate[0], L.crate[1], px, py)) return { kind: "crate", x: L.crate[0] + 0.9, y: L.crate[1] };
    const h = A.house; if (px > h.x && px < h.x + h.w && py > h.y && py < h.y + h.h) {
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
  function setBar(title, buttons) {
    bar.innerHTML = `${title ? `<p class="home-title">${title}</p>` : ""}<div class="home-actions">${buttons.map((b, i) => `<button data-i="${i}" ${b.off ? "disabled" : ""} class="${b.big ? "big" : ""}">${b.label}</button>`).join("")}</div>`;
    bar.querySelectorAll("button").forEach(btn => { btn.onclick = () => buttons[Number(btn.dataset.i)].go(); });
  }
  function idleBar() {
    setBar("", [{ label: "🎒 Bag", go: showBag }, { label: "🌍 World", go: worldBar }, { label: "🏘️ To town", go: () => walkTo({ kind: "exit", x: L.exit[0], y: L.exit[1] }) }]);
  }
  function worldBar() {
    setBar("Pick your world. Your family all sees the same one.", [...Object.entries(WORLDS).map(([k, w]) => ({ label: `${w.icon} ${w.name}`, big: k === world, go: () => { act("world", { world: k }); idleBar(); } })), { label: "Back", go: idleBar }]);
  }
  function setWorld(k) {
    if (!WORLDS[k] || k === world) return;
    world = k; BASE = WORLDS[k].dir; const keep = { ...me }; ready = null;
    load().then(() => Object.assign(me, keep)).catch(err => console.error(err));
  }
  function act(action, extra = {}) { opts.send({ type: "home", action, ...extra }); }
  function contextBar(t) {
    if (!view) return idleBar();
    const C = view.crops;
    if (t.kind === "plot") {
      const p = view.plots[t.plot];
      if (t.plot >= view.beds) return view.upgrade
        ? setBar(`🔒 Not dug yet. Upgrade at the crate (${view.upgrade.cost} ⭐) for ${view.upgrade.beds} beds.`, [{ label: "OK", go: idleBar }])
        : idleBar();
      if (!p.crop) {
        const seeds = Object.entries(view.seeds).filter(([, n]) => n > 0);
        if (!seeds.length) return setBar("No seeds. The crate by the house sells them.", [{ label: "OK", go: idleBar }]);
        return setBar("Plant something:", seeds.map(([k, n]) => ({ label: `${C[k].emoji} ${C[k].name} ×${n}`, go: () => act("plant", { plot: t.plot, crop: k }) })));
      }
      if (p.growth >= 1) return setBar(`${C[p.crop].emoji} Ready to pick!`, [{ label: "🧺 Pick", big: true, go: () => act("harvest", { plot: t.plot }) }]);
      return setBar(`${C[p.crop].emoji} ${C[p.crop].name}: ${Math.round(p.growth * 100)}% grown${p.wet ? " · watered" : ""}`, [{ label: "💧 Water", big: !p.wet, go: () => act("water", { plot: t.plot }) }, { label: "Done", go: idleBar }]);
    }
    if (t.kind === "pond") return setBar("The pond", [{ label: "🎣 Fish", big: true, go: () => startFishing(t) }, { label: "Done", go: idleBar }]);
    if (t.kind === "crate") {
      const n = Object.entries(view.bag).filter(([k]) => C[k] || view.fish[k]).reduce((s, [, v]) => s + v, 0);
      return setBar(`📦 Shipping crate · you have ${view.stars} ⭐`, [{ label: `Sell all (${n})`, big: n > 0, off: !n, go: () => act("sell") },
        ...(view.upgrade ? [{ label: `🌱 Bigger garden ${view.upgrade.cost}⭐`, big: view.stars >= view.upgrade.cost, off: view.stars < view.upgrade.cost, go: () => act("upgrade") }] : []),
        ...view.shop.map(k => [k, C[k]]).map(([k, c]) => ({ label: `🌱 ${c.emoji} ${c.seed}⭐`, off: view.stars < c.seed, go: () => act("buy", { crop: k }) }))]);
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
  function walkTo(t) {
    fishing = null;
    me.target = t; me.path = route(t.x, t.y); marker = { x: t.x, y: t.y, at: performance.now() };
    if (t.kind !== "walk") setBar("", [{ label: "…", off: true, go() {} }]); else idleBar();
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
  function showBag() {
    if (!view) return;
    const C = view.crops, F = view.fish;
    const seeds = Object.entries(view.seeds).filter(([, n]) => n > 0).map(([k, n]) => `${C[k].emoji} ${C[k].name} seeds ×${n}`).join(" · ") || "none";
    const bag = Object.entries(view.bag).filter(([, n]) => n > 0).map(([k, n]) => `${C[k]?.emoji || "🐟"} ${(C[k] || F[k])?.name || k} ×${n}`).join(" · ") || "empty";
    const book = Object.entries(F).map(([k, f]) => `<div class="fish-card ${view.caught[k] ? "" : "unknown"}">${sprIcon("fish_" + k)}<b>${view.caught[k] ? esc(f.name) : "???"}</b><small>${view.caught[k] ? `caught ${view.caught[k]}` : f.biting ? "biting now" : "not biting now"}</small></div>`).join("");
    bar.innerHTML = `<p class="home-title">🎒 Seeds: ${seeds}</p><p class="home-title">Bag: ${bag}</p><p class="home-title">🐟 Fish book · ${Object.keys(view.caught).length}/${Object.keys(F).length}</p><div class="fish-book">${book}</div><div class="home-actions"><button>Close</button></div>`;
    bar.querySelector(".home-actions button").onclick = idleBar;
  }

  // --- server replies ---
  function onState(msg) {
    if (msg.error) return opts.toast(msg.error);
    view = msg.home;
    if (view.world) setWorld(view.world);
    for (const o of view.others || []) {
      const cur = others.get(o.id) || { x: o.x, y: o.y, dir: o.dir, step: 0, name: o.name, id: o.id };
      Object.assign(cur, { tx: o.x, ty: o.y, dir: o.dir, name: o.name, seen: performance.now() }); others.set(o.id, cur);
    }
    for (const [id, o] of others) if (performance.now() - o.seen > 6000) others.delete(id);
    const r = msg.result;
    if (!r) return;
    if (r.toast) opts.toast(r.toast);
    if (r.splash != null) splash = { plot: r.splash, at: performance.now() };
    if (r.letter) {
      return setBar(`✉️ From ${esc(r.letter.from)}: “${esc(r.letter.text)}”<br>🎁 ${esc(r.letter.gift)}`, [{ label: "Thanks!", big: true, go: idleBar }]);
    }
    if (r.fish) { fishing = null; return setBar(`${sprIcon("fish_" + r.fish, 64)} ${esc(view.fish[r.fish].name)}${r.first ? " · new!" : ""}`, [{ label: "🎣 Again", big: true, go: () => startFishing(me.target) }, { label: "Done", go: idleBar }]); }
    if (me.target && me.target.kind !== "walk" && !me.path.length) contextBar(me.target);
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
    if (id === "hazel" || (r && Number(r.profile?.age) > 0 && Number(r.profile.age) < 11)) return "kid_female";
    if (id === "dad") return "male";
    return /long|pigtails|buns|bunny|ribbons|curls/.test(s) || id === "olive" ? "female" : "male";
  }
  function drawSprite(name, x, y) {
    const s = A.sprites[name]; if (!s) return; const [px, py] = P(x, y); const [sx, sy] = toScreen(px - s.ax, py - s.ay);
    ctx.drawImage(imgs.sprites, s.x, s.y, s.w, s.h, sx, sy, s.w * cam.z, s.h * cam.z);
  }
  function drawWalker(id, p) {
    const key = walkerFor(id), w = A.walkers[key], img = imgs["walk_" + key]; if (!w || !img) return;
    const [px, py] = P(p.x, p.y), f = p.moving ? Math.floor(p.step * 2.2) % 4 : 0;
    const [sx, sy] = toScreen(px - w.ax, py - w.ay);
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); const [cx, cy] = toScreen(px, py); ctx.ellipse(cx, cy, 15 * cam.z * 1.6, 6 * cam.z * 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(img, f * w.cw, p.dir * w.ch, w.cw, w.ch, sx, sy, w.cw * cam.z, w.ch * cam.z);
    if (p.name) { const tall = (key.startsWith("kid") ? 92 : 135) * cam.z; ctx.font = `600 ${Math.max(11, 13 * cam.z * 1.4)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(20,30,50,0.75)"; ctx.fillText(p.name, cx, cy - tall); }
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
      stepWalker(me, dt);
      if (wasMoving && !me.path.length && me.target) {
        if (me.target.kind === "pond") faceToward(me.target.cast.x, me.target.cast.y);
        if (me.target.kind !== "walk") contextBar(me.target);
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
    if (world === "scifi") drawSpace(cw, ch); else { ctx.fillStyle = A.bg || "#7d8fae"; ctx.fillRect(0, 0, cw, ch); }
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
    const people = [{ id: opts.me(), p: me }, ...[...others.values()].map(o => ({ id: o.id, p: o }))];
    people.forEach(({ id, p }) => items.push({ d: p.x - p.y, person: p, draw: () => drawWalker(id, p) }));
    const H = L.house, house = { house: true, draw: () => { const [sx, sy] = toScreen(A.house.x, A.house.y); ctx.drawImage(imgs.house, sx, sy, A.house.w * cam.z, A.house.h * cam.z); } };
    items.sort((a, b) => a.d - b.d);
    // the house goes in just before the first thing standing in front of it
    const inFront = it => { const p = it.person; const x = p ? p.x : it.d, y = p ? p.y : 0; return p ? (x >= H.x1 || y <= H.y0) : it.d > H.x1 - H.y0; };
    let drawnHouse = false;
    for (const it of items) { if (!drawnHouse && inFront(it)) { house.draw(); drawnHouse = true; } it.draw(); }
    if (!drawnHouse) house.draw();
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
    top.innerHTML = `<b>🏡 Home</b><span>⭐ ${view?.stars ?? 0}</span>`;
  }

  // --- open / close ---
  function onTap(e) {
    if (!isOpen || !A) return;
    const rect = canvas.getBoundingClientRect(), [px, py] = fromScreen(e.clientX - rect.left, e.clientY - rect.top);
    // Tap another family member: wave.
    for (const o of others.values()) { const [ox, oy] = P(o.x, o.y); if (Math.abs(px - ox) < 30 && py > oy - 140 && py < oy + 10) { opts.toast(`👋 You waved at ${o.name}!`); return; } }
    walkTo(targetAt(px, py));
  }
  function open() {
    if (!opts.me()) return opts.toast("Sign in to visit your home.");
    el.classList.remove("hidden"); isOpen = true; lastFrame = 0;
    load().then(() => {
      if (!me.placed) { me.x = L.spawn[0]; me.y = L.spawn[1]; me.placed = true; }
      act("enter"); idleBar(); cam.ready = false; requestAnimationFrame(frame);
    }).catch(err => { console.error(err); opts.toast("The home plot couldn't load."); close(); });
  }
  function close() { if (!isOpen) return; isOpen = false; fishing = null; el.classList.add("hidden"); act("leave"); me.placed = false; opts.onClose?.(); }

  window.LivingTownHome = {
    init(o) {
      opts = o;
      el = document.createElement("div"); el.id = "homestead"; el.className = "homestead hidden";
      el.innerHTML = `<canvas></canvas><div class="home-top"></div><div class="home-bar"></div>`;
      document.body.appendChild(el);
      canvas = el.querySelector("canvas"); ctx = canvas.getContext("2d"); top = el.querySelector(".home-top"); bar = el.querySelector(".home-bar");
      canvas.addEventListener("click", onTap);
    },
    open, close, onState, get isOpen() { return isOpen; }
  };
})();
