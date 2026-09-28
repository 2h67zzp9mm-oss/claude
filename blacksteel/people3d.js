/* The Blacksteel Pirates: 3D people.
 *
 * One jointed body (hips, knees, ankles, spine, neck, shoulders, elbows) that every
 * character shares, dressed by a LOOK: skin, hair, beard, glasses or goggles, coat,
 * sash, and props (saber, rifle, pistol, arm sling, the baby).
 *
 * Actors walk with a cycle matched to distance (feet plant), turn toward where they are
 * going, and blend into poses: carry (the baby in the left arm), aim (a rifle),
 * raise (a sword overhead), reach, point, kneel, lie (on the sand).
 */
(function () {
  "use strict";
  const T = window.THREE;
  if (!T) return;

  const matCache = {};
  function mat(color, rough = .8, extra) {
    const k = color + ":" + rough + ":" + (extra ? JSON.stringify(extra) : "");
    if (!matCache[k]) matCache[k] = new T.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra || {}));
    return matCache[k];
  }
  function mesh(geo, m, x, y, z, parent) {
    const o = new T.Mesh(geo, m);
    o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true; o.receiveShadow = true;
    if (parent) parent.add(o);
    return o;
  }
  const capsule = (r, len, m, parent, y) => mesh(new T.CapsuleGeometry(r, len, 6, 12), m, 0, y, 0, parent);
  const sphere = (r, m, x, y, z, parent, sx = 1, sy = 1, sz = 1) => { const o = mesh(new T.SphereGeometry(r, 18, 12), m, x, y, z, parent); o.scale.set(sx, sy, sz); return o; };
  const boxm = (w, h, d, m, x, y, z, parent) => mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent);
  const cylm = (rt, rb, h, m, x, y, z, parent, seg = 12, open = false, ts, tl) =>
    mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl), m, x, y, z, parent);

  // ---------- looks ----------
  // Colors follow the family's paintings for Sean. Other characters follow the prologue's descriptions.
  const PALE = 0xd9d3c4, LINING = 0x7f6f58;
  const LOOKS = {
    sean: { h: 1.86, build: 1.06, skin: 0xc8966c, hair: "bald", beard: "full", beardColor: 0x18120e, glasses: true,
      shirt: 0x2c3038, coat: 0x1f242c, coatTrim: true, epaulettes: true, pants: 0x1a1d22, boots: 0x141312, sash: 0x6a4588 },
    // Reference: dark navy coat (not pale), flat cap with goggles on the brim, stubble, brass
    // buttons/buckles, a heavy belt. Previously a pale, plain coat and bare short hair with no
    // trim, which under night lighting read as a flat, featureless dark shape.
    deke: { h: 1.83, build: .96, skin: 0x8a5a3a, hair: "cap", capColor: 0x232a35, beard: "stubble", beardColor: 0x241c16, goggles: "cracked", blood: true,
      shirt: 0x3a3f46, coat: 0x1b2230, coatTrim: true, coatTorn: true, insignia: true, epaulettes: true, sash: 0x3a2a1a, pants: 0x3b4048, boots: 0x1c1a18, rifle: "back" },
    // A grizzled veteran sergeant: brass rank badge, a worn leather belt, trim on the coat so he
    // doesn't read as the same flat shape as the rank-and-file troopers under him.
    mercer: { h: 1.78, build: 1.1, skin: 0xb88a68, hair: "short", hairColor: 0x8e8a84, beard: "stubble", beardColor: 0x7d7872, blood: true,
      shirt: 0x3a3f46, coat: LINING, coatTrim: true, insignia: true, sash: 0x4a3a22, pants: 0x3b4048, boots: 0x1c1a18, pistol: true },
    // Young and less decorated than the veterans, but still a soldier: a comms badge and belt.
    nia: { h: 1.66, build: .84, skin: 0x6e4630, hair: "bun", hairColor: 0x0f0b09, insignia: true, sash: 0x3a2a1a,
      shirt: 0x3a3f46, coat: LINING, pants: 0x3b4048, boots: 0x1c1a18, rifle: "hands", sling: true },
    trooper: { h: 1.78, build: 1, skin: 0xa77a58, hair: "short", hairColor: 0x2a1f18, insignia: true, sash: 0x3a2a1a,
      shirt: 0x3a3f46, coat: LINING, pants: 0x3b4048, boots: 0x1c1a18, rifle: "back" },
    soldier: { h: 1.8, build: 1, skin: 0x9c7458, hair: "cap", hairColor: 0x1b1d22, capColor: 0xe8e4da,
      shirt: 0xcfc9bb, coat: 0xe8e4da, coatTrim: true, pants: 0xcfc9bb, boots: 0x101012, rifle: "bayonet" }
  };
  // Villagers: bright island clothes, many ages.
  const VILLAGE = [0xd1674a, 0xe8c15a, 0x5e8fb8, 0x8ab06a, 0xe39a6b, 0xb07ab0, 0x6fb0a4, 0xc9a45c];
  const SKINS = [0x5b3a26, 0x7a4e32, 0x9a6a48, 0xb88a68, 0xd0a482, 0x6e4630];
  function villager(i, kind) {
    const c = VILLAGE[i % VILLAGE.length], s = SKINS[(i * 7 + 3) % SKINS.length];
    const child = kind === "child", old = kind === "old";
    return {
      h: child ? 1.15 + (i % 3) * .08 : old ? 1.62 : 1.64 + (i % 4) * .06,
      build: child ? .8 : .95, skin: s,
      hair: ["short", "bun", "long", "short", "bald"][i % 5], hairColor: old ? 0xbdb8b0 : [0x15100c, 0x3a2416, 0x2a1f18][i % 3],
      shirt: c, pants: [0x4a4038, 0x3b4a5a, 0x5a4a3a][i % 3], boots: 0x2a1e14, skirt: i % 2 === 0 && !child ? c : 0
    };
  }

  // ---------- the body ----------
  function build(look) {
    const L = Object.assign({ build: 1 }, look);
    const S = L.h / 1.86;           // everything is authored for a 1.86 m person, then scaled
    const B = L.build;
    const M = {
      skin: mat(L.skin, .55),
      head: mat(L.skin, L.hair === "bald" ? .34 : .55),
      shirt: mat(L.shirt, .85),
      coat: mat(L.coat || L.shirt, .72, { side: T.DoubleSide }),
      pants: mat(L.pants, .85),
      boots: mat(L.boots, .38),
      sole: mat(0x0a0a0a, .9),
      hair: mat(L.hairColor || 0x111111, .9),
      beard: mat(L.beardColor || 0x18120e, .95),
      brass: mat(0xb58d4a, .32, { metalness: .6 }),
      steel: mat(0x6b7078, .38, { metalness: .7 }),
      iron: mat(0x2b2e33, .5, { metalness: .6 }),
      wood: mat(0x4a3220, .7),
      blood: mat(0x6a1a14, .6),
      eye: mat(0x1a120e, .2)
    };

    const root = new T.Group();
    const body = new T.Group(); body.scale.setScalar(S); root.add(body);
    const hips = new T.Group(); body.add(hips);

    function leg(side) {
      const thigh = new T.Group(); thigh.position.set(side * .1 * B, 0, 0); hips.add(thigh);
      capsule(.078 * B, .36, M.pants, thigh, -.235);
      const knee = new T.Group(); knee.position.y = -.47; thigh.add(knee);
      capsule(.062 * B, .36, M.pants, knee, -.2);
      cylm(.078, .07, .26, M.boots, 0, -.32, 0, knee);
      const ankle = new T.Group(); ankle.position.y = -.45; knee.add(ankle);
      boxm(.11, .09, .27, M.boots, 0, -.035, .06, ankle);
      boxm(.115, .02, .28, M.sole, 0, -.08, .06, ankle);
      return { thigh, knee, ankle };
    }
    const legR = leg(-1), legL = leg(1);

    if (L.skirt) {
      const sk = cylm(.2 * B, .3 * B, .55, mat(L.skirt, .85, { side: T.DoubleSide }), 0, -.22, 0, hips, 18, true);
      sk.userData.skirt = true;
    }
    if (L.sash) {
      // Radius must clear the coat skirt's top rim (~.22-.25*B here) or the sash renders tucked
      // inside the coat's tube instead of visibly over it, peeking out oddly through its leg-gap.
      const sash = mesh(new T.TorusGeometry(.27 * B, .032, 10, 28), mat(L.sash, .75), 0, .05, 0, hips);
      sash.rotation.x = Math.PI / 2; sash.scale.set(1, .78, 1);
    }
    const tails = new T.Group(); tails.position.set(.06, .03, .15); hips.add(tails);
    if (L.sash) { boxm(.06, .2, .02, mat(L.sash, .75), 0, -.1, 0, tails); boxm(.05, .16, .02, mat(L.sash, .75), .05, -.08, -.01, tails); }

    // coat skirt
    const skirt = new T.Group(); skirt.position.y = .08; hips.add(skirt);
    if (L.coat) {
      const gap = L.coatTorn ? .2 : .12;
      const m = mesh(new T.CylinderGeometry(.22 * B, .34 * B, .6, 22, 1, true, Math.PI * gap, Math.PI * (2 - 2 * gap)), M.coat, 0, -.3, 0, skirt);
      m.rotation.y = Math.PI;
      if (L.coatTrim) {
        const hem = mesh(new T.TorusGeometry(.34 * B, .008, 6, 40, Math.PI * (2 - 2 * gap)), M.brass, 0, -.6, 0, skirt);
        hem.rotation.x = Math.PI / 2; hem.rotation.z = Math.PI * .5 + Math.PI * gap;
      }
    }

    // saber on the left hip: the coat skirt above is a tube with a gap left open for the leg to
    // swing through, and after its 180° flip (`m.rotation.y = Math.PI`) that gap sits on the -X
    // side. The scabbard has to open through the same gap or the coat's fabric clips through it.
    const scabbard = new T.Group(); scabbard.position.set(-.2 * B, .02, .02); scabbard.rotation.set(.95, 0, -.12); hips.add(scabbard);
    cylm(.02, .016, .88, M.iron, 0, -.44, 0, scabbard, 10);
    cylm(.024, .024, .05, M.steel, 0, -.86, 0, scabbard, 10);
    cylm(.016, .016, .15, mat(0x2b1d14, .8), 0, .09, 0, scabbard, 10);
    const guard = mesh(new T.TorusGeometry(.05, .007, 6, 16, Math.PI), M.steel, 0, .06, .03, scabbard); guard.rotation.y = Math.PI / 2;
    sphere(.022, M.steel, 0, .17, 0, scabbard);
    scabbard.visible = false;

    // torso
    const spine = new T.Group(); spine.position.y = .06; hips.add(spine);
    const torso = capsule(.2 * B, .3, M.shirt, spine, .3); torso.scale.set(1.12, 1, .78);
    sphere(.05, M.skin, 0, .5, .12, spine, 1, 1.4, .5);
    const coatTop = new T.Group(); spine.add(coatTop);
    if (L.coat) {
      const ct = mesh(new T.CylinderGeometry(.25 * B, .23 * B, .56, 22, 1, true, Math.PI * .16, Math.PI * 1.68), M.coat, 0, .3, 0, coatTop);
      ct.rotation.y = Math.PI; ct.scale.z = .8;
      const col = mesh(new T.CylinderGeometry(.13, .15, .1, 16, 1, true, Math.PI * .3, Math.PI * 1.4), M.coat, 0, .6, -.03, coatTop);
      col.rotation.y = Math.PI;
      if (L.coatTrim) for (let i = 0; i < 4; i++) sphere(.013, M.brass, .075 * B, .48 - i * .1, .2 * B, coatTop);
      if (L.epaulettes) for (const s of [-1, 1]) {
        sphere(.09, M.coat, s * .22 * B, .55, 0, coatTop, 1.1, .5, 1);
        const f = mesh(new T.TorusGeometry(.085, .01, 6, 16, Math.PI), M.brass, s * .22 * B, .54, 0, coatTop); f.rotation.y = Math.PI / 2;
      }
      if (L.insignia) boxm(.05, .03, .01, M.brass, .2 * B, .55, .06, coatTop).rotation.z = -.5;
      if (L.coatTorn) boxm(.12, .05, .01, M.shirt, -.2 * B, .5, .05, coatTop).rotation.z = .6;
    }

    // rifle across the back, or held
    const rifle = new T.Group();
    boxm(.05, .08, .28, M.wood, 0, 0, -.14, rifle);
    cylm(.013, .013, .8, M.iron, 0, .02, .26, rifle, 8).rotation.x = Math.PI / 2;
    boxm(.035, .05, .4, M.wood, 0, -.005, .12, rifle);
    if (L.rifle === "bayonet") cylm(.004, .008, .22, M.steel, 0, .03, .76, rifle, 6).rotation.x = Math.PI / 2;
    const rifleBack = new T.Group(); rifleBack.position.set(0, .35, -.2 * B); rifleBack.rotation.set(0, 0, .8); spine.add(rifleBack);
    const rb = rifle.clone(); rb.rotation.set(Math.PI / 2, 0, 0); rifleBack.add(rb);
    rifleBack.visible = L.rifle === "back";

    const chest = new T.Group(); chest.position.y = .58; spine.add(chest);
    cylm(.058, .064, .12, M.skin, 0, .05, 0, chest);
    const head = new T.Group(); head.position.y = .2; chest.add(head);
    sphere(.112, M.head, 0, 0, 0, head, 1, 1.12, 1.02);
    const nose = mesh(new T.ConeGeometry(.02, .05, 10), M.skin, 0, 0, .12, head); nose.rotation.x = Math.PI / 2;
    const eyes = [];
    for (const s of [-1, 1]) {
      sphere(.024, M.skin, s * .112, -.005, 0, head, .5, 1, .8);
      eyes.push(sphere(.013, M.eye, s * .041, .025, .098, head));
      boxm(.045, .012, .015, L.beard === "full" ? M.beard : M.hair, s * .042, .058, .1, head).rotation.z = s * -.08;
    }
    if (L.beard === "full") {
      sphere(.106, M.beard, 0, -.065, .025, head, .98, .72, .95);
      sphere(.03, M.beard, 0, -.03, .1, head, 1.5, .5, .6);
    } else if (L.beard === "stubble") {
      sphere(.104, mat(L.beardColor, .95, { transparent: true, opacity: .55 }), 0, -.05, .02, head, 1, .72, .96);
    }
    if (L.hair === "short" || L.hair === "bun" || L.hair === "long") {
      sphere(.118, M.hair, 0, .03, -.01, head, 1, 1.02, 1.04).scale.y = .95;
      if (L.hair === "bun") sphere(.05, M.hair, 0, .02, -.13, head);
      if (L.hair === "long") boxm(.2, .22, .06, M.hair, 0, -.1, -.08, head);
    } else if (L.hair === "cap") {
      cylm(.12, .12, .08, mat(L.capColor, .6), 0, .1, 0, head, 18);
      boxm(.16, .012, .08, M.iron, 0, .065, .1, head);
    }
    if (L.glasses) {
      const fr = mat(0x8d857a, .3, { metalness: .8 });
      for (const s of [-1, 1]) {
        const r = mesh(new T.TorusGeometry(.029, .0035, 6, 20), fr, s * .043, .025, .113, head); r.scale.y = .8;
        boxm(.004, .004, .11, fr, s * .075, .028, .06, head);
      }
      boxm(.024, .004, .004, fr, 0, .03, .118, head);
    }
    if (L.goggles) {
      const band = mesh(new T.TorusGeometry(.117, .012, 6, 30), mat(0x2a241e, .8), 0, .03, 0, head); band.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) {
        const g = mesh(new T.CylinderGeometry(.034, .034, .03, 16, 1, s > 0), M.brass, s * .045, .03, .115, head); g.rotation.x = Math.PI / 2;
        if (s < 0) { const lens = mesh(new T.CircleGeometry(.03, 16), mat(0x9ec3d8, .05, { transparent: true, opacity: .55 }), s * .045, .03, .131, head); lens.castShadow = false; }
      }
    }
    if (L.blood) boxm(.03, .07, .01, M.blood, .07, .05, .1, head).rotation.z = .2;

    function arm(side) {
      const sh = new T.Group(); sh.position.set(side * .25 * B, 0, 0); sh.rotation.z = side * .09; chest.add(sh);
      const upper = capsule(.063 * B, .24, L.coat ? M.coat : M.shirt, sh, -.15);
      const elbow = new T.Group(); elbow.position.y = -.3; sh.add(elbow);
      const fore = capsule(.054 * B, .21, L.coat ? M.coat : M.shirt, elbow, -.135);
      const cuff = cylm(.064, .064, .05, M.brass, 0, -.24, 0, elbow);
      cuff.visible = !!L.coatTrim;
      const handG = new T.Group(); handG.position.y = -.31; elbow.add(handG);
      sphere(.05, M.skin, 0, 0, .01, handG, .9, 1.15, .8);
      return { sh, elbow, upper, fore, cuff, hand: handG };
    }
    const armR = arm(-1), armL = arm(1);
    if (L.sling) {
      const s = mesh(new T.TorusGeometry(.2, .03, 6, 16, Math.PI), mat(0xe6ddc8, .9), .05, .2, .12, spine);
      s.rotation.z = -.4;
    }

    // held props
    const heldRifle = rifle.clone(); heldRifle.visible = L.rifle === "hands" || L.rifle === "bayonet";
    heldRifle.position.set(0, -.02, .02); heldRifle.rotation.x = -Math.PI / 2; armR.hand.add(heldRifle);
    const pistol = new T.Group(); pistol.visible = !!L.pistol;
    boxm(.03, .1, .04, M.wood, 0, -.03, 0, pistol); cylm(.01, .01, .14, M.iron, 0, .02, .07, pistol, 8).rotation.x = Math.PI / 2;
    armR.hand.add(pistol);

    // a drawn saber for the right hand (hidden unless drawn)
    const blade = new T.Group(); blade.visible = false; armR.hand.add(blade);
    const bladeMat = new T.MeshStandardMaterial({ color: 0x5a5f66, metalness: .75, roughness: .32, emissive: 0x000000 });
    const bl = mesh(new T.BoxGeometry(.012, .82, .04), bladeMat, 0, -.46, .04, blade); bl.rotation.x = .08;
    cylm(.017, .017, .14, mat(0x2b1d14, .8), 0, .02, 0, blade, 10);
    sphere(.022, M.steel, 0, .1, 0, blade);
    const bow = mesh(new T.TorusGeometry(.06, .007, 6, 16, Math.PI), M.steel, 0, -.02, .03, blade); bow.rotation.y = Math.PI / 2;
    blade.rotation.x = Math.PI;

    // the baby, wrapped in a coat, carried in the left arm
    const baby = new T.Group(); baby.visible = false;
    baby.position.set(-.12, -.05, .12); armL.hand.add(baby);
    const wrap = sphere(.12, mat(0x2a2f36, .9), 0, 0, 0, baby, 1.5, .8, .9);
    wrap.rotation.z = .3;
    sphere(.05, mat(0x8a5a3a, .5), -.14, .06, .02, baby);
    sphere(.052, mat(0x4c9a6a, .2, { transparent: true, opacity: .35 }), -.14, .065, .02, baby);

    root.traverse(o => { if (o.isMesh) o.castShadow = true; });

    return { root, body, hips, spine, chest, head, legR, legL, armR, armL, skirt, coatTop, tails, scabbard, rifleBack, heldRifle, pistol, blade, bladeMat, baby, eyes, lookDef: L, scale: S, M };
  }

  // ---------- animation ----------
  const LT = .47, LS = .45, FOOT = .085;
  function legPose(Lg, ph, amp, idle, kneel) {
    const swing = Math.max(0, Math.cos(ph + .5));
    let th = -amp * .42 * Math.sin(ph) + (1 - amp) * idle;
    let kn = .06 + amp * .95 * swing * swing;
    const toe = amp * .45 * Math.pow(Math.max(0, Math.cos(ph + .7)), 2) - amp * .2 * Math.pow(Math.max(0, Math.sin(ph)), 8);
    Lg.thigh.rotation.x = th;
    Lg.knee.rotation.x = kn;
    Lg.ankle.rotation.x = -(th + kn) + toe;
    return LT * Math.cos(th) + LS * Math.cos(th + kn) + FOOT;
  }

  function Actor(look, name) {
    const r = build(typeof look === "string" ? LOOKS[look] : look);
    Object.assign(this, r);
    this.name = name || "";
    this.pos = this.root.position;
    this.heading = 0;
    this.phase = 0; this.amp = 0;
    this.path = []; this.done = null;
    this.speed = 1.25;
    this.faceAt = null;
    this.poses = {};            // name -> weight 0..1 (eased toward target)
    this.poseTarget = {};
    this.reachT = -1;
    this.t = Math.random() * 10;
  }
  Actor.prototype.place = function (x, z, heading) {
    this.pos.set(x, this.pos.y, z);
    if (heading !== undefined) this.heading = heading;
    this.path = []; this.amp = 0; this.faceAt = null;
    if (this.done) { const d = this.done; this.done = null; d(); }
    return this;
  };
  Actor.prototype.walkTo = function (x, z, faceAt, speed) {
    if (this.done) { const d = this.done; this.done = null; d(); }
    this.path = [[x, z]];
    this.faceAt = faceAt || null;
    if (speed) this.speed = speed;
    return new Promise(res => { this.done = res; });
  };
  Actor.prototype.follow = function (points, faceAt, speed) {
    if (this.done) { const d = this.done; this.done = null; d(); }
    this.path = points.slice();
    this.faceAt = faceAt || null;
    if (speed) this.speed = speed;
    return new Promise(res => { this.done = res; });
  };
  Actor.prototype.look = function (x, z) { this.faceAt = [x, z]; };
  Actor.prototype.pose = function (name, on) { this.poseTarget[name] = on ? 1 : 0; if (this.poses[name] === undefined) this.poses[name] = 0; };
  Actor.prototype.gesture = function () { this.reachT = 0; return new Promise(r => setTimeout(r, 560)); };
  Actor.prototype.gear = function (g) {
    if ("coat" in g) {
      this.skirt.visible = g.coat; this.coatTop.visible = g.coat;
      for (const a of [this.armR, this.armL]) { a.upper.material = g.coat ? this.M.coat : this.M.shirt; a.fore.material = g.coat ? this.M.coat : this.M.shirt; a.cuff.visible = g.coat && !!this.lookDef.coatTrim; }
    }
    if ("sword" in g) this.scabbard.visible = g.sword;
    if ("drawn" in g) { this.blade.visible = g.drawn; if (g.drawn) this.scabbard.visible = this.scabbard.visible; }
    if ("baby" in g) this.baby.visible = g.baby;
    if ("rifle" in g) { this.heldRifle.visible = g.rifle === "hands"; this.rifleBack.visible = g.rifle === "back"; }
    if ("pistol" in g) this.pistol.visible = g.pistol;
    return this;
  };

  Actor.prototype.update = function (dt, t) {
    this.t += dt;
    const p = this.pos;
    let want = null;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const step = this.speed * this.scale * dt * (.35 + .65 * this.amp);
      want = Math.atan2(dx, dz);
      if (d <= step) {
        p.x = tx; p.z = tz; this.path.shift();
        if (!this.path.length && this.done) { const f = this.done; this.done = null; f(); }
      } else {
        p.x += dx / d * step; p.z += dz / d * step;
        this.phase += step / (1.35 * this.scale) * Math.PI * 2;
      }
      this.amp = Math.min(1, this.amp + dt * 5);
    } else {
      this.amp = Math.max(0, this.amp - dt * 4);
      if (this.amp === 0) this.phase = 0;
      if (this.faceAt) want = Math.atan2(this.faceAt[0] - p.x, this.faceAt[1] - p.z);
    }
    if (want !== null) {
      let d = want - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 9);
    }
    this.root.rotation.y = this.heading;
    for (const k in this.poseTarget) {
      const tgt = this.poseTarget[k];
      this.poses[k] += (tgt - this.poses[k]) * Math.min(1, dt * 5);
    }
    let reach = 0;
    if (this.reachT >= 0) {
      this.reachT += dt;
      const u = this.reachT / .56;
      reach = u < .35 ? u / .35 : u < .7 ? 1 : Math.max(0, 1 - (u - .7) / .3);
      if (u >= 1) this.reachT = -1;
    }
    this.animate(this.t, reach);
  };

  Actor.prototype.animate = function (t, reach) {
    const P = this.poses, amp = this.amp, ph = this.phase;
    const sit = P.sit || 0, wheel = P.wheel || 0;
    const carry = P.carry || 0, aim = P.aim || 0, raise = P.raise || 0, point = P.point || 0, kneel = P.kneel || 0, lie = P.lie || 0, brace = P.brace || 0;
    const hR = legPose(this.legR, ph, amp, .04, 0), hL = legPose(this.legL, ph + Math.PI, amp, -.05, 0);
    let hip = Math.max(hR, hL);
    if (kneel) {
      this.legR.thigh.rotation.x = -1.4 * kneel; this.legR.knee.rotation.x = 1.5 * kneel; this.legR.ankle.rotation.x = -.1 * kneel;
      this.legL.thigh.rotation.x = .2 * kneel; this.legL.knee.rotation.x = 2.1 * kneel; this.legL.ankle.rotation.x = -.4 * kneel;
      hip = hip * (1 - kneel) + .52 * kneel;
    }
    if (sit) {
      for (const Lg of [this.legR, this.legL]) { Lg.thigh.rotation.x = Lg.thigh.rotation.x * (1 - sit) - 1.5 * sit; Lg.knee.rotation.x = Lg.knee.rotation.x * (1 - sit) + 1.45 * sit; Lg.ankle.rotation.x *= (1 - sit); }
      hip = hip * (1 - sit) + .5 * sit;
    }
    this.hips.position.y = hip;
    this.hips.rotation.y = amp * .1 * Math.sin(ph);
    this.spine.rotation.y = -amp * .16 * Math.sin(ph);
    this.spine.rotation.x = amp * .06 + brace * .25;
    const breathe = Math.sin(t * 1.6) * (1 - amp);
    this.chest.scale.set(1 + breathe * .008, 1 + breathe * .01, 1 + breathe * .012);
    this.head.rotation.x = -amp * .05 + Math.sin(t * .7) * .02 * (1 - amp) - aim * .1;
    this.head.rotation.y = Math.sin(t * .45) * .12 * (1 - amp) * (1 - aim);
    // arms: walk swing, then poses layered on top
    let rX = amp * .5 * Math.sin(ph), rE = -(.15 + amp * .45 * Math.max(0, -Math.sin(ph))), rZ = -.09;
    let lX = -amp * .5 * Math.sin(ph), lE = -(.15 + amp * .45 * Math.max(0, Math.sin(ph))), lZ = .09;
    const mix = (a, b, w) => a + (b - a) * w;
    rX = mix(rX, -1.35, aim); rE = mix(rE, -.1, aim); rZ = mix(rZ, .15, aim);
    lX = mix(lX, -1.2, aim); lE = mix(lE, -.55, aim); lZ = mix(lZ, -.35, aim);
    lX = mix(lX, -.55, carry); lE = mix(lE, -1.5, carry); lZ = mix(lZ, -.35, carry);
    rX = mix(rX, -2.7, raise); rE = mix(rE, -.3, raise);
    rX = mix(rX, -1.5, point); rE = mix(rE, -.05, point);
    rX = mix(rX, -1.25, reach); rE = mix(rE, -.25, reach);
    rX = mix(rX, -1.0, wheel); rE = mix(rE, -.6, wheel); lX = mix(lX, -1.0, wheel); lE = mix(lE, -.6, wheel);
    this.armR.sh.rotation.set(rX, 0, rZ); this.armR.elbow.rotation.x = rE;
    this.armL.sh.rotation.set(lX, 0, lZ); this.armL.elbow.rotation.x = lE;
    this.skirt.rotation.x = amp * (.14 + .05 * Math.sin(ph * 2)) + Math.sin(t * 1.2) * .01 - kneel * .3;
    this.tails.rotation.x = amp * .25 * Math.sin(ph * 2 + 1) + .05;
    this.scabbard.rotation.x = .95 + amp * .06 * Math.sin(ph * 2);
    this.body.rotation.x = -lie * Math.PI / 2;
    this.body.position.y = lie * .12 * this.scale;
    const blink = (t % 4.1) < .11 || lie > .5;
    for (const e of this.eyes) e.scale.y = blink ? .15 : 1;
  };

  window.PEOPLE = { Actor, LOOKS, villager, build };
})();
