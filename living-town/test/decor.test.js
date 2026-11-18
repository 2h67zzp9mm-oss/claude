"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Decor = require("../lib/decor");
const { createHomestead } = require("../lib/homestead");

test("decor: about 30 things with sensible prices", () => {
  assert.ok(Decor.CATALOG.length >= 30);
  assert.equal(new Set(Decor.CATALOG.map(d => d.id)).size, Decor.CATALOG.length, "ids are unique");
  for (const d of Decor.CATALOG) {
    assert.ok(["floor", "wall", "rug"].includes(d.kind), d.id);
    assert.ok(d.w >= 1 && d.h >= 1 && d.w <= 3 && d.h <= 3, d.id);
    assert.ok(d.dream ? d.price >= 500 && d.price <= 2000 : d.rare ? d.price >= 150 : d.price >= 10 && d.price <= 120, `${d.id} costs ${d.price}`);
    assert.ok(d.worlds === "all" || d.worlds.every(w => ["clay", "scifi", "castle", "night", "pirate"].includes(w)), d.id);
  }
});

test("decor: today's shop is the same all day for the family and changes from day to day", () => {
  const a = Decor.shopToday("2026-11-13", "clay", "home-1");
  assert.deepEqual(Decor.shopToday("2026-11-13", "clay", "home-1"), a, "same all day");
  for (const id of ["chair", "plant", "rug_round", "pic_flower"]) assert.ok(a.includes(id), `${id} is always there`);
  assert.ok(a.length >= 9 && a.length <= 10);
  const days = Array.from({ length: 30 }, (_, i) => Decor.shopToday(`2026-12-${i + 1}`, "clay", "home-1").join());
  assert.ok(new Set(days).size > 20, "the stock rotates");
  const rareDays = days.filter(s => s.split(",").some(id => Decor.BY_ID[id].rare)).length;
  assert.ok(rareDays > 2 && rareDays < 20, `sometimes a rare one (${rareDays}/30 days)`);
  // world things only show up in their own world
  for (let i = 1; i <= 30; i++) for (const id of Decor.shopToday(`2026-12-${i}`, "castle", "h")) assert.ok(Decor.BY_ID[id].worlds === "all" || Decor.BY_ID[id].worlds.includes("castle"));
});

test("decor: buy needs stars and today's stock; place, move, turn and store stay inside and never overlap", () => {
  const hs = createHomestead();
  const me = { id: "dad", name: "Sean", stars: 0 }, kid = { id: "hazel", name: "Hazel", stars: 0 }, state = { residents: [me, kid] };
  const now = Date.parse("2026-11-13T10:00:00"), act = (who, m) => hs.act(state, "home-1", who, m, now);
  const stock = hs.view(state, "home-1", me, now).decor.stock.map(s => s.id);
  const notToday = Decor.CATALOG.find(d => !stock.includes(d.id) && d.worlds === "all");
  assert.equal(act(me, { action: "decorBuy", item: "chair" }).ok, false, "needs stars");
  me.stars = 500;
  assert.equal(act(me, { action: "decorBuy", item: notToday.id }).ok, false, "must be in today's shop");
  assert.equal(act(me, { action: "decorBuy", item: "nope" }).ok, false);
  const buy = act(me, { action: "decorBuy", item: "chair" });
  assert.equal(buy.ok, true); assert.equal(me.stars, 500 - Decor.BY_ID.chair.price);
  act(me, { action: "decorBuy", item: "rug_round" }); act(me, { action: "decorBuy", item: "pic_flower" }); act(me, { action: "decorBuy", item: "plant" });
  let v = hs.view(state, "home-1", kid, now).decor;
  assert.equal(v.storage.length, 4, "the family shares the box"); assert.equal(v.room.length, 0);
  const uid = id => v.storage.find(s => s.id === id)?.uid ?? v.room.find(s => s.id === id)?.uid;
  const chair = uid("chair"), rug = uid("rug_round"), pic = uid("pic_flower"), plant = uid("plant");
  assert.equal(new Set([chair, rug, pic, plant]).size, 4, "each thing has its own uid");
  // placing
  assert.equal(act(kid, { action: "decorPlace", uid: chair, x: 0, y: 0 }).ok, false, "the doormat stays clear");
  assert.equal(act(kid, { action: "decorPlace", uid: chair, x: 9, y: 3 }).ok, false, "off the side");
  assert.equal(act(kid, { action: "decorPlace", uid: chair, x: 4, y: 7 }).ok, false, "off the front");
  assert.equal(act(kid, { action: "decorPlace", uid: chair, x: -1, y: 3 }).ok, false);
  assert.equal(act(kid, { action: "decorPlace", uid: chair, x: 4, y: 3 }).ok, true);
  assert.equal(act(kid, { action: "decorPlace", uid: chair, x: 4, y: 3 }).ok, false, "already out of the box");
  assert.equal(act(kid, { action: "decorPlace", uid: plant, x: 4, y: 3 }).ok, false, "no two things on one tile");
  assert.equal(act(kid, { action: "decorPlace", uid: rug, x: 3, y: 3 }).ok, true, "a rug can go under a chair");
  assert.equal(act(kid, { action: "decorPlace", uid: pic, x: 5, y: 0 }).ok, false, "not over the window");
  assert.equal(act(kid, { action: "decorPlace", uid: pic, x: 1, y: 0 }).ok, false, "not over the door");
  assert.equal(act(kid, { action: "decorPlace", uid: pic, x: 3, y: 4 }).ok, true, "wall things go on the wall whatever y says");
  v = hs.view(state, "home-1", me, now).decor;
  assert.equal(v.room.find(t => t.uid === pic).y, 0);
  assert.equal(act(me, { action: "decorPlace", uid: plant, x: 8, y: 6 }).ok, true);
  // moving
  assert.equal(act(me, { action: "decorMove", uid: plant, x: 4, y: 3 }).ok, false, "can't move onto the chair");
  assert.equal(act(me, { action: "decorMove", uid: chair, x: 4, y: 4 }).ok, true, "can move a step");
  assert.equal(act(me, { action: "decorMove", uid: chair, x: 4, y: 4 }).ok, true, "staying put is fine");
  // turning: a long thing turns, and slides back in if it would poke out
  me.stars += 999;
  const sofaDay = Array.from({ length: 200 }, (_, i) => new Date(now + i * 86400_000)).find(d => Decor.shopToday(Decor.dayKey(d), "clay", "home-1").includes("sofa"));
  const t2 = sofaDay.getTime();
  const bought = hs.act(state, "home-1", me, { action: "decorBuy", item: "sofa" }, t2); assert.equal(bought.ok, true);
  const sofa = bought.decorBought.uid;
  assert.equal(hs.act(state, "home-1", me, { action: "decorPlace", uid: sofa, x: 5, y: 6 }, t2).ok, true, "a 3x1 sofa along the front");
  assert.equal(hs.act(state, "home-1", me, { action: "decorRotate", uid: sofa }, t2).ok, true);
  let s = hs.view(state, "home-1", me, t2).decor.room.find(t => t.uid === sofa);
  assert.deepEqual([s.rot, s.x, s.y], [1, 5, 4], "turned upright and slid back in");
  assert.equal(hs.act(state, "home-1", me, { action: "decorRotate", uid: pic }, t2).ok, false, "wall things don't turn");
  assert.equal(hs.act(state, "home-1", me, { action: "decorMove", uid: plant, x: 5, y: 5 }, t2).ok, false, "the turned sofa is in the way now");
  // storing puts it back in the box
  assert.equal(hs.act(state, "home-1", kid, { action: "decorStore", uid: sofa }, t2).ok, true);
  s = hs.view(state, "home-1", me, t2).decor;
  assert.ok(s.storage.some(t => t.uid === sofa)); assert.ok(!s.room.some(t => t.uid === sofa));
  assert.equal(hs.act(state, "home-1", me, { action: "decorMove", uid: plant, x: 5, y: 5 }, t2).ok, true, "and the spot is free again");
  // each world's house has its own room; world things stay in their world
  hs.act(state, "home-1", me, { action: "world", world: "pirate" }, t2);
  assert.equal(hs.view(state, "home-1", me, t2).decor.room.length, 0, "a new house is empty");
  const other = hs.view(state, "home-2", me, t2).decor; assert.equal(other.storage.length, 0, "other families have their own box");
});

test("decor: a rare thing can be bought once on its day", () => {
  const hs = createHomestead(); const me = { id: "dad", stars: 10_000 }, state = { residents: [me] };
  let t = Date.parse("2026-11-13T10:00:00"), rare = null;
  for (let i = 0; i < 60 && !rare; i++, t += 86400_000) rare = hs.view(state, "h", me, t).decor.stock.find(s => Decor.BY_ID[s.id].rare);
  t -= 86400_000; assert.ok(rare, "a rare day comes along");
  assert.equal(hs.act(state, "h", me, { action: "decorBuy", item: rare.id }, t).ok, true);
  assert.equal(hs.act(state, "h", me, { action: "decorBuy", item: rare.id }, t).ok, false, "only one today");
  assert.equal(hs.view(state, "h", me, t).decor.stock.find(s => s.id === rare.id).soldOut, true);
  assert.equal(hs.act(state, "h", me, { action: "decorBuy", item: "chair" }, t).ok, true, "basics can be bought again and again");
  assert.equal(hs.act(state, "h", me, { action: "decorBuy", item: "chair" }, t).ok, true);
});

test("decor: Hazel's art picks save for the family and reject unknown styles", () => {
  const h = {}, r = { stars: 0 }, ctx = { world: "clay", householdId: "x", now: Date.now() };
  assert.deepStrictEqual(Decor.view(h, ctx).art, { room: "clay", pirate: "B" });
  assert.ok(Decor.act(h, r, { action: "artPick", key: "room", item: "pixel" }, ctx).ok);
  assert.ok(Decor.act(h, r, { action: "artPick", key: "pirate", item: "C" }, ctx).ok);
  assert.strictEqual(Decor.act(h, r, { action: "artPick", key: "room", item: "neon" }, ctx).ok, false);
  assert.strictEqual(Decor.act(h, r, { action: "artPick", key: "stars", item: "A" }, ctx).ok, false);
  assert.deepStrictEqual(Decor.view(h, ctx).art, { room: "pixel", pirate: "C" });
});

test("decor: every thing in the catalog has a drawing, in every style and every turn", () => {
  // load the room's drawing code the way the phone does, with a pretend canvas that counts what gets drawn
  const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
  let calls = 0; const bad = [];
  const fakeCanvas = () => {
    const stub = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get: (o, k) => (k in o ? o[k] : (...a) => { calls++; if (a.some(v => typeof v === "number" && !Number.isFinite(v))) bad.push(String(k)); return stub; }),
      set: (o, k, v) => { o[k] = v; return true; }
    });
    return { width: 390, height: 500, getContext: () => ctx };
  };
  const window = { LivingTownDecor: require("../shared/decor") };
  const box = { window, document: { createElement: fakeCanvas }, performance: { now: () => 1234 }, location: { search: "" }, URLSearchParams, requestAnimationFrame() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "public", "house-room.js"), "utf8"), box);
  const paint = (style, items) => { calls = 0; window.LivingTownRoom.paint(fakeCanvas(), { style, world: "night", items }); return calls; };
  for (const style of ["clay", "story", "pixel"]) {
    const empty = paint(style, []);
    for (const d of Decor.CATALOG) for (let rot = 0; rot < (d.kind === "wall" ? 1 : 4); rot++) {
      const n = paint(style, [{ uid: 1, id: d.id, x: 3, y: d.kind === "wall" ? 0 : 2, rot }]);
      assert.ok(n > empty + 3, `${d.id} is drawn in ${style} (turn ${rot})`);
      assert.deepEqual(bad, [], `${d.id} draws with real numbers in ${style} (turn ${rot})`);
    }
  }
});

test("decor: the server lets every house action through", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
  const list = src.match(/const HOME = \[[^\]]*\]/)?.[0] || "";
  for (const a of Decor.ACTIONS) assert.ok(list.includes(`"${a}"`), `${a} is allowed by the server`);
  assert.match(src, /room: msg\.room === 2 \? 2 : undefined/, "the server passes on which room a thing is in");
});

test("decor: a saving goal: pick a dream thing, watch have/need fill up, and it clears when the family gets it", () => {
  const hs = createHomestead();
  const me = { id: "dad", name: "Sean", stars: 120 }, kid = { id: "hazel", name: "Hazel", stars: 40 }, state = { residents: [me, kid] };
  const now = Date.parse("2026-11-16T10:00:00"), act = (who, m) => hs.act(state, "home-1", who, m, now), goal = who => hs.view(state, "home-1", who, now).decor.goal;
  assert.equal(goal(me), null, "an old save has no goal");
  assert.equal(act(me, { action: "dreamGoal", item: "chair" }).ok, false, "only dream things");
  assert.equal(act(me, { action: "dreamGoal", item: "rocket" }).ok, false, "not one from another world");
  assert.equal(act(me, { action: "dreamGoal" }).ok, false);
  const set = act(me, { action: "dreamGoal", item: "fountain" });
  assert.equal(set.ok, true); assert.equal(set.dreamGoal, "fountain"); assert.equal(me.stars, 120, "picking a goal is free");
  assert.deepEqual(goal(me), { id: "fountain", name: "Sparkle Fountain", emoji: "⛲", have: 120, need: 500, ready: false });
  assert.equal(goal(kid), null, "each person has their own goal");
  assert.equal(act(kid, { action: "dreamGoal", item: "fountain" }).ok, true);
  assert.equal(act(me, { action: "dreamGoal", item: "grand" }).ok, true, "picking another swaps it");
  assert.equal(goal(me).id, "grand"); assert.equal(goal(me).need, 900);
  me.stars = 899; assert.equal(goal(me).ready, false);
  me.stars = 900; assert.equal(goal(me).ready, true, "ready when you have enough");
  me.stars = 950; assert.deepEqual([goal(me).have, goal(me).ready], [950, true]);
  assert.equal(act(me, { action: "decorBuy", item: "grand" }).ok, true);
  assert.equal(goal(me), null, "bought: the goal is done"); assert.equal(goal(kid).id, "fountain", "Hazel's goal is still hers");
  me.stars = 500; assert.equal(act(me, { action: "decorBuy", item: "fountain" }).ok, true);
  assert.equal(goal(kid), null, "the family has the fountain now, so nobody is saving for it");
  assert.equal(act(kid, { action: "dreamGoal", item: "fountain" }).ok, false, "can't save for one you have");
  // a damaged or odd save never breaks the view
  for (const bad of [null, [], "x", { hazel: 7 }, { hazel: "nope" }, { hazel: "chair" }]) { state.homesteads["home-1"].dreamGoals = bad; assert.equal(goal(kid), null); }
  assert.equal(act(kid, { action: "dreamGoal", item: "treehouse" }).ok, true); assert.equal(goal(kid).id, "treehouse");
  assert.equal(hs.view(state, "home-1", null, now).decor.goal, null, "someone just looking has no goal");
});

test("decor: dream things are always in the shop, never in the daily mix, and bought once per family", () => {
  const WORLDS = ["clay", "scifi", "castle", "night", "pirate"], dreams = Decor.CATALOG.filter(d => d.dream);
  assert.ok(dreams.length >= 8 && dreams.length <= 10, `about 8 dream things (${dreams.length})`);
  for (const w of WORLDS) {
    const row = Decor.dreams(w);
    assert.ok(row.length >= 5, `${w} has a dream row`);
    assert.deepEqual(row, [...row].sort((a, b) => Decor.BY_ID[a].price - Decor.BY_ID[b].price), "cheapest first");
    if (w !== "clay") assert.ok(row.some(id => Decor.BY_ID[id].worlds !== "all"), `${w} has a dream thing of its own`);
    for (let i = 1; i <= 30; i++) for (const id of Decor.shopToday(`2026-12-${i}`, w, "h")) assert.ok(!Decor.BY_ID[id].dream, "never in the daily mix");
    for (const id of row) assert.ok(require("../shared/decor").freeSpot([], id), `${id} fits in an empty room`);
  }

  const hs = createHomestead();
  const me = { id: "dad", name: "Sean", stars: 499 }, kid = { id: "hazel", name: "Hazel", stars: 5000 }, state = { residents: [me, kid] };
  const now = Date.parse("2026-11-15T10:00:00"), later = now + 40 * 86400_000, act = (who, m, t = now) => hs.act(state, "home-1", who, m, t);
  let v = hs.view(state, "home-1", me, now).decor;
  assert.deepEqual(v.dreams.map(s => s.id), Decor.dreams("clay")); assert.ok(v.dreams.every(s => !s.owned), "an old save owns none");
  assert.equal(act(me, { action: "decorBuy", item: "fountain" }).ok, false, "needs all 500 stars"); assert.equal(me.stars, 499);
  me.stars = 500;
  const got = act(me, { action: "decorBuy", item: "fountain" });
  assert.equal(got.ok, true); assert.equal(got.dreamBought, "fountain"); assert.equal(me.stars, 0);
  assert.equal(act(kid, { action: "decorBuy", item: "fountain" }).ok, false, "one per family"); assert.equal(kid.stars, 5000);
  assert.equal(act(kid, { action: "decorBuy", item: "fountain" }, later).ok, false, "still one, weeks later");
  assert.equal(act(kid, { action: "decorBuy", item: "rocket" }).ok, false, "the rocket is only sold in its own world");
  assert.equal(act(kid, { action: "decorBuy", item: "treehouse" }, later).ok, true, "there on any day"); assert.equal(kid.stars, 3500);
  v = hs.view(state, "home-1", kid, later).decor;
  assert.deepEqual(v.dreams.filter(s => s.owned).map(s => s.id).sort(), ["fountain", "treehouse"]);
  assert.equal(v.storage.filter(s => s.id === "fountain").length, 1);
  // it goes out like any other thing, and another family can still buy their own
  assert.equal(act(kid, { action: "decorPlace", uid: got.decorBought.uid, x: 4, y: 3 }, later).ok, true);
  assert.equal(act(kid, { action: "decorPlace", uid: v.storage.find(s => s.id === "treehouse").uid, x: 4, y: 3 }, later).ok, false, "no two things on one spot");
  kid.stars = 500; assert.equal(hs.act(state, "home-2", kid, { action: "decorBuy", item: "fountain" }, later).ok, true);
  // world dream things are sold in their own world
  kid.stars = 1000; hs.act(state, "home-1", kid, { action: "world", world: "scifi" }, later);
  assert.ok(hs.view(state, "home-1", kid, later).decor.dreams.some(s => s.id === "rocket"));
  assert.equal(act(kid, { action: "decorBuy", item: "rocket" }, later).ok, true);
});

test("decor: the bigger room costs 1,000⭐ once, adds floor for the whole family, and old houses stay small until then", () => {
  const hs = createHomestead();
  const me = { id: "dad", name: "Sean", stars: 600 }, kid = { id: "hazel", name: "Hazel", stars: 0 }, state = { residents: [me, kid] };
  const now = Date.parse("2026-11-17T10:00:00"), act = (who, m) => hs.act(state, "home-1", who, m, now), decor = who => hs.view(state, "home-1", who, now).decor;
  assert.deepEqual([Decor.ROOM.w, Decor.ROOM.d, Decor.BIG_ROOM.w, Decor.BIG_ROOM.d, Decor.BIG_ROOM_PRICE], [9, 7, 9, 11, 1000]);
  assert.deepEqual([Decor.BIG_ROOM.door, Decor.BIG_ROOM.window, Decor.BIG_ROOM.mat], [Decor.ROOM.door, Decor.ROOM.window, Decor.ROOM.mat], "same door, window and doormat");
  assert.deepEqual([decor(me).big, decor(me).bigPrice], [false, 1000], "an old save has the small room");
  act(me, { action: "decorBuy", item: "chair" }); act(me, { action: "decorBuy", item: "plant" });
  const [chair, plant] = decor(me).storage.map(s => s.uid);
  assert.equal(act(me, { action: "decorPlace", uid: chair, x: 8, y: 6 }).ok, true, "the front row of the small room");
  assert.equal(act(me, { action: "decorPlace", uid: plant, x: 4, y: 9 }).ok, false, "the small room stops at 7 rows");
  // not enough stars: nothing changes
  const before = me.stars, no = act(me, { action: "roomUpgrade" });
  assert.equal(no.ok, false); assert.match(no.toast, /1000⭐/); assert.equal(me.stars, before); assert.equal(decor(me).big, false);
  me.stars = 1200;
  const yes = act(me, { action: "roomUpgrade" });
  assert.deepEqual([yes.ok, yes.roomUpgraded, me.stars], [true, true, 200]);
  assert.equal(decor(kid).big, true, "the whole family gets it");
  assert.deepEqual(decor(me).room.find(t => t.uid === chair), { uid: chair, id: "chair", x: 8, y: 6, rot: 0 }, "nothing inside moved");
  me.stars = 5000;
  assert.equal(act(me, { action: "roomUpgrade" }).ok, false, "only once"); assert.equal(me.stars, 5000);
  // the new floor works: place, move, and still not past the new front or the sides
  assert.equal(act(kid, { action: "decorPlace", uid: plant, x: 4, y: 9 }).ok, true, "the new rows take things");
  assert.equal(act(kid, { action: "decorMove", uid: plant, x: 8, y: 10 }).ok, true, "right to the new front corner");
  assert.equal(act(kid, { action: "decorMove", uid: plant, x: 8, y: 11 }).ok, false, "not past the new front");
  assert.equal(act(kid, { action: "decorMove", uid: plant, x: 9, y: 10 }).ok, false, "no wider than before");
  assert.equal(act(kid, { action: "decorMove", uid: chair, x: 0, y: 0 }).ok, false, "the doormat still stays clear");
  // a long thing turned at the new front slides back in, not back to the old front
  const sofaDay = Array.from({ length: 200 }, (_, i) => new Date(now + i * 86400_000)).find(d => Decor.shopToday(Decor.dayKey(d), "clay", "home-1").includes("sofa")), t2 = sofaDay.getTime();
  const sofa = hs.act(state, "home-1", me, { action: "decorBuy", item: "sofa" }, t2).decorBought.uid;
  assert.equal(hs.act(state, "home-1", me, { action: "decorPlace", uid: sofa, x: 3, y: 10 }, t2).ok, true);
  assert.equal(hs.act(state, "home-1", me, { action: "decorRotate", uid: sofa }, t2).ok, true);
  const s = hs.view(state, "home-1", me, t2).decor.room.find(t => t.uid === sofa);
  assert.deepEqual([s.rot, s.x, s.y], [1, 3, 8]);
  // every world's house is bigger, and other families are not
  hs.act(state, "home-1", me, { action: "world", world: "pirate" }, t2);
  assert.equal(hs.view(state, "home-1", me, t2).decor.big, true);
  assert.equal(hs.view(state, "home-2", me, t2).decor.big, false);
  // an odd saved value is the small room, never a crash
  for (const bad of [null, 1, "yes", {}, []]) { state.homesteads["home-1"].bigRoom = bad; assert.equal(hs.view(state, "home-1", me, t2).decor.big, false); }
  // the phone's helpers: the free-spot finder uses the room it is given
  const full = []; let uid = 1;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) if (Decor.fits(full, "chair", x, y)) full.push({ uid: uid++, id: "chair", x, y, rot: 0 });
  const D = require("../shared/decor");
  assert.equal(D.freeSpot(full, "chair"), null, "a full small room has no spot");
  assert.deepEqual(D.freeSpot(full, "chair", 0, D.BIG_ROOM), { x: 0, y: 7, rot: 0 }, "the bigger room has the new rows");
  assert.equal(D.roomFor(true), D.BIG_ROOM); for (const v of [false, undefined, null, 1, "true"]) assert.equal(D.roomFor(v), D.ROOM);
});

test("decor: the second room costs 2,500⭐ once, has a doorway from the first room, and keeps its own things", () => {
  const hs = createHomestead();
  const me = { id: "dad", name: "Sean", stars: 2000 }, kid = { id: "olive", name: "Olive", stars: 0 }, state = { residents: [me, kid] };
  const now = Date.parse("2026-11-18T10:00:00"), act = (who, m) => hs.act(state, "home-1", who, m, now), decor = who => hs.view(state, "home-1", who, now).decor;
  assert.deepEqual([decor(me).second, decor(me).secondPrice, decor(me).room2], [false, 2500, undefined], "an old save has one room");
  // things standing where the doorway will go
  for (const item of ["chair", "chair", "pic_flower", "plant"]) act(me, { action: "decorBuy", item });
  const [c1, c2, pic, plant] = decor(me).storage.map(s => s.uid);
  assert.equal(act(me, { action: "decorPlace", uid: c1, x: 7, y: 0 }).ok, true);
  assert.equal(act(me, { action: "decorPlace", uid: c2, x: 8, y: 3 }).ok, true);
  assert.equal(act(me, { action: "decorPlace", uid: pic, x: 8, y: 0 }).ok, true);
  // asking for room 2 before having it is just the first room
  assert.equal(act(me, { action: "decorPlace", uid: plant, x: 4, y: 4, room: 2 }).ok, true);
  assert.ok(decor(me).room.some(t => t.uid === plant)); act(me, { action: "decorStore", uid: plant });
  // not enough stars: nothing changes
  const no = act(me, { action: "roomAdd" });
  assert.equal(no.ok, false); assert.match(no.toast, /2500⭐/); assert.equal(me.stars, 2000 - 12 * 2 - 16 - 14); assert.equal(decor(me).second, false);
  me.stars = 3000;
  const yes = act(me, { action: "roomAdd" });
  assert.deepEqual([yes.ok, yes.roomAdded, yes.moved, me.stars], [true, true, 2, 500]);
  assert.match(yes.toast, /Stored/);
  assert.deepEqual(decor(me).room.map(t => t.uid), [c2], "only the things in the doorway were put away");
  assert.ok([c1, pic].every(u => decor(me).storage.some(s => s.uid === u)), "they're in the box");
  assert.deepEqual([decor(kid).second, decor(kid).room2], [true, []], "the whole family gets it, empty to start");
  me.stars = 9000; assert.equal(act(me, { action: "roomAdd" }).ok, false, "only once"); assert.equal(me.stars, 9000);
  // the doorway and its mat stay clear in the first room
  assert.equal(act(me, { action: "decorPlace", uid: c1, x: 8, y: 0 }).ok, false, "nothing on the doorway's mat");
  assert.equal(act(me, { action: "decorPlace", uid: pic, x: 7, y: 0 }).ok, false, "nothing hung in the doorway");
  // the second room keeps its own things: place, move, store
  assert.equal(act(kid, { action: "decorPlace", uid: c1, x: 8, y: 0, room: 2 }).ok, true, "the second room's corner is free");
  assert.equal(act(kid, { action: "decorPlace", uid: plant, x: 0, y: 0, room: 2 }).ok, false, "its doormat stays clear");
  assert.equal(act(kid, { action: "decorPlace", uid: plant, x: 4, y: 6, room: 2 }).ok, true);
  assert.equal(act(kid, { action: "decorPlace", uid: pic, x: 7, y: 0, room: 2 }).ok, true, "the second room's back wall has no doorway there");
  assert.equal(act(kid, { action: "decorMove", uid: plant, x: 5, y: 6, room: 2 }).ok, true);
  assert.equal(act(kid, { action: "decorMove", uid: plant, x: 5, y: 7, room: 2 }).ok, false, "the second room is the small room's size");
  assert.equal(act(kid, { action: "decorMove", uid: plant, x: 5, y: 5 }).ok, false, "a thing in room 2 isn't found from room 1");
  assert.deepEqual(decor(me).room2.map(t => t.uid).sort(), [c1, plant, pic].sort());
  assert.deepEqual(decor(me).room.map(t => t.uid), [c2]);
  assert.equal(act(kid, { action: "decorStore", uid: plant, room: 2 }).ok, true);
  assert.ok(decor(me).storage.some(s => s.uid === plant));
  // new things never reuse a number from the second room
  act(me, { action: "decorBuy", item: "chair" });
  const uids = [...decor(me).storage, ...decor(me).room, ...decor(me).room2].map(t => t.uid);
  assert.equal(new Set(uids).size, uids.length);
  // another family still has one room; an odd saved value is one room, never a crash
  assert.equal(hs.view(state, "home-2", me, now).decor.second, false);
  for (const bad of [null, 1, "yes", {}, []]) { state.homesteads["home-1"].secondRoom = bad; assert.equal(decor(me).second, false); assert.equal(decor(me).room2, undefined); }
  state.homesteads["home-1"].secondRoom = true; state.homesteads["home-1"].rooms2 = "junk";
  assert.deepEqual(decor(me).room2, []);
  // the shared shapes: the first room gets the doorway (bigger or not), the second room's door leads back
  const D = require("../shared/decor");
  assert.equal(D.roomFor(false, true).way[0], 7); assert.equal(D.roomFor(true, true).d, 11); assert.equal(D.roomFor(true, true).way[0], 7);
  assert.equal(D.roomFor(true, true, 2), D.ROOM2); assert.equal(D.ROOM2.back, true); assert.equal(D.ROOM2.d, 7); assert.equal(D.roomFor(true).way, undefined);
});
