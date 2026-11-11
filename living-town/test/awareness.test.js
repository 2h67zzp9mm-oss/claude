"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");
const will = require("../lib/will");
const awareness = require("../lib/awareness");
const { isSafe } = require("../lib/mre");

const NOW = new Date("2026-10-10T11:00:00").getTime();

function town(place = "park") {
  const state = {
    residents: Object.keys(life.profiles).filter(id => !life.profiles[id].custom).map((id, i) => ({
      id, name: life.profiles[id].name, x: 240 + i * 50, y: 105, targetX: 240 + i * 50, targetY: 105, place, path: [],
      needs: { energy: 80, hunger: 80, social: 60, fun: 60 }, memories: [], relationships: {}, lastTalk: 0, asleep: false
    }))
  };
  life.hydrateLifeState(state, NOW);
  state.residents.forEach(r => { mind.ensureMind(r); will.ensure(r); awareness.ensure(r); });
  return state;
}

function ctx(over = {}) {
  return {
    mindFor: mind.mindFor, random: () => 0.1, isControlled: () => false, isInside: () => false,
    weather: () => "clear", event: () => null, placeName: k => ({ park: "Juniper Park", square: "Town Square", cafe: "Moonbeam Cafe" }[k] || "town"),
    like: (r, place, amount) => will.like(r, place, amount), ...over
  };
}
const get = (state, id) => state.residents.find(r => r.id === id);

test("every reaction line is gentle", () => {
  for (const groups of [awareness.RAIN, awareness.EVENT, awareness.CROWD]) for (const [, lines] of groups) for (const line of lines) assert.ok(isSafe(line.replace("{event}", "Kite hour")), line);
  for (const line of [...awareness.WAVE, ...awareness.CHANGED]) assert.ok(isSafe(line.replace(/\{\w+\}/g, "Olive")), line);
});

test("rain: noticed once, in character, remembered, and the place gets a little less tempting", () => {
  const state = town();
  // Spread out so nobody is also reacting to a crowd.
  state.residents.forEach((r, i) => { r.place = i % 2 ? "park" : "square"; });
  const rainy = ctx({ weather: () => "rain" });
  awareness.tick(state, NOW, rainy);
  const finn = get(state, "finn"), hazel = get(state, "hazel");
  assert.strictEqual(hazel.emote.emoji, "💧");
  assert.ok(hazel.memories.some(m => /caught in the rain at Juniper Park/.test(m.text)));
  assert.ok((hazel.placeAffinity.park || 0) < 0, "the park is less tempting after a soaking");
  // Different people say different things about it.
  const said = new Set(state.residents.map(r => r.speech?.text).filter(Boolean));
  assert.ok(said.size >= 2, `varied reactions: ${[...said].join(" / ")}`);
  assert.ok(finn.speech === undefined || finn.speech === null || /umbrella|schedule|dry|rain/i.test(finn.speech.text));
  const memoriesBefore = hazel.memories.length;
  awareness.tick(state, NOW + 60_000, rainy);
  assert.strictEqual(hazel.memories.length, memoriesBefore, "not noticed again a minute later");
  // Indoors, asleep, or a player's character: no reaction.
  const quiet = town();
  get(quiet, "olive").asleep = true;
  awareness.tick(quiet, NOW, ctx({ weather: () => "rain", isControlled: id => id === "dad", isInside: r => r.id === "milo" }));
  for (const id of ["olive", "dad", "milo"]) assert.ok(!get(quiet, id).emote, `${id} doesn't react`);
});

test("events nearby, crowds, and familiar places that look different", () => {
  const state = town("square");
  const event = { id: "e1", name: "Chalk art party", place: "square" };
  awareness.tick(state, NOW, ctx({ event: () => event }));
  const zara = get(state, "zara");
  assert.ok(zara.memories.some(m => /saw the chalk art party at Town Square/.test(m.text)));
  // Everyone's at the square: a crowd. The shy and the outgoing feel differently.
  const finn = get(state, "finn"), milo = get(state, "milo");
  finn.aware.seen = {}; milo.aware.seen = {};
  awareness.tick(state, NOW + 1000, ctx());
  assert.strictEqual(finn.emote.emoji, "😵");
  assert.strictEqual(milo.emote.emoji, "🎉");
  // Coming back to a place that looks different from last time.
  const olive = get(state, "olive");
  olive.place = "park"; olive.aware.lastPlace = ""; olive.aware.placeLooks.park = "usual"; olive.aware.seen = {};
  awareness.tick(state, NOW + 2000, ctx({ weather: () => "sunny" }));
  assert.ok(olive.memories.some(m => /Juniper Park looked different today/.test(m.text)));
});

test("friends wave when they pass (strangers don't), and it warms the friendship a little", () => {
  const state = town();
  const olive = get(state, "olive"), hazel = get(state, "hazel"), finn = get(state, "finn");
  // Just the three of them in the park (no crowd to react to).
  for (const r of state.residents) if (![olive, hazel, finn].includes(r)) r.place = "cafe";
  Object.assign(hazel, { x: olive.x + 10, y: olive.y });
  Object.assign(finn, { x: olive.x - 10, y: olive.y });
  olive.relationships = { hazel: 80, finn: 5 };
  awareness.tick(state, NOW, ctx());
  assert.strictEqual(olive.emote.emoji, "👋");
  assert.match(olive.speech.text, /Hazel/);
  assert.ok(olive.relationships.hazel > 80);
  assert.strictEqual(olive.relationships.finn, 5, "no wave for someone she barely knows");
});

test("what they noticed gives them something to talk about", () => {
  const state = town();
  const olive = get(state, "olive"), hazel = get(state, "hazel");
  olive.noticed = [{ at: NOW, text: "I saw the duck race at Juniper Park" }];
  // No squabble, no shared-interest chat, then: bring up what she noticed.
  // (who starts, no squabble, no shared-interest topic, then yes to what she noticed)
  const rolls = [0.99, 0.99, 0.99, 0.1];
  mind.setRandom(() => (rolls.length ? rolls.shift() : 0.5));
  mind.converse(olive, hazel, NOW, "Juniper Park");
  mind.setRandom(Math.random);
  const lines = [olive.speech, hazel.speech, ...(olive.speechQueue || []), ...(hazel.speechQueue || [])].filter(Boolean).map(l => l.text).join(" | ");
  assert.match(lines, /duck race/, lines);
});
