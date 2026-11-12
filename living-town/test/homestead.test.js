"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createHomestead } = require("../lib/homestead");

test("home plot: plant, water, grow, pick, sell, buy seeds, fish and mail", () => {
  let roll = 0.5;
  const hs = createHomestead({ random: () => roll });
  const state = { residents: [{ id: "dad", name: "Sean", stars: 0 }, { id: "nova", name: "Nova" }] };
  const me = state.residents[0], t0 = Date.parse("2026-11-11T10:00:00");
  assert.equal(hs.act(state, "home-1", me, { action: "plant", plot: 0, crop: "carrot" }, t0).ok, true);
  assert.equal(hs.act(state, "home-1", me, { action: "plant", plot: 0, crop: "carrot" }, t0).ok, false, "one crop per bed");
  hs.act(state, "home-1", me, { action: "water", plot: 0 }, t0);
  assert.equal(hs.act(state, "home-1", me, { action: "harvest", plot: 0 }, t0 + 5 * 60_000).ok, false, "not ready yet");
  assert.equal(hs.act(state, "home-1", me, { action: "harvest", plot: 0 }, t0 + 21 * 60_000).ok, true, "watered carrots take 20 minutes");
  // Unwatered crops grow slower.
  hs.act(state, "home-1", me, { action: "plant", plot: 1, crop: "carrot" }, t0);
  assert.ok(hs.view(state, "home-1", me, t0 + 21 * 60_000).plots[1].growth < 0.5);
  const sold = hs.act(state, "home-1", me, { action: "sell" }, t0 + 22 * 60_000);
  assert.equal(sold.ok, true); assert.equal(me.stars, 6);
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "pumpkin" }, t0).ok, true); assert.equal(me.stars, 0);
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "pumpkin" }, t0).ok, false, "can't buy without stars");
  const fish = hs.act(state, "home-1", me, { action: "fish" }, t0);
  assert.ok(fish.fish && fish.first); assert.equal(hs.act(state, "home-1", me, { action: "fish" }, t0 + 1000).ok, false, "a moment between casts");
  const mail = hs.act(state, "home-1", me, { action: "mail" }, t0);
  assert.ok(mail.letter && mail.letter.from === "Nova");
  assert.equal(hs.act(state, "home-1", me, { action: "mail" }, t0 + 3600_000).ok, false, "one letter a day");
  assert.equal(hs.act(state, "home-1", me, { action: "mail" }, t0 + 24 * 3600_000).ok, true);
  // Family members share the plot and see each other.
  const kid = { id: "hazel", name: "Hazel" }; state.residents.push(kid);
  hs.act(state, "home-1", kid, { action: "pos", x: 5, y: 5, dir: 0 }, t0);
  assert.equal(hs.view(state, "home-1", me, t0).others[0].id, "hazel");
  assert.equal(hs.view(state, "home-2", me, t0).others.length, 0, "other families can't see in");
  roll = 0.99; assert.ok(hs.act(state, "home-1", me, { action: "fish" }, t0 + 4000).fish);
});
