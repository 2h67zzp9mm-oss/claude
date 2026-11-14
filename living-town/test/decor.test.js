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
    assert.ok(d.rare ? d.price >= 150 : d.price >= 10 && d.price <= 120, `${d.id} costs ${d.price}`);
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
