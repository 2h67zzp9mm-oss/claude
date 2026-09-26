"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const { hydrateLifeState, runAutonomousExperience, runOfflineLife, shareKnowledge } = require("../life");

const root = path.resolve(__dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "living-town-test-"));
const port = 43000 + Math.floor(Math.random() * 1000);
const wsUrl = `ws://127.0.0.1:${port}/ws`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function spawnServer() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), LIVING_TOWN_DATA_DIR: dataDir, LIVING_TOWN_SNAPSHOT_MS: "1000" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk.toString(); });
  child.stderr.on("data", chunk => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function waitForStart(proc) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (proc.output().includes("Living Town server running")) return;
    if (proc.child.exitCode !== null) throw new Error(`server exited ${proc.child.exitCode}: ${proc.output()}`);
    await wait(50);
  }
  throw new Error(`server startup timeout: ${proc.output()}`);
}

function waitForExit(child, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve(child.exitCode);
    const timer = setTimeout(() => reject(new Error("process exit timeout")), timeout);
    child.once("exit", code => { clearTimeout(timer); resolve(code); });
  });
}

function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const client = { ws, latest: null };
    ws.on("message", raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === "state") client.latest = message;
      if (message.type === "resident-detail") client.detail = message.resident;
    });
    ws.once("open", () => resolve(client));
    ws.once("error", reject);
  });
}

async function until(check, label, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await wait(50);
  }
  throw new Error(`timeout: ${label}`);
}

(async () => {
  // Simulate a valid pre-0.2.4 save: Dad exists under the old display name,
  // while Hazel and the other residents have not been added yet.
  fs.writeFileSync(path.join(dataDir, "town-state.json"), JSON.stringify({
    version: 1,
    lastRealTime: Date.now(),
    simTime: Date.now(),
    eventId: 1,
    events: [{ id: 0, at: Date.now(), text: "Legacy town save." }],
    residents: [{
      id: "dad", name: "Dad", initial: "D", color: "#4fc3a1", trait: "helpful",
      x: 505, y: 505, targetX: 505, targetY: 505, place: "homes", activity: "settling in",
      needs: { energy: 82, hunger: 78, social: 72, fun: 75 }, memories: [], relationships: {}, lastTalk: 0
    }, {
      id: "guest_uncle_bob", name: "Uncle Bob", initial: "B", color: "#888888", trait: "visiting",
      x: 470, y: 520, targetX: 470, targetY: 520, place: "homes", activity: "visiting town",
      needs: { energy: 80, hunger: 80, social: 80, fun: 80 }, memories: [], relationships: {}, lastTalk: 0
    }]
  }));

  let server = spawnServer();
  await waitForStart(server);

  const second = spawnServer();
  assert.strictEqual(await waitForExit(second.child), 1, "a second writer must be refused");

  const a = await connectClient();
  const b = await connectClient();
  await until(() => a.latest?.state && b.latest?.state, "initial states");
  assert.strictEqual(a.latest.state.residents.length, 8, "legacy save must gain all seven core residents without deleting an unknown resident");
  assert.strictEqual(a.latest.state.residents.find(r => r.id === "olive")?.name, "Olive");
  assert.strictEqual(a.latest.state.residents.find(r => r.id === "hazel")?.name, "Hazel");
  assert.strictEqual(a.latest.state.residents.find(r => r.id === "dad")?.name, "Sean");
  a.ws.send(JSON.stringify({ type: "inspect", residentId: "olive" }));
  await until(() => a.detail?.id === "olive", "resident detail response");
  assert.strictEqual(a.detail.lifeHistory.length, 30, "Olive must return her full ten-year history");
  assert.ok(!Object.hasOwn(a.latest.state.residents[0], "lifeHistory"), "one-second state updates must omit heavy histories");

  await wait(1200);
  assert.strictEqual(server.child.exitCode, null, "an unknown resident must not crash the first simulation tick");
  assert.strictEqual(a.latest.state.residents.find(r => r.id === "guest_uncle_bob")?.place, "homes", "an unknown resident must receive a safe fallback schedule");

  const inspectedResidents = [];
  const coreIds = new Set(["olive", "hazel", "dad", "milo", "zara", "finn", "nova"]);
  for (const resident of a.latest.state.residents.filter(item => coreIds.has(item.id))) {
    a.ws.send(JSON.stringify({ type: "inspect", residentId: resident.id }));
    await until(() => a.detail?.id === resident.id, `inspect ${resident.id}`);
    const detail = a.detail;
    inspectedResidents.push(structuredClone(detail));
    const expectedHistoryCount = resident.id === "hazel" ? 21 : 30;
    assert.strictEqual(detail.lifeHistory.length, expectedHistoryCount, `${resident.name} must have three background events for every lived year in scope`);
    assert.ok(resident.profile?.summary, `${resident.name} must have a biography`);
    assert.ok(resident.goals?.length, `${resident.name} must have a goal`);
    assert.ok(detail.knowledge.length >= expectedHistoryCount, `${resident.name} must know their own background`);
  }
  a.ws.send(JSON.stringify({ type: "inspect", residentId: "hazel" }));
  await until(() => a.detail?.id === "hazel", "inspect Hazel for history checks");
  const hazel = a.detail;
  assert.strictEqual(hazel.lifeHistory.length, 21, "Hazel must have exactly seven years of personal history");
  assert.strictEqual(hazel.lifeHistory.filter(event => event.age === null).length, 0, "Hazel must not receive invented pre-birth history");
  a.ws.send(JSON.stringify({ type: "inspect", residentId: "dad" }));
  await until(() => a.detail?.id === "dad", "inspect Sean for history checks");
  const sean = a.detail;
  assert.ok(sean.lifeHistory.some(event => event.type === "promotion"), "Sean must have career promotions in his background");

  const lifeState = { ...structuredClone(a.latest.state), residents: inspectedResidents };
  const oliveLife = lifeState.residents.find(r => r.id === "olive");
  const miloLife = lifeState.residents.find(r => r.id === "milo");
  const learned = shareKnowledge(oliveLife, miloLife, Date.now());
  assert.strictEqual(learned.subjectId, "milo", "residents must learn persistent facts from each other");
  const beforeExperiences = miloLife.experiences.length;
  assert.ok(runAutonomousExperience(lifeState, miloLife, Date.now(), false), "autonomous life must create a visible event");
  assert.strictEqual(miloLife.experiences.length, beforeExperiences + 1, "autonomous experiences must persist");
  const beforeOffline = oliveLife.experiences.length;
  runOfflineLife(lifeState, 16, Date.now());
  assert.ok(oliveLife.experiences.length > beforeOffline, "offline time must produce lived experiences");

  const staleFactId = "hazel-history-1900-0";
  const migrationHazel = structuredClone(inspectedResidents.find(r => r.id === "hazel"));
  const migrationOlive = structuredClone(inspectedResidents.find(r => r.id === "olive"));
  migrationHazel.historyVersion = 1;
  migrationHazel.knowledge.push({ factId: staleFactId, subjectId: "hazel", text: "Before Hazel was born, stale test text.", learnedFrom: "self", learnedAt: Date.now() });
  migrationOlive.knowledge.push({ factId: staleFactId, subjectId: "hazel", text: "Before Hazel was born, stale test text.", learnedFrom: "hazel", learnedAt: Date.now() });
  const migrationState = { residents: [migrationHazel, migrationOlive] };
  hydrateLifeState(migrationState, Date.now());
  assert.strictEqual(migrationHazel.lifeHistory.length, 21, "Hazel migration must rebuild exactly seven lived years");
  assert.ok(!migrationHazel.knowledge.some(fact => fact.factId === staleFactId), "Hazel migration must remove her stale pre-birth knowledge");
  assert.ok(!migrationOlive.knowledge.some(fact => fact.factId === staleFactId), "migration must remove stale pre-birth facts learned by other residents");

  a.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: 700, y: 400 }));
  await until(() => {
    const dadA = a.latest?.state?.residents.find(r => r.id === "dad");
    const dadB = b.latest?.state?.residents.find(r => r.id === "dad");
    return dadA && dadB && dadA.x === dadB.x && dadA.y === dadB.y && dadA.targetX === 700;
  }, "two clients share one controlled resident");

  a.ws.send("not-json");
  a.ws.send(JSON.stringify({ type: "control", residentId: "milo", x: 10, y: 10 }));
  a.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: 99999, y: -99999 }));
  await until(() => {
    const dad = b.latest?.state?.residents.find(r => r.id === "dad");
    return dad?.targetX === 960 && dad?.targetY === 20;
  }, "out-of-range coordinates are clamped");
  assert.notStrictEqual(b.latest.state.residents.find(r => r.id === "milo").targetX, 10, "non-player control must be rejected");

  const targetBeforeClose = b.latest.state.residents.find(r => r.id === "dad").targetX;
  a.ws.close();
  await until(() => b.latest?.state?.residents.find(r => r.id === "dad")?.targetX !== targetBeforeClose, "disconnect releases control");

  await until(() => fs.existsSync(path.join(dataDir, "town-state.json")), "autosave file", 13000);
  await until(() => fs.existsSync(path.join(dataDir, "backups")) && fs.readdirSync(path.join(dataDir, "backups")).length > 0, "backup file", 13000);
  await until(() => fs.existsSync(path.join(dataDir, "snapshots")) && fs.readdirSync(path.join(dataDir, "snapshots")).length > 0, "hourly snapshot file", 13000);
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, "town-state.json"), "utf8"));
  assert.strictEqual(saved.version, 2);
  assert.strictEqual(saved.controllers, undefined, "ephemeral controller claims must never be saved");
  assert.strictEqual(fs.readdirSync(dataDir).some(name => name.includes(".tmp-")), false, "no temp file should remain after a completed save");

  b.ws.close();
  server.child.kill("SIGKILL");
  await waitForExit(server.child);

  const immediate = spawnServer();
  assert.strictEqual(await waitForExit(immediate.child), 1, "immediate restart after hard crash must respect fresh lock");

  const staleTime = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(dataDir, "server.lock"), staleTime, staleTime);
  server = spawnServer();
  await waitForStart(server);
  assert.match(server.output(), /stale lock/i);
  server.child.kill("SIGTERM");
  assert.strictEqual(await waitForExit(server.child), 0);

  fs.writeFileSync(path.join(dataDir, "town-state.json"), "{broken-json");
  server = spawnServer();
  await waitForStart(server);
  assert.match(server.output(), /Recovered from backup/);
  const recovered = await connectClient();
  await until(() => recovered.latest?.state?.residents?.length === 8, "backup recovery state");
  recovered.ws.close();
  server.child.kill("SIGTERM");
  assert.strictEqual(await waitForExit(server.child), 0);

  const crashDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "living-town-crash-test-"));
  const crashPort = port + 1001;
  const crash = spawn(process.execPath, ["-e", "require('./server.js'); setTimeout(() => { throw new Error('intentional crash test'); }, 150);"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(crashPort), LIVING_TOWN_DATA_DIR: crashDataDir },
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.strictEqual(await waitForExit(crash), 1, "an uncaught exception must exit non-zero for process supervision");

  console.log("PASS: age-accurate histories, stale-fact cleanup, unknown-resident safety, family migration, autonomous experiences, learning, offline life, shared state, validation, persistence, rapid backups, hourly snapshots, non-zero crash exit, hard-crash recovery, and corrupt-primary recovery");
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
