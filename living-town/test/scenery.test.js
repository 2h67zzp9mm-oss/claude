"use strict";

const test = require("node:test");
const assert = require("node:assert");
const world = require("../shared/world");
const holder = {};
// scenery.js is a browser script that attaches itself to its global object.
new Function("self", require("fs").readFileSync(require("path").join(__dirname, "../public/scenery.js"), "utf8"))(holder);
const { create, skyAt, LAMPS, WINDOWS, CHIMNEYS } = holder.LivingTownScenery;

const at = time => new Date(`2026-09-27T${time}:00`).getTime();

test("the sky follows the real clock: day, golden evening, dusk and night", () => {
  assert.strictEqual(skyAt(at("13:00")).dark, 0);
  assert.ok(!skyAt(at("13:00")).lampsOn);
  const golden = skyAt(at("18:40"));
  assert.ok(golden.tint && golden.tint[0] === 255 && golden.dark < 0.1, "golden evening");
  const dusk = skyAt(at("20:20"));
  assert.ok(dusk.lampsOn && dusk.dark > 0.2 && dusk.dark < 0.58, "dusk: lamps on, getting dark");
  const night = skyAt(at("23:00"));
  assert.ok(night.night && night.lampsOn && night.dark > 0.5);
  assert.ok(skyAt(at("06:30")).dark < skyAt(at("05:00")).dark, "dawn gets lighter");
});

test("traced lamps, windows and chimneys sit on the map and belong to real buildings", () => {
  for (const [x, y] of [...LAMPS, ...Object.values(WINDOWS).flat(), ...Object.values(CHIMNEYS).flat()]) {
    assert.ok(x >= 0 && x <= world.MAP.width && y >= 0 && y <= world.MAP.height, `${x},${y} on the map`);
  }
  const ids = new Set(world.buildings.map(b => b.id));
  for (const id of [...Object.keys(WINDOWS), ...Object.keys(CHIMNEYS)]) assert.ok(ids.has(id), id);
  assert.ok(LAMPS.length >= 25);
});

test("animals: ducks go to whoever's watching them, birds fly off when someone comes close", () => {
  let seed = 9;
  const scene = create({ MAP: world.MAP, random: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
  const midday = at("13:00");
  const watching = [{ name: "Hazel", x: 150, y: 135, activity: "watching the ducks", visible: true }];
  for (let i = 0; i < 400; i++) scene.update(0.1, midday, { residents: watching, awakeInside: () => false });
  // Drawing is browser-only; check what the scene would draw through a tiny fake canvas.
  const drawn = [];
  const fake = { save() {}, restore() {}, translate(x, y) { this.t = [x, y]; }, scale() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}, set fillStyle(c) { if (c === "#f4a261" && this.t) drawn.push([...this.t]); }, set globalAlpha(a) {} };
  scene.drawBelow(fake, skyAt(midday));
  const ducks = drawn.filter(([x, y]) => Math.hypot(x - 115, y - 117) < 70);
  assert.ok(ducks.length >= 1 && ducks.some(([x]) => Math.abs(x - 150) < 40), "ducks drift to Hazel's side of the pond");

  let seed2 = 4;
  const scene2 = create({ MAP: world.MAP, random: () => (seed2 = (seed2 * 16807) % 2147483647) / 2147483647 });
  scene2.update(0.1, midday, { residents: [], awakeInside: () => false });
  const bird = scene2.snapshot().birds[0];
  assert.strictEqual(bird.state, "hop", "birds hop about by day");
  const spooked = [{ name: "Bolt", x: bird.x + 5, y: bird.y, activity: "", visible: true }];
  scene2.update(0.1, midday, { residents: spooked, awakeInside: () => false });
  assert.strictEqual(scene2.snapshot().birds[0].state, "fly", "and fly off when someone comes close");
  for (let i = 0; i < 40; i++) scene2.update(0.1, midday, { residents: spooked, awakeInside: () => false });
  assert.notStrictEqual(scene2.snapshot().birds[0].state, "hop");
  // At night the birds are away.
  const night = create({ MAP: world.MAP, random: () => 0.3 });
  for (let i = 0; i < 40; i++) night.update(0.1, at("23:00"), { residents: [], awakeInside: () => false });
  assert.ok(night.snapshot().birds.every(b => b.state !== "hop"));
  assert.match(scene2.catStatus(), /napping|wandering|sitting|following/);
});

test("chimney smoke only where someone's awake indoors", () => {
  const scene = create({ MAP: world.MAP, random: () => 0.01 });
  const puffs = [];
  const fake = { save() {}, restore() {}, translate() {}, scale() {}, fillRect() {}, beginPath() {}, fill() {}, arc(x, y) { puffs.push([x, y]); }, set fillStyle(c) {}, set globalAlpha(a) {} };
  for (let i = 0; i < 30; i++) scene.update(0.1, at("13:00"), { residents: [], awakeInside: id => id === "seanHouse" });
  scene.drawBelow(fake, skyAt(at("13:00")));
  const [cx, cy] = CHIMNEYS.seanHouse[0];
  assert.ok(puffs.length > 0 && puffs.every(([x, y]) => Math.abs(x - cx) < 20 && y <= cy + 1), "smoke rises from Sean's chimney only");
});
