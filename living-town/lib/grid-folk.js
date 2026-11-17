"use strict";
/**
 * Kindle's neighbours: the folk who come to live in the Grid when his dreams come true.
 *
 * Nobody arrives unless the owner allows it (`allow`). Then a newcomer, cast from Kindle's own dream
 * (`cast`, Claude, once), walks in from the edge of town to the home that was waiting for them.
 * Each neighbour has a small mind on the local model (`think`, every 20-30 minutes): they walk the paths,
 * potter about, sleep at night in their own home (so a window glows that Kindle didn't light), and talk with
 * Kindle when they're near him. Everything they say goes through the family-friendly filter (`safe`).
 *
 * Each neighbour has a brain like Kindle's (lib/glint-brain.js, in data/grid-folk/<name>/brain): what comes to mind
 * when they think, a raw dump of their day, and at night their mind files the day into notes (`dreamer`, local model).
 *
 * Like Kindle, they believe the Grid is the whole world. Nothing they read or say is ever about a game.
 */
const fs = require("fs");
const path = require("path");

const SPEED = 1.1, THINK_MIN = 20 * 60_000, THINK_MAX = 30 * 60_000, NEAR = 4;

function createGridFolk({ dataDir, life, think, cast = null, safe = () => true, brainFor = null, dreamer = null, now = () => Date.now() }) {
  const brains = new Map();
  const slug = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const brainOf = f => { if (!brainFor) return null; if (!brains.has(f.name)) brains.set(f.name, brainFor(path.join(dataDir, "grid-folk", slug(f.name), "brain"))); return brains.get(f.name); };
  const file = path.join(dataDir, "grid-folk.json");
  let st = { folk: [], allowed: 0, pending: null };
  try { st = { ...st, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch { /* nobody yet */ }
  const save = () => { try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(st)); } catch { /* next time */ } };
  const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
  const ok = t => t && safe(t);
  let busy = false, casting = false;

  // Homes with nobody in them (his houses, not his own home), nearest-dreamed first.
  function freeHomes() {
    const w = life.world(), mine = life.home(), taken = new Set(st.folk.map(f => f.home));
    return (w?.places || []).filter(p => /house|home|cottage/i.test(p.kind + " " + p.name) && p !== mine && !(mine && p.name === mine.name) && !taken.has(p.name));
  }
  function edge() {   // they come in from beyond the edge, by the welcome sign
    const w = life.world(); if (!w) return { x: 0, y: 0 };
    const h = life.home() || { x: w.size / 2, y: w.size / 2 }, signs = w.places.filter(p => /sign/i.test(p.kind)).sort((a, b) => Math.hypot(b.x - h.x, b.y - h.y) - Math.hypot(a.x - h.x, a.y - h.y));
    const sign = signs[0] || { x: w.size / 2, y: w.size - 1 };   // the sign furthest from his home: the edge of town
    let best = null;
    for (let y = 0; y < w.size; y++) for (let x = 0; x < w.size; x++) if (w.walkable(x, y)) { const d = Math.hypot(x - sign.x, y - sign.y); if (!best || d < best.d) best = { x, y, d }; }
    return best || { x: sign.x, y: sign.y };
  }

  /** The owner allows N more newcomers (and optionally names the home). */
  function allow(n = 1, home = "") { st.allowed = Math.max(0, Math.min(6, (st.allowed || 0) + n)); if (home) st.wantHome = clean(home, 40); save(); return st.allowed; }

  async function arrive(dreams) {
    if (casting || st.allowed < 1) return null;
    const homes = freeHomes(); if (!homes.length) return null;
    const home = homes.find(h => st.wantHome && h.name.toLowerCase() === st.wantHome.toLowerCase()) || homes[0];
    casting = true;
    try {
      const spec = (cast && await cast({ home: home.name, homeAbout: home.about, dreams, neighbours: st.folk.map(f => `${f.name}: ${f.personality}`) })) || {};
      const name = clean(spec.name, 20).replace(/[^A-Za-z' -]/g, "") || "Pip";
      if (!ok(name) || st.folk.some(f => f.name === name) || name.toLowerCase() === "kindle") return null;
      const at = edge();
      const f = { id: `f${now()}`, name, home: home.name, color: /^#[0-9a-f]{6}$/i.test(spec.color || "") ? spec.color : "#ffb36b",
        personality: ok(clean(spec.personality, 200)) ? clean(spec.personality, 200) : "gentle and curious",
        story: ok(clean(spec.story, 300)) ? clean(spec.story, 300) : "Came in from beyond the edge, following the lights.",
        x: at.x, y: at.y, path: life.route(home, at), activity: `walking toward the ${home.name}`, thought: "", say: ok(clean(spec.firstWords, 160)) ? clean(spec.firstWords, 160) : "Hello? Is anyone here?",
        sayAt: now(), mood: "hopeful", awake: true, diary: [], arrivedAt: now(), nextThinkAt: now() + 4 * 60_000 };
      st.folk.push(f); st.allowed -= 1; st.wantHome = ""; save();
      const b = brainOf(f);
      if (b) { b.remember({ folder: "me", title: "Who I am", text: `I'm ${f.name}. ${f.personality} ${f.story} My home is the ${f.home}.`, keywords: [f.name, "me", "home"] }); b.log("arrived", `came in from beyond the edge to the ${f.home}`); }
      life.notice(`Someone new has come in from beyond the edge of the Grid! Their name is ${f.name}, and they're walking up Lantern Street toward the ${f.home}, the home you made. They called out: "${f.say}"`);
      return f;
    } finally { casting = false; }
  }

  const near = (f, x, y) => Math.hypot(f.x - x, f.y - y) < NEAR;
  function situation(f) {
    const w = life.world(), k = life.state(), hour = new Date(now()).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
    const kindleNear = near(f, k.x, k.y);
    return { you: f.name, yourHome: f.home, whoYouAre: f.personality, yourStory: f.story, time: hour, mood: f.mood, doing: f.activity,
      places: (w?.places || []).map(p => p.name), kindle: `${k.name || "Kindle"} built this town. Right now he's ${k.activity}${kindleNear ? ", close enough to talk to" : ", too far away to talk to"}.`,
      kindleSaidLately: kindleNear && k.say ? k.say : "", recentTalk: (k.talk || []).slice(-6).filter(m => m.who === f.name || m.who === "Glint").map(m => `${m.who === "Glint" ? (k.name || "Kindle") : "you"}: ${m.text}`),
      otherNeighbours: st.folk.filter(o => o !== f).map(o => `${o.name} (${o.activity})`), yourDiary: f.diary.slice(-6).map(e => `${new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${e.thought}`),
      comesToMind: brainOf(f) ? brainOf(f).recall([f.activity, f.thought, kindleNear ? "Kindle" : "", kindleNear && k.say ? k.say : "", f.home], 4) : [] };
  }
  async function decide(f) {
    f.nextThinkAt = now() + THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN);
    let d = null; try { d = await think(situation(f)); } catch { return; }
    if (!d || typeof d !== "object") return;
    const thought = clean(d.thought, 240), act = clean(d.activity, 60), say = clean(d.say, 200), mood = clean(d.mood, 20).toLowerCase();
    if (ok(thought)) f.thought = thought; if (ok(act)) f.activity = act; if (ok(mood)) f.mood = mood;
    const where = clean(d.goTo, 40).toLowerCase(), w = life.world();
    const place = where && (w?.places || []).find(p => p.name.toLowerCase() === where || p.name.toLowerCase().includes(where));
    const target = place || (where && where !== "stay" ? life.wanderTarget(8, f) : null);
    if (target) f.path = life.route(target, f);
    const k = life.state(), b = brainOf(f);
    if (ok(say)) { f.say = say; f.sayAt = now(); if (near(f, k.x, k.y)) life.hearNeighbour(f.name, say); }
    if (b) { b.log("thought", f.thought); b.log("did", f.activity + (place ? ` -> ${place.name}` : "")); if (ok(say)) b.log("said", say); if (near(f, k.x, k.y) && k.say) b.log("heard", `Kindle: ${k.say}`); }
    f.diary.push({ at: now(), thought: f.thought, did: f.activity }); if (f.diary.length > 30) f.diary.shift();
  }

  /** About twice a second, from the server. dreams: Kindle's dream list, used when someone arrives. */
  function tick(dt, dreams = "") {
    if (st.allowed > 0 && !casting && freeHomes().length) arrive(dreams).catch(() => {});
    const sleepy = life.asleepNow();
    for (const f of st.folk) {
      if (sleepy && f.awake) { const b = brainOf(f); if (b) { b.log("did", "went home to sleep"); b.sleepOn(f.diary); if (dreamer) b.dream(dreamer).catch(() => {}); } f.awake = false; f.activity = "going home to sleep"; const h = (life.world()?.places || []).find(p => p.name === f.home); f.path = h ? life.route(h, f) : []; }
      if (!sleepy && !f.awake) { f.awake = true; f.activity = "waking up"; f.nextThinkAt = now() + 60_000 + Math.random() * 10 * 60_000; }
      if (!f.awake && !f.path.length) f.activity = "asleep at home, a light in the window";
      let go = SPEED * dt;
      while (go > 0 && f.path.length) { const [tx, ty] = f.path[0], dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy); if (d <= go) { f.x = tx; f.y = ty; f.path.shift(); go -= d; } else { f.x += dx / d * go; f.y += dy / d * go; go = 0; } }
      if (f.say && now() - f.sayAt > 30_000) f.say = "";
      if (f.awake && now() >= f.nextThinkAt && !busy) { busy = true; decide(f).finally(() => { busy = false; save(); }); }
    }
  }
  const view = () => st.folk.map(f => ({ name: f.name, home: f.home, color: f.color, x: Math.round(f.x * 100) / 100, y: Math.round(f.y * 100) / 100, next: f.path[0] || null, moving: f.path.length > 0,
    activity: f.activity, say: f.say, awake: f.awake, homeLit: !f.awake && !f.path.length }));
  return { tick, allow, arrive, view, save, state: () => st, freeHomes, brainOf: name => { const f = st.folk.find(x => x.name === name); return f ? brainOf(f) : null; } };
}

module.exports = { createGridFolk };
