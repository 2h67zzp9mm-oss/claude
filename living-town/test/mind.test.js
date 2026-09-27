"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");
const { places } = require("../shared/world");

function town(at) {
  const state = {
    residents: Object.keys(life.profiles).map((id, i) => ({
      id, name: life.profiles[id].name, x: 470 + i * 3, y: 520, targetX: 470, targetY: 520, place: "homes",
      needs: { energy: 80, hunger: 80, social: 70, fun: 70 }, memories: [], relationships: {}, lastTalk: 0
    }))
  };
  for (const r of state.residents) for (const o of state.residents) if (o !== r) r.relationships[o.id] = 30;
  life.hydrateLifeState(state, at);
  state.residents.forEach(mind.ensureMind);
  mind.seedFamilyBonds(state);
  return state;
}

function choices(state, date) {
  return Object.fromEntries(state.residents.map(r => {
    r.mind.commitUntil = 0;
    const dest = mind.decide(state, r, date) || r.place;
    return [r.id, { dest, why: r.intent }];
  }));
}

test("a weekday morning looks different for each resident", () => {
  const date = new Date("2026-10-07T08:30:00"); // Wednesday
  const picks = choices(town(date.getTime()), date);
  assert.strictEqual(picks.olive.dest, "square", "Olive is at school");
  assert.strictEqual(picks.hazel.dest, "square", "Hazel is at school");
  assert.strictEqual(picks.milo.dest, "cafe", "Milo runs the cafe");
  assert.strictEqual(picks.dad.dest, "workshop", "Sean is at work");
  assert.strictEqual(picks.nova.dest, "homes", "Nova is still asleep at 8:30");
  assert.ok(new Set(Object.values(picks).map(p => p.dest)).size >= 4, "residents spread across town");
});

test("sleep schedules differ", () => {
  const late = new Date("2026-10-07T21:30:00");
  assert.ok(mind.isAsleepTime("hazel", late));
  assert.ok(mind.isAsleepTime("finn", late));
  assert.ok(!mind.isAsleepTime("nova", late));
  assert.ok(!mind.isAsleepTime("zara", late));
  assert.ok(mind.isAsleepTime("nova", new Date("2026-10-08T01:00:00")));
});

test("free time follows personality and interests", () => {
  const date = new Date("2026-10-10T15:00:00"); // Saturday afternoon
  const tally = {};
  for (let run = 0; run < 60; run++) {
    const picks = choices(town(date.getTime()), date);
    for (const [id, { dest }] of Object.entries(picks)) {
      tally[id] = tally[id] || {};
      tally[id][dest] = (tally[id][dest] || 0) + 1;
    }
  }
  const favourite = id => Object.entries(tally[id]).sort((a, b) => b[1] - a[1])[0][0];
  assert.strictEqual(favourite("hazel"), "park", `Hazel: ${JSON.stringify(tally.hazel)}`);
  assert.ok(["park", "workshop"].includes(favourite("finn")), `Finn (birds, craft): ${JSON.stringify(tally.finn)}`);
  assert.ok(["square", "cafe", "market"].includes(favourite("milo")), `Milo (people, food): ${JSON.stringify(tally.milo)}`);
});

test("hunger overrides preference, and the reason says so", () => {
  const date = new Date("2026-10-10T15:00:00");
  const state = town(date.getTime());
  const finn = state.residents.find(r => r.id === "finn");
  finn.needs.hunger = 5;
  const picks = choices(state, date);
  assert.ok(["cafe", "market"].includes(picks.finn.dest));
  assert.strictEqual(picks.finn.why, "hungry");
});

test("residents commit to a plan instead of re-deciding every tick", () => {
  const date = new Date("2026-10-10T15:00:00");
  const state = town(date.getTime());
  const zara = state.residents.find(r => r.id === "zara");
  zara.mind.commitUntil = 0;
  mind.decide(state, zara, date);
  assert.ok(zara.mind.commitUntil > date.getTime() + 20 * 60_000);
  assert.strictEqual(mind.decide(state, zara, new Date(date.getTime() + 60_000)), null);
});

test("activities reflect interests", () => {
  const hazel = { id: "hazel" };
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(mind.pickActivity(hazel, "park", null));
  assert.ok([...seen].some(text => /ducks|ball|hedges|oak/.test(text)));
  assert.ok(Object.keys(places).every(key => mind.pickActivity({ id: "finn" }, key, null)));
});

test("conversations use each resident's voice and change relationships", () => {
  const now = new Date("2026-10-10T15:00:00").getTime();
  const state = town(now);
  const hazel = state.residents.find(r => r.id === "hazel");
  const finn = state.residents.find(r => r.id === "finn");
  const before = hazel.relationships.finn;
  const result = mind.converse(hazel, finn, now, "Juniper Park");
  assert.ok(hazel.speech.text && finn.speech.text);
  assert.ok(result.event.includes("Juniper Park"));
  assert.notStrictEqual(hazel.relationships.finn, before);
  assert.strictEqual(hazel.memories[0].type, "conversation");
  assert.strictEqual(mind.firstPerson("Milo", "At Moonbeam Cafe, Milo spent time with Zara, their spouse."), "At Moonbeam Cafe, I spent time with Zara, my spouse");
});

test("compatibility differs between pairs", () => {
  const a = mind.compatibility({ id: "hazel" }, { id: "finn" });
  const b = mind.compatibility({ id: "zara" }, { id: "nova" });
  assert.ok(b > a, "Zara and Nova are more alike than Hazel and Finn");
});

test("walkway routes stay on the paths and every family has its own door", () => {
  const world = require("../shared/world");
  const path = world.route(world.places.park.x, world.places.park.y, world.places.market.x, world.places.market.y);
  assert.ok(path.length > 3, "long trips follow several walkway segments");
  for (const point of path.slice(0, -1)) {
    assert.ok(Object.values(world.walkNodes).some(([x, y]) => x === point.x && y === point.y), "intermediate points are walkway nodes");
  }
  assert.notDeepStrictEqual(world.spotFor("finn", "homes"), world.spotFor("dad", "homes"));
  assert.deepStrictEqual(world.spotFor("olive", "homes"), world.spotFor("hazel", "homes"));
  const onRoof = world.snapToWalkable(560, 440); // the middle of the houses' roofs
  assert.ok(Math.hypot(onRoof.x - 560, onRoof.y - 440) > 5, "roof taps are pulled onto a path");
});

test("every home, the cafe, the workshop and the market have floor plans that fit together", () => {
  const world = require("../shared/world");
  const interiors = require("../shared/interiors");
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const id of ["cafe", "workshop", "market"]) assert.ok(interiors.planFor(id) && world.buildings.find(b => b.id === id), `${id} has an inside`);
  for (const id of ["seanHouse", "miloHouse", "roseCottage"]) assert.strictEqual(interiors.planFor(id).floors.length, 2, `${id} has an upstairs`);
  for (const b of world.buildings.filter(item => interiors.planFor(item.id))) {
    const plan = interiors.planFor(b.id);
    const objects = interiors.allObjects(plan);
    assert.ok(plan.floors.reduce((n, f) => n + f.rooms.length, 0) >= 3, `${b.id} has several rooms`);
    if (b.residents) assert.ok(objects.filter(o => o.kind === "bed").length >= 2, `${b.id} has beds`);
    for (const [, objectId] of plan.activities || []) assert.ok(objects.some(o => o.id === objectId), `${b.id} activity goes to ${objectId}`);
    const ids = new Set();
    for (const o of objects) {
      assert.ok(!ids.has(o.id) && o.id.length <= 20, `${b.id} ${o.id} has a short id, unique across floors`);
      ids.add(o.id);
      assert.ok(interiors.furniture[o.kind], `${o.kind} has an effect`);
    }
    for (const floor of plan.floors) {
      const where = `${b.id} floor ${floor.floor}`;
      for (const o of floor.objects) {
        assert.strictEqual(o.floor, floor.floor);
        assert.ok(o.x >= 0 && o.y >= 0 && o.x + o.w <= floor.width && o.y + o.h <= floor.height, `${where} ${o.id} inside the house`);
        for (const [x, y] of [o.spot, ...(o.seats || []), ...(o.staff ? [o.staff] : [])]) assert.ok(interiors.isWalkable(floor, x, y), `${where} ${o.id} can be reached at ${x},${y}`);
      }
      // Nothing blocks a doorway, the front door or the stairs.
      const front = interiors.frontDoorRect(floor);
      for (const d of [...floor.doors, ...(front ? [front] : []), ...(floor.stairs ? [floor.stairs] : [])]) {
        for (const o of [...floor.objects, ...floor.decor]) assert.ok(!overlaps(o, d), `${where}: ${o.id || o.kind} blocks a way through`);
      }
      if (floor.stairs) {
        assert.ok(interiors.isWalkable(floor, ...floor.stairs.spot), `${where}: the stairs can be reached`);
        assert.ok(plan.floors[floor.stairs.to]?.stairs, `${where}: the stairs lead somewhere`);
      }
      assert.strictEqual(Boolean(floor.frontDoor), floor.floor === 0, `${where}: the front door is downstairs`);
      // Every room on every floor can be reached from the front door without leaving the floor.
      for (const r of floor.rooms) {
        const f = interiors.floorOf(r);
        const start = { x: plan.entrance[0], y: plan.entrance[1], floor: 0 };
        const goal = { x: f.x + f.w / 2, y: f.y + f.h / 2, floor: floor.floor };
        const points = [start, ...interiors.routeInside(plan, start, goal)];
        assert.strictEqual(points[points.length - 1].floor, floor.floor, `${where}: the way to ${r.name} ends on the right floor`);
        for (let i = 1; i < points.length; i++) {
          if (points[i].floor !== points[i - 1].floor) continue; // up or down the stairs
          const on = plan.floors[points[i].floor];
          for (let t = 0; t <= 1; t += 0.05) {
            const x = points[i - 1].x + (points[i].x - points[i - 1].x) * t, y = points[i - 1].y + (points[i].y - points[i - 1].y) * t;
            assert.ok(interiors.isWalkable(on, x, y), `${where}: the way to ${r.name} stays on the floor (${x.toFixed(0)},${y.toFixed(0)})`);
          }
        }
      }
    }
  }
});

test("at home, everyone sleeps in their own bed and goes to the right furniture", () => {
  const interiors = require("../shared/interiors");
  const sean = interiors.planFor("seanHouse");
  const household = ["dad", "olive", "hazel"];
  const beds = interiors.assignBeds(sean, household);
  assert.strictEqual(new Set(household.map(id => beds.get(id).bed.id)).size, 3, "three different beds");
  const oliveRoom = sean.floors[1].rooms.find(r => r.name === "Olive's room");
  const oliveBed = beds.get("olive").bed;
  assert.strictEqual(oliveBed.floor, 1, "bedrooms are upstairs");
  assert.ok(oliveBed.x >= oliveRoom.x && oliveBed.x < oliveRoom.x + oliveRoom.w, "Olive's bed is in Olive's room");

  const placed = interiors.placeHousehold(sean, [
    { id: "dad", asleep: false, activity: "playing an old game" },
    { id: "olive", asleep: true, activity: "asleep" },
    { id: "hazel", asleep: false, activity: "having family time" }
  ], household);
  assert.strictEqual(placed.get("olive").bed, oliveBed);
  assert.strictEqual(placed.get("olive").floor, 1, "asleep upstairs");
  const all = interiors.allObjects(sean);
  assert.strictEqual(all.find(o => o.id === placed.get("dad").objectId).kind, "tv");
  assert.strictEqual(all.find(o => o.id === placed.get("hazel").objectId).kind, "table");
  assert.strictEqual(placed.get("hazel").floor, 0, "family time downstairs");

  // Milo and Zara share a double bed; a visitor gets a spare one.
  const milo = interiors.planFor("miloHouse");
  const shared = interiors.assignBeds(milo, ["milo", "zara", "nova"]);
  assert.strictEqual(shared.get("milo").bed, shared.get("zara").bed);
  assert.notStrictEqual(shared.get("milo").slot, shared.get("zara").slot);
  const finn = interiors.assignBeds(interiors.planFor("finnCottage"), ["finn", "guest"]);
  assert.notStrictEqual(finn.get("finn").bed, finn.get("guest").bed);

  // Same inputs, same scene, on every phone.
  const again = interiors.placeHousehold(sean, [{ id: "hazel", asleep: false, activity: "having family time" }], household);
  assert.deepStrictEqual(again.get("hazel"), interiors.placeHousehold(sean, [{ id: "hazel", asleep: false, activity: "having family time" }], household).get("hazel"));
});

test("at work, staff stand behind the counter, and only indoor activities happen inside", () => {
  const interiors = require("../shared/interiors");
  const cafe = interiors.planFor("cafe");
  const placed = interiors.placeHousehold(cafe, [
    { id: "milo", activity: "running the cafe counter" },
    { id: "zara", activity: "sketching in a corner booth" },
    { id: "olive", activity: "trying today's special" }
  ], []);
  assert.deepStrictEqual([placed.get("milo").x, placed.get("milo").y], cafe.objects.find(o => o.id === "counter").staff);
  assert.strictEqual(placed.get("zara").objectId, "booth");
  assert.strictEqual(placed.get("olive").objectId, "cakes");
  assert.ok(interiors.indoorActivity(cafe, "running the cafe counter"));
  assert.ok(!interiors.indoorActivity(cafe, "trading news over coffee"), "some people stay out on the terrace");
  assert.ok(interiors.indoorActivity(interiors.planFor("workshop"), "wiring up a client's control panel"));
  assert.ok(!interiors.indoorActivity(interiors.planFor("market"), "browsing the stalls"), "the stalls are outside");
  assert.ok(interiors.indoorActivity(interiors.planFor("seanHouse"), "anything at all"), "at home, everyone is inside");
});

test("nobody is ever in two places at once", () => {
  const world = require("../shared/world");
  const interiors = require("../shared/interiors");
  const ids = ["dad", "olive", "hazel", "milo", "zara", "finn", "nova"];
  const placeKeys = [...Object.keys(world.places), null];
  const acts = ["running the cafe counter", "trading news over coffee", "browsing the stalls", "working the market floor", "wiring up a client's control panel", "working on a small project", "resting at home", "walking to the park"];
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pickOne = list => list[Math.floor(rand() * list.length)];
  for (let round = 0; round < 3000; round++) {
    const r = { id: pickOne(ids), place: pickOne(placeKeys), activity: pickOne(acts), x: 0, y: 0, indoor: rand() < 0.2 ? { x: 40, y: 40 } : null };
    // Somewhere on the map, sometimes exactly at a door, sometimes still walking.
    const node = world.walkNodes[pickOne(Object.keys(world.walkNodes))];
    r.x = rand() < 0.5 ? node[0] : 20 + rand() * 900;
    r.y = rand() < 0.5 ? node[1] : 20 + rand() * 600;
    const walking = rand() < 0.3;
    r.targetX = walking ? r.x + 50 : r.x;
    r.targetY = r.y;
    const where = interiors.locate(r, world);
    const insideOf = world.buildings.filter(b => interiors.planFor(b.id) && where?.id === b.id);
    assert.ok(insideOf.length <= 1, "inside at most one building");
    if (walking) assert.strictEqual(where, null, "anyone walking is out on the map");
    if (where?.residents) assert.strictEqual(world.homeOf(r.id).id, where.id, "only ever inside your own home");
    if (where && !where.residents) assert.strictEqual(where.place, r.place, "inside the building for the place you're at");
  }
});

test("small things around the house can be used too", () => {
  const interiors = require("../shared/interiors");
  const kinds = new Set(Object.values(interiors.plans).flatMap(p => interiors.allObjects(p).map(o => o.kind)));
  for (const kind of ["bed", "sink", "chair", "counter", "fridge", "window", "plant", "wardrobe", "fruit", "bath"]) assert.ok(kinds.has(kind), `${kind} is usable`);
  for (const [kind, f] of Object.entries(interiors.furniture)) {
    assert.ok(f.label && f.activity, kind);
    assert.ok(Object.keys(f.needs).every(n => ["energy", "hunger", "social", "fun"].includes(n)), `${kind} only boosts real needs`);
  }
});
