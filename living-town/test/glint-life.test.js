"use strict";
// Glint's life (lib/glint-life.js): he walks on real paths, thinks, notices visitors, sleeps at night and decides what to build.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createGlintLife } = require("../lib/glint-life");

function grid() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-life-"));
  const rows = Array.from({ length: 10 }, (_, y) => y === 5 ? "pppppppppp" : ".....p....");
  fs.writeFileSync(path.join(dir, "world.js"), `window.GLINT_WORLD = { size: 10, tiles: ${JSON.stringify(rows)}, things: [{ kind: "home", name: "My House", x: 9, y: 4 }, { kind: "fountain", name: "Spark Fountain", x: 5, y: 0 }] };`);
  fs.writeFileSync(path.join(dir, "things.js"), "window.GLINT_THINGS = {};");
  fs.writeFileSync(path.join(dir, "log.js"), "window.GLINT_LOG = [];");
  return dir;
}

test("glint life: he thinks, walks the paths to where he decided, notices visitors and wants to build", async () => {
  const gridDir = grid(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-data-"));
  let t = Date.UTC(2026, 10, 13, 15), seen = null;
  const life = createGlintLife({ gridDir, dataDir, now: () => t, hour: () => 15, think: async sit => { seen = sit; return { thought: "The fountain is calling me.", activity: "walking to the fountain", goTo: "Spark Fountain", mood: "happy", say: sit.visitors.length ? `Hi ${sit.visitors[0]}!` : "", build: "a little bridge" }; } });
  life.state().x = 0; life.state().y = 5;
  life.visit("Hazel");
  life.tick(0.5); await new Promise(r => setImmediate(r));
  assert.ok(seen, "he thought"); assert.deepEqual(seen.visitors, ["Hazel"]); assert.ok(seen.places.some(p => p.startsWith("Spark Fountain")));
  const v = life.view();
  assert.equal(v.say, "Hi Hazel!"); assert.equal(v.mood, "happy"); assert.ok(v.moving, "he set off");
  for (let i = 0; i < 40; i++) { t += 500; life.tick(0.5); const s = life.state(); assert.ok(s.y === 5 || Math.abs(s.x - 5) < 1e-9, `stays on the paths (${s.x},${s.y})`); }
  assert.deepEqual([life.state().x, life.state().y], [5, 1], "arrived next to the fountain");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "tron-builds", "glint-wants.json"), "utf8")).text, "a little bridge");
  assert.ok(life.state().diary.length >= 1);
});

test("glint life: at night he walks home and sleeps, and his mind rests", async () => {
  const gridDir = grid(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-data-"));
  let h = 23, thoughts = 0, t = 0;
  const life = createGlintLife({ gridDir, dataDir, now: () => t, hour: () => h, think: async () => { thoughts++; return {}; } });
  life.state().x = 0; life.state().y = 5;
  for (let i = 0; i < 60; i++) { t += 500; life.tick(0.5); }
  assert.equal(life.view().awake, false); assert.equal(life.view().activity, "sleeping"); assert.equal(thoughts, 0, "no thinking while asleep");
  assert.deepEqual([life.state().x, life.state().y], [9, 5], "went home (next to his house)");
  h = 8; t += 500; life.tick(0.5); assert.equal(life.view().awake, true);
});
