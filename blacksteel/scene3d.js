/* The Blacksteel Pirates: Sean's cabin in 3D.
 *
 * A modeled room lit by a swinging lantern (with real shadows) and moonlight through the
 * porthole, rocking with the sea. Sean is a jointed 3D character with a walk cycle whose
 * steps match the distance walked. Tapping works the same as the 2D scenes: tap an object
 * for its verbs, tap the floor to walk.
 *
 * Exposes window.CABIN3D. If WebGL or three.js is unavailable, CABIN3D.ok is false and the
 * game falls back to the 2D cabin.
 */
(function () {
  "use strict";
  if (!window.THREE) { window.CABIN3D = { ok: false }; return; }
  const T = THREE;

  // ---------- small helpers ----------
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

  // Planking with grain, knots, seams and nails.
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

  function chartTex(marked) {
    return canvasTex(512, 340, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#efe0bb"); g.addColorStop(1, "#c9ad7b");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const r = rng(5);
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,60,30,${(r() * .06).toFixed(3)})`; c.fillRect(r() * w, r() * h, 2, 2); }
      c.strokeStyle = "#7a5a34"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(30, 60); c.bezierCurveTo(90, 30, 140, 110, 90, 150); c.bezierCurveTo(60, 170, 30, 120, 30, 60); c.stroke();
      c.beginPath(); c.moveTo(390, 220); c.bezierCurveTo(440, 190, 500, 250, 470, 300); c.bezierCurveTo(430, 320, 380, 280, 390, 220); c.stroke();
      c.strokeStyle = "rgba(122,90,52,.35)"; c.lineWidth = 1;
      for (let a = 0; a < 16; a++) { c.beginPath(); c.moveTo(256, 170); c.lineTo(256 + Math.cos(a * Math.PI / 8) * 400, 170 + Math.sin(a * Math.PI / 8) * 400); c.stroke(); }
      c.fillStyle = "#7a5a34"; c.beginPath(); c.moveTo(440, 40); c.lineTo(448, 70); c.lineTo(440, 64); c.lineTo(432, 70); c.closePath(); c.fill();
      c.font = "bold 16px Georgia"; c.fillText("N", 434, 34);
      if (marked) {
        c.strokeStyle = "#a8322a"; c.lineWidth = 4; c.setLineDash([10, 8]);
        c.beginPath(); c.arc(250, 175, 34, 0, 6.3); c.stroke(); c.setLineDash([]);
      }
      c.strokeStyle = "rgba(60,35,15,.5)"; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    });
  }

  const M = {
    brass: new T.MeshStandardMaterial({ color: 0xb58d4a, metalness: .6, roughness: .32 }),
    brassDark: new T.MeshStandardMaterial({ color: 0x7a5a2a, metalness: .6, roughness: .45 }),
    iron: new T.MeshStandardMaterial({ color: 0x2b2e33, metalness: .6, roughness: .5 }),
    steel: new T.MeshStandardMaterial({ color: 0x6b7078, metalness: .7, roughness: .38 }),
    darkWood: new T.MeshStandardMaterial({ color: 0x3a2616, roughness: .8 }),
    paper: new T.MeshStandardMaterial({ color: 0xe6dcc3, roughness: .9, side: T.DoubleSide }),
    parchment: new T.MeshStandardMaterial({ color: 0xd9c393, roughness: .9 }),
    cloth: new T.MeshStandardMaterial({ color: 0x1a1f26, roughness: .92, side: T.DoubleSide }),
    blanket: new T.MeshStandardMaterial({ color: 0x3c4a38, roughness: 1 }),
    linen: new T.MeshStandardMaterial({ color: 0xd9cfbb, roughness: 1 }),
    plate: new T.MeshStandardMaterial({ color: 0xe9e3d6, roughness: .35 }),
    fish: new T.MeshStandardMaterial({ color: 0x8a6440, roughness: .6 }),
    glassGreen: new T.MeshStandardMaterial({ color: 0x2f6a44, roughness: .1, metalness: .1, transparent: true, opacity: .75 }),
    book: [0x5b2b25, 0x2f4a3f, 0x6b5433, 0x2c3a52].map(c => new T.MeshStandardMaterial({ color: c, roughness: .8 })),
    seal: new T.MeshStandardMaterial({ color: 0x9e2a22, roughness: .5 }),
    string: new T.MeshStandardMaterial({ color: 0x7a5433, roughness: 1 }),
    water: new T.MeshStandardMaterial({ color: 0x0e1a22, roughness: .05, metalness: .3 }),
    pick: new T.MeshBasicMaterial({ visible: false })
  };

  function box(w, h, d, mat, x, y, z, parent) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, parent, seg = 16, open = false) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function sph(r, mat, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
    const m = new T.Mesh(new T.SphereGeometry(r, 20, 14), mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function capsule(r, len, mat, parent, y) {
    const m = new T.Mesh(new T.CapsuleGeometry(r, len, 6, 14), mat);
    m.position.y = y; m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ===================================================================
  // Sean, as a jointed 3D character
  // ===================================================================
  function buildSean() {
    const mat = {
      skin: new T.MeshStandardMaterial({ color: 0xc8966c, roughness: .55 }),
      head: new T.MeshStandardMaterial({ color: 0xc8966c, roughness: .34 }),
      beard: new T.MeshStandardMaterial({ color: 0x18120e, roughness: .95 }),
      shirt: new T.MeshStandardMaterial({ color: 0x2c3038, roughness: .85 }),
      coat: new T.MeshStandardMaterial({ color: 0x1f242c, roughness: .7, side: T.DoubleSide }),
      pants: new T.MeshStandardMaterial({ color: 0x1a1d22, roughness: .85 }),
      boots: new T.MeshStandardMaterial({ color: 0x141312, roughness: .35 }),
      sash: new T.MeshStandardMaterial({ color: 0x6a4588, roughness: .75 }),
      sole: new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: .9 }),
      eye: new T.MeshStandardMaterial({ color: 0x1a120e, roughness: .2 }),
      frame: new T.MeshStandardMaterial({ color: 0x8d857a, metalness: .8, roughness: .3 }),
      lens: new T.MeshStandardMaterial({ color: 0xc8dcec, transparent: true, opacity: .15, roughness: .05 })
    };
    const root = new T.Group();
    const hips = new T.Group(); root.add(hips);

    function leg(side) {
      const thigh = new T.Group(); thigh.position.set(side * .1, 0, 0); hips.add(thigh);
      capsule(.078, .36, mat.pants, thigh, -.235);
      const knee = new T.Group(); knee.position.y = -.47; thigh.add(knee);
      capsule(.062, .36, mat.pants, knee, -.2);
      cyl(.078, .07, .26, mat.boots, 0, -.32, 0, knee);
      cyl(.084, .082, .05, mat.boots, 0, -.19, 0, knee);
      const ankle = new T.Group(); ankle.position.y = -.45; knee.add(ankle);
      box(.11, .09, .27, mat.boots, 0, -.035, .06, ankle);
      box(.115, .02, .28, mat.sole, 0, -.08, .06, ankle);
      return { thigh, knee, ankle };
    }
    const legR = leg(-1), legL = leg(1);

    // sash knotted at the front, tails hanging
    const sash = new T.Mesh(new T.TorusGeometry(.175, .032, 10, 28), mat.sash);
    sash.rotation.x = Math.PI / 2; sash.scale.set(1, .78, 1); sash.position.y = .05; hips.add(sash);
    const tails = new T.Group(); tails.position.set(.06, .03, .15); hips.add(tails);
    box(.06, .2, .02, mat.sash, 0, -.1, 0, tails);
    box(.05, .16, .02, mat.sash, .05, -.08, -.01, tails);

    // coat skirt (worn only after he takes his coat from the hook)
    const skirt = new T.Group(); skirt.position.y = .08; hips.add(skirt);
    const skirtMesh = cyl(.22, .34, .6, mat.coat, 0, -.3, 0, skirt, 24, true);
    skirtMesh.geometry = new T.CylinderGeometry(.22, .34, .6, 24, 1, true, Math.PI * .12, Math.PI * 1.76);
    skirtMesh.rotation.y = Math.PI;
    const hem = new T.Mesh(new T.TorusGeometry(.34, .008, 6, 40, Math.PI * 1.76), M.brass);
    hem.rotation.x = Math.PI / 2; hem.rotation.z = Math.PI * .5 + Math.PI * .12; hem.position.y = -.6; skirt.add(hem);

    // Nightforge in its scabbard on the left hip (worn only after he takes it from the wall)
    const scabbard = new T.Group(); scabbard.position.set(.2, .02, .02); scabbard.rotation.set(.95, 0, .12); hips.add(scabbard);
    cyl(.02, .016, .88, M.iron, 0, -.44, 0, scabbard, 10);
    cyl(.024, .024, .05, M.steel, 0, -.86, 0, scabbard, 10);
    cyl(.016, .016, .15, new T.MeshStandardMaterial({ color: 0x2b1d14, roughness: .8 }), 0, .09, 0, scabbard, 10);
    const guard = new T.Mesh(new T.TorusGeometry(.05, .007, 6, 16, Math.PI), M.steel); guard.position.set(0, .06, .03); guard.rotation.y = Math.PI / 2; scabbard.add(guard);
    sph(.022, M.steel, 0, .17, 0, scabbard);

    // torso
    const spine = new T.Group(); spine.position.y = .06; hips.add(spine);
    const torso = capsule(.2, .3, mat.shirt, spine, .3); torso.scale.set(1.12, 1, .78);
    sph(.05, mat.skin, 0, .5, .12, spine, 1, 1.4, .5);
    const coatTop = new T.Group(); spine.add(coatTop);
    const ct = cyl(.25, .23, .56, mat.coat, 0, .3, 0, coatTop, 24, true);
    ct.geometry = new T.CylinderGeometry(.25, .23, .56, 24, 1, true, Math.PI * .16, Math.PI * 1.68);
    ct.rotation.y = Math.PI; ct.scale.z = .8;
    for (let i = 0; i < 4; i++) sph(.013, M.brass, .075, .48 - i * .1, .2, coatTop);
    const collar = cyl(.13, .15, .1, mat.coat, 0, .6, -.03, coatTop, 16, true);
    collar.geometry = new T.CylinderGeometry(.13, .15, .1, 16, 1, true, Math.PI * .3, Math.PI * 1.4); collar.rotation.y = Math.PI;
    const pads = [];
    for (const s of [-1, 1]) {
      const pad = sph(.09, mat.coat, s * .22, .55, 0, coatTop, 1.1, .5, 1);
      const fringe = new T.Mesh(new T.TorusGeometry(.085, .01, 6, 16, Math.PI), M.brass);
      fringe.position.set(s * .22, .54, 0); fringe.rotation.y = Math.PI / 2; coatTop.add(fringe);
      pads.push(pad);
    }

    const chest = new T.Group(); chest.position.y = .58; spine.add(chest);
    cyl(.058, .064, .12, mat.skin, 0, .05, 0, chest);
    const head = new T.Group(); head.position.y = .2; chest.add(head);
    sph(.112, mat.head, 0, 0, 0, head, 1, 1.12, 1.02);
    sph(.106, mat.beard, 0, -.065, .025, head, .98, .72, .95);
    sph(.03, mat.beard, 0, -.03, .1, head, 1.5, .5, .6);
    const nose = new T.Mesh(new T.ConeGeometry(.02, .05, 10), mat.skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, .0, .12); head.add(nose);
    for (const s of [-1, 1]) {
      sph(.024, mat.skin, s * .112, -.005, 0, head, .5, 1, .8);
      const eye = sph(.013, mat.eye, s * .041, .025, .098, head);
      eye.userData.eye = true;
      box(.045, .012, .015, mat.beard, s * .042, .058, .1, head).rotation.z = s * -.08;
      const rim = new T.Mesh(new T.TorusGeometry(.029, .0035, 6, 20), mat.frame); rim.position.set(s * .043, .025, .113); rim.scale.y = .8; head.add(rim);
      const lens = new T.Mesh(new T.CircleGeometry(.028, 16), mat.lens); lens.position.set(s * .043, .025, .114); lens.scale.y = .8; head.add(lens);
      box(.004, .004, .11, mat.frame, s * .075, .028, .06, head);
    }
    box(.024, .004, .004, mat.frame, 0, .03, .118, head);

    function arm(side) {
      const sh = new T.Group(); sh.position.set(side * .25, .0, 0); sh.rotation.z = side * .09; chest.add(sh);
      const upper = capsule(.063, .24, mat.shirt, sh, -.15);
      const elbow = new T.Group(); elbow.position.y = -.3; sh.add(elbow);
      const fore = capsule(.054, .21, mat.shirt, elbow, -.135);
      const cuff = cyl(.064, .064, .05, M.brass, 0, -.24, 0, elbow);
      const hand = sph(.05, mat.skin, 0, -.31, .01, elbow, .9, 1.15, .8);
      return { sh, elbow, upper, fore, cuff, hand };
    }
    const armR = arm(-1), armL = arm(1);

    root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    const eyes = []; root.traverse(o => { if (o.userData.eye) eyes.push(o); });

    const st = { phase: 0, amp: 0, reach: 0, reachT: -1, coat: false, sword: false };

    function setGear(coat, sword) {
      st.coat = coat; st.sword = sword;
      skirt.visible = coat; coatTop.visible = coat;
      for (const a of [armR, armL]) { a.upper.material = coat ? mat.coat : mat.shirt; a.fore.material = coat ? mat.coat : mat.shirt; a.cuff.visible = coat; }
      scabbard.visible = sword;
    }
    setGear(false, false);

    const LT = .47, LS = .45, FOOT = .085;
    function legPose(L, ph, amp, idle) {
      const swing = Math.max(0, Math.cos(ph + .5));
      const th = -amp * .42 * Math.sin(ph) + (1 - amp) * idle;
      const kn = .06 + amp * .95 * swing * swing;
      const toe = amp * .45 * Math.pow(Math.max(0, Math.cos(ph + .7)), 2) - amp * .2 * Math.pow(Math.max(0, Math.sin(ph)), 8);
      L.thigh.rotation.x = th;
      L.knee.rotation.x = kn;
      L.ankle.rotation.x = -(th + kn) + toe;
      return LT * Math.cos(th) + LS * Math.cos(th + kn) + FOOT;
    }

    function pose(t) {
      const { amp, phase: ph } = st;
      const hR = legPose(legR, ph, amp, .04), hL = legPose(legL, ph + Math.PI, amp, -.05);
      hips.position.y = Math.max(hR, hL);
      hips.rotation.y = amp * .1 * Math.sin(ph);
      spine.rotation.y = -amp * .16 * Math.sin(ph);
      spine.rotation.x = amp * .06;
      const breathe = Math.sin(t * 1.6) * (1 - amp);
      chest.scale.set(1 + breathe * .008, 1 + breathe * .01, 1 + breathe * .012);
      head.rotation.x = -amp * .05 + Math.sin(t * .7) * .02 * (1 - amp);
      head.rotation.y = Math.sin(t * .45) * .12 * (1 - amp);
      // arms swing against the legs; a reach lifts the right arm toward what he's using
      const r = st.reach;
      armR.sh.rotation.x = (amp * .5 * Math.sin(ph)) * (1 - r) + (-1.25) * r;
      armR.elbow.rotation.x = -(.15 + amp * .45 * Math.max(0, -Math.sin(ph))) * (1 - r) - .25 * r;
      armL.sh.rotation.x = -amp * .5 * Math.sin(ph);
      armL.elbow.rotation.x = -(.15 + amp * .45 * Math.max(0, Math.sin(ph)));
      skirt.rotation.x = amp * (.14 + .05 * Math.sin(ph * 2)) + Math.sin(t * 1.2) * .01;
      tails.rotation.x = amp * .25 * Math.sin(ph * 2 + 1) + .05;
      tails.rotation.z = Math.sin(t * 1.1) * .06;
      scabbard.rotation.x = .95 + amp * .06 * Math.sin(ph * 2);
      const blink = (t % 4.1) < .11;
      for (const e of eyes) e.scale.y = blink ? .15 : 1;
    }

    return { root, st, pose, setGear };
  }

  // ===================================================================
  // The cabin
  // ===================================================================
  let renderer, scene, camera, room, lanternPivot, lanternLight, lanternSpot, flame, glassMat;
  let sean, seanTarget = null, seanDone = null, seanFaceAt = null, heading = 0;
  let seaTex, seaCtx, screenTex, screenCtx, led, drop, ripple, dust;
  const HS = {};           // hotspot id -> { group, stand: [x, z], look: [x, z] }
  const pickables = [];
  let floorMesh, canvasEl, running = false, raf = 0, t0 = 0, last = 0, glowId = null, S0 = null;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLOOR = { x0: -2.5, x1: 2.1, z0: -.3, z1: 1.2 };

  function hotspot(id, group, pick, stand, look) {
    group.userData.hs = id;
    HS[id] = { group, stand, look };
    if (pick) {
      const p = new T.Mesh(new T.BoxGeometry(pick[0], pick[1], pick[2]), M.pick);
      p.position.set(pick[3] || 0, pick[4] || 0, pick[5] || 0);
      p.userData.hsProxy = id;
      group.add(p);
      pickables.push(p);
    } else pickables.push(group);
  }

  function build(container) {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = T.SRGBColorSpace;
    canvasEl = renderer.domElement;
    canvasEl.id = "cabin3d";
    container.appendChild(canvasEl);

    scene = new T.Scene();
    scene.background = new T.Color(0x07050a);
    scene.fog = new T.FogExp2(0x0b0706, .045);
    camera = new T.PerspectiveCamera(38, 5 / 3, .1, 60);
    camera.position.set(.15, 1.72, 5.3);
    camera.lookAt(.1, 1.02, -.6);

    room = new T.Group(); scene.add(room);

    // ---- shell: floor, walls, ceiling, ribs, beams ----
    const floorTex = woodTex(3, [74, 50, 32], 8, [3, 2.2], Math.PI / 2);
    floorMesh = new T.Mesh(new T.PlaneGeometry(6.4, 4.6), new T.MeshStandardMaterial({ map: floorTex, roughness: .78 }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.z = -.1; floorMesh.receiveShadow = true;
    floorMesh.userData.floor = true;
    room.add(floorMesh);

    const wallTex = woodTex(11, [84, 57, 37], 12, [2.4, 1]);
    const wallMat = new T.MeshStandardMaterial({ map: wallTex, roughness: .86 });
    const back = new T.Mesh(new T.PlaneGeometry(6.4, 2.8), wallMat);
    back.position.set(0, 1.4, -2.2); back.receiveShadow = true; room.add(back);
    for (const s of [-1, 1]) {
      const side = new T.Mesh(new T.PlaneGeometry(4.6, 2.8), wallMat);
      side.position.set(s * 3.2, 1.4, -.1); side.rotation.y = -s * Math.PI / 2; side.rotation.x = s * 0;
      side.rotation.z = 0; side.receiveShadow = true;
      side.rotateOnAxis(new T.Vector3(1, 0, 0), 0);
      room.add(side);
    }
    const ceil = new T.Mesh(new T.PlaneGeometry(6.4, 4.6), new T.MeshStandardMaterial({ color: 0x1e140c, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.8, -.1); room.add(ceil);
    for (const z of [-1.7, -.5, .7]) box(6.4, .2, .22, M.darkWood, 0, 2.7, z, room);
    for (const x of [-3.05, 3.05]) for (const z of [-1.9, -.4, 1.1]) box(.16, 2.8, .2, M.darkWood, x, 1.4, z, room);
    for (const x of [-3.0, -1.0, 1.05, 3.0]) box(.2, 2.8, .14, M.darkWood, x, 1.4, -2.12, room);
    box(6.4, .1, .1, M.darkWood, 0, .05, -2.14, room);

    // ---- door ----
    const door = new T.Group(); door.position.set(-2.1, 0, -2.13); room.add(door);
    box(1.14, 2.14, .1, M.darkWood, 0, 1.07, -.02, door);
    const doorTex = woodTex(21, [78, 54, 34], 4, [1, 1], Math.PI / 2);
    box(.96, 2.0, .06, new T.MeshStandardMaterial({ map: doorTex, roughness: .8 }), 0, 1.0, .04, door);
    for (const y of [.4, 1.6]) box(.8, .07, .02, M.iron, -.08, y, .08, door);
    const ring = new T.Mesh(new T.TorusGeometry(.055, .012, 8, 20), M.brass); ring.position.set(.36, .98, .1); door.add(ring);
    sph(.035, M.brass, .36, 1.04, .09, door);
    hotspot("door", door, [1.1, 2.1, .3, 0, 1.05, .1], [-2.1, -.25], [-2.1, -2.2]);

    // ---- coat hanging on its hook ----
    sph(.03, M.brass, -1.3, 1.9, -2.1, room);
    const coatHook = new T.Group(); coatHook.position.set(-1.3, 1.88, -2.02); room.add(coatHook);
    const hang = new T.Mesh(new T.CylinderGeometry(.1, .3, 1.15, 20, 4, true, Math.PI * .15, Math.PI * 1.7), M.cloth);
    hang.rotation.y = Math.PI; hang.position.y = -.6; hang.scale.z = .45; hang.castShadow = true; coatHook.add(hang);
    for (const s of [-1, 1]) {
      const sl = new T.Mesh(new T.CapsuleGeometry(.05, .5, 4, 10), M.cloth);
      sl.position.set(s * .17, -.42, .02); sl.rotation.z = s * .12; sl.castShadow = true; coatHook.add(sl);
    }
    for (let i = 0; i < 4; i++) sph(.014, M.brass, .06, -.3 - i * .13, .09, coatHook);
    const hemRing = new T.Mesh(new T.TorusGeometry(.3, .007, 6, 30, Math.PI * 1.7), M.brass);
    hemRing.rotation.x = Math.PI / 2; hemRing.rotation.z = Math.PI * .5 + Math.PI * .15; hemRing.position.y = -1.17; hemRing.scale.y = .45; coatHook.add(hemRing);
    hotspot("coat", coatHook, [.7, 1.25, .35, 0, -.6, .05], [-1.3, -.25], [-1.3, -2.2]);

    // ---- Nightforge on two pegs above the table ----
    for (const x of [-.55, .55]) cyl(.018, .018, .12, M.darkWood, x, 1.98, -2.12, room).rotation.x = Math.PI / 2;
    const sword = new T.Group(); sword.position.set(0, 2.0, -2.06); room.add(sword);
    const sc = cyl(.022, .016, 1.1, M.iron, .05, 0, 0, sword, 10); sc.rotation.z = Math.PI / 2 - .04;
    cyl(.026, .026, .05, M.steel, .6, -.01, 0, sword, 10).rotation.z = Math.PI / 2;
    const grip = cyl(.017, .017, .16, new T.MeshStandardMaterial({ color: 0x2b1d14, roughness: .8 }), -.6, .005, 0, sword, 10); grip.rotation.z = Math.PI / 2;
    const bow = new T.Mesh(new T.TorusGeometry(.07, .007, 6, 16, Math.PI), M.steel); bow.position.set(-.6, .01, 0); sword.add(bow);
    sph(.024, M.steel, -.69, 0, 0, sword);
    hotspot("sword", sword, [1.5, .3, .2, -.05, 0, 0], [-.1, -.25], [-.1, -2.2]);

    // ---- porthole with the live sea ----
    const port = new T.Group(); port.position.set(1.75, 1.6, -2.18); room.add(port);
    const seaCanvas = document.createElement("canvas"); seaCanvas.width = seaCanvas.height = 160;
    seaCtx = seaCanvas.getContext("2d");
    seaTex = new T.CanvasTexture(seaCanvas); seaTex.colorSpace = T.SRGBColorSpace;
    const glass = new T.Mesh(new T.CircleGeometry(.32, 40), new T.MeshBasicMaterial({ map: seaTex }));
    glass.position.z = .01; port.add(glass);
    const shine = new T.Mesh(new T.RingGeometry(.2, .23, 30, 1, Math.PI * .55, Math.PI * .5), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .15 }));
    shine.position.z = .02; port.add(shine);
    const rim = new T.Mesh(new T.TorusGeometry(.36, .06, 14, 44), M.brass); rim.position.z = .03; rim.castShadow = true; port.add(rim);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .39; sph(.018, M.brassDark, Math.cos(a) * .43, Math.sin(a) * .43, .04, port); }
    hotspot("porthole", port, [.95, .95, .2, 0, 0, .05], [1.75, -.25], [1.75, -2.2]);

    // ---- bunk, shelf, bucket ----
    const bunk = new T.Group(); bunk.position.set(2.55, 0, -1.4); room.add(bunk);
    box(1.3, .42, 1.2, M.darkWood, 0, .21, 0, bunk);
    box(1.2, .12, 1.1, M.linen, 0, .47, 0, bunk);
    const blanket = box(1.22, .1, .8, M.blanket, 0, .54, .12, bunk); blanket.rotation.x = .03;
    sph(.18, M.linen, -.35, .58, -.34, bunk, 1.4, .45, .9);
    const plateBunk = new T.Group(); plateBunk.position.set(.2, .6, .1); bunk.add(plateBunk);
    cyl(.14, .12, .02, M.plate, 0, 0, 0, plateBunk, 24);
    sph(.06, M.fish, 0, .025, 0, plateBunk, 1.6, .45, .7);
    hotspot("bunk", bunk, [1.3, .8, 1.2, 0, .4, 0], [1.95, -.25], [2.55, -1.4]);

    const shelf = new T.Group(); shelf.position.set(2.55, 1.35, -2.05); room.add(shelf);
    box(1.1, .05, .28, M.darkWood, 0, 0, 0, shelf);
    [.24, .3, .2, .27].forEach((h, i) => box(.07, h, .2, M.book[i], -.42 + i * .085, h / 2 + .025, 0, shelf));
    cyl(.04, .045, .26, M.glassGreen, .05, .155, 0, shelf, 16);
    cyl(.015, .02, .06, M.glassGreen, .05, .31, 0, shelf, 10);
    const compass = cyl(.07, .07, .03, M.brass, .32, .04, 0, shelf, 24);
    const face = new T.Mesh(new T.CircleGeometry(.058, 24), new T.MeshStandardMaterial({ color: 0xe8dfc6 }));
    face.rotation.x = -Math.PI / 2; face.position.y = .016; compass.add(face);
    const needle = box(.008, .004, .09, new T.MeshStandardMaterial({ color: 0xb0413a }), 0, .02, 0, compass);
    needle.castShadow = false;
    hotspot("shelf", shelf, [1.1, .45, .35, 0, .18, 0], [2.2, -.25], [2.55, -2.2]);

    const bucket = new T.Group(); bucket.position.set(1.45, 0, -1.1); room.add(bucket);
    const bm = new T.MeshStandardMaterial({ color: 0x5f656c, metalness: .6, roughness: .45, side: T.DoubleSide });
    cyl(.18, .15, .32, bm, 0, .16, 0, bucket, 20, true);
    cyl(.15, .15, .01, bm, 0, .005, 0, bucket, 20);
    const water = cyl(.17, .17, .01, M.water, 0, .24, 0, bucket, 20);
    const handle = new T.Mesh(new T.TorusGeometry(.18, .006, 6, 20, Math.PI), M.iron); handle.position.y = .32; bucket.add(handle);
    ripple = new T.Mesh(new T.RingGeometry(.02, .03, 24), new T.MeshBasicMaterial({ color: 0x9fc0d8, transparent: true, opacity: 0 }));
    ripple.rotation.x = -Math.PI / 2; ripple.position.y = .25; bucket.add(ripple);
    drop = sph(.012, new T.MeshBasicMaterial({ color: 0xbfd8ea }), 0, 2.6, 0, bucket, 1, 1.6, 1);
    drop.userData = { v: 0, wait: 1 };
    hotspot("bucket", bucket, [.5, .5, .5, 0, .2, 0], [1.3, -.25], [1.45, -1.1]);

    // ---- table and everything on it ----
    const table = new T.Group(); table.position.set(0, 0, -1.15); room.add(table);
    const topTex = woodTex(31, [110, 76, 46], 5, [1, 1]);
    const top = box(2.2, .08, 1.0, new T.MeshStandardMaterial({ map: topTex, roughness: .7 }), 0, .8, 0, table);
    for (const [x, z] of [[-.98, -.4], [.98, -.4], [-.98, .4], [.98, .4]]) cyl(.05, .04, .76, M.darkWood, x, .38, z, table, 12);
    box(1.9, .06, .05, M.darkWood, 0, .25, .38, table);
    hotspot("table", table, [2.2, .12, 1.0, 0, .8, 0], [0, -.25], [0, -1.15]);
    const Y = .84;

    const receipts = new T.Group(); receipts.position.set(-.82, Y, .12); table.add(receipts);
    [[0, 0, .2], [.06, .03, -.3], [-.05, -.04, .6]].forEach(([x, z, r]) => {
      const p = new T.Mesh(new T.PlaneGeometry(.2, .13), M.paper); p.rotation.x = -Math.PI / 2; p.rotation.z = r; p.position.set(x, .002 + Math.abs(r) * .004, z); p.receiveShadow = true; receipts.add(p);
    });
    hotspot("receipts", receipts, [.36, .12, .3], [-.82, -.25], [-.82, -1.15]);

    const chartFolded = new T.Mesh(new T.PlaneGeometry(.5, .33), new T.MeshStandardMaterial({ map: chartTex(false), roughness: .9 }));
    chartFolded.rotation.x = -Math.PI / 2; chartFolded.rotation.z = .12; chartFolded.position.set(-.3, Y + .002, .05); chartFolded.receiveShadow = true;
    const chartG = new T.Group(); table.add(chartG); chartG.add(chartFolded);
    const chartSpread = new T.Mesh(new T.PlaneGeometry(.9, .6), new T.MeshStandardMaterial({ map: chartTex(true), roughness: .9 }));
    chartSpread.rotation.x = -Math.PI / 2; chartSpread.rotation.z = -.04; chartSpread.position.set(-.25, Y + .003, .05); chartSpread.receiveShadow = true;
    chartG.add(chartSpread);
    hotspot("chart", chartG, [.9, .03, .6, -.25, Y, .05], [-.3, -.25], [-.3, -1.15]);

    const plate = new T.Group(); plate.position.set(-.28, Y + .012, .06); table.add(plate);
    cyl(.15, .12, .022, M.plate, 0, 0, 0, plate, 28);
    sph(.065, M.fish, -.01, .025, 0, plate, 1.7, .45, .7);
    const tail = new T.Mesh(new T.ConeGeometry(.04, .07, 3), M.fish); tail.rotation.z = Math.PI / 2; tail.position.set(.13, .025, 0); tail.scale.z = .4; plate.add(tail);
    box(.012, .006, .16, M.steel, .19, .014, .02, plate).rotation.y = .5;
    hotspot("plate", plate, [.4, .12, .36], [-.28, -.25], [-.28, -1.15]);

    const tides = new T.Group(); tides.position.set(.3, Y + .025, .18); tides.rotation.y = -.2; table.add(tides);
    box(.22, .045, .16, new T.MeshStandardMaterial({ color: 0x4f6450, roughness: .9 }), 0, 0, 0, tides);
    box(.2, .035, .15, M.linen, .012, 0, 0, tides);
    hotspot("tides", tides, [.3, .12, .24], [.3, -.25], [.3, -1.15]);

    const comm = new T.Group(); comm.position.set(.72, Y, -.18); comm.rotation.y = -.25; table.add(comm);
    box(.36, .27, .22, M.brass, 0, .135, 0, comm);
    box(.37, .02, .23, M.brassDark, 0, .275, 0, comm);
    const scr = document.createElement("canvas"); scr.width = 128; scr.height = 84;
    screenCtx = scr.getContext("2d");
    screenTex = new T.CanvasTexture(scr); screenTex.colorSpace = T.SRGBColorSpace;
    box(.21, .15, .01, M.iron, -.05, .15, .11, comm);
    const screen = new T.Mesh(new T.PlaneGeometry(.18, .12), new T.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(-.05, .15, .117); comm.add(screen);
    led = sph(.013, new T.MeshBasicMaterial({ color: 0xe0623e }), .12, .2, .112, comm);
    const knob = cyl(.025, .025, .02, M.iron, .12, .12, .115, comm, 14); knob.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) box(.2, .008, .005, M.brassDark, -.05, .05 - i * .014 + .012, .112, comm);
    cyl(.005, .006, .34, M.brass, .14, .45, -.05, comm, 8).rotation.z = -.15;
    sph(.014, M.brass, .165, .62, -.05, comm);
    hotspot("comm", comm, [.45, .7, .32, 0, .3, 0], [.72, -.25], [.72, -1.35]);

    const packet = new T.Group(); packet.position.set(1.02, Y + .02, .12); packet.rotation.y = .3; table.add(packet);
    box(.18, .035, .13, M.parchment, 0, 0, 0, packet);
    box(.185, .037, .012, M.string, 0, .001, 0, packet);
    box(.012, .037, .135, M.string, 0, .001, 0, packet);
    cyl(.018, .018, .006, M.seal, 0, .02, 0, packet, 14);
    hotspot("packet", packet, [.28, .14, .22], [1.02, -.25], [1.02, -1.15]);

    // ---- the lantern: swings, flickers, casts the shadows ----
    lanternPivot = new T.Group(); lanternPivot.position.set(.05, 2.6, -.75); room.add(lanternPivot);
    for (let i = 0; i < 5; i++) { const l = new T.Mesh(new T.TorusGeometry(.022, .006, 6, 12), M.iron); l.position.y = -.04 - i * .055; l.rotation.y = i % 2 ? Math.PI / 2 : 0; lanternPivot.add(l); }
    const lantern = new T.Group(); lantern.position.y = -.5; lanternPivot.add(lantern);
    glassMat = new T.MeshStandardMaterial({ color: 0xffd79a, emissive: 0xffa94a, emissiveIntensity: 2.2, transparent: true, opacity: .85, roughness: .1 });
    box(.15, .2, .15, glassMat, 0, 0, 0, lantern).castShadow = false;
    for (const [x, z] of [[-.08, -.08], [.08, -.08], [-.08, .08], [.08, .08]]) cyl(.009, .009, .22, M.brass, x, 0, z, lantern, 6).castShadow = false;
    const cap = new T.Mesh(new T.ConeGeometry(.13, .1, 4), M.brass); cap.position.y = .15; cap.rotation.y = Math.PI / 4; lantern.add(cap);
    box(.19, .03, .19, M.brass, 0, -.11, 0, lantern).castShadow = false;
    flame = sph(.03, new T.MeshBasicMaterial({ color: 0xfff1c8 }), 0, 0, 0, lantern, 1, 1.8, 1); flame.castShadow = false;
    lanternLight = new T.PointLight(0xffb866, 9, 9, 1.6);
    lanternLight.position.y = -.02; lantern.add(lanternLight);
    lanternSpot = new T.SpotLight(0xffb866, 30, 10, 1.25, .75, 1.5);
    lanternSpot.position.y = -.05; lanternSpot.castShadow = true;
    lanternSpot.shadow.mapSize.set(1024, 1024); lanternSpot.shadow.bias = -.0015; lanternSpot.shadow.radius = 5;
    lanternSpot.shadow.camera.near = .1; lanternSpot.shadow.camera.far = 8;
    const spotTarget = new T.Object3D(); spotTarget.position.set(0, -3, .2); lantern.add(spotTarget); lanternSpot.target = spotTarget;
    lantern.add(lanternSpot);

    // moonlight through the porthole, and a dim fill so nothing is pure black
    const moon = new T.SpotLight(0x8fb4e8, 6, 9, .45, .9, 1.2);
    moon.position.set(2.1, 2.1, -2.9); room.add(moon);
    const moonTarget = new T.Object3D(); moonTarget.position.set(.6, 0, .3); room.add(moonTarget); moon.target = moonTarget;
    scene.add(new T.HemisphereLight(0x55607a, 0x2a1a0c, .9));
    // a soft key light from the viewer's side so faces and costumes read, as on a stage
    const key = new T.DirectionalLight(0xffd8b0, 1.6);
    key.position.set(1.5, 3.2, 6); scene.add(key);
    const rimL = new T.DirectionalLight(0x8fa8d8, .7);
    rimL.position.set(-4, 2.5, -3); scene.add(rimL);

    // dust drifting in the lamplight
    const n = 140, pos = new Float32Array(n * 3), r = rng(7);
    for (let i = 0; i < n; i++) { pos[i * 3] = -1.6 + r() * 3.2; pos[i * 3 + 1] = .3 + r() * 2.2; pos[i * 3 + 2] = -1.8 + r() * 2.6; }
    const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.BufferAttribute(pos, 3));
    dust = new T.Points(dg, new T.PointsMaterial({ color: 0xffd9a0, size: .012, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false }));
    room.add(dust);

    // Sean
    sean = buildSean();
    sean.root.position.set(-.5, 0, .6);
    room.add(sean.root);

    HS._parts = { plate, plateBunk, chartFolded, chartSpread, chartG, coatHook, sword, packet };
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container); else window.addEventListener("resize", resize);
  }

  function resize() {
    if (!renderer) return;
    const p = canvasEl.parentElement, w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------- live textures ----------
  function drawSea(t, tilt) {
    const c = seaCtx, W = 160;
    c.save();
    c.translate(W / 2, W / 2); c.rotate(-tilt * 1.6); c.translate(-W / 2, -W / 2);
    let g = c.createLinearGradient(0, 0, 0, 90);
    g.addColorStop(0, "#050b16"); g.addColorStop(1, "#1d3550");
    c.fillStyle = g; c.fillRect(-40, -40, 240, 136);
    c.fillStyle = "rgba(242,234,206,.25)"; c.beginPath(); c.arc(112, 44, 22, 0, 6.3); c.fill();
    c.fillStyle = "#efe7cc"; c.beginPath(); c.arc(112, 44, 11, 0, 6.3); c.fill();
    g = c.createLinearGradient(0, 94, 0, 200);
    g.addColorStop(0, "#1b3450"); g.addColorStop(1, "#040a12");
    c.fillStyle = g; c.fillRect(-40, 94, 240, 120);
    for (let i = 0; i < 12; i++) {
      const y = 98 + i * 5 + i * i * .3;
      c.strokeStyle = `rgba(150,185,215,${(.4 - i * .028).toFixed(3)})`; c.lineWidth = 1;
      c.beginPath();
      for (let x = -40; x <= 200; x += 5) { const yy = y + Math.sin(x * .08 + t * (1.1 + i * .1) + i) * (1 + i * .35); x === -40 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
      c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const w = 6 + i * 2.2, x = 112 + Math.sin(t * 1.7 + i * 1.3) * (2 + i * 1.2);
      c.fillStyle = `rgba(245,236,205,${(.5 - i * .035).toFixed(3)})`;
      c.fillRect(x - w / 2, 97 + i * 4.5, w, 1.6);
    }
    c.restore();
    seaTex.needsUpdate = true;
  }
  function drawScreen(t, live) {
    const c = screenCtx;
    const g = c.createRadialGradient(64, 42, 4, 64, 42, 80);
    g.addColorStop(0, live ? "#3f8078" : "#172524"); g.addColorStop(1, live ? "#123230" : "#081010");
    c.fillStyle = g; c.fillRect(0, 0, 128, 84);
    c.strokeStyle = live ? "#c8f6e8" : "#243c3a"; c.lineWidth = live ? 3 : 1.5;
    c.beginPath();
    for (let x = 4; x <= 124; x += 3) {
      const y = live ? 42 + Math.sin(x * .19 + t * 9) * (9 + 7 * Math.sin(t * 3 + x * .05)) * (.5 + .5 * Math.sin(t * 2.3)) : 42 + (Math.random() - .5) * 4;
      x === 4 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
    c.fillStyle = "rgba(255,255,255,.05)"; for (let y = 0; y < 84; y += 3) c.fillRect(0, y, 128, 1);
    screenTex.needsUpdate = true;
  }

  // ---------- state from the game ----------
  function refresh(S) {
    S0 = S;
    if (!renderer) return;
    const f = S.flags, st = S.stage, has = id => S.inv.includes(id), P = HS._parts;
    P.plate.visible = !f.plateMoved;
    P.plateBunk.visible = !!f.plateMoved;
    P.chartFolded.visible = !has("chart") && !f.chartSpread;
    P.chartSpread.visible = !!f.chartSpread;
    P.chartG.visible = P.chartFolded.visible || P.chartSpread.visible;
    P.coatHook.visible = !has("coat");
    P.sword.visible = !has("sword");
    P.packet.visible = st >= 3 && !has("packet");
    sean.setGear(has("coat"), has("sword"));
  }

  // ---------- picking ----------
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function pick(e) {
    const r = canvasEl.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables.concat([floorMesh]), true);
    // Small things sitting on big ones win: a tap near the plate means the plate, not the table under it.
    const PRI = { table: 0, chart: 1 };
    let best = null, bestD = 0;
    for (const h of hits) {
      let o = h.object;
      if (o === floorMesh) {
        if (best) break;
        const p = room.worldToLocal(h.point.clone());
        return { floor: { x: p.x, z: p.z } };
      }
      if (!shown(o)) continue;
      for (; o && !o.userData.hs; o = o.parent);
      if (!o) continue;
      const id = o.userData.hs;
      if (!best) { best = id; bestD = h.distance; continue; }
      if (h.distance - bestD > .45) break;
      if ((PRI[id] ?? 2) > (PRI[best] ?? 2)) best = id;
    }
    return best ? { hs: best } : {};
  }

  // ---------- Sean's movement ----------
  function walkTo(x, z, lookAt) {
    x = clamp(x, FLOOR.x0, FLOOR.x1); z = clamp(z, FLOOR.z0, FLOOR.z1);
    if (seanDone) { const d = seanDone; seanDone = null; d(); }
    seanFaceAt = lookAt || null;
    const p = sean.root.position;
    if (Math.hypot(x - p.x, z - p.z) < .03) { seanTarget = null; return Promise.resolve(); }
    seanTarget = { x, z };
    return new Promise(res => { seanDone = res; });
  }
  function goTo(id) {
    const h = HS[id];
    if (!h) return Promise.resolve();
    return walkTo(h.stand[0], h.stand[1], h.look);
  }
  function faceTo(id) { const h = HS[id]; if (h) seanFaceAt = h.look; }
  function gesture() {
    sean.st.reachT = 0;
    return new Promise(res => setTimeout(res, 560));
  }
  function place() {
    sean.root.position.set(-.5, 0, .6);
    heading = 0; seanFaceAt = null; seanTarget = null;
    sean.st.amp = 0;
  }

  function updateSean(dt, t) {
    const p = sean.root.position, st = sean.st;
    let want = null;
    if (seanTarget) {
      const dx = seanTarget.x - p.x, dz = seanTarget.z - p.z, d = Math.hypot(dx, dz);
      const step = 1.25 * dt * (.35 + .65 * st.amp);
      want = Math.atan2(dx, dz);
      if (d <= step) {
        p.x = seanTarget.x; p.z = seanTarget.z; seanTarget = null;
        if (seanDone) { const f = seanDone; seanDone = null; f(); }
      } else {
        p.x += dx / d * step; p.z += dz / d * step;
        st.phase += step / 1.35 * Math.PI * 2;
      }
      st.amp = Math.min(1, st.amp + dt * 5);
    } else {
      st.amp = Math.max(0, st.amp - dt * 4);
      if (st.amp === 0) st.phase = 0;
      if (seanFaceAt) want = Math.atan2(seanFaceAt[0] - p.x, seanFaceAt[1] - p.z);
    }
    if (want !== null) {
      let d = want - heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      heading += d * Math.min(1, dt * 9);
    }
    sean.root.rotation.y = heading;
    if (st.reachT >= 0) {
      st.reachT += dt;
      const u = st.reachT / .56;
      st.reach = u < .35 ? u / .35 : u < .7 ? 1 : Math.max(0, 1 - (u - .7) / .3);
      if (u >= 1) { st.reachT = -1; st.reach = 0; }
    }
    sean.pose(t);
  }

  // ---------- hint glow ----------
  function setGlow(id) { glowId = id; }
  function applyGlow(t) {
    for (const k in HS) {
      if (k === "_parts") continue;
      const on = k === glowId;
      HS[k].group.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.emissive || o.material === glassMat) return;
        if (o.userData.baseEm === undefined) o.userData.baseEm = o.material.emissive.getHex();
        if (on) { if (!o.userData.glowMat) { o.userData.glowMat = o.material.clone(); o.userData.orig = o.material; } o.material = o.userData.glowMat; o.material.emissive.setRGB(.55, .35, .08); o.material.emissiveIntensity = .5 + .5 * Math.sin(t * 5); }
        else if (o.userData.orig) { o.material = o.userData.orig; }
      });
    }
  }

  // ---------- the loop ----------
  function frame(ts) {
    raf = 0;
    if (!running) return;
    const t = (ts - t0) / 1000, dt = Math.min(.05, last ? (ts - last) / 1000 : .016);
    last = ts;
    const tilt = reduced ? 0 : (Math.sin(t * .8) * .012 + Math.sin(t * .37 + 1) * .005);
    room.rotation.z = tilt;
    room.rotation.x = reduced ? 0 : Math.sin(t * .53) * .004;
    // the lantern hangs with gravity, so it swings against the rocking room
    lanternPivot.rotation.z = -tilt * 4.2;
    lanternPivot.rotation.x = Math.sin(t * .9 + .5) * .03;
    const fl = .86 + .08 * Math.sin(t * 12) + .05 * Math.sin(t * 27 + 1.3) + .03 * Math.sin(t * 41);
    lanternLight.intensity = 9 * fl;
    lanternSpot.intensity = 30 * fl;
    glassMat.emissiveIntensity = 2.2 * fl;
    flame.scale.y = 1.8 + Math.sin(t * 19) * .3;
    // drip and ripple
    const d = drop.userData;
    if (d.wait > 0) { d.wait -= dt; drop.visible = false; if (d.wait <= 0) { drop.position.y = 2.6; d.v = 0; } }
    else {
      drop.visible = true; d.v += 9.8 * dt; drop.position.y -= d.v * dt;
      if (drop.position.y <= .26) { d.wait = 2 + Math.random() * 1.6; ripple.userData.age = 0; }
    }
    if (ripple.userData.age !== undefined) {
      ripple.userData.age += dt;
      const k = ripple.userData.age / .7;
      ripple.scale.setScalar(1 + k * 5); ripple.material.opacity = Math.max(0, .7 * (1 - k));
    }
    // dust
    const pa = dust.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let y = pa.getY(i) + dt * .03, x = pa.getX(i) + Math.sin(t * .6 + i) * dt * .02;
      if (y > 2.6) y = .3;
      pa.setXY(i, x, y);
    }
    pa.needsUpdate = true;
    // screen, light, sea
    const stg = S0 ? S0.stage : 0;
    if ((ts | 0) % 2 === 0) drawSea(t, tilt);
    drawScreen(t, stg > 0 && stg < 4);
    led.material.color.setHex(stg === 0 ? ((t % 1) < .5 ? 0xe0623e : 0x3a1a12) : 0x6fbf73);
    updateSean(dt, t);
    applyGlow(t);
    // the camera drifts a little with Sean
    const sx = sean.root.position.x;
    camera.position.x += ((.15 + sx * .22) - camera.position.x) * Math.min(1, dt * 2);
    camera.lookAt(.1 + sx * .12, 1.02, -.6);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const API = {
    ok: false,
    active: false,
    init(container) {
      try { build(container); API.ok = true; }
      catch (err) { API.ok = false; if (canvasEl) canvasEl.remove(); console.warn("3D cabin unavailable:", err); }
      if (canvasEl) canvasEl.hidden = true;
      return API.ok;
    },
    show(S) {
      if (!API.ok) return;
      refresh(S);
      canvasEl.hidden = false;
      resize();
      API.active = true;
      if (!running) { running = true; t0 = performance.now(); last = 0; raf = requestAnimationFrame(frame); }
    },
    hide() {
      if (!API.ok) return;
      API.active = false;
      running = false;
      if (raf) cancelAnimationFrame(raf), raf = 0;
      canvasEl.hidden = true;
    },
    refresh, pick, goTo, faceTo, gesture, place, setGlow,
    // Where a hotspot appears on screen, in page coordinates (used by tests and hints).
    project(id) {
      const h = HS[id]; if (!h) return null;
      const b = new T.Box3().setFromObject(h.group), v = b.getCenter(new T.Vector3()).project(camera);
      const r = canvasEl.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    walkTo: p => walkTo(p.x, p.z, null)
  };
  window.CABIN3D = API;
})();
