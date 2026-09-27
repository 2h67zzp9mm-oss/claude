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

test("every home has a floor plan whose rooms, furniture and spots fit together", () => {
  const world = require("../shared/world");
  const interiors = require("../shared/interiors");
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const b of world.homeBuildings) {
    const plan = interiors.planFor(b.id);
    assert.ok(plan, b.id);
    assert.ok(plan.rooms.length >= 3, `${b.id} has several rooms`);
    assert.ok(plan.objects.filter(o => o.kind === "bed").length >= 2, `${b.id} has beds`);
    const ids = new Set();
    for (const o of plan.objects) {
      assert.ok(!ids.has(o.id) && o.id.length <= 20, `${b.id} ${o.id} has a short, unique id`);
      ids.add(o.id);
      assert.ok(o.x >= 0 && o.y >= 0 && o.x + o.w <= plan.width && o.y + o.h <= plan.height, `${b.id} ${o.id} inside the house`);
      assert.ok(interiors.furniture[o.kind], `${o.kind} has an effect`);
      for (const [x, y] of [o.spot, ...(o.seats || [])]) assert.ok(interiors.isWalkable(plan, x, y), `${b.id} ${o.id} can be reached at ${x},${y}`);
    }
    // Nothing blocks a doorway or the front door.
    for (const d of [...plan.doors, interiors.frontDoorRect(plan)]) {
      for (const o of [...plan.objects, ...plan.decor]) assert.ok(!overlaps(o, d), `${b.id}: ${o.id || o.kind} blocks a door`);
    }
    // Every room can be reached from the front door without leaving the floor.
    for (const r of plan.rooms) {
      const f = interiors.floorOf(r);
      const goal = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
      const points = [{ x: plan.entrance[0], y: plan.entrance[1] }, ...interiors.routeInside(plan, { x: plan.entrance[0], y: plan.entrance[1] }, goal)];
      for (let i = 1; i < points.length; i++) {
        for (let t = 0; t <= 1; t += 0.05) {
          const x = points[i - 1].x + (points[i].x - points[i - 1].x) * t, y = points[i - 1].y + (points[i].y - points[i - 1].y) * t;
          assert.ok(interiors.isWalkable(plan, x, y), `${b.id}: the way to ${r.name} stays on the floor (${x.toFixed(0)},${y.toFixed(0)})`);
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
  const oliveRoom = sean.rooms.find(r => r.name === "Olive's room");
  const oliveBed = beds.get("olive").bed;
  assert.ok(oliveBed.x >= oliveRoom.x && oliveBed.x < oliveRoom.x + oliveRoom.w, "Olive's bed is in Olive's room");

  const placed = interiors.placeHousehold(sean, [
    { id: "dad", asleep: false, activity: "playing an old game" },
    { id: "olive", asleep: true, activity: "asleep" },
    { id: "hazel", asleep: false, activity: "having family time" }
  ], household);
  assert.strictEqual(placed.get("olive").bed, oliveBed);
  assert.strictEqual(sean.objects.find(o => o.id === placed.get("dad").objectId).kind, "tv");
  assert.strictEqual(sean.objects.find(o => o.id === placed.get("hazel").objectId).kind, "table");

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

test("small things around the house can be used too", () => {
  const interiors = require("../shared/interiors");
  const kinds = new Set(Object.values(interiors.plans).flatMap(p => p.objects.map(o => o.kind)));
  for (const kind of ["bed", "sink", "chair", "counter", "fridge", "window", "plant", "wardrobe", "fruit"]) assert.ok(kinds.has(kind), `${kind} is usable`);
  for (const [kind, f] of Object.entries(interiors.furniture)) {
    assert.ok(f.label && f.activity, kind);
    assert.ok(Object.keys(f.needs).every(n => ["energy", "hunger", "social", "fun"].includes(n)), `${kind} only boosts real needs`);
  }
});
