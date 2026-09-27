"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");
const { createMrE, normalizePlan, assessTown, isSafe, clean } = require("../lib/mre");
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
  const receiver = state.residents.find(r => (r.experiences || []).some(e => /mysterious surprise/.test(e.text)));
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

test("meet-ups bump both residents' revisions so phones get the new friendship", async () => {
  const state = town(Date.now());
  const olive = state.residents.find(r => r.id === "olive"), finn = state.residents.find(r => r.id === "finn");
  const before = [olive.lifeRevision, finn.lifeRevision];
  const gen = async () => ({ type: "friends", residentId: "olive", otherResidentId: "finn", place: "park", announcement: "Olive and Finn, meet me at the park..." });
  await createMrE({ generate: gen, log: { warn() {}, error() {} } }).surprise(state, helpers(state));
  assert.ok(olive.lifeRevision > before[0] && finn.lifeRevision > before[1]);
});

test("the brain label reflects whether the local AI is really available", async () => {
  const gen = async () => ({});
  gen.label = "local AI (test)";
  gen.check = async () => "built-in storyteller (AI offline)";
  const mrE = createMrE({ generate: gen, log: { warn() {}, error() {} } });
  assert.match(mrE.brain, /checking/);
  await mrE.checkBrain();
  assert.strictEqual(mrE.brain, "built-in storyteller (AI offline)");
});

const quiet = { warn() {}, error() {} };
const settle = () => new Promise(resolve => setImmediate(resolve));

test("Mr. E is always out strolling the walkways, day and night", () => {
  for (const time of ["2026-10-10T11:00:00", "2026-10-10T23:30:00"]) {
    const start = new Date(time).getTime();
    const state = town(start);
    state.residents.forEach(r => { r.lastTalk = start; });
    const mrE = createMrE({ log: quiet });
    mrE.tick(state, start, helpers(state));
    const first = mrE.publicView(state, start);
    assert.ok(Number.isFinite(first.x) && Number.isFinite(first.y), "visible from the first tick");
    const seen = new Set();
    for (let s = 1; s <= 600; s++) {
      state.residents.forEach(r => { r.lastTalk = start + s * 1000; });
      mrE.tick(state, start + s * 1000, helpers(state));
      const view = mrE.publicView(state, start + s * 1000);
      assert.ok(view.x >= 0 && view.y >= 0 && view.x <= world.MAP.width && view.y <= world.MAP.height);
      if (view.watching) seen.add(view.watching);
    }
    const last = mrE.publicView(state, start + 600_000);
    assert.ok(Math.hypot(last.x - first.x, last.y - first.y) > 5 || seen.size > 1, `he moves around (${time})`);
    assert.ok(!state.events.some(e => e.by === "mre"), "a busy town gets no surprise");
  }
});

test("residents never see Mr. E: he is not one of them and their memories never name him", async () => {
  const state = town(Date.now());
  for (const type of ["gift", "note", "lost_item", "friends"]) {
    const gen = async () => ({ type, residentId: "hazel", otherResidentId: "finn", place: "park", item: "a shiny marble", announcement: "Something curious for you..." });
    await createMrE({ generate: gen, log: quiet }).surprise(state, helpers(state));
  }
  assert.ok(!state.residents.some(r => /mr\.? ?e/i.test(r.id) || /Mr\. E/.test(r.name)));
  for (const r of state.residents) {
    for (const list of [r.experiences, r.memories, r.knowledge]) assert.ok(!/Mr\. E/.test(JSON.stringify(list || [])), `${r.name} never names him`);
  }
  assert.ok(state.residents.find(r => r.id === "hazel").experiences.some(e => /mysterious/.test(e.text)));
  // His walk is not an effect, so it can't pull or push anyone.
  assert.ok(!(state.effects || []).some(e => e.kind === "walker" || e.x !== undefined));
});

test("when the town goes quiet, Mr. E makes something happen", async () => {
  const start = new Date("2026-10-10T11:00:00").getTime();
  const state = town(start);
  const mrE = createMrE({ log: quiet });
  mrE.tick(state, start, helpers(state));
  mrE.tick(state, start + 7 * 60_000, helpers(state));
  await settle();
  assert.ok(!state.events.some(e => e.by === "mre"), "he waits a little first");
  mrE.tick(state, start + 8 * 60_000 + 1000, helpers(state));
  await settle();
  assert.ok(state.events.some(e => e.by === "mre"), "then he steps in");
  assert.ok(mrE.publicView(state, start + 8 * 60_000 + 2000).text, "and he's shown saying it");

  // No more than one surprise per 20 minutes, even if it stays quiet.
  const count = () => state.events.filter(e => e.by === "mre").length;
  state.effects = [];
  for (let m = 9; m < 28; m++) { mrE.tick(state, start + m * 60_000, helpers(state)); await settle(); }
  assert.strictEqual(count(), 1);
});

test("Mr. E leaves a lively town alone, and never stirs things up at night", async () => {
  const day = new Date("2026-10-10T11:00:00").getTime();
  const busyTown = town(day);
  const mrE = createMrE({ log: quiet });
  for (let m = 0; m <= 30; m++) {
    busyTown.residents.slice(0, 2).forEach(r => { r.lastTalk = day + m * 60_000; });
    mrE.tick(busyTown, day + m * 60_000, helpers(busyTown));
    await settle();
  }
  assert.ok(!busyTown.events.some(e => e.by === "mre"));

  const night = new Date("2026-10-10T22:30:00").getTime();
  const sleepy = town(night);
  const mrE2 = createMrE({ log: quiet });
  for (let m = 0; m <= 30; m++) { mrE2.tick(sleepy, night + m * 60_000, helpers(sleepy)); await settle(); }
  assert.ok(!sleepy.events.some(e => e.by === "mre"));
});

test("a quiet-town check spots who is on their own", () => {
  const now = new Date("2026-10-10T11:00:00").getTime();
  const state = town(now);
  const olive = state.residents.find(r => r.id === "olive");
  olive.place = "park";
  const report = assessTown(state, now);
  assert.ok(report.quiet);
  assert.strictEqual(report.lonely[0].id, "olive");

  // Sisters at home together aren't lonely; Finn alone in his cottage is.
  for (const r of state.residents) { r.place = "homes"; r.needs.fun = 80; r.needs.social = 80; }
  const lonely = assessTown(state, now).lonely.map(r => r.id);
  assert.ok(!lonely.includes("olive") && !lonely.includes("hazel") && lonely.includes("finn"), JSON.stringify(lonely));
});
