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

test("glint brain: he writes notes in folders, finds them again by keyword, links them and sleeps on the day", async () => {
  const { createGlintBrain } = require("../lib/glint-brain");
  const gridDir = grid(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-data-"));
  let t = Date.UTC(2026, 10, 13, 15), h = 15;
  const brain = createGlintBrain({ dir: path.join(dataDir, "glint-brain"), now: () => t });
  let seen = null, n = 0;
  const life = createGlintLife({ gridDir, dataDir, brain, now: () => t, hour: () => h, think: async sit => { seen = sit; n++;
    return n === 1 ? { thought: "Hazel likes purple!", remember: [{ folder: "people", title: "Hazel", note: "Hazel loves purple and asked for a [[Purple Bridge]].", keywords: ["purple"] }, { folder: "ideas", title: "Purple Bridge", note: "A purple bridge over the stream.", keywords: ["bridge"] }], wonder: "purple" } : { thought: "hmm" }; } });
  life.visit("Hazel"); life.tick(0.5); await new Promise(r => setImmediate(r));
  assert.ok(fs.existsSync(path.join(dataDir, "glint-brain", "people", "hazel.md")), "a note for Hazel");
  assert.match(fs.readFileSync(path.join(dataDir, "glint-brain", "people", "hazel.md"), "utf8"), /loves purple/);
  t += 20 * 60_000; life.state().nextThinkAt = 0; life.tick(0.5); await new Promise(r => setImmediate(r));
  const came = seen.comesToMind.map(m => m.note);
  assert.ok(came.includes("Hazel") && came.includes("Purple Bridge"), `recalled by keyword and link: ${came}`);
  h = 23; t += 1000; life.tick(0.5);
  assert.ok(Object.values(brain.map().days).length === 1, "a page for the day");
  assert.deepEqual(brain.recall("../../etc"), brain.recall("etc")); assert.equal(brain.page("../index.json"), null);
});

test("glint brain: the day's dump is filed into his notes while he sleeps", async () => {
  const { createGlintBrain } = require("../lib/glint-brain");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-brain-"));
  const brain = createGlintBrain({ dir });
  brain.log("heard", "Hazel: can you make a purple bridge?"); brain.log("thought", "I'll make it tomorrow.");
  let got = null;
  const n = await brain.dream(async d => { got = d; return { file: [{ folder: "people", title: "Hazel", note: "wants:purple bridge; promised:yes", keywords: ["bridge"] }], self: "builder; keeps promises" }; });
  assert.match(got.dump, /purple bridge/); assert.equal(n, 1);
  assert.equal(brain.recall("bridge")[0].note, "Hazel");
  assert.equal(await brain.dream(async () => { throw new Error("filed twice"); }), 0, "each day is filed once");
});

test("glint life: talking gets a real reply right away, and he sees the whole conversation", async () => {
  const gridDir = grid(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-data-"));
  let t = 1_000_000, asked = null;
  const life = createGlintLife({ gridDir, dataDir, now: () => t, hour: () => 15, think: async () => ({}),
    chat: async sit => { asked = sit; return { say: sit.conversation.length > 2 ? "You said blue earlier!" : "Hello, traveler.", mood: "happy" }; } });
  life.hear("Sean", "Hi Glint");
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(life.view().talk.at(-1).text, "Hello, traveler.");
  t += 1000; life.hear("Sean", "My favourite colour is blue");
  await new Promise(r => setTimeout(r, 20));
  assert.ok(asked.conversation.some(l => l.includes("Hello, traveler.")), "he sees what he said before");
  assert.strictEqual(life.view().talk.at(-1).text, "You said blue earlier!");
  assert.ok(life.situation().conversation.length >= 4, "his everyday mind knows about the chat too");
});

test("glint life: he can pick his own name, and it sticks", async () => {
  const gridDir = grid(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-data-"));
  let t = 1_000_000;
  const life = createGlintLife({ gridDir, dataDir, now: () => t, hour: () => 15, think: async () => ({}),
    chat: async sit => (sit.namePicked ? { say: `I'm ${sit.myName}.` } : { say: "I think I'll be Lumen.", newName: "Lumen" }) });
  assert.strictEqual(life.view().name, "Glint");
  life.hear("Sean", "Would you like to pick your own name?"); await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(life.view().name, "Lumen");
  t += 1000; life.hear("Sean", "Who are you?"); await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(life.view().talk.at(-1).text, "I'm Lumen.");
  assert.strictEqual(life.situation().myName, "Lumen");
});
