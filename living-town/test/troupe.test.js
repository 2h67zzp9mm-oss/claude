"use strict";

const test = require("node:test");
const assert = require("node:assert");
const troupe = require("../lib/troupe");
const cast = require("../lib/cast");
const world = require("../shared/world");
const interiors = require("../shared/interiors");
const { isSafe } = require("../lib/mre");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

test("the troupe: six original characters with valid looks, gentle words and their own beds", () => {
  assert.strictEqual(troupe.members.length, 6);
  assert.strictEqual(new Set(troupe.members.map(m => m.name)).size, 6);
  for (const m of troupe.members) {
    assert.deepStrictEqual(cast.sanitizeLook(m.look), m.look, `${m.name}'s look survives the look check`);
    const words = [m.summary, ...m.likes, ...m.goals, ...Object.values(m.voice).flat()].join(" ");
    assert.ok(isSafe(words.replace(/\{x\}/g, "")), `${m.name} only says gentle things`);
    const mind = troupe.mindFor(m);
    assert.ok(mind.obligations.some(o => o.place === "square" && /circus show/.test(o.activity)), `${m.name} is in the show`);
    if (m.age < 13) assert.ok(mind.obligations.some(o => o.strict && /class/.test(o.activity)), `${m.name} goes to school`);
  }
  const beds = interiors.assignBeds(interiors.planFor("bigTop"), troupe.members.map(m => m.id));
  assert.strictEqual(new Set([...beds.values()].map(b => b.bed.id)).size, 6, "a bed each");
  assert.ok(world.homeBuildings.some(b => b.id === "bigTop" && b.tent));
});

test("members still in their original looks get the new ones; restyled members keep theirs", () => {
  const patches = troupe.members.find(m => m.id === "t-patches");
  const original = { skin: "#f3d9b1", hair: "#f2b705", style: "yarn", shirt: "#7fd1b9", pants: "#7fd1b9", shoes: "#8a5a36", accessory: "stitches" };
  assert.deepStrictEqual(troupe.updatedLook({ custom: { troupe: "t-patches" }, look: original }), patches.look);
  assert.strictEqual(troupe.updatedLook({ custom: { troupe: "t-patches" }, look: { ...original, shirt: "#ff0000" } }), null, "a restyle is kept");
  assert.strictEqual(troupe.updatedLook({ custom: { troupe: "t-plum" }, look: {} }), null, "Plum was already right");
  assert.strictEqual(troupe.updatedLook({ id: "olive", look: original }), null, "only the troupe");
});

test("show time pulls everyone else to the square, once per show, only on weekend afternoons", () => {
  const events = [];
  const state = { residents: [{ id: "olive" }, { id: "t-plum", custom: { troupe: "t-plum" } }], effects: [] };
  const saturday = new Date("2026-10-10T14:30:00").getTime();
  troupe.tick(state, saturday, text => events.push(text));
  troupe.tick(state, saturday + 60_000, text => events.push(text));
  assert.strictEqual(events.length, 1);
  const show = state.effects.find(e => e.show);
  assert.strictEqual(show.place, "square");
  assert.deepStrictEqual(show.residentIds, ["olive"], "the troupe performs; everyone else watches");
  assert.strictEqual(new Date(show.until).getHours(), 16);

  const tuesday = { residents: state.residents, effects: [] };
  troupe.tick(tuesday, new Date("2026-10-13T14:30:00").getTime(), text => events.push(text));
  assert.strictEqual(tuesday.effects.length, 0);
  const noTroupe = { residents: [{ id: "olive" }], effects: [] };
  troupe.tick(noTroupe, saturday, text => events.push(text));
  assert.strictEqual(noTroupe.effects.length, 0, "no show once they've moved away");
});

test("the troupe arrives once, keeps their looks, and can move away for good", async () => {
  const dataDir = tempDir("living-town-troupe-");
  const port = await freePort();
  const env = { LIVING_TOWN_MRE_AI: "off", LIVING_TOWN_TROUPE: "on" };
  let server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  let client = await connectClient(port);
  await until(() => client.residents.size === 13, "seven residents plus six troupe members");
  const plum = client.residents.get("t-plum");
  assert.strictEqual(plum.name, "Plum");
  assert.strictEqual(plum.look.style, "bunny");
  assert.strictEqual(plum.look.accessory, "overalls");
  assert.strictEqual(plum.custom, true);
  assert.ok(client.events.filter(e => /Big Top/.test(e.text)).length === 1, "one welcome");
  client.ws.send(JSON.stringify({ type: "inspect", residentId: "t-bolt" }));
  await until(() => client.detail?.id === "t-bolt", "Bolt's details");
  assert.match(client.detail.profile.summary, /toy robot/);

  // Restart: nobody arrives twice.
  client.ws.close();
  assert.strictEqual(await stop(server), 0);
  server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  client = await connectClient(port);
  await until(() => client.residents.size === 13, "still thirteen after a restart");

  // Let Rook move away; he doesn't come back on the next start.
  assert.strictEqual((await api(port, "DELETE", "/api/residents/t-rook", undefined, owner)).status, 200);
  client.ws.close();
  assert.strictEqual(await stop(server), 0);
  server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  client = await connectClient(port);
  await until(() => client.residents.size === 12, "Rook stays moved away");
  assert.ok(!client.residents.has("t-rook"));
  client.ws.close();
  assert.strictEqual(await stop(server), 0);
});
