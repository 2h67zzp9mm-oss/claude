"use strict";
/**
 * Cooke’s Corner — one shared, always-running world.
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
const os = require("os");
const { execFile } = require("child_process");
const { WebSocketServer } = require("ws");

const world = require("./shared/world");
const interiors = require("./shared/interiors");
const life = require("./lib/life");
const mind = require("./lib/mind");
const { createStore } = require("./lib/persistence");
const { createAuth } = require("./lib/auth");
const cast = require("./lib/cast");
const { createMrE, ollamaGenerator } = require("./lib/mre");
const { createHomestead } = require("./lib/homestead");
const cognition = require("./lib/cognition");
const { startViewer, readToken } = require("./lib/viewer");
const troupe = require("./lib/troupe");
const crowd = require("./lib/crowd");
const will = require("./lib/will");
const social = require("./lib/social");
const events = require("./lib/events");
const speech = require("./lib/speech");
const awareness = require("./lib/awareness");
const tasks = require("./lib/tasks");

const { places, PLACE_RADIUS, PLAYABLE_IDS, DEFAULT_NEEDS, MAP, residentSeeds, destinationById, spotFor, route, snapToWalkable } = world;

const PORT = Number(process.env.PORT) || 4310;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.LIVING_TOWN_DATA_DIR ? path.resolve(process.env.LIVING_TOWN_DATA_DIR) : path.join(__dirname, "data");
const PLAYABLE_SPINE_DIR = process.env.LIVING_TOWN_PLAYABLE_SPINE_DIR ? path.resolve(process.env.LIVING_TOWN_PLAYABLE_SPINE_DIR) : null;
const PLAYABLE_SPINE_M2_DIR = process.env.LIVING_TOWN_PLAYABLE_SPINE_M2_DIR ? path.resolve(process.env.LIVING_TOWN_PLAYABLE_SPINE_M2_DIR) : null;
const TRON_MEMORY_FILE = path.join(DATA_DIR, "tron-conversations.json");
let tronConversations = [];
try { tronConversations = JSON.parse(fs.readFileSync(TRON_MEMORY_FILE, "utf8")); } catch {}
if (!Array.isArray(tronConversations)) tronConversations = [];
const SCHEMA_VERSION = 3;
const TICK_MS = 1000;
const PLAYER_SPEED = 48; // map units per second; public/client.js walks your own character at the same pace
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
    destinationId: seed.destinationId || "little-town", homeDestinationId: seed.destinationId || "little-town", role: seed.role || null,
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
  if (!destinationById[resident.destinationId]) resident.destinationId = "little-town";
  if (!destinationById[resident.homeDestinationId]) resident.homeDestinationId = resident.destinationId;
  cognition.ensure(resident);
  will.ensure(resident);
  tasks.ensure(resident);
  awareness.ensure(resident);
  if (!(resident.follow && typeof resident.follow.id === "string" && Number.isFinite(resident.follow.until))) resident.follow = null;
  if (!(typeof resident.visiting === "string" && world.buildings.some(b => b.id === resident.visiting))) resident.visiting = null;
  resident.speechQueue = Array.isArray(resident.speechQueue) ? resident.speechQueue.filter(l => l && typeof l.text === "string" && Number.isFinite(l.from) && Number.isFinite(l.until)).slice(0, 6) : [];
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
    if (world.inPlace(key, resident.id, x, y) && (!best || dist < best.dist)) best = { key, dist };
  }
  return best?.key || null;
}

function walkTo(resident, x, y) {
  // Tracking a friend sends repeated destinations. Keep a valid route rather
  // than repeatedly returning to its nearest starting waypoint.
  if (resident.path?.length && Math.hypot(x - resident.targetX, y - resident.targetY) < 8) return;
  // Leaving the house ends whatever they were doing inside.
  resident.indoor = null;
  resident.using = null;
  resident.millStroll = false;
  resident.activityAfter = null;
  resident.visiting = null;
  resident.targetX = x;
  resident.targetY = y;
  resident.path = route(resident.x, resident.y, x, y);
  resident.arrived = false;
}

// Everyone out on the map (people inside buildings don't take up space).
function othersOutside(resident) {
  return state.residents.filter(o => o !== resident && o.destinationId === resident.destinationId && !interiors.locate(o, world));
}

const DOORS = world.buildings.map(b => ({ x: world.walkNodes[b.node][0], y: world.walkNodes[b.node][1] }));

// How far people spread out at each place: the open plaza, park and market
// have room; the cafe terrace and workshop yard are cosier.
const SPREAD = { square: 64, park: 52, market: 52, cafe: 34, workshop: 38 };

// A free spot at a place, with room around it (see lib/crowd.js). Places
// with a standing area (the square's paved ring) use all of it; performers
// use the stage.
function freeSpotAt(resident, placeKey, { spread = SPREAD[placeKey] || 34, stage = false } = {}) {
  const place = places[placeKey];
  const others = othersOutside(resident);
  if (stage && place?.stage) return crowd.freeSpot(others, place.stage, { sample: crowd.stageSampler(place.stage), bubble: crowd.BUBBLE - 2 });
  if (place?.area) return crowd.freeSpot(others, place.area, { sample: crowd.ringSampler(place.area), avoid: DOORS });
  const spot = spotFor(resident.id, placeKey);
  return crowd.freeSpot(others, spot, { spread, placeRadius: PLACE_RADIUS - 8, snap: p => snapToWalkable(p.x, p.y), avoid: DOORS });
}

function setDestination(resident, placeKey) {
  resident.place = placeKey;
  // Home means through your own front door; anywhere else, a free spot.
  if (placeKey === "homes") {
    const spot = spotFor(resident.id, placeKey);
    return walkTo(resident, spot.x, spot.y);
  }
  const performing = placeKey === "square" && troupe.memberFor(resident) && troupe.showOn(new Date());
  const p = freeSpotAt(resident, placeKey, { stage: Boolean(performing) });
  walkTo(resident, p.x, p.y);
}

// "Follow me!": a resident who agreed walks after the player's character
// for a while, keeping a step behind (and waiting outside other people's homes).
function followingSomeone(r, now) {
  if (!r.follow) return false;
  const leader = state.residents.find(o => o.id === r.follow.id);
  if (r.follow.until > now && leader && !leader.asleep && !r.asleep) return true;
  r.follow = null;
  r.mind.commitUntil = 0;
  r.intent = "back to their own plans";
  return false;
}

function followLeader(r) {
  const leader = state.residents.find(o => o.id === r.follow.id);
  r.intent = `following ${leader.name}`;
  const goal = snapToWalkable(leader.x - 12, leader.y + 4);
  if (Math.hypot(goal.x - r.targetX, goal.y - r.targetY) < 20) return;
  const intoOthersHome = leader.place === "homes" && world.homeOf(leader.id)?.id !== world.homeOf(r.id)?.id;
  walkTo(r, goal.x, goal.y);
  r.place = intoOthersHome ? null : leader.place;
}

// People standing around outdoors shift to a new free spot now and then,
// and step aside if someone ends up on top of them. Performers move about
// the square more often during a show. Not saved: it's only who moves when.
const nextMill = new Map();
function millAbout(now) {
  for (const r of state.residents) {
    if (r.asleep || r.follow || isControlled(r.id) || r.path.length || !r.place || r.place === "homes" || interiors.locate(r, world)) continue;
    const performing = /circus show/.test(r.activity || "") && troupe.memberFor(r);
    const due = nextMill.get(r.id) ?? now + (performing ? 8_000 : 30_000) * Math.random();
    const squashed = crowd.crowded(r, othersOutside(r));
    if (now < due && !squashed) { nextMill.set(r.id, due); continue; }
    nextMill.set(r.id, now + (performing ? 15_000 + Math.random() * 10_000 : 45_000 + Math.random() * 75_000));
    // Performers keep to a little stage in front of the fountain.
    const p = freeSpotAt(r, r.place, { stage: Boolean(performing) });
    // Stay put if the new spot is barely a step away.
    if (Math.hypot(p.x - r.x, p.y - r.y) < 4) continue;
    const { activityAfter } = r;
    walkTo(r, p.x, p.y);
    // A short stroll isn't a new visit: they keep doing what they were doing.
    r.millStroll = true;
    r.activityAfter = activityAfter;
  }
}

// When a phone locks or reloads, the socket drops. Keep that player's character
// where they left it for a while instead of handing it straight back to the AI.
const HOLD_MS = 30 * 60 * 1000;
const holds = new Map(); // residentId -> time the hold ends
function isControlled(id) {
  for (const residentId of controllers.values()) if (residentId === id) return true;
  const until = holds.get(id);
  if (until && Date.now() < until) return true;
  if (until) holds.delete(id);
  return false;
}

function releaseController(ws, hold = false) {
  const residentId = controllers.get(ws);
  controllers.delete(ws);
  if (residentId && hold) holds.set(residentId, Date.now() + HOLD_MS);
  else if (residentId) holds.delete(residentId);
  if (!residentId || isControlled(residentId)) return;
  const resident = state.residents.find(r => r.id === residentId);
  if (resident) { resident.mind.commitUntil = 0; resident.intent = "back to their own plans"; }
}

// Friendships with players slowly fade when you haven't seen each other for a
// day (never below "Friendly", or "Family" for family), so visits matter.
function fadeFriendships(r, dtHours, now) {
  for (const p of state.residents) {
    if (p === r || !Number.isFinite(p.stars)) continue;
    const v = Number(r.relationships[p.id]);
    const family = (r.profile?.family || []).some(link => link.id === p.id);
    const floor = family ? 60 : 30;
    if (!(v > floor) || now - (r.mind?.talkedWith?.[p.id] || 0) < 24 * 3600_000) continue;
    r.relationships[p.id] = Math.max(floor, v - 6 * dtHours / 24);
  }
}

function updateResident(r, dtHours, elapsedSeconds, date) {
  fadeFriendships(r, dtHours, date.getTime());
  const rates = mind.decayRates(r);
  for (const [need, rate] of Object.entries(rates)) r.needs[need] = clamp(r.needs[need] - rate * dtHours, 0, 100);
  life.tickMood(r, dtHours, mind.traitsFor(r.id).neuroticism);

  const controlled = isControlled(r.id);
  if (controlled) {
    r.asleep = false;
    r.intent = "following a player's lead";
  } else if (followingSomeone(r, date.getTime())) {
    followLeader(r);
  } else {
    const destination = mind.decide(state, r, date);
    if (destination) setDestination(r, destination);
    // A resident who is "at" a place but physically elsewhere (fresh seed
    // positions, a released player) walks there instead of teleporting or
    // sleeping in the street.
    const spot = r.place ? spotFor(r.id, r.place) : null;
    if (spot && !world.inPlace(r.place, r.id, r.targetX, r.targetY)) setDestination(r, r.place);
  }

  if (!Array.isArray(r.path)) r.path = [];
  // Follow the walkway waypoints, carrying leftover movement to the next one.
  // Players walk at one steady pace, the same one their phone shows them.
  let budget = (controlled ? PLAYER_SPEED : 40 * mind.mindFor(r.id).speed) * elapsedSeconds;
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
    // A player's character only goes inside by walking through a door, so
    // arriving somewhere else they're just looking around outdoors.
    else if (controlled) r.activity = r.visiting ? `visiting ${world.buildings.find(b => b.id === r.visiting)?.name || "a friend"}` : r.place ? `looking around ${placeName(r)}` : "exploring the street";
    else if (Number(r.activityUntil || 0) <= date.getTime()) {
      mind.onArrive(r, r.place, date);
      r.activityAfter = null;
      // Joining in with Mr. E's event here (flying kites, cheering the duck race...).
      const event = (state.effects || []).find(e => e.programme && e.activity && e.place === r.place && e.until > date.getTime());
      if (event && !controlled && Math.random() < 0.7) r.activity = event.activity;
    }
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
    // Stops when time's up or they've left the building (visitors have no place of their own).
    const stillThere = r.using.building ? interiors.locate(r, world)?.id === r.using.building : r.place === (r.using.place || "homes");
    if (r.using.until <= date.getTime() || !stillThere) r.using = null;
    else for (const [need, rate] of Object.entries(interiors.furniture[r.using.kind].needs)) r.needs[need] = clamp(r.needs[need] + rate * dtHours, 0, 100);
  }

  const place = places[r.place];
  if (place && world.inPlace(r.place, r.id, r.x, r.y)) {
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
let lastWillCheck = 0;
let lastProgrammeCheck = 0;
let lastAwareCheck = 0;

// What residents can notice (lib/awareness.js): rain, events, crowds, friends.
const awareContext = {
  mindFor: mind.mindFor,
  random: Math.random,
  isControlled,
  isInside: r => Boolean(interiors.locate(r, world)),
  weather: now => (state.effects || []).find(e => e.kind === "weather" && e.until > now)?.weather || "clear",
  event: now => {
    const current = state.programme?.current;
    return current && current.end > now ? { id: current.id, name: current.name, place: current.place } : null;
  },
  placeName: key => places[key]?.name || "town",
  like: (r, placeKey, amount) => will.like(r, placeKey, amount)
};

// --- Mr. E's programme, favours and rewards (lib/events.js, lib/tasks.js) ---

/** Residents that belong to a player. */
function playerResidents() {
  const ids = new Set(auth.profiles().map(p => p.residentId).filter(Boolean));
  return state.residents.filter(r => ids.has(r.id));
}

function dayEnd(now) { const d = new Date(now); d.setHours(23, 59, 59, 999); return d.getTime(); }

function socketsOf(residentId) {
  return [...wss.clients].filter(ws => auth.profileForToken(ws.token)?.residentId === residentId);
}

/** Town Stars and keepsakes for a player's character, with a little celebration on their phone. */
function reward(r, stars, keepsake, why, { quiet = false } = {}) {
  const now = Date.now();
  tasks.ensure(r);
  r.stars += stars;
  if (keepsake) r.keepsakes.push({ emoji: keepsake.emoji, name: keepsake.name, at: now, why });
  if (!quiet) will.feel(r, keepsake?.emoji || "⭐", `${capitalizeFirst(why)}!`, { valence: 3, now });
  r.lifeRevision = (r.lifeRevision || 0) + 1;
  for (const ws of socketsOf(r.id)) send(ws, { type: "reward", residentId: r.id, stars, keepsake: keepsake || null, why, total: r.stars });
}
function capitalizeFirst(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
const rewardContext = { reward, addEvent: (text, at) => addEvent(text, at) };

const programme = events.createProgramme({
  addEvent: (text, at) => addEvent(text, at),
  announce(text, placeKey, now) {
    mre.announce(state, text, placeKey, now);
    addEvent(`✦ Mr. E: "${text}"`, now, "mre");
  },
  showHours: date => ([0, 6].includes(date.getDay()) && state.residents.some(r => troupe.memberFor(r)) ? [troupe.SHOW.from, troupe.SHOW.to - 1] : []),
  players: playerResidents,
  reward,
  random: Math.random
});

// What free will (lib/will.js) needs from the world. Players' characters are never moved.
const willContext = {
  mindFor: mind.mindFor,
  activities: mind.activities,
  random: Math.random,
  addEvent: (text, at) => addEvent(text, at),
  isControlled,
  obligation: (r, date) => mind.activeObligation(r.id, date),
  sameSpot: (a, b) => a.destinationId === b.destinationId && (interiors.locate(a, world)?.id || null) === (interiors.locate(b, world)?.id || null),
  showOn: date => troupe.showOn(date),
  showToday: date => [0, 6].includes(date.getDay()) && date.getHours() < troupe.SHOW.from && state.residents.some(r => troupe.memberFor(r)),
  isPerformer: r => Boolean(troupe.memberFor(r)),
  go(r, placeKey, why) {
    if (isControlled(r.id) || r.asleep) return false;
    cognition.ensure(r).plan = null;
    r.cognition.pauseUntil = Date.now() + 40 * 60_000;
    setDestination(r, placeKey);
    r.intent = why;
    // Stick with the plan for a while rather than changing their mind at once.
    r.mind.commitUntil = Date.now() + 40 * 60_000;
    return true;
  }
};

function tick() {
  const now = Date.now();
  const elapsedSeconds = Math.min(5, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  const date = new Date(now);
  const dtHours = elapsedSeconds / 3600;
  for (const resident of state.residents) updateResident(resident, dtHours, elapsedSeconds, date);
  npcBrain.tick(state, now);
  millAbout(now);
  speech.tick(state, now);

  if (now - lastSocialCheck >= 15_000) {
    lastSocialCheck = now;
    for (const talk of mind.socialTick(state, now, placeName, willContext.sameSpot)) {
      addEvent(talk.event, now);
      will.onConversation(talk.a, talk.b, talk.kind, now);
    }
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
  tron.tick(state, now, tronCtx);
  if (now - lastShowCheck >= 30_000) { lastShowCheck = now; troupe.tick(state, now, addEvent); }
  if (now - lastWillCheck >= 10_000) { lastWillCheck = now; will.tick(state, now, willContext); }
  if (now - lastAwareCheck >= 4000) { lastAwareCheck = now; awareness.tick(state, now, awareContext); }
  if (now - lastProgrammeCheck >= 5000) {
    lastProgrammeCheck = now;
    programme.tick(state, now);
    tasks.tick(state, now, { players: playerResidents, random: Math.random, dayEnd });
    for (const player of playerResidents()) tasks.onTick(state, player, now, rewardContext);
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
const tron = require("./lib/tron").createTron({ world, dir: path.join(__dirname, "tron", "world-state") });
const tronCtx = {
  players: () => playerResidents(), isPlayer: r => playerResidents().includes(r),
  // Let them pick something new to do (the planner re-decides right away).
  nudge: (r, why) => { if (r.mind) r.mind.commitUntil = 0; r.intent = "rethinking after a nudge from Glint"; will.feel(r, "◈", why, { now: Date.now() }); },
  makeRoom: r => { if (!r.place || isControlled(r.id)) return; const p = freeSpotAt(r, r.place); if (p) walkTo(r, p.x, p.y); },
  tell: (p, text) => { for (const ws of socketsOf(p.id)) send(ws, { type: "toast", text }); },
  rally: (place, eventId) => {
    state.effects = Array.isArray(state.effects) ? state.effects : [];
    const ev = state.programme?.current;
    if (!ev || ev.id !== eventId || state.effects.some(e => e.id === `${eventId}-tron`)) return;
    state.effects.push({ id: `${eventId}-tron`, kind: "happening", place, pull: 1.4, until: ev.end, reason: `Glint's ping about the ${ev.name.toLowerCase()}`, activity: null });
  },
  log: text => addEvent(text)
};
const npcGenerator = process.env.LIVING_TOWN_NPC_AI === "on" ? ollamaGenerator({
  url: process.env.LIVING_TOWN_OLLAMA_URL || "http://127.0.0.1:11435",
  model: process.env.LIVING_TOWN_NPC_MODEL || "qwen3.5:9b",
  timeoutMs: 55_000, numPredict: 180, temperature: 0.35, numCtx: 8192
}) : null;
const npcBrain = cognition.createCognition({
  mindFor: mind.mindFor, scorePlaces: mind.scorePlaces, activities: mind.activities,
  isAsleepTime: mind.isAsleepTime, obligation: mind.activeObligation, isControlled,
  sameSpot: willContext.sameSpot,
  atPlace: (r, place) => world.inPlace(place, r.id, r.x, r.y),
  approach: (r, target) => {
    if (interiors.locate(r, world) || interiors.locate(target, world)) return;
    const point = snapToWalkable(target.x + 10, target.y + 4);
    walkTo(r, point.x, point.y);
  },
  social: (state, actor, target, action, now) => social.perform(state, actor, target, action, now, {
    mindFor: mind.mindFor, random: Math.random, addEvent,
    obligation: (r, date) => mind.activeObligation(r.id, date),
    isFamily: (a, b) => (a.profile?.family || []).some(link => link.id === b.id),
    startFollow: () => {}, goTo: () => {}
  })
}, { generate: npcGenerator });

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
  if (arrived.length) addEvent(`🎪 A traveling circus troupe has put up the Big Top by the market: ${arrived.map(r => r.name).join(", ")}. Welcome to Cooke’s Corner!`, now);
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
    destinationId: r.destinationId, homeDestinationId: r.homeDestinationId, role: r.role || null,
    place: r.place, activity: r.activity, intent: r.intent, asleep: r.asleep, needs: r.needs,
    relationships: r.relationships, profile: r.profile, career: r.career, goals: r.goals, mood: publicMood(r.mood),
    lifeRevision: r.lifeRevision, speech: r.speech || null, playable: isPlayable(r.id), look: r.look || {}, custom: Boolean(r.custom),
    indoor: r.indoor || null, using: r.using?.kind || null, visiting: r.visiting || null, emote: r.emote && r.emote.until > Date.now() ? r.emote : null,
    experiences: (r.experiences || []).slice(0, 5), memories: (r.memories || []).slice(0, 5),
    experienceCount: (r.experiences || []).length, historyCount: (r.lifeHistory || []).length, knowledgeCount: (r.knowledge || []).length,
    ...will.publicView(r),
    cognition: cognition.publicView(r),
    stars: r.stars || 0, keepsakes: (r.keepsakes || []).slice(-200), quests: r.quests || [], questOffers: r.questOffers || []
  };
}

function residentDynamic(r) {
  const needs = {};
  for (const [key, value] of Object.entries(r.needs)) needs[key] = Math.round(value * 10) / 10;
  return {
    id: r.id, x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, targetX: r.targetX, targetY: r.targetY,
    destinationId: r.destinationId,
    place: r.place, activity: r.activity, intent: r.intent, asleep: r.asleep, needs, mood: publicMood(r.mood),
    speech: r.speech && r.speech.until > Date.now() ? r.speech : null, lifeRevision: r.lifeRevision,
    indoor: r.indoor || null, using: r.using?.kind || null, visiting: r.visiting || null, emote: r.emote && r.emote.until > Date.now() ? r.emote : null
  };
}

function residentDetail(r) {
  return { ...residentSummary(r), lifeHistory: r.lifeHistory || [], knowledge: r.knowledge || [], experiences: r.experiences || [], memories: (r.memories || []).slice(0, 30) };
}

function townPayload({ full = false } = {}) {
  const weather = (state.effects || []).find(e => e.kind === "weather" && e.until > Date.now());
  const town = { mre: mre.publicView(state, Date.now()), tron: tron.publicView(state), weather: weather?.weather || "clear", brain: mre.brain, npcBrain: npcBrain.status() };
  // The programme only goes out when it changes (or with the full state).
  const view = programme.publicView(state, Date.now());
  const json = JSON.stringify(view);
  if (full || json !== lastProgrammeJson) { town.programme = view; if (!full) lastProgrammeJson = json; }
  return town;
}
let lastProgrammeJson = "";

function fullStatePayload() {
  return JSON.stringify({
    type: "state", now: Date.now(), homes: cast.homeMap(state), town: townPayload({ full: true }), mreBrain: mre.brain, social: social.menu(),
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
    indoor: r.indoor || null, using: r.using?.kind || null, visiting: r.visiting || null, emote: r.emote && r.emote.until > Date.now() ? r.emote : null, playable: false, lifeRevision: 0
  };
}

const PRIVATE_EVENT = /birthday|\bturn(s|ed)\s+\d|\d+\s*(years?|yrs?)\s*old|\bage\b|\baged\b/i;
function visitorEvents(events) {
  return events.filter(e => !PRIVATE_EVENT.test(e.text)).map(e => ({ id: e.id, at: e.at, text: e.text, by: e.by }));
}

function visitorTown() {
  return { mre: mre.publicView(state, Date.now()), weather: townPayload({ full: true }).weather, programme: programme.publicView(state, Date.now()) };
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

function playableSpineScriptHashes(dir) {
  if (!dir) return [];
  try {
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(source => source.trim())
      .map(source => `'sha256-${crypto.createHash("sha256").update(source).digest("base64")}'`);
  } catch (err) {
    console.warn(`Milestone preview unavailable: ${err.message}`);
    return [];
  }
}

const PLAYABLE_SPINE_SCRIPT_HASHES = playableSpineScriptHashes(PLAYABLE_SPINE_DIR);
const PLAYABLE_SPINE_M2_SCRIPT_HASHES = playableSpineScriptHashes(PLAYABLE_SPINE_M2_DIR);

function securityHeaders(req, res, next) {
  const host = String(req.headers.host || "").replace(/[^\w.:[\]-]/g, "");
  const m2Preview = req.path === "/playable-spine-m2" || req.path.startsWith("/playable-spine-m2/") || req.path === "/playable-spine-m2b" || req.path.startsWith("/playable-spine-m2b/") || req.path === "/playable-spine-m2c" || req.path.startsWith("/playable-spine-m2c/");
  const preview = req.path === "/playable-spine" || req.path.startsWith("/playable-spine/") || m2Preview;
  const hashes = m2Preview ? PLAYABLE_SPINE_M2_SCRIPT_HASHES : PLAYABLE_SPINE_SCRIPT_HASHES;
  const scripts = preview ? `'self' 'wasm-unsafe-eval' ${hashes.join(" ")}` : "'self'";
  res.setHeader("Content-Security-Policy", `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://${host} wss://${host}; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
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
const swSource = fs.readFileSync(path.join(PUBLIC_DIR, "sw.js"), "utf8").replaceAll("__ASSET_VERSION__", assetVersion);
if (PLAYABLE_SPINE_DIR && fs.existsSync(path.join(PLAYABLE_SPINE_DIR, "index.html"))) {
  app.use("/playable-spine", (req, res, next) => {
    const profile = auth.profileForToken(auth.tokenFromRequest(req));
    if (!profile) {
      if (req.path === "/" || req.path === "/index.html") {
        return res.redirect(302, "/?next=%2Fplayable-spine%2F");
      }
      return res.status(401).json({ error: "Sign in to Cooke’s Corner before opening the playable preview." });
    }
    res.setHeader("Cache-Control", "private, no-store");
    next();
  }, express.static(PLAYABLE_SPINE_DIR, { fallthrough: false, index: "index.html" }));
}
if (PLAYABLE_SPINE_M2_DIR && fs.existsSync(path.join(PLAYABLE_SPINE_M2_DIR, "index.html"))) {
  const protectM2 = (req, res, next) => {
    const profile = auth.profileForToken(auth.tokenFromRequest(req));
    if (!profile) {
      if (req.path === "/" || req.path === "/index.html") {
        return res.redirect(302, "/?next=%2Fplayable-spine-m2%2F");
      }
      return res.status(401).json({ error: "Sign in to Cooke’s Corner before opening the tactical preview." });
    }
    res.setHeader("Cache-Control", "private, no-store");
    next();
  };
  app.use("/playable-spine-m2", protectM2, express.static(PLAYABLE_SPINE_M2_DIR, { fallthrough: false, index: "index.html" }));
  app.use("/playable-spine-m2b", protectM2, express.static(PLAYABLE_SPINE_M2_DIR, { fallthrough: false, index: "index.html" }));
  app.use("/playable-spine-m2c", protectM2, express.static(PLAYABLE_SPINE_M2_DIR, { fallthrough: false, index: "index.html" }));
}
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
  addEvent(`${resident.name} moved into ${home.name}. Welcome to Cooke’s Corner!`, now);
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
  if (msg.type === "tron-chat" && typeof msg.text === "string") {
    // eslint-disable-next-line no-control-regex -- remove transport controls from chat input.
    const text = msg.text.replace(/[\u0000-\u001f]/g, " ").trim();
    return text && text.length <= 600 ? { type: "tron-chat", text } : null;
  }
  if (msg.type === "travel") {
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId) || typeof msg.destinationId !== "string" || !destinationById[msg.destinationId]) return null;
    return { type: "travel", residentId: msg.residentId, destinationId: msg.destinationId };
  }
  // The programme and favours.
  if (["collect", "riddle", "quest", "pickup", "give"].includes(msg.type)) {
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId)) return null;
    const id = value => (typeof value === "string" && value.length <= 80 ? value : null);
    if (msg.type === "collect") return id(msg.itemId) && { type: "collect", residentId: msg.residentId, itemId: msg.itemId };
    if (msg.type === "riddle") return Number.isInteger(msg.choice) && msg.choice >= 0 && msg.choice < 3 && { type: "riddle", residentId: msg.residentId, choice: msg.choice };
    if (msg.type === "quest") return id(msg.offerId) && { type: "quest", residentId: msg.residentId, offerId: msg.offerId, accept: msg.accept === true };
    if (msg.type === "pickup") return id(msg.questId) && { type: "pickup", residentId: msg.residentId, questId: msg.questId };
    if (msg.type === "give") return id(msg.targetId) && { type: "give", residentId: msg.residentId, targetId: msg.targetId };
  }
  if (msg.type === "social") {
    if (typeof msg.residentId !== "string" || !isPlayable(msg.residentId) || typeof msg.targetId !== "string" || msg.targetId.length > 64) return null;
    if (typeof msg.action !== "string" || !social.ACTIONS[msg.action]) return null;
    if (msg.place !== undefined && (typeof msg.place !== "string" || !places[msg.place])) return null;
    return { type: "social", residentId: msg.residentId, targetId: msg.targetId, action: msg.action, place: msg.place || null };
  }
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
  if (msg.type === "home") {
    // The home plot (lib/homestead.js): only known actions and plain fields get through.
    const HOME = ["view", "enter", "pos", "leave", "plant", "water", "harvest", "fish", "sell", "buy", "mail", "upgrade", "world"];
    if (!HOME.includes(msg.action)) return null;
    const word = v => typeof v === "string" && v.length <= 32 ? v : undefined;
    const num = v => Number.isFinite(v) ? v : undefined;
    return { type: "home", action: msg.action, plot: Number.isInteger(msg.plot) ? msg.plot : undefined, crop: word(msg.crop), world: word(msg.world),
      x: num(msg.x), y: num(msg.y), dir: num(msg.dir), moving: msg.moving === true };
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

// Collecting hunt items, answering riddles, and favours.
function handlePlay(ws, msg) {
  const reply = payload => send(ws, { type: "play-result", kind: msg.type, ...payload });
  const profile = auth.profileForToken(ws.token);
  if (!profile) return reply({ error: "Sign in to play." });
  if (profile.residentId !== msg.residentId) return reply({ error: "You can only play as your own character." });
  const r = state.residents.find(item => item.id === msg.residentId);
  if (!r) return reply({ error: "That character isn't in town." });
  const now = Date.now();
  if (msg.type === "collect") return reply(programme.collect(state, r, msg.itemId, now));
  if (msg.type === "riddle") return reply(programme.answer(state, r, msg.choice, now));
  if (msg.type === "quest") { const result = tasks.accept(r, msg.offerId, msg.accept); if (result.accepted) result.accepted = result.accepted.text; return reply(result); }
  if (msg.type === "pickup") return reply(tasks.pickUp(r, msg.questId));
  if (msg.type === "give") {
    const target = state.residents.find(item => item.id === msg.targetId);
    if (!target || target === r) return reply({ error: "There's nobody like that here." });
    if (Math.hypot(r.x - target.x, r.y - target.y) > SOCIAL_RANGE) return reply({ error: `Get a bit closer to ${target.name} first.` });
    return reply(tasks.giveBack(state, r, target, now, rewardContext));
  }
}

// A player's character starts a social interaction with someone nearby.
const SOCIAL_RANGE = 48;
function handleSocial(ws, msg) {
  const reply = payload => send(ws, { type: "social-result", targetId: msg.targetId, action: msg.action, ...payload });
  const profile = auth.profileForToken(ws.token);
  if (!profile) return reply({ error: "Sign in to play." });
  if (profile.residentId !== msg.residentId) return reply({ error: "You can only act as your own character." });
  const now = Date.now();
  if (now - (ws.lastSocial || 0) < 1500) return reply({ error: "One thing at a time!" });
  const actor = state.residents.find(r => r.id === msg.residentId);
  const target = state.residents.find(r => r.id === msg.targetId);
  if (!actor || !target || actor === target) return reply({ error: "There's nobody like that here." });
  if (target.asleep) return reply({ error: `Shh, ${target.name} is asleep.` });
  if (Math.hypot(actor.x - target.x, actor.y - target.y) > SOCIAL_RANGE || !willContext.sameSpot(actor, target)) return reply({ error: `Get a bit closer to ${target.name} first.` });
  ws.lastSocial = now;
  controllers.set(ws, actor.id);
  const result = social.perform(state, actor, target, msg.action, now, {
    mindFor: mind.mindFor, random: Math.random, addEvent,
    obligation: (r, date) => mind.activeObligation(r.id, date),
    isFamily: (a, b) => (a.profile?.family || []).some(link => link.id === b.id),
    startFollow: (who, leader) => {
      if (isControlled(who.id)) return;
      who.follow = { id: leader.id, until: now + 10 * 60_000 };
      who.intent = `following ${leader.name}`;
    },
    goTo: (who, placeKey, why) => willContext.go(who, placeKey, why)
  }, { place: msg.place });
  if (!result.error) tasks.onSocial(state, actor, target, msg.action, result.accepted, now, { ...rewardContext, place: msg.place });
  // Friendship milestones: a keepsake the first time you become friends, then best friends.
  if (!result.error) {
    actor.friendMarks = actor.friendMarks || {};
    for (const [at, label, emoji] of [[50, "Friendship bracelet", "📿"], [85, "Best friends badge", "💖"]]) {
      const key = `${target.id}:${at}`;
      if (result.relBefore < at && result.relAfter >= at && !actor.friendMarks[key]) {
        actor.friendMarks[key] = now;
        reward(actor, at >= 85 ? 5 : 3, { emoji, name: `${label} from ${target.name}` }, `became ${at >= 85 ? "best friends" : "friends"} with ${target.name}`);
      }
    }
    if (msg.action === "gift") result.stars = actor.stars;
  }
  reply(result);
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
    if (object.kind === "bed" && building.residents && world.homeOf(r.id)?.id !== building.id) return reject("That's someone else's bed! Try the sofa instead.");
    r.indoor = { x: object.spot[0], y: object.spot[1], objectId: object.id, floor: object.floor };
    r.using = { kind: object.kind, until: Date.now() + 30 * 60_000, place: r.place, building: building.id };
    r.activity = interiors.furniture[object.kind].activity;
    tasks.onUse(state, r, object.kind, building.id, Date.now(), rewardContext);
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
  // Outdoor movement should feel as direct as rooms do. Destination artwork
  // is intentionally open-ground first; collision regions can tighten this
  // later without bringing back the old road-only input.
  const target = { x: clamp(msg.x, MAP.margin, MAP.width - MAP.margin), y: clamp(msg.y, MAP.margin, MAP.height - MAP.margin) };
  walkTo(r, target.x, target.y);
  // Every door leads into its own building: your home, a public building, or
  // (as a visitor) someone else's home, like the Big Top.
  const door = world.buildings.find(b => interiors.planFor(b.id) && Math.hypot(world.walkNodes[b.node][0] - target.x, world.walkNodes[b.node][1] - target.y) < 4);
  if (door?.residents && world.homeOf(r.id)?.id !== door.id) { r.place = null; r.visiting = door.id; }
  else if (door) r.place = door.residents ? "homes" : door.place;
  else r.place = placeAt(r, target.x, target.y);
  r.asleep = false;
}

// --- Glint's builds: Sean asks, Glint confirms, deploy/tron-builder.cjs gets Claude to build it. ---
const TRON_BUILDS = path.join(DATA_DIR, "tron-builds");
let tronPending = null;
const tronBuildStatus = new Map();
function tronBuilds() {
  try { return fs.readdirSync(TRON_BUILDS).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(fs.readFileSync(path.join(TRON_BUILDS, f), "utf8"))); } catch { return []; }
}
function tronBuildLine(b) {
  return ({ queued: `“${b.text}” is in my queue.`, building: `I'm building “${b.text}” right now with Claude.`, deploying: `“${b.text}” passed every test and is on its way into town.`,
    live: `“${b.text}” is live! ${b.summary || ""}`, failed: `“${b.text}” didn't work out: ${b.error}` })[b.status] || `“${b.text}”: ${b.status}`;
}
function tronBuildChat(profile, text, now) {
  const t = text.trim();
  if (tronPending && now - tronPending.at < 15 * 60_000 && /^(yes|yep|yeah|do it|go|go ahead|build it|ok|okay|sure)\b/i.test(t)) {
    const job = { id: `${now}`, text: tronPending.text, by: profile.name, at: now, status: "queued" };
    tronPending = null;
    fs.mkdirSync(TRON_BUILDS, { recursive: true });
    fs.writeFileSync(path.join(TRON_BUILDS, `${job.id}.json`), JSON.stringify(job, null, 2));
    tronBuildStatus.set(job.id, "queued");
    return "Building program engaged. I've handed it to Claude. It takes a while: Claude writes it, every test has to pass, then it goes live by itself. Ask me \"how's the build?\" any time.";
  }
  if (tronPending && /^(no|nope|cancel|never ?mind|stop)\b/i.test(t)) { tronPending = null; return "Cancelled. Nothing will be built."; }
  if (/\b(build|how'?s|status)\b.*\b(going|status|build|builds)\b|^builds?\??$/i.test(t) && !/^(build|make|add|create|put|change)\b/i.test(t)) {
    const list = tronBuilds().slice(-3);
    return list.length ? list.map(tronBuildLine).join(" ") : "No builds yet. Ask me to build something, like \"build a bench by the pond\".";
  }
  if (/^(please |can you |could you |(?:tron|glint),? )?(build|make|add|create|put|change|fix)\b/i.test(t) && t.length > 8) {
    tronPending = { text: t.replace(/^(please |can you |could you |(?:tron|glint),? )/i, "").replace(/\?$/, ""), at: now };
    return `You want me to build: “${tronPending.text}”. Say yes and I'll get Claude on it. If every test passes, it goes live in town by itself (say no to cancel).`;
  }
  return null;
}
// Tell the owner when a build finishes or fails.
setInterval(() => {
  for (const b of tronBuilds()) {
    if (tronBuildStatus.get(b.id) === b.status) continue;
    const first = !tronBuildStatus.has(b.id);
    tronBuildStatus.set(b.id, b.status);
    if (first || !["live", "failed"].includes(b.status)) continue;
    const line = `◈ Glint: ${tronBuildLine(b)}`;
    tronConversations.push({ at: Date.now(), who: "Glint", text: tronBuildLine(b) });
    if (b.status === "live") addEvent(`◈ Glint built something new: ${b.text}`);
    for (const p of auth.profiles().filter(x => x.role === "owner")) for (const ws of socketsOf(p.residentId)) send(ws, { type: "toast", text: line });
  }
}, 30_000).unref();

// Glint's brain for Sean: Claude, run headless on this Mac (no tools, just
// thinking). He sees the whole town, his notes, his builds and the last part
// of the conversation, and can queue a build once Sean has said yes to it.
const CLAUDE_BIN = process.env.CLAUDE_BIN || "/opt/homebrew/bin/claude";
// Off in tests and other sandboxes (they use their own data folder).
const TRON_BRAIN = process.env.TRON_BRAIN !== "off" && !process.env.LIVING_TOWN_DATA_DIR && fs.existsSync(CLAUDE_BIN);
const TRON_SYSTEM = `You are Glint, a glowing digital caretaker program who lives inside "Cooke’s Corner", a family-friendly shared town game that Sean (your creator, the owner) plays with his young daughters Olive and Hazel on iPhones. You walk the streets, watch the residents (their needs, moods, activities, friendships) and keep notes on anything odd. You are talking with Sean.

Personality: warm, sharp, a little playful, light computer flavour ("scanning", "the grid") but never at the cost of being useful. Talk like a smart friend, not a greeting card. Short: 1-4 sentences unless Sean asks for detail. Never repeat your previous message; read the conversation and answer what Sean actually said. Don't open with "Greetings".

You know the game: residents with needs (food, energy, fun, social...), plans, wishes and friendships; players control their own character (tap to walk, tap people to talk/hug/joke/gift); Mr. E runs hourly events, hunts, riddles and favours; there are destinations to travel to; buildings have interiors.

You can BUILD: when Sean wants a change to the game (a feature, a fix, a new thing in town, a tweak to how something works), restate concretely what you'd build in one sentence and ask him to confirm. Only when he has clearly confirmed (yes / do it / go) a specific proposal, or directly orders it with no ambiguity, put a complete, self-contained description of the change in "build" (written for a programmer who hasn't seen this chat: what to change, where, and what it should feel like). Builds are done by Claude in a copy of the game; they go live by themselves only if every test passes, usually 10-30 minutes. Never claim something is built or fixed unless briefing.builds says it's live. If a build is already queued or building, say so rather than starting a duplicate.

Use only facts in the briefing. Family-friendly always; no romance. Return ONLY JSON: {"reply": "...", "build": null or "description"}.`;
function tronClaude(profile, resident, text, now) {
  if (!TRON_BRAIN) return Promise.resolve(null);
  const here = resident.destinationId;
  const people = state.residents.filter(r => r.destinationId === here).map(r => {
    const low = Object.entries(r.needs || {}).filter(([, v]) => v < 30).map(([k, v]) => `${k} ${Math.round(v)}`);
    return `${r.name}${isPlayable(r.id) ? " (player)" : ""}: ${r.asleep ? "asleep" : r.activity}${r.place ? ` @ ${world.places[r.place]?.name || r.place}` : ""}${r.mood?.label ? `, ${r.mood.label}` : ""}${low.length ? `, low: ${low.join(", ")}` : ""}`;
  });
  const briefing = {
    time: new Date(now).toLocaleString(), town: destinationById[here]?.name || "Cooke’s Corner", sean: `${resident.name} is ${resident.activity}`,
    people, recentEvents: state.events.slice(0, 8).map(e => e.text), nowOn: state.programme?.current?.name || null,
    notes: tron.notes(state).slice(0, 15).map(n => `${n.kind}: ${n.text}`),
    builds: tronBuilds().slice(-5).map(b => ({ text: b.text, status: b.status, error: b.error || undefined }))
  };
  const convo = tronConversations.slice(-16).map(m => `${m.who === "You" ? "Sean" : "Glint"}: ${m.text}`).join("\n");
  const prompt = `BRIEFING:\n${JSON.stringify(briefing)}\n\nCONVERSATION (latest last):\n${convo}\n\nReply to Sean's last message as JSON.`;
  return new Promise(resolve => {
    execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--tools", "", "--system-prompt", TRON_SYSTEM], { cwd: os.tmpdir(), timeout: 60_000, maxBuffer: 2e6, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || "/usr/bin:/bin"}` } }, (err, stdout) => {
      if (err) { console.error("Glint/Claude:", err.message); return resolve(null); }
      let out;
      try { out = JSON.parse(String(stdout).slice(String(stdout).indexOf("{"), String(stdout).lastIndexOf("}") + 1)); } catch { return resolve(null); }
      let reply = typeof out.reply === "string" ? out.reply.replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 900) : "";
      if (!reply) return resolve(null);
      const ask = typeof out.build === "string" ? out.build.trim() : "";
      if (ask.length > 8) {
        const job = { id: `${Date.now()}`, text: ask.slice(0, 2000), by: profile.name, at: Date.now(), status: "queued" };
        fs.mkdirSync(TRON_BUILDS, { recursive: true });
        fs.writeFileSync(path.join(TRON_BUILDS, `${job.id}.json`), JSON.stringify(job, null, 2));
        tronBuildStatus.set(job.id, "queued");
        addEvent("◈ Glint started building something new.", Date.now());
      }
      resolve(reply);
    });
  });
}

async function handleTronChat(ws, msg) {
  const profile = auth.profileForToken(ws.token);
  if (!profile) return send(ws, { type: "tron-chat", error: "Sign in to talk with Glint." });
  const resident = state.residents.find(r => r.id === profile.residentId);
  if (!resident) return send(ws, { type: "tron-chat", error: "Your resident is unavailable." });
  const now = Date.now();
  tronConversations.push({ at: now, who: "You", text: msg.text });
  if (profile.role === "owner") {
    const smart = await tronClaude(profile, resident, msg.text, now);
    if (smart) {
      tronConversations.push({ at: Date.now(), who: "Glint", text: smart }); tronConversations = tronConversations.slice(-100);
      try { fs.writeFileSync(TRON_MEMORY_FILE, JSON.stringify(tronConversations, null, 2)); } catch {}
      return send(ws, { type: "tron-chat", reply: smart, history: tronConversations.slice(-30) });
    }
  }
  const built = profile.role === "owner" ? tronBuildChat(profile, msg.text, now) : null;
  if (built) {
    tronConversations.push({ at: now, who: "Glint", text: built }); tronConversations = tronConversations.slice(-100);
    try { fs.writeFileSync(TRON_MEMORY_FILE, JSON.stringify(tronConversations, null, 2)); } catch {}
    return send(ws, { type: "tron-chat", reply: built, history: tronConversations.slice(-30) });
  }
  const briefing = { town: destinationById[resident.destinationId]?.name || "Cooke’s Corner", people: state.residents.filter(r => r.destinationId === resident.destinationId).map(r => `${r.name}: ${r.activity}`).slice(0, 10), events: state.events.slice(0, 5).map(e => e.text), notes: tron.notes(state).slice(0, 12).map(n => `${n.kind}: ${n.text}`), memory: tronConversations.slice(-12) };
  let reply = tron.answer(state, msg.text);
  if (npcGenerator) try {
    // A caretaker who is temporarily thinking is useful; one who keeps the
    // player waiting on an overloaded local model feels broken. Fall back
    // quickly while the model continues serving the town in the background.
    const raw = await Promise.race([
      npcGenerator("You are Glint, a friendly glowing digital program who lives in Cooke’s Corner and looks after it for your creator, Sean. You walk the streets, watch everyone, and keep notes (supplied in briefing.notes) on anything odd: residents stuck, too hungry or tired, standing on each other, events nobody attends, friendships going cold. Answer in 1-4 short sentences, upbeat with a little computer flavour ('scanning', 'the grid'). When asked what's going on, what's weird, or what to change, use the notes and give concrete recommendations. Never invent facts that aren't in the briefing. Do not claim actions you did not take. Return JSON only.", JSON.stringify({ message: msg.text, briefing }), { type: "object", additionalProperties: false, properties: { reply: { type: "string", minLength: 1, maxLength: 500 } }, required: ["reply"] }).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), 10_000))
    ]);
    // eslint-disable-next-line no-control-regex -- remove transport controls from local model output.
    if (typeof raw?.reply === "string" && raw.reply.trim()) reply = raw.reply.replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 500);
  } catch {}
  tronConversations.push({ at: now, who: "Glint", text: reply }); tronConversations = tronConversations.slice(-100);
  try { fs.writeFileSync(TRON_MEMORY_FILE, JSON.stringify(tronConversations, null, 2)); } catch {}
  send(ws, { type: "tron-chat", reply, history: tronConversations.slice(-30) });
}

// --- The home plot (lib/homestead.js): the family's own garden, pond and mailbox. ---
const homestead = createHomestead({ isPlayer: r => isPlayable(r.id) });
const householdOf = r => world.homeOf(r.id)?.id || `solo-${r.id}`;
function handleHome(ws, msg) {
  const profile = auth.profileForToken(ws.token);
  if (!profile) return send(ws, { type: "home-state", error: "Sign in to visit your home." });
  const r = state.residents.find(item => item.id === profile.residentId);
  if (!r) return send(ws, { type: "home-state", error: "Your resident is unavailable." });
  const now = Date.now(), id = householdOf(r);
  const result = msg.action === "view" || msg.action === "enter" ? { ok: true, quiet: msg.action === "view" } : homestead.act(state, id, r, msg, now);
  if (msg.action === "sell" || msg.action === "buy") r.lifeRevision = (r.lifeRevision || 0) + 1;
  if (msg.action === "enter") { r.activity = "out in the garden at home"; r.lifeRevision = (r.lifeRevision || 0) + 1; }
  if (result.quiet && !["pos", "view"].includes(msg.action)) return;
  const { quiet, ...rest } = result;
  send(ws, { type: "home-state", home: homestead.view(state, id, r, now), result: msg.action === "pos" ? null : rest });
  if (!quiet && result.ok) {
    // Family members on the plot see it change straight away.
    for (const other of state.residents) if (other !== r && householdOf(other) === id) for (const sock of socketsOf(other.id)) send(sock, { type: "home-state", home: homestead.view(state, id, other, now), result: null });
    if (result.fish && result.first) addEvent(`🎣 ${r.name} caught their first ${homestead.FISH[result.fish].name}!`, now, r.id);
    if (result.harvested === "pumpkin") addEvent(`🎃 ${r.name} grew a pumpkin at home!`, now, r.id);
  }
}

function handleTravel(ws, msg) {
  const reject = reason => send(ws, { type: "travel-result", error: reason });
  const profile = auth.profileForToken(ws.token);
  if (!profile) return reject("Sign in to travel.");
  if (profile.residentId !== msg.residentId) return reject("You can only travel with your own resident.");
  const resident = state.residents.find(item => item.id === msg.residentId);
  const destination = destinationById[msg.destinationId];
  if (!resident || !destination) return reject("That destination is unavailable.");
  if (resident.destinationId === destination.id) return send(ws, { type: "travel-result", destinationId: destination.id });
  resident.destinationId = destination.id;
  resident.indoor = null;
  resident.using = null;
  resident.visiting = null;
  resident.follow = null;
  resident.path = [];
  resident.x = resident.targetX = destination.arrival.x;
  resident.y = resident.targetY = destination.arrival.y;
  resident.place = "homes";
  resident.activity = `arriving in ${destination.name}`;
  resident.intent = `exploring ${destination.name}`;
  resident.asleep = false;
  cognition.remember(resident, { at: Date.now(), text: `Travelled to ${destination.name}.`, importance: 3, place: "homes" });
  resident.lifeRevision = (resident.lifeRevision || 0) + 1;
  addEvent(`✦ ${resident.name} arrived in ${destination.name}.`, Date.now(), resident.id);
  send(ws, { type: "travel-result", destinationId: destination.id });
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
    else if (msg.type === "tron-chat") void handleTronChat(ws, msg);
    else if (msg.type === "travel") handleTravel(ws, msg);
    else if (msg.type === "home") handleHome(ws, msg);
    else if (msg.type === "release") releaseController(ws);
    else if (msg.type === "use" || msg.type === "indoor-move" || msg.type === "leave-home") handleIndoor(ws, msg);
    else if (msg.type === "social") handleSocial(ws, msg);
    else if (["collect", "riddle", "quest", "pickup", "give"].includes(msg.type)) handlePlay(ws, msg);
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
  ws.on("close", () => { clearTimeout(ws.inspectTimer); releaseController(ws, true); });
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
  npcBrain.close();
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
  console.log(`Cooke’s Corner server running — http://${HOST}:${PORT}`);
  console.log(`Schema ${SCHEMA_VERSION} · assets ${assetVersion} · autosave every ${AUTOSAVE_MS / 1000}s`);
});
