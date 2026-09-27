"use strict";
/**
 * Custom residents and character looks.
 *
 * Built-in residents have hand-written profiles and minds. Residents created
 * in the app get a profile and mind generated from their age (life stage),
 * with small per-person variation, registered at runtime so the life engine
 * and minds treat them like everyone else.
 */

const crypto = require("crypto");
const world = require("../shared/world");
const life = require("./life");
const mind = require("./mind");

const MAX_CUSTOM_RESIDENTS = 12;
const HEX = /^#[0-9a-f]{6}$/i;
const NAME = /^[\p{L}][\p{L} '-]{0,19}$/u;
const WEEKDAYS = [1, 2, 3, 4, 5];

const stages = {
  child: {
    traits: { openness: 0.75, conscientiousness: 0.4, extraversion: 0.8, agreeableness: 0.75, neuroticism: 0.35 },
    interests: ["play", "animals", "sport", "exploring", "games"], speed: 1.25, wake: 7, bed: 20, weekendLie: 0.5,
    school: [8, 14], role: "Kid", likes: ["playing outside", "animals", "drawing", "games"],
    voice: { share: ["Guess what? {x}!", "Look, look: {x}!"], reply: ["Cool!", "Wow!", "Really?!"], push: ["No fair!", "Nuh-uh!"] }
  },
  teen: {
    traits: { openness: 0.7, conscientiousness: 0.5, extraversion: 0.55, agreeableness: 0.65, neuroticism: 0.5 },
    interests: ["music", "art", "games", "people", "stories"], speed: 1.05, wake: 7, bed: 22.5, weekendLie: 1.5,
    school: [8, 15], role: "Teen", likes: ["music", "hanging out", "art", "games"],
    voice: { share: ["Honestly, {x}.", "So, {x}."], reply: ["Nice.", "Huh, cool.", "No way."], push: ["Not really.", "Eh, I don't think so."] }
  },
  "young-adult": {
    traits: { openness: 0.75, conscientiousness: 0.45, extraversion: 0.65, agreeableness: 0.6, neuroticism: 0.45 },
    interests: ["design", "food", "games", "people", "music"], speed: 1.1, wake: 8.5, bed: 24, weekendLie: 1.5,
    role: "Young adult", likes: ["coffee", "music", "exploring town", "new ideas"],
    voice: { share: ["Okay so {x}.", "Fun fact: {x}."], reply: ["Love that.", "Oh nice!", "Ha, amazing."], push: ["Hmm, not sure about that.", "Agree to disagree!"] }
  },
  adult: {
    traits: { openness: 0.6, conscientiousness: 0.65, extraversion: 0.55, agreeableness: 0.7, neuroticism: 0.4 },
    interests: ["food", "community", "people", "craft", "nature"], speed: 1, wake: 6.5, bed: 23, weekendLie: 1,
    role: "Town resident", likes: ["good food", "long walks", "helping out", "quiet evenings"],
    voice: { share: ["You know, {x}.", "Funny thing: {x}."], reply: ["Oh, lovely.", "Good to hear.", "How about that."], push: ["I'm not so sure.", "Let's agree to disagree."] }
  },
  senior: {
    traits: { openness: 0.45, conscientiousness: 0.75, extraversion: 0.4, agreeableness: 0.8, neuroticism: 0.25 },
    interests: ["nature", "birds", "stories", "community", "craft"], speed: 0.75, wake: 5.5, bed: 21, weekendLie: 0,
    role: "Retiree", likes: ["gardening", "birdwatching", "old stories", "early mornings"],
    voice: { share: ["Mm, {x}.", "In my day... well, {x}."], reply: ["Well, well.", "Isn't that nice.", "Mm-hm."], push: ["Hmph.", "Now, now."] }
  }
};

function stageFor(age) {
  if (age < 13) return "child";
  if (age < 18) return "teen";
  if (age < 25) return "young-adult";
  if (age < 65) return "adult";
  return "senior";
}

// Deterministic 0..1 values from a string, so a resident's quirks survive restarts.
function jitter(seed, count) {
  const bytes = crypto.createHash("sha256").update(seed).digest();
  return Array.from({ length: count }, (_, i) => bytes[i] / 255);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/** Keep only valid look fields. */
function sanitizeLook(look = {}) {
  const out = {};
  for (const key of ["skin", "hair", "shirt", "pants", "shoes"]) if (HEX.test(look?.[key] || "")) out[key] = look[key].toLowerCase();
  if (world.HAIR_STYLES.includes(look?.style)) out.style = look.style;
  if (world.ACCESSORIES.includes(look?.accessory)) out.accessory = look.accessory;
  return out;
}

function bornFromAge(age, now) {
  const date = new Date(now);
  date.setFullYear(date.getFullYear() - age);
  date.setDate(date.getDate() - 30); // birthday a month ago, so it isn't "today"
  return date.toISOString().slice(0, 10);
}

function buildProfile(resident, now) {
  const { name, born } = resident.custom;
  const age = life.ageAt({ born }, now);
  const stage = stageFor(age);
  const s = stages[stage];
  const minor = stage === "child" || stage === "teen";
  const career = minor ? { kind: "school", title: stage === "child" ? "Elementary student" : "Student", level: 1, organization: "Living Town School" }
    : stage === "senior" ? { kind: "retired", title: "Retired", level: 1, organization: "Living Town" }
    : { kind: "free", title: "Town resident", level: 1, organization: "Living Town" };
  return {
    name, born, role: s.role, custom: true, noHistory: true,
    summary: `${name} moved to Living Town recently and is still finding a favorite spot.`,
    likes: s.likes, dislikes: ["being rushed", "rainy days"], values: ["kindness", "curiosity"],
    goals: ["make a friend in town", "find a favorite spot in Living Town", "get to know the neighbors"],
    family: [], career, historyTracks: ["community"]
  };
}

function buildMind(resident, now) {
  const age = life.ageAt({ born: resident.custom.born }, now);
  const stage = stageFor(age);
  const s = stages[stage];
  const j = jitter(resident.id, 6);
  const traits = {};
  Object.keys(s.traits).forEach((key, i) => { traits[key] = clamp(s.traits[key] + (j[i] - 0.5) * 0.3, 0.05, 0.95); });
  const start = Math.floor(j[5] * s.interests.length);
  const interests = [...s.interests.slice(start), ...s.interests.slice(0, start)].slice(0, 4);
  const obligations = s.school ? [{ days: WEEKDAYS, from: s.school[0], to: s.school[1], place: "square", activity: "in class at the schoolhouse by the square", strict: true }] : [];
  return { traits, interests, speed: s.speed, wake: s.wake, bed: s.bed, weekendLie: s.weekendLie, obligations, voice: s.voice };
}

/** Register (or refresh) a custom resident's profile and mind. */
function registerCustom(resident, now = Date.now()) {
  if (!resident.custom) return;
  life.registerProfile(resident.id, buildProfile(resident, now));
  mind.registerMind(resident.id, buildMind(resident, now));
}

function unregisterCustom(id) {
  life.unregisterProfile(id);
  mind.unregisterMind(id);
}

/** Push custom residents' home choices into the shared world. */
function syncHomes(state) {
  world.setHomeAssignments(homeMap(state));
}

function homeMap(state) {
  return Object.fromEntries(state.residents.filter(r => r.custom?.homeId).map(r => [r.id, r.custom.homeId]));
}

class CastError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Validate a create/update request. Returns clean fields. */
function validateDetails(body, state, { requireAll, selfId } = {}) {
  const out = {};
  if (body.name !== undefined || requireAll) {
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    if (!NAME.test(name)) throw new CastError(400, "Names are 1–20 letters (spaces, apostrophes and hyphens are fine).");
    if (state.residents.some(r => r.id !== selfId && r.name.toLowerCase() === name.toLowerCase())) throw new CastError(409, "Someone in town already has that name.");
    out.name = name;
  }
  if (body.age !== undefined || requireAll) {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 3 || age > 95) throw new CastError(400, "Age must be a whole number from 3 to 95.");
    out.age = age;
  }
  if (body.homeId !== undefined || requireAll) {
    if (!world.homeBuildings.some(b => b.id === body.homeId)) throw new CastError(400, "Pick one of the town's houses.");
    out.homeId = body.homeId;
  }
  return out;
}

function newResidentId(name) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "").slice(0, 10) || "resident";
  return `c-${slug}-${crypto.randomBytes(2).toString("hex")}`;
}

module.exports = {
  MAX_CUSTOM_RESIDENTS,
  CastError,
  stageFor,
  sanitizeLook,
  bornFromAge,
  registerCustom,
  unregisterCustom,
  syncHomes,
  homeMap,
  validateDetails,
  newResidentId
};
