"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

const env = { LIVING_TOWN_MRE_AI: "off" };

test("custom residents: create, play, customize, persist, move away", async () => {
  const dataDir = tempDir("living-town-cast-");
  const port = await freePort();
  let server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  const watcher = await connectClient(port);
  await until(() => watcher.residents.size === 7, "initial town");

  const body = { name: "Pip", age: 8, homeId: "roseCottage", look: { skin: "#8d5524", style: "pigtails", hair: "#222222", shirt: "#ff0000" } };
  assert.strictEqual((await api(port, "POST", "/api/residents", body)).status, 403, "only the owner adds residents");
  assert.strictEqual((await api(port, "POST", "/api/residents", { ...body, name: "<b>" }, owner)).status, 400);
  assert.strictEqual((await api(port, "POST", "/api/residents", { ...body, homeId: "cafe" }, owner)).status, 400);
  assert.strictEqual((await api(port, "POST", "/api/residents", { ...body, name: "olive" }, owner)).status, 409, "names are unique");
  const created = await api(port, "POST", "/api/residents", body, owner);
  assert.strictEqual(created.status, 201);
  const pipId = created.body.resident.id;
  await until(() => watcher.residents.get(pipId), "new resident reaches clients");
  const pip = watcher.residents.get(pipId);
  assert.strictEqual(pip.profile.age, 8);
  assert.strictEqual(pip.profile.lifeStage, "child");
  assert.strictEqual(pip.look.style, "pigtails");
  assert.ok(pip.playable);
  assert.ok(watcher.events.some(e => /Pip moved into Rose Cottage/.test(e.text)));

  // Pip can be played.
  const player = await api(port, "POST", "/api/auth/profiles", { name: "Pip", residentId: pipId, pin: "1234" }, owner);
  assert.strictEqual(player.status, 201);
  const pipLogin = await api(port, "POST", "/api/auth/login", { profileId: player.body.profile.id, pin: "1234" });
  const pipClient = await connectClient(port, { cookie: pipLogin.cookie });
  pipClient.ws.send(JSON.stringify({ type: "control", residentId: pipId, x: 477, y: 330 }));
  await until(() => watcher.residents.get(pipId)?.targetX === 477, "Pip walks where the player points");

  // The owner renames and rehomes; a player restyles their own character.
  assert.strictEqual((await api(port, "PUT", `/api/residents/${pipId}`, { name: "Pippa", age: 9, homeId: "finnCottage" }, owner)).status, 200);
  assert.strictEqual((await api(port, "PUT", "/api/residents/olive", { name: "X" }, owner)).status, 400, "built-in residents keep their names");
  assert.strictEqual((await api(port, "PUT", `/api/residents/${pipId}/look`, { look: { accessory: "star" } }, pipLogin.cookie)).status, 200);
  await until(() => watcher.residents.get(pipId)?.name === "Pippa" && watcher.residents.get(pipId)?.look?.accessory === "star", "changes broadcast");

  // Survives a restart.
  pipClient.ws.close();
  watcher.ws.close();
  assert.strictEqual(await stop(server), 0);
  server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  const again = await connectClient(port);
  await until(() => again.residents.get(pipId), "custom resident restored");
  assert.strictEqual(again.residents.get(pipId).name, "Pippa");
  assert.strictEqual(again.residents.get(pipId).profile.age, 9);

  // Moving away needs the player removed first.
  assert.strictEqual((await api(port, "DELETE", `/api/residents/${pipId}`, undefined, owner)).status, 409);
  assert.strictEqual((await api(port, "DELETE", `/api/auth/profiles/${player.body.profile.id}`, undefined, owner)).status, 200);
  assert.strictEqual((await api(port, "DELETE", `/api/residents/${pipId}`, undefined, owner)).status, 200);
  await until(() => !again.residents.has(pipId) || again.messages.filter(m => m.type === "state").length > 1, "roster refresh");
  assert.strictEqual((await api(port, "DELETE", "/api/residents/olive", undefined, owner)).status, 400);
  again.ws.close();
  assert.strictEqual(await stop(server), 0);
});

test("Mr. E: owner can ask for a surprise, which reaches the feed", async () => {
  const dataDir = tempDir("living-town-mre-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { ...env, TZ: "UTC" });
  await waitForStart(server);
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  const client = await connectClient(port);
  assert.strictEqual((await api(port, "POST", "/api/mre/surprise")).status, 403);
  const result = await api(port, "POST", "/api/mre/surprise", undefined, owner);
  // Everyone may be asleep at night on the test machine; both outcomes are valid.
  assert.ok([200, 409].includes(result.status), `unexpected ${result.status}`);
  if (result.status === 200) {
    assert.ok(result.body.announcement);
    await until(() => client.events.some(e => e.by === "mre"), "Mr. E's event in the feed");
  }
  assert.strictEqual((await api(port, "POST", "/api/mre/surprise", undefined, owner)).status, 429, "cooldown");
  client.ws.close();
  assert.strictEqual(await stop(server), 0);
});
