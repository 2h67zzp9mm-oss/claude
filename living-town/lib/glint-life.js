"use strict";
/**
 * Glint's life: Glint as a living character in his own Grid (public/glint/).
 *
 * The server keeps one Glint for everyone: where he is, where he's walking, what he's doing,
 * what he's thinking, his mood, and a diary. Every so often his mind (Claude, via `think`)
 * looks at his world, his diary, the time and who's visiting, and decides what to do next:
 * walk somewhere, think something, say something, or decide to build something. A build
 * decision is handed to the builder (deploy/tron-builder.cjs) through glint-wants.json.
 * At night he walks home and sleeps; his mind rests.
 *
 * Pure apart from the files it reads and writes, so it can be tested with a fake mind.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SPEED = 1.3;                         // tiles a second, same as the Grid's walkers
const THINK_MIN = 10 * 60_000, THINK_MAX = 15 * 60_000;
const SLEEP_FROM = 22.5, SLEEP_TO = 7;     // local hours
const DIARY_MAX = 60;

function createGlintLife({ gridDir, dataDir, think, dreamer = null, brain = null, now = () => Date.now(), hour = () => { const d = new Date(now()); return d.getHours() + d.getMinutes() / 60; } }) {
  const file = path.join(dataDir, "glint-life.json"), wantsFile = path.join(dataDir, "tron-builds", "glint-wants.json");
  let world = null, worldStamp = "", thinking = false;
  const st = Object.assign({ x: 12, y: 12, path: [], activity: "waking up", thought: "", say: "", sayAt: 0, mood: "curious", awake: true,
    nextThinkAt: 0, diary: [], visitors: {}, heard: [] }, read(file) || {});

  function read(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
  function save() { try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(st)); } catch { /* next time */ } }

  // His world, read from his own files (he may change their shape, so everything here is forgiving).
  function loadWorld() {
    const files = ["world.js", "things.js"].map(f => path.join(gridDir, f));
    let stamp = ""; try { stamp = files.map(f => fs.statSync(f).mtimeMs).join(","); } catch { return world; }
    if (stamp === worldStamp && world) return world;
    try {
      const w = {}; w.window = w; vm.createContext(w);
      vm.runInContext(fs.readFileSync(files[0], "utf8"), w, { timeout: 500 });
      const W = w.GLINT_WORLD || {}, size = Math.max(4, Math.min(200, Number(W.size) || 24));
      const tiles = Array.isArray(W.tiles) ? W.tiles.map(r => String(r)) : [];
      const things = (Array.isArray(W.things) ? W.things : []).filter(t => t && isFinite(t.x) && isFinite(t.y));
      const blocked = new Set(things.map(t => Math.round(t.x) + "," + Math.round(t.y)));
      const groundy = tiles.some(r => /[^.]/.test(r));
      const walkable = (x, y) => x >= 0 && y >= 0 && x < size && y < size && !blocked.has(x + "," + y) && (!groundy || ((tiles[y] || "")[x] || ".") !== ".");
      const places = things.filter(t => t.name || t.kind).map(t => ({ name: String(t.name || t.kind).slice(0, 40), kind: String(t.kind || ""), x: Math.round(t.x), y: Math.round(t.y), about: String(t.say || "").slice(0, 120) }));
      world = { size, walkable, places };
      worldStamp = stamp;
    } catch { /* keep the last good world */ }
    return world;
  }

  // Shortest walk on walkable tiles to the nearest walkable tile next to (or on) the goal.
  function route(goal) {
    const w = loadWorld(); if (!w) return [];
    const sx = Math.round(st.x), sy = Math.round(st.y), key = (x, y) => x + "," + y;
    const ok = (x, y) => w.walkable(x, y) || (x === sx && y === sy);
    const goals = new Set([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [goal.x + a, goal.y + b]).filter(([x, y]) => ok(x, y)).map(([x, y]) => key(x, y)));
    if (!goals.size) return [];
    const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (goals.has(key(x, y))) { const out = []; let k = key(x, y); while (k && k !== key(sx, sy)) { out.unshift(k.split(",").map(Number)); k = prev.get(k); } return out; }
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b; if (!prev.has(key(nx, ny)) && ok(nx, ny)) { prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]); } }
    }
    return [];
  }
  function wanderTarget(reach = 10) {
    const w = loadWorld(); if (!w) return null;
    for (let i = 0; i < 40; i++) { const x = Math.round(st.x) + Math.round((Math.random() - 0.5) * reach), y = Math.round(st.y) + Math.round((Math.random() - 0.5) * reach); if ((x !== Math.round(st.x) || y !== Math.round(st.y)) && w.walkable(x, y)) return { x, y }; }
    return null;
  }
  const home = () => (loadWorld()?.places || []).find(p => /home|house/i.test(p.kind + " " + p.name));
  const asleepNow = () => { const h = hour(); return SLEEP_FROM > SLEEP_TO ? (h >= SLEEP_FROM || h < SLEEP_TO) : (h >= SLEEP_FROM && h < SLEEP_TO); };
  const note = (thought, did) => { st.diary.push({ at: now(), thought: String(thought || "").slice(0, 300), did: String(did || "").slice(0, 120) }); if (st.diary.length > DIARY_MAX) st.diary.splice(0, st.diary.length - DIARY_MAX); };

  function apply(d) {
    if (!d || typeof d !== "object") return;
    const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
    if (d.thought) st.thought = clean(d.thought, 280);
    if (d.activity) st.activity = clean(d.activity, 60);
    if (d.mood) st.mood = clean(d.mood, 24).toLowerCase();
    if (d.say) { st.say = clean(d.say, 200); st.sayAt = now(); }
    if (brain) { if (d.thought) brain.log("thought", st.thought); if (d.say) brain.log("said", st.say); if (d.activity) brain.log("did", st.activity + (d.goTo ? ` -> ${clean(d.goTo, 40)}` : "")); if (d.build) brain.log("decided to make", clean(d.build, 300)); }
    const where = clean(d.goTo, 40).toLowerCase();
    const place = where && (loadWorld()?.places || []).find(p => p.name.toLowerCase() === where) || (loadWorld()?.places || []).find(p => where && p.name.toLowerCase().includes(where));
    const target = place ? place : (where && where !== "stay" ? wanderTarget() : null);
    if (target) st.path = route(target);
    const build = clean(d.build, 300);
    for (const m of (Array.isArray(d.remember) ? d.remember : []).slice(0, 3)) if (brain && m && typeof m === "object") brain.remember({ folder: clean(m.folder, 12).toLowerCase(), title: clean(m.title, 60), text: clean(m.note || m.text, 400), keywords: Array.isArray(m.keywords) ? m.keywords.slice(0, 8).map(String) : [] });
    st.wonder = clean(d.wonder, 80);
    if (build) { try { fs.mkdirSync(path.dirname(wantsFile), { recursive: true }); fs.writeFileSync(wantsFile, JSON.stringify({ text: build, at: now() })); } catch { /* skip */ } }
    note(st.thought, [st.activity, place ? `→ ${place.name}` : "", build ? `wants to build: ${build}` : ""].filter(Boolean).join(" "));
  }

  // What his mind is shown each time it thinks.
  function situation(extra = {}) {
    const w = loadWorld(), here = (w?.places || []).map(p => ({ ...p, d: Math.hypot(p.x - st.x, p.y - st.y) })).sort((a, b) => a.d - b.d)[0];
    const visitors = Object.entries(st.visitors).filter(([, t]) => now() - t < 60_000).map(([n]) => n);
    const tail = (f, n) => { try { return fs.readFileSync(path.join(gridDir, f), "utf8").slice(-n); } catch { return ""; } };
    return { time: new Date(now()).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" }), mood: st.mood, doing: st.activity,
      near: here ? here.name : "open grid", places: (w?.places || []).map(p => `${p.name} (${p.kind}) at ${p.x},${p.y}${p.about ? ": " + p.about : ""}`),
      visitors, heard: st.heard.slice(-5), diary: st.diary.slice(-8).map(e => `${new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${e.thought}${e.did ? " [" + e.did + "]" : ""}`),
      memories: tail("log.js", 900), dreams: tail("plans.md", 900), makingNow: extra.building || "",
      comesToMind: brain ? brain.recall([...visitors, here ? here.name : "", st.activity, st.thought, st.wonder || "", ...st.heard, extra.building || ""], 6) : [],
      brainSize: brain ? brain.count() : 0 };   // all in-world: never NOTES.md (that's the builder's)
  }

  async function decide(extra) {
    if (thinking) return; thinking = true;
    st.nextThinkAt = now() + THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN);
    try { apply(await think(situation(extra))); st.heard = []; } catch (e) { note("", `couldn't think: ${String(e.message || e).slice(0, 80)}`); }
    finally { thinking = false; save(); }
  }

  // Called about twice a second by the server.
  function tick(dt, extra = {}) {
    const sleepy = asleepNow();
    if (sleepy && st.awake) { st.awake = false; st.activity = "going home to sleep"; st.thought = "Long day. Time to rest."; const h = home(); st.path = h ? route(h) : []; note(st.thought, "went to sleep"); if (brain) { brain.log("did", "went to sleep"); brain.sleepOn(st.diary); if (dreamer) brain.dream(dreamer).catch(() => {}); } save(); }
    if (!sleepy && !st.awake) { st.awake = true; st.activity = "waking up"; st.nextThinkAt = now() + 5_000; note("Morning!", "woke up"); save(); }
    if (!st.awake && !st.path.length) st.activity = "sleeping";
    if (extra.building && st.awake && !/build/i.test(st.activity)) { st.activity = `making ${extra.building}`.slice(0, 60); }
    let go = SPEED * dt;
    while (go > 0 && st.path.length) {
      const [tx, ty] = st.path[0], dx = tx - st.x, dy = ty - st.y, d = Math.hypot(dx, dy);
      if (d <= go) { st.x = tx; st.y = ty; st.path.shift(); go -= d; } else { st.x += dx / d * go; st.y += dy / d * go; go = 0; }
    }
    // Between thoughts he potters about nearby now and then, like anyone does.
    if (st.awake && !st.path.length && !thinking) {
      if (!st.idleUntil) st.idleUntil = now() + 15_000 + Math.random() * 30_000;
      else if (now() >= st.idleUntil) { st.idleUntil = 0; const t = wanderTarget(5); if (t) st.path = route(t).slice(0, 4); }
    }
    if (st.awake && now() >= st.nextThinkAt) decide(extra);
    if (st.say && now() - st.sayAt > 20_000) st.say = "";
  }

  // A family member is looking at the Grid. Someone new makes him think soon.
  function visit(name) {
    const n = String(name || "").slice(0, 30); if (!n) return;
    const fresh = !st.visitors[n] || now() - st.visitors[n] > 10 * 60_000;
    st.visitors[n] = now();
    if (fresh && brain) brain.log("met", n);
    if (fresh && brain) brain.remember({ folder: "people", title: n, text: `${n} came to the Grid${st.awake ? "" : " while I was asleep"}.`, keywords: ["traveler", "visitor"] });
    if (fresh && st.awake) { st.heard.push(`A traveler named ${n} has wandered into the Grid.`); st.nextThinkAt = Math.min(st.nextThinkAt, now() + 4_000); }
  }
  // The owner talks to him in the Grid.
  function hear(name, text) {
    const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, 200); if (!t) return false;
    st.heard.push(`The traveler ${String(name).slice(0, 30)} says to you: "${t}"`); if (brain) brain.log("heard", `${String(name).slice(0, 30)}: ${t}`); if (st.heard.length > 10) st.heard.shift();
    if (st.awake) st.nextThinkAt = Math.min(st.nextThinkAt, now() + 1_000);
    return true;
  }

  const view = () => ({ x: Math.round(st.x * 100) / 100, y: Math.round(st.y * 100) / 100, moving: st.path.length > 0, next: st.path[0] || null,
    activity: st.activity, thought: st.thought, say: st.say, mood: st.mood, awake: st.awake, diary: st.diary.slice(-12).reverse() });
  return { tick, visit, hear, view, decide, situation, state: () => st, save };
}

module.exports = { createGlintLife };
