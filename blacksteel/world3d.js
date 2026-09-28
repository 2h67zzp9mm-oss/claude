/* The Blacksteel Pirates: the 3D world engine.
 *
 * One renderer shared by every location ("set"). Each set is built once from sets3d.js
 * and cached. The engine runs the loop, the player and other actors, particles (fire,
 * smoke, embers, spray), the animated sea, cinematic camera moves, screen shake and
 * flashes, tap picking, and hint glows.
 *
 * Exposes window.WORLD. If WebGL or three.js is missing, WORLD.ok is false.
 */
(function () {
  "use strict";
  if (!window.THREE || !window.PEOPLE) { window.WORLD = { ok: false }; return; }
  const T = THREE;

  // ---------- helpers shared with sets ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function canvasTex(w, h, draw, repeat, rotate) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    if (rotate) { t.center.set(.5, .5); t.rotation = rotate; }
    return t;
  }
  function woodTex(seed, base, n, repeat, rotate) {
    return canvasTex(512, 512, (c, w, h) => {
      const r = rng(seed), bh = h / n;
      for (let i = 0; i < n; i++) {
        const k = .75 + r() * .45;
        c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
        c.fillRect(0, i * bh, w, bh);
        for (let g = 0; g < 22; g++) {
          c.strokeStyle = `rgba(18,9,3,${(.05 + r() * .14).toFixed(3)})`;
          c.lineWidth = .6 + r() * 1.6;
          const y0 = i * bh + r() * bh, amp = r() * 3, f = .004 + r() * .01;
          c.beginPath(); c.moveTo(0, y0);
          for (let x = 0; x <= w; x += 16) c.lineTo(x, y0 + Math.sin(x * f + g) * amp);
          c.stroke();
        }
        if (r() < .35) {
          const kx = r() * w, ky = i * bh + bh / 2;
          c.strokeStyle = "rgba(30,14,5,.45)";
          for (let q = 0; q < 4; q++) { c.beginPath(); c.ellipse(kx, ky, 5 + q * 4, 2.5 + q * 1.8, 0, 0, 6.3); c.stroke(); }
        }
        c.fillStyle = "rgba(8,4,1,.9)"; c.fillRect(0, i * bh + bh - 3, w, 3);
        c.fillStyle = "rgba(255,220,170,.07)"; c.fillRect(0, i * bh, w, 2);
        let x = r() * 180;
        while (x < w) {
          c.fillStyle = "rgba(8,4,1,.9)"; c.fillRect(x, i * bh, 3, bh);
          c.fillStyle = "#140c06";
          c.beginPath(); c.arc(x + 11, i * bh + bh * .3, 2.6, 0, 6.3); c.arc(x + 11, i * bh + bh * .7, 2.6, 0, 6.3); c.fill();
          x += 160 + r() * 240;
        }
      }
    }, repeat, rotate);
  }
  function noiseTex(seed, base, spread, repeat, speck) {
    return canvasTex(256, 256, (c, w, h) => {
      const r = rng(seed);
      c.fillStyle = `rgb(${base.join(",")})`; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) {
        const k = (r() - .5) * spread;
        c.fillStyle = `rgba(${base[0] + k | 0},${base[1] + k | 0},${base[2] + k | 0},.6)`;
        c.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5);
      }
      if (speck) for (let i = 0; i < 300; i++) { c.fillStyle = speck; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
    }, repeat);
  }
  function stoneTex(seed, base, repeat) {
    return canvasTex(512, 512, (c, w, h) => {
      const r = rng(seed);
      c.fillStyle = "#0e0c0a"; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) {
        let x = (y / 64) % 2 ? -50 : 0;
        while (x < w) {
          const bw = 90 + r() * 70, k = .75 + r() * .35;
          c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
          c.fillRect(x + 3, y + 3, bw - 6, 58);
          for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${(r() * .15).toFixed(2)})`; c.fillRect(x + r() * bw, y + r() * 60, 3, 3); }
          x += bw;
        }
      }
    }, repeat);
  }
  // Worn, unreadable carvings. The Record-Stone's writing must never be legible.
  function glyphTex(seed, base, ink, fresh) {
    return canvasTex(512, 1024, (c, w, h) => {
      const r = rng(seed);
      c.fillStyle = base; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(255,255,255,${(r() * .025).toFixed(3)})`; c.fillRect(r() * w, r() * h, 2, 2); }
      c.strokeStyle = ink; c.lineWidth = fresh ? 2.6 : 2;
      for (let row = 0; row < 34; row++) {
        let x = 24;
        const y = 30 + row * 29;
        while (x < w - 30) {
          const gw = 12 + r() * 10;
          c.beginPath();
          const strokes = 2 + (r() * 3 | 0);
          for (let s = 0; s < strokes; s++) {
            const a = r() * Math.PI, sx = x + r() * gw, sy = y + r() * 18;
            c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 9, sy + Math.sin(a) * 12);
            if (r() < .3) { c.moveTo(sx + 4, sy); c.arc(sx + 4, sy + 4, 3, 0, 5); }
          }
          c.stroke();
          x += gw + 6 + (r() < .15 ? 14 : 0);
        }
      }
    });
  }

  const matCache = {};
  function mat(color, rough = .8, extra) {
    const k = color + ":" + rough + ":" + (extra ? JSON.stringify(Object.keys(extra).map(x => [x, typeof extra[x] === "object" ? "o" : extra[x]])) : "");
    if (extra && Object.values(extra).some(v => typeof v === "object")) return new T.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));
    if (!matCache[k]) matCache[k] = new T.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra || {}));
    return matCache[k];
  }
  const PICK = new T.MeshBasicMaterial({ visible: false });

  // ---------- the animated sea (waves displaced on the GPU) ----------
  function makeSea(size, color, amp = 1, seg = 120) {
    const geo = new T.PlaneGeometry(size, size, seg, seg);
    const m = new T.MeshStandardMaterial({ color, roughness: .22, metalness: .15 });
    const uni = { uTime: { value: 0 }, uAmp: { value: amp } };
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uni.uTime; sh.uniforms.uAmp = uni.uAmp;
      sh.vertexShader = `uniform float uTime; uniform float uAmp;
vec3 wave(vec2 p){
  float h=0.0, dx=0.0, dy=0.0;
  vec2 d[4]; d[0]=normalize(vec2(1.0,.3)); d[1]=normalize(vec2(-.4,1.0)); d[2]=normalize(vec2(.7,-.7)); d[3]=normalize(vec2(.2,.9));
  float f[4]; f[0]=.35; f[1]=.52; f[2]=.9; f[3]=1.6;
  float a[4]; a[0]=.22; a[1]=.14; a[2]=.06; a[3]=.025;
  float s[4]; s[0]=1.1; s[1]=1.4; s[2]=2.0; s[3]=2.8;
  for(int i=0;i<4;i++){ float ph=dot(d[i],p)*f[i]+uTime*s[i]; h+=a[i]*sin(ph); dx+=a[i]*f[i]*d[i].x*cos(ph); dy+=a[i]*f[i]*d[i].y*cos(ph); }
  return vec3(h,dx,dy)*uAmp;
}
` + sh.vertexShader
        .replace("#include <beginnormal_vertex>", "vec3 wv = wave(position.xy); vec3 objectNormal = normalize(vec3(-wv.y, -wv.z, 1.0));")
        .replace("#include <begin_vertex>", "vec3 transformed = vec3(position.xy, wv.x);");
    };
    const sea = new T.Mesh(geo, m);
    sea.rotation.x = -Math.PI / 2;
    sea.receiveShadow = true;
    sea.userData.uni = uni;
    return sea;
  }

  // ---------- particles ----------
  const softTex = canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  const smokeTex = canvasTex(128, 128, (c) => {
    const r = rng(9);
    for (let i = 0; i < 14; i++) {
      const x = 30 + r() * 68, y = 30 + r() * 68, rad = 18 + r() * 26;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    }
  });

  // Points that rise, drift and fade: fire and embers (additive), spray and dust.
  function particles(opts) {
    const n = opts.count, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const life = new Float32Array(n), max = new Float32Array(n), vel = new Float32Array(n * 3);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    const m = new T.PointsMaterial({
      size: opts.size, map: softTex, vertexColors: true, transparent: true, depthWrite: false,
      blending: opts.normal ? T.NormalBlending : T.AdditiveBlending, opacity: opts.opacity || 1
    });
    const pts = new T.Points(geo, m);
    pts.frustumCulled = false;
    const base = new T.Color(opts.color), end = new T.Color(opts.end || opts.color);
    const r = Math.random;
    function spawn(i) {
      const p = opts.at(r);
      pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
      const v = opts.vel(r);
      vel[i * 3] = v[0]; vel[i * 3 + 1] = v[1]; vel[i * 3 + 2] = v[2];
      max[i] = opts.life[0] + r() * (opts.life[1] - opts.life[0]);
      life[i] = 0;
    }
    for (let i = 0; i < n; i++) { spawn(i); life[i] = r() * max[i]; }
    pts.userData.update = (dt, t) => {
      if (opts.paused && opts.paused()) { pts.visible = false; return; }
      pts.visible = true;
      for (let i = 0; i < n; i++) {
        life[i] += dt;
        if (life[i] > max[i]) spawn(i);
        const k = life[i] / max[i];
        pos[i * 3] += (vel[i * 3] + Math.sin(t * 1.3 + i) * (opts.wobble || 0)) * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (opts.gravity) vel[i * 3 + 1] -= opts.gravity * dt;
        const fade = Math.sin(Math.PI * Math.min(1, k)) * (opts.flicker ? .7 + .3 * Math.sin(t * 13 + i) : 1);
        col[i * 3] = (base.r + (end.r - base.r) * k) * fade;
        col[i * 3 + 1] = (base.g + (end.g - base.g) * k) * fade;
        col[i * 3 + 2] = (base.b + (end.b - base.b) * k) * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    };
    return pts;
  }
  // Billowing smoke from sprites (normal blending, so it can be dark).
  function smoke(x, y, z, opts = {}) {
    const g = new T.Group();
    const n = opts.count || 10, color = new T.Color(opts.color || 0x1a1412);
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color, transparent: true, depthWrite: false, opacity: 0 }));
      g.add(s);
      list.push({ s, age: i / n * (opts.life || 6), life: opts.life || 6 });
    }
    g.position.set(x, y, z);
    g.userData.update = (dt, t) => {
      for (const p of list) {
        p.age += dt;
        if (p.age > p.life) p.age -= p.life;
        const k = p.age / p.life;
        p.s.position.set((opts.drift || .6) * k * 3 + Math.sin(p.age + k * 3) * .2, k * (opts.rise || 5), 0);
        const sc = (opts.size || 1.2) * (1 + k * 2.5);
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = (opts.opacity || .55) * Math.sin(Math.PI * k);
        p.s.material.rotation = k * 1.5;
      }
    };
    return g;
  }
  // A fire: flame particles, rising embers, and a flickering light.
  function fire(x, y, z, scale = 1, light = true) {
    const g = new T.Group(); g.position.set(x, y, z);
    const flames = particles({
      count: Math.round(40 * scale), size: .55 * scale, color: 0xffd28a, end: 0xa8280a, life: [.5, 1.1], flicker: true,
      at: r => [(r() - .5) * .8 * scale, r() * .2, (r() - .5) * .8 * scale],
      vel: r => [(r() - .5) * .2, .9 + r() * 1.2 * scale, (r() - .5) * .2], wobble: .3
    });
    g.add(flames);
    const embers = particles({
      count: Math.round(18 * scale), size: .08, color: 0xffb25a, end: 0x8a2a0a, life: [1.5, 3.5], flicker: true,
      at: r => [(r() - .5) * .6 * scale, .5, (r() - .5) * .6 * scale],
      vel: r => [(r() - .5) * .6, 1 + r() * 1.5, (r() - .5) * .6], wobble: .5
    });
    g.add(embers);
    if (light) {
      const L = new T.PointLight(0xff8a3a, 6 * scale, 10 * scale, 1.5);
      L.position.y = .8; g.add(L);
      g.userData.light = L;
    }
    g.userData.update = (dt, t) => {
      flames.userData.update(dt, t); embers.userData.update(dt, t);
      if (g.userData.light) g.userData.light.intensity = 6 * scale * (.75 + .25 * Math.sin(t * 11 + x) + .1 * Math.sin(t * 23));
    };
    return g;
  }

  // ---------- building kit handed to each set ----------
  function kit(root) {
    const K = {
      T, rng, clamp, mat, canvasTex, woodTex, noiseTex, stoneTex, glyphTex, makeSea, particles, smoke, fire,
      root, hs: {}, pickables: [], actors: {}, updaters: [],
      box(w, h, d, m, x, y, z, parent) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (parent || root).add(o); return o; },
      cyl(rt, rb, h, m, x, y, z, parent, seg = 16, open = false) { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (parent || root).add(o); return o; },
      sph(r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) { const o = new T.Mesh(new T.SphereGeometry(r, 20, 14), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; (parent || root).add(o); return o; },
      rock(r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1, seed = 1) {
        const g = new T.DodecahedronGeometry(r, 1), p = g.attributes.position, rr = rng(seed);
        for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (.8 + rr() * .4), p.getY(i) * (.8 + rr() * .4), p.getZ(i) * (.8 + rr() * .4));
        g.computeVertexNormals();
        const o = new T.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; (parent || root).add(o); return o;
      },
      add(o, parent) { (parent || root).add(o); if (o.userData.update) K.updaters.push(o); return o; },
      // Register something tappable. pick: [w, h, d, x, y, z] invisible box (local to obj). stand: where the player stands; look: what they face.
      hotspot(id, obj, pick, stand, look) {
        obj.userData.hs = id;
        K.hs[id] = { group: obj, stand, look };
        if (pick) {
          const p = new T.Mesh(new T.BoxGeometry(pick[0], pick[1], pick[2]), PICK);
          p.position.set(pick[3] || 0, pick[4] || 0, pick[5] || 0);
          obj.add(p);
          K.pickables.push(p);
        } else K.pickables.push(obj);
        return obj;
      },
      actor(id, look, x, z, heading, parent) {
        const a = new PEOPLE.Actor(look, id);
        a.place(x, z, heading || 0);
        (parent || root).add(a.root);
        K.actors[id] = a;
        return a;
      }
    };
    return K;
  }

  // ---------- engine ----------
  let renderer, scene, camera, canvasEl, flashEl;
  let cur = null, curKey = null;
  const built = {};
  let running = false, raf = 0, t0 = 0, last = 0, glowId = null, S0 = null;
  let camAnim = null, camFree = false, shakeUntil = 0, shakeAmt = 0;
  const camPos = new T.Vector3(), camLook = new T.Vector3();
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function init(container) {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = T.SRGBColorSpace;
    canvasEl = renderer.domElement;
    canvasEl.id = "world3d";
    canvasEl.hidden = true;
    container.appendChild(canvasEl);
    flashEl = document.createElement("div");
    flashEl.id = "flash3d";
    flashEl.hidden = true;
    container.appendChild(flashEl);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(38, 5 / 3, .1, 400);
    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container); else window.addEventListener("resize", resize);
  }

  function load(key, S, opts) {
    if (!built[key]) {
      const root = new T.Group();
      const K = kit(root);
      const def = window.SETS[key](K, opts || {});
      built[key] = Object.assign({ key, root, K }, def);
    }
    if (cur && cur.root.parent) scene.remove(cur.root);
    cur = built[key]; curKey = key;
    scene.add(cur.root);
    scene.background = new T.Color(cur.bg !== undefined ? cur.bg : 0x07050a);
    scene.fog = cur.fog ? new T.FogExp2(cur.fog[0], cur.fog[1]) : null;
    renderer.toneMappingExposure = cur.exposure || 1.4;
    camera.fov = cur.cam.fov || 38; camera.updateProjectionMatrix();
    camPos.fromArray(cur.cam.pos); camLook.fromArray(cur.cam.look);
    camAnim = null; camFree = false;
    glowId = null;
    refresh(S);
    if (cur.enter) cur.enter(S, opts || {});
    canvasEl.hidden = false;
    API.active = true;
    if (!running) { running = true; t0 = performance.now(); last = 0; raf = requestAnimationFrame(frame); }
  }
  function hide() {
    API.active = false;
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (canvasEl) canvasEl.hidden = true;
  }
  function refresh(S) {
    S0 = S;
    if (cur && cur.refresh) cur.refresh(S);
  }

  function player() { return cur && cur.K.actors[cur.player || "sean"]; }

  // ---------- picking ----------
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function pick(e) {
    if (!cur) return {};
    const r = canvasEl.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = cur.K.pickables.slice();
    if (cur.floorMesh) targets.push(cur.floorMesh);
    const hits = ray.intersectObjects(targets, true);
    const PRI = cur.pickPriority || {};
    let best = null, bestD = 0;
    for (const h of hits) {
      let o = h.object;
      if (o === cur.floorMesh) {
        if (best) break;
        const p = cur.root.worldToLocal(h.point.clone());
        return { floor: { x: p.x, z: p.z } };
      }
      if (!shown(o)) continue;
      for (; o && !o.userData.hs; o = o.parent);
      if (!o) continue;
      const id = o.userData.hs;
      if (API.allowed && !API.allowed(id)) continue;
      if (!best) { best = id; bestD = h.distance; continue; }
      if (h.distance - bestD > .45) break;
      if ((PRI[id] ?? 2) > (PRI[best] ?? 2)) best = id;
    }
    return best ? { hs: best } : {};
  }
  function hotspots() {
    if (!cur) return [];
    return Object.keys(cur.K.hs).filter(id => shown(cur.K.hs[id].group));
  }
  function project(id) {
    const h = cur && cur.K.hs[id]; if (!h) return null;
    const b = new T.Box3().setFromObject(h.group), v = b.getCenter(new T.Vector3()).project(camera);
    const r = canvasEl.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  // ---------- the player ----------
  function walkTo(p) {
    const a = player(), f = cur && cur.floor;
    if (!a || !f) return Promise.resolve();
    return a.walkTo(clamp(p.x, f.x0, f.x1), clamp(p.z, f.z0, f.z1));
  }
  function goTo(id) {
    const a = player(), h = cur && cur.K.hs[id];
    if (!a || !h || !h.stand) return Promise.resolve();
    const p = a.pos;
    if (Math.hypot(h.stand[0] - p.x, h.stand[1] - p.z) < .05) { a.look(h.look[0], h.look[1]); return Promise.resolve(); }
    return a.walkTo(h.stand[0], h.stand[1], h.look);
  }
  function faceTo(id) { const a = player(), h = cur && cur.K.hs[id]; if (a && h && h.look) a.look(h.look[0], h.look[1]); }
  function gesture() { const a = player(); return a ? a.gesture() : Promise.resolve(); }

  // ---------- camera, shake, flash ----------
  function cam(pos, look, dur = 1.5) {
    camFree = true;
    const from = { p: camera.position.clone(), l: camLook.clone() };
    return new Promise(res => { camAnim = { from, to: { p: new T.Vector3().fromArray(pos), l: new T.Vector3().fromArray(look) }, t: 0, dur, res }; });
  }
  function camReset(dur = 1.2) {
    const p = cur.cam.pos, l = cur.cam.look;
    return cam(p, l, dur).then(() => { camFree = false; });
  }
  function shake(sec, amt = .08) { if (reduced) return; shakeUntil = performance.now() + sec * 1000; shakeAmt = amt; }
  function flash(color = "#fff", ms = 400, peak = 1) {
    flashEl.hidden = false;
    flashEl.style.transition = "none";
    flashEl.style.background = color;
    flashEl.style.opacity = String(peak);
    requestAnimationFrame(() => { flashEl.style.transition = `opacity ${ms}ms ease-out`; flashEl.style.opacity = "0"; });
    setTimeout(() => { flashEl.hidden = true; }, ms + 60);
  }
  function fade(to, ms = 600, color = "#000") {
    flashEl.hidden = false;
    flashEl.style.background = color;
    flashEl.style.transition = `opacity ${ms}ms ease`;
    requestAnimationFrame(() => { flashEl.style.opacity = String(to); });
    return new Promise(res => setTimeout(() => { if (to === 0) flashEl.hidden = true; res(); }, ms + 30));
  }

  // ---------- hint glow ----------
  // glowId can be a single hotspot id (the usual hint nudge) or a Set of ids (the "show me
  // everything" button), so both share the same pulsing-emissive mechanism.
  function applyGlow(t) {
    if (!cur) return;
    for (const k in cur.K.hs) {
      const on = glowId instanceof Set ? glowId.has(k) : k === glowId;
      cur.K.hs[k].group.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.emissive || o.userData.noGlow) return;
        if (on) {
          if (!o.userData.glowMat) { o.userData.orig = o.material; o.userData.glowMat = o.material.clone(); }
          o.material = o.userData.glowMat;
          o.material.emissive.setRGB(.55, .35, .08);
          o.material.emissiveIntensity = .5 + .5 * Math.sin(t * 5);
        } else if (o.userData.orig && o.material !== o.userData.orig) o.material = o.userData.orig;
      });
    }
  }

  // ---------- loop ----------
  const tmpLook = new T.Vector3();
  function frame(ts) {
    raf = 0;
    if (!running || !cur) return;
    const t = (ts - t0) / 1000, dt = Math.min(.05, last ? (ts - last) / 1000 : .016);
    last = ts;
    for (const o of cur.K.updaters) o.userData.update(dt, t);
    for (const id in cur.K.actors) cur.K.actors[id].update(dt, t);
    if (cur.update) cur.update(dt, t, S0);
    if (cur.sea) cur.sea.userData.uni.uTime.value = t;
    applyGlow(t);
    // camera: cinematic move, or the set's own follow
    if (camAnim) {
      camAnim.t += dt / camAnim.dur;
      const k = Math.min(1, camAnim.t), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(camAnim.from.p, camAnim.to.p, e);
      camLook.lerpVectors(camAnim.from.l, camAnim.to.l, e);
      if (k >= 1) { const r = camAnim.res; camAnim = null; r(); }
    } else if (!camFree) {
      const p = player();
      if (cur.follow && p) cur.follow(camPos, camLook, p, dt);
      camera.position.lerp(camPos, Math.min(1, dt * 3));
    }
    tmpLook.copy(camLook);
    if (ts < shakeUntil) {
      const a = shakeAmt * (shakeUntil - ts) / 900;
      camera.position.x += (Math.random() - .5) * a; camera.position.y += (Math.random() - .5) * a;
    }
    camera.lookAt(tmpLook);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const API = {
    ok: false, active: false, allowed: null,
    init(container) {
      try { init(container); API.ok = true; }
      catch (err) { API.ok = false; if (canvasEl) canvasEl.remove(); console.warn("3D unavailable:", err); }
      return API.ok;
    },
    load, hide, refresh, pick, hotspots, project, walkTo, goTo, faceTo, gesture,
    cam, camReset, shake, flash, fade,
    setGlow(id) { glowId = id; },
    get player() { return player(); },
    actor(id) { return cur && cur.K.actors[id]; },
    // Set-specific moments: mast collapse, the black arc, the wave, the reef run...
    ev(name, ...args) { return cur && cur.events && cur.events[name] ? cur.events[name](...args) : Promise.resolve(); },
    get setKey() { return curKey; }
  };
  window.WORLD = API;
})();
