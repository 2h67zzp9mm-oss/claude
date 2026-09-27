"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { cleanup, root, tempDir, freePort, spawnServer, until, waitForStart, waitForExit, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

const rejected = client => client.messages.filter(m => m.type === "control-rejected").length;

test("accounts: setup, ownership, lockout, revocation, persistence", async () => {
  const dataDir = tempDir("living-town-auth-");
  const port = await freePort();
  let server = spawnServer(dataDir, port);
  await waitForStart(server);

  const status = await api(port, "GET", "/api/auth/status");
  assert.strictEqual(status.body.initialized, false);
  assert.match(status.headers.get("content-security-policy"), /default-src 'self'/);
  assert.strictEqual(status.headers.get("x-content-type-options"), "nosniff");

  const setup = await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" });
  assert.strictEqual(setup.status, 200);
  const seanCookie = setup.cookie;
  assert.ok(!fs.readFileSync(path.join(dataDir, "player-accounts.json"), "utf8").includes("246810"), "PIN must be hashed");
  assert.strictEqual((await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "135790" })).status, 409);

  assert.strictEqual((await api(port, "POST", "/api/auth/profiles", { name: "Milo", residentId: "milo", pin: "1234" }, seanCookie)).status, 400, "only playable residents get players");
  const created = await api(port, "POST", "/api/auth/profiles", { name: "Olive", residentId: "olive", pin: "1357", look: { hair: "long", accessory: "star", shirt: "#a98cff" } }, seanCookie);
  assert.strictEqual(created.status, 201);
  const oliveId = created.body.profile.id;
  assert.strictEqual((await api(port, "POST", "/api/auth/profiles", { name: "X", residentId: "hazel", pin: "1234" })).status, 403);

  // A socket opened while signed out stays signed out; the client reconnects after login.
  const early = await connectClient(port);
  const login = await api(port, "POST", "/api/auth/login", { profileId: oliveId, pin: "1357" });
  assert.strictEqual(login.status, 200);
  const oliveCookie = login.cookie;
  early.ws.send(JSON.stringify({ type: "control", residentId: "olive", x: 800, y: 300 }));
  await until(() => rejected(early) === 1, "anonymous socket rejected with a reason");

  const watcher = await connectClient(port);
  const olive = await connectClient(port, { cookie: oliveCookie });
  const sean = await connectClient(port, { cookie: seanCookie });
  await until(() => watcher.residents.size && olive.residents.size && sean.residents.size, "initial states");

  sean.ws.send(JSON.stringify({ type: "control", residentId: "olive", x: 700, y: 400 }));
  await until(() => rejected(sean) === 1, "Sean cannot steer Olive");
  olive.ws.send(JSON.stringify({ type: "control", residentId: "olive", x: 700, y: 400 }));
  await until(() => watcher.residents.get("olive")?.targetX === 700, "Olive steers Olive");

  // Players restyle their own character; everyone sees it.
  assert.strictEqual((await api(port, "PUT", "/api/residents/olive/look", { look: { style: "curls", accessory: "bow", shirt: "#112233" } }, oliveCookie)).status, 200);
  await until(() => watcher.residents.get("olive")?.look?.style === "curls", "look broadcast");
  assert.strictEqual((await api(port, "PUT", "/api/residents/hazel/look", { look: { style: "bald" } }, oliveCookie)).status, 403, "players can only restyle their own character");

  // Logging out closes the open socket immediately.
  await api(port, "POST", "/api/auth/logout", undefined, oliveCookie);
  await until(() => olive.closedWith === 4001, "logout closes the socket");
  const stale = await connectClient(port, { cookie: oliveCookie });
  stale.ws.send(JSON.stringify({ type: "control", residentId: "olive", x: 500, y: 300 }));
  await until(() => rejected(stale) === 1, "revoked cookie cannot steer");

  // Brute force: five misses lock the profile, even for the right PIN.
  for (let i = 0; i < 5; i++) assert.strictEqual((await api(port, "POST", "/api/auth/login", { profileId: oliveId, pin: `000${i}` })).status, 401);
  const locked = await api(port, "POST", "/api/auth/login", { profileId: oliveId, pin: "1357" });
  assert.strictEqual(locked.status, 429);
  assert.ok(Number(locked.headers.get("retry-after")) > 0);

  // Owner PIN reset clears the lockout and signs the player out everywhere.
  const olive2 = await api(port, "PUT", `/api/auth/profiles/${oliveId}/pin`, { pin: "8642" }, seanCookie);
  assert.strictEqual(olive2.status, 200);
  const relog = await api(port, "POST", "/api/auth/login", { profileId: oliveId, pin: "8642" });
  assert.strictEqual(relog.status, 200);

  // Sessions survive a restart.
  [early, watcher, sean, stale].forEach(client => client.ws.close());
  assert.strictEqual(await stop(server), 0);
  server = spawnServer(dataDir, port);
  await waitForStart(server);
  assert.strictEqual((await api(port, "GET", "/api/auth/status", undefined, relog.cookie)).body.me?.id, oliveId);

  // Removing a player revokes their sessions.
  const oliveAgain = await connectClient(port, { cookie: relog.cookie });
  assert.strictEqual((await api(port, "DELETE", `/api/auth/profiles/${oliveId}`, undefined, seanCookie)).status, 200);
  await until(() => oliveAgain.closedWith === 4001, "removed player's socket closed");
  assert.strictEqual((await api(port, "DELETE", "/api/auth/profiles/sean", undefined, seanCookie)).status, 400, "owner cannot be removed");

  // Cross-site pages cannot open the socket.
  await assert.rejects(connectClient(port, { origin: "http://evil.example" }));
  assert.strictEqual(await stop(server), 0);

  // A damaged accounts file (and backup) must stop the server, not reopen setup.
  fs.writeFileSync(path.join(dataDir, "player-accounts.json"), "{damaged");
  fs.writeFileSync(path.join(dataDir, "player-accounts.json.bak"), "{damaged");
  const broken = spawnServer(dataDir, port);
  assert.strictEqual(await waitForExit(broken.child), 1);
  assert.match(broken.output(), /damaged/);

  // A damaged primary with a good backup recovers.
  fs.writeFileSync(path.join(dataDir, "player-accounts.json.bak"), JSON.stringify({ version: 1, profiles: [] }));
  server = spawnServer(dataDir, port);
  await waitForStart(server);
  assert.match(server.output(), /restored from backup/);
  assert.strictEqual(await stop(server), 0);
});

test("client shell and assets", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  assert.ok(html.includes("viewport-fit=cover"));
  assert.ok(!html.includes("user-scalable=no"));
  assert.ok(html.indexOf("map.css") < html.indexOf("</head>"), "stylesheets live in <head>");
  assert.ok(fs.statSync(path.join(root, "public", "assets", "town-map.webp")).size < 1_000_000);
});
