"use strict";
/**
 * Awareness: residents notice what's around them, react in character, and
 * remember it.
 *
 * They notice rain starting while they're out, something going on nearby
 * (Mr. E's events, a crowd), a familiar place looking different from last
 * time, and friends passing by. Each noticing shows as a quick emote over
 * their head (💧 ❗ 👋 😄), sometimes a line in their own manner (Hazel
 * squeals at rain, Finn shrugs), becomes a memory, and gives them something
 * to talk about later ("Did you see the duck race at the park?"). Rain they
 * got caught in makes that place a little less tempting; a friendly wave
 * warms a friendship a little.
 *
 * Everything is hand-written and child-safe. Players' characters are never
 * made to react; residents asleep or indoors don't notice outdoor things.
 */

const speech = require("./speech");

const EMOTE_MS = 3500;
const SPOKEN_GAP_MS = 2 * 60_000; // at most one spoken reaction every couple of minutes
const MAX_NOTICED = 8;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Lines by personality: [test(traits), lines]. The first matching group is used.
const RAIN = [
  [t => t.neuroticism > 0.55, ["Oh no, I'm getting soaked!", "Rain! Quick, somewhere dry!", "My hair! Ugh, rain."]],
  [t => t.extraversion > 0.8 && t.openness > 0.6, ["Rain! Puddle-jumping time!", "Woo, rain! Let's go splash!", "I like the smell of rain!"]],
  [t => t.conscientiousness > 0.7, ["Should have brought an umbrella.", "Rain. Right on schedule.", "Better head somewhere dry."]],
  [() => true, ["Oh, it's raining!", "Here comes the rain.", "Pitter-patter! Rain!"]]
];
const EVENT = [
  [t => t.extraversion > 0.7, ["Ooh, {event}! Come on!", "Look, {event}! This'll be fun!", "{event}? I'm in!"]],
  [t => t.extraversion < 0.4, ["Oh, {event}. I'll watch from here.", "Hm, {event}. Interesting.", "{event}... maybe I'll take a peek."]],
  [() => true, ["Oh look, {event}!", "{event}! How nice.", "What's this? {event}!"]]
];
const CROWD = [
  [t => t.extraversion < 0.4, ["So busy here today...", "Bit crowded. I might find somewhere quieter.", "Lots of people today."]],
  [t => t.extraversion > 0.7, ["What a crowd! Everyone's here!", "Ooh, it's busy! Hi everyone!", "The more the merrier!"]],
  [() => true, ["Busy today!", "Lots going on here."]]
];
const WAVE = ["Hi {friend}!", "Hey, {friend}!", "Oh, hi {friend}!", "Morning, {friend}!", "Hello there, {friend}!"];
const CHANGED = ["{place} looks different today. {what}!", "Oh! {what} at {place}!", "Look what's happening at {place}: {what}!"];

function pickLines(groups, traits) { return (groups.find(([test]) => test(traits)) || groups[groups.length - 1])[1]; }

function ensure(r) {
  const saved = r.aware && typeof r.aware === "object" ? r.aware : {};
  r.aware = { seen: saved.seen && typeof saved.seen === "object" ? saved.seen : {}, spokeAt: Number(saved.spokeAt) || 0, lastPlace: saved.lastPlace || "", placeLooks: saved.placeLooks && typeof saved.placeLooks === "object" ? saved.placeLooks : {} };
  r.noticed = Array.isArray(r.noticed) ? r.noticed.filter(n => n && typeof n.text === "string").slice(0, MAX_NOTICED) : [];
  return r;
}

/**
 * React to something: an emote, maybe a line, a memory, and something to
 * share later. `key` stops the same thing being noticed again too soon.
 */
function notice(r, { key, cooldownMin, emote, line, memory, share, place }, now, random) {
  if (now - (Number(r.aware.seen[key]) || 0) < cooldownMin * 60_000) return false;
  r.aware.seen[key] = now;
  r.emote = { emoji: emote, until: now + EMOTE_MS };
  if (line && now - r.aware.spokeAt > SPOKEN_GAP_MS && !(r.speech && r.speech.until > now) && random() < 0.75) {
    r.aware.spokeAt = now;
    speech.say(r, line, now);
  }
  if (memory) {
    r.memories = [{ at: now, about: r.id, text: memory, type: "noticed", place }, ...(r.memories || [])].slice(0, 120);
    if (share) r.noticed = [{ at: now, text: share, place }, ...r.noticed.filter(n => n.text !== share)].slice(0, MAX_NOTICED);
    r.lifeRevision = (r.lifeRevision || 0) + 1;
  }
  return true;
}

/**
 * Called every few seconds. `ctx`: mindFor, random, isControlled(id),
 * isInside(r), weather(now), event(now) -> { id, name, place } | null,
 * placeName(key), like(r, place, amount).
 */
function tick(state, now, ctx) {
  const event = ctx.event(now);
  const weather = ctx.weather(now);
  const outdoors = state.residents.filter(r => !r.asleep && !ctx.isInside(r));
  for (const r of state.residents) {
    ensure(r);
    if (r.asleep || ctx.isControlled(r.id)) continue;
    const t = ctx.mindFor(r.id).traits;
    const pick = list => list[Math.floor(ctx.random() * list.length)];
    const inside = ctx.isInside(r);
    const placeName = r.place ? ctx.placeName(r.place) : "town";
    // One reaction at a time: the first thing they notice this moment.
    let reacted = false;
    const react = what => { if (!reacted) reacted = notice(r, what, now, ctx.random); return reacted; };

    // Rain starting while they're out.
    if (weather === "rain" && !inside) {
      if (react({ key: "rain", cooldownMin: 45, emote: "💧", line: pick(pickLines(RAIN, t)), memory: `I got caught in the rain at ${placeName}.`, share: `I got caught in the rain at ${placeName}`, place: r.place })) {
        ctx.like(r, r.place, -0.05);
      }
    }

    // Something going on nearby.
    if (event && !inside && r.place === event.place) {
      react({ key: `event:${event.id}`, cooldownMin: 120, emote: "❗", line: pick(pickLines(EVENT, t)).replace("{event}", event.name.toLowerCase().replace(/^./, c => c.toUpperCase())),
        memory: `I saw the ${event.name.toLowerCase()} at ${placeName}.`, share: `I saw the ${event.name.toLowerCase()} at ${placeName}`, place: r.place });
    }

    // A crowd (introverts and extraverts feel differently about it).
    if (!inside && r.place && r.place !== "homes") {
      const here = outdoors.filter(o => o !== r && o.place === r.place).length;
      if (here >= 5) react({ key: `crowd:${r.place}`, cooldownMin: 90, emote: t.extraversion < 0.4 ? "😵" : "🎉", line: pick(pickLines(CROWD, t)), memory: `${placeName} was really busy.`, share: `${placeName} was so busy earlier`, place: r.place });
    }

    // A familiar place that looks different from last time (an event on, the weather changed).
    if (r.place && r.place !== "homes" && r.place !== r.aware.lastPlace && !(r.path || []).length) {
      const looks = event && event.place === r.place ? event.name : weather === "rain" ? "rain" : weather === "sunny" ? "sunshine" : "usual";
      const before = r.aware.placeLooks[r.place];
      if (before && before !== looks && looks !== "usual") {
        const what = looks === "rain" ? "Everything's wet and shiny" : looks === "sunshine" ? "It's all lit up with sunshine" : looks;
        react({ key: `changed:${r.place}:${looks}`, cooldownMin: 240, emote: "👀", line: pick(CHANGED).replace("{place}", placeName).replace("{what}", what),
          memory: `${placeName} looked different today: ${what.toLowerCase()}.`, share: `${placeName} looked different today`, place: r.place });
      }
      r.aware.placeLooks[r.place] = looks;
      r.aware.lastPlace = r.place;
    }
    // On the move: next arrival counts as arriving again.
    if ((r.path || []).length) r.aware.lastPlace = "";

    // Friends passing by: a wave.
    if (!inside && !reacted) {
      for (const o of outdoors) {
        if (o === r || Math.hypot(o.x - r.x, o.y - r.y) > 34) continue;
        const rel = Number(r.relationships?.[o.id]) || 0;
        if (rel < 40 || now - (Number(r.mind?.talkedWith?.[o.id]) || 0) < 20 * 60_000) continue;
        if (react({ key: `wave:${o.id}`, cooldownMin: 60, emote: "👋", line: pick(WAVE).replace("{friend}", o.name), memory: `I waved to ${o.name} at ${placeName}.`, place: r.place })) {
          r.relationships[o.id] = clamp(rel + 0.5, -100, 100);
          break;
        }
      }
    }
  }
}

/** Something they noticed recently, to bring up in conversation (or null). */
function recentNotice(r, now, maxAgeMs = 3 * 3_600_000) {
  return (r.noticed || []).find(n => now - n.at < maxAgeMs) || null;
}

module.exports = { tick, ensure, notice, recentNotice, RAIN, EVENT, CROWD, WAVE, CHANGED };
