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
const interiors = require("./shared/interiors");
const life = require("./lib/life");
const mind = require("./lib/mind");
const { createStore } = require("./lib/persistence");
const { createAuth } = require("./lib/auth");
const cast = require("./lib/cast");
const { createMrE, ollamaGenerator } = require("./lib/mre");
const { startViewer, readToken } = require("./lib/viewer");
const troupe = require("./lib/troupe");
const crowd = require("./lib/crowd");

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
  if (!(resident.indoor && Number.isFinite(resident.indoor.x) && Number.isFinite(resident.indoor.y))) resident.indoor = null;
  if (!(resident.using && interiors.furniture[resident.using.kind] && Number.isFinite(resident.using.until))) resident.using = null;
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
  for (const resident of parsed.residents) {
    if (resident.custom && (typeof resident.custom.name !== "string" || typeof resident.custom.born !== "string")) delete resident.custom;
    if (resident.custom) cast.registerCustom(resident, now);
    resident.look = cast.sanitizeLook(resident.look);
  }
  cast.syncHomes(parsed);
  // 0.5 kept looks on player accounts; they now live on the resident. Copy
  // them over once, and only looks a player actually chose (0.5 gave every
  // new account the same default look, which must not replace a character's own).
  if (!parsed.accountLooksMigrated) {
    for (const [residentId, look] of Object.entries(auth.looks())) {
      const resident = parsed.residents.find(r => r.id === residentId);
      const isDefault = !look || (look.hair === "short" && look.accessory === "none" && look.shirt === "#64b5f6");
      if (resident && !Object.keys(resident.look).length && !isDefault) {
        resident.look = cast.sanitizeLook({ style: look.hair, accessory: look.accessory, shirt: look.shirt });
      }
    }
    parsed.accountLooksMigrated = true;
  }
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
  auth = createAuth({ dataDir: DATA_DIR, playableIds: () => playableIds() });
} catch (err) {
  console.error(err.message);
  store.releaseLock();
  process.exit(1);
}

const bootTime = Date.now();
let state = migrate(store.load([1, 2, SCHEMA_VERSION]) || (console.warn("No usable save or backup found — starting a fresh town."), freshState(bootTime)), bootTime);
const controllers = new Map(); // ws -> residentId

// Sean, Olive, Hazel and every resident created in the app can be played.
function playableIds() {
  return state ? state.residents.filter(r => PLAYABLE_IDS.includes(r.id) || r.custom).map(r => r.id) : [...PLAYABLE_IDS];
}
function isPlayable(id) { return playableIds().includes(id); }

function addEvent(text, at = Date.now(), by = null) {
  state.events.unshift(by ? { id: state.eventId++, at, text, by } : { id: state.eventId++, at, text });
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
  // Leaving the house ends whatever they were doing inside.
  resident.indoor = null;
  resident.using = null;
  resident.millStroll = false;
  resident.activityAfter = null;
  resident.targetX = x;
  resident.targetY = y;
  resident.path = route(resident.x, resident.y, x, y);
  resident.arrived = false;
}

// Everyone out on the map (people inside buildings don't take up space).
function othersOutside(resident) {
  return state.residents.filter(o => o !== resident && !interiors.locate(o, world));
}

const DOORS = world.buildings.map(b => ({ x: world.walkNodes[b.node][0], y: world.walkNodes[b.node][1] }));

// How far people spread out at each place: the open plaza, park and market
// have room; the cafe terrace and workshop yard are cosier.
const SPREAD = { square: 64, park: 52, market: 52, cafe: 34, workshop: 38 };

// A free spot at a place, with room around it (see lib/crowd.js).
function freeSpotAt(resident, placeKey, spread = SPREAD[placeKey] || 34) {
  const spot = spotFor(resident.id, placeKey);
  return crowd.freeSpot(othersOutside(resident), spot, { spread, placeRadius: PLACE_RADIUS - 8, snap: p => snapToWalkable(p.x, p.y), avoid: DOORS });
}

function setDestination(resident, placeKey) {
  resident.place = placeKey;
  // Home means through your own front door; anywhere else, a free spot.
  if (placeKey === "homes") {
    const spot = spotFor(resident.id, placeKey);
    return walkTo(resident, spot.x, spot.y);
  }
  const performing = placeKey === "square" && troupe.memberFor(resident) && troupe.showOn(new Date());
  const p = freeSpotAt(resident, placeKey, performing ? 22 : undefined);
  walkTo(resident, p.x, p.y);
}

// People standing around outdoors shift to a new free spot now and then,
// and step aside if someone ends up on top of them. Performers move about
// the square more often during a show. Not saved: it's only who moves when.
const nextMill = new Map();
function millAbout(now) {
  for (const r of state.residents) {
    if (r.asleep || isControlled(r.id) || r.path.length || !r.place || r.place === "homes" || interiors.locate(r, world)) continue;
    const performing = /circus show/.test(r.activity || "") && troupe.memberFor(r);
    const due = nextMill.get(r.id) ?? now + (performing ? 8_000 : 30_000) * Math.random();
    const squashed = crowd.crowded(r, othersOutside(r));
    if (now < due && !squashed) { nextMill.set(r.id, due); continue; }
    nextMill.set(r.id, now + (performing ? 15_000 + Math.random() * 10_000 : 45_000 + Math.random() * 75_000));
    // Performers keep to a little stage in front of the fountain.
    const p = freeSpotAt(r, r.place, performing ? 22 : undefined);
    // Stay put if the new spot is barely a step away.
    if (Math.hypot(p.x - r.x, p.y - r.y) < 4) continue;
    const { activityAfter } = r;
    walkTo(r, p.x, p.y);
    // A short stroll isn't a new visit: they keep doing what they were doing.
    r.millStroll = true;
    r.activityAfter = activityAfter;
  }
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
    if (!r.millStroll) r.activity = controlled ? "heading where the player pointed" : `walking to ${placeName(r)}`;
    return;
  }

  if (!r.arrived) {
    r.arrived = true;
    if (r.millStroll) r.millStroll = false;
    else if (Number(r.activityUntil || 0) <= date.getTime()) { mind.onArrive(r, r.place, date); r.activityAfter = null; }
    if (controlled && !r.place) r.activity = "exploring the street";
  }
  // A life moment is over: back to what they were doing.
  if (r.activityAfter && Number(r.activityUntil || 0) <= date.getTime()) {
    r.activity = r.activityAfter;
    r.activityAfter = null;
  }

  r.asleep = !controlled && r.place === "homes" && mind.isAsleepTime(r.id, date);
  if (r.asleep) r.activity = "asleep";

  // Furniture a player chose inside their house adds its own boosts.
  if (r.using) {
    if (r.using.until <= date.getTime() || r.place !== (r.using.place || "homes")) r.using = null;
    else for (const [need, rate] of Object.entries(interiors.furniture[r.using.kind].needs)) r.needs[need] = clamp(r.needs[need] + rate * dtHours, 0, 100);
  }

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
let lastShowCheck = 0;

function tick() {
  const now = Date.now();
  const elapsedSeconds = Math.min(5, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  const date = new Date(now);
  const dtHours = elapsedSeconds / 3600;
  for (const resident of state.residents) updateResident(resident, dtHours, elapsedSeconds, date);
  millAbout(now);

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
  mre.tick(state, now, mreHelpers);
  if (now - lastShowCheck >= 30_000) { lastShowCheck = now; troupe.tick(state, now, addEvent); }
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
    group.forEach(r => {
      // Home is through the front door; anywhere else, a free spot with room around it.
      const p = placeKey === "homes" ? spotFor(r.id, placeKey) : freeSpotAt(r, placeKey);
      r.x = p.x;
      r.y = p.y;
      r.targetX = r.x;
      r.activityAfter = null;
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

const mreGenerator = process.env.LIVING_TOWN_MRE_AI === "off" ? null : ollamaGenerator({
  url: process.env.LIVING_TOWN_OLLAMA_URL || "http://127.0.0.1:11434",
  model: process.env.LIVING_TOWN_MRE_MODEL || "llama3.2:3b"
});
const mre = createMrE({ generate: mreGenerator });
const mreHelpers = { addEvent, placeName, spotFor: (id, key) => spotFor(id, key) };
mre.ensureState(state);

// The Big Top troupe arrives once. If they're later asked to move away,
// they stay gone. LIVING_TOWN_TROUPE=off keeps them away (the tests use it).
function welcomeTroupe(now) {
  if (state.troupeArrived || process.env.LIVING_TOWN_TROUPE === "off") return;
  state.troupeArrived = true;
  const tent = world.buildings.find(b => b.id === "bigTop");
  const [doorX, doorY] = world.walkNodes[tent.node];
  const arrived = [];
  for (const member of troupe.members) {
    if (state.residents.some(r => r.id === member.id || r.name.toLowerCase() === member.name.toLowerCase())) continue;
    const look = cast.sanitizeLook(member.look);
    const resident = makeResident({ id: member.id, name: member.name, color: look.shirt, x: doorX, y: doorY }, state.residents);
    resident.custom = { name: member.name, born: cast.bornFromAge(member.age, now), homeId: tent.id, troupe: member.id };
    resident.look = look;
    for (const other of state.residents) other.relationships[resident.id] = randomBond();
    cast.registerCustom(resident, now);
    state.residents.push(normalizeResident(resident));
    arrived.push(resident);
  }
  // They've toured together for years.
  for (const a of arrived) for (const b of arrived) if (a !== b) a.relationships[b.id] = 60 + Math.floor(Math.random() * 15);
  cast.syncHomes(state);
  for (const resident of arrived) { life.ensureResidentLife(resident, now); mind.ensureMind(resident); }
  if (arrived.length) addEvent(`🎪 A traveling circus troupe has put up the Big Top by the market: ${arrived.map(r => r.name).join(", ")}. Welcome to Living Town!`, now);
}
welcomeTroupe(bootTime);

// Before 0.14, a life moment's activity never wore off. Anyone still stuck
// on an expired one picks a fresh activity for where they are.
const LIFE_MOMENT = /^(handling a work situation|having family time|helping someone at the workbench|following a personal interest)$/;
for (const r of state.residents) {
  if (r.asleep || !r.place || r.activityAfter || Number(r.activityUntil || 0) > bootTime || !LIFE_MOMENT.test(r.activity || "")) continue;
  mind.onArrive(r, r.place, new Date(bootTime));
}

// Troupe members still in their original 0.12 looks get the current ones.
for (const r of state.residents) {
  const look = troupe.updatedLook(r);
  if (look) { r.look = cast.sanitizeLook(look); r.color = r.look.shirt; }
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
    lifeRevision: r.lifeRevision, speech: r.speech || null, playable: isPlayable(r.id), look: r.look || {}, custom: Boolean(r.custom),
    indoor: r.indoor || null, using: r.using?.kind || null,
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
    speech: r.speech && r.speech.until > Date.now() ? r.speech : null, lifeRevision: r.lifeRevision,
    indoor: r.indoor || null, using: r.using?.kind || null
  };
}

function residentDetail(r) {
  return { ...residentSummary(r), lifeHistory: r.lifeHistory || [], knowledge: r.knowledge || [], experiences: r.experiences || [], memories: (r.memories || []).slice(0, 30) };
}

function townPayload() {
  const weather = (state.effects || []).find(e => e.kind === "weather" && e.until > Date.now());
  return { mre: mre.publicView(state, Date.now()), weather: weather?.weather || "clear", brain: mre.brain };
}

function fullStatePayload() {
  return JSON.stringify({
    type: "state", now: Date.now(), homes: cast.homeMap(state), town: townPayload(), mreBrain: mre.brain,
    state: { events: state.events.slice(0, 50), residents: state.residents.map(residentSummary) }
  });
}

function broadcastRoster() {
  for (const r of state.residents) sentRevisions.set(r.id, r.lifeRevision);
  lastSentEventId = state.eventId;
  broadcast(fullStatePayload());
  viewer?.broadcast(visitorFullState());
}

const sentRevisions = new Map();
let lastSentEventId = state.eventId;

function takeNewEvents() {
  const events = state.events.filter(event => event.id >= lastSentEventId).reverse();
  lastSentEventId = state.eventId;
  return events;
}

function tickPayload(events) {
  const changed = [];
  for (const r of state.residents) {
    if (sentRevisions.get(r.id) !== r.lifeRevision) { changed.push(residentSummary(r)); sentRevisions.set(r.id, r.lifeRevision); }
  }
  return JSON.stringify({ type: "tick", now: Date.now(), town: townPayload(), residents: state.residents.map(residentDynamic), changed, events });
}

// --- Visitor window ---
// Family who aren't on the tailnet can watch through a read-only window.
// Visitors get an allowlist of fields: where people are and what they're
// doing, never ages, birthdays, histories, memories or relationships.

function visitorResident(r) {
  // Speech can retell someone's history ("…when I was 7 years old…"), so
  // bubbles about birthdays or ages are left out, like the feed.
  const speech = r.speech && r.speech.until > Date.now() && !PRIVATE_EVENT.test(r.speech.text || "") ? r.speech : null;
  const needs = {};
  for (const [key, value] of Object.entries(r.needs || {})) needs[key] = Math.round(value);
  return {
    id: r.id, name: r.name, color: r.color, x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, targetX: r.targetX, targetY: r.targetY,
    place: r.place, activity: r.activity, intent: r.intent, asleep: r.asleep, needs, mood: r.mood ? { label: r.mood.label } : null,
    speech, look: r.look || {}, custom: Boolean(r.custom),
    indoor: r.indoor || null, using: r.using?.kind || null, playable: false, lifeRevision: 0
  };
}

const PRIVATE_EVENT = /birthday|\bturn(s|ed)\s+\d|\d+\s*(years?|yrs?)\s*old|\bage\b|\baged\b/i;
function visitorEvents(events) {
  return events.filter(e => !PRIVATE_EVENT.test(e.text)).map(e => ({ id: e.id, at: e.at, text: e.text, by: e.by }));
}

function visitorTown() {
  const { mre: mrE, weather } = townPayload();
  return { mre: mrE, weather };
}

function visitorFullState() {
  return JSON.stringify({
    type: "state", now: Date.now(), homes: cast.homeMap(state), town: visitorTown(), mreBrain: "", visitor: true,
    state: { events: visitorEvents(state.events.slice(0, 50)), residents: state.residents.map(visitorResident) }
  });
}

function visitorTickPayload(events) {
  return JSON.stringify({ type: "tick", now: Date.now(), town: visitorTown(), residents: state.residents.map(visitorResident), changed: [], events: visitorEvents(events) });
}

// --- HTTP ---

function securityHeaders(req, res, next) {
  const host = String(req.headers.host || "").replace(/[^\w.:[\]-]/g, "");
  res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://${host} wss://${host}; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}

const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);

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
  res.status(201).json({ profile });
}));

app.put("/api/auth/profiles/:id/pin", handle(async (req, res) => {
  await auth.resetPin(auth.tokenFromRequest(req), req.params.id, req.body?.pin);
  res.json({ ok: true });
}));

app.delete("/api/auth/profiles/:id", handle((req, res) => {
  auth.deleteProfile(auth.tokenFromRequest(req), req.params.id);
  res.json({ ok: true });
}));

// --- Residents: create, customize, move away ---

function requireOwner(req) {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  if (!me || me.role !== "owner") throw Object.assign(new Error("Owner access required."), { status: 403 });
  return me;
}

function findResident(id) {
  const resident = state.residents.find(r => r.id === id);
  if (!resident) throw Object.assign(new Error("No such resident."), { status: 404 });
  return resident;
}

const NEW_RESIDENT_LOOK = { skin: "#e0ac86", hair: "#5a3825", style: "short", shirt: "#64b5f6", pants: "#3f4d79", shoes: "#f1eee4", accessory: "none" };

app.post("/api/residents", handle((req, res) => {
  requireOwner(req);
  const details = cast.validateDetails(req.body || {}, state, { requireAll: true });
  if (state.residents.filter(r => r.custom).length >= cast.MAX_CUSTOM_RESIDENTS) throw Object.assign(new Error("The town is full for now."), { status: 409 });
  const now = Date.now();
  const home = world.homeBuildings.find(b => b.id === details.homeId);
  const [doorX, doorY] = world.walkNodes[home.node];
  const look = { ...NEW_RESIDENT_LOOK, ...cast.sanitizeLook(req.body?.look) };
  const resident = makeResident({ id: cast.newResidentId(details.name), name: details.name, color: look.shirt, x: doorX, y: doorY }, state.residents);
  resident.custom = { name: details.name, born: cast.bornFromAge(details.age, now), homeId: details.homeId };
  resident.look = look;
  for (const other of state.residents) other.relationships[resident.id] = randomBond();
  cast.registerCustom(resident, now);
  state.residents.push(normalizeResident(resident));
  cast.syncHomes(state);
  life.ensureResidentLife(resident, now);
  mind.ensureMind(resident);
  addEvent(`${resident.name} moved into ${home.name}. Welcome to Living Town!`, now);
  broadcastRoster();
  res.status(201).json({ resident: residentSummary(resident) });
}));

app.put("/api/residents/:id", handle((req, res) => {
  requireOwner(req);
  const resident = findResident(req.params.id);
  if (!resident.custom) throw Object.assign(new Error("Only residents created in the app can be renamed or moved."), { status: 400 });
  const details = cast.validateDetails(req.body || {}, state, { selfId: resident.id });
  const now = Date.now();
  if (details.name) resident.custom.name = resident.name = details.name;
  // Only a real age change moves the birthday; re-saving the same age keeps it.
  if (details.age !== undefined && details.age !== life.ageAt({ born: resident.custom.born }, now)) {
    resident.custom.born = cast.bornFromAge(details.age, now);
    resident.lastKnownAge = details.age;
  }
  if (details.homeId) resident.custom.homeId = details.homeId;
  cast.registerCustom(resident, now);
  cast.syncHomes(state);
  life.ensureResidentLife(resident, now);
  if (resident.place === "homes") setDestination(resident, "homes");
  resident.lifeRevision += 1;
  broadcastRoster();
  res.json({ resident: residentSummary(resident) });
}));

app.put("/api/residents/:id/look", handle((req, res) => {
  const me = auth.profileForToken(auth.tokenFromRequest(req));
  const resident = findResident(req.params.id);
  if (!me || (me.role !== "owner" && me.residentId !== resident.id)) throw Object.assign(new Error("You can only change your own character's look."), { status: 403 });
  resident.look = { ...resident.look, ...cast.sanitizeLook(req.body?.look) };
  if (resident.look.shirt) resident.color = resident.look.shirt;
  resident.lifeRevision += 1;
  broadcastRoster();
  res.json({ resident: residentSummary(resident) });
}));

app.delete("/api/residents/:id", handle((req, res) => {
  requireOwner(req);
  const resident = findResident(req.params.id);
  if (!resident.custom) throw Object.assign(new Error("Only residents created in the app can move away."), { status: 400 });
  if (auth.profiles().some(p => p.residentId === resident.id)) throw Object.assign(new Error("Remove the player linked to this resident first."), { status: 409 });
  state.residents = state.residents.filter(r => r !== resident);
  for (const other of state.residents) delete other.relationships[resident.id];
  for (const [ws, id] of controllers) if (id === resident.id) controllers.delete(ws);
  cast.unregisterCustom(resident.id);
  cast.syncHomes(state);
  addEvent(`${resident.name} packed a bag and moved away. Everyone waved goodbye.`);
  broadcastRoster();
  res.json({ ok: true });
}));

// --- Mr. E ---

let lastForcedSurprise = 0;
app.post("/api/mre/surprise", handle(async (req, res) => {
  requireOwner(req);
  if (Date.now() - lastForcedSurprise < 60_000) throw Object.assign(new Error("Mr. E needs a minute to think up the next surprise."), { status: 429 });
  lastForcedSurprise = Date.now();
  const announcement = await mre.surprise(state, mreHelpers);
  if (!announcement) {
    lastForcedSurprise = 0; // nothing happened, so don't make the owner wait
    throw Object.assign(new Error(mre.busy ? "Mr. E is already busy with a surprise." : "Mr. E couldn't think of a surprise right now. Try again in a moment."), { status: 409 });
  }
  res.json({ announcement, brain: mre.brain });
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
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId)) return null;
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return null;
    return { type: "control", residentId: msg.residentId, x: msg.x, y: msg.y };
  }
  if (msg.type === "release") return { type: "release" };
  if (msg.type === "leave-home") {
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId)) return null;
    return { type: "leave-home", residentId: msg.residentId };
  }
  if (msg.type === "use") {
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId) || typeof msg.objectId !== "string" || msg.objectId.length > 20) return null;
    return { type: "use", residentId: msg.residentId, objectId: msg.objectId };
  }
  if (msg.type === "indoor-move") {
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId)) return null;
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return null;
    const floor = msg.floor === undefined ? 0 : msg.floor;
    if (!Number.isInteger(floor) || floor < 0 || floor > 3) return null;
    return { type: "indoor-move", residentId: msg.residentId, x: msg.x, y: msg.y, floor };
  }
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

// The building a resident is in, decided exactly as the phones decide it,
// so nobody is ever in two places at once.
function buildingAt(r) {
  if (!r || r.path?.length) return null;
  return interiors.locate(r, world);
}

// Inside a building: walk around, use furniture, or go out the front door.
function handleIndoor(ws, msg) {
  const reject = reason => send(ws, { type: "control-rejected", residentId: msg.residentId, reason });
  const profile = auth.profileForToken(ws.token);
  if (!profile) return reject("Sign in to play.");
  if (profile.residentId !== msg.residentId) return reject("You can only move your own resident.");
  const r = state.residents.find(item => item.id === msg.residentId);
  if (!r) return reject("That resident isn't in town.");
  const building = buildingAt(r);
  const plan = building && interiors.planFor(building.id);
  if (!plan) return reject("Walk home first, then you can move around inside.");
  controllers.set(ws, r.id);
  r.asleep = false;
  if (msg.type === "leave-home") {
    // Step out of the front door onto the path, heading away from the building.
    const [doorX, doorY] = world.walkNodes[building.node];
    const edge = world.walkEdges.find(e => e.includes(building.node));
    const [awayX, awayY] = edge ? world.walkNodes[edge[0] === building.node ? edge[1] : edge[0]] : [doorX, doorY + 30];
    const len = Math.hypot(awayX - doorX, awayY - doorY) || 1;
    const step = Math.min(34, len * 0.8);
    const out = snapToWalkable(doorX + (awayX - doorX) / len * step, doorY + (awayY - doorY) / len * step);
    walkTo(r, out.x, out.y);
    r.place = null;
    r.activity = "stepping outside";
    return;
  }
  if (msg.type === "use") {
    const object = interiors.allObjects(plan).find(o => o.id === msg.objectId);
    if (!object) return reject("There's nothing like that in this room.");
    r.indoor = { x: object.spot[0], y: object.spot[1], objectId: object.id, floor: object.floor };
    r.using = { kind: object.kind, until: Date.now() + 30 * 60_000, place: r.place };
    r.activity = interiors.furniture[object.kind].activity;
  } else {
    // Upstairs or down (a house without that floor keeps you on the ground).
    const floor = plan.floors[msg.floor] ? msg.floor : 0;
    const spot = interiors.snapInside(plan.floors[floor], msg.x, msg.y);
    r.indoor = { x: Math.round(spot.x), y: Math.round(spot.y), floor };
    r.using = null;
    r.activity = "pottering around the house";
  }
  r.activityUntil = Date.now() + 30 * 60_000;
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
    else if (msg.type === "use" || msg.type === "indoor-move" || msg.type === "leave-home") handleIndoor(ws, msg);
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

const tickInterval = setInterval(() => {
  tick();
  const events = takeNewEvents();
  broadcast(tickPayload(events));
  viewer?.broadcast(visitorTickPayload(events));
}, TICK_MS);
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

// The visitor window is off unless a token is set (viewer-token file or
// LIVING_TOWN_VIEWER_TOKEN), and always off with LIVING_TOWN_VIEWER=off.
// It listens on localhost only; Tailscale Funnel publishes it.
const viewerToken = process.env.LIVING_TOWN_VIEWER === "off" ? null : readToken(path.join(__dirname, "viewer-token"));
const viewer = viewerToken ? startViewer({
  port: Number(process.env.LIVING_TOWN_VIEWER_PORT) || 4311, token: viewerToken,
  publicDir: PUBLIC_DIR, sharedDir: SHARED_DIR, headers: securityHeaders, fullState: visitorFullState
}) : null;

server.listen(PORT, HOST, () => {
  console.log(`Living Town server running — http://${HOST}:${PORT}`);
  console.log(`Schema ${SCHEMA_VERSION} · assets ${assetVersion} · autosave every ${AUTOSAVE_MS / 1000}s`);
});

