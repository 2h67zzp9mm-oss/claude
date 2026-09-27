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

test("at the square, people stand all round the fountain's paved ring, and performers on the stage", () => {
  const { area, stage } = world.places.square;
  let seed = 3;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const placed = [];
  for (let i = 0; i < 13; i++) {
    const p = crowd.freeSpot(placed, area, { sample: crowd.ringSampler(area), random });
    placed.push({ x: p.x, y: p.y, targetX: p.x, targetY: p.y });
  }
  const sides = new Set();
  for (const p of placed) {
    const r = Math.hypot(p.x - area.x, (p.y - area.y) / area.yScale);
    assert.ok(r >= area.rMin - 0.5 && r <= area.rMax + 0.5, `on the paved ring, not in the fountain (${r.toFixed(0)})`);
    assert.ok(world.inPlace("square", "olive", p.x, p.y), "still counts as at the square");
    sides.add(`${p.x < area.x ? "W" : "E"}${p.y < area.y ? "N" : "S"}`);
  }
  assert.strictEqual(sides.size, 4, "all the way round, not bunched on one side");
  for (const [i, a] of placed.entries()) for (const b of placed.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= crowd.BUBBLE);

  const troupe = [];
  for (let i = 0; i < 6; i++) {
    const p = crowd.freeSpot(troupe, stage, { sample: crowd.stageSampler(stage), random, bubble: crowd.BUBBLE - 2 });
    troupe.push({ x: p.x, y: p.y, targetX: p.x, targetY: p.y });
  }
  for (const p of troupe) assert.ok(Math.abs(p.x - stage.x) <= stage.w / 2 && Math.abs(p.y - stage.y) <= stage.h / 2, "performers on the stage");
  assert.ok(!world.inPlace("square", "olive", 474, 600), "far away isn't the square");
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
