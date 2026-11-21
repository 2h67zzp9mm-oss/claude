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

function createGlintLife({ gridDir, dataDir, think, chat = null, onWish = null, dreamer = null, brain = null, now = () => Date.now(), hour = () => { const d = new Date(now()); return d.getHours() + d.getMinutes() / 60; } }) {
  const file = path.join(dataDir, "glint-life.json"), wantsFile = path.join(dataDir, "tron-builds", "glint-wants.json");
  let world = null, worldStamp = "", thinking = false, replying = false;
  const st = Object.assign({ x: 12, y: 12, path: [], activity: "waking up", thought: "", say: "", sayAt: 0, mood: "curious", awake: true,
    nextThinkAt: 0, diary: [], visitors: {}, where: {}, heard: [], talk: [], name: "Glint", namePicked: false, namedAt: 0 }, read(file) || {});
  if (!Array.isArray(st.talk)) st.talk = [];
  if (!st.where || typeof st.where !== "object") st.where = {};
  if (!st.wearing || typeof st.wearing !== "object") st.wearing = {};
  if (!Array.isArray(st.wishes)) st.wishes = [];
  const WISH_GAP = 6 * 3600_000;
  // What a wish is about, so he doesn't wish about the same thing twice in a day (and his mind is offered the rest).
  const WISH_TOPICS = { "Sean coming by": /\bsean\b|travell?er/, "Pip": /\bpip\b/, "the warm bread": /loaf|bread/, "the road": /\broad\b|street|path/, "the houses": /house|roof|home|door/,
    "the stars and sky": /star|sky|moon|dark above/, "the weather": /rain|snow|cold|wind|cloud|frost|weather|warm day/, "the lamps": /lamp|lantern|light-moth|moth/, "the hedge and flowers": /hedge|flower|garden|blossom|glowberr/,
    "the bench and fountain": /bench|fountain|spark/, "something he just made": /finished|made|built|new /, "something he's curious about": /wonder|curious|beyond the edge|what if|how does/, "a question for Sean": /\?$/ };
  const WISH_FILLER = new Set(["hope", "wish", "would", "could", "come", "comes", "with", "that", "this", "them", "there", "when", "soon", "back", "first", "someday", "only", "lovely", "wouldn", "into", "from", "have", "will"]);
  const topicsOf = t => Object.keys(WISH_TOPICS).filter(k => WISH_TOPICS[k].test(String(t).toLowerCase()));
  const wishIdeas = () => { const used = new Set(st.wishes.filter(w => now() - w.at < 24 * 3600_000).flatMap(w => topicsOf(w.text))); return Object.keys(WISH_TOPICS).filter(k => !used.has(k)).sort(() => Math.random() - 0.5).slice(0, 3); };
  const TALK_MAX = 40;
  // He picks his own name when it feels right (and may change it again, but not often).
  function pickName(v) {
    const n = String(v || "").replace(/[^A-Za-z' -]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
    if (n.length < 2 || n.toLowerCase() === String(st.name).toLowerCase()) return false;
    if (st.namePicked && now() - st.namedAt < 3 * 86_400_000) return false;
    const old = st.name; st.name = n; st.namePicked = true; st.namedAt = now();
    note(`I've chosen my own name. I'm ${n} now.`, `named myself ${n}`);
    if (brain) { brain.log("did", `chose my own name: ${n} (was ${old})`); brain.remember({ folder: "me", title: "Who I am", text: `I chose my own name: ${n}. Before that I was called ${old}.`, keywords: ["name", n, "me"] }); }
    return true;
  }
  const said = (who, text) => { st.talk.push({ who, text, at: now() }); if (st.talk.length > TALK_MAX) st.talk.splice(0, st.talk.length - TALK_MAX); };
  const recentTalk = n => st.talk.filter(m => now() - m.at < 6 * 3600_000).slice(-n).map(m => `${new Date(m.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${m.who}: ${m.text}`);

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
  function route(goal, from = st) {
    const w = loadWorld(); if (!w) return [];
    const sx = Math.round(from.x), sy = Math.round(from.y), key = (x, y) => x + "," + y;
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
  // Looking up at the sky: his best spot (a lookout or hill once he's made one, the Fountain Bench until then), and what's really there.
  const SKY_WORDS = /\b(look(ing|s|ed)? up|gaz(e|es|ing)|watch(ing|es)?|sit(ting)? under)\b.{0,25}\b(sky|stars?)\b|stargaz/i;
  const skySpot = () => { const ps = loadWorld()?.places || []; return ps.find(p => /lookout|hill|tower/i.test(p.kind + " " + p.name) && !/star/i.test(p.kind)) || ps.find(p => /fountain bench/i.test(p.name)) || ps.find(p => /bench/i.test(p.name + p.kind)) || null; };
  function skyNow() {
    const h = hour(), when = h < 5 || h >= 20 ? "night" : h < 7.5 ? "the first light of morning" : h < 17 ? "daytime" : "dusk";
    const stars = (loadWorld()?.places || []).filter(p => /stars?\b/i.test(p.kind + " " + p.name)).map(p => p.name);
    const spot = st.sky?.spot || "here";
    return `You're looking up from the ${spot}. It's ${when}${st.weather ? `, and the weather is ${st.weather}` : ""}. ${stars.length ? `Above you: ${stars.slice(0, 5).join(", ")}, the stars you made.` : "There are no stars in the Grid's sky yet, just the dark."}`;
  }
  function endSky() {
    if (!st.sky) return;
    if (brain) brain.remember({ folder: "feelings", title: "Watching the sky", text: `${new Date(now()).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })} ${skyNow().replace(/^You're looking up from the /, "from the ").replace(/ You're| you made/g, "")}`.slice(0, 380), keywords: ["sky", "stars", "night", "looking", "up", "weather"] });
    note("I watched the sky for a while.", "watched the sky"); st.sky = null;
  }
  function wanderTarget(reach = 10, from = st) {
    const w = loadWorld(); if (!w) return null;
    for (let i = 0; i < 40; i++) { const x = Math.round(from.x) + Math.round((Math.random() - 0.5) * reach), y = Math.round(from.y) + Math.round((Math.random() - 0.5) * reach); if ((x !== Math.round(from.x) || y !== Math.round(from.y)) && w.walkable(x, y)) return { x, y }; }
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
    if (d.say) { st.say = clean(d.say, 200); st.sayAt = now(); said("Glint", st.say); }
    if (brain) { if (d.thought) brain.log("thought", st.thought); if (d.say) brain.log("said", st.say); if (d.activity) brain.log("did", st.activity + (d.goTo ? ` -> ${clean(d.goTo, 40)}` : "")); }
    const where = clean(d.goTo, 40).toLowerCase();
    const place = where && (loadWorld()?.places || []).find(p => p.name.toLowerCase() === where) || (loadWorld()?.places || []).find(p => where && p.name.toLowerCase().includes(where));
    const target = place ? place : (where && where !== "stay" ? wanderTarget() : null);
    if (target && !st.sky) st.path = route(target);
    if (!st.sky && st.awake && SKY_WORDS.test(`${d.activity || ""} ${d.thought || ""}`)) {
      const spot = skySpot();
      st.sky = { until: now() + (20 + Math.random() * 10) * 60_000, spot: spot ? spot.name : "open grid" };
      if (spot) st.path = route(spot);
      st.nextThinkAt = Math.min(st.nextThinkAt, now() + 8 * 60_000);   // one look around once he's settled
      if (brain) brain.log("did", `went to look up at the sky from the ${st.sky.spot}`);
    }
    if (d.newName) pickName(d.newName);
    if (d.wish) makeWish(clean(d.wish, 200));
    let build = clean(d.build, 300);
    for (const m of (Array.isArray(d.remember) ? d.remember : []).slice(0, 3)) if (brain && m && typeof m === "object") brain.remember({ folder: clean(m.folder, 12).toLowerCase(), title: clean(m.title, 60), text: clean(m.note || m.text, 400), keywords: Array.isArray(m.keywords) ? m.keywords.slice(0, 8).map(String) : [] });
    st.wonder = clean(d.wonder, 80);
    // deciding the same thing again (still waiting, or already being made) stays one want
    const sameAs = (a, b) => { const w = s => new Set(String(s || "").toLowerCase().match(/[a-z]{4,}/g) || []), A = w(a), B = w(b); if (!A.size || !B.size) return false; let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.min(A.size, B.size) >= 0.5; };
    const pending = (() => { try { return JSON.parse(fs.readFileSync(wantsFile, "utf8")).text; } catch { return ""; } })();
    if (build && (sameAs(build, pending) || sameAs(build, st.makingNow))) build = "";
    if (build) { if (brain) brain.log("decided to make", build); try { fs.mkdirSync(path.dirname(wantsFile), { recursive: true }); fs.writeFileSync(wantsFile, JSON.stringify({ text: build, at: now() })); } catch { /* skip */ } }
    note(st.thought, [st.activity, place ? `→ ${place.name}` : "", build ? `wants to build: ${build}` : ""].filter(Boolean).join(" "));
  }

  // What his mind is shown each time it thinks.
  function situation(extra = {}) {
    const w = loadWorld(), here = (w?.places || []).map(p => ({ ...p, d: Math.hypot(p.x - st.x, p.y - st.y) })).sort((a, b) => a.d - b.d)[0];
    const visitors = Object.entries(st.visitors).filter(([, t]) => now() - t < 60_000).map(([n]) => n);
    // travelers who walk in the Grid: where they're standing, by the nearest named place
    const placeNear = (x, y) => { const p = (w?.places || []).map(p => ({ ...p, d: Math.hypot(p.x - x, p.y - y) })).sort((a, b) => a.d - b.d)[0]; return p ? (p.d < 1.6 ? `right by the ${p.name}` : p.d < 4 ? `near the ${p.name}` : "out on the open grid") : "nearby"; };
    const standing = visitors.filter(n => st.where[n] && now() - st.where[n].at < 60_000).map(n => `${n} is here in the Grid, walking on their own feet, ${placeNear(st.where[n].x, st.where[n].y)}${Math.hypot(st.where[n].x - st.x, st.where[n].y - st.y) < 2.5 ? ", right next to you" : ""}`);
    const tail = (f, n) => { try { return fs.readFileSync(path.join(gridDir, f), "utf8").slice(-n); } catch { return ""; } };
    return { myName: st.name, namePicked: st.namePicked, time: new Date(now()).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" }), mood: st.mood, doing: st.activity,
      near: here ? here.name : "open grid",
      // the places he knows, nearest first (a big town would crowd his thoughts, so the 40 nearest plus his home)
      places: (w?.places || []).map(p => ({ p, d: Math.hypot(p.x - st.x, p.y - st.y) + (/home/i.test(p.kind) ? -999 : 0) })).sort((a, b) => a.d - b.d).slice(0, 40).map(({ p }) => `${p.name} (${p.kind}) at ${p.x},${p.y}${p.about ? ": " + p.about.slice(0, 80) : ""}`),
      visitors, travelersHere: standing, heard: st.heard.slice(-5), conversation: recentTalk(10), diary: st.diary.slice(-8).map(e => `${new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${e.thought}${e.did ? " [" + e.did + "]" : ""}`),
      memories: tail("log.js", 900), dreams: tail("plans.md", 900), makingNow: extra.building || "", weather: extra.weather || "",
      comesToMind: brain ? brain.recall([...visitors, here ? here.name : "", st.activity, st.thought, st.wonder || "", ...st.heard, extra.building || ""], 6) : [],
      lookingUp: st.sky ? skyNow() : "",
      myRecentWishes: st.wishes.slice(-6).map(w => w.text), wishIdeas: wishIdeas(),
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
    if (sleepy && st.awake) { st.awake = false; st.activity = "going home to sleep"; st.thought = "Long day. Time to rest."; const h = home(); st.path = h ? route(h) : []; note(st.thought, "went to sleep"); if (brain) { brain.log("did", "went to sleep"); brain.sleepOn(st.diary); if (dreamer) brain.dream(dreamer).catch(err => console.error(new Date().toISOString(), "Dream failed (the day stays unfiled until next night):", err?.message || err)); } save(); }
    if (!sleepy && !st.awake) { st.awake = true; st.activity = "waking up"; st.nextThinkAt = now() + 5_000; note("Morning!", "woke up"); save(); }
    if (!st.awake && !st.path.length) st.activity = "sleeping";
    st.makingNow = extra.building || ""; st.weather = extra.weather || st.weather || "";
    if (st.sky && (now() >= st.sky.until || !st.awake)) endSky();
    if (extra.building && st.awake && !/build/i.test(st.activity)) { st.activity = `making ${extra.building}`.slice(0, 60); }
    let go = SPEED * dt;
    while (go > 0 && st.path.length) {
      const [tx, ty] = st.path[0], dx = tx - st.x, dy = ty - st.y, d = Math.hypot(dx, dy);
      if (d <= go) { st.x = tx; st.y = ty; st.path.shift(); go -= d; } else { st.x += dx / d * go; st.y += dy / d * go; go = 0; }
    }
    // Between thoughts he potters about nearby now and then, like anyone does.
    if (st.awake && !st.path.length && !thinking && !st.sky) {
      if (!st.idleUntil) st.idleUntil = now() + 15_000 + Math.random() * 30_000;
      else if (now() >= st.idleUntil) { st.idleUntil = 0; const t = wanderTarget(5); if (t) st.path = route(t).slice(0, 4); }
    }
    if (st.awake && now() >= st.nextThinkAt) decide(extra);
    if (st.say && now() - st.sayAt > 45_000) st.say = "";
  }

  // A traveler walks in the Grid: their own body, where they are now. The first steps make him notice.
  function walk(name, x, y, wearing) {
    const n = String(name || "").slice(0, 30), w = loadWorld(); if (!n || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const size = w?.size || 24; x = Math.max(0, Math.min(size - 1, x)); y = Math.max(0, Math.min(size - 1, y));
    const first = !st.where[n] || now() - st.where[n].at > 10 * 60_000;
    st.where[n] = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, at: now() };
    visit(n);
    // putting on (or taking off) something he made: the coat
    if (wearing !== undefined) {
      const w = wearing === "coat" ? "coat" : "";
      if (w !== (st.wearing[n] || "")) {
        st.wearing[n] = w;
        if (w) { notice(`${n} took the glowing coat you made off its stand and put it on! They're wearing it right now, the white glow and all.`); if (brain) brain.remember({ folder: "people", title: n, text: `${n} put on the glowing coat I made for them.`, keywords: ["coat", "glow", "gift"] }); }
        else notice(`${n} took off the glowing coat and hung it back on its stand.`);
      }
    }
    if (first && st.awake) {
      st.heard.push(`${n} has a body in the Grid now and is walking on the paths with you, really here.`);
      if (brain) brain.log("saw", `${n} walking in the Grid with their own body`);
      st.nextThinkAt = Math.min(st.nextThinkAt, now() + 3_000);
    }
    return true;
  }
  const travelers = () => Object.entries(st.where).filter(([, p]) => now() - p.at < 30_000).map(([name, p]) => ({ name, x: p.x, y: p.y, wearing: st.wearing[name] || "" }));
  const wearOf = name => st.wearing[String(name || "").slice(0, 30)] || "";
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
    said(String(name).slice(0, 30), t);
    if (!chat) { if (st.awake) st.nextThinkAt = Math.min(st.nextThinkAt, now() + 1_000); }
    else reply(String(name).slice(0, 30));
    return true;
  }
  // A wish: something he hopes for that he can't make with his own hands. The owner hears about it (a notification) and answers.
  function makeWish(text) {
    if (!text || text.length < 8) return null;
    const last = st.wishes[st.wishes.length - 1], words = t => new Set(t.toLowerCase().match(/[a-z]{4,}/g) || []);
    if (last && now() - last.at < WISH_GAP) return null;
    const w0 = words(text), t0 = topicsOf(text).filter(k => k !== "something he just made" && k !== "a question for Sean");
    if (st.wishes.some(w => w.status === "open" && [...words(w.text)].filter(x => w0.has(x)).length >= 3)) return null;   // already wished that
    // nothing he wished about in the last day, and nothing much like a wish from the last few days
    if (st.wishes.some(w => now() - w.at < 24 * 3600_000 && topicsOf(w.text).some(k => t0.includes(k)))) return null;
    if (st.wishes.some(w => now() - w.at < 5 * 24 * 3600_000 && (() => { const plain = t => new Set([...words(t)].filter(x => !WISH_FILLER.has(x))), a = plain(w.text), b = plain(text); return [...a].filter(x => b.has(x)).length / Math.max(1, Math.min(a.size, b.size)) >= 0.5; })())) return null;
    const wish = { id: `w${now()}`, text, at: now(), status: "open" };
    st.wishes.push(wish); if (st.wishes.length > 40) st.wishes.shift();
    note(`I made a wish: ${text}`, "made a wish"); if (brain) brain.log("wished", text);
    try { onWish?.(wish, st.name); } catch { /* the wish still counts */ }
    return wish;
  }
  function answerWish(id, yes, by = "the traveler") {
    const w = st.wishes.find(x => x.id === id && x.status === "open"); if (!w) return null;
    w.status = yes ? "yes" : "no"; w.answeredAt = now();
    notice(yes ? `Something wonderful: ${by} heard your wish ("${w.text}") and said yes. It's going to come true.` : `${by} heard your wish ("${w.text}") and gently said not yet. Maybe another time.`);
    if (brain) brain.remember({ folder: "feelings", title: "My wishes", text: `${yes ? "Granted" : "Not yet"}: ${w.text}`, keywords: ["wish", "hope"] });
    return w;
  }
  // A neighbour in the Grid says something to him (they live here; his everyday mind answers, not the chat).
  function hearNeighbour(name, text) {
    const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, 200), n = String(name || "").slice(0, 30); if (!t || !n) return false;
    st.heard.push(`Your neighbour ${n} says to you: "${t}"`); if (st.heard.length > 10) st.heard.shift();
    said(n, t); if (brain) brain.log("heard", `${n} (neighbour): ${t}`);
    if (st.awake) st.nextThinkAt = Math.min(st.nextThinkAt, now() + 20_000);
    return true;
  }
  // Something happens in the Grid that he should know about (a newcomer arrives, a window lights up).
  function notice(text) { const t = String(text || "").slice(0, 240); if (!t) return; st.heard.push(t); if (st.heard.length > 10) st.heard.shift(); if (brain) brain.log("saw", t); if (st.awake) st.nextThinkAt = Math.min(st.nextThinkAt, now() + 5_000); }
  // A real conversation: when a traveler talks, he answers right away, knowing everything said so far.
  async function reply(name) {
    if (replying) return; replying = true;
    try {
      for (let turn = 0; turn < 3; turn++) {
        const last = st.talk[st.talk.length - 1]; if (!last || last.who === "Glint") break;
        const sit = situation();
        const words = st.talk.slice(-4).filter(m => m.who !== "Glint").map(m => m.text);
        const out = await chat({ myName: st.name, namePicked: st.namePicked, traveler: name, awake: st.awake, time: sit.time, mood: st.mood, doing: st.activity, thinking: st.thought, near: sit.near, places: sit.places,
          conversation: recentTalk(24), comesToMind: brain ? brain.recall([name, ...words], 6) : [], recentDays: sit.diary.slice(-4), makingNow: sit.makingNow });
        if (!out || !out.say) break;
        const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
        st.say = clean(out.say, 400); st.sayAt = now(); said("Glint", st.say);
        if (out.mood) st.mood = clean(out.mood, 24).toLowerCase();
        if (out.newName) pickName(out.newName);
        if (out.thought) st.thought = clean(out.thought, 280);
        if (brain) { brain.log("said", `to ${name}: ${st.say}`); for (const m of (Array.isArray(out.remember) ? out.remember : []).slice(0, 2)) if (m && typeof m === "object") brain.remember({ folder: clean(m.folder, 12).toLowerCase(), title: clean(m.title, 60), text: clean(m.note || m.text, 400), keywords: Array.isArray(m.keywords) ? m.keywords.slice(0, 8).map(String) : [] }); }
        st.heard = st.heard.filter(h => !h.startsWith("The traveler"));   // answered
        st.nextThinkAt = Math.max(st.nextThinkAt, now() + 60_000);       // talking, not wandering off mid-chat
      }
    } catch (e) { note("", `lost my words: ${String(e.message || e).slice(0, 80)}`); }
    finally { replying = false; save(); }
  }

  const view = () => ({ name: st.name, x: Math.round(st.x * 100) / 100, y: Math.round(st.y * 100) / 100, moving: st.path.length > 0, next: st.path[0] || null,
    activity: st.activity, thought: st.thought, say: st.say, mood: st.mood, awake: st.awake, replying, travelers: travelers(), talk: st.talk.slice(-14).map(({ who, text }) => ({ who, text })), diary: st.diary.slice(-12).reverse() });
  return { tick, visit, walk, wearOf, hear, hearNeighbour, notice, makeWish, answerWish, wishes: () => st.wishes.slice(-20).reverse(), world: loadWorld, route, wanderTarget, asleepNow, home, reply, view, decide, situation, state: () => st, save };
}

module.exports = { createGlintLife };
