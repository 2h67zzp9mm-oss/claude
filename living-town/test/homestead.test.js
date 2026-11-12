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
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "pumpkin" }, t0).ok, false, "pumpkins need a bigger garden");
  assert.equal(hs.act(state, "home-1", me, { action: "plant", plot: 5, crop: "carrot" }, t0).ok, false, "start with 4 beds");
  assert.equal(hs.act(state, "home-1", me, { action: "upgrade" }, t0).ok, false, "upgrades cost stars");
  me.stars = 31; assert.equal(hs.act(state, "home-1", me, { action: "upgrade" }, t0).ok, true);
  assert.equal(hs.view(state, "home-1", me, t0).beds, 8); assert.equal(me.stars, 6);
  assert.equal(hs.act(state, "home-1", me, { action: "buy", crop: "corn" }, t0).ok, true); assert.equal(me.stars, 3);
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

test("home plot: the family can switch worlds", () => {
  const { createHomestead } = require("../lib/homestead");
  const hs = createHomestead(); const state = { residents: [] }; const me = { id: "dad", stars: 0 };
  assert.equal(hs.view(state, "h", me, 0).world, "clay");
  assert.equal(hs.act(state, "h", me, { action: "world", world: "scifi" }, 0).ok, true);
  assert.equal(hs.view(state, "h", me, 0).world, "scifi");
  assert.equal(hs.act(state, "h", me, { action: "world", world: "nope" }, 0).ok, false);
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
    await play({ action: "plant", plot: 0, crop: "carrot" }, ok, "plant");
    await play({ action: "water", plot: 0 }, ok, "water");
    await play({ action: "plant", plot: 7, crop: "carrot" }, (m, l) => assert.equal(m.result.ok, false, l), "locked bed refused");
    const fished = await play({ action: "fish" }, ok, "fish");
    assert.ok(fished.home.bag[fished.result.fish] >= 1);
    await play({ action: "sell" }, ok, "sell");
    await play({ action: "mail" }, (m, l) => assert.ok(m.result.letter, l), "mail");
    await play({ action: "buy", crop: "carrot" }, ok, "buy");
    await play({ action: "upgrade" }, (m, l) => assert.equal(m.result.ok, false, l), "upgrade needs stars");
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
    return Math.hypot(ax + t * (bx - ax) - p.x, ay + t * (by - ay) - p.y) < 0.5;
  });
  // From the cafe to the homes: every corner but the last is on a line.
  const path = w.route(665, 180, 478, 556);
  assert.ok(path.length > 3);
  path.slice(0, -1).forEach(p => assert.ok(onLine(p), `off the walkway at ${p.x},${p.y}`));
  // A short hop that used to cut straight across still goes by the lines.
  const hop = w.route(437, 516, 483, 518);
  assert.ok(hop.length > 2, "Rose's door to Sean's door goes down to the walk and back up");
});
