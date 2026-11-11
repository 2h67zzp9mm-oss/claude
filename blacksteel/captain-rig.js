/* The Blacksteel Pirates: Captain Sean, built from the real Blender export.
 *
 * Sean is the only actor built from real GLB geometry (Blacksteel/Blender v011 + the v002
 * props) instead of people3d.js's primitive shapes. The export is a rigid, bone-parented
 * blockout with no skin weights and no animations, so to keep him walking, gesturing, and
 * posing with the exact same code every other character uses (people3d.js's Actor / legPose /
 * animate), this file inserts small identity-rotation "pivot" groups at each joint the
 * animation code drives (hip, knee, ankle, shoulder, elbow) and hands people3d.js those
 * pivots in place of its primitive Groups. Everything else about an Actor (walking, poses,
 * gear toggles) is unchanged and unaware the body underneath is a loaded model.
 *
 * Why pivots instead of driving the bones directly: the exported bones carry real rest
 * rotations (a thigh bone points down at a Blender-authored twist, a clavicle bone is
 * rotated to point out to the side, etc.), but people3d.js's pose code assigns rotations
 * as absolute Euler angles authored for identity-rest primitive Groups. Overwriting a bone's
 * rotation directly would discard its rest twist and break the pose. Inserting an identity
 * pivot at the nearest identity-rotation ancestor (pelvis for the hip, chest for the
 * shoulder) and reparenting the bone chain underneath it means the pivot's own local axes
 * are exactly the clean world-ish axes the animation code expects, regardless of whatever
 * twist the bone chain itself carries below it.
 */
(function () {
  "use strict";
  const T = window.THREE;
  if (!T) return;

  const BASE_URL = "models/v011/Captain-Sean-Base-NoJacket-v011.glb";
  const JACKET_URL = "models/v011/Captain-Sean-Wearable-Jacket-v011.glb";
  const SWORD_URL = "models/props/Nightforge-Sword-v002.glb";
  const WALL_URL = "models/props/Nightforge-Wall-Display-v002.glb";
  const HANGING_URL = "models/props/Captain-Sean-Hanging-Jacket-v002.glb";

  function loadGLTF(url) {
    return new Promise((resolve, reject) => {
      if (!window.GLTFLoader) { reject(new Error("GLTFLoader not available")); return; }
      new window.GLTFLoader().load(url, resolve, undefined, reject);
    });
  }

  function findByName(root, name) {
    let found = null;
    root.traverse(o => { if (!found && o.name === name) found = o; });
    return found;
  }
  // Reparents `bone` under a brand-new identity-rotation Group placed at `bone`'s old local
  // position (so the world transform is unchanged until the pivot is animated), and returns
  // that pivot. `bone` must currently be a direct child of `parent`.
  function insertPivot(parent, bone, label) {
    const pivot = new T.Group();
    pivot.name = "PIVOT_" + label;
    pivot.position.copy(bone.position);
    parent.add(pivot);
    bone.position.set(0, 0, 0);
    pivot.add(bone);
    return pivot;
  }

  // A wrapper Group with zero local transform, inserted as a child of `bone` purely so a set
  // of meshes attached to it can be shown/hidden as a unit without touching the bone's own
  // (base-body) meshes.
  function wrapper(bone, label) {
    const g = new T.Group();
    g.name = "WRAP_" + label;
    bone.add(g);
    return g;
  }

  const JACKET_ATTACH = {
    "clavicle.L": ["Epaulette_L"],
    "clavicle.R": ["Epaulette_R"],
    "upper_arm.L": ["CoatSleeve_Upper_L"],
    "upper_arm.R": ["CoatSleeve_Upper_R"],
    "forearm.L": ["CoatSleeve_Lower_L", "Gold_Cuff_L"],
    "forearm.R": ["CoatSleeve_Lower_R", "Gold_Cuff_R"],
    "chest": ["Chest_CollarClasp", "Chest_Lapel_L", "Chest_Lapel_R", "Chest_Trim_L", "Chest_Trim_R", "HighCollar_L", "HighCollar_R"],
    "spine_02": ["Chest_Button_Lower", "Chest_Button_Upper", "Chest_JacketFront_L", "Chest_JacketFront_R", "Jacket_BackBody", "Jacket_Underarm_L", "Jacket_Underarm_R"],
  };
  const TAIL_MESHES = ["Jacket_RearTail_L", "Jacket_RearTail_R"];

  function makeVisibilityToggle(objects) {
    return {
      rotation: { x: 0, y: 0, z: 0 },
      get visible() { return objects.length ? objects[0].visible : true; },
      set visible(v) { objects.forEach(o => { o.visible = v; }); }
    };
  }

  // Small primitive props with no GLB equivalent: the sheathed look at the hip (no sheathed
  // Nightforge asset was exported, only the drawn blade), and the swaddled baby. Both are cheap
  // enough to keep building the same way people3d.js's primitive Actors do.
  function scabbardProp() {
    const iron = new T.MeshStandardMaterial({ color: 0x2b2e33, roughness: .5, metalness: .6 });
    const steel = new T.MeshStandardMaterial({ color: 0x6b7078, roughness: .38, metalness: .7 });
    const leather = new T.MeshStandardMaterial({ color: 0x2b1d14, roughness: .8 });
    const g = new T.Group();
    g.position.set(-.2, .02, .02); g.rotation.set(.95, 0, -.12);
    const body = new T.Mesh(new T.CylinderGeometry(.02, .016, .88, 10), iron); body.position.y = -.44; g.add(body);
    const tip = new T.Mesh(new T.CylinderGeometry(.024, .024, .05, 10), steel); tip.position.y = -.86; g.add(tip);
    const throatM = new T.Mesh(new T.CylinderGeometry(.016, .016, .15, 10), leather); throatM.position.y = .09; g.add(throatM);
    const guard = new T.Mesh(new T.TorusGeometry(.05, .007, 6, 16, Math.PI), steel); guard.position.y = .06; guard.position.z = .03; guard.rotation.y = Math.PI / 2; g.add(guard);
    const pommel = new T.Mesh(new T.SphereGeometry(.022, 12, 8), steel); pommel.position.y = .17; g.add(pommel);
    g.visible = false;
    return g;
  }
  function babyProp() {
    const wrapM = new T.MeshStandardMaterial({ color: 0x2a2f36, roughness: .9 });
    const skinM = new T.MeshStandardMaterial({ color: 0x8a5a3a, roughness: .5 });
    const blanketM = new T.MeshStandardMaterial({ color: 0x4c9a6a, roughness: .2, transparent: true, opacity: .35 });
    const g = new T.Group();
    g.position.set(-.12, -.05, .12); g.visible = false;
    const wrap = new T.Mesh(new T.SphereGeometry(.12, 18, 12), wrapM); wrap.scale.set(1.5, .8, .9); wrap.rotation.z = .3; g.add(wrap);
    const headM = new T.Mesh(new T.SphereGeometry(.05, 18, 12), skinM); headM.position.set(-.14, .06, .02); g.add(headM);
    const blanket = new T.Mesh(new T.SphereGeometry(.052, 18, 12), blanketM); blanket.position.set(-.14, .065, .02); g.add(blanket);
    return g;
  }

  const template = { ready: false, sean: null, jacket: null, sword: null, wall: null, hanging: null };

  function preload() {
    if (template._promise) return template._promise;
    template._promise = Promise.all([
      loadGLTF(BASE_URL), loadGLTF(JACKET_URL), loadGLTF(SWORD_URL), loadGLTF(WALL_URL), loadGLTF(HANGING_URL)
    ]).then(([sean, jacket, sword, wall, hanging]) => {
      template.sean = sean.scene;
      template.jacket = jacket.scene;
      template.sword = sword.scene;
      template.wall = wall.scene;
      template.hanging = hanging.scene;
      template.ready = true;
    }).catch(err => {
      console.error("Captain Sean GLB preload failed, falling back to the primitive body:", err);
      template.ready = false;
    });
    return template._promise;
  }

  // Builds one fresh, independently-posable Sean rig from a clone of the loaded template.
  // Returns the same shape people3d.js's primitive build(look) returns.
  function build(look) {
    const scene = template.sean.clone(true);
    const find = name => findByName(scene, name);

    const pelvis = find("pelvis"), spine01 = find("spine_01"), chest = find("chest"), head = find("head");
    const thighL = find("thigh.L"), thighR = find("thigh.R");
    const shinL = find("shin.L"), shinR = find("shin.R");
    const footL = find("foot.L"), footR = find("foot.R");
    const claL = find("clavicle.L"), claR = find("clavicle.R");
    const upperL = find("upper_arm.L"), upperR = find("upper_arm.R");
    const foreL = find("forearm.L"), foreR = find("forearm.R");
    const handL = find("hand.L"), handR = find("hand.R");

    const legL = {
      thigh: insertPivot(pelvis, thighL, "hip.L"),
      knee: insertPivot(thighL, shinL, "knee.L"),
      ankle: insertPivot(shinL, footL, "ankle.L")
    };
    const legR = {
      thigh: insertPivot(pelvis, thighR, "hip.R"),
      knee: insertPivot(thighR, shinR, "knee.R"),
      ankle: insertPivot(shinR, footR, "ankle.R")
    };
    // upper/fore point at the real sleeve meshes (not the bones) so the beach chapter's scar
    // effect (`sean.armR.upper.material = scarMat`) still lands on visible geometry. The
    // Blender export layers the jacket sleeve as a separate mesh instead of swapping this
    // one's material, so gear()'s coat/shirt material swap on these is a harmless no-op here
    // (M.coat and M.shirt both point at the sleeve's own authored material below).
    const armL = {
      sh: insertPivot(chest, claL, "sh.L"),
      elbow: insertPivot(upperL, foreL, "elbow.L"),
      hand: handL, upper: find("Body_UpperArm_L"), fore: find("Body_Forearm_L"), cuff: { visible: false }
    };
    const armR = {
      sh: insertPivot(chest, claR, "sh.R"),
      elbow: insertPivot(upperR, foreR, "elbow.R"),
      hand: handR, upper: find("Body_UpperArm_R"), fore: find("Body_Forearm_R"), cuff: { visible: false }
    };

    // Jacket: reparent each mesh onto a per-bone wrapper so it can be shown/hidden as a group
    // without touching the base body meshes sharing that bone. The jacket export shares this
    // exact skeleton, so each mesh's own local position/rotation (as authored) is correct
    // unchanged relative to its wrapper.
    const jacketClone = template.jacket.clone(true);
    const jacketWrappers = [];
    const boneNodes = { "clavicle.L": claL, "clavicle.R": claR, "upper_arm.L": upperL, "upper_arm.R": upperR, "forearm.L": foreL, "forearm.R": foreR, "chest": chest, "spine_02": find("spine_02") };
    for (const boneName in JACKET_ATTACH) {
      const bone = boneNodes[boneName];
      if (!bone) continue;
      const wrap = wrapper(bone, boneName);
      for (const meshName of JACKET_ATTACH[boneName]) {
        const m = findByName(jacketClone, meshName);
        if (m) wrap.add(m);
      }
      jacketWrappers.push(wrap);
    }
    const tails = wrapper(pelvis, "tails");
    for (const meshName of TAIL_MESHES) { const m = findByName(jacketClone, meshName); if (m) tails.add(m); }
    jacketWrappers.push(tails);
    const coatToggle = makeVisibilityToggle(jacketWrappers);

    // Nightforge, drawn: the standalone sword's root IS its grip attachment point, so it
    // parents directly onto the hand with only a small orientation tweak for a natural grip.
    const swordClone = template.sword.clone(true);
    const blade = new T.Group();
    blade.rotation.set(Math.PI / 2, 0, 0);
    blade.add(swordClone);
    blade.visible = false;
    handR.add(blade);
    // A fresh material clone per Sean instance: the corruption effect mutates this in place
    // (color/emissive), and it must not bleed into later scenes' swords once this one is gone.
    const bladeMesh = findByName(swordClone, "Nightforge_Blade_Mesh");
    if (bladeMesh) bladeMesh.material = bladeMesh.material.clone();
    const bladeMat = (bladeMesh && bladeMesh.material) || new T.MeshStandardMaterial({ color: 0x5a5f66, metalness: .75, roughness: .32 });

    const scabbard = scabbardProp(); pelvis.add(scabbard);
    const baby = babyProp(); handL.add(baby);
    const heldRifle = new T.Group(); heldRifle.visible = false;
    const rifleBack = new T.Group(); rifleBack.visible = false;
    const pistol = new T.Group(); pistol.visible = false;

    const eyes = [];
    ["Eye_L", "Eye_R", "Pupil_L", "Pupil_R"].forEach(n => { const e = find(n); if (e) eyes.push(e); });

    const body = new T.Group(); body.add(scene);
    const root = new T.Group(); root.add(body);

    // gear()'s coat/shirt material swap targets armR/armL.upper|fore. The sleeve mesh here
    // never actually changes material with coat state (the jacket layers a separate mesh over
    // it instead), so both point at the sleeve's own authored material — a harmless no-op that
    // still leaves a valid Material assigned (never undefined) for the scar effect to replace.
    const sleeveMat = (armR.upper && armR.upper.material) || null;

    return {
      root, body, hips: pelvis, spine: spine01, chest, head, legR, legL, armR, armL,
      skirt: coatToggle, coatTop: coatToggle, tails, scabbard, rifleBack, heldRifle, pistol,
      blade, bladeMat, baby, eyes, lookDef: look, scale: 1, M: { coat: sleeveMat, shirt: sleeveMat }
    };
  }

  // Static world props for the cabin: the hanging jacket on its hook, and Nightforge on its
  // wall display. Each call returns a fresh clone so multiple scenes could use them safely.
  function hangingJacketProp() { return template.hanging.clone(true); }
  function wallDisplayProp() { return template.wall.clone(true); }

  window.CAPTAIN_RIG = { preload, build, hangingJacketProp, wallDisplayProp, get ready() { return template.ready; } };
})();
