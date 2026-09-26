"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, waitForExit, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

const legacySave = () => ({
  version: 1,
  lastRealTime: Date.now(),
  simTime: Date.now(),
  eventId: 1,
  events: [{ id: 0, at: Date.now(), text: "Legacy town save." }],
  residents: [{
    id: "dad", name: "Dad", initial: "D", color: "#4fc3a1", trait: "helpful",
    x: 505, y: 505, targetX: 505, targetY: 505, place: "homes", activity: "settling in",
    needs: { energy: 82, hunger: 78, social: 72, fun: 75 }, memories: [], relationships: {}, lastTalk: 0,
    knowledge: [{ factId: "dad-history-2016-0", subjectId: "dad", text: "self fact", learnedFrom: "self" }]
  }, {
    id: "guest_uncle_bob", name: "Uncle Bob", initial: "B", color: "#888888", trait: "visiting",
    x: 470, y: 520, targetX: 470, targetY: 520, place: "nowhere", activity: "visiting town",
    needs: { energy: 80, hunger: 80, social: 80, fun: 80 }, memories: [], relationships: {}, lastTalk: 0
  }]
});

test("shared world: migration, validation, control, persistence and recovery", async () => {
  const dataDir = tempDir("living-town-test-");
  const port = await freePort();
  const env = { LIVING_TOWN_SNAPSHOT_MS: "1000", LIVING_TOWN_BACKUP_MS: "1000" };
  fs.writeFileSync(path.join(dataDir, "town-state.json"), JSON.stringify(legacySave()));

  let server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  const second = spawnServer(dataDir, port, env);
  assert.strictEqual(await waitForExit(second.child), 1, "a second writer must be refused");

  const a = await connectClient(port);
  const b = await connectClient(port);
  await until(() => a.residents.size && b.residents.size, "initial states");
  assert.strictEqual(a.residents.size, 8, "legacy save gains all seven core residents and keeps unknown ones");
  assert.strictEqual(a.residents.get("dad").name, "Sean");
  assert.ok(!("lifeHistory" in a.residents.get("olive")), "state updates omit heavy histories");

  a.ws.send(JSON.stringify({ type: "inspect", residentId: "olive" }));
  await until(() => a.detail?.id === "olive", "resident detail");
  assert.strictEqual(a.detail.lifeHistory.length, 30);
  a.ws.send(JSON.stringify({ type: "inspect", residentId: "dad" }));
  await until(() => a.detail?.id === "dad", "Sean detail");
  assert.ok(!a.detail.knowledge.some(fact => fact.learnedFrom === "self"), "self facts migrate out of learned knowledge");
  assert.ok(a.detail.lifeHistory.some(event => event.type === "promotion"));

  await until(() => a.messages.filter(m => m.type === "tick").length >= 2, "ticks arrive");
  assert.strictEqual(server.child.exitCode, null, "unknown resident must not crash the tick");
  assert.ok(["homes", "square", "cafe", "park", "market", "workshop"].includes(a.residents.get("guest_uncle_bob").place));
  assert.ok(a.residents.get("olive").intent, "residents explain their choices");

  // Before accounts exist, nobody can steer a resident.
  a.ws.send(JSON.stringify({ type: "control", residentId: "olive", x: 111, y: 222 }));
  await until(() => a.messages.some(m => m.type === "control-rejected"), "pre-setup control rejected");

  // First-time setup needs the console code and a 6-digit PIN.
  assert.strictEqual((await api(port, "POST", "/api/auth/setup", { code: "000000", pin: "246810" })).status, 403);
  assert.strictEqual((await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "2468" })).status, 400);
  const setup = await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" });
  assert.strictEqual(setup.status, 200);

  const sean = await connectClient(port, { cookie: setup.cookie });
  sean.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: 700, y: 400 }));
  await until(() => a.residents.get("dad").targetX === 700 && b.residents.get("dad").targetX === 700, "both clients see Sean steered");

  sean.ws.send("not-json");
  sean.ws.send(JSON.stringify({ type: "control", residentId: "milo", x: 10, y: 10 }));
  sean.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: 99999, y: -99999 }));
  await until(() => b.residents.get("dad").targetX !== 700, "wild coordinates still move Sean");
  const world = require("../shared/world");
  const snapped = world.snapToWalkable(940, 20);
  assert.ok(Math.abs(b.residents.get("dad").targetX - snapped.x) < 0.01 && Math.abs(b.residents.get("dad").targetY - snapped.y) < 0.01, "taps snap onto the walkways");
  assert.notStrictEqual(b.residents.get("milo").targetX, 10, "non-player residents cannot be steered");

  sean.ws.close();
  await until(() => b.residents.get("dad").intent !== "following a player's lead", "disconnect releases control");

  await until(() => fs.existsSync(path.join(dataDir, "town-state.json")) && JSON.parse(fs.readFileSync(path.join(dataDir, "town-state.json"))).version === 3, "autosave", 15000);
  await until(() => fs.readdirSync(path.join(dataDir, "backups")).length > 0, "backup", 15000);
  await until(() => fs.readdirSync(path.join(dataDir, "snapshots")).length > 0, "snapshot", 15000);
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, "town-state.json"), "utf8"));
  assert.strictEqual(saved.controllers, undefined, "controller claims are never saved");
  assert.ok(saved.residents.every(r => r.initial === undefined && r.trait === undefined), "dead fields removed");
  assert.ok(!fs.readdirSync(dataDir).some(name => name.includes(".tmp-")), "no temp files left behind");

  a.ws.close();
  b.ws.close();
  server.child.kill("SIGKILL");
  await waitForExit(server.child);

  const immediate = spawnServer(dataDir, port, env);
  assert.strictEqual(await waitForExit(immediate.child), 1, "fresh lock after hard crash is respected");

  const staleTime = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(dataDir, "server.lock"), staleTime, staleTime);
  server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  assert.match(server.output(), /stale lock/i);
  assert.strictEqual(await stop(server), 0);

  fs.writeFileSync(path.join(dataDir, "town-state.json"), "{broken-json");
  server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  assert.match(server.output(), /Recovered from backup: .*backups/);
  assert.strictEqual(await stop(server), 0);

  // With the primary and every rapid backup gone, hourly snapshots still recover the town.
  fs.writeFileSync(path.join(dataDir, "town-state.json"), "{broken-json");
  fs.rmSync(path.join(dataDir, "backups"), { recursive: true });
  server = spawnServer(dataDir, port, env);
  await waitForStart(server);
  assert.match(server.output(), /Recovered from backup: .*snapshots/);
  const recovered = await connectClient(port);
  await until(() => recovered.residents.size === 8, "snapshot recovery state");
  recovered.ws.close();
  assert.strictEqual(await stop(server), 0);
});

test("an uncaught exception exits non-zero without overwriting the save", async () => {
  const dataDir = tempDir("living-town-crash-");
  const port = await freePort();
  const crash = spawnServer(dataDir, port, {}, ["-e", "require('./server.js'); setTimeout(() => { throw new Error('intentional crash test'); }, 300);"]);
  assert.strictEqual(await waitForExit(crash.child), 1);
  assert.ok(!fs.existsSync(path.join(dataDir, "town-state.json")), "crash must not write the primary save");
  assert.ok(fs.readdirSync(dataDir).some(name => name.startsWith("crash-")), "crash state is kept for diagnosis");
});
