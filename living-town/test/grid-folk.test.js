"use strict";
// Kindle's neighbours (lib/grid-folk.js): nobody moves in without the owner's OK; a newcomer walks to the empty home.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createGlintLife } = require("../lib/glint-life");
const { createGridFolk } = require("../lib/grid-folk");
const { createGlintBrain } = require("../lib/glint-brain");

function grid() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grid-folk-"));
  const rows = Array.from({ length: 10 }, (_, y) => y === 5 ? "pppppppppp" : ".....p....");
  fs.writeFileSync(path.join(dir, "world.js"), `window.GLINT_WORLD = { size: 10, tiles: ${JSON.stringify(rows)}, things: [{ kind: "home", name: "Kindle's House", x: 5, y: 0 }, { kind: "cottage", name: "First Little House", x: 9, y: 4 }, { kind: "sign", name: "Signpost", x: 5, y: 9 }] };`);
  fs.writeFileSync(path.join(dir, "things.js"), "window.GLINT_THINGS = {};");
  return dir;
}

test("grid folk: nobody moves in until the owner allows it, then one walks to the waiting home", async () => {
  const gridDir = grid(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grid-folk-data-"));
  let t = Date.UTC(2026, 10, 17, 15);
  const life = createGlintLife({ gridDir, dataDir, now: () => t, hour: () => 15, think: async () => ({}) });
  const folk = createGridFolk({ dataDir, life, now: () => t, think: async () => ({ thought: "Cosy.", activity: "looking around", goTo: "stay", say: "", mood: "happy" }),
    cast: async () => ({ name: "Pip", color: "#ffb36b", personality: "shy", story: "Followed the lamps.", firstWords: "Hello?" }),
    brainFor: dir => createGlintBrain({ dir, now: () => t }), dreamer: async () => ({ file: [{ folder: "people", title: "Kindle", note: "built my house; kind" }] }) });
  for (let i = 0; i < 10; i++) folk.tick(0.5);
  await new Promise(r => setImmediate(r));
  assert.strictEqual(folk.view().length, 0, "nobody without the OK");
  assert.deepStrictEqual([...folk.freeHomes().map(h => h.name)], ["First Little House"], "his own home isn't free: " + JSON.stringify(life.world()?.places));
  folk.allow(1);
  folk.tick(0.5); await new Promise(r => setImmediate(r));
  const [pip] = folk.view();
  assert.strictEqual(pip.name, "Pip"); assert.strictEqual(pip.home, "First Little House");
  assert.ok(life.state().heard.some(h => h.includes("Pip")), "Kindle notices them arrive");
  for (let i = 0; i < 60; i++) { t += 500; folk.tick(0.5); }
  const p = folk.view()[0];
  assert.ok(Math.hypot(p.x - 9, p.y - 4) <= 1.01, `walked to the house (${p.x},${p.y})`);
  folk.tick(0.5); await new Promise(r => setImmediate(r));
  assert.strictEqual(folk.view().length, 1, "only as many as allowed");
  const brain = folk.brainOf("Pip");
  assert.ok(brain.page("me/who-i-am.md").lines[0].includes("First Little House"), "Pip's brain knows who they are");
  assert.ok(fs.existsSync(path.join(dataDir, "grid-folk", "pip", "brain", "raw")), "a raw dump of the day");
});
