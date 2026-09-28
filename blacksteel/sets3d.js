/* The Blacksteel Pirates: 3D locations.
 *
 * Each set builds its world with the kit from world3d.js and returns:
 *   cam { pos, look, fov }, follow(camPos, camLook, player, dt), floor { x0, x1, z0, z1 },
 *   floorMesh, sea, bg, fog, exposure, refresh(S), enter(S, opts), update(dt, t, S), events { ... }.
 * Hotspots are registered with K.hotspot(id, object, pickBox, stand[x,z], look[x,z]).
 */
(function () {
  "use strict";
  if (!window.THREE) return;
  const T = THREE;
  const SETS = {};

  // A painted bell with no clapper: every threshold on Bellgrave has one.
  function bellMesh(K, m, s = 1) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const y = i / 10; pts.push(new T.Vector2((.03 + .09 * Math.pow(1 - y, 1.6)) * s, y * .16 * s)); }
    const b = new T.Mesh(new T.LatheGeometry(pts, 16), m);
    b.castShadow = true;
    return b;
  }

  // An island house: plaster walls, a roof, a door with a carved bell, windows lit or dark.
  function house(K, x, z, color, opts = {}) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = opts.rot || 0;
    const w = opts.w || 3.2, d = opts.d || 3, h = opts.h || 2.6;
    const wall = K.mat(color, .9);
    K.box(w, h, d, wall, 0, h / 2, 0, g);
    const roof = new T.Mesh(new T.CylinderGeometry(.01, d * .72, w + .3, 3, 1), K.mat(opts.scorched ? 0x2a1c16 : 0x8a3a26, .85));
    roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, .6); roof.position.y = h + .35; roof.castShadow = true;
    roof.rotation.set(0, 0, Math.PI / 2); roof.scale.set(.55, 1, 1);
    g.add(roof);
    const face = opts.face === undefined ? 1 : opts.face;
    K.box(.9, 1.8, .06, K.mat(0x3b2a1c, .8), 0, .9, face * (d / 2 + .02), g);
    const b = bellMesh(K, K.mat(0x6a4a30, .7), 1.2); b.position.set(0, 2.05, face * (d / 2 + .06)); g.add(b);
    for (const sx of [-1, 1]) {
      const lit = opts.lit;
      K.box(.5, .5, .05, lit ? K.mat(0xffa650, .6, { emissive: 0xff7a20, emissiveIntensity: 1.4 }) : K.mat(0x1c1612, .7), sx * (w / 2 - .6), 1.6, face * (d / 2 + .02), g);
      K.box(.6, .12, .18, K.mat(0x6d4b2e, .8), sx * (w / 2 - .6), 1.28, face * (d / 2 + .08), g);
      for (let i = 0; i < 4; i++) K.sph(.05, K.mat(i % 2 ? 0x8b4fa3 : 0xa86cc0, .7), sx * (w / 2 - .6) - .2 + i * .13, 1.38, face * (d / 2 + .12), g);
    }
    K.root.add(g);
    return g;
  }

  function planks(K, w, l, seed, base) {
    return new T.Mesh(new T.PlaneGeometry(w, l), K.mat(0xffffff, .78, { map: K.woodTex(seed, base || [96, 66, 42], 8, [w / 2, l / 4], Math.PI / 2) }));
  }

  // ===================================================================
  // 1. Sean's cabin (Chapter One)
  // ===================================================================
  SETS.cabin = function (K) {
    const R = K.root;
    const floorMesh = new T.Mesh(new T.PlaneGeometry(6.4, 4.6), K.mat(0xffffff, .78, { map: K.woodTex(3, [74, 50, 32], 8, [3, 2.2], Math.PI / 2) }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.z = -.1; floorMesh.receiveShadow = true; R.add(floorMesh);
    const wallMat = K.mat(0xffffff, .86, { map: K.woodTex(11, [84, 57, 37], 12, [2.4, 1]) });
    const back = new T.Mesh(new T.PlaneGeometry(6.4, 2.8), wallMat); back.position.set(0, 1.4, -2.2); back.receiveShadow = true; R.add(back);
    for (const s of [-1, 1]) { const side = new T.Mesh(new T.PlaneGeometry(4.6, 2.8), wallMat); side.position.set(s * 3.2, 1.4, -.1); side.rotation.y = -s * Math.PI / 2; side.receiveShadow = true; R.add(side); }
    const ceil = new T.Mesh(new T.PlaneGeometry(6.4, 4.6), K.mat(0x1e140c, 1)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.8, -.1); R.add(ceil);
    const dw = K.mat(0x3a2616, .8);
    for (const z of [-1.7, -.5, .7]) K.box(6.4, .2, .22, dw, 0, 2.7, z);
    for (const x of [-3.05, 3.05]) for (const z of [-1.9, -.4, 1.1]) K.box(.16, 2.8, .2, dw, x, 1.4, z);
    for (const x of [-3.0, -1.0, 1.05, 3.0]) K.box(.2, 2.8, .14, dw, x, 1.4, -2.12);
    const brass = K.mat(0xb58d4a, .32, { metalness: .6 }), brassDark = K.mat(0x7a5a2a, .45, { metalness: .6 });
    const iron = K.mat(0x2b2e33, .5, { metalness: .6 }), steel = K.mat(0x6b7078, .38, { metalness: .7 });

    // door
    const door = new T.Group(); door.position.set(-2.1, 0, -2.13); R.add(door);
    K.box(1.14, 2.14, .1, dw, 0, 1.07, -.02, door);
    K.box(.96, 2.0, .06, K.mat(0xffffff, .8, { map: K.woodTex(21, [78, 54, 34], 4, [1, 1], Math.PI / 2) }), 0, 1.0, .04, door);
    for (const y of [.4, 1.6]) K.box(.8, .07, .02, iron, -.08, y, .08, door);
    const ring = new T.Mesh(new T.TorusGeometry(.055, .012, 8, 20), brass); ring.position.set(.36, .98, .1); door.add(ring);
    K.hotspot("door", door, [1.1, 2.1, .3, 0, 1.05, .1], [-2.1, -.25], [-2.1, -2.2]);

    // coat on its hook
    K.sph(.03, brass, -1.3, 1.9, -2.1);
    const coatHook = new T.Group(); coatHook.position.set(-1.3, 1.88, -2.02); R.add(coatHook);
    const cloth = K.mat(0x1a1f26, .92, { side: T.DoubleSide });
    const hang = new T.Mesh(new T.CylinderGeometry(.1, .3, 1.15, 20, 4, true, Math.PI * .15, Math.PI * 1.7), cloth);
    hang.rotation.y = Math.PI; hang.position.y = -.6; hang.scale.z = .45; hang.castShadow = true; coatHook.add(hang);
    for (const s of [-1, 1]) { const sl = new T.Mesh(new T.CapsuleGeometry(.05, .5, 4, 10), cloth); sl.position.set(s * .17, -.42, .02); sl.rotation.z = s * .12; sl.castShadow = true; coatHook.add(sl); }
    for (let i = 0; i < 4; i++) K.sph(.014, brass, .06, -.3 - i * .13, .09, coatHook);
    K.hotspot("coat", coatHook, [.7, 1.25, .35, 0, -.6, .05], [-1.3, -.25], [-1.3, -2.2]);

    // Nightforge on its pegs
    for (const x of [-.55, .55]) K.cyl(.018, .018, .12, dw, x, 1.98, -2.12).rotation.x = Math.PI / 2;
    const sword = new T.Group(); sword.position.set(0, 2.0, -2.06); R.add(sword);
    K.cyl(.022, .016, 1.1, iron, .05, 0, 0, sword, 10).rotation.z = Math.PI / 2 - .04;
    K.cyl(.017, .017, .16, K.mat(0x2b1d14, .8), -.6, .005, 0, sword, 10).rotation.z = Math.PI / 2;
    const bow = new T.Mesh(new T.TorusGeometry(.07, .007, 6, 16, Math.PI), steel); bow.position.set(-.6, .01, 0); sword.add(bow);
    K.sph(.024, steel, -.69, 0, 0, sword);
    K.hotspot("sword", sword, [1.5, .3, .2, -.05, 0, 0], [-.1, -.25], [-.1, -2.2]);

    // porthole with a live sea
    const port = new T.Group(); port.position.set(1.75, 1.6, -2.18); R.add(port);
    const seaC = document.createElement("canvas"); seaC.width = seaC.height = 160;
    const seaCtx = seaC.getContext("2d"), seaTex = new T.CanvasTexture(seaC); seaTex.colorSpace = T.SRGBColorSpace;
    const glass = new T.Mesh(new T.CircleGeometry(.32, 40), new T.MeshBasicMaterial({ map: seaTex })); glass.position.z = .01; port.add(glass);
    const rim = new T.Mesh(new T.TorusGeometry(.36, .06, 14, 44), brass); rim.position.z = .03; port.add(rim);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .39; K.sph(.018, brassDark, Math.cos(a) * .43, Math.sin(a) * .43, .04, port); }
    K.hotspot("porthole", port, [.95, .95, .2, 0, 0, .05], [1.75, -.25], [1.75, -2.2]);

    // bunk, shelf, bucket
    const bunk = new T.Group(); bunk.position.set(2.55, 0, -1.4); R.add(bunk);
    K.box(1.3, .42, 1.2, dw, 0, .21, 0, bunk);
    K.box(1.2, .12, 1.1, K.mat(0xd9cfbb, 1), 0, .47, 0, bunk);
    K.box(1.22, .1, .8, K.mat(0x3c4a38, 1), 0, .54, .12, bunk);
    K.sph(.18, K.mat(0xd9cfbb, 1), -.35, .58, -.34, bunk, 1.4, .45, .9);
    const plateBunk = new T.Group(); plateBunk.position.set(.2, .6, .1); bunk.add(plateBunk);
    K.cyl(.14, .12, .02, K.mat(0xe9e3d6, .35), 0, 0, 0, plateBunk, 24);
    K.sph(.06, K.mat(0x8a6440, .6), 0, .025, 0, plateBunk, 1.6, .45, .7);
    K.hotspot("bunk", bunk, [1.3, .8, 1.2, 0, .4, 0], [1.95, -.25], [2.55, -1.4]);
    const shelf = new T.Group(); shelf.position.set(2.55, 1.35, -2.05); R.add(shelf);
    K.box(1.1, .05, .28, dw, 0, 0, 0, shelf);
    [.24, .3, .2, .27].forEach((h, i) => K.box(.07, h, .2, K.mat([0x5b2b25, 0x2f4a3f, 0x6b5433, 0x2c3a52][i], .8), -.42 + i * .085, h / 2 + .025, 0, shelf));
    K.cyl(.04, .045, .26, K.mat(0x2f6a44, .1, { transparent: true, opacity: .75 }), .05, .155, 0, shelf);
    const compass = K.cyl(.07, .07, .03, brass, .32, .04, 0, shelf, 24);
    const face = new T.Mesh(new T.CircleGeometry(.058, 24), K.mat(0xe8dfc6, .6)); face.rotation.x = -Math.PI / 2; face.position.y = .016; compass.add(face);
    K.box(.008, .004, .09, K.mat(0xb0413a, .5), 0, .02, 0, compass);
    K.hotspot("shelf", shelf, [1.1, .45, .35, 0, .18, 0], [2.2, -.25], [2.55, -2.2]);
    const bucket = new T.Group(); bucket.position.set(1.45, 0, -1.1); R.add(bucket);
    const bm = K.mat(0x5f656c, .45, { metalness: .6, side: T.DoubleSide });
    K.cyl(.18, .15, .32, bm, 0, .16, 0, bucket, 20, true);
    K.cyl(.17, .17, .01, K.mat(0x0e1a22, .05, { metalness: .3 }), 0, .24, 0, bucket, 20);
    const ripple = new T.Mesh(new T.RingGeometry(.02, .03, 24), new T.MeshBasicMaterial({ color: 0x9fc0d8, transparent: true, opacity: 0 }));
    ripple.rotation.x = -Math.PI / 2; ripple.position.y = .25; bucket.add(ripple);
    const drop = K.sph(.012, new T.MeshBasicMaterial({ color: 0xbfd8ea }), 0, 2.6, 0, bucket, 1, 1.6, 1);
    drop.userData.v = 0; drop.userData.wait = 1;
    K.hotspot("bucket", bucket, [.5, .5, .5, 0, .2, 0], [1.3, -.25], [1.45, -1.1]);

    // table and what's on it
    const table = new T.Group(); table.position.set(0, 0, -1.15); R.add(table);
    K.box(2.2, .08, 1.0, K.mat(0xffffff, .7, { map: K.woodTex(31, [110, 76, 46], 5, [1, 1]) }), 0, .8, 0, table);
    for (const [x, z] of [[-.98, -.4], [.98, -.4], [-.98, .4], [.98, .4]]) K.cyl(.05, .04, .76, dw, x, .38, z, table, 12);
    K.hotspot("table", table, [2.2, .12, 1.0, 0, .8, 0], [0, -.25], [0, -1.15]);
    const Y = .84, paper = K.mat(0xe6dcc3, .9, { side: T.DoubleSide });
    const receipts = new T.Group(); receipts.position.set(-.82, Y, .12); table.add(receipts);
    [[0, 0, .2], [.06, .03, -.3], [-.05, -.04, .6]].forEach(([x, z, r]) => { const p = new T.Mesh(new T.PlaneGeometry(.2, .13), paper); p.rotation.x = -Math.PI / 2; p.rotation.z = r; p.position.set(x, .002 + Math.abs(r) * .004, z); receipts.add(p); });
    K.hotspot("receipts", receipts, [.36, .12, .3], [-.82, -.25], [-.82, -1.15]);
    const chartG = new T.Group(); table.add(chartG);
    const chartTex = marked => K.canvasTex(512, 340, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#efe0bb"); g.addColorStop(1, "#c9ad7b"); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#7a5a34"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(30, 60); c.bezierCurveTo(90, 30, 140, 110, 90, 150); c.bezierCurveTo(60, 170, 30, 120, 30, 60); c.stroke();
      c.beginPath(); c.moveTo(390, 220); c.bezierCurveTo(440, 190, 500, 250, 470, 300); c.bezierCurveTo(430, 320, 380, 280, 390, 220); c.stroke();
      c.strokeStyle = "rgba(122,90,52,.35)"; c.lineWidth = 1;
      for (let a = 0; a < 16; a++) { c.beginPath(); c.moveTo(256, 170); c.lineTo(256 + Math.cos(a * Math.PI / 8) * 400, 170 + Math.sin(a * Math.PI / 8) * 400); c.stroke(); }
      if (marked) { c.strokeStyle = "#a8322a"; c.lineWidth = 4; c.setLineDash([10, 8]); c.beginPath(); c.arc(250, 175, 34, 0, 6.3); c.stroke(); }
    });
    const chartFolded = new T.Mesh(new T.PlaneGeometry(.5, .33), K.mat(0xffffff, .9, { map: chartTex(false) }));
    chartFolded.rotation.x = -Math.PI / 2; chartFolded.rotation.z = .12; chartFolded.position.set(-.3, Y + .002, .05); chartG.add(chartFolded);
    const chartSpread = new T.Mesh(new T.PlaneGeometry(.9, .6), K.mat(0xffffff, .9, { map: chartTex(true) }));
    chartSpread.rotation.x = -Math.PI / 2; chartSpread.rotation.z = -.04; chartSpread.position.set(-.25, Y + .003, .05); chartG.add(chartSpread);
    K.hotspot("chart", chartG, [.9, .03, .6, -.25, Y, .05], [-.3, -.25], [-.3, -1.15]);
    const plate = new T.Group(); plate.position.set(-.28, Y + .012, .06); table.add(plate);
    K.cyl(.15, .12, .022, K.mat(0xe9e3d6, .35), 0, 0, 0, plate, 28);
    K.sph(.065, K.mat(0x8a6440, .6), -.01, .025, 0, plate, 1.7, .45, .7);
    K.box(.012, .006, .16, steel, .19, .014, .02, plate).rotation.y = .5;
    K.hotspot("plate", plate, [.4, .12, .36], [-.28, -.25], [-.28, -1.15]);
    const tides = new T.Group(); tides.position.set(.3, Y + .025, .18); tides.rotation.y = -.2; table.add(tides);
    K.box(.22, .045, .16, K.mat(0x4f6450, .9), 0, 0, 0, tides);
    K.hotspot("tides", tides, [.3, .12, .24], [.3, -.25], [.3, -1.15]);
    const comm = new T.Group(); comm.position.set(.72, Y, -.18); comm.rotation.y = -.25; table.add(comm);
    K.box(.36, .27, .22, brass, 0, .135, 0, comm);
    K.box(.37, .02, .23, brassDark, 0, .275, 0, comm);
    const scr = document.createElement("canvas"); scr.width = 128; scr.height = 84;
    const scrCtx = scr.getContext("2d"), scrTex = new T.CanvasTexture(scr); scrTex.colorSpace = T.SRGBColorSpace;
    K.box(.21, .15, .01, iron, -.05, .15, .11, comm);
    const screen = new T.Mesh(new T.PlaneGeometry(.18, .12), new T.MeshBasicMaterial({ map: scrTex })); screen.position.set(-.05, .15, .117); comm.add(screen);
    const led = K.sph(.013, new T.MeshBasicMaterial({ color: 0xe0623e }), .12, .2, .112, comm);
    K.cyl(.005, .006, .34, brass, .14, .45, -.05, comm, 8).rotation.z = -.15;
    K.hotspot("comm", comm, [.45, .7, .32, 0, .3, 0], [.72, -.25], [.72, -1.35]);
    const packet = new T.Group(); packet.position.set(1.02, Y + .02, .12); packet.rotation.y = .3; table.add(packet);
    K.box(.18, .035, .13, K.mat(0xd9c393, .9), 0, 0, 0, packet);
    K.box(.185, .037, .012, K.mat(0x7a5433, 1), 0, .001, 0, packet);
    K.cyl(.018, .018, .006, K.mat(0x9e2a22, .5), 0, .02, 0, packet, 14);
    K.hotspot("packet", packet, [.28, .14, .22], [1.02, -.25], [1.02, -1.15]);

    // the lantern, with the light that casts shadows
    const pivot = new T.Group(); pivot.position.set(.05, 2.6, -.75); R.add(pivot);
    for (let i = 0; i < 5; i++) { const l = new T.Mesh(new T.TorusGeometry(.022, .006, 6, 12), iron); l.position.y = -.04 - i * .055; l.rotation.y = i % 2 ? Math.PI / 2 : 0; pivot.add(l); }
    const lantern = new T.Group(); lantern.position.y = -.5; pivot.add(lantern);
    const glassMat = new T.MeshStandardMaterial({ color: 0xffd79a, emissive: 0xffa94a, emissiveIntensity: 2.2, transparent: true, opacity: .85 });
    K.box(.15, .2, .15, glassMat, 0, 0, 0, lantern).castShadow = false;
    const cap = new T.Mesh(new T.ConeGeometry(.13, .1, 4), brass); cap.position.y = .15; cap.rotation.y = Math.PI / 4; lantern.add(cap);
    const pl = new T.PointLight(0xffb866, 9, 9, 1.6); lantern.add(pl);
    const spot = new T.SpotLight(0xffb866, 30, 10, 1.25, .75, 1.5); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0015; spot.shadow.radius = 5;
    const st = new T.Object3D(); st.position.set(0, -3, .2); lantern.add(st); spot.target = st; lantern.add(spot);
    const moon = new T.SpotLight(0x8fb4e8, 6, 9, .45, .9, 1.2); moon.position.set(2.1, 2.1, -2.9); R.add(moon);
    const mt = new T.Object3D(); mt.position.set(.6, 0, .3); R.add(mt); moon.target = mt;
    R.add(new T.HemisphereLight(0x55607a, 0x2a1a0c, .9));
    const key = new T.DirectionalLight(0xffd8b0, 1.6); key.position.set(1.5, 3.2, 6); R.add(key);
    K.add(K.particles({ count: 120, size: .02, color: 0xffd9a0, life: [4, 9], at: r => [-1.6 + r() * 3.2, .3 + r() * 2.2, -1.8 + r() * 2.6], vel: r => [(r() - .5) * .04, .03, (r() - .5) * .04], wobble: .02, opacity: .7 }));

    const sean = K.actor("sean", "sean", -.5, .6, 0);

    function drawSea(t, tilt) {
      const c = seaCtx, W = 160;
      c.save(); c.translate(W / 2, W / 2); c.rotate(-tilt * 1.6); c.translate(-W / 2, -W / 2);
      let g = c.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, "#050b16"); g.addColorStop(1, "#1d3550"); c.fillStyle = g; c.fillRect(-40, -40, 240, 136);
      c.fillStyle = "#efe7cc"; c.beginPath(); c.arc(112, 44, 11, 0, 6.3); c.fill();
      g = c.createLinearGradient(0, 94, 0, 200); g.addColorStop(0, "#1b3450"); g.addColorStop(1, "#040a12"); c.fillStyle = g; c.fillRect(-40, 94, 240, 120);
      for (let i = 0; i < 12; i++) {
        const y = 98 + i * 5 + i * i * .3; c.strokeStyle = `rgba(150,185,215,${(.4 - i * .028).toFixed(3)})`; c.lineWidth = 1; c.beginPath();
        for (let x = -40; x <= 200; x += 5) { const yy = y + Math.sin(x * .08 + t * (1.1 + i * .1) + i) * (1 + i * .35); x === -40 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
        c.stroke();
      }
      for (let i = 0; i < 12; i++) { const w = 6 + i * 2.2, x = 112 + Math.sin(t * 1.7 + i * 1.3) * (2 + i * 1.2); c.fillStyle = `rgba(245,236,205,${(.5 - i * .035).toFixed(3)})`; c.fillRect(x - w / 2, 97 + i * 4.5, w, 1.6); }
      c.restore(); seaTex.needsUpdate = true;
    }
    function drawScreen(t, live) {
      const c = scrCtx, g = c.createRadialGradient(64, 42, 4, 64, 42, 80);
      g.addColorStop(0, live ? "#3f8078" : "#172524"); g.addColorStop(1, live ? "#123230" : "#081010");
      c.fillStyle = g; c.fillRect(0, 0, 128, 84);
      c.strokeStyle = live ? "#c8f6e8" : "#243c3a"; c.lineWidth = live ? 3 : 1.5; c.beginPath();
      for (let x = 4; x <= 124; x += 3) { const y = live ? 42 + Math.sin(x * .19 + t * 9) * (9 + 7 * Math.sin(t * 3 + x * .05)) * (.5 + .5 * Math.sin(t * 2.3)) : 42 + (Math.random() - .5) * 4; x === 4 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke(); scrTex.needsUpdate = true;
    }

    let frameN = 0;
    return {
      cam: { pos: [.15, 1.72, 5.3], look: [.1, 1.02, -.6], fov: 38 },
      follow(cp, cl, p) { cp.set(.15 + p.pos.x * .22, 1.72, 5.3); cl.set(.1 + p.pos.x * .12, 1.02, -.6); },
      floor: { x0: -2.5, x1: 2.1, z0: -.3, z1: 1.2 }, floorMesh,
      bg: 0x07050a, fog: [0x0b0706, .045],
      pickPriority: { table: 0, chart: 1 },
      enter() { sean.place(-.5, .6, 0); },
      refresh(S) {
        const f = S.flags || {}, stg = S.stage || 0, has = id => (S.inv || []).includes(id);
        plate.visible = !f.plateMoved; plateBunk.visible = !!f.plateMoved;
        chartFolded.visible = !has("chart") && !f.chartSpread; chartSpread.visible = !!f.chartSpread;
        chartG.visible = chartFolded.visible || chartSpread.visible;
        coatHook.visible = !has("coat"); sword.visible = !has("sword");
        packet.visible = stg >= 3 && !has("packet");
        sean.gear({ coat: has("coat"), sword: has("sword") });
      },
      update(dt, t, S) {
        const tilt = Math.sin(t * .8) * .012 + Math.sin(t * .37 + 1) * .005;
        R.rotation.z = tilt; R.rotation.x = Math.sin(t * .53) * .004;
        pivot.rotation.z = -tilt * 4.2; pivot.rotation.x = Math.sin(t * .9 + .5) * .03;
        const fl = .86 + .08 * Math.sin(t * 12) + .05 * Math.sin(t * 27 + 1.3);
        pl.intensity = 9 * fl; spot.intensity = 30 * fl; glassMat.emissiveIntensity = 2.2 * fl;
        const d = drop.userData;
        if (d.wait > 0) { d.wait -= dt; drop.visible = false; if (d.wait <= 0) { drop.position.y = 2.6; d.v = 0; } }
        else { drop.visible = true; d.v += 9.8 * dt; drop.position.y -= d.v * dt; if (drop.position.y <= .26) { d.wait = 2 + Math.random() * 1.6; ripple.userData.age = 0; } }
        if (ripple.userData.age !== undefined) { ripple.userData.age += dt; const k = ripple.userData.age / .7; ripple.scale.setScalar(1 + k * 5); ripple.material.opacity = Math.max(0, .7 * (1 - k)); }
        const stg = S ? S.stage : 0;
        if (frameN++ % 2 === 0) drawSea(t, tilt);
        drawScreen(t, stg > 0 && stg < 4);
        led.material.color.setHex(stg === 0 ? ((t % 1) < .5 ? 0xe0623e : 0x3a1a12) : 0x6fbf73);
      }
    };
  };

  // ===================================================================
  // 2. The frigate's deck: running the reef toward burning Bellgrave
  // ===================================================================
  SETS.deck = function (K) {
    const R = K.root;
    const sea = K.makeSea(420, 0x0c1a28, 1.3); sea.position.y = -.2; R.add(sea);
    R.add(new T.HemisphereLight(0x3a4a66, 0x1a0c06, .7));
    const moonL = new T.DirectionalLight(0x9ab4e0, .9); moonL.position.set(-20, 30, 20); R.add(moonL);
    const glow = new T.PointLight(0xff7a2a, 1400, 300, 1.1); glow.position.set(0, 18, -125); R.add(glow);
    const haze = new T.Mesh(new T.PlaneGeometry(400, 80), new T.MeshBasicMaterial({ color: 0x8a3a14, transparent: true, opacity: .35, depthWrite: false })); haze.position.set(0, 20, -190); R.add(haze);

    // the island, burning in the distance
    const island = new T.Group(); island.position.set(0, 0, -150); R.add(island);
    const black = K.mat(0x0b0909, .95);
    K.rock(26, black, 0, -4, 0, island, 1.8, .75, 1, 3);
    K.rock(12, black, -34, -2, 6, island, 1.2, 1.4, 1, 5);
    K.rock(14, black, 36, -2, 4, island, 1.3, 1.2, 1, 7);
    for (const [x, y, z, s] of [[-8, 10, 10, 3], [6, 13, 6, 3.5], [16, 8, 14, 2.5], [-18, 6, 16, 2.2], [0, 5, 20, 3]]) K.add(K.fire(x, y, z, s, false), island);
    for (const [x, y, z] of [[-6, 14, 8], [8, 16, 4], [0, 10, 18]]) K.add(K.smoke(x, y, z, { count: 12, size: 9, rise: 40, life: 9, opacity: .6, color: 0x140e0c, drift: 2 }), island);
    for (let i = 0; i < 40; i++) K.box(1.2, 1, 1, K.mat(0xffa650, .6, { emissive: 0xff7a20, emissiveIntensity: 2 }), -20 + (i * 37) % 40, 3 + (i * 13) % 14, 8 + (i * 7) % 14, island).castShadow = false;

    // seven warships in a crescent around the harbor
    const ships = [];
    for (let i = 0; i < 7; i++) {
      const a = -1 + i / 3, g = new T.Group();
      g.position.set(Math.sin(a) * 60, 0, -110 + Math.cos(a) * 18);
      g.rotation.y = a * .8;
      K.box(4, 2.4, 22, K.mat(0x14161a, .8), 0, .6, 0, g);
      for (const z of [-6, 1, 7]) { K.cyl(.25, .3, 16, K.mat(0x14161a, .8), 0, 9, z, g, 8); K.box(8, 6, .2, K.mat(0x2a2c30, .9), 0, 10, z, g); }
      for (let p = 0; p < 6; p++) K.box(.4, .3, .1, K.mat(0x3a2010, .6, { emissive: 0x6a2a08, emissiveIntensity: .8 }), 2.05, 1, -8 + p * 3, g);
      const f = new T.PointLight(0xffe0a0, 0, 60, 1.5); f.position.set(3, 2, 0); g.add(f);
      R.add(g); ships.push({ g, f, next: 1 + Math.random() * 4 });
    }

    // the ship: deck, rails, mast, sail, wheel
    const ship = new T.Group(); R.add(ship);
    const deck = planks(K, 3.4, 11, 41, [90, 62, 40]); deck.rotation.x = -Math.PI / 2; deck.position.set(0, .01, 0); deck.receiveShadow = true; ship.add(deck);
    const hullM = K.mat(0x2a1c12, .85);
    K.box(3.6, 1.2, 11.4, hullM, 0, -.6, 0, ship);
    for (const s of [-1, 1]) { K.box(.12, .7, 11, hullM, s * 1.72, .35, 0, ship); K.box(.2, .06, 11, K.mat(0x5a3f28, .7), s * 1.72, .72, 0, ship); }
    const bowG = new T.Mesh(new T.ConeGeometry(1.8, 3.5, 4, 1), hullM); bowG.rotation.x = -Math.PI / 2; bowG.rotation.y = Math.PI / 4; bowG.position.set(0, -.3, -7.2); bowG.scale.set(1, 1, .55); ship.add(bowG);
    K.cyl(.12, .16, 9, K.mat(0x3a2616, .8), 0, 4.5, -1.5, ship, 10);
    K.box(4, .1, .1, K.mat(0x3a2616, .8), 0, 7.6, -1.5, ship);
    const sailGeo = new T.PlaneGeometry(3.8, 5, 8, 8), sp = sailGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i); sp.setZ(i, -.5 * (1 - (x / 1.9) ** 2)); }
    sailGeo.computeVertexNormals();
    const sail = new T.Mesh(sailGeo, K.mat(0xc8b894, .95, { side: T.DoubleSide })); sail.position.set(0, 5.6, -1.35); sail.scale.set(.8, .75, 1); sail.castShadow = true; ship.add(sail);
    K.box(.3, .1, .8, K.mat(0x8a7a5a, .9), .6, 5.8, -1.3, sail);
    const wheel = new T.Group(); wheel.position.set(0, 1.3, 3.3); ship.add(wheel);
    const wm = K.mat(0x5a3a20, .6);
    const wr = new T.Mesh(new T.TorusGeometry(.42, .035, 8, 28), wm); wr.castShadow = true; wheel.add(wr);
    for (let i = 0; i < 8; i++) { const sp2 = K.box(.03, 1.1, .03, wm, 0, 0, 0, wheel); sp2.rotation.z = i * Math.PI / 8 * 2; }
    K.box(.12, 1.3, .12, wm, 0, -.65, .1, ship).position.set(0, .65, 3.4);
    const lamp = new T.PointLight(0xffb060, 4, 8, 1.6); lamp.position.set(0, 2.2, 3.8); ship.add(lamp);
    K.sph(.06, new T.MeshBasicMaterial({ color: 0xffd08a }), 0, 2.2, 3.8, ship);
    const sean = K.actor("sean", "sean", 0, 3.85, Math.PI, ship);
    sean.gear({ coat: true, sword: true }); sean.pose("wheel", true);

    // reef rocks and cannon splashes
    const rocks = [];
    const reefM = K.mat(0x121416, .9);
    for (let i = 0; i < 18; i++) { const r = K.rock(1.6, reefM, 0, -100, 0, R, 1.2, 1, 1.4, 20 + i); r.visible = false; rocks.push(r); }
    const splashAt = { x: 0, z: -30, t: 0 };
    const splash = K.particles({ count: 120, size: .5, color: 0xdfeaf2, end: 0x7090a8, life: [.6, 1.4], normal: true, opacity: .8, gravity: 9, at: r => [splashAt.x + (r() - .5) * 1.5, 0, splashAt.z + (r() - .5) * 1.5], vel: r => [(r() - .5) * 2, 6 + r() * 6, (r() - .5) * 2], paused: () => splashAt.t <= 0 });
    K.add(splash);
    const smokeCloud = K.smoke(0, .5, -30, { count: 8, size: 3, rise: 3, life: 4, opacity: .5, color: 0x8a8a8a, drift: .5 });
    smokeCloud.visible = false; K.add(smokeCloud);
    const arrow = new T.Mesh(new T.ConeGeometry(.5, 1, 4), new T.MeshBasicMaterial({ color: 0xeaa94c, transparent: true, opacity: .85 }));
    arrow.rotation.x = Math.PI; arrow.visible = false; R.add(arrow);

    const run = { on: false, lane: 0, x: 0, rows: [], row: 0, speed: 14, res: null, hints: false, hit: false, fails: 0 };
    const LANES = [-4, 0, 4];
    function layout(i) {
      const gap = run.rows[i];
      const z = -70;
      let k = 0;
      for (const r of rocks) r.visible = false;
      for (const ln of [0, 1, 2]) if (ln !== gap) for (let j = 0; j < 3; j++) { const r = rocks[k++]; r.visible = true; r.position.set(LANES[ln] + (j - 1) * 1.2, .2, z + (j % 2) * .8); r.rotation.y = j; }
      run.z = z; run.shot = false; run.hit = false;
    }

    let rocking = 0;
    return {
      cam: { pos: [3.2, 3.4, 9.5], look: [-1, 3, -60], fov: 46 },
      follow(cp, cl) { cp.set(3.2 + ship.position.x * .8, 3.4, 9.5); cl.set(-1 + ship.position.x * .6, 3, -60); },
      floor: null, sea, bg: 0x2a130c, fog: [0x2a130c, .0065], exposure: 1.55,
      enter() { ship.position.x = 0; run.on = false; for (const r of rocks) r.visible = false; },
      update(dt, t) {
        rocking = Math.sin(t * .9) * .03;
        ship.rotation.z = rocking + (run.x - ship.position.x) * -.02;
        ship.rotation.x = Math.sin(t * .6) * .015;
        ship.position.y = Math.sin(t * 1.1) * .15;
        sail.rotation.y = Math.sin(t * .7) * .04;
        for (const s of ships) {
          s.next -= dt;
          if (s.next <= 0) { s.f.intensity = 80; s.next = 1.5 + Math.random() * 3.5; }
          s.f.intensity *= Math.pow(.02, dt);
        }
        if (splashAt.t > 0) splashAt.t -= dt;
        if (!run.on) return;
        // steer toward the chosen lane
        run.x = LANES[run.lane];
        ship.position.x += (run.x - ship.position.x) * Math.min(1, dt * 2.6);
        wheel.rotation.z = (ship.position.x - run.x) * .25;
        run.z += run.speed * dt;
        for (const r of rocks) if (r.visible) r.position.z += run.speed * dt;
        // a cannon shot lands in the gap and leaves smoke to steer through
        if (!run.shot && run.z > -52) {
          run.shot = true;
          const gx = LANES[run.rows[run.row]];
          ships[(run.row * 3) % 7].f.intensity = 120;
          splashAt.x = gx; splashAt.z = run.z; splashAt.t = .9;
          smokeCloud.visible = true; smokeCloud.position.set(gx, .3, run.z);
          if (run.hints) { arrow.visible = true; }
        }
        if (smokeCloud.visible) smokeCloud.position.z += run.speed * dt;
        if (arrow.visible) arrow.position.set(LANES[run.rows[run.row]], 3.2 + Math.sin(t * 5) * .3, smokeCloud.position.z);
        if (!run.hit && run.z > -1.5) {
          run.hit = true;
          const ok = Math.abs(ship.position.x - LANES[run.rows[run.row]]) < 1.6;
          if (!ok) {
            run.fails++;
            splashAt.x = ship.position.x; splashAt.z = -1; splashAt.t = .7;
            WORLD.shake(.6, .25);
            run.on = false;
            const r = run.res; run.res = null; r && r({ fail: true, row: run.row });
            return;
          }
        }
        if (run.z > 14) {
          run.row++;
          smokeCloud.visible = false; arrow.visible = false;
          if (run.row >= run.rows.length) { run.on = false; for (const r of rocks) r.visible = false; const r = run.res; run.res = null; r && r({ done: true }); return; }
          layout(run.row);
        }
      },
      events: {
        // Runs the reef from the current row. Resolves {fail} on a hit (the chapter decides what Shannon says) or {done}.
        reef(opts = {}) {
          if (opts.reset) { run.rows = [1, 0, 2, 1, 2, 0]; run.row = 0; run.fails = 0; }
          run.hints = !!opts.hints;
          run.lane = 1; ship.position.x = 0;
          layout(run.row);
          run.on = true;
          return new Promise(res => { run.res = res; });
        },
        steer(dir) { if (run.on) run.lane = Math.max(0, Math.min(2, run.lane + dir)); },
        peek() { return run.on ? { lane: run.lane, gap: run.rows[run.row], z: run.z } : null; },
        crash() {
          WORLD.shake(1.2, .5);
          WORLD.flash("#000", 900, 1);
          return new Promise(r => setTimeout(r, 900));
        }
      }
    };
  };

  // ===================================================================
  // 3. The beach below the burning village (Chapters Three, Seven, Eight)
  // ===================================================================
  SETS.beach = function (K) {
    const R = K.root;
    const sea = K.makeSea(400, 0x0c1a28, .9); sea.position.set(0, -.25, 0); R.add(sea);
    const sandTex = K.noiseTex(4, [96, 84, 66], 34, [10, 8]);
    const floorMesh = new T.Mesh(new T.PlaneGeometry(44, 34, 1, 1), K.mat(0xffffff, .95, { map: sandTex }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(-13, 0, -6); floorMesh.receiveShadow = true; R.add(floorMesh);
    // the shoreline slopes into the water
    const shore = new T.Mesh(new T.PlaneGeometry(6, 34), K.mat(0xffffff, .6, { map: sandTex, color: 0x9a8a70 }));
    shore.rotation.x = -Math.PI / 2 - 0; shore.rotation.y = -.12; shore.position.set(11.5, -.2, -6); shore.receiveShadow = true; R.add(shore);

    const hemi = new T.HemisphereLight(0x3a4a66, 0x2a120a, .8); R.add(hemi);
    const moonL = new T.DirectionalLight(0x9ab4e0, .8); moonL.position.set(20, 30, 20); moonL.castShadow = true;
    moonL.shadow.mapSize.set(1024, 1024); Object.assign(moonL.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, far: 80 }); R.add(moonL);
    const key = new T.DirectionalLight(0xffc49a, .9); key.position.set(0, 6, 14); R.add(key);
    const villageGlow = new T.PointLight(0xff7a2a, 120, 60, 1.3); villageGlow.position.set(-6, 8, -18); R.add(villageGlow);

    // the village on the hill, burning
    const black = K.mat(0x121010, .95);
    K.rock(18, K.mat(0x1e1812, .95), -8, -6, -34, R, 2.2, .9, 1, 11);
    K.rock(9, black, 18, -2, -26, R, 1.3, 1.6, 1, 13);
    K.rock(8, black, -30, -2, -20, R, 1.2, 1.6, 1, 15);
    const cols = [0xd1674a, 0xe8c15a, 0x5e8fb8, 0x8ab06a, 0xe39a6b, 0xb07ab0];
    for (let i = 0; i < 16; i++) {
      const a = -1.3 + i / 15 * 2.6, rr = 12 + (i % 3) * 5;
      const hx = -8 + Math.sin(a) * rr * 1.3, hz = -26 + Math.cos(a) * rr * .4 - (i % 3) * 3, hy = 2 + (i % 3) * 2.2;
      house(K, hx, hz, cols[i % 6], { lit: i % 3 === 0, scorched: i % 2 === 0, rot: -a * .6, w: 2.6, h: 2.2 }).position.y = hy;
      K.box(3.4, hy, 3.4, K.mat(0x2a2420, .95), hx, hy / 2, hz).rotation.y = -a * .6;
    }
    const fires = [[-12, 3, -20, 2], [-3, 5, -24, 2.4], [4, 3.5, -19, 1.8], [-8, 7, -29, 2.2], [9, 5, -25, 1.6]];
    fires.forEach(([x, y, z, s], i) => K.add(K.fire(x, y, z, s, i < 2)));
    for (const [x, y, z] of [[-10, 6, -21], [-2, 8, -25], [6, 6, -21]]) K.add(K.smoke(x, y, z, { count: 12, size: 4, rise: 22, life: 8, opacity: .55, color: 0x1a1210, drift: 1.4 }));
    K.add(K.particles({ count: 160, size: .09, color: 0xffb25a, end: 0x8a2a0a, life: [3, 7], flicker: true, at: r => [-16 + r() * 22, 2 + r() * 6, -26 + r() * 10], vel: r => [(r() - .2) * 1.2, .8 + r() * 1.6, (r() - .5) * .8], wobble: .6 }));

    // overturned fishing boats
    const boatM = K.mat(0x5a3a22, .8, { side: T.DoubleSide });
    const boats = [];
    for (const [x, z, r] of [[-1.2, -1.6, .4], [1.8, -2.5, -.3], [-3.4, .2, 1.2], [4, .8, .9]]) {
      const b = new T.Mesh(new T.CylinderGeometry(.8, .8, 3.2, 16, 1, true, 0, Math.PI), boatM);
      b.rotation.set(0, r, Math.PI / 2); b.rotation.order = "YZX"; b.position.set(x, .02, z); b.scale.set(.4, .75, .75); b.castShadow = b.receiveShadow = true;
      R.add(b); boats.push(b);
    }
    K.hotspot("boats", boats[0], [.8, 3.2, 1.2], [-.4, -.2], [-1.2, -1.6]);

    // Sean's frigate, run aground, with its mast
    const frig = new T.Group(); frig.position.set(8.2, .2, -3); frig.rotation.set(.12, -.7, .18); R.add(frig);
    const hullM = K.mat(0x2a1c12, .85);
    K.box(2.4, 1.6, 8, hullM, 0, .4, 0, frig);
    const bow = new T.Mesh(new T.ConeGeometry(1.2, 2.6, 4), hullM); bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, .4, -5.2); bow.scale.set(1, 1, .7); frig.add(bow);
    const mastPivot = new T.Group(); mastPivot.position.set(0, 1.2, -.5); frig.add(mastPivot);
    K.cyl(.1, .14, 7, K.mat(0x3a2616, .8), 0, 3.5, 0, mastPivot, 10);
    K.box(3, .08, .08, K.mat(0x3a2616, .8), 0, 5.8, 0, mastPivot);
    const fsail = new T.Mesh(new T.PlaneGeometry(2.6, 3), K.mat(0xb8a888, .95, { side: T.DoubleSide })); fsail.position.set(0, 4.2, .05); fsail.rotation.y = .1; mastPivot.add(fsail);
    K.hotspot("frigate", frig, [3, 3, 9, 0, 1, 0], [5.6, -1.2], [8.2, -3]);

    // the harbor, the channel, the basalt spine and the boats
    const dock = planks(K, 1.6, 10, 55, [70, 50, 34]); dock.rotation.x = -Math.PI / 2; dock.rotation.z = Math.PI / 2; dock.position.set(9, .35, -9); R.add(dock);
    for (let i = 0; i < 6; i++) K.cyl(.12, .12, 1.6, K.mat(0x2a1c12, .9), 5 + i * 1.8, -.2, -8.3);
    for (let i = 0; i < 12; i++) K.rock(1.6 + (i % 3) * .5, black, 14 + i * 1.8, -.4, 4 + Math.sin(i) * 1.5, R, 1, 1.2 + (i % 2) * .6, 1, 30 + i);
    const evac = [];
    for (let i = 0; i < 5; i++) {
      const g = new T.Group(); g.position.set(12 + i * 3, 0, -2 + i * 1.5);
      const hb = new T.Mesh(new T.CylinderGeometry(.6, .6, 2.6, 12, 1, true, Math.PI, Math.PI), boatM); hb.rotation.z = Math.PI / 2; hb.scale.set(.6, 1, 1); g.add(hb);
      for (let p = 0; p < 3; p++) K.sph(.14, K.mat(cols[(i + p) % 6], .8), -.8 + p * .8, .45, 0, g, 1, 1.4, 1);
      g.visible = false; R.add(g); evac.push(g);
    }

    // warships offshore
    const ships = [];
    for (let i = 0; i < 7; i++) {
      const a = -1 + i / 3, g = new T.Group();
      g.position.set(40 + Math.cos(a) * 14, 0, -6 + Math.sin(a) * 34);
      g.rotation.y = Math.PI / 2 + a * .3;
      K.box(3, 2, 16, K.mat(0x16181c, .8), 0, .5, 0, g);
      for (const z of [-4, 1, 5]) { K.cyl(.2, .25, 12, K.mat(0x16181c, .8), 0, 6.5, z, g, 8); K.box(6, 4.5, .15, K.mat(0x2a2c30, .9), 0, 7.5, z, g); }
      for (let p = 0; p < 5; p++) K.box(.3, .24, .1, K.mat(0x3a2010, .6, { emissive: 0x6a2a08, emissiveIntensity: .8 }), -1.55, .8, -6 + p * 3, g);
      const f = new T.PointLight(0xffe0a0, 0, 50, 1.5); f.position.set(-3, 2, 0); g.add(f);
      R.add(g); ships.push({ g, f, next: 1 + Math.random() * 3, base: g.rotation.y, sink: 0, tilt: 0 });
    }

    // the glass where sand fused, and the missing cliff (after the black arc)
    const glass = new T.Mesh(new T.CircleGeometry(1.4, 32), K.mat(0x9ab0a4, .05, { metalness: .5, transparent: true, opacity: .55 }));
    glass.rotation.x = -Math.PI / 2; glass.position.set(3.4, .015, 1.4); glass.visible = false; R.add(glass);
    K.hotspot("glass", glass, [3.5, .2, 3.5], [2.6, 1.2], [3.4, 1.4]);
    const cliffChunk = K.rock(6, black, 18, 4, -24, R, 1, 1.3, 1, 91);

    // driftwood, seaweed, and loose stones scattered where Sean actually walks: the wide shots
    // toward the village and harbor already carry the scene, but the near ground was bare.
    const driftM = K.mat(0x4a3520, .85);
    for (const [x, z, rot, len] of [[-2.6, 1.6, .3, 2.1], [2.3, 2.7, -.5, 1.6], [-5.6, .5, 1.1, 1.8], [.4, -.6, .8, 1.3]]) {
      const log = K.cyl(.11, .15, len, driftM, x, .09, z, R, 8);
      log.rotation.set(0, rot, Math.PI / 2); log.castShadow = true;
    }
    const weedM = K.mat(0x2e4a2a, .75, { side: T.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const x = -6 + (i % 3) * 3.2 + Math.sin(i * 2.1) * .8, z = -.5 + Math.floor(i / 3) * 1.3 + Math.cos(i * 1.7) * .6;
      const wg = new T.Group(); wg.position.set(x, 0, z); wg.rotation.y = i * 1.3; R.add(wg);
      for (let b = 0; b < 3; b++) { const blade = new T.Mesh(new T.PlaneGeometry(.1, .4 + (b % 2) * .15), weedM); blade.position.y = .2; blade.rotation.y = b * 1.1; blade.rotation.x = -.3; wg.add(blade); }
    }
    for (let i = 0; i < 8; i++) K.rock(.18 + (i % 3) * .08, K.mat(0x8a8474, .9), -6.5 + i * 1.6, .02, 2 + (i % 2) * 1.4, R, 1, .55, 1, 200 + i);

    // people
    const sean = K.actor("sean", "sean", -4, 1.4, Math.PI / 2);
    sean.gear({ coat: true, sword: true });
    const deke = K.actor("deke", "deke", -.4, -1.9, -.4);
    const mercer = K.actor("mercer", "mercer", -5, -2.5, .6);
    const nia = K.actor("nia", "nia", -6.2, -3.2, .8);
    const troops = [0, 1, 2].map(i => K.actor("tr" + i, "trooper", -8 - i, -4 - i * .7, 1.2));
    const vill = [0, 1, 2, 3, 4, 5].map(i => K.actor("v" + i, PEOPLE.villager(i, i === 2 ? "child" : i === 4 ? "old" : ""), -10 - i * 1.3, -5 + (i % 2), 1.4));
    K.hotspot("deke", deke.root, [.8, 1.9, .8, 0, .95, 0], [-1.4, -1.0], [-.4, -1.9]);
    K.hotspot("mercer", mercer.root, [.8, 1.9, .8, 0, .95, 0], [-4.1, -1.8], [-5, -2.5]);
    // wounded carried toward the harbor
    const stretcher = new T.Group(); R.add(stretcher);
    K.box(.6, .06, 2, K.mat(0xd9cfbb, .9), 0, .8, 0, stretcher);
    K.sph(.2, K.mat(0x8a5a3a, .6), 0, .92, -.7, stretcher);
    K.box(.45, .2, 1.2, K.mat(0x5e8fb8, .9), 0, .92, .1, stretcher);
    K.hotspot("families", vill[0].root, [1, 1.8, 1, 0, .9, 0], null, null);

    let mode = "arrival";
    const stretch = { t: 0 };
    function villagersFlee(on) {
      vill.forEach((v, i) => {
        v.root.visible = on;
        if (!on) return;
        const loop = () => { if (!v.root.visible) return; v.place(-12 - i * 1.5, -5 + (i % 2) * .6, Math.PI / 2); v.follow([[-2, -5.5 + (i % 2)], [6, -7], [8.5, -8.5]], null, 2.2).then(() => setTimeout(loop, 200 + i * 300)); };
        setTimeout(loop, i * 900);
      });
    }

    const scarTex = K.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = "#c8966c"; c.fillRect(0, 0, w, h);
      const r = K.rng(4);
      c.strokeStyle = "#0b0608"; c.lineCap = "round";
      function branch(x, y, a, len, wd) { if (wd < .6 || len < 4) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); branch(x2, y2, a + (r() - .5) * .9, len * .8, wd * .75); if (r() < .45) branch(x2, y2, a + (r() < .5 ? -1 : 1) * (.5 + r() * .6), len * .6, wd * .6); }
      for (let i = 0; i < 6; i++) branch(r() * w, h, -Math.PI / 2 + (r() - .5) * .6, 30, 5);
    }, [1, 2]);
    const scarMat = K.mat(0xffffff, .55, { map: scarTex });

    return {
      cam: { pos: [0, 2.7, 8], look: [0, 1.3, -2], fov: 42 },
      follow(cp, cl, p) { cp.set(p.pos.x * .6, 2.7, 8); cl.set(p.pos.x * .55, 1.3, -2); },
      floor: { x0: -6, x1: 6.5, z0: -3.5, z1: 2.5 }, floorMesh, sea,
      bg: 0x06050a, fog: [0x0c0808, .012], exposure: 1.4,
      enter(S, opts) {
        mode = opts.mode || "arrival";
        const dawn = mode === "after" || mode === "sunrise";
        R.parent && (R.parent.background = new T.Color(dawn ? 0x4a3a44 : 0x06050a));
        hemi.intensity = dawn ? 1.3 : .8; hemi.color.setHex(dawn ? 0xa08a98 : 0x3a4a66);
        villageGlow.intensity = dawn ? 30 : 120;
        glass.visible = dawn;
        cliffChunk.visible = !dawn;
        stretcher.visible = mode === "arrival";
        evac.forEach(b => b.visible = mode === "defense");
        nia.root.visible = mode !== "after" && mode !== "sunrise";
        troops.forEach((t, i) => t.root.visible = mode === "arrival" || (mode === "defense" && i === 0));
        villagersFlee(mode === "arrival");
        mercer.root.visible = true;
        deke.gear({ rifle: mode === "defense" ? "hands" : "back" });
        mercer.gear({ pistol: mode !== "sunrise" });
        ships.forEach((s, i) => {
          const broken = dawn && i < 5;
          s.g.rotation.y = s.base; s.g.position.y = broken ? -1.4 : 0; s.g.rotation.z = broken ? (i % 2 ? .3 : -.25) : 0;
          s.g.visible = !(dawn && i >= 5);
        });
        mastPivot.rotation.z = dawn || mode === "defense" ? -1.35 : 0;
        sean.gear({ coat: true, sword: true, baby: mode === "defense", drawn: false });
        sean.pose("carry", mode === "defense"); sean.pose("lie", false); sean.pose("aim", false);
        deke.pose("kneel", false); deke.pose("carry", false); deke.gear({ baby: false });
        if (mode === "arrival") { sean.place(6.5, 1.8, -Math.PI / 2); deke.place(-.4, -1.9, -.4); mercer.place(-5, -2.5, .6); nia.place(-6.2, -3.2, .8); }
        if (mode === "defense") { sean.place(3.2, 1.2, Math.PI / 2); deke.place(4.2, .6, Math.PI / 2); mercer.place(2.2, .4, Math.PI / 2); nia.place(7, -6, 1); }
        if (mode === "after") {
          sean.place(3.4, 1.4, Math.PI / 2); sean.pose("lie", true);
          sean.armR.upper.material = sean.armR.fore.material = scarMat;
          deke.place(2.7, 1.2, Math.PI / 2 + .6); deke.pose("kneel", true);
          mercer.place(-3, -2, .5); mercer.root.visible = false;
        }
        if (mode === "sunrise") { sean.place(1.5, .8, .2); sean.armR.upper.material = sean.armR.fore.material = scarMat; sean.gear({ baby: true }); sean.pose("carry", true); deke.place(2.6, .2, -.8); mercer.place(4.6, -.5, -.4); }
        stretch.t = 0;
      },
      update(dt, t) {
        for (const s of ships) {
          s.next -= dt;
          if (mode !== "after" && mode !== "sunrise" && s.next <= 0) { s.f.intensity = 70; s.next = 1.4 + Math.random() * 3; }
          s.f.intensity *= Math.pow(.02, dt);
        }
        if (stretcher.visible) {
          stretch.t += dt;
          const k = (stretch.t * .12) % 1;
          stretcher.position.set(-10 + k * 18, 0, -4.4 + k * -2);
          stretcher.rotation.y = Math.PI / 2 - .1;
        }
        evac.forEach((b, i) => { if (b.visible) { b.position.x += dt * .6; b.position.y = Math.sin(t + i) * .1; if (b.position.x > 34) b.position.x = 12; } });
      },
      events: {
        mastCollapse() {
          return new Promise(res => {
            let k = 0;
            const id = setInterval(() => { k += .05; mastPivot.rotation.z = -1.35 * Math.min(1, k * k); if (k >= 1) { clearInterval(id); WORLD.shake(.5, .12); res(); } }, 30);
          });
        },
        gunsTurn() {
          ships.forEach(s => s.g.rotation.y = s.base - .5);
          return Promise.resolve();
        },
        // The black arc. Sean's arm blackens, the blade goes black with purple light through fractures,
        // and one uncontrolled swing tears across the harbor. Then the wave.
        async arc() {
          sean.gear({ drawn: true, baby: false }); sean.pose("carry", false);
          sean.armR.upper.material = sean.armR.fore.material = scarMat;
          sean.bladeMat.color.setHex(0x050507); sean.bladeMat.emissive.setHex(0x6a2aff); sean.bladeMat.emissiveIntensity = 0;
          const aura = new T.PointLight(0x8a4aff, 0, 8, 1.5); sean.armR.hand.add(aura);
          for (let i = 0; i <= 20; i++) { sean.bladeMat.emissiveIntensity = i / 20 * 1.6 * (.8 + Math.random() * .4); aura.intensity = i * 1.5; await new Promise(r => setTimeout(r, 60)); }
          sean.pose("raise", true);
          WORLD.shake(1.5, .2);
          await new Promise(r => setTimeout(r, 700));
          const arcM = new T.Mesh(new T.TorusGeometry(10, .5, 8, 60, Math.PI * .75), new T.MeshBasicMaterial({ color: 0x050308 }));
          const edge = new T.Mesh(new T.TorusGeometry(10.6, .12, 6, 60, Math.PI * .75), new T.MeshBasicMaterial({ color: 0xa070ff }));
          const arcG = new T.Group(); arcG.add(arcM, edge); arcG.position.set(sean.pos.x + 1, 1.6, sean.pos.z); arcG.rotation.set(Math.PI / 2, 0, -Math.PI * .4); R.add(arcG);
          sean.pose("raise", false);
          WORLD.flash("#b08aff", 300, .6);
          for (let i = 0; i <= 24; i++) {
            const k = i / 24;
            arcG.scale.setScalar(.2 + k * 5); arcG.position.x = sean.pos.x + 1 + k * 30;
            await new Promise(r => setTimeout(r, 30));
          }
          ships.forEach((s, i) => { if (i < 5) { s.g.rotation.z = (i % 2 ? .35 : -.3); s.g.position.y = -.8; } });
          cliffChunk.position.y = -6;
          R.remove(arcG);
          WORLD.shake(2.5, .5);
          // the wave
          const wave = new T.Mesh(new T.BoxGeometry(80, 1, 6), K.mat(0x1c3a4a, .2, { transparent: true, opacity: .9 }));
          wave.position.set(20, -2, 4); R.add(wave);
          for (let i = 0; i <= 30; i++) { const k = i / 30; wave.scale.y = 1 + k * 14; wave.position.y = -2 + k * 6; wave.position.z = 4 - k * 2; await new Promise(r => setTimeout(r, 35)); }
          await WORLD.fade(1, 500, "#000");
          R.remove(wave);
          sean.gear({ drawn: false });
          sean.armR.hand.remove(aura);
        }
      }
    };
  };

  // ===================================================================
  // 4. The village street up to the shrine (Chapters Four and Six)
  // ===================================================================
  SETS.village = function (K) {
    const R = K.root;
    const floorMesh = new T.Mesh(new T.PlaneGeometry(8, 30), K.mat(0xffffff, .9, { map: K.stoneTex(5, [70, 64, 58], [2, 7]) }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(0, 0, -5); floorMesh.receiveShadow = true; R.add(floorMesh);
    R.add(new T.HemisphereLight(0x3a4a66, 0x2a120a, .75));
    const key = new T.DirectionalLight(0xffc49a, .8); key.position.set(2, 8, 12); R.add(key);
    const cols = [0xd1674a, 0xe8c15a, 0x5e8fb8, 0x8ab06a, 0xe39a6b, 0xb07ab0, 0x6fb0a4];
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) {
        const z = 2 - i * 3.4;
        const h = house(K, s * 4.2, z, cols[(i * 2 + (s > 0 ? 1 : 0)) % cols.length], { rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, face: 1, lit: (i + s) % 3 === 0, scorched: (i + s) % 2 === 0 });
        h.traverse(o => { if (o.isMesh && o.material.color && !o.material.emissive?.getHex()) {} });
      }
    }
    const fireSpots = [[-4, 3.4, -1.4, 1.2, true], [4, 3.4, -8.2, 1.4, true], [-4, 3.4, -11.6, 1.1, false], [4, 3.4, 2, 1, false]];
    fireSpots.forEach(([x, y, z, s, l]) => K.add(K.fire(x, y, z, s, l)));
    for (const [x, z] of [[-4, -2], [4, -8], [0, -12]]) K.add(K.smoke(x, 4, z, { count: 10, size: 2.5, rise: 12, life: 7, opacity: .55, color: 0x1a1210, drift: 1 }));
    K.add(K.particles({ count: 120, size: .07, color: 0xffb25a, end: 0x8a2a0a, life: [3, 6], flicker: true, at: r => [(r() - .5) * 8, 3 + r() * 3, -14 + r() * 18], vel: r => [(r() - .5), .6 + r(), (r() - .5)], wobble: .5 }));

    // the doll, left under a broken porch rail
    const doll = new T.Group(); doll.position.set(-2.4, .05, -3.2); doll.rotation.set(-1.3, .4, 0); R.add(doll);
    K.cyl(.02, .07, .16, K.mat(0x4a4234, .95), 0, 0, 0, doll, 10);
    K.sph(.045, K.mat(0x7a6a58, .9), 0, .11, 0, doll);
    K.sph(.009, K.mat(0x6b4524, .4), -.015, .12, .04, doll);
    K.box(.5, .06, .06, K.mat(0x3a2616, .9), .3, .2, -.2, doll).rotation.z = .5;
    K.hotspot("doll", doll, [.5, .4, .5], [-1.7, -2.8], [-2.4, -3.2]);

    // the shrine at the top: collapsed, with a jagged hole where the altar stood
    const shrine = new T.Group(); shrine.position.set(0, 0, -16); R.add(shrine);
    const stone = K.mat(0xd8d0c0, .9);
    K.box(6, .4, 4, stone, 0, .2, 0, shrine);
    for (const x of [-2.6, 2.6]) K.box(.5, 2.8, .5, stone, x, 1.6, 1.6, shrine);
    K.box(3, .5, .6, stone, -1.2, 3.1, 1.6, shrine).rotation.z = -.4;
    for (let i = 0; i < 8; i++) K.rock(.4 + (i % 3) * .2, K.mat(0xbab2a2, .9), -1.8 + i * .5, .5, -.6 + (i % 2) * 1.4, shrine, 1, .6, 1, 70 + i);
    const hole = new T.Mesh(new T.CircleGeometry(1.1, 20), new T.MeshBasicMaterial({ color: 0x000000 }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(0, .41, 0); shrine.add(hole);
    K.add(K.particles({ count: 40, size: .25, color: 0x6a8aa8, life: [2, 4], normal: true, opacity: .25, at: r => [(r() - .5) * 1.4, .4, -16 + (r() - .5) * 1.4], vel: r => [(r() - .5) * .2, .6, (r() - .5) * .2] }));
    K.hotspot("hole", shrine, [2.6, 1, 2.6, 0, .5, 0], [0, -13.6], [0, -16]);

    // the awning and a rooftop (Chapter Six)
    const awning = new T.Group(); awning.position.set(3.2, 2.5, -7.4); R.add(awning);
    const canvas = new T.Mesh(new T.PlaneGeometry(1.8, 1.2), K.mat(0xb89a5a, .9, { side: T.DoubleSide }));
    canvas.rotation.x = -Math.PI / 2 + .35; canvas.position.set(-.8, 0, 0); canvas.castShadow = true; awning.add(canvas);
    K.cyl(.01, .01, 1.4, K.mat(0x8a7050, .9), -1.6, -.2, 0, awning, 6).rotation.z = .3;
    K.hotspot("awning", awning, [2, 1.4, 1.6, -.8, 0, 0], [1.4, -5.2], [3, -7.4]);

    const sean = K.actor("sean", "sean", 0, 3, Math.PI);
    sean.gear({ coat: true, sword: true });
    const deke = K.actor("deke", "deke", .8, 2.4, Math.PI);
    K.hotspot("deke", deke.root, [.8, 1.9, .8, 0, .95, 0], null, null);
    const fams = [0, 1, 2, 3, 4, 5, 6].map(i => K.actor("f" + i, PEOPLE.villager(i + 3, i % 3 === 1 ? "child" : i === 5 ? "old" : ""), (i % 3 - 1) * 1.4, -14, 0));
    const soldiers = [0, 1, 2, 3, 4].map(i => K.actor("s" + i, "soldier", (i - 2) * 1, -12.5 - (i % 2), 0));
    const troops = [0, 1, 2, 3, 4, 5].map(i => K.actor("t" + i, i === 0 ? "mercer" : i === 1 ? "nia" : "trooper", (i - 2.5) * .8, -1, Math.PI));
    const roofSoldier = K.actor("roof", "soldier", 3.4, -9.6, -Math.PI / 2);
    roofSoldier.root.position.y = 2.9;
    K.hotspot("roof", roofSoldier.root, [1, 2, 1, 0, 1, 0], null, null);
    K.hotspot("bayonet", soldiers[2].root, [1, 2, 1, 0, 1, 0], null, null);

    let mode = "run";
    function flee(on) {
      fams.forEach((f, i) => {
        f.root.visible = on;
        if (!on) return;
        const loop = () => { if (!f.root.visible) return; f.place((i % 3 - 1) * 1.3, -14, 0); f.follow([[(i % 3 - 1) * 1.2, 4], [(i % 3 - 1) * 1.2, 9]], null, 2.4).then(() => setTimeout(loop, 300 + i * 200)); };
        setTimeout(loop, i * 700);
      });
    }
    return {
      cam: { pos: [0, 3.4, 9], look: [0, 1.6, -4], fov: 44 },
      follow(cp, cl, p) { cp.set(p.pos.x * .5, 3.2, p.pos.z + 6.5); cl.set(p.pos.x * .3, 1.6, p.pos.z - 4.5); },
      floor: { x0: -2.2, x1: 2.2, z0: -14, z1: 4 }, floorMesh,
      bg: 0x0a0608, fog: [0x140a08, .03], exposure: 1.4,
      // Deke trails right behind Sean up the narrow street; when a tap is close to both him
      // and the shrine hole, the hole should win rather than swallowing the tap.
      pickPriority: { hole: 3, deke: 1 },
      enter(S, opts) {
        mode = opts.mode || "run";
        flee(mode === "run");
        const street = mode === "street";
        soldiers.forEach((s, i) => { s.root.visible = street; s.place((i - 2) * 1, -12.5 - (i % 2), 0); s.gear({ rifle: "hands" }); s.pose("aim", false); });
        troops.forEach((t, i) => { t.root.visible = street; t.place((i - 2.5) * .8, -1.5 - (i % 2) * .5, Math.PI); t.gear({ rifle: i === 0 ? "none" : "hands", pistol: i === 0 }); });
        roofSoldier.root.visible = street; roofSoldier.root.position.y = 2.9; roofSoldier.root.rotation.z = 0;
        awning.rotation.set(0, 0, 0); awning.position.y = 2.5;
        sean.gear({ coat: true, sword: true, baby: street, drawn: street });
        sean.pose("carry", street);
        deke.gear({ rifle: street ? "hands" : "back" });
        if (street) { sean.place(-.8, -3, Math.PI); deke.place(.9, -3.2, Math.PI); }
        else { sean.place(0, 3, Math.PI); deke.place(.9, 2.2, Math.PI); }
      },
      update(dt, t) {
        if (mode === "run") {
          const p = sean.pos;
          // Trail behind and slightly right, but never past the shrine's hole: otherwise he
          // crowds the target hotspot at the top of the street and blocks tapping it.
          const tz = Math.max(p.z + .6, -11.5);
          if (!deke.path.length) { const d = Math.hypot(deke.pos.x - p.x - .6, deke.pos.z - tz); if (d > 1.4) deke.walkTo(p.x + .6, tz, null, 1.4); else deke.look(p.x, p.z - 4); }
        }
      },
      events: {
        advance() { soldiers.forEach((s, i) => { s.pose("aim", true); s.walkTo((i - 2) * 1, -9.5 - (i % 2), null, .5); }); return Promise.resolve(); },
        roofDrop() {
          return new Promise(res => {
            let k = 0;
            const id = setInterval(() => { k += .05; roofSoldier.root.position.y = 2.9 + Math.sin(k * 3) * .3 - k * k * 3; roofSoldier.root.rotation.z = k * 1.2; roofSoldier.root.position.x = 3.4 + k * 1.2; if (k >= 1) { clearInterval(id); roofSoldier.root.visible = false; res(); } }, 30);
          });
        },
        awningDrop() {
          return new Promise(res => {
            let k = 0;
            const id = setInterval(() => { k += .06; awning.position.y = 2.5 - k * k * 2.2; awning.rotation.z = -k * .8; if (k >= 1) { clearInterval(id); soldiers.slice(3).forEach(s => { s.pose("kneel", true); }); WORLD.shake(.4, .08); res(); } }, 30);
          });
        },
        block() { WORLD.flash("#ffe6b0", 180, .35); WORLD.shake(.3, .06); sean.pose("raise", true); setTimeout(() => sean.pose("raise", false), 400); return new Promise(r => setTimeout(r, 450)); },
        fallBack() {
          troops.forEach((t, i) => t.walkTo((i - 2.5) * .8, 3 + i * .3, null, 1.6));
          soldiers.forEach((s, i) => s.walkTo((i - 2) * 1, -5.5, null, .7));
          return Promise.resolve();
        }
      }
    };
  };

  // ===================================================================
  // 5. The tunnels under the shrine (Chapter Four)
  // ===================================================================
  SETS.tunnel = function (K) {
    const R = K.root;
    const floorMesh = new T.Mesh(new T.PlaneGeometry(3.2, 20), K.mat(0xffffff, .9, { map: K.stoneTex(8, [52, 48, 46], [1, 6]) }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(0, 0, -5); floorMesh.receiveShadow = true; R.add(floorMesh);
    const wallTex = K.stoneTex(9, [58, 54, 50], [4, 1]);
    for (const s of [-1, 1]) { const w = new T.Mesh(new T.PlaneGeometry(20, 3.4), K.mat(0xffffff, .95, { map: wallTex })); w.position.set(s * 1.6, 1.7, -5); w.rotation.y = -s * Math.PI / 2; w.receiveShadow = true; R.add(w); }
    const ceil = new T.Mesh(new T.PlaneGeometry(3.2, 20), K.mat(0x1a1716, 1)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.4, -5); R.add(ceil);
    // carvings worn smooth, older than the village
    const carve = K.glyphTex(12, "#3a3632", "rgba(20,16,14,.45)", false);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const p = new T.Mesh(new T.PlaneGeometry(1.3, 1.9), K.mat(0xffffff, .9, { map: carve })); p.position.set(s * 1.58, 1.6, 1 - i * 3); p.rotation.y = -s * Math.PI / 2; R.add(p); }
    // three archways at the intersection
    const arches = {};
    const stone = K.mat(0x4a4540, .9);
    for (const [id, x, rot] of [["left", -1.5, Math.PI / 2], ["ahead", 0, 0], ["right", 1.5, -Math.PI / 2]]) {
      const g = new T.Group(); g.position.set(x, 0, id === "ahead" ? -14.6 : -12.5); g.rotation.y = rot; R.add(g);
      K.box(.3, 2.4, .3, stone, -.7, 1.2, 0, g); K.box(.3, 2.4, .3, stone, .7, 1.2, 0, g);
      const a = new T.Mesh(new T.TorusGeometry(.7, .15, 8, 16, Math.PI), stone); a.position.y = 2.4; g.add(a);
      const dark = new T.Mesh(new T.PlaneGeometry(1.2, 3), new T.MeshBasicMaterial({ color: 0x000000 })); dark.position.set(0, 1.4, -.05); g.add(dark);
      arches[id] = g;
      K.hotspot(id, g, [1.6, 3, .6, 0, 1.4, 0], null, null);
    }
    R.add(new T.HemisphereLight(0x4a5870, 0x1a1410, .55));
    const cold = new T.PointLight(0x8aa8d8, 5, 12, 1.6); cold.position.set(0, 2.6, -12); R.add(cold);
    const warm = new T.PointLight(0xff8a4a, 10, 12, 1.4); warm.position.set(0, 2.8, 5); R.add(warm);
    K.add(K.particles({ count: 60, size: .02, color: 0xbcd0e8, life: [4, 8], at: r => [(r() - .5) * 3, r() * 3, -12 + r() * 14], vel: r => [(r() - .5) * .05, .03, .1], opacity: .6 }));
    const sean = K.actor("sean", "sean", 0, 3, Math.PI);
    sean.gear({ coat: true, sword: true });
    const deke = K.actor("deke", "deke", .8, 2.4, Math.PI);
    K.hotspot("deke", deke.root, [.8, 1.9, .8, 0, .95, 0], null, null);
    let t0 = 0;
    return {
      cam: { pos: [0, 2.4, 7], look: [0, 1.4, -6], fov: 50 },
      follow(cp, cl, p) { cp.set(p.pos.x * .3, 2.3, p.pos.z + 4.5); cl.set(0, 1.4, p.pos.z - 5); },
      floor: { x0: -1.2, x1: 1.2, z0: -11, z1: 3.5 }, floorMesh,
      bg: 0x020203, fog: [0x050506, .08], exposure: 1.5,
      enter() { sean.place(0, 3, Math.PI); deke.place(.8, 2.4, Math.PI); },
      update(dt, t) {
        t0 += dt;
        const p = sean.pos;
        if (!deke.path.length) { const d = Math.hypot(deke.pos.x - p.x - .7, deke.pos.z - p.z - .8); if (d > 1.4) deke.walkTo(p.x + .7, p.z + .8, null, 1.4); }
        warm.intensity = 10 + Math.sin(t * 7) * 1.5;
      },
      events: {
        listen() { deke.walkTo(0, -10, [0, -14]); return new Promise(r => setTimeout(r, 1600)); }
      }
    };
  };

  // ===================================================================
  // 6. The chamber of the Record-Stone (Chapters Four and Five)
  // ===================================================================
  SETS.chamber = function (K) {
    const R = K.root;
    const floorMesh = new T.Mesh(new T.CircleGeometry(6, 40), K.mat(0xffffff, .9, { map: K.stoneTex(15, [48, 46, 46], [3, 3]) }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true; R.add(floorMesh);
    const wall = new T.Mesh(new T.CylinderGeometry(6, 6, 6, 40, 1, true), K.mat(0xffffff, .95, { map: K.stoneTex(16, [52, 50, 50], [6, 1]), side: T.BackSide }));
    wall.position.y = 3; wall.receiveShadow = true; R.add(wall);
    const dome = new T.Mesh(new T.SphereGeometry(6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), K.mat(0x15131a, 1, { side: T.BackSide })); dome.position.y = 6; R.add(dome);

    // the Record-Stone: blue-black, half buried, taller than either man, covered in precise characters
    const stoneG = new T.Group(); stoneG.position.set(0, 0, -1.4); stoneG.rotation.y = .12; R.add(stoneG);
    const glyphs = K.glyphTex(33, "#0d1119", "rgba(120,150,200,.55)", true);
    const recMat = K.mat(0xffffff, .35, { map: glyphs, metalness: .35, emissive: 0x0a1020, emissiveIntensity: .6 });
    const rec = new T.Mesh(new T.BoxGeometry(1.5, 3.4, .9), [K.mat(0x0d1119, .35, { metalness: .35 }), K.mat(0x0d1119, .35, { metalness: .35 }), K.mat(0x0d1119, .4), K.mat(0x0d1119, .4), recMat, recMat]);
    rec.position.y = 1.2; rec.rotation.z = .04; rec.castShadow = rec.receiveShadow = true; stoneG.add(rec);
    for (let i = 0; i < 10; i++) K.rock(.4 + (i % 3) * .2, K.mat(0x2a2624, .9), Math.cos(i) * 1.1, 0, Math.sin(i) * .7, stoneG, 1, .5, 1, 90 + i);
    K.hotspot("stone", stoneG, [1.8, 3.4, 1.2, 0, 1.4, 0], [-.6, .6], [0, -1.4]);

    // brass instruments round the base; one has a needle
    const brass = K.mat(0xb58d4a, .35, { metalness: .6 });
    const inst = new T.Group(); R.add(inst);
    const gauges = [];
    for (let i = 0; i < 5; i++) {
      const a = -2.2 + i * .9, x = Math.sin(a) * 1.6, z = -1.4 + Math.cos(a) * 1.1;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = a; inst.add(g);
      K.box(.4, .6, .3, brass, 0, .3, 0, g);
      const dial = new T.Mesh(new T.CircleGeometry(.12, 20), K.mat(0xe8dfc6, .6)); dial.position.set(0, .45, .16); g.add(dial);
      const needle = K.box(.008, .1, .005, K.mat(0x1a1a1a, .5), 0, .45 + .04, .17, g);
      gauges.push({ g, needle, dial });
    }
    K.hotspot("instruments", inst, null, [.6, .6], [1.1, -.6]);
    // rotted cables running to broken glass cylinders on the wall
    const cyls = new T.Group(); R.add(cyls);
    const glassM = K.mat(0x9ab8c8, .05, { transparent: true, opacity: .22, side: T.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const a = -1.9 + i * .75, x = Math.sin(a) * 5.4, z = Math.cos(a) * -5.4;
      const c = new T.Mesh(new T.CylinderGeometry(.4, .4, 1.6 + (i % 3) * .5, 18, 1, true), glassM); c.position.set(x, .9, z); cyls.add(c);
      K.cyl(.45, .45, .15, brass, x, .05, z, cyls);
      const curve = new T.CatmullRomCurve3([new T.Vector3(Math.sin(-2.2 + (i % 5) * .9) * 1.6, .3, -1.4 + Math.cos(-2.2 + (i % 5) * .9) * 1.1), new T.Vector3(x * .5, .05, z * .5 - .5), new T.Vector3(x, .3, z)]);
      const tube = new T.Mesh(new T.TubeGeometry(curve, 20, .03, 6), K.mat(0x1a1612, .9)); tube.castShadow = true; cyls.add(tube);
    }
    K.hotspot("cylinders", cyls, null, [2.2, .6], [3.6, -3]);

    // the cradle of glass and brass, and the green fluid
    const cradle = new T.Group(); cradle.position.set(1.9, 0, -3.1); cradle.rotation.y = -.5; R.add(cradle);
    K.box(1.3, .5, .7, brass, 0, .25, 0, cradle);
    const pod = new T.Mesh(new T.CapsuleGeometry(.3, .7, 8, 16), K.mat(0xbfe0d0, .05, { transparent: true, opacity: .3 })); pod.rotation.z = Math.PI / 2; pod.position.y = .78; cradle.add(pod);
    const lid = new T.Group(); lid.position.set(0, .78, -.3); cradle.add(lid);
    const lidM = new T.Mesh(new T.CapsuleGeometry(.31, .7, 8, 16, 1), K.mat(0xbfe0d0, .05, { transparent: true, opacity: .32 })); lidM.rotation.z = Math.PI / 2; lidM.position.z = .3; lidM.scale.set(1, 1, .5); lid.add(lidM);
    const gel = new T.Mesh(new T.CircleGeometry(1.4, 24), new T.MeshStandardMaterial({ color: 0x1f8a4a, emissive: 0x2ac06a, emissiveIntensity: .8, roughness: .05, transparent: true, opacity: .8 }));
    gel.rotation.x = -Math.PI / 2; gel.position.set(1.7, .01, -2.6); gel.scale.set(1, .6, 1); R.add(gel);
    const green = new T.PointLight(0x3aff8a, 6, 5, 1.5); green.position.set(1.9, .9, -3.1); R.add(green);
    const wheel = new T.Mesh(new T.TorusGeometry(.14, .02, 6, 16), K.mat(0x6b7078, .4, { metalness: .7 })); wheel.position.set(.68, .6, 0); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = .5; cradle.add(wheel);
    for (let i = 0; i < 4; i++) { const sp = K.box(.01, .28, .01, K.mat(0x6b7078, .4), .68, .6, 0, cradle); sp.rotation.x = i * Math.PI / 4; }
    const inside = new T.Group(); inside.position.set(0, .72, 0); cradle.add(inside);
    K.sph(.14, K.mat(0xe8e2d6, .8), 0, 0, 0, inside, 1.8, .8, 1);
    K.sph(.07, K.mat(0x8a5a3a, .5), -.28, .04, 0, inside);
    K.sph(.075, K.mat(0x4c9a6a, .15, { transparent: true, opacity: .4 }), -.28, .045, 0, inside);
    const hand = K.sph(.025, K.mat(0x8a5a3a, .5), -.15, .12, 0, inside);
    K.hotspot("cradle", cradle, [1.4, 1.2, .9, 0, .6, 0], [.9, -1.8], [1.9, -3.1]);

    R.add(new T.HemisphereLight(0x5a6a88, 0x1a1a1a, 1.1));
    const shaft = new T.SpotLight(0x9ab8e8, 30, 16, .5, .6, 1.2); shaft.position.set(-1, 7, 1); shaft.target.position.set(0, 0, -1.4); R.add(shaft); R.add(shaft.target); shaft.castShadow = true;
    const key = new T.DirectionalLight(0xffd8b0, 1.5); key.position.set(0, 4, 10); R.add(key);
    K.add(K.particles({ count: 80, size: .02, color: 0xcfe0f0, life: [5, 9], at: r => [(r() - .5) * 6, r() * 4, -3 + r() * 5], vel: r => [(r() - .5) * .04, -.03, (r() - .5) * .04], opacity: .6 }));

    const sean = K.actor("sean", "sean", -.8, 3.2, Math.PI);
    sean.gear({ coat: true, sword: true });
    // Off to the left, clear of the line from camera to the cradle/wheel (both sit to the right,
    // around x=.9 to 1.9): standing at x=.8 put him almost exactly on that sightline and ate taps.
    const deke = K.actor("deke", "deke", -1.4, 2.6, Math.PI);
    K.hotspot("deke", deke.root, [.8, 1.9, .8, 0, .95, 0], null, null);
    let tapT = -1, needleSpin = 0;
    return {
      cam: { pos: [0, 2.5, 6.2], look: [.3, 1.3, -1.8], fov: 46 },
      follow(cp, cl, p) { cp.set(p.pos.x * .4, 2.5, 6.2); cl.set(.3 + p.pos.x * .3, 1.3, -1.8); },
      floor: { x0: -3.4, x1: 3.2, z0: -1.9, z1: 3.6 }, floorMesh,
      bg: 0x020203, fog: [0x040506, .05], exposure: 1.5,
      pickPriority: { stone: 1, instruments: 2, cradle: 3, deke: 0 },
      enter(S, opts) {
        const f = (S && S.flags) || {};
        sean.place(-.8, 3.2, Math.PI); deke.place(-1.4, 2.6, Math.PI);
        lid.rotation.x = f.cradleOpen ? -1.6 : 0;
        inside.visible = !f.babyTaken;
        sean.gear({ baby: !!f.babyTaken }); sean.pose("carry", !!f.babyTaken);
        deke.gear({ rifle: "hands" });
        gauges.forEach(g => { g.needle.visible = true; g.needle.rotation.z = 0; });
      },
      refresh(S) {
        const f = (S && S.flags) || {};
        lid.rotation.x = f.cradleOpen ? -1.6 : 0;
        inside.visible = !f.babyTaken;
        sean.gear({ baby: !!f.babyTaken }); sean.pose("carry", !!f.babyTaken);
      },
      update(dt, t) {
        green.intensity = 6 + Math.sin(t * 2) * 1.2;
        if (tapT >= 0) { tapT += dt; hand.position.x = -.15 + Math.max(0, Math.sin(tapT * 12)) * .05; if (tapT > 1.5) tapT = -1; }
        if (needleSpin > 0) { needleSpin -= dt; gauges[4].needle.rotation.z -= dt * 30; if (needleSpin <= 0) { gauges[4].needle.rotation.z = -1.4; gauges[4].needle.position.y -= .06; } }
        gauges.forEach((g, i) => { if (i !== 4 || needleSpin <= 0 && g.needle.rotation.z === 0) g.needle.rotation.z = Math.sin(t * .3 + i) * .02; });
      },
      events: {
        tap() { tapT = 0; return new Promise(r => setTimeout(r, 900)); },
        cough() { WORLD.shake(.2, .02); return Promise.resolve(); },
        openLid() { return new Promise(res => { let k = 0; const id = setInterval(() => { k += .06; lid.rotation.x = -1.6 * Math.min(1, k); if (k >= 1) { clearInterval(id); res(); } }, 30); }); },
        needle() { needleSpin = .8; WORLD.shake(.8, .08); return new Promise(r => setTimeout(r, 1000)); },
        rumble() { WORLD.shake(1, .12); return Promise.resolve(); }
      }
    };
  };

  // ===================================================================
  // 7. The fishing boat, three days later (Chapter Nine)
  // ===================================================================
  SETS.boat = function (K) {
    const R = K.root;
    const sea = K.makeSea(400, 0x2c5a72, .7); sea.position.y = -.3; R.add(sea);
    R.add(new T.HemisphereLight(0xcfe0f0, 0x3a4a3a, 1.1));
    const sun = new T.DirectionalLight(0xffe6c0, 2.2); sun.position.set(-10, 14, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); R.add(sun);
    const boat = new T.Group(); R.add(boat);
    const wood = K.mat(0x7a5634, .8, { side: T.DoubleSide });
    const hull = new T.Mesh(new T.CylinderGeometry(1, 1, 5, 20, 1, true, Math.PI, Math.PI), wood); hull.rotation.z = Math.PI / 2; hull.scale.set(.7, 1, 1); hull.position.y = .3; hull.castShadow = hull.receiveShadow = true; boat.add(hull);
    const deck = planks(K, 1.3, 4.6, 61, [110, 80, 52]); deck.rotation.x = -Math.PI / 2; deck.rotation.z = Math.PI / 2; deck.position.y = .02; boat.add(deck);
    K.box(1.3, .08, .35, wood, 0, .5, -1.5, boat);
    K.box(1.3, .08, .35, wood, 0, .5, 1.6, boat);
    K.cyl(.06, .08, 3.4, K.mat(0x5a3a20, .8), 0, 1.9, -.6, boat, 8);
    const sail = new T.Mesh(new T.PlaneGeometry(1.6, 2.2), K.mat(0xd8c8a4, .95, { side: T.DoubleSide })); sail.position.set(.1, 2.2, -.55); sail.rotation.y = .5; boat.add(sail);
    // Nightforge, wrapped in canvas under the forward bench
    const bundle = K.box(.14, .1, 1.1, K.mat(0xb8a47a, .95), .25, .3, -1.5, boat);
    bundle.rotation.y = 1.4;
    K.hotspot("bundle", bundle, [.4, .4, 1.3], null, null);
    // Olive's basket and the fisherman's coat
    const basket = new T.Group(); basket.position.set(-.3, .1, .6); boat.add(basket);
    K.cyl(.28, .22, .25, K.mat(0xa8844a, .9), 0, .12, 0, basket, 16, true);
    K.sph(.2, K.mat(0x5a4a3a, .9), 0, .2, 0, basket, 1.2, .5, .9);
    K.sph(.06, K.mat(0x8a5a3a, .5), -.12, .27, 0, basket);
    const foot = K.sph(.03, K.mat(0x8a5a3a, .5), .15, .27, .1, basket);
    K.hotspot("olive", basket, [.7, .5, .7, 0, .2, 0], null, null);
    // the newspaper the gull brings
    const paper = new T.Group(); paper.position.set(.35, .55, .9); paper.visible = false; boat.add(paper);
    K.box(.38, .02, .28, K.mat(0xe6ddc8, .9), 0, 0, 0, paper);
    K.hotspot("paper", paper, [.5, .2, .4], null, null);
    const gull = new T.Group(); R.add(gull);
    const gm = K.mat(0xf2f0ea, .8);
    K.sph(.12, gm, 0, 0, 0, gull, 1.6, .8, .9);
    const wingL = K.box(.7, .02, .2, gm, -.4, .02, 0, gull), wingR = K.box(.7, .02, .2, gm, .4, .02, 0, gull);
    K.box(.12, .1, .15, K.mat(0x4a3a2a, .8), 0, -.12, 0, gull);
    K.hotspot("gull", gull, [1.4, .5, .5], null, null);
    const sky = [];
    for (let i = 0; i < 10; i++) { const g = new T.Group(); K.sph(.1, gm, 0, 0, 0, g, 1.6, .8, .9); const a = K.box(.6, .02, .18, gm, 0, 0, 0, g); g.userData = { a, r: 5 + i * 1.3, h: 5 + (i % 4) * 1.4, s: .2 + (i % 3) * .08, p: i }; R.add(g); sky.push(g); }
    const sean = K.actor("sean", "sean", .35, -.1, -.3, boat);
    sean.gear({ coat: true, sword: false }); sean.pose("sit", true);
    let gullT = -1;
    return {
      cam: { pos: [3.2, 2.1, 3.6], look: [0, .8, .2], fov: 42 },
      floor: null, sea, bg: 0x9ab4c4, fog: [0xa8bccc, .012], exposure: 1.0,
      enter() { paper.visible = false; gull.visible = false; gullT = -1; sean.gear({ coat: true, sword: false }); sean.pose("sit", true); },
      update(dt, t) {
        boat.rotation.z = Math.sin(t * .8) * .05; boat.rotation.x = Math.sin(t * .6) * .03; boat.position.y = Math.sin(t * 1.1) * .08;
        foot.position.y = .27 + Math.max(0, Math.sin(t * 1.3)) * .05;
        sean.armR.sh.rotation.z = -.09 + Math.sin(t * 22) * .01;
        for (const g of sky) { const d = g.userData, a = t * d.s + d.p; g.position.set(Math.cos(a) * d.r, d.h + Math.sin(t + d.p) * .3, Math.sin(a) * d.r - 4); g.rotation.y = -a; d.a.rotation.z = Math.sin(t * 8 + d.p) * .5; }
        if (gullT >= 0) {
          gullT += dt;
          const k = Math.min(1, gullT / 2.4);
          gull.position.set(4 - k * 3.6, 3.5 - k * 2.9, -2 + k * 3);
          wingL.rotation.z = Math.sin(t * 14) * .8 * (1 - k * .9); wingR.rotation.z = -wingL.rotation.z;
          if (k >= 1 && !paper.visible) { paper.visible = true; }
        }
      },
      events: {
        // Resolves when the gull has landed and the paper is on the boat, however slow the device.
        gull() { gull.visible = true; gullT = 0; return new Promise(r => { const id = setInterval(() => { if (paper.visible) { clearInterval(id); r(); } }, 100); }); }
      }
    };
  };

  window.SETS = SETS;
})();
