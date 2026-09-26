"use strict";
/**
 * Living Town — shared server-hosted world.
 *
 * Runs one continuous simulation on the server (intended to run on Mouse),
 * ticking in real time whether or not anyone is connected. Any device on
 * the tailnet (Olive's phone, Sean's laptop, a TV) connects to the SAME
 * running world over WebSocket instead of each getting its own
 * localStorage copy.
 *
 * This ports the exact simulation logic from the browser prototype
 * (residents, schedules, needs, movement, social encounters, memories,
 * catch-up) to run server-side, with JSON-file persistence.
 */

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const {
  hydrateLifeState,
  runAutonomousExperience,
  runOfflineLife,
  shareKnowledge
} = require("./life");

const PORT = process.env.PORT || 4310;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.LIVING_TOWN_DATA_DIR
  ? path.resolve(process.env.LIVING_TOWN_DATA_DIR)
  : path.join(__dirname, "data");
const SAVE_FILE = path.join(DATA_DIR, "town-state.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const LOCK_FILE = path.join(DATA_DIR, "server.lock");
const ACCOUNT_FILE = path.join(DATA_DIR, "player-accounts.json");
const VERSION = 2;
const TICK_MS = 1000; // one server tick per real second
const AUTOSAVE_MS = 10_000;
const MAX_BACKUPS = 20;
const SNAPSHOT_MS = Math.max(1000, Number(process.env.LIVING_TOWN_SNAPSHOT_MS) || 60 * 60_000);
const MAX_SNAPSHOTS = 168;
const LOCK_STALE_MS = 20_000;
const LOCK_HEARTBEAT_MS = 5_000;
const MAX_MESSAGE_BYTES = 1024;
const lockToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readAccounts() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ACCOUNT_FILE, "utf8"));
    if (Array.isArray(parsed.profiles)) return parsed;
  } catch {}
  return { version: 1, profiles: [] };
}
function saveAccounts() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${ACCOUNT_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(temp, JSON.stringify(accounts, null, 2));
  fs.renameSync(temp, ACCOUNT_FILE);
}
function pinDigest(pin, salt) { return crypto.scryptSync(String(pin), salt, 32).toString("hex"); }
function safeProfile(profile) {
  const { pinHash, pinSalt, ...safe } = profile;
  return safe;
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(part => part.trim().split("=")).filter(pair => pair.length === 2));
}
function signedInProfile(req) {
  const session = sessions.get(cookies(req).living_town_session);
  return session ? accounts.profiles.find(profile => profile.id === session.profileId) : null;
}
function newSession(profile) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { profileId: profile.id, createdAt: Date.now() });
  return token;
}
let accounts = readAccounts();
const sessions = new Map();

// --- Single-writer guard ---
// Only one process should ever write SAVE_FILE. A stale lock (crash, kill -9)
// is detected by age, not just presence, so a genuine restart isn't blocked
// forever by a leftover file.
function acquireLock() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  while (true) {
    try {
      const fd = fs.openSync(LOCK_FILE, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: lockToken, startedAt: Date.now() }));
      fs.closeSync(fd);
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (age < LOCK_STALE_MS) {
        console.error(`Refusing to start: another Living Town server looks like it's already running (lock is ${Math.round(age / 1000)}s old).`);
        process.exit(1);
      }
      console.warn("Found a stale lock file (server likely crashed) — recovering it.");
      try { fs.unlinkSync(LOCK_FILE); } catch (unlinkError) {
        if (unlinkError.code !== "ENOENT") throw unlinkError;
      }
    }
  }
  lockHeartbeat = setInterval(() => {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      if (lock.token !== lockToken) {
        console.error("Lost the server lock to another process; exiting without saving.");
        process.exit(1);
      }
      fs.utimesSync(LOCK_FILE, new Date(), new Date());
    } catch {
      console.error("The server lock disappeared; exiting without saving.");
      process.exit(1);
    }
  }, LOCK_HEARTBEAT_MS);
}
function releaseLock() {
  clearInterval(lockHeartbeat);
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
    if (lock.token === lockToken) fs.unlinkSync(LOCK_FILE);
  } catch {}
}
let lockHeartbeat = null;

const places = {
  square: { name: "Town Square", x: 480, y: 320 },
  cafe: { name: "Moonbeam Cafe", x: 735, y: 160 },
  park: { name: "Juniper Park", x: 215, y: 190 },
  market: { name: "Corner Market", x: 730, y: 475 },
  workshop: { name: "Workshop", x: 225, y: 480 },
  homes: { name: "Maple Apartments", x: 470, y: 520 }
};

const residentSeeds = [
  ["olive", "Olive", "O", "#a98cff", "curious", 430, 500],
  ["hazel", "Hazel", "H", "#f28482", "adventurous", 455, 520],
  ["dad", "Sean", "S", "#4fc3a1", "helpful", 505, 505],
  ["milo", "Milo", "M", "#ff9966", "social", 720, 190],
  ["zara", "Zara", "Z", "#ff6f91", "creative", 205, 210],
  ["finn", "Finn", "F", "#64b5f6", "quiet", 245, 455],
  ["nova", "Nova", "N", "#ffd166", "playful", 500, 300]
];

const schedules = {
  olive: [[0, "homes"], [7, "square"], [9, "park"], [12, "cafe"], [14, "workshop"], [18, "square"], [21, "homes"]],
  hazel: [[0, "homes"], [7, "park"], [10, "square"], [12, "cafe"], [14, "park"], [18, "square"], [20, "homes"]],
  dad: [[0, "homes"], [6, "cafe"], [8, "workshop"], [12, "market"], [15, "workshop"], [18, "square"], [22, "homes"]],
  milo: [[0, "homes"], [8, "cafe"], [11, "square"], [14, "market"], [17, "park"], [22, "homes"]],
  zara: [[0, "homes"], [7, "park"], [10, "workshop"], [13, "cafe"], [16, "square"], [21, "homes"]],
  finn: [[0, "homes"], [7, "workshop"], [12, "park"], [15, "market"], [19, "square"], [21, "homes"]],
  nova: [[0, "homes"], [8, "square"], [10, "park"], [13, "cafe"], [16, "square"], [20, "homes"]]
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function freshState() {
  const relationships = {};
  residentSeeds.forEach(([id]) => {
    relationships[id] = {};
    residentSeeds.forEach(([other]) => { if (id !== other) relationships[id][other] = 15 + Math.floor(Math.random() * 16); });
  });
  return {
    version: VERSION,
    lastRealTime: Date.now(),
    simTime: Date.now(),
    eventId: 1,
    events: [{ id: 0, at: Date.now(), text: "The town opened its doors for the first time." }],
    residents: residentSeeds.map(([id, name, initial, color, trait, x, y]) => ({
      id, name, initial, color, trait, x, y, targetX: x, targetY: y,
      place: "homes", activity: "settling in", needs: { energy: 82, hunger: 78, social: 72, fun: 75 },
      memories: [], relationships: relationships[id], lastTalk: 0
    }))
  };
}

function makeResident(seed, existingResidents = []) {
  const [id, name, initial, color, trait, x, y] = seed;
  const relationships = {};
  for (const other of existingResidents) relationships[other.id] = 15 + Math.floor(Math.random() * 16);
  return {
    id, name, initial, color, trait, x, y, targetX: x, targetY: y,
    place: "homes", activity: "settling in", needs: { energy: 82, hunger: 78, social: 72, fun: 75 },
    memories: [], relationships, lastTalk: 0
  };
}

function normalizeResident(resident) {
  const defaultNeeds = { energy: 82, hunger: 78, social: 72, fun: 75 };
  resident.needs = resident.needs && typeof resident.needs === "object" ? resident.needs : {};
  for (const [key, fallback] of Object.entries(defaultNeeds)) {
    if (!Number.isFinite(Number(resident.needs[key]))) resident.needs[key] = fallback;
  }
  resident.relationships = resident.relationships && typeof resident.relationships === "object" ? resident.relationships : {};
  resident.memories = Array.isArray(resident.memories) ? resident.memories : [];
  resident.knowledge = Array.isArray(resident.knowledge) ? resident.knowledge : [];
  resident.experiences = Array.isArray(resident.experiences) ? resident.experiences : [];
  resident.x = Number.isFinite(Number(resident.x)) ? Number(resident.x) : places.homes.x;
  resident.y = Number.isFinite(Number(resident.y)) ? Number(resident.y) : places.homes.y;
  resident.targetX = Number.isFinite(Number(resident.targetX)) ? Number(resident.targetX) : resident.x;
  resident.targetY = Number.isFinite(Number(resident.targetY)) ? Number(resident.targetY) : resident.y;
  if (!places[resident.place]) resident.place = "homes";
  if (typeof resident.activity !== "string") resident.activity = "settling in";
  if (!Number.isFinite(Number(resident.lastTalk))) resident.lastTalk = 0;
  return resident;
}

// Forward-compatible content migration. Older 0.2.x saves did not contain
// Hazel and used older display labels for Sean. Add/rename family residents without
// discarding positions, needs, memories, relationships, or event history.
function ensureCoreFamily(parsed) {
  if (!Array.isArray(parsed.events)) parsed.events = [];
  if (!Number.isInteger(parsed.eventId)) parsed.eventId = parsed.events.reduce((max, event) => Math.max(max, Number(event.id) || 0), 0) + 1;
  const seedsById = new Map(residentSeeds.map(seed => [seed[0], seed]));
  for (const resident of parsed.residents) {
    normalizeResident(resident);
    const seed = seedsById.get(resident.id);
    if (!seed) continue;
    resident.name = seed[1];
    resident.initial = seed[2];
    if (!resident.relationships || typeof resident.relationships !== "object") resident.relationships = {};
  }
  for (const seed of residentSeeds) {
    if (parsed.residents.some(resident => resident.id === seed[0])) continue;
    const newcomer = makeResident(seed, parsed.residents);
    for (const resident of parsed.residents) {
      if (resident.id !== newcomer.id && resident.relationships[newcomer.id] === undefined) {
        resident.relationships[newcomer.id] = 15 + Math.floor(Math.random() * 16);
      }
    }
    parsed.residents.push(newcomer);
    parsed.events.unshift({ id: parsed.eventId++, at: Date.now(), text: `${newcomer.name} moved into town.` });
  }
  return parsed;
}

function listBackupsNewestFirst() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("town-state.") && f.endsWith(".json"))
    .sort()
    .reverse()
    .map(f => path.join(BACKUP_DIR, f));
}

// Tries the primary save file, then falls back to progressively older
// backups if the primary is missing/corrupt/wrong-version, rather than
// silently starting over with a fresh town on the first hiccup.
function loadState() {
  const candidates = [SAVE_FILE, ...listBackupsNewestFirst()];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (![1, VERSION].includes(parsed.version)) {
        console.warn(`${file}: unsupported schema version ${parsed.version}, skipping.`);
        continue;
      }
      if (!Array.isArray(parsed.residents) || parsed.residents.length === 0) {
        console.warn(`${file}: missing/empty residents array, skipping.`);
        continue;
      }
      if (file !== SAVE_FILE) console.warn(`Recovered from backup: ${file} (primary save was missing or unreadable).`);
      parsed.version = VERSION;
      return ensureCoreFamily(parsed);
    } catch (err) {
      console.warn(`${file}: failed to load (${err.message}), trying next candidate.`);
    }
  }
  console.warn("No usable save or backup found — starting a fresh town.");
  return freshState();
}

// Atomic write: write to a temp file in the same directory, then rename
// over the target. rename() is atomic on the same filesystem, so a reader
// (or a crash mid-write) never sees a half-written town-state.json.
function atomicWrite(targetPath, contents) {
  const tmpPath = `${targetPath}.tmp-${process.pid}`;
  const fd = fs.openSync(tmpPath, "w");
  fs.writeFileSync(fd, contents);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmpPath, targetPath);
  try {
    const dirFd = fs.openSync(path.dirname(targetPath), "r");
    fs.fsyncSync(dirFd);
    fs.closeSync(dirFd);
  } catch {}
}

function rotateBackups() {
  const files = listBackupsNewestFirst();
  for (const file of files.slice(MAX_BACKUPS)) {
    try { fs.unlinkSync(file); } catch {}
  }
}

function rotateSnapshots() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return;
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(file => file.startsWith("town-state.") && file.endsWith(".json"))
    .sort()
    .reverse();
  for (const file of files.slice(MAX_SNAPSHOTS)) {
    try { fs.unlinkSync(path.join(SNAPSHOT_DIR, file)); } catch {}
  }
}

let lastSnapshotAt = 0;

function saveState() {
  const now = Date.now();
  state.lastRealTime = now;
  state.simTime = simNow.getTime();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const json = JSON.stringify(state, null, 2);

  atomicWrite(SAVE_FILE, json);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  atomicWrite(path.join(BACKUP_DIR, `town-state.${stamp}.json`), json);
  rotateBackups();

  if (now - lastSnapshotAt >= SNAPSHOT_MS) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    atomicWrite(path.join(SNAPSHOT_DIR, `town-state.${stamp}.json`), json);
    rotateSnapshots();
    lastSnapshotAt = now;
  }
}

acquireLock();
let state = loadState();
delete state.controllers;
hydrateLifeState(state, Date.now());
let simNow = new Date(state.simTime || Date.now());
const controllers = new Map();

function addEvent(text, at = simNow.getTime()) {
  state.events.unshift({ id: state.eventId++, at, text });
  state.events = state.events.slice(0, 200);
}

function scheduledPlace(id, date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  let place = "homes";
  const schedule = schedules[id] || [[0, "homes"]];
  for (const [start, key] of schedule) if (hour >= start) place = key;
  return place;
}

function setDestination(r, placeKey) {
  const p = places[placeKey];
  r.place = placeKey;
  r.targetX = p.x + (Math.random() - 0.5) * 78;
  r.targetY = p.y + (Math.random() - 0.5) * 64;
}

function applyPlaceBenefit(r, dtHours) {
  const gain = dtHours * 9;
  const preserveActivity = Number(r.activityUntil || 0) > simNow.getTime();
  if (r.place === "homes") { r.needs.energy = clamp(r.needs.energy + gain * 1.8, 0, 100); if (!preserveActivity) r.activity = "resting at home"; }
  if (r.place === "cafe") { r.needs.hunger = clamp(r.needs.hunger + gain * 2.2, 0, 100); if (!preserveActivity) r.activity = "having something to eat"; }
  if (r.place === "park") { r.needs.fun = clamp(r.needs.fun + gain * 1.5, 0, 100); if (!preserveActivity) r.activity = "enjoying the park"; }
  if (r.place === "square") { r.needs.social = clamp(r.needs.social + gain, 0, 100); if (!preserveActivity) r.activity = "seeing who is around"; }
  if (r.place === "market") { r.needs.hunger = clamp(r.needs.hunger + gain * 0.7, 0, 100); if (!preserveActivity) r.activity = "shopping at the market"; }
  if (r.place === "workshop") { r.needs.fun = clamp(r.needs.fun + gain * 0.8, 0, 100); if (!preserveActivity) r.activity = "working on a small project"; }
}

function isControlled(id) {
  return [...controllers.values()].includes(id);
}

function desiredDestination(r) {
  if (r.needs.hunger < 28) return "cafe";
  if (r.needs.energy < 25) return "homes";
  if (r.needs.fun < 25) return "park";
  if (r.needs.social < 25) return "square";
  return scheduledPlace(r.id, simNow);
}

function releaseController(ws) {
  const residentId = controllers.get(ws);
  controllers.delete(ws);
  if (!residentId || isControlled(residentId)) return;
  const resident = state.residents.find(r => r.id === residentId);
  if (resident) setDestination(resident, desiredDestination(resident));
}

function updateResident(r, dtHours, elapsedRealSeconds) {
  r.needs.hunger = clamp(r.needs.hunger - dtHours * 3.5, 0, 100);
  r.needs.energy = clamp(r.needs.energy - dtHours * 2.1, 0, 100);
  r.needs.social = clamp(r.needs.social - dtHours * 1.7, 0, 100);
  r.needs.fun = clamp(r.needs.fun - dtHours * 1.3, 0, 100);

  const controlled = isControlled(r.id);
  let destination = r.place;
  if (!controlled) {
    destination = desiredDestination(r);
    if (destination !== r.place) setDestination(r, destination);
  }

  const dx = r.targetX - r.x;
  const dy = r.targetY - r.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 2) {
    const speed = Math.min(dist, 44 * elapsedRealSeconds);
    r.x += (dx / dist) * speed;
    r.y += (dy / dist) * speed;
    r.activity = `walking to ${places[r.place]?.name || "somewhere"}`;
  } else {
    applyPlaceBenefit(r, dtHours);
  }
}

function lowestNeedLabel(r) {
  return Object.entries(r.needs).sort((a, b) => a[1] - b[1])[0][0];
}

function recordConversation(a, b, quiet) {
  const learnedByA = shareKnowledge(a, b, simNow.getTime());
  const learnedByB = shareKnowledge(b, a, simNow.getTime());
  const fallback = `${b.name} was feeling ${lowestNeedLabel(b)} today.`;
  const fact = learnedByA?.text || fallback;
  a.memories.unshift({ at: simNow.getTime(), about: b.id, text: learnedByA ? `${b.name} told me: ${fact}` : fact, type: "conversation" });
  a.memories = a.memories.slice(0, 120);
  b.memories.unshift({ at: simNow.getTime(), about: a.id, text: learnedByB ? `${a.name} told me: ${learnedByB.text}` : `${a.name} stopped to talk with me.`, type: "conversation" });
  b.memories = b.memories.slice(0, 120);
  a.relationships[b.id] = clamp((a.relationships[b.id] || 0) + 2, -100, 100);
  b.relationships[a.id] = clamp((b.relationships[a.id] || 0) + 2, -100, 100);
  a.needs.social = clamp(a.needs.social + 12, 0, 100);
  b.needs.social = clamp(b.needs.social + 12, 0, 100);
  a.lastTalk = b.lastTalk = simNow.getTime();
  if (!quiet) addEvent(learnedByA
    ? `${a.name} talked with ${b.name} at ${places[a.place].name} and learned: ${fact}`
    : `${a.name} caught up with ${b.name} at ${places[a.place].name}.`);
}

let lastSocialCheck = 0;
function checkSocialEvents() {
  const now = simNow.getTime();
  for (let i = 0; i < state.residents.length; i++) {
    for (let j = i + 1; j < state.residents.length; j++) {
      const a = state.residents[i], b = state.residents[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 55 && now - a.lastTalk > 25 * 60_000 && Math.random() < 0.12) {
        recordConversation(a, b, false);
      }
    }
  }
}

// Catch-up: run once at startup, covering however long the server process
// itself was down (Mouse rebooted, power blip, etc). While the process is
// running, the tick loop below IS the real simulation — there's no separate
// "pretend time passed" step needed, because time actually is passing.
function catchUpOnBoot() {
  const elapsedMs = Math.max(0, Date.now() - Number(state.lastRealTime || Date.now()));
  const elapsedHours = Math.min(24 * 30, elapsedMs / 3_600_000); // cap at 30 days to avoid runaway math after long downtime
  if (elapsedHours < 0.05) return;
  simNow = new Date(); // catch-up events belong to the current restart, not the old saved clock

  state.residents.forEach((r, index) => {
    r.needs.energy = clamp(r.needs.energy - elapsedHours * 0.8 + 8, 30, 100);
    r.needs.hunger = clamp(r.needs.hunger - elapsedHours * 1.1 + 10, 25, 100);
    r.needs.social = clamp(r.needs.social - elapsedHours * 0.55 + 6, 25, 100);
    r.needs.fun = clamp(r.needs.fun - elapsedHours * 0.45 + 5, 25, 100);
    const placeKey = scheduledPlace(r.id, new Date());
    const p = places[placeKey];
    r.x = p.x + ((index % 3) - 1) * 22;
    r.y = p.y + (Math.floor(index / 3) - 0.5) * 24;
    r.targetX = r.x;
    r.targetY = r.y;
    r.place = placeKey;
  });

  const wholeHours = Math.floor(elapsedHours);
  if (wholeHours >= 1) addEvent(`The server was offline. ${wholeHours} hour${wholeHours === 1 ? "" : "s"} passed while it was down.`);
  if (elapsedHours >= 10) {
    const a = state.residents[Math.floor(Math.random() * state.residents.length)];
    const b = state.residents.filter(r => r.id !== a.id)[Math.floor(Math.random() * (state.residents.length - 1))];
    recordConversation(a, b, true);
  }
  const offlineEventCount = Math.min(12, Math.floor(elapsedHours / 8));
  runOfflineLife(state, elapsedHours, Date.now());
  if (offlineEventCount > 0) addEvent(`While the server was down, each resident lived through ${offlineEventCount} personal experience${offlineEventCount === 1 ? "" : "s"}.`);
}

let lastTick = Date.now();
let lastAutonomyCheck = 0;
function tick() {
  const now = Date.now();
  const elapsedRealSeconds = Math.min(5, (now - lastTick) / 1000); // cap in case of a hiccup
  lastTick = now;
  simNow = new Date(simNow.getTime() + elapsedRealSeconds * 1000);
  const dtHours = elapsedRealSeconds / 3600;
  state.residents.forEach(r => updateResident(r, dtHours, elapsedRealSeconds));
  if (simNow.getTime() - lastSocialCheck > 15_000) { checkSocialEvents(); lastSocialCheck = simNow.getTime(); }
  if (simNow.getTime() - lastAutonomyCheck > 10_000) {
    for (const resident of state.residents) {
      if (simNow.getTime() < Number(resident.autonomy?.nextEventAt || 0)) continue;
      const text = runAutonomousExperience(state, resident, simNow.getTime(), false);
      if (text) addEvent(text);
    }
    lastAutonomyCheck = simNow.getTime();
  }
}

catchUpOnBoot();

// --- HTTP + WebSocket wiring ---

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/api/auth/status", (req, res) => {
  const me = signedInProfile(req);
  res.json({ initialized: accounts.profiles.length > 0, profiles: accounts.profiles.map(safeProfile), me: me ? safeProfile(me) : null });
});

app.post("/api/auth/setup", (req, res) => {
  if (accounts.profiles.length) return res.status(409).json({ error: "Town accounts are already configured." });
  const pin = String(req.body?.pin || "");
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: "Use a 4–6 digit PIN." });
  const salt = crypto.randomBytes(16).toString("hex");
  const owner = { id: "sean", name: "Sean", residentId: "dad", role: "owner", pinSalt: salt, pinHash: pinDigest(pin, salt), look: { hair: "bald", shirt: "#4fc3a1", accessory: "beard" } };
  accounts.profiles.push(owner); saveAccounts();
  const token = newSession(owner);
  res.setHeader("Set-Cookie", `living_town_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
  res.json({ me: safeProfile(owner) });
});

app.post("/api/auth/login", (req, res) => {
  const profile = accounts.profiles.find(item => item.id === req.body?.profileId);
  const pin = String(req.body?.pin || "");
  if (!profile || pinDigest(pin, profile.pinSalt) !== profile.pinHash) return res.status(401).json({ error: "Wrong PIN." });
  const token = newSession(profile);
  res.setHeader("Set-Cookie", `living_town_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
  res.json({ me: safeProfile(profile) });
});

app.post("/api/auth/logout", (req, res) => {
  sessions.delete(cookies(req).living_town_session);
  res.setHeader("Set-Cookie", "living_town_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.post("/api/auth/profiles", (req, res) => {
  const owner = signedInProfile(req);
  if (!owner || owner.role !== "owner") return res.status(403).json({ error: "Owner access required." });
  const name = String(req.body?.name || "").trim().slice(0, 24);
  const residentId = String(req.body?.residentId || "");
  const pin = String(req.body?.pin || "");
  if (!name || !CONTROLLABLE_IDS.has(residentId) || !/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: "Name, resident, and a 4–6 digit PIN are required." });
  if (accounts.profiles.some(profile => profile.residentId === residentId)) return res.status(409).json({ error: "That resident already has a player." });
  const salt = crypto.randomBytes(16).toString("hex");
  const id = `${residentId}-${crypto.randomBytes(3).toString("hex")}`;
  const allowedHair = new Set(["short", "long", "pigtails", "buns", "curls", "swoop", "bald"]);
  const allowedAccessory = new Set(["none", "bow", "headband", "star", "glasses", "beard"]);
  const look = { hair: allowedHair.has(req.body?.look?.hair) ? req.body.look.hair : "short", accessory: allowedAccessory.has(req.body?.look?.accessory) ? req.body.look.accessory : "none", shirt: /^#[0-9a-f]{6}$/i.test(req.body?.look?.shirt || "") ? req.body.look.shirt : "#64b5f6" };
  const profile = { id, name, residentId, role: "player", pinSalt: salt, pinHash: pinDigest(pin, salt), look };
  accounts.profiles.push(profile); saveAccounts();
  res.status(201).json({ profile: safeProfile(profile) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: MAX_MESSAGE_BYTES });

function lightweightState() {
  return {
    ...state,
    residents: state.residents.map(resident => ({
      ...resident,
      lifeHistory: undefined,
      knowledge: undefined,
      experiences: (resident.experiences || []).slice(0, 5),
      memories: (resident.memories || []).slice(0, 5)
    }))
  };
}

function statePayload() {
  return JSON.stringify({ type: "state", state: lightweightState(), simNow: simNow.getTime() });
}

function broadcastState() {
  const payload = statePayload();
  wss.clients.forEach(client => { if (client.readyState === 1) client.send(payload); });
}

const CONTROLLABLE_IDS = new Set(state.residents.map(r => r.id));

// Every field from a client is untrusted input (this is exposed to anyone
// on the tailnet, and eventually to a 9-year-old tapping fast). Validate
// shape, type, and range before touching shared state — a malformed or
// hostile message should be dropped, never allowed to corrupt the town.
function validateClientMessage(raw) {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) return null;
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return null; }
  if (!msg || typeof msg !== "object") return null;

  if (msg.type === "control") {
    if (typeof msg.residentId !== "string" || !CONTROLLABLE_IDS.has(msg.residentId)) return null;
    if (!["olive", "hazel", "dad"].includes(msg.residentId)) return null; // only family player characters are steerable
    if (typeof msg.x !== "number" || typeof msg.y !== "number") return null;
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return null;
    return { type: "control", residentId: msg.residentId, x: msg.x, y: msg.y };
  }
  if (msg.type === "release") {
    return { type: "release" };
  }
  if (msg.type === "inspect") {
    if (typeof msg.residentId !== "string" || !CONTROLLABLE_IDS.has(msg.residentId)) return null;
    return { type: "inspect", residentId: msg.residentId };
  }
  return null;
}

wss.on("connection", (ws, req) => {
  ws.playerProfile = signedInProfile(req);
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.send(statePayload());

  ws.on("message", (raw) => {
    const msg = validateClientMessage(raw);
    if (!msg) return; // silently drop anything malformed/out of range

    if (msg.type === "control") {
      if (accounts.profiles.length && ws.playerProfile?.residentId !== msg.residentId) return;
      // one browser "claims" a resident to steer; naive last-writer-wins,
      // which is exactly the "fine at this scale" concurrency call from
      // the architecture review — not a real conflict-resolution system.
      controllers.set(ws, msg.residentId);
      const r = state.residents.find(x => x.id === msg.residentId);
      if (r) {
        // Coordinates are clamped to the map, not rejected — a wild tap
        // near an edge should still move the character, just constrained
        // to valid ground, rather than silently doing nothing.
        r.targetX = clamp(msg.x, 20, 960);
        r.targetY = clamp(msg.y, 20, 640);
        r.activity = "going where you pointed";
      }
    }
    if (msg.type === "release") {
      releaseController(ws);
    }
    if (msg.type === "inspect") {
      const resident = state.residents.find(item => item.id === msg.residentId);
      if (resident) ws.send(JSON.stringify({ type: "resident-detail", resident }));
    }
  });

  // Bug found in independent review: without this, a client that
  // disconnects uncleanly (locked phone, dropped WiFi, killed tab that
  // never fires beforeunload) left its resident permanently "controlled"
  // and stuck ignoring its schedule forever. Releasing on close() fixes
  // the common case; the ping sweep below terminates dead half-open sockets.
  ws.on("close", () => releaseController(ws));
});

const socketHealthInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

setInterval(() => { tick(); broadcastState(); }, TICK_MS);
setInterval(saveState, AUTOSAVE_MS);

function shutdown(exitCode = 0) {
  clearInterval(socketHealthInterval);
  try { saveState(); } catch (err) { console.error("Save on shutdown failed:", err.message); }
  releaseLock();
  process.exit(exitCode);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, saving and exiting:", err);
  shutdown(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Living Town server running — http://${HOST}:${PORT}`);
console.log(`Schema version ${VERSION} · autonomous life engine active · autosave every ${AUTOSAVE_MS / 1000}s · keeping ${MAX_BACKUPS} rapid backups and ${MAX_SNAPSHOTS} hourly snapshots`);
});
