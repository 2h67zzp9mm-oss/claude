"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");
const { createMrE, normalizePlan, isSafe, clean } = require("../lib/mre");
const world = require("../shared/world");

function town(now) {
  const state = {
    events: [], eventId: 1,
    residents: Object.keys(life.profiles).filter(id => !life.profiles[id].custom).map(id => ({
      id, name: life.profiles[id].name, x: 477, y: 330, place: "square", needs: { energy: 80, hunger: 80, social: 70, fun: 70 },
      memories: [], relationships: {}, lastTalk: 0, asleep: false
    }))
  };
  life.hydrateLifeState(state, now);
  state.residents.forEach(mind.ensureMind);
  return state;
}

function helpers(state) {
  return {
    addEvent: (text, at, by) => state.events.unshift({ id: state.eventId++, at, text, by }),
    placeName: r => world.places[r.place]?.name || "town",
    spotFor: (id, key) => world.spotFor(id, key)
  };
}

test("safety filter blocks unsafe words but allows gentle ones", () => {
  assert.ok(isSafe("What a lovely sunny day at the park!"));
  for (const bad of ["a scary monster", "I hate you", "a kiss", "free money", "visit www.example.com", "the fire spread"]) assert.ok(!isSafe(bad), bad);
  assert.strictEqual(clean("x".repeat(200), 140), null);
  assert.strictEqual(clean("  hi\u0000 there  ", 20), "hi there");
});

test("plans are validated: unknown types rejected, bad ids and places replaced", () => {
  const state = town(Date.now());
  assert.strictEqual(normalizePlan({ type: "explode" }, state, Date.now()), null);
  const plan = normalizePlan({ type: "friends", residentId: "nobody", otherResidentId: "nobody", place: "moon", announcement: "a scary thing" }, state, Date.now());
  assert.ok(plan.resident && plan.other && plan.resident !== plan.other);
  assert.ok(world.places[plan.place]);
  assert.strictEqual(plan.announcement, null, "unsafe AI text is dropped for a template");
});

test("AI proposals are used when valid, templates when not, built-ins when offline", async () => {
  const state = town(Date.now());
  const good = async () => ({ type: "festival", place: "park", title: "lantern walk", announcement: "Lanterns glow at the park tonight... come and see!" });
  good.label = "local AI (test)";
  const mrE = createMrE({ generate: good, log: { warn() {}, error() {} } });
  const said = await mrE.surprise(state, helpers(state));
  assert.strictEqual(said, "Lanterns glow at the park tonight... come and see!");
  assert.ok(state.effects.some(e => e.place === "park" && e.reason === "lantern walk"));
  assert.ok(state.events[0].by === "mre" && state.mre.visit);

  const unsafe = async () => ({ type: "gift", residentId: "hazel", item: "a knife", announcement: "Here is a knife!" });
  const state2 = town(Date.now());
  const said2 = await createMrE({ generate: unsafe, log: { warn() {}, error() {} } }).surprise(state2, helpers(state2));
  assert.ok(!/knife/.test(said2) && !/knife/.test(JSON.stringify(state2.residents.find(r => r.id === "hazel").experiences)));

  const offline = async () => { throw new Error("connect ECONNREFUSED"); };
  const state3 = town(Date.now());
  const mrE3 = createMrE({ generate: offline, log: { warn() {}, error() {} } });
  assert.ok(await mrE3.surprise(state3, helpers(state3)));
  assert.match(mrE3.brain, /built-in/);
});

test("happenings pull residents and explain why", () => {
  const now = new Date("2026-10-10T15:00:00").getTime();
  const state = town(now);
  state.effects = [{ kind: "happening", place: "market", pull: 6, until: now + 3_600_000, reason: "bubble parade" }];
  const zara = state.residents.find(r => r.id === "zara");
  zara.mind.commitUntil = 0;
  assert.strictEqual(mind.decide(state, zara, new Date(now)), "market");
  assert.strictEqual(zara.intent, "bubble parade");
});

test("lost items get found and returned later", async () => {
  const state = town(Date.now());
  const gen = async () => ({ type: "lost_item", residentId: "olive", item: "a red mitten", announcement: "Oh! Olive dropped a red mitten somewhere..." });
  const mrE = createMrE({ generate: gen, log: { warn() {}, error() {} } });
  await mrE.surprise(state, helpers(state));
  assert.strictEqual(state.mre.pending.length, 1);
  mrE.tick(state, state.mre.pending[0].at + 1, helpers(state));
  assert.ok(state.events.some(e => /found Olive's missing red mitten/.test(e.text)));
});

test("filter allows harmless look-alikes and blocks real matches with endings", () => {
  for (const ok of ["hello friends", "a warm breeze", "a robin sings", "a healthy diet", "a cozy campfire", "a scarecrow parade", "lovely"]) assert.ok(isSafe(ok), ok);
  for (const bad of ["the fish died", "monsters!", "burning bright", "she loved it", "crying", "http://x"]) assert.ok(!isSafe(bad), bad);
});

test("if the AI's resident or place has to be swapped, its announcement is not used", async () => {
  const state = town(Date.now());
  state.residents.find(r => r.id === "olive").asleep = true;
  const gen = async () => ({ type: "gift", residentId: "olive", item: "a marble", announcement: "Psst, Olive... a gift for you!" });
  const said = await createMrE({ generate: gen, log: { warn() {}, error() {} } }).surprise(state, helpers(state));
  const receiver = state.residents.find(r => (r.experiences || []).some(e => /surprise from Mr. E/.test(e.text)));
  assert.notStrictEqual(receiver.id, "olive");
  assert.ok(said.includes(receiver.name) && !said.includes("Olive"), said);
});

test("surprises never fail just because it's already raining", async () => {
  for (let i = 0; i < 25; i++) {
    const state = town(Date.now());
    state.effects = [{ kind: "weather", weather: "rain", until: Date.now() + 3_600_000, pulls: {} }];
    state.mre = { recent: ["gift", "note", "festival"] };
    assert.ok(await createMrE({ log: { warn() {}, error() {} } }).surprise(state, helpers(state)), `attempt ${i}`);
  }
});
