"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");
const will = require("../lib/will");
const { isSafe } = require("../lib/mre");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient } = require("./helpers");

test.after(cleanup);

const NOW = new Date("2026-10-10T11:00:00").getTime();

function town(now = NOW) {
  const state = {
    events: [],
    residents: Object.keys(life.profiles).filter(id => !life.profiles[id].custom).map(id => ({
      id, name: life.profiles[id].name, x: 240, y: 105, targetX: 240, targetY: 105, place: "park", path: [],
      needs: { energy: 80, hunger: 80, social: 70, fun: 70 }, memories: [], relationships: {}, lastTalk: 0, asleep: false
    }))
  };
  life.hydrateLifeState(state, now);
  state.residents.forEach(r => { mind.ensureMind(r); will.ensure(r); });
  for (const a of state.residents) for (const b of state.residents) if (a !== b) a.relationships[b.id] = 50;
  return state;
}

function context(state, overrides = {}) {
  let seed = 7;
  const moves = [];
  return {
    moves,
    mindFor: mind.mindFor, activities: mind.activities,
    random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    addEvent: text => state.events.push(text),
    isControlled: () => false,
    obligation: () => null,
    sameSpot: () => true,
    showOn: () => false, showToday: () => false, isPerformer: () => false,
    go(r, place, why) { moves.push([r.id, place, why]); r.place = place; return true; },
    ...overrides
  };
}

const byId = (state, id) => state.residents.find(r => r.id === id);

test("wishes come from who they are, are gentle, and there are never more than three", () => {
  const state = town();
  const ctx = context(state);
  for (let i = 0; i < 12; i++) {
    for (const r of state.residents) r.will.nextWishAt = 0;
    will.tick(state, NOW + i * 1000, ctx);
  }
  for (const r of state.residents) {
    assert.ok(r.wishes.length >= 1 && r.wishes.length <= will.MAX_WISHES, `${r.name} has 1–3 wishes`);
    assert.strictEqual(new Set(r.wishes.map(w => w.key)).size, r.wishes.length, "no duplicates");
    for (const w of r.wishes) {
      assert.ok(isSafe(w.text) && isSafe(w.reason), `gentle: ${w.text}`);
      assert.ok(w.emoji && w.until > NOW);
    }
  }
  // Every hobby activity turns into a wish that reads well.
  for (const options of Object.values(mind.activities)) for (const [tag, activity] of options) if (tag) assert.ok(will.imperative(activity), activity);
  const hazel = will.candidates(state, byId(state, "hazel"), NOW, ctx);
  assert.ok(hazel.some(w => w.text === "Watch the ducks at Juniper Park"), "Hazel wishes for ducks");
  assert.ok(!will.candidates(state, byId(state, "finn"), NOW, ctx).some(w => /ducks/.test(w.text)), "Finn doesn't");
});

test("a wish comes true: a lit-up moment, a happy feeling, the feed, and a fondness for the place", () => {
  const state = town();
  const ctx = context(state);
  const hazel = byId(state, "hazel");
  hazel.wishes = [{ type: "do", key: "do:park:ducks", place: "park", activity: "watching the ducks", emoji: "🦆", text: "Watch the ducks at Juniper Park", reason: "wants to watch the ducks", createdAt: NOW, until: NOW + 3_600_000 }];
  hazel.will.nextWishAt = NOW + 3_600_000;
  // Nobody whisks her off with an invitation mid-test.
  state.residents.forEach(r => { r.will.nextInviteAt = Infinity; });
  const valence = hazel.mood.valence;
  will.tick(state, NOW, ctx);
  assert.strictEqual(hazel.wishes.length, 1, "not after only a moment");
  will.tick(state, NOW + 4 * 60_000, ctx);
  assert.strictEqual(hazel.wishes.length, 0);
  assert.ok(state.events.some(e => /Hazel's wish came true: Watch the ducks/.test(e)));
  assert.match(hazel.speech.text, /wish came true/);
  assert.ok(hazel.feelings.some(f => f.emoji === "✨"));
  assert.ok(hazel.mood.valence > valence);
  assert.ok(hazel.placeAffinity.park > 0, "the park is a happy place now");
  assert.ok(will.placeBonus(hazel, "park", []).value > 0);
});

test("after a squabble, they wish to make up, and a friendly chat does it", () => {
  const state = town();
  const ctx = context(state);
  const zara = byId(state, "zara"), milo = byId(state, "milo");
  zara.memories.unshift({ at: NOW - 60_000, about: "milo", text: "Milo and I disagreed about the rules of a board game.", type: "conversation", tone: "friction" });
  const wish = will.candidates(state, zara, NOW, ctx).find(w => w.type === "makeup");
  assert.strictEqual(wish.with, "milo");
  zara.wishes = [{ ...wish, createdAt: NOW, until: NOW + 3_600_000 }];
  zara.will.nextWishAt = NOW + 3_600_000;
  assert.ok(will.placeBonus(zara, "cafe", ["milo"]).value > 0, "drawn to where Milo is");
  zara.memories.unshift({ at: NOW + 1000, about: "milo", text: "Milo and I talked.", type: "conversation", tone: "interest" });
  will.tick(state, NOW + 2000, ctx);
  assert.strictEqual(zara.wishes.length, 0);
  assert.ok(milo.feelings.some(f => /Made up with Zara/.test(f.text)));
});

test("choice: mostly the best, sometimes another good option, never a bad one; duties and emergencies win", () => {
  const results = [{ key: "park", score: 2 }, { key: "cafe", score: 1.9 }, { key: "market", score: 1.2 }];
  const r = { mood: { valence: 60 } };
  let seed = 3;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const counts = {};
  for (let i = 0; i < 400; i++) { const c = will.choose(results, r, { conscientiousness: 0.4 }, {}, random); counts[c.key] = (counts[c.key] || 0) + 1; }
  assert.ok(counts.park > counts.cafe && counts.cafe > 20, JSON.stringify(counts));
  assert.ok(!counts.market, "far worse options aren't picked");
  for (let i = 0; i < 50; i++) {
    assert.strictEqual(will.choose(results, r, { conscientiousness: 0.4 }, { strict: true }, random).key, "park");
    assert.strictEqual(will.choose(results, r, { conscientiousness: 0.4 }, { critical: true }, random).key, "park");
  }
  // Feeling low makes someone more spontaneous.
  const spread = valence => { let other = 0; for (let i = 0; i < 400; i++) if (will.choose(results, { mood: { valence } }, { conscientiousness: 0.6 }, {}, random).key !== "park") other++; return other; };
  assert.ok(spread(20) > spread(80));
});

test("invitations: friends decide for themselves, busy people say so, players are never moved", () => {
  const state = town();
  const hazel = byId(state, "hazel"), olive = byId(state, "olive");
  const setup = () => {
    state.residents.forEach(r => { r.wishes = []; r.will.nextInviteAt = Infinity; r.will.nextWishAt = Infinity; r.place = "square"; r.x = 477; r.y = 330; r.speech = null; r.speechQueue = []; });
    hazel.x = 470; olive.x = 480;
    hazel.will.nextInviteAt = 0;
    hazel.wishes = [{ type: "do", key: "do:park", place: "park", activity: "watching the ducks", emoji: "🦆", text: "Watch the ducks at Juniper Park", reason: "wants to watch the ducks", createdAt: NOW, until: NOW + 3_600_000 }];
    for (const r of state.residents) r.relationships = Object.fromEntries(state.residents.filter(o => o !== r).map(o => [o.id, 10]));
    hazel.relationships.olive = 90; olive.relationships.hazel = 90;
  };

  setup();
  const yes = context(state, { random: () => 0.01 });
  will.tick(state, NOW, yes);
  assert.deepStrictEqual(yes.moves.map(m => m.slice(0, 2)), [["hazel", "park"], ["olive", "park"]]);
  assert.match(hazel.speech.text, /Juniper Park/);
  assert.ok(state.events.some(e => /Hazel invited Olive to Juniper Park, and Olive said yes!/.test(e)));

  setup();
  const busy = context(state, { random: () => 0.01, obligation: r => (r.id === "olive" ? { place: "square", strict: true } : null) });
  will.tick(state, NOW, busy);
  assert.deepStrictEqual(busy.moves, [], "Olive has class");
  assert.match(olive.speechQueue[0].text, /busy|things to do/, "she answers once Hazel has asked");

  setup();
  const player = context(state, { random: () => 0.01, isControlled: id => id === "olive" });
  will.tick(state, NOW, player);
  assert.ok(!player.moves.some(m => m[0] === "olive"), "a player's character is never moved");

  setup();
  const playing = context(state, { random: () => 0.01, isControlled: id => id === "hazel" });
  will.tick(state, NOW, playing);
  assert.deepStrictEqual(playing.moves, [], "a player's character doesn't invite on their own");
});

test("arriving somewhere they wished to go, they do the thing they wished for", () => {
  const state = town();
  const hazel = byId(state, "hazel");
  hazel.wishes = [{ type: "do", place: "park", activity: "climbing the big oak", text: "Climb the big oak at Juniper Park" }];
  const activities = new Set();
  mind.setRandom(() => 0.1);
  for (let i = 0; i < 5; i++) activities.add(mind.pickActivity(hazel, "park", null));
  mind.setRandom(Math.random);
  assert.deepStrictEqual([...activities], ["climbing the big oak"]);
});

test("on a real server, residents have wishes and feelings, and visitors don't see them", async () => {
  const dataDir = tempDir("living-town-will-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off" });
  await waitForStart(server);
  const client = await connectClient(port);
  await until(() => [...client.residents.values()].some(r => r.wishes?.length > 0), "wishes appear", 20000);
  const someone = [...client.residents.values()].find(r => r.wishes?.length);
  assert.ok(Array.isArray(someone.feelings));
  assert.ok(someone.wishes.every(w => w.emoji && w.text && !("key" in w)), "phones get just the emoji and words");
  client.ws.close();
  assert.strictEqual(await stop(server), 0);
});
