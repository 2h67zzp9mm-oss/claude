"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");

const START = new Date("2026-10-01T12:00:00").getTime();

function makeState(ids = Object.keys(life.profiles)) {
  const state = { residents: ids.map(id => ({ id, name: id, needs: { energy: 80, hunger: 80, social: 80, fun: 80 }, memories: [], relationships: {}, place: "square" })) };
  life.hydrateLifeState(state, START);
  return state;
}

test("background histories are age-appropriate and promotions never repeat", () => {
  for (const id of Object.keys(life.profiles)) {
    const history = life.buildHistory(id);
    assert.strictEqual(history.length, life.historyYearsFor(id) * 3, `${id} history length`);
    const moves = history.filter(event => event.type === "promotion" || event.type === "retirement").map(event => event.text);
    assert.strictEqual(new Set(moves).size, moves.length, `${id} has duplicate promotions: ${moves.join(" | ")}`);
    for (const event of history) {
      assert.ok(event.age >= 0, `${id} has pre-birth history`);
      if (event.age < 14) assert.ok(!/working as|coworker|customer|promotion/i.test(event.text), `${id} works as a child: ${event.text}`);
      assert.ok(!/\bthey had to\b/.test(event.text), `pronoun mismatch: ${event.text}`);
    }
  }
  assert.strictEqual(life.buildHistory("hazel").length, 21);
  assert.ok(!life.buildHistory("finn").some(event => event.type === "promotion" && /retired/.test(event.text)), "retirement is not a promotion");
});

test("history fact ids do not depend on the current calendar year", () => {
  assert.strictEqual(life.buildHistory("olive")[0].id, "olive-history-2016-0");
});

test("ages advance with time and birthdays are announced", () => {
  const state = makeState(["olive"]);
  const olive = state.residents[0];
  assert.strictEqual(olive.profile.age, 15);
  const texts = life.checkBirthdays(state, new Date("2027-04-12T09:00:00").getTime());
  assert.deepStrictEqual(texts, ["It's Olive's birthday. Olive is 16 today."]);
  assert.strictEqual(olive.profile.age, 16);
  assert.deepStrictEqual(life.checkBirthdays(state, new Date("2027-04-13T09:00:00").getTime()), []);
});

test("runtime promotions survive rehydration", () => {
  const state = makeState(["milo"]);
  const milo = state.residents[0];
  milo.career.progress = 99;
  let promoted = false;
  for (let i = 0; i < 200 && !promoted; i++) {
    life.runAutonomousExperience(state, milo, START + i * 60_000, true, mind.traitsFor("milo"));
    promoted = milo.career.rank > 0;
  }
  assert.ok(promoted, "Milo should get promoted");
  const title = milo.career.title;
  life.hydrateLifeState(state, START);
  life.hydrateLifeState(state, START);
  assert.strictEqual(milo.career.title, title);
  assert.ok(milo.career.rank >= 1);
});

test("long soak: goals stay readable, own history is never forgotten, moods move", () => {
  life.setRandom(seeded(42));
  try {
    const state = makeState();
    const moodLabels = new Set();
    for (let step = 0; step < 4000; step++) {
      const now = START + step * 30 * 60_000;
      for (const resident of state.residents) {
        life.runAutonomousExperience(state, resident, now, true, mind.traitsFor(resident.id));
        for (const [i, need] of ["hunger", "energy", "social", "fun"].entries()) resident.needs[need] = (step * (5 + i * 3) + resident.id.length * 13) % 100;
        life.tickMood(resident, 0.5, mind.traitsFor(resident.id).neuroticism);
        moodLabels.add(resident.mood.label);
      }
      const [a, b] = [state.residents[step % 7], state.residents[(step + 3) % 7]];
      life.shareKnowledge(a, b, now);
    }
    for (const resident of state.residents) {
      assert.ok(resident.goals.every(goal => goal.text.length < 80), `${resident.id} goal text grew: ${resident.goals.at(-1).text}`);
      assert.ok(resident.goals.length <= 9, `${resident.id} goals unbounded (${resident.goals.length})`);
      assert.ok(!resident.knowledge.some(fact => fact.subjectId === resident.id), "knowledge holds only learned facts");
      assert.strictEqual(resident.lifeHistory.length, life.historyYearsFor(resident.id) * 3);
      assert.ok(resident.mood.valence < 99, `${resident.id} mood pinned at max`);
      if (resident.career.kind === "retired") assert.strictEqual(resident.career.progress, 0, "retired residents don't accrue career progress");
    }
    assert.ok(moodLabels.size >= 3, `moods should vary, saw ${[...moodLabels]}`);
  } finally {
    life.setRandom(Math.random);
  }
});

test("offline experiences are spread across the outage", () => {
  const state = makeState(["nova"]);
  const now = START + 48 * 3_600_000;
  const count = life.runOfflineLife(state, 48, now);
  assert.strictEqual(count, 6);
  const times = state.residents[0].experiences.map(e => e.at).sort();
  assert.ok(times[times.length - 1] - times[0] > 30 * 3_600_000, "events should span most of the outage");
  assert.ok(state.residents[0].autonomy.nextEventAt > now, "next live event is scheduled after now");
});

test("migrating 0.3 knowledge drops self facts and stale history, keeps learned facts in sync", () => {
  const state = makeState(["olive", "hazel"]);
  const [olive, hazel] = state.residents;
  hazel.knowledge.push({ factId: "hazel-history-2019-0", subjectId: "hazel", text: "self", learnedFrom: "self" });
  olive.knowledge.push({ factId: "hazel-history-1900-0", subjectId: "hazel", text: "stale", learnedFrom: "hazel" });
  olive.knowledge.push({ factId: "hazel-history-2020-1", subjectId: "hazel", text: "old wording", learnedFrom: "hazel" });
  life.hydrateLifeState(state, START);
  assert.strictEqual(hazel.knowledge.length, 0);
  assert.ok(!olive.knowledge.some(f => f.factId === "hazel-history-1900-0"));
  const synced = olive.knowledge.find(f => f.factId === "hazel-history-2020-1");
  assert.strictEqual(synced.text, hazel.lifeHistory.find(e => e.id === "hazel-history-2020-1").text);
});

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

module.exports = { seeded };

test("a life moment shows for a while, then leaves what they were doing to come back", () => {
  const now = Date.now();
  const state = { residents: Object.keys(life.profiles).map(id => ({ id, name: life.profiles[id].name, place: "cafe", activity: "running the cafe counter", memories: [], relationships: {}, needs: { energy: 80, hunger: 80, social: 70, fun: 70 } })) };
  life.hydrateLifeState(state, now);
  const milo = state.residents.find(r => r.id === "milo");
  milo.activity = "running the cafe counter";
  life.runAutonomousExperience(state, milo, now, true);
  assert.notStrictEqual(milo.activity, "running the cafe counter");
  assert.strictEqual(milo.activityAfter, "running the cafe counter", "remembers the shift");
  assert.ok(milo.activityUntil > now);
  life.runAutonomousExperience(state, milo, now + 1000, true);
  assert.strictEqual(milo.activityAfter, "running the cafe counter", "a second moment doesn't forget it");
});

