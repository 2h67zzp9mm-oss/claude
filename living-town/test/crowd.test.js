"use strict";

const test = require("node:test");
const assert = require("node:assert");
const world = require("../shared/world");
const interiors = require("../shared/interiors");
const crowd = require("../lib/crowd");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient } = require("./helpers");

test.after(cleanup);

test("a crowd at the square spreads out with room for everyone, on the walkways", () => {
  const square = world.places.square;
  const snap = p => world.snapToWalkable(p.x, p.y);
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const placed = [];
  for (let i = 0; i < 16; i++) {
    const p = crowd.freeSpot(placed, square, { spread: 64, placeRadius: world.PLACE_RADIUS - 8, snap, random });
    placed.push({ x: p.x, y: p.y, targetX: p.x, targetY: p.y });
  }
  for (const [i, a] of placed.entries()) {
    assert.ok(Math.hypot(a.x - square.x, a.y - square.y) <= world.PLACE_RADIUS - 8, "still at the square");
    const onPath = world.snapToWalkable(a.x, a.y);
    assert.ok(Math.hypot(onPath.x - a.x, onPath.y - a.y) < 0.01, "on the walkways");
    for (const b of placed.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= crowd.BUBBLE, "nobody stands on anybody");
  }
});

test("people use the whole plaza, not just the middle", () => {
  const square = world.places.square;
  const snap = p => world.snapToWalkable(p.x, p.y);
  let seed = 5;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const placed = [];
  for (let i = 0; i < 12; i++) {
    const p = crowd.freeSpot(placed, square, { spread: 64, placeRadius: world.PLACE_RADIUS - 8, snap, random });
    placed.push({ x: p.x, y: p.y, targetX: p.x, targetY: p.y });
  }
  const distances = placed.map(p => Math.hypot(p.x - square.x, p.y - square.y));
  const average = distances.reduce((a, b) => a + b, 0) / distances.length;
  assert.ok(average > 28, `spread out (average ${average.toFixed(0)} from the middle)`);
  assert.ok(distances.filter(d => d > 40).length >= 3, "some near the edges");
});

test("someone on top of a person standing still is crowded; passing by isn't", () => {
  const me = { x: 100, y: 100, targetX: 100, targetY: 100 };
  assert.ok(crowd.crowded(me, [{ x: 104, y: 101, targetX: 104, targetY: 101 }]));
  assert.ok(!crowd.crowded(me, [{ x: 104, y: 101, targetX: 300, targetY: 101 }]), "walking past is fine");
  assert.ok(!crowd.crowded(me, [{ x: 130, y: 100, targetX: 130, targetY: 100 }]));
});

test("on a real server, nobody standing still stands on anybody else", async () => {
  const dataDir = tempDir("living-town-crowd-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off", LIVING_TOWN_TROUPE: "on" });
  await waitForStart(server);
  const client = await connectClient(port);
  await until(() => client.residents.size === 13, "everyone, troupe included");
  const squashed = () => {
    const standing = [...client.residents.values()].filter(r => Math.hypot(r.targetX - r.x, r.targetY - r.y) < 1 && !interiors.locate(r, world));
    const pairs = [];
    for (const [i, a] of standing.entries()) for (const b of standing.slice(i + 1)) if (Math.hypot(a.x - b.x, a.y - b.y) < crowd.BUBBLE * 0.8) pairs.push(`${a.name}+${b.name}`);
    return pairs;
  };
  // Anyone squashed steps aside within a few seconds, and it stays that way.
  await until(() => squashed().length === 0, "everyone has room", 20000);
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.deepStrictEqual(squashed(), []);
  }
  client.ws.close();
  assert.strictEqual(await stop(server), 0);
});
