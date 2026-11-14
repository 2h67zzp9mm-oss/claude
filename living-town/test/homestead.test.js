"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createHomestead } = require("../lib/homestead");

test("home plot economy: buy several, sell one at a time, till for an extra crop, dig up", () => {
  const hs = createHomestead({ random: () => 0.99 }); const me = { id: "dad", stars: 20 }, state = { residents: [me] }, t0 = Date.parse("2026-11-11T10:00:00");
  const h = hs.home(state, "h"); h.seeds = {};
  assert.deepEqual(hs.act(state, "h", me, { action: "buy", crop: "tomato", n: 5 }, t0).bought, { crop: "tomato", n: 5 }); assert.equal(me.stars, 5);
  assert.equal(hs.act(state, "h", me, { action: "buy", crop: "tomato", n: 5 }, t0).bought.n, 1, "only what you can afford");
  assert.equal(hs.act(state, "h", me, { action: "till", plot: 0 }, t0).ok, true);
  assert.equal(hs.view(state, "h", me, t0).plots[0].tilled, true);
  hs.act(state, "h", me, { action: "plant", plot: 0, crop: "tomato" }, t0); h.plots[0].growth = 1;
  assert.equal(hs.act(state, "h", me, { action: "harvest", plot: 0 }, t0).count, 3, "tilled: 2 tomatoes + 1");
  assert.equal(hs.view(state, "h", me, t0).plots[0].tilled, false, "tilling is used up");
  const s0 = me.stars; const one = hs.act(state, "h", me, { action: "sell", item: "tomato" }, t0);
  assert.equal(one.ok, true); assert.ok(me.stars >= s0 + 5); assert.equal(h.bag.tomato, 2, "sold just one");
  hs.act(state, "h", me, { action: "plant", plot: 1, crop: "tomato" }, t0); const seeds = h.seeds.tomato;
  assert.equal(hs.act(state, "h", me, { action: "dig", plot: 1 }, t0).ok, true); assert.equal(h.seeds.tomato, seeds + 1, "fresh seed comes back");
  for (const [k, c] of Object.entries(hs.CROPS || {})) assert.ok(c.sell * c.yield > c.seed, `${k} is worth planting`);
});

test("home plot: plant, water, grow, pick, sell, buy seeds, fish and mail", () => {
  let roll = 0.5;
  const hs = createHomestead({ random: () => roll });
  const state = { residents: [{ id: "dad", name: "Sean", stars: 0 }, { id: "nova", name: "Nova" }] };
  const me = state.residents[0], t0 = Date.parse("2026-11-11T10:00:00");
  // Goals, level-ups and story chapters pay stars on top; keep count so the prices can be checked exactly.
  let extra = 0; const real = hs.act;
  hs.act = (...a) => { const r = real(...a); extra += (r.goals || []).reduce((t, g) => t + g.stars, 0) + (r.allGoals?.bonus || 0) + (r.levelUp?.stars || 0) + (r.story?.stars || 0); return r; };
  assert.equal(hs.act(state, "home-1", me, { action: "plant", plot: 0, crop: "carrot" }, t0).ok, true);
  assert.equal(hs.act(state, "home-1", me, { action: "plant", plot: 0, crop: "carrot" }, t0).ok, false, "one crop per bed");
  hs.act(state, "home-1", me, { action: "water", plot: 0 }, t0);
  assert.equal(hs.act(state, "home-1", me, { action: "harvest", plot: 0 }, t0 + 5 * 60_000).ok, false, "not ready yet");
  assert.equal(hs.act(state, "home-1", me, { action: "harvest", plot: 0 }, t0 + 21 * 60_000).ok, true, "watered carrots take 20 minutes");
  // Unwatered crops grow slower.
  hs.act(state, "home-1", me, { action: "plant", plot: 1, crop: "carrot" }, t0);
  assert.ok(hs.view(state, "home-1", me, t0 + 21 * 60_000).plots[1].growth < 0.5);
  const sold = hs.act(state, "home-1", me, { action: "sell" }, t0 + 22 * 60_000);
  assert.equal(sold.ok, true); assert.equal(me.stars - extra, 6, "6 stars for 2 carrots (plus any goal, level and story stars)");
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "pumpkin" }, t0).ok, false, "pumpkins need a bigger garden");
  assert.equal(hs.act(state, "home-1", me, { action: "plant", plot: 5, crop: "carrot" }, t0).ok, false, "start with 4 beds");
  assert.equal(hs.act(state, "home-1", me, { action: "upgrade" }, t0).ok, false, "upgrades cost stars");
  me.stars = 37; assert.equal(hs.act(state, "home-1", me, { action: "upgrade" }, t0).ok, true);
  assert.equal(hs.view(state, "home-1", me, t0).beds, 8); assert.equal(me.stars, 12);
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "corn" }, t0).ok, true); assert.equal(me.stars, 6);
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "corn" }, t0).ok, true); assert.equal(me.stars, 0);
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "corn" }, t0).ok, false, "can't buy without stars");
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

test("home plot: daily goals pay stars, all three pay a bonus, and days in a row make a streak", () => {
  const hs = createHomestead(); const state = { residents: [] }; const me = { id: "dad", stars: 0 };
  const day1 = Date.parse("2026-11-11T10:00:00");
  const goals = hs.view(state, "h", me, day1).goals;
  assert.equal(goals.length, 3); assert.equal(new Set(goals.map(g => g.text)).size, 3);
  assert.deepEqual(hs.view(state, "h", me, day1 + 3600_000).goals, goals, "same goals all day");
  // Do every goal for the day by acting on the raw state.
  function finishDay(t) {
    hs.view(state, "h", me, t); const h = hs.home(state, "h"); h.seeds.carrot = 20; const out = [];
    for (let i = 0; i < 6; i++) {
      for (const goal of h.daily.goals) {
        if (goal.have >= goal.n) continue;
        const k = goal.k, plot = i % 4;
        if (k === "plant") { h.plots[plot].crop = null; out.push(hs.act(state, "h", me, { action: "plant", plot, crop: "carrot" }, t)); }
        if (k === "water") { Object.assign(h.plots[plot], { crop: "carrot", growth: 0.1 }); out.push(hs.act(state, "h", me, { action: "water", plot }, t)); }
        if (k === "harvest") { Object.assign(h.plots[plot], { crop: "carrot", growth: 1 }); out.push(hs.act(state, "h", me, { action: "harvest", plot }, t)); }
        if (k === "fish") out.push(hs.act(state, "h", me, { action: "fish" }, t + i * 4000));
        if (k === "sell") { h.bag.carrot = 1; out.push(hs.act(state, "h", me, { action: "sell" }, t)); }
        if (k === "mail") out.push(hs.act(state, "h", me, { action: "mail" }, t));
      }
    }
    return out;
  }
  const out1 = finishDay(day1);
  assert.equal(out1.flatMap(r => r.goals || []).length, 3, "three goals finished");
  assert.equal(out1.filter(r => r.allGoals).length, 1, "one all-done bonus");
  assert.equal(hs.view(state, "h", me, day1).streak, 1);
  const out2 = finishDay(day1 + 86400_000);
  assert.equal(out2.find(r => r.allGoals).allGoals.streak, 2, "two days in a row");
  assert.equal(hs.view(state, "h", me, day1 + 4 * 86400_000).streak, 0, "missing days resets the streak");
});

test("home plot: the family can switch worlds", () => {
  const { createHomestead } = require("../lib/homestead");
  const hs = createHomestead(); const state = { residents: [] }; const me = { id: "dad", stars: 0 };
  assert.equal(hs.view(state, "h", me, 0).world, "clay");
  assert.equal(hs.act(state, "h", me, { action: "world", world: "scifi" }, 0).ok, true);
  assert.equal(hs.view(state, "h", me, 0).world, "scifi");
  assert.equal(hs.act(state, "h", me, { action: "world", world: "castle" }, 0).ok, true, "Cloud Castle is built");
  assert.equal(hs.act(state, "h", me, { action: "world", world: "nope" }, 0).ok, false);
});

test("home plot: worlds with several houses remember the family's pick per world", () => {
  const { createHomestead } = require("../lib/homestead");
  const hs = createHomestead(); const state = { residents: [] }; const me = { id: "dad", stars: 0 };
  assert.equal(hs.view(state, "h", me, 0).house, null, "the clay world has one house");
  assert.equal(hs.act(state, "h", me, { action: "house", house: "ship" }, 0).ok, false, "no house picker outside those worlds");
  assert.equal(hs.act(state, "h", me, { action: "world", world: "pirate" }, 0).ok, true, "Pirate Cove is built");
  assert.equal(hs.view(state, "h", me, 0).house, "shack");
  assert.equal(hs.act(state, "h", me, { action: "house", house: "stump" }, 0).ok, false, "a Night Forest house isn't in Pirate Cove");
  assert.equal(hs.act(state, "h", me, { action: "house", house: "ship" }, 0).ok, true);
  assert.equal(hs.view(state, "h", me, 0).house, "ship");
  hs.act(state, "h", me, { action: "world", world: "night" }, 0);
  assert.equal(hs.view(state, "h", me, 0).house, "stump");
  hs.act(state, "h", me, { action: "house", house: "moon" }, 0);
  hs.act(state, "h", me, { action: "world", world: "pirate" }, 0);
  assert.equal(hs.view(state, "h", me, 0).house, "ship", "each world keeps its own house");
});

// Playtest bot: a real server, a signed-in phone, every home plot action over the real connection.
test("on a real server: the playtest bot plays the whole home plot", async () => {
  const { tempDir, freePort, spawnServer, waitForStart, api, connectClient, until, stop } = require("./helpers");
  const dataDir = tempDir("living-town-home-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off" });
  try {
    await waitForStart(server);
    const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
    const phone = await connectClient(port, { cookie: owner });
    const results = () => phone.messages.filter(m => m.type === "home-state");
    const play = async (msg, check, label) => {
      const n = results().length;
      phone.ws.send(JSON.stringify({ type: "home", ...msg }));
      await until(() => results().length > n, label);
      const last = results().at(-1);
      assert.ok(!last.error, `${label}: ${last.error}`);
      if (check) check(last, label);
      return last;
    };
    const ok = (m, label) => assert.equal(m.result?.ok, true, `${label}: ${m.result?.toast}`);
    const first = await play({ action: "enter" }, null, "enter");
    assert.equal(first.home.beds, 4); assert.equal(first.home.world, "clay");
    assert.equal(first.home.goals.length, 3, "three daily goals on the phone");
    await play({ action: "plant", plot: 0, crop: "carrot" }, ok, "plant");
    await play({ action: "water", plot: 0 }, ok, "water");
    await play({ action: "plant", plot: 7, crop: "carrot" }, (m, l) => assert.equal(m.result.ok, false, l), "locked bed refused");
    const fished = await play({ action: "fish" }, ok, "fish");
    assert.ok(fished.home.bag[fished.result.fish] >= 1);
    await play({ action: "sell" }, ok, "sell");
    await play({ action: "mail" }, (m, l) => assert.ok(m.result.letter, l), "mail");
    await play({ action: "buy", crop: "carrot" }, ok, "buy");
    // a lucky golden fish can pay for it; otherwise it's refused for lack of stars
    await play({ action: "upgrade" }, (m, l) => assert.equal(m.result.ok, m.home.beds === 8, l), "upgrade needs stars");
    // Every job but picking was done once, so each of those goals moved on.
    const after = await play({ action: "view" }, null, "goals");
    after.home.goals.filter(g => !/^Pick/.test(g.text)).forEach(g => assert.ok(g.have >= 1, `goal "${g.text}" counted`));
    const sci = await play({ action: "world", world: "scifi" }, ok, "world");
    assert.equal(sci.home.world, "scifi");
    phone.ws.send(JSON.stringify({ type: "home", action: "pos", x: 9, y: 12, dir: 2 }));
    await play({ action: "view" }, null, "view");
  } finally { await stop(server); }
});

test("town walking: everyone follows the walkway lines, even on short trips", () => {
  const w = require("../shared/world");
  const onLine = p => w.walkEdges.some(([a, b]) => {
    const [ax, ay] = w.walkNodes[a], [bx, by] = w.walkNodes[b], L2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / L2));
    return Math.hypot(ax + t * (bx - ax) - p.x, ay + t * (by - ay) - p.y) < 15;
  });
  // From the cafe to the homes: every corner but the last is on a line.
  const path = w.route(665, 180, 478, 556);
  assert.ok(path.length > 3);
  path.slice(0, -1).forEach(p => assert.ok(onLine(p), `off the walkway at ${p.x},${p.y}`));
  // A short hop that used to cut straight across still goes by the lines.
  const hop = w.route(437, 516, 483, 518);
  assert.ok(hop.length > 2, "Rose's door to Sean's door goes down to the walk and back up");
  // Two lanes: going there and coming back use different sides of the walk.
  const there = w.route(400, 600, 487, 600), back = w.route(487, 600, 400, 600);
  assert.ok(Math.abs(there[0].y - back[0].y) >= 10, "people going opposite ways pass side by side");
});

test("character creator: a grown-up's body choice is kept, junk is dropped", () => {
  const cast = require("../lib/cast");
  assert.equal(cast.sanitizeLook({ body: "fem", shirt: "#E53935" }).body, "fem");
  assert.equal(cast.sanitizeLook({ body: "fem", shirt: "#E53935" }).shirt, "#e53935");
  assert.equal(cast.sanitizeLook({ body: "robot" }).body, undefined);
});

test("dress-up looks: outfits, colours, wings and crown are kept; junk is dropped", () => {
  const cast = require("../lib/cast");
  const l = cast.sanitizeLook({ outfit: "dress", outfitColor: "#F48FB1", wings: "#bfe6ff", crown: true, style: "long" });
  assert.equal(l.outfit, "dress"); assert.equal(l.outfitColor, "#f48fb1"); assert.equal(l.wings, "#bfe6ff"); assert.equal(l.crown, true);
  const bad = cast.sanitizeLook({ outfit: "spacesuit", outfitColor: "red", wings: "yes", crown: "yes" });
  assert.equal(bad.outfit, undefined); assert.equal(bad.outfitColor, undefined); assert.equal(bad.wings, undefined); assert.equal(bad.crown, undefined);
});

test("pets: a free starter, treats to find, tame today's visitor, the travelling seller, rename and choose", () => {
  const hs = createHomestead({ random: () => 0.9 });
  const kid = { id: "hazel", name: "Hazel", stars: 0 }, state = { residents: [kid] }, t0 = Date.parse("2026-11-13T10:00:00");
  let v = hs.view(state, "home-1", kid, t0).pets;
  assert.deepEqual(v.owned, []); assert.deepEqual(v.starters, ["kitty", "bunny", "puppy"]); assert.equal(v.spots.length, 3);
  assert.equal(hs.act(state, "home-1", kid, { action: "petStart", species: "dragon", color: "green" }, t0).ok, false, "dragons aren't starters");
  const start = hs.act(state, "home-1", kid, { action: "petStart", species: "bunny", color: "pink" }, t0);
  assert.equal(start.ok, true); assert.equal(start.pet.name, "Pink Bunny");
  assert.equal(hs.act(state, "home-1", kid, { action: "petStart", species: "kitty", color: "pink" }, t0).ok, false, "only one free pet");
  assert.equal(hs.act(state, "home-1", kid, { action: "petFeed" }, t0).ok, false, "no treats yet");
  for (const s of v.spots) assert.equal(hs.act(state, "home-1", kid, { action: "treat", spot: s.i }, t0).ok, true);
  assert.equal(hs.act(state, "home-1", kid, { action: "treat", spot: 0 }, t0).ok, false, "each treat once");
  hs.act(state, "home-1", kid, { action: "petFeed" }, t0); hs.act(state, "home-1", kid, { action: "petFeed" }, t0);
  const tame = hs.act(state, "home-1", kid, { action: "petFeed" }, t0);
  assert.equal(tame.tamed, true); v = hs.view(state, "home-1", kid, t0).pets;
  assert.equal(v.owned.length, 2); assert.equal(v.wild, null); assert.equal(v.treats, 0); assert.equal(v.spots.length, 0);
  assert.equal(hs.act(state, "home-1", kid, { action: "petBuy" }, t0).ok, false, "seller pets cost stars");
  kid.stars = 45; const buy = hs.act(state, "home-1", kid, { action: "petBuy" }, t0);
  assert.equal(buy.ok, true); assert.ok(["unicorn", "dragon"].includes(buy.pet.species)); assert.equal(kid.stars - (buy.levelUp?.stars || 0), 5);
  assert.equal(hs.act(state, "home-1", kid, { action: "petName", id: 1, name: "Sprinkles<script>" }, t0).ok, true);
  v = hs.view(state, "home-1", kid, t0).pets; assert.equal(v.owned[0].name, "Sprinklesscript");
  assert.equal(hs.act(state, "home-1", kid, { action: "petActive", id: 3 }, t0).ok, true); assert.equal(hs.view(state, "home-1", kid, t0).pets.active, 3);
  // A new day brings new treats, a new visitor and the seller again.
  v = hs.view(state, "home-1", kid, t0 + 86400_000).pets; assert.equal(v.spots.length, 3); assert.ok(v.wild); assert.ok(v.seller);
});

test("levels: doing things earns XP, levels pay stars and unlock perks and new fish", () => {
  const Q = require("../lib/quests");
  assert.deepEqual(Q.levelOf(0), { level: 1, into: 0, need: 20 }); assert.equal(Q.levelOf(20).level, 2); assert.equal(Q.levelOf(20 + 35).level, 3);
  assert.equal(Q.titleOf(1), "Sprout"); assert.equal(Q.titleOf(12), "Explorer");
  const hs = createHomestead({ random: () => 0.99 }); const me = { id: "dad", stars: 0 }, state = { residents: [me] }, t0 = Date.parse("2026-11-11T10:00:00");
  let v = hs.view(state, "h", me, t0);
  assert.equal(v.me.level, 1); assert.equal(v.fish.rainbow.level, 2); assert.ok(v.me.perks.length > 10);
  const first = hs.act(state, "h", me, { action: "fish" }, t0);
  assert.ok(first.xp >= 4 + 8, "XP for the cast and for a new kind of fish");
  for (let i = 1; i < 30; i++) assert.ok(hs.act(state, "h", me, { action: "fish" }, t0 + i * 4000).fish !== "rainbow" || hs.view(state, "h", me, t0).me.level >= 2, "level fish only bite once unlocked");
  // Push the player up and check the perks really change the game.
  const h = hs.home(state, "h"); h.players.dad.xp = 19;
  const up = hs.act(state, "h", me, { action: "plant", plot: 0, crop: "carrot" }, t0);
  assert.equal(up.levelUp.level, 2); assert.equal(up.levelUp.stars, 9); assert.ok(up.levelUp.perks[0].text.includes("Rainbow Trout"));
  h.players.dad.xp = 5000; v = hs.view(state, "h", me, t0);
  assert.ok(v.me.level >= 20); assert.equal(v.me.title, "Legend"); assert.equal(v.goalStars, 4, "goal getter");
  assert.equal(v.pets.spots.length, 4, "treat nose finds one more treat");
  hs.act(state, "h", me, { action: "water", plot: 0 }, t0);
  assert.equal(hs.view(state, "h", me, t0 + 8 * 3600_000).plots[0].wet, true, "the big watering can lasts 9 hours");
  h.plots[1].crop = null; hs.act(state, "h", me, { action: "plant", plot: 1, crop: "carrot" }, t0); hs.act(state, "h", me, { action: "water", plot: 1 }, t0);
  assert.equal(hs.act(state, "h", me, { action: "harvest", plot: 1 }, t0 + 18 * 60_000).ok, true, "fast grower: 20 minute carrots are ready sooner");
  // Reaching level 20 brings the golden baby dragon.
  const kid = { id: "hazel", stars: 0 }; state.residents.push(kid); hs.view(state, "h", kid, t0);
  hs.home(state, "h").players.hazel = { xp: [...Array(19)].reduce((t, _, i) => t + 20 + 15 * i, 0) - 1 };   // one XP short of level 20
  const gold = hs.act(state, "h", kid, { action: "mail" }, t0);
  assert.equal(gold.levelUp.level, 20); assert.equal(gold.pet.species, "dragon"); assert.equal(gold.pet.color, "gold");
});

test("story: each world tells its own story a chapter at a time, and the family shares it", () => {
  const hs = createHomestead({ random: () => 0.99 }); const me = { id: "dad", stars: 0 }, kid = { id: "hazel", stars: 0 }, state = { residents: [me, kid] }, t0 = Date.parse("2026-11-11T10:00:00");
  let s = hs.view(state, "h", me, t0).story;
  assert.equal(s.title, "The Blank World"); assert.equal(s.ch, 1); assert.equal(s.total, 6); assert.equal(s.job, "Plant 3 seeds");
  hs.act(state, "h", me, { action: "plant", plot: 0, crop: "carrot" }, t0); hs.act(state, "h", me, { action: "plant", plot: 1, crop: "carrot" }, t0);
  assert.equal(hs.view(state, "h", kid, t0).story.have, 2, "the family shares the story");
  const before = kid.stars, done = hs.act(state, "h", kid, { action: "plant", plot: 2, crop: "carrot" }, t0);
  assert.equal(done.story.stars, 8); assert.ok(kid.stars >= before + 8); assert.equal(hs.view(state, "h", me, t0).story.ch, 2);
  // Another world has another story, and coming back keeps your place.
  hs.act(state, "h", me, { action: "world", world: "pirate" }, t0);
  s = hs.view(state, "h", me, t0).story; assert.equal(s.title, "Captain Marigold's Treasure"); assert.equal(s.ch, 1);
  const mail = hs.act(state, "h", me, { action: "mail" }, t0); assert.ok(mail.story && !mail.story.end);
  hs.act(state, "h", me, { action: "world", world: "clay" }, t0); assert.equal(hs.view(state, "h", me, t0).story.ch, 2);
  // The last chapter pays big and the story ends.
  const h = hs.home(state, "h"); h.story.clay = { ch: 5, have: 1 }; h.bag.carrot = 1;
  const end = hs.act(state, "h", me, { action: "sell" }, t0);
  assert.equal(end.story.end, true); assert.equal(end.story.stars, 50); assert.equal(end.story.treats, 3);
  s = hs.view(state, "h", me, t0).story; assert.equal(s.done, true); assert.equal(s.job, null);
});

test("family build: everyone gives crops, fish and stars, and a finished stage pays the whole family", () => {
  const hs = createHomestead({ random: () => 0.99 }); const me = { id: "dad", stars: 0 }, kid = { id: "hazel", stars: 0 }, state = { residents: [me, kid] }, t0 = Date.parse("2026-11-11T10:00:00");
  hs.act(state, "h", kid, { action: "pos", x: 5, y: 5, dir: 0 }, t0);   // Hazel has played, so she shares the prize
  let b = hs.view(state, "h", me, t0).build;
  assert.equal(b.name, "Clubhouse"); assert.equal(b.stage, 1); assert.equal(b.total, 6); assert.deepEqual(b.needs.map(n => [n.k, n.need]), [["carrot", 6], ["tomato", 4]]);
  assert.equal(hs.act(state, "h", me, { action: "give" }, t0).ok, false, "nothing to give yet");
  assert.equal(hs.act(state, "h", me, { action: "giveStars" }, t0).ok, false, "no stars to give yet");
  const h = hs.home(state, "h"); h.bag = { carrot: 9, tomato: 3, minnow: 2 };
  const gave = hs.act(state, "h", me, { action: "give" }, t0);
  assert.equal(gave.gave, 9); assert.deepEqual(h.bag, { carrot: 3, minnow: 2 }, "only what's needed is taken");
  h.bag.tomato = 1; hs.act(state, "h", kid, { action: "give" }, t0);
  me.stars = 12; hs.act(state, "h", me, { action: "giveStars" }, t0); assert.equal(me.stars, 2); assert.equal(hs.view(state, "h", me, t0).build.stars.have, 10);
  kid.stars = 30; const fin = hs.act(state, "h", kid, { action: "giveStars" }, t0);
  assert.equal(fin.gaveStars, 5, "only what the stage still needs"); assert.equal(fin.stage.stage, 1); assert.equal(fin.stage.stars, 20);
  assert.ok(me.stars >= 22 && kid.stars >= 45, "everyone in the family gets the prize");
  b = hs.view(state, "h", me, t0).build; assert.equal(b.stage, 2); assert.equal(b.stars.have, 0);
  // "Any fish" takes the cheapest fish first.
  h.build = { stage: 2, given: {} }; h.bag = { golden: 1, minnow: 2 }; hs.act(state, "h", me, { action: "give" }, t0);
  assert.equal(h.build.given.fish, 3); h.build = { stage: 6, given: {} };
  assert.equal(hs.view(state, "h", me, t0).build.done, true); assert.equal(hs.act(state, "h", me, { action: "give" }, t0).ok, false);
});

test("collection book: fish, crops and pets fill pages, and a full page pays the family", () => {
  const hs = createHomestead({ random: () => 0.99 }); const me = { id: "dad", stars: 0 }, state = { residents: [me] }, t0 = Date.parse("2026-11-11T10:00:00");
  let b = hs.view(state, "h", me, t0).book;
  assert.deepEqual([b.fish.length, b.crops.length, b.pets.length], [0, 0, 0]); assert.equal(b.totals.crops, 8); assert.equal(b.totals.fish, 12);
  const h = hs.home(state, "h"); Object.assign(h.plots[0], { crop: "carrot", growth: 1 });
  const pick = hs.act(state, "h", me, { action: "harvest", plot: 0 }, t0);
  assert.equal(pick.newCrop, true); assert.deepEqual(hs.view(state, "h", me, t0).book.crops, ["carrot"]);
  hs.act(state, "h", me, { action: "petStart", species: "bunny", color: "pink" }, t0);
  assert.deepEqual(hs.view(state, "h", me, t0).book.pets, ["bunny"]);
  for (const k of ["tomato", "strawberry", "corn", "blueberry", "sunflower", "watermelon"]) h.grown[k] = 1;
  Object.assign(h.plots[1], { crop: "pumpkin", growth: 1 }); const stars = me.stars;
  const last = hs.act(state, "h", me, { action: "harvest", plot: 1 }, t0);
  assert.equal(last.book.page, "crops"); assert.equal(last.book.stars, 60); assert.ok(me.stars >= stars + 60);
  assert.equal(hs.view(state, "h", me, t0).book.done.crops, true);
  Object.assign(h.plots[1], { crop: "pumpkin", growth: 1 }); assert.equal(hs.act(state, "h", me, { action: "harvest", plot: 1 }, t0).book, undefined, "a page pays once");
});
