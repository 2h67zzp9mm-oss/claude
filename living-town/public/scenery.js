/**
 * The living map: day and night, lamplight and lit windows, moving water,
 * chimney smoke, and gentle animals (ducks, birds, a town cat, butterflies,
 * fireflies). Everything is drawn on the phone over the painted map; the
 * positions below were traced from it (960x640 map units). Animals are
 * ambient: each phone runs its own, so they needn't match exactly.
 * Exposes `LivingTownScenery` for client.js.
 */
(function (root) {
  "use strict";

  // --- Traced from the painted map ---
  const LAMPS = [[197, 90], [311, 90], [272, 185], [316, 210], [386, 184], [314, 270], [212, 275], [47, 315], [384, 318],
    [541, 100], [552, 120], [769, 165], [833, 132], [899, 57], [621, 250], [798, 275], [889, 285], [693, 305], [256, 409],
    [181, 492], [313, 452], [311, 542], [567, 322], [687, 389], [762, 433], [877, 435], [703, 550], [877, 547], [864, 327],
    [945, 402], [956, 570]];
  // Chimneys and windows per building (ids match shared/world.js).
  const CHIMNEYS = { seanHouse: [[516, 395]], miloHouse: [[590, 402]], roseCottage: [[364, 387], [411, 387]], cafe: [[722, 22], [737, 30]], workshop: [[120, 350]] };
  const WINDOWS = {
    seanHouse: [[495, 457], [517, 497], [555, 440]],
    miloHouse: [[595, 475], [636, 475], [615, 452], [594, 510], [636, 510]],
    roseCottage: [[343, 465], [382, 470], [438, 468], [376, 510]],
    finnCottage: [[129, 228]],
    cafe: [[665, 92], [690, 92], [715, 92], [595, 115], [765, 117]],
    workshop: [[165, 425]],
    bigTop: [[852, 420]]
  };
  const POND = { x: 115, y: 117, rx: 52, ry: 16 };
  const WATER = [POND, { x: 905, y: 228, rx: 30, ry: 22 }, { x: 830, y: 572, rx: 70, ry: 40 }, { x: 38, y: 500, rx: 30, ry: 70 }, { x: 930, y: 545, rx: 25, ry: 20 }];
  const FALLS = [[760, 522], [890, 190], [30, 560], [120, 572]];
  const FOUNTAIN = { x: 473, y: 212, basinY: 255, radius: 26 };
  const FLOWERS = [[270, 240], [330, 140], [560, 160], [640, 210], [760, 470], [610, 535], [130, 300], [440, 225], [505, 225]];
  const CAT_SPOTS = [[430, 300], [520, 300], [610, 220], [690, 330], [780, 420], [470, 520], [300, 300], [230, 160]];
  const BIRD_AREAS = [[477, 300, 70, 25], [470, 170, 40, 20], [640, 300, 30, 15], [300, 470, 30, 15]];

  function hourNow(now) { const d = new Date(now); return d.getHours() + d.getMinutes() / 60; }

  /**
   * How dark it is (0 = midday, about 0.6 = night) and the tint for the
   * time of day: dawn pink, golden evening, dusky blue.
   */
  function skyAt(now) {
    const h = hourNow(now);
    const ramp = (a, b) => Math.max(0, Math.min(1, (h - a) / (b - a)));
    let dark, tint;
    if (h < 5.5 || h >= 21) { dark = 0.58; tint = null; }
    else if (h < 7.5) { dark = 0.58 * (1 - ramp(5.5, 7.5)); tint = [255, 170, 150, 0.14 * (1 - Math.abs(ramp(5.5, 7.5) - 0.5) * 2)]; }
    else if (h < 17.5) { dark = 0; tint = null; }
    else if (h < 19.5) { dark = 0.08 * ramp(17.5, 19.5); tint = [255, 150, 60, 0.1 + 0.1 * ramp(17.5, 19.5)]; }
    else { dark = 0.1 + 0.48 * ramp(19.5, 21); tint = [110, 70, 170, 0.15 * (1 - ramp(19.5, 21))]; }
    return { dark, tint, lampsOn: dark > 0.15 || h >= 19.5 || h < 6.5, day: dark < 0.2, night: dark > 0.4 };
  }

  function create({ MAP, random = Math.random }) {
    const rnd = (a, b) => a + random() * (b - a);
    const inEllipse = (p, e) => ((p.x - e.x) / e.rx) ** 2 + ((p.y - e.y) / e.ry) ** 2 <= 1;
    const pointIn = e => { const a = random() * Math.PI * 2, r = Math.sqrt(random()); return { x: e.x + Math.cos(a) * r * e.rx, y: e.y + Math.sin(a) * r * e.ry }; };

    const ducks = [0, 1, 2].map(i => ({ ...pointIn(POND), tx: POND.x, ty: POND.y, next: 0, dir: 1, color: i === 2 ? "#f2c14e" : "#f4f1ea" }));
    const birds = Array.from({ length: 6 }, () => newBird());
    const butterflies = FLOWERS.slice(0, 7).map(([x, y], i) => ({ ox: x, oy: y, phase: i * 1.7, color: ["#ffd166", "#ff6f91", "#a98cff", "#64b5f6"][i % 4] }));
    const fireflies = Array.from({ length: 26 }, (_, i) => ({ x: rnd(60, 340), y: rnd(50, 210), phase: i * 0.9, vx: 0, vy: 0, ...(i > 17 ? { x: rnd(760, 900), y: rnd(520, 600) } : {}) }));
    const cat = { x: CAT_SPOTS[0][0], y: CAT_SPOTS[0][1], tx: CAT_SPOTS[0][0], ty: CAT_SPOTS[0][1], state: "nap", until: 0, following: null, facing: 1 };
    const smoke = [];
    const sparkles = [];
    let lightCache = { key: "", canvas: null, glow: null };

    function newBird() {
      const [x, y, w, h] = BIRD_AREAS[Math.floor(random() * BIRD_AREAS.length)];
      return { x: x + rnd(-w, w), y: y + rnd(-h, h), state: "hop", fly: 0, back: 0, hopAt: 0, dx: 0, dy: 0 };
    }

    // --- Update ---
    function update(dt, now, { residents, occupied, awakeInside }) {
      const t = performance.now() / 1000;
      const sky = skyAt(now);
      const people = residents.filter(r => r.visible);

      // Ducks drift about the pond, and toward anyone watching them.
      const watcher = people.find(r => /ducks/.test(r.activity || "") && Math.hypot(r.x - POND.x, r.y - POND.y) < 120);
      for (const d of ducks) {
        if (t > d.next) {
          const target = watcher && random() < 0.7 ? { x: watcher.x + rnd(-14, 14), y: watcher.y - 10 } : pointIn(POND);
          const clamped = inEllipse(target, POND) ? target : { x: POND.x + (target.x - POND.x) * 0.8, y: POND.y + Math.sign(target.y - POND.y) * POND.ry * 0.8 };
          d.tx = clamped.x; d.ty = inEllipse(clamped, POND) ? clamped.y : POND.y; d.next = t + rnd(3, 8);
        }
        const k = Math.min(1, dt * 0.35);
        if (Math.abs(d.tx - d.x) > 0.5) d.dir = Math.sign(d.tx - d.x);
        d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k;
      }

      // Birds hop about by day and fly off when someone comes close.
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        if (b.state === "hop") {
          if (people.some(r => Math.hypot(r.x - b.x, r.y - b.y) < 24) || !sky.day) { b.state = "fly"; b.dx = rnd(-40, 40); b.dy = -rnd(60, 90); b.fly = 0; continue; }
          if (t > b.hopAt) { b.x += rnd(-5, 5); b.y += rnd(-3, 3); b.hopAt = t + rnd(0.6, 2.2); b.hop = t; }
        } else if (b.state === "fly") {
          b.fly += dt; b.x += b.dx * dt; b.y += b.dy * dt;
          if (b.fly > 2.5) { b.state = "away"; b.back = t + rnd(20, 45); }
        } else if (t > b.back && sky.day) birds[i] = newBird();
      }

      // Marmalade the cat: naps, strolls between sunny spots, sometimes follows someone.
      cat.following = cat.following && people.find(r => r.name === cat.following.name) || null;
      if (cat.following && Math.hypot(cat.following.x - cat.x, cat.following.y - cat.y) > 70) cat.following = null;
      if (!cat.following && cat.state !== "nap") {
        const near = people.find(r => Math.hypot(r.x - cat.x, r.y - cat.y) < 26);
        if (near && random() < dt * 0.3) { cat.following = near; cat.state = "walk"; cat.until = t + rnd(20, 40); }
      }
      if (cat.following) { cat.tx = cat.following.x - 10 * cat.facing; cat.ty = cat.following.y + 3; if (t > cat.until) cat.following = null; }
      else if (t > cat.until) {
        if (cat.state === "nap" || random() < 0.4) {
          const spot = sky.night ? [505, 470] : CAT_SPOTS[Math.floor(random() * CAT_SPOTS.length)];
          cat.tx = spot[0] + rnd(-8, 8); cat.ty = spot[1] + rnd(-5, 5); cat.state = "walk"; cat.until = t + 60;
        } else { cat.state = "nap"; cat.until = t + rnd(30, 90); }
      }
      const gap = Math.hypot(cat.tx - cat.x, cat.ty - cat.y);
      if (gap > 1.5) {
        const step = Math.min(gap, 16 * dt);
        if (Math.abs(cat.tx - cat.x) > 1) cat.facing = Math.sign(cat.tx - cat.x);
        cat.x += (cat.tx - cat.x) / gap * step; cat.y += (cat.ty - cat.y) / gap * step;
        cat.moving = true;
      } else {
        cat.moving = false;
        if (cat.state === "walk" && !cat.following) { cat.state = "sit"; cat.until = t + rnd(8, 25); }
      }

      // Chimney smoke where someone's up and about, and at the cafe while it's open.
      for (const [id, spots] of Object.entries(CHIMNEYS)) {
        if (!awakeInside(id)) continue;
        for (const [x, y] of spots) if (random() < dt * 0.9) smoke.push({ x: x + rnd(-1, 1), y, life: 0, max: rnd(3, 5), drift: rnd(3, 7) });
      }
      for (const s of smoke) { s.life += dt; s.y -= 6 * dt; s.x += s.drift * dt; }
      while (smoke.length && smoke[0].life > smoke[0].max) smoke.shift();
      if (smoke.length > 60) smoke.splice(0, smoke.length - 60);

      // Sparkles on the water and foam at the falls.
      if (random() < dt * 8) { const w = WATER[Math.floor(random() * WATER.length)]; sparkles.push({ ...pointIn(w), life: 0, max: rnd(0.5, 1.1), foam: false }); }
      if (random() < dt * 6) { const [x, y] = FALLS[Math.floor(random() * FALLS.length)]; sparkles.push({ x: x + rnd(-6, 6), y: y + rnd(-3, 3), life: 0, max: rnd(0.4, 0.8), foam: true }); }
      for (const s of sparkles) s.life += dt;
      while (sparkles.length && sparkles[0].life > sparkles[0].max) sparkles.shift();

      for (const f of fireflies) { f.vx += rnd(-8, 8) * dt; f.vy += rnd(-8, 8) * dt; f.vx *= 0.96; f.vy *= 0.96; f.x += f.vx * dt; f.y += f.vy * dt; }
      return sky;
    }

    // --- Drawing ---
    function px(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

    /** Water, fountain, smoke and animals: drawn under the residents. */
    function drawBelow(ctx, sky) {
      const t = performance.now() / 1000;
      ctx.save();
      for (const s of sparkles) {
        const a = Math.sin(Math.PI * s.life / s.max);
        ctx.globalAlpha = a * (s.foam ? 0.85 : 0.7);
        px(ctx, s.x, s.y, s.foam ? 2 : 1.4, s.foam ? 1.4 : 1.4, s.foam ? "#ffffff" : "#e8f7ff");
      }
      // The fountain: arcs of droplets from the top tier into the basin.
      for (let i = 0; i < 18; i++) {
        const phase = (t * 0.9 + i / 18) % 1;
        const angle = (i / 18) * Math.PI * 2;
        const x = FOUNTAIN.x + Math.cos(angle) * FOUNTAIN.radius * phase;
        const y = FOUNTAIN.y + (FOUNTAIN.basinY - FOUNTAIN.y) * phase * phase - Math.sin(Math.PI * phase) * 9 + Math.sin(angle) * 6 * phase;
        ctx.globalAlpha = 0.75 * (1 - phase * 0.6);
        px(ctx, x, y, 1.3, 1.6, "#dff6ff");
      }
      for (const s of smoke) {
        ctx.globalAlpha = 0.35 * (1 - s.life / s.max);
        const r = 1.5 + s.life * 1.3;
        ctx.fillStyle = sky.night ? "#9aa3b5" : "#e8e8ee";
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Ducks: bobbing, with a little wake.
      for (const d of ducks) {
        const bob = Math.sin(t * 2 + d.x) * 0.4;
        ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1.5, 1.5);
        ctx.globalAlpha = 0.35; px(ctx, -4 * d.dir, 2, 3, 0.8, "#ffffff"); ctx.globalAlpha = 1;
        px(ctx, -3, -1 + bob, 6, 3, d.color); px(ctx, -3, 1 + bob, 6, 1, "#c9c1b3");
        px(ctx, 2 * d.dir - (d.dir < 0 ? 1 : 0), -3 + bob, 2, 2, d.color === "#f2c14e" ? "#f2c14e" : "#3a7d44");
        px(ctx, 3.5 * d.dir - (d.dir < 0 ? 1 : 0), -2 + bob, 1.4, 0.9, "#f4a261");
        ctx.restore();
      }
      // Birds.
      for (const b of birds) {
        if (b.state === "away") continue;
        const flap = b.state === "fly" ? Math.sin(t * 25) > 0 : false;
        const hop = b.state === "hop" && t - (b.hop || 0) < 0.2 ? -1 : 0;
        ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1.4, 1.4);
        ctx.globalAlpha = b.state === "fly" ? Math.max(0, 1 - b.fly / 2.5) : 1;
        if (b.state === "hop") { ctx.globalAlpha = 0.3; px(ctx, -1.5, 1.2, 3, 0.8, "#000"); ctx.globalAlpha = 1; }
        px(ctx, -1.5, -1 + hop, 3, 2, "#6b4a3a");
        px(ctx, 1.2, -1.8 + hop, 1.2, 1.2, "#6b4a3a");
        px(ctx, 2.2, -1.3 + hop, 0.8, 0.6, "#f4a261");
        if (b.state === "fly") px(ctx, -2.5, -(flap ? 3 : 1), 5, 1, "#6b4a3a");
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // Butterflies by day.
      if (sky.day) for (const bf of butterflies) {
        const x = bf.ox + Math.sin(t * 0.7 + bf.phase) * 14 + Math.sin(t * 1.9 + bf.phase) * 4;
        const y = bf.oy + Math.cos(t * 0.9 + bf.phase) * 8 - 6;
        const open = Math.sin(t * 14 + bf.phase) > 0;
        px(ctx, x - (open ? 2 : 1), y, open ? 1.6 : 1, 1.6, bf.color);
        px(ctx, x + (open ? 0.6 : 0.2), y, open ? 1.6 : 1, 1.6, bf.color);
      }
      drawCat(ctx, t);
      ctx.restore();
    }

    function drawCat(ctx, t) {
      ctx.save(); ctx.translate(cat.x, cat.y); ctx.scale(1.35, 1.35);
      drawCatShape(ctx, t);
      ctx.restore();
    }

    function drawCatShape(ctx, t) {
      const x = 0, y = 0, f = cat.facing;
      const o = "#b5651d", l = "#f4a261";
      ctx.globalAlpha = 0.3; px(ctx, x - 4, y + 0.5, 8, 1.2, "#000"); ctx.globalAlpha = 1;
      if (cat.state === "nap" && !cat.moving) {
        // Curled up, with a slow z.
        px(ctx, x - 3.5, y - 3, 7, 3.5, o); px(ctx, x - 2.5, y - 3.8, 5, 1, l);
        px(ctx, x + 2 * f - (f < 0 ? 2 : 0), y - 4, 2, 2, o);
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t); px(ctx, x + 4 * f, y - 8 - (t % 2) * 2, 1.5, 1.5, "#ffffff"); ctx.globalAlpha = 1;
        return;
      }
      const step = cat.moving ? Math.floor(t * 8) % 2 : 0;
      px(ctx, x - 3.5, y - 4, 7, 3, o); px(ctx, x - 3, y - 4.5, 6, 1, l);
      px(ctx, x - 3 + step, y - 1, 1, 1.5, o); px(ctx, x + 2 - step, y - 1, 1, 1.5, o);
      const hx = x + 3.5 * f - (f < 0 ? 3 : 0);
      px(ctx, hx, y - 6.5, 3, 3, o); px(ctx, hx, y - 7.5, 1, 1, o); px(ctx, hx + 2, y - 7.5, 1, 1, o);
      px(ctx, hx + (f > 0 ? 2 : 0), y - 5.5, 0.8, 0.8, "#2a1d18");
      const tail = cat.state === "sit" ? Math.sin(t * 2) : 0;
      px(ctx, x - 4.5 * f - (f > 0 ? 1 : 0), y - 6 + tail, 1, 3, o);
    }

    /**
     * The evening and night: darkness with pools of lamplight and glowing
     * windows (drawn over residents, under name signs and speech).
     */
    function drawLighting(ctx, sky, { lit }) {
      if (sky.dark <= 0.001 && !sky.tint) return;
      const litKey = Object.keys(WINDOWS).filter(lit).join(",");
      const key = `${Math.round(sky.dark * 50)}|${sky.lampsOn}|${litKey}|${sky.tint ? sky.tint.map(v => Math.round(v * 20)).join(",") : ""}`;
      if (lightCache.key !== key) lightCache = { key, ...renderLight(sky, lit) };
      ctx.drawImage(lightCache.canvas, 0, 0, MAP.width, MAP.height);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(lightCache.glow, 0, 0, MAP.width, MAP.height);
      ctx.restore();
    }

    function renderLight(sky, lit) {
      const S = 1;
      const make = () => { const c = document.createElement("canvas"); c.width = MAP.width * S; c.height = MAP.height * S; return c; };
      const canvas = make(), glow = make();
      const g = canvas.getContext("2d"), gl = glow.getContext("2d");
      if (sky.tint) { g.fillStyle = `rgba(${sky.tint[0]},${sky.tint[1]},${sky.tint[2]},${sky.tint[3]})`; g.fillRect(0, 0, canvas.width, canvas.height); }
      if (sky.dark > 0.001) {
        g.fillStyle = `rgba(12,18,48,${sky.dark})`;
        g.fillRect(0, 0, canvas.width, canvas.height);
        const lights = [];
        if (sky.lampsOn) for (const [x, y] of LAMPS) lights.push({ x, y, r: 34, c: "255,210,130", a: 0.35 });
        for (const [id, spots] of Object.entries(WINDOWS)) if (lit(id)) for (const [x, y] of spots) lights.push({ x, y, r: 16, c: "255,200,110", a: 0.45 });
        g.globalCompositeOperation = "destination-out";
        for (const l of lights) {
          const grad = g.createRadialGradient(l.x * S, l.y * S, 0, l.x * S, l.y * S, l.r * S);
          grad.addColorStop(0, "rgba(0,0,0,.85)"); grad.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grad; g.fillRect((l.x - l.r) * S, (l.y - l.r) * S, l.r * 2 * S, l.r * 2 * S);
          const warm = gl.createRadialGradient(l.x * S, l.y * S, 0, l.x * S, l.y * S, l.r * 0.7 * S);
          warm.addColorStop(0, `rgba(${l.c},${l.a * sky.dark * 1.4})`); warm.addColorStop(1, `rgba(${l.c},0)`);
          gl.fillStyle = warm; gl.fillRect((l.x - l.r) * S, (l.y - l.r) * S, l.r * 2 * S, l.r * 2 * S);
        }
      }
      return { canvas, glow };
    }

    /** Fireflies glow above everything else at night. */
    function drawAbove(ctx, sky) {
      if (!sky.night) return;
      const t = performance.now() / 1000;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const f of fireflies) {
        const a = Math.max(0, Math.sin(t * 1.3 + f.phase * 3));
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = "rgba(220,255,140,1)";
        ctx.fillRect(f.x, f.y, 1.4, 1.4);
        ctx.globalAlpha = a * 0.25;
        ctx.beginPath(); ctx.arc(f.x + 0.7, f.y + 0.7, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function catAt(p) { return Math.abs(p.x - cat.x) < 10 && p.y > cat.y - 13 && p.y < cat.y + 5 ? cat : null; }
    function catStatus() { return cat.following ? `following ${cat.following.name} around` : cat.state === "nap" && !cat.moving ? "napping in a sunny spot" : cat.moving ? "wandering about town" : "sitting and watching the world go by"; }

    /** Where the animals are and what they're doing (for tests). */
    function snapshot() { return { birds: birds.map(b => ({ x: b.x, y: b.y, state: b.state })), ducks: ducks.map(d => ({ x: d.x, y: d.y })), cat: { x: cat.x, y: cat.y, state: cat.state } }; }

    return { update, drawBelow, drawLighting, drawAbove, catAt, catStatus, snapshot };
  }

  root.LivingTownScenery = { create, skyAt, LAMPS, WINDOWS, CHIMNEYS };
})(typeof self !== "undefined" ? self : this);
