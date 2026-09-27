"use strict";

const test = require("node:test");
const assert = require("node:assert");
const WebSocket = require("ws");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient, api } = require("./helpers");
const { sameToken, readToken } = require("../lib/viewer");

test.after(cleanup);

const TOKEN = "visitor-test-token-abcdefghijklmnop";
const PRIVATE_FIELDS = ["profile", "relationships", "experiences", "memories", "knowledge", "lifeHistory", "goals", "career", "birthday"];

function visitorSocket(port, path, headers = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers });
  const client = { ws, messages: [], closed: null, failed: false };
  ws.on("message", raw => client.messages.push(JSON.parse(raw.toString())));
  ws.on("close", code => { client.closed = code; });
  ws.on("error", () => { client.failed = true; });
  ws.on("unexpected-response", () => { client.failed = true; });
  return client;
}

test("tokens: only long, plain tokens count, compared safely", () => {
  assert.strictEqual(readToken("/nonexistent", { LIVING_TOWN_VIEWER_TOKEN: "short" }), null);
  assert.strictEqual(readToken("/nonexistent", { LIVING_TOWN_VIEWER_TOKEN: "has spaces in it but is long enough" }), null);
  assert.strictEqual(readToken("/nonexistent", { LIVING_TOWN_VIEWER_TOKEN: TOKEN }), TOKEN);
  assert.ok(sameToken(TOKEN, TOKEN));
  assert.ok(!sameToken(TOKEN.slice(0, -1), TOKEN));
  assert.ok(!sameToken(`${TOKEN}x`, TOKEN));
});

test("visitor's window: secret link, read-only, no personal details", async () => {
  const dataDir = tempDir("living-town-viewer-");
  const port = await freePort();
  const viewerPort = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off", LIVING_TOWN_VIEWER: "on", LIVING_TOWN_VIEWER_TOKEN: TOKEN, LIVING_TOWN_VIEWER_PORT: String(viewerPort) });
  await waitForStart(server);
  const base = `http://127.0.0.1:${viewerPort}`;
  await until(async () => (await fetch(`${base}/`).catch(() => null))?.status === 404, "visitor window listening");

  // Only the secret path works; nothing of the main app is reachable here.
  for (const path of ["/", "/index.html", "/client.js", "/api/auth/status", "/ws", `/v/wrong-token-abcdefghijklmnopqrs/`, `/v/${TOKEN.slice(0, -1)}/`]) {
    assert.strictEqual((await fetch(base + path)).status, 404, path);
  }
  for (const method of ["POST", "PUT", "DELETE"]) assert.strictEqual((await fetch(`${base}/v/${TOKEN}/api/auth/setup`, { method })).status, 404, method);
  const page = await fetch(`${base}/v/${TOKEN}/`);
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /<html data-viewer="1"/);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.strictEqual((await fetch(`${base}/v/${TOKEN}/shared/world.js`)).status, 200);
  assert.strictEqual((await fetch(`${base}/v/${TOKEN}/rooms.js`)).status, 200);
  const redirect = await fetch(`${base}/v/${TOKEN}`, { redirect: "manual" });
  assert.strictEqual(redirect.status, 301);

  // Wrong token or another site's page: no socket.
  const wrong = visitorSocket(viewerPort, "/v/wrong-token-abcdefghijklmnopqrs/ws");
  const foreign = visitorSocket(viewerPort, `/v/${TOKEN}/ws`, { Origin: "https://evil.example" });
  await until(() => wrong.failed && foreign.failed, "bad sockets refused");

  // The real window gets the town, minus anything personal.
  const visitor = visitorSocket(viewerPort, `/v/${TOKEN}/ws`);
  await until(() => visitor.messages.some(m => m.type === "state") && visitor.messages.some(m => m.type === "tick"), "visitor receives the town");
  const full = visitor.messages.find(m => m.type === "state");
  assert.strictEqual(full.state.residents.length, 7);
  const olive = full.state.residents.find(r => r.id === "olive");
  assert.ok(olive.name && Number.isFinite(olive.x) && olive.look && olive.mood?.label);
  for (const r of [...full.state.residents, ...visitor.messages.find(m => m.type === "tick").residents]) {
    for (const field of PRIVATE_FIELDS) assert.ok(!(field in r), `${r.id}.${field} is not sent to visitors`);
    assert.deepStrictEqual(Object.keys(r.mood || {}), r.mood ? ["label"] : []);
  }
  assert.ok(Number.isFinite(full.town.mre.x), "Mr. E is visible to visitors");
  assert.ok(!("brain" in full.town));

  // Birthday and age news stays private.
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  await api(port, "POST", "/api/residents", { name: "Pip", age: 8, homeId: "roseCottage", look: {} }, owner);
  await until(() => visitor.messages.some(m => m.type === "state" && m.state.residents.some(r => r.name === "Pip")), "roster updates reach visitors");
  const everything = JSON.stringify(visitor.messages);
  assert.ok(!/birthday|years old/i.test(everything), "no birthdays or ages");

  // Read-only: sending anything ends the visit and changes nothing.
  const player = await connectClient(port, { cookie: owner });
  await until(() => player.residents.get("dad"), "player connected");
  const before = { ...player.residents.get("dad") };
  visitor.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: 477, y: 330 }));
  await until(() => visitor.closed === 1008, "visitor socket closed on any message");
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.notStrictEqual(player.residents.get("dad").intent, "following a player's lead");
  assert.strictEqual(player.residents.get("dad").place, before.place);

  // The main server is unchanged: still needs a session to play.
  const stranger = await connectClient(port);
  stranger.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: 477, y: 330 }));
  await until(() => stranger.messages.some(m => m.type === "control-rejected"), "main server still requires sign-in");
  player.ws.close();
  stranger.ws.close();
  assert.strictEqual(await stop(server), 0);
});

test("the visitor window is off without a token", async () => {
  const dataDir = tempDir("living-town-noviewer-");
  const port = await freePort();
  const viewerPort = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off", LIVING_TOWN_VIEWER: "on", LIVING_TOWN_VIEWER_TOKEN: "", LIVING_TOWN_VIEWER_PORT: String(viewerPort) });
  await waitForStart(server);
  await new Promise(resolve => setTimeout(resolve, 500));
  const reached = await fetch(`http://127.0.0.1:${viewerPort}/`).then(() => true, () => false);
  assert.strictEqual(reached, false);
  assert.strictEqual(await stop(server), 0);
});
