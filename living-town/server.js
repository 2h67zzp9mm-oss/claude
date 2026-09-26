"use strict";
/**
 * Living Town — one shared, always-running world.
 *
 * The server owns the canonical simulation and ticks once per real second
 * whether or not anyone is connected. Browsers connect over WebSocket and
 * all see the same residents. See README.md for deployment.
 *
 *   lib/mind.js         personality-driven decisions and conversations
 *   lib/life.js         histories, careers, goals, moods, experiences
 *   lib/persistence.js  lock, atomic saves, backups, recovery
 *   lib/auth.js         player accounts, PINs, sessions
 *   shared/world.js     places and residents shared with the browser
 */

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const world = require("./shared/world");
const life = require("./lib/life");
const mind = require("./lib/mind");
const { createStore } = require("./lib/persistence");
const { createAuth } = require("./lib/auth");

const { places, PLACE_RADIUS, PLAYABLE_IDS, DEFAULT_NEEDS, MAP, residentSeeds, spotFor, route, snapToWalkable } = world;

const PORT = Number(process.env.PORT) || 4310;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.LIVING_TOWN_DATA_DIR ? path.resolve(process.env.LIVING_TOWN_DATA_DIR) : path.join(__dirname, "data");
const SCHEMA_VERSION = 3;
const TICK_MS = 1000;
const AUTOSAVE_MS = 10_000;
const MAX_MESSAGE_BYTES = 1024;
const MAX_EVENTS = 200;
const INSPECT_MIN_INTERVAL_MS = 200;

const store = createStore({
  dataDir: DATA_DIR,
  backupIntervalMs: Math.max(1000, Number(process.env.LIVING_TOWN_BACKUP_MS) || 60_000),
  maxBackups: 30,
  snapshotIntervalMs: Math.max(1000, Number(process.env.LIVING_TOWN_SNAPSHOT_MS) || 3_600_000),
  maxSnapshots: 168
});

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randomBond() { return 15 + Math.floor(Math.random() * 16); }

// --- State creation and migration ---

function makeResident(seed, others = []) {
  const relationships = {};
  for (const other of others) relationships[other.id] = randomBond();
  return {
    id: seed.id, name: seed.name, color: seed.color, x: seed.x, y: seed.y, targetX: seed.x, targetY: seed.y,
    place: "homes", activity: "settling in", needs: { ...DEFAULT_NEEDS }, memories: [], relationships, lastTalk: 0, path: []
  };
}

function freshState(now) {
  const residents = [];
  for (const seed of residentSeeds) {
    const resident = makeResident(seed, residents);
    for (const other of residents) other.relationships[resident.id] = randomBond();
    residents.push(resident);
  }
  return { version: SCHEMA_VERSION, lastRealTime: now, eventId: 1, events: [{ id: 0, at: now, text: "The town opened its doors for the first time." }], residents };
}

function finiteOr(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }

function normalizeResident(resident) {
  resident.needs = resident.needs && typeof resident.needs === "object" ? resident.needs : {};
  for (const [key, fallback] of Object.entries(DEFAULT_NEEDS)) resident.needs[key] = clamp(finiteOr(resident.needs[key], fallback), 0, 100);
  resident.relationships = resident.relationships && typeof resident.relationships === "object" ? resident.relationships : {};
  resident.memories = Array.isArray(resident.memories) ? resident.memories : [];
  resident.knowledge = Array.isArray(resident.knowledge) ? resident.knowledge : [];
  resident.experiences = Array.isArray(resident.experiences) ? resident.experiences : [];
  resident.x = clamp(finiteOr(resident.x, places.homes.x), MAP.margin, MAP.width - MAP.margin);
  resident.y = clamp(finiteOr(resident.y, places.homes.y), MAP.margin, MAP.height - MAP.margin);
  resident.targetX = finiteOr(resident.targetX, resident.x);
  resident.targetY = finiteOr(resident.targetY, resident.y);
  if (!places[resident.place]) resident.place = placeAt(resident, resident.x, resident.y) || "homes";
  resident.path = Array.isArray(resident.path) ? resident.path.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)) : [];
  if (typeof resident.activity !== "string") resident.activity = "settling in";
  if (typeof resident.color !== "string") resident.color = "#8899aa";
  resident.lastTalk = finiteOr(resident.lastTalk, 0);
  if (!Number.isInteger(resident.lifeRevision)) resident.lifeRevision = 1;
  delete resident.initial;
  delete resident.trait;
  return resident;
}

function migrate(parsed, now) {
  if (!Array.isArray(parsed.events)) parsed.events = [];
  if (!Number.isInteger(parsed.eventId)) parsed.eventId = parsed.events.reduce((max, event) => Math.max(max, Number(event.id) || 0), 0) + 1;
  const seedsById = new Map(residentSeeds.map(seed => [seed.id, seed]));
  for (const resident of parsed.residents) {
    normalizeResident(resident);
    const seed = seedsById.get(resident.id);
    if (seed) resident.name = seed.name;
  }
  for (const seed of residentSeeds) {
    if (parsed.residents.some(resident => resident.id === seed.id)) continue;
    const newcomer = makeResident(seed, parsed.residents);
    for (const resident of parsed.residents) if (resident.relationships[newcomer.id] === undefined) resident.relationships[newcomer.id] = randomBond();
    parsed.residents.push(newcomer);
    parsed.events.unshift({ id: parsed.eventId++, at: now, text: `${newcomer.name} moved into town.` });
  }
  delete parsed.controllers;
  delete parsed.simTime;
  life.hydrateLifeState(parsed, now);
  for (const resident of parsed.residents) mind.ensureMind(resident);
  if (!parsed.familyBondsSeeded) { mind.seedFamilyBonds(parsed); parsed.familyBondsSeeded = true; }
  parsed.version = SCHEMA_VERSION;
  return parsed;
}

// --- Simulation ---

store.acquireLock(() => process.exit(1));

let auth;
try {
  auth = createAuth({ dataDir: DATA_DIR });
} catch (err) {
  console.error(err.message);
  store.releaseLock();
  process.exit(1);
}

const bootTime = Date.now();
let state = migrate(store.load([1, 2, SCHEMA_VERSION]) || (console.warn("No usable save or backup found — starting a fresh town."), freshState(bootTime)), bootTime);
const controllers = new Map(); // ws -> residentId

function addEvent(text, at = Date.now()) {
  state.events.unshift({ id: state.eventId++, at, text });
  state.events = state.events.slice(0, MAX_EVENTS);
}

function placeName(resident) {
  if (resident.place === "homes") return world.homeOf(resident.id)?.name || "home";
  return places[resident.place]?.name || "the street";
}

// The place whose spot (for this resident) is within reach of (x, y), if any.
function placeAt(resident, x, y) {
  let best = null;
  for (const key of Object.keys(places)) {
    const spot = spotFor(resident.id, key);
    const dist = Math.hypot(spot.x - x, spot.y - y);
    if (dist <= PLACE_RADIUS && (!best || dist < best.dist)) best = { key, dist };
  }
  return best?.key || null;
}

function walkTo(resident, x, y) {
  resident.targetX = x;
  resident.targetY = y;
  resident.path = route(resident.x, resident.y, x, y);
  resident.arrived = false;
}

function setDestination(resident, placeKey) {
  const spot = spotFor(resident.id, placeKey);
  // Spread people out a little so they don't stack; stay close at front doors.
  const [spreadX, spreadY] = placeKey === "homes" ? [6, 4] : [28, 16];
  resident.place = placeKey;
  walkTo(resident, spot.x + (Math.random() - 0.5) * spreadX, spot.y + (Math.random() - 0.5) * spreadY);
}

function isControlled(id) {
  for (const residentId of controllers.values()) if (residentId === id) return true;
  return false;
}

function releaseController(ws) {
  const residentId = controllers.get(ws);
  controllers.delete(ws);
  if (!residentId || isControlled(residentId)) return;
  const resident = state.residents.find(r => r.id === residentId);
  if (resident) { resident.mind.commitUntil = 0; resident.intent = "back to their own plans"; }
}

function updateResident(r, dtHours, elapsedSeconds, date) {
  const rates = mind.decayRates(r);
  for (const [need, rate] of Object.entries(rates)) r.needs[need] = clamp(r.needs[need] - rate * dtHours, 0, 100);
  life.tickMood(r, dtHours, mind.traitsFor(r.id).neuroticism);

  const controlled = isControlled(r.id);
  if (controlled) {
    r.asleep = false;
    r.intent = "following a player's lead";
  } else {
    const destination = mind.decide(state, r, date);
    if (destination) setDestination(r, destination);
    // A resident who is "at" a place but physically elsewhere (fresh seed
    // positions, a released player) walks there instead of teleporting or
    // sleeping in the street.
    const spot = r.place ? spotFor(r.id, r.place) : null;
    if (spot && Math.hypot(spot.x - r.targetX, spot.y - r.targetY) > PLACE_RADIUS) setDestination(r, r.place);
  }

  if (!Array.isArray(r.path)) r.path = [];
  // Follow the walkway waypoints, carrying leftover movement to the next one.
  let budget = 40 * mind.mindFor(r.id).speed * elapsedSeconds;
  while (budget > 0 && r.path.length) {
    const next = r.path[0];
    const gap = Math.hypot(next.x - r.x, next.y - r.y);
    if (gap <= budget) { r.x = next.x; r.y = next.y; budget -= gap; r.path.shift(); }
    else { r.x += (next.x - r.x) / gap * budget; r.y += (next.y - r.y) / gap * budget; budget = 0; }
  }
  if (r.path.length) {
    r.asleep = false;
    r.activity = controlled ? "heading where the player pointed" : `walking to ${placeName(r)}`;
    return;
  }

  if (!r.arrived) {
    r.arrived = true;
    if (Number(r.activityUntil || 0) <= date.getTime()) mind.onArrive(r, r.place, date);
    if (controlled && !r.place) r.activity = "exploring the street";
  }

  r.asleep = !controlled && r.place === "homes" && mind.isAsleepTime(r.id, date);
  if (r.asleep) r.activity = "asleep";

  const place = places[r.place];
  const spot = r.place ? spotFor(r.id, r.place) : null;
  if (place && Math.hypot(spot.x - r.x, spot.y - r.y) <= PLACE_RADIUS) {
    for (const [need, rate] of Object.entries(place.needs)) {
      const boost = r.asleep && need === "energy" ? 1.4 : 1;
      r.needs[need] = clamp(r.needs[need] + rate * boost * dtHours, 0, 100);
    }
  }
}

let lastTick = Date.now();
let lastSocialCheck = 0;
let lastAutonomyCheck = 0;
let lastBirthdayCheck = 0;

function tick() {
  const now = Date.now();
  const elapsedSeconds = Math.min(5, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  const date = new Date(now);
  const dtHours = elapsedSeconds / 3600;
  for (const resident of state.residents) updateResident(resident, dtHours, elapsedSeconds, date);

  if (now - lastSocialCheck >= 15_000) {
    lastSocialCheck = now;
    for (const talk of mind.socialTick(state, now, placeName)) addEvent(talk.event, now);
  }
  if (now - lastAutonomyCheck >= 10_000) {
    lastAutonomyCheck = now;
    for (const resident of state.residents) {
      if (resident.asleep || now < Number(resident.autonomy?.nextEventAt || 0)) continue;
      const text = life.runAutonomousExperience(state, resident, now, false, mind.traitsFor(resident.id));
      if (text) addEvent(text, now);
    }
  }
  if (now - lastBirthdayCheck >= 60_000) {
    lastBirthdayCheck = now;
    for (const text of life.checkBirthdays(state, now)) addEvent(text, now);
  }
}

// Catch-up after the server was down. While running, the tick loop is the
// real simulation because real time is actually passing.
function catchUpOnBoot(now) {
  const elapsedMs = Math.max(0, now - Number(state.lastRealTime || now));
  const elapsedHours = Math.min(24 * 30, elapsedMs / 3_600_000);
  if (elapsedHours < 0.05) return;
  const date = new Date(now);

  const groups = new Map();
  for (const r of state.residents) {
    r.needs.energy = clamp(r.needs.energy - elapsedHours * 0.8 + 8, 30, 100);
    r.needs.hunger = clamp(r.needs.hunger - elapsedHours * 1.1 + 10, 25, 100);
    r.needs.social = clamp(r.needs.social - elapsedHours * 0.55 + 6, 25, 100);
    r.needs.fun = clamp(r.needs.fun - elapsedHours * 0.45 + 5, 25, 100);
    r.mind.commitUntil = 0;
    const placeKey = mind.decide(state, r, date) || r.place || "homes";
    r.place = placeKey;
    if (!groups.has(placeKey)) groups.set(placeKey, []);
    groups.get(placeKey).push(r);
  }
  for (const [placeKey, group] of groups) {
    group.forEach((r, index) => {
      const spot = spotFor(r.id, placeKey);
      r.x = spot.x + ((index % 3) - 1) * 14;
      r.y = spot.y + Math.floor(index / 3) * 10;
      r.targetX = r.x;
      r.targetY = r.y;
      r.path = [];
      r.arrived = false;
    });
  }

  const wholeHours = Math.floor(elapsedHours);
  if (wholeHours >= 1) addEvent(`The server was offline. ${wholeHours} hour${wholeHours === 1 ? "" : "s"} passed while it was down.`, now);
  const count = life.runOfflineLife(state, elapsedHours, now, mind.traitsFor);
  if (count > 0) addEvent(`While the server was down, each resident lived through ${count} personal experience${count === 1 ? "" : "s"}.`, now);
}

catchUpOnBoot(bootTime);

function saveState() {
  state.lastRealTime = Date.now();
  try {
    store.save(state);
  } catch (err) {
    console.error("Save failed:", err.message);
    if (!store.ownsLock()) process.exit(1);
  }
}

// --- Serialization for clients ---

function publicMood(mood) { return mood ? { label: mood.label, valence: Math.round(mood.valence), stress: Math.round(mood.stress), reason: mood.reason } : null; }

function residentSummary(r) {
  return {
    id: r.id, name: r.name, color: r.color, x: r.x, y: r.y, targetX: r.targetX, targetY: r.targetY,
    place: r.place, activity: r.activity, intent: r.intent, asleep: r.asleep, needs: r.needs,
    relationships: r.relationships, profile: r.profile, career: r.career, goals: r.goals, mood: publicMood(r.mood),
    lifeRevision: r.lifeRevision, speech: r.speech || null, playable: PLAYABLE_IDS.includes(r.id),
    experiences: (r.experiences || []).slice(0, 5), memories: (r.memories || []).slice(0, 5),
    experienceCount: (r.experiences || []).length, historyCount: (r.lifeHistory || []).length, knowledgeCount: (r.knowledge || []).length
  };
}

function residentDynamic(r) {
  const needs = {};
  for (const [key, value] of Object.entries(r.needs)) needs[key] = Math.round(value * 10) / 10;
  return {
    id: r.id, x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, targetX: r.targetX, targetY: r.targetY,
    place: r.place, activity: r.activity, intent: r.intent, asleep: r.asleep, needs, mood: publicMood(r.mood),
    speech: r.speech && r.speech.until > Date.now() ? r.speech : null, lifeRevision: r.lifeRevision
  };
}

function residentDetail(r) {
  return { ...residentSummary(r), lifeHistory: r.lifeHistory || [], knowledge: r.knowledge || [], experiences: r.experiences || [], memories: (r.memories || []).slice(0, 30) };
}

function fullStatePayload() {
  return JSON.stringify({ type: "state", now: Date.now(), looks: auth.looks(), state: { events: state.events.slice(0, 50), residents: state.residents.map(residentSummary) } });
}

const sentRevisions = new Map();
let lastSentEventId = state.eventId;

function tickPayload() {
  const changed = [];
  for (const r of state.residents) {
    if (sentRevisions.get(r.id) !== r.lifeRevision) { changed.push(residentSummary(r)); sentRevisions.set(r.id, r.lifeRevision); }
  }
  const events = state.events.filter(event => event.id >= lastSentEventId).reverse();
  lastSentEventId = state.eventId;
  return JSON.stringify({ type: "tick", now: Date.now(), residents: state.residents.map(residentDynamic), changed, events });
}

// --- HTTP ---

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const host = String(req.headers.host || "").replace(/[^\w.:[\]-]/g, "");
  res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://${host} wss://${host}; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// The service worker cache name is derived from the served files, so every
// change to the client automatically invalidates old caches.
const PUBLIC_DIR = path.join(__dirname, "public");
const SHARED_DIR = path.join(__dirname, "shared");
const assetVersion = (() => {
  const hash = crypto.createHash("sha256");
  for (const dir of [PUBLIC_DIR, SHARED_DIR]) {
    const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full); else hash.update(entry.name).update(fs.readFileSync(full));
    });
    walk(dir);
  }
  return hash.digest("hex").slice(0, 12);
})();
const swSource = fs.readFileSync(path.join(PUBLIC_DIR, "sw.js"), "utf8").replace("__ASSET_VERSION__", assetVersion);
app.get("/sw.js", (req, res) => { res.type("application/javascript").setHeader("Cache-Control", "no-cache"); res.send(swSource); });
app.use("/shared", express.static(SHARED_DIR));
app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: "4kb" }));

const handle = handler => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err.status) {
      if (err.retryAfter) res.setHeader("Retry-After", String(err.retryAfter));
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
};
const clientIp = req => req.socket.remoteAddress || "unknown";

app.get("/api/auth/status", handle((req, res) => res.json(auth.status(auth.tokenFromRequest(req)))));

app.post("/api/auth/setup", handle(async (req, res) => {
  const { profile, token } = await auth.setup(req.body || {}, clientIp(req));
  res.setHeader("Set-Cookie", auth.cookieFor(token));
  res.json({ me: profile });
}));

app.post("/api/auth/login", handle(async (req, res) => {
  const { profile, token } = await auth.login(req.body || {}, clientIp(req));
  res.setHeader("Set-Cookie", auth.cookieFor(token));
  res.json({ me: profile });
}));

app.post("/api/auth/logout", handle((req, res) => {
  auth.logout(auth.tokenFromRequest(req));
  res.setHeader("Set-Cookie", auth.clearCookie);
  res.json({ ok: true });
}));

app.post("/api/auth/profiles", handle(async (req, res) => {
  const profile = await auth.createProfile(auth.tokenFromRequest(req), req.body);
  broadcastLooks();
  res.status(201).json({ profile });
}));

app.put("/api/auth/profiles/:id/pin", handle(async (req, res) => {
  await auth.resetPin(auth.tokenFromRequest(req), req.params.id, req.body?.pin);
  res.json({ ok: true });
}));

app.put("/api/auth/profiles/:id/look", handle((req, res) => {
  const profile = auth.updateLook(auth.tokenFromRequest(req), req.params.id, req.body?.look);
  broadcastLooks();
  res.json({ profile });
}));

app.delete("/api/auth/profiles/:id", handle((req, res) => {
  auth.deleteProfile(auth.tokenFromRequest(req), req.params.id);
  broadcastLooks();
  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") return res.status(400).json({ error: "Bad request." });
  next(err);
});

// --- WebSocket ---

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: MAX_MESSAGE_BYTES,
  // Browsers always send Origin; reject pages from other sites.
  verifyClient: ({ origin, req }) => {
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  }
});

function send(ws, payload) { if (ws.readyState === 1) ws.send(typeof payload === "string" ? payload : JSON.stringify(payload)); }

function broadcast(payload) { wss.clients.forEach(client => send(client, payload)); }

function broadcastLooks() { broadcast({ type: "looks", looks: auth.looks() }); }

auth.onRevoke(hash => {
  wss.clients.forEach(ws => {
    if (ws.token && auth.hashToken(ws.token) === hash) {
      releaseController(ws);
      ws.close(4001, "signed out");
    }
  });
});

function validateClientMessage(raw) {
  if (!Buffer.isBuffer(raw) && typeof raw !== "string") return null;
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return null; }
  if (!msg || typeof msg !== "object") return null;
  if (msg.type === "control") {
    if (typeof msg.residentId !== "string" || !PLAYABLE_IDS.includes(msg.residentId)) return null;
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return null;
    return { type: "control", residentId: msg.residentId, x: msg.x, y: msg.y };
  }
  if (msg.type === "release") return { type: "release" };
  if (msg.type === "inspect") {
    if (typeof msg.residentId !== "string" || msg.residentId.length > 64) return null;
    return { type: "inspect", residentId: msg.residentId };
  }
  return null;
}

const detailCache = new Map();
function detailPayload(resident) {
  const cached = detailCache.get(resident.id);
  if (cached && cached.revision === resident.lifeRevision) return cached.json;
  const json = JSON.stringify({ type: "resident-detail", resident: residentDetail(resident) });
  detailCache.set(resident.id, { revision: resident.lifeRevision, json });
  return json;
}

function handleControl(ws, msg) {
  // Re-check the session on every command so logout, PIN resets, and
  // removed players take effect immediately on already-open sockets.
  const reject = reason => send(ws, { type: "control-rejected", residentId: msg.residentId, reason });
  if (!auth.isInitialized()) return reject("Set up town accounts before playing.");
  const profile = auth.profileForToken(ws.token);
  if (!profile) return reject("Sign in to move a resident.");
  if (profile.residentId !== msg.residentId) return reject("You can only move your own resident.");
  const r = state.residents.find(item => item.id === msg.residentId);
  if (!r) return reject("That resident isn't in town.");
  controllers.set(ws, msg.residentId);
  // Players can only walk on the painted walkways.
  const target = snapToWalkable(clamp(msg.x, MAP.margin, MAP.width - MAP.margin), clamp(msg.y, MAP.margin, MAP.height - MAP.margin));
  walkTo(r, target.x, target.y);
  r.place = placeAt(r, target.x, target.y);
  r.asleep = false;
}

wss.on("connection", (ws, req) => {
  ws.token = auth.tokenFromRequest(req);
  ws.isAlive = true;
  ws.lastInspect = 0;
  ws.on("pong", () => { ws.isAlive = true; });
  const me = auth.profileForToken(ws.token);
  send(ws, { type: "hello", me: me ? auth.safeProfile(me) : null, initialized: auth.isInitialized() });
  send(ws, fullStatePayload());

  ws.on("message", raw => {
    const msg = validateClientMessage(raw);
    if (!msg) return;
    if (msg.type === "control") handleControl(ws, msg);
    else if (msg.type === "release") releaseController(ws);
    else if (msg.type === "inspect") {
      // Rate-limited: a burst of requests collapses into the latest one.
      ws.pendingInspect = msg.residentId;
      if (ws.inspectTimer) return;
      const serve = () => {
        ws.inspectTimer = null;
        ws.lastInspect = Date.now();
        const resident = state.residents.find(item => item.id === ws.pendingInspect);
        if (resident) send(ws, detailPayload(resident));
      };
      const wait = INSPECT_MIN_INTERVAL_MS - (Date.now() - ws.lastInspect);
      if (wait <= 0) serve(); else ws.inspectTimer = setTimeout(serve, wait);
    }
  });

  // Unclean disconnects (locked phone, dropped Wi-Fi) still fire close once
  // the ping sweep below terminates the dead socket.
  ws.on("close", () => { clearTimeout(ws.inspectTimer); releaseController(ws); });
});

const socketHealthInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

const tickInterval = setInterval(() => { tick(); broadcast(tickPayload()); }, TICK_MS);
const saveInterval = setInterval(saveState, AUTOSAVE_MS);
const sessionInterval = setInterval(() => auth.pruneSessions(), 3_600_000);

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  [socketHealthInterval, tickInterval, saveInterval, sessionInterval].forEach(clearInterval);
  if (exitCode === 0) saveState();
  store.releaseLock();
  process.exit(exitCode);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", err => {
  // State may be half-updated mid-tick. Keep it for diagnosis, but never
  // let it replace the last good autosave.
  console.error("Uncaught exception; exiting without saving:", err);
  const dump = store.writeCrashDump(state);
  if (dump) console.error(`Crash state written to ${dump}`);
  shutdown(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Living Town server running — http://${HOST}:${PORT}`);
  console.log(`Schema ${SCHEMA_VERSION} · assets ${assetVersion} · autosave every ${AUTOSAVE_MS / 1000}s`);
});

