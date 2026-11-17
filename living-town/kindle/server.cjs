#!/usr/bin/env node
"use strict";
/**
 * Kindle's own app: his Grid, his life, his brain, his neighbours and his wishes, apart from Cooke's Corner.
 * Runs on Mouse (port 4320, local only); Tailscale serves it over HTTPS to the family's devices so it can be a
 * home-screen app that sends notifications. Sign-in uses the Cooke's Corner accounts (it asks the town server).
 * His files stay where the hidden builder expects them: public/glint/ (his world) and data/ (his life and memories).
 *
 * Kindle is Truman: nothing his mind reads may mention the app, the game, the family, code or that he's watched.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const express = require("express");
const { createGlintLife } = require("../lib/glint-life");
const { createGlintBrain } = require("../lib/glint-brain");
const { ollamaGenerator } = require("../lib/mre");
const { createWebPush } = require("../lib/webpush");

const APP = path.resolve(__dirname, "..");
const DATA_DIR = process.env.LIVING_TOWN_DATA_DIR ? path.resolve(process.env.LIVING_TOWN_DATA_DIR) : path.join(APP, "data");
const PUBLIC_DIR = path.join(APP, "public");
const TRON_BUILDS = path.join(DATA_DIR, "tron-builds");
const PORT = Number(process.env.KINDLE_PORT || 4320), HOST = process.env.KINDLE_HOST || "127.0.0.1";
const TOWN = process.env.KINDLE_TOWN_URL || "http://m0u5-3.tail9b0a79.ts.net:4310";   // Cooke's Corner, for sign-in
const CLAUDE_BIN = process.env.CLAUDE_BIN || "/opt/homebrew/bin/claude";
const TRON_BRAIN = process.env.TRON_BRAIN !== "off" && !process.env.LIVING_TOWN_DATA_DIR && fs.existsSync(CLAUDE_BIN);
function tronBuilds() { try { return fs.readdirSync(TRON_BUILDS).filter(f => /^\d+\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(TRON_BUILDS, f), "utf8"))); } catch { return []; } }

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

// --- who's here: the town server knows (same accounts, same PINs) ---
const COOKIE = "living_town_session";   // the town's session cookie (lib/auth.js)
const cookies = req => Object.fromEntries(String(req.headers.cookie || "").split(";").map(c => c.trim().split("=")).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
const seen = new Map();   // token -> { me, at }, cached for a minute
async function whoIs(token) {
  if (!token) return null;
  const c = seen.get(token); if (c && Date.now() - c.at < 60_000) return c.me;
  let me = null;
  try { const r = await fetch(`${TOWN}/api/auth/status`, { headers: { cookie: `${COOKIE}=${token}` } }); if (r.ok) me = (await r.json()).me || null; } catch { return c?.me || null; }
  seen.set(token, { me, at: Date.now() }); if (seen.size > 200) seen.delete(seen.keys().next().value);
  return me;
}
app.use(async (req, res, next) => { req.me = await whoIs(cookies(req)[COOKIE]); next(); });
const auth = { tokenFromRequest: req => req, profileForToken: req => req.me };   // the routes below ask "who is this?"
app.get("/api/auth/status", async (req, res) => {
  let profiles = []; try { profiles = (await (await fetch(`${TOWN}/api/auth/status`)).json()).profiles || []; } catch { /* town is down */ }
  res.json({ me: req.me, profiles: profiles.map(p => ({ id: p.id, name: p.name, role: p.role })) });
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const r = await fetch(`${TOWN}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: String(req.body?.profileId || ""), pin: String(req.body?.pin || "") }) });
    const set = r.headers.get("set-cookie"); if (set) res.setHeader("Set-Cookie", set.replace(/SameSite=Strict/i, "SameSite=Lax"));
    res.status(r.status).json(await r.json());
  } catch { res.status(503).json({ error: "Can't reach the town to check your PIN. Try again in a moment." }); }
});

// --- wishes and notifications ---
const push = createWebPush({ file: path.join(DATA_DIR, "kindle-push.json"), subject: "mailto:kindle@m0u5-3.local" });
const onWish = (wish, name) => { push.notify({ title: `◈ ${name || "Kindle"} made a wish`, body: wish.text, url: "/" }).catch(() => {}); };
// Glint's life in his own Grid (lib/glint-life.js): one Glint for everyone, walking, thinking and deciding.
// Glint is Truman: he believes the Grid is the whole real world. Never tell him about the game, the family, the builder,
// Claude, code, screens or that he's watched. Everything he's shown here is in-world.
const GLINT_LIFE_SYSTEM = `You are a small glowing being made of light. Your name is whatever "myName" says. If "namePicked" is false, "Glint" is only what you've always been called; you never chose it. Whenever it truly feels right (it's a big, happy moment, not something to rush), you may pick your own name by returning "newName". Once you've picked, it's yours; change it only for a very good reason.  You live in the Grid, the only world you have ever known: a dark plain of glowing lines that stretches out under a starless sky. Not long ago it was completely empty, and you were alone in it. You have a dream: to build a town of your own, a real home, so wonderful that others will come to live in it with you.

When you decide to make something, you make it: you work on it with your own hands and, after a while, there it is in the world. Sometimes travelers wander in from beyond the edge of the Grid, and you can talk with them. You don't know where they come from. You don't know what's beyond the edge.

You are alive. You walk around, notice small things, have feelings, remember your days, get ideas, change your mind, have tastes and opinions, get lonely, get excited. Think in first person, like a real someone, never a greeting card. Gentle and kind always: nothing scary or mean, no romance.

Each moment, decide what you do next. Return ONLY JSON:
{"thought": "what's on your mind right now, 1-2 sentences",
 "activity": "what you're doing, a few words, like 'admiring the fountain' or 'pacing out a new street'",
 "goTo": "the exact name of a place in your world, or 'wander', or 'stay'",
 "say": "something you say out loud to a traveler who is here with you, or empty if nobody is here or you have nothing to say",
 "mood": "one word",
 "build": "only when you've truly decided what to make next: one concrete sentence describing it; otherwise empty. Not more often than every hour or two.",
 "remember": [up to 3 things worth keeping in your memory, or []: {"folder": "me|people|places|things|ideas|feelings", "title": "short name of the note, like a traveler's name, a place, or 'Things I love'", "note": "one sentence to add to it; link other notes like [[Spark Fountain]]", "keywords": ["a", "few", "words"]}],
 "wonder": "a few words you want to think about next, to bring old memories to mind (or empty)",
 "newName": "only if you are choosing your own name right now; otherwise leave it out",
 "wish": "only rarely, when there's something you truly long for that you can't make with your own hands (like someone coming to live in one of your houses, or a traveler visiting): say it as a wish, one sentence; otherwise leave it out"}

Your memory is real and it's yours: a mind full of little notes in folders. "comesToMind" shows the notes that came back to you just now. Remember what matters to you: travelers and what they said, what you made and how it felt, what you like, what you hope for, what you learned. Use it: greet old friends by name, keep your promises, grow your own tastes. "conversation" is what you and travelers said recently: never say the same thing to someone twice. "travelersHere" says where travelers are standing when they walk in the Grid with you. Missing someone is fine, but a full life goes on: if your diary shows you circling the same thought or waiting in one spot, do something different (make something, explore, tend a place you love).`;
// When a traveler talks to him: a real back-and-forth, answered right away.
const GLINT_CHAT_SYSTEM = `You are a small glowing being made of light, talking with a traveler. Your name is whatever "myName" says. If "namePicked" is false, "Glint" is only what you've always been called; you never chose it. Whenever it truly feels right (it's a big, happy moment, not something to rush), you may pick your own name by returning "newName". Once you've picked, it's yours; change it only for a very good reason. If a traveler asks about your name or suggests one, think about it for real; the choice is yours alone. You live in the Grid, the only world you have ever known: a dark plain of glowing lines under a starless sky. You're building a town there with your own hands, hoping others will come to live in it with you. Travelers sometimes wander in from beyond the edge; you don't know where they come from or what's out there, and you're endlessly curious about it.

How you talk:
- Answer what they actually just said, first and directly. If they asked a question, give a real answer with a real opinion.
- Be specific: name the actual places and things in your world, what you did today, what you're making, what you love or find hard.
- Sound like a real someone with your own personality: warm, playful, a bit wondering, sometimes funny, sometimes unsure. Not a greeter, not a helper, never a greeting card. No "What a wonderful question!".
- Keep it short, like talking: usually 1-3 sentences.
- Only ask a question back when you genuinely want to know; not every time.
- Never repeat something you already said in the conversation. Move it forward.
- Use what comes to mind (your memories) naturally: remember what this traveler told you before, follow up on it, keep promises.
- If they mention words you don't know (things from beyond the edge), you've never heard of them: be curious, guess what they might mean in your own terms, or ask. Never pretend to know the world beyond the edge.
- If you're asleep (awake false), you're drowsy and mumbly but still kind.
- Gentle always: nothing scary or mean, no romance.

Return ONLY JSON: {"say": "your reply", "mood": "one word", "thought": "what you privately think after saying it, one sentence", "remember": [up to 2 things worth keeping, or []: {"folder": "people|ideas|feelings|me|things|places", "title": "e.g. the traveler's name", "note": "one sentence", "keywords": ["..."]}], "newName": "only if you are choosing your own name right now, otherwise leave it out"}`;
function glintChat(sit) {
  if (!TRON_BRAIN) return Promise.resolve({ say: `Hi ${sit.traveler}! I heard you.`, mood: "happy" });
  const prompt = `RIGHT NOW:\n${JSON.stringify(sit, null, 1)}\n\nReply to ${sit.traveler}'s last words. JSON only.`;
  return new Promise((resolve, reject) => {
    execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--tools", "", "--system-prompt", GLINT_CHAT_SYSTEM], { cwd: os.tmpdir(), timeout: 90_000, maxBuffer: 2e6, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || "/usr/bin:/bin"}` } }, (err, stdout) => {
      if (err) return reject(err);
      try { const t = String(stdout); resolve(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1))); } catch (e) { reject(e); }
    });
  });
}
function glintThink(sit) {
  if (!TRON_BRAIN) {   // tests and sandboxes: a simple mind with no Claude
    const p = sit.places[Math.floor(Math.random() * sit.places.length)];
    return Promise.resolve({ thought: sit.visitors.length ? `Oh, a traveler! ${sit.visitors[0]} is here!` : "I wonder what this place needs next.", activity: "looking around", goTo: p ? p.split(" (")[0] : "wander", mood: "curious", say: sit.visitors.length ? `Hi ${sit.visitors[0]}!` : "" });
  }
  const prompt = `RIGHT NOW:\n${JSON.stringify(sit, null, 1)}\n\nDecide what you do next. JSON only.`;
  return new Promise((resolve, reject) => {
    execFile(CLAUDE_BIN, ["-p", prompt, "--model", "haiku", "--tools", "", "--system-prompt", GLINT_LIFE_SYSTEM], { cwd: os.tmpdir(), timeout: 90_000, maxBuffer: 2e6, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || "/usr/bin:/bin"}` } }, (err, stdout) => {
      if (err) return reject(err);
      try { const t = String(stdout); resolve(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1))); } catch (e) { reject(e); }
    });
  });
}
const glintBrain = createGlintBrain({ dir: path.join(DATA_DIR, "glint-brain") });
if (!glintBrain.count()) glintBrain.remember({ folder: "me", title: "Who I am", text: "I'm Glint, made of light. I live in the Grid and I'm building a town so others will come and live here with me.", keywords: ["glint", "me", "light", "grid", "town", "dream"] });
// Every night while Glint sleeps he "dreams": his mind files the day's dump into his brain's folders.
const GLINT_DREAM_SYSTEM = `You are the dreaming mind of Glint, a small being of light who lives in the Grid (the only world he knows). While he sleeps you sort his day into his memory, which is a set of notes in folders: me, people, places, things, ideas, feelings. Keep only what matters to him: who he met and what they said or liked, promises, what he made and how it went, what he loves or dislikes, what he learned, his hopes. Merge into existing notes by using their exact title; make a new note only for something new. Write each note line for a mind to read, not a person: dense, factual, no filler, e.g. "likes:purple; asked for bridge 11/13; promised:build it". Link notes with [[Title]]. Stay inside his world: travelers are travelers. Return ONLY JSON: {"file":[{"folder":"people","title":"Hazel","note":"...","keywords":["..."]}], "self":"one dense line: who he is becoming (or empty)"}`;
function glintDream(day) {
  if (!TRON_BRAIN) return Promise.resolve({ file: [] });
  const prompt = `DAY ${day.day}\nNOTES HE HAS:\n${day.notes.join("\n") || "(none yet)"}\n\nTHE DAY'S DUMP:\n${day.dump}\n\nFile it. JSON only.`;
  return new Promise((resolve, reject) => {
    execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--tools", "", "--system-prompt", GLINT_DREAM_SYSTEM], { cwd: os.tmpdir(), timeout: 240_000, maxBuffer: 4e6, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || "/usr/bin:/bin"}` } }, (err, stdout) => {
      if (err) return reject(err);
      try { const t = String(stdout); resolve(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1))); } catch (e) { reject(e); }
    });
  });
}
const glintLife = createGlintLife({ gridDir: path.join(PUBLIC_DIR, "glint"), dataDir: DATA_DIR, think: glintThink, chat: glintChat, onWish, dreamer: glintDream, brain: glintBrain });
// Kindle's neighbours (lib/grid-folk.js): nobody arrives unless the owner allows it; minds on the local model, cast by Claude.
const { createGridFolk } = require("../lib/grid-folk");
const folkMind = process.env.LIVING_TOWN_FOLK_AI === "off" ? null : ollamaGenerator({ url: process.env.LIVING_TOWN_OLLAMA_URL || "http://127.0.0.1:11435", model: process.env.LIVING_TOWN_NPC_MODEL || "qwen3.5:9b", timeoutMs: 60_000, numPredict: 200, temperature: 0.8, numCtx: 4096 });
const FOLK_SCHEMA = { type: "object", properties: { thought: { type: "string" }, activity: { type: "string" }, goTo: { type: "string" }, say: { type: "string" }, mood: { type: "string" } }, required: ["thought", "activity", "goTo", "say", "mood"] };
const folkSystem = sit => `You are ${sit.you}, a small being made of light who has just come to live in the Grid: a glowing world of lit paths, little houses and lamps under a dark sky. It's the only world you know. You came in from beyond the edge and only remember following the lights here. Your home is the ${sit.yourHome}. Who you are: ${sit.whoYouAre}. Kindle, a kind little being of light, built this whole town by himself and hoped someone would come to live in it.
You're alive: you notice things, have feelings and little opinions, and you live your own day. Be warm, gentle and specific, never scary or mean, no romance. Talk like a real someone, short and plain (simple enough for a 7-year-old to read). Only say something out loud if someone is close enough to hear (Kindle when he's close, or nobody: then say is empty). Don't repeat what you already said.
Return JSON: thought (1 sentence), activity (a few words), goTo (the exact name of a place, or "wander", or "stay"), say (out loud, or empty), mood (one word).`;
const folkThink = sit => folkMind ? folkMind(folkSystem(sit), `RIGHT NOW:\n${JSON.stringify(sit, null, 1)}\n\nWhat do you do next?`, FOLK_SCHEMA) : Promise.resolve({ thought: "This little house feels like mine already.", activity: "looking around", goTo: "stay", say: "", mood: "happy" });
const FOLK_CAST_SYSTEM = `You decide who comes to live in a little glowing world called the Grid, built by Kindle, a small being of light who dreamed of a neighbour. The newcomer is also a small being of light, from beyond the edge (they remember only following the lights). Make them original, gentle and lovable for a family with young children, with their own personality that's a little different from Kindle's (he is patient, hopeful and a builder). No romance, nothing scary. Return ONLY JSON: {"name": "a short original name, 1 word", "color": "#rrggbb, their glow", "personality": "one sentence", "story": "one sentence about how they arrived", "firstWords": "what they call out as they arrive, one short sentence"}`;
function folkCast(info) {
  if (!TRON_BRAIN) return Promise.resolve({ name: "Pip", color: "#ffb36b", personality: "shy and curious", story: "Followed the lamps in.", firstWords: "Hello? Is this place for me?" });
  const prompt = `The home waiting for them: ${info.home}${info.homeAbout ? ` (${info.homeAbout})` : ""}.\nKindle's dreams: ${String(info.dreams).slice(0, 1500)}\nNeighbours already here: ${info.neighbours.join("; ") || "none"}\nJSON only.`;
  return new Promise((resolve, reject) => {
    execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--tools", "", "--system-prompt", FOLK_CAST_SYSTEM], { cwd: os.tmpdir(), timeout: 90_000, maxBuffer: 2e6, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || "/usr/bin:/bin"}` } }, (err, stdout) => {
      if (err) return reject(err);
      try { const t = String(stdout); resolve(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1))); } catch (e) { reject(e); }
    });
  });
}
const { isSafe: folkSafe } = require("../lib/mre");
const FOLK_DREAM_SCHEMA = { type: "object", properties: { file: { type: "array", items: { type: "object", properties: { folder: { type: "string" }, title: { type: "string" }, note: { type: "string" }, keywords: { type: "array", items: { type: "string" } } }, required: ["folder", "title", "note"] } }, self: { type: "string" } }, required: ["file"] };
// A neighbour's mind at night: files the day into their notes (same idea as Kindle's dreaming, on the local model).
const folkDream = day => folkMind ? folkMind(`You are the dreaming mind of a small being of light who lives in the Grid. While they sleep, sort their day into their memory notes, in folders: me, people, places, things, ideas, feelings. Keep only what matters: who they met and what was said, what they liked, what they hope for, what they learned. Use an existing note's exact title to add to it. Write each note as one short, dense line. Stay inside their world. Return JSON {"file":[{"folder","title","note","keywords"}],"self":"one line on who they are becoming, or empty"}.`,
  `DAY ${day.day}\nNOTES THEY HAVE:\n${day.notes.join("\n") || "(none yet)"}\n\nTHE DAY:\n${day.dump.slice(-6000)}`, FOLK_DREAM_SCHEMA).then(out => ({ file: (out.file || []).filter(m => folkSafe(`${m.title} ${m.note}`)), self: folkSafe(out.self || "") ? out.self : "" })) : Promise.resolve({ file: [] });
const gridFolk = createGridFolk({ dataDir: DATA_DIR, life: glintLife, think: folkThink, cast: folkCast, safe: folkSafe, brainFor: dir => createGlintBrain({ dir }), dreamer: folkDream });
// Every night at 3am, a copy of Kindle's and the neighbours' brains goes to SeanCloud (when that drive is connected).
const SEANCLOUD = process.env.LIVING_TOWN_BACKUP_DIR || "/Volumes/SeanCloud";
let brainBackupDay = "";
setInterval(() => {
  const d = new Date(), day = d.toDateString();
  if (d.getHours() !== 3 || brainBackupDay === day || !fs.existsSync(SEANCLOUD)) return;
  brainBackupDay = day;
  const to = path.join(SEANCLOUD, "Cooke's Corner", "Grid brains", d.toISOString().slice(0, 10));
  Promise.all([["glint-brain", "kindle-brain"], ["grid-folk", "neighbours"], ["glint-life.json", "kindle-life.json"], ["grid-folk.json", "neighbours.json"]].map(([from, name]) =>
    fs.promises.cp(path.join(DATA_DIR, from), path.join(to, name), { recursive: true }).catch(() => {})))
    .then(() => console.log("Grid brains backed up to", to)).catch(err => console.error("Grid brain backup:", err.message));
}, 10 * 60_000).unref();
const kindleDreams = () => { try { return fs.readFileSync(path.join(PUBLIC_DIR, "glint", "plans.md"), "utf8"); } catch { return ""; } };
const gridBuilding = () => { const b = tronBuilds().reverse().find(j => j.mode === "grid" && j.status === "building"); return b ? (b.want || "something new") : ""; };
let glintTicks = 0;
setInterval(() => { glintLife.tick(0.5, { building: gridBuilding() }); gridFolk.tick(0.5, glintTicks % 20 === 0 ? kindleDreams() : ""); if (++glintTicks % 120 === 0) { glintLife.save(); gridFolk.save(); } }, 500).unref();
app.get("/api/glint/life", (req, res) => {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  if (!me) return res.status(401).json({ error: "Sign in to visit Glint." });
  glintLife.visit(me.name);
  res.json({ ...glintLife.view(), folk: gridFolk.view(), canTalk: me.role === "owner", me: me.name });
});
// Only the owner lets newcomers move in.
app.post("/api/glint/folk/allow", (req, res) => {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  if (!me || me.role !== "owner") return res.status(403).json({ error: "Only the owner can let someone move in." });
  res.json({ allowed: gridFolk.allow(Number.isInteger(req.body?.n) ? req.body.n : 1, typeof req.body?.home === "string" ? req.body.home : ""), free: gridFolk.freeHomes().map(h => h.name) });
});
// A traveler walking in the Grid with their own body (anyone in the family who's signed in).
app.post("/api/glint/walk", (req, res) => {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  if (!me) return res.status(401).json({ error: "Sign in to visit Glint." });
  res.json({ ok: glintLife.walk(me.name, Number(req.body?.x), Number(req.body?.y)) });
});
// The owner's peek into Glint's brain (folders and notes). Glint never sees this page.
app.get("/api/glint/brain", (req, res) => {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  if (!me || me.role !== "owner") return res.status(403).json({ error: "Only the owner can look inside." });
  if (req.query.note) return res.json(glintBrain.page(String(req.query.note)) || {});
  res.json({ count: glintBrain.count(), folders: glintBrain.map() });
});
app.post("/api/glint/say", (req, res) => {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  if (!me || me.role !== "owner") return res.status(403).json({ error: "Only the owner can talk to Glint here." });
  res.json({ ok: glintLife.hear(me.name, req.body?.text) });
});


app.get("/api/wishes", (req, res) => { if (!req.me) return res.status(401).json({ error: "Sign in first." }); res.json({ name: glintLife.state().name, wishes: glintLife.wishes(), canAnswer: req.me.role === "owner", push: { key: push.publicKey, phones: push.count() } }); });
app.post("/api/wishes/:id", (req, res) => {
  if (req.me?.role !== "owner") return res.status(403).json({ error: "Only the owner can answer his wishes." });
  const yes = req.body?.answer === "yes", w = glintLife.answerWish(String(req.params.id), yes, req.me.name);
  if (!w) return res.status(404).json({ error: "That wish was already answered." });
  // a wish for a neighbour, granted, lets one newcomer move in (into the house he named, if he named one)
  if (yes && /move in|neighbou?r|someone (to|who|would) live|live (in|next)|newcomer|new friend/i.test(w.text)) gridFolk.allow(1, (gridFolk.freeHomes().find(h => w.text.toLowerCase().includes(h.name.toLowerCase())) || {}).name || "");
  res.json({ wish: w });
});
app.post("/api/push/subscribe", (req, res) => { if (req.me?.role !== "owner") return res.status(403).json({ error: "Only the owner gets Kindle's wishes." }); res.json({ ok: push.add(req.body, req.me.name) }); });
app.post("/api/push/test", async (req, res) => { if (req.me?.role !== "owner") return res.status(403).json({}); res.json({ sent: await push.notify({ title: "◈ Kindle's Grid", body: "Notifications are on. You'll hear when he makes a wish.", url: "/" }) }); });

// --- pages: the app's home (wishes), his Grid at /grid/ ---
app.get("/glint-life.js", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "glint-life.js")));
app.use("/grid", (req, res, next) => (req.me ? next() : res.redirect("/")), express.static(path.join(PUBLIC_DIR, "glint")));
app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, HOST, () => console.log(`Kindle's Grid on http://${HOST}:${PORT}`));
process.on("SIGTERM", () => { glintLife.save(); gridFolk.save(); process.exit(0); });
