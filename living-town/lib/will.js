"use strict";
/**
 * Free will: residents want things of their own and act on them.
 *
 * - Wishes. Everyone keeps up to three wishes drawn from their interests,
 *   friendships and memories ("Watch the ducks at Juniper Park", "Spend time
 *   with Olive", "Make up with Zara"). Wishes pull them toward places and
 *   people; when one comes true it lights up, reaches the feed and lifts
 *   their mood.
 * - Choice. Instead of always taking the single top-scoring place, they
 *   choose among their good options, more freely when they're low or less
 *   conscientious. School and emergencies still win.
 * - Invitations. Residents ask friends along; the friend decides for
 *   themselves, and "maybe later" is always a friendly answer.
 * - Memories that matter. Places where good things happened become
 *   favourites (and places with a squabble a little less so).
 * - Feelings. Recent moments ("✨ Wish came true", "🙂 Maybe next time")
 *   are kept with their reasons so players can see why someone feels how
 *   they do.
 *
 * Players' own characters are never moved by any of this.
 */

const { places } = require("../shared/world");

const MAX_WISHES = 3;
const WISH_HOURS = 8;
const FULFIL_MINUTES = 3;
const MAX_FEELINGS = 5;

// "watching the ducks" -> "watch the ducks": the verbs our activities use.
const BASE_VERB = {
  watching: "watch", counting: "count", kicking: "kick", exploring: "explore", lying: "lie", climbing: "climb",
  sketching: "sketch", enjoying: "enjoy", "people-watching": "people-watch", playing: "play", catching: "catch",
  reading: "read", racing: "race", listening: "listen", seeing: "see", trying: "try", humming: "hum",
  trading: "trade", writing: "write", having: "have", tasting: "taste", rearranging: "rearrange", haggling: "haggle",
  browsing: "browse", shopping: "shop", taking: "take", planing: "plane", mixing: "mix", showing: "show",
  sorting: "sort", working: "work", resting: "rest"
};

const TAG_EMOJI = {
  animals: "🦆", birds: "🐦", sport: "⚽", play: "🎈", exploring: "🧭", games: "♟️", art: "🎨", design: "✏️",
  stories: "📖", music: "🎵", food: "🍰", gossip: "💬", community: "📌", tinkering: "🔧", craft: "🪵",
  teaching: "🍎", business: "📋", shopping: "🛍️", people: "👀", nature: "☁️", family: "🏡", rest: "😌"
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function imperative(activity) {
  const [first, ...rest] = String(activity).split(" ");
  const verb = BASE_VERB[first];
  return verb ? [verb, ...rest].join(" ") : null;
}

function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

/** Normalize a resident's will state (kept at the top level so older code can't drop it). */
function ensure(resident) {
  const saved = resident.will && typeof resident.will === "object" ? resident.will : {};
  resident.will = {
    nextWishAt: Number(saved.nextWishAt) || 0,
    nextInviteAt: Number(saved.nextInviteAt) || 0,
    lastVisited: saved.lastVisited && typeof saved.lastVisited === "object" ? saved.lastVisited : {},
    placeSince: Number(saved.placeSince) || 0,
    placeKey: typeof saved.placeKey === "string" ? saved.placeKey : ""
  };
  resident.wishes = Array.isArray(resident.wishes) ? resident.wishes.filter(w => w && typeof w.text === "string" && typeof w.type === "string").slice(0, MAX_WISHES) : [];
  resident.feelings = Array.isArray(resident.feelings) ? resident.feelings.filter(f => f && typeof f.text === "string").slice(0, MAX_FEELINGS) : [];
  resident.placeAffinity = resident.placeAffinity && typeof resident.placeAffinity === "object" ? resident.placeAffinity : {};
  return resident;
}

/** A feeling with a reason, which also nudges mood a little. */
function feel(resident, emoji, text, { valence = 0, stress = 0, hours = 3, now = Date.now() } = {}) {
  ensure(resident);
  resident.feelings = [{ emoji, text, at: now, until: now + hours * 3_600_000 }, ...resident.feelings.filter(f => f.text !== text)].slice(0, MAX_FEELINGS);
  if (resident.mood) {
    resident.mood.valence = clamp(resident.mood.valence + valence, 0, 100);
    resident.mood.stress = clamp(resident.mood.stress + stress, 0, 100);
  }
  resident.lifeRevision = (resident.lifeRevision || 0) + 1;
}

function like(resident, placeKey, amount) {
  if (!placeKey || !places[placeKey] || placeKey === "homes") return;
  resident.placeAffinity[placeKey] = clamp((Number(resident.placeAffinity[placeKey]) || 0) + amount, -1, 1);
}

// --- Wishes ---

/** Everything this resident might wish for right now, with weights. */
function candidates(state, r, now, ctx) {
  const mind = ctx.mindFor(r.id);
  const { openness: O, extraversion: E, agreeableness: A } = mind.traits;
  const out = [];
  const have = new Set(r.wishes.map(w => w.key));
  const add = wish => { if (!have.has(wish.key)) out.push(wish); };
  const date = new Date(now);

  // Things they love doing somewhere in town.
  for (const [placeKey, options] of Object.entries(ctx.activities)) {
    if (placeKey === "homes") continue;
    for (const [tag, activity] of options) {
      if (!tag || !mind.interests.includes(tag)) continue;
      const verb = imperative(activity);
      if (!verb) continue;
      add({ type: "do", key: `do:${placeKey}:${activity}`, place: placeKey, activity, emoji: TAG_EMOJI[tag] || "✨",
        text: `${capitalize(verb)} at ${places[placeKey].name}`, reason: `wants to ${verb}`, weight: 1 });
    }
  }

  // Friends they haven't seen for a while.
  const friends = Object.entries(r.relationships || {})
    .map(([id, value]) => ({ other: state.residents.find(o => o.id === id), value: Number(value) || 0 }))
    .filter(f => f.other && f.value >= 25)
    .sort((a, b) => b.value - a.value).slice(0, 3);
  for (const { other, value } of friends) {
    if (now - (Number(r.mind?.talkedWith?.[other.id]) || 0) < 3 * 3_600_000) continue;
    add({ type: "friend", key: `friend:${other.id}`, with: other.id, emoji: "👭", text: `Spend time with ${other.name}`, reason: `wants to see ${other.name}`, weight: (0.6 + E) * (0.5 + value / 100) });
  }

  // Making up after a squabble.
  for (const memory of (r.memories || []).slice(0, 30)) {
    if (memory.tone !== "friction" || now - memory.at > 24 * 3_600_000) continue;
    const other = state.residents.find(o => o.id === memory.about);
    if (other) add({ type: "makeup", key: `makeup:${other.id}`, with: other.id, emoji: "🤝", text: `Make up with ${other.name}`, reason: `wants to make up with ${other.name}`, weight: 1 + A * 1.5 });
  }

  // Somewhere they haven't been in ages.
  for (const [placeKey, place] of Object.entries(places)) {
    if (placeKey === "homes") continue;
    const last = Number(r.will.lastVisited[placeKey]) || 0;
    if (last && now - last < 24 * 3_600_000) continue;
    // A real "it's been ages" pulls harder than simply not knowing yet.
    add({ type: "visit", key: `visit:${placeKey}`, place: placeKey, emoji: "🧭", text: `Visit ${place.name}`, reason: `hasn't been to ${place.name} in ages`, weight: last ? 0.3 + O * 0.4 : 0.08 + O * 0.12 });
  }

  // The circus show, later today.
  if (ctx.showToday?.(date) && !ctx.isPerformer?.(r)) {
    add({ type: "visit", key: "show", place: "square", emoji: "🎪", text: "See the circus show", reason: "wants to see the circus show", weight: 1.4, show: true });
  }

  // A treat.
  if (mind.interests.includes("food") || (r.needs?.hunger ?? 100) < 50) {
    add({ type: "visit", key: "treat", place: "cafe", emoji: "🍰", text: "Have a treat at Moonbeam Cafe", reason: "fancies a treat", weight: 0.7 });
  }
  return out;
}

function pickWeighted(list, random) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of list) { roll -= item.weight; if (roll <= 0) return item; }
  return list[list.length - 1];
}

function newWish(state, r, now, ctx) {
  const options = candidates(state, r, now, ctx);
  if (!options.length) return null;
  const chosen = pickWeighted(options, ctx.random);
  const { weight, ...wish } = chosen;
  return { ...wish, createdAt: now, until: now + WISH_HOURS * 3_600_000 };
}

/** Is this wish coming true right now? */
function fulfilled(state, r, wish, now, ctx) {
  const settled = r.will.placeKey === r.place && now - r.will.placeSince >= FULFIL_MINUTES * 60_000 && !(r.path || []).length;
  if (wish.type === "do" || wish.type === "visit") {
    if (!settled || r.place !== wish.place) return false;
    if (wish.show) return Boolean(ctx.showOn?.(new Date(now)));
    return true;
  }
  const other = state.residents.find(o => o.id === wish.with);
  if (!other) return false;
  if (wish.type === "makeup") return (r.memories || []).some(m => m.about === other.id && m.at > wish.createdAt && m.type === "conversation" && !["friction", "declined"].includes(m.tone));
  // Friends: a chat, or a while in the same place.
  if ((Number(r.mind?.talkedWith?.[other.id]) || 0) > wish.createdAt) return true;
  return settled && other.place === r.place && !other.asleep && ctx.sameSpot(r, other);
}

function celebrate(state, r, wish, now, ctx) {
  feel(r, "✨", `Wish came true: ${wish.text}`, { valence: 8, stress: -4, hours: 4, now });
  like(r, r.place, 0.15);
  r.memories = [{ at: now, about: r.id, text: `My wish came true: ${wish.text.toLowerCase()}.`, type: "wish" }, ...(r.memories || [])].slice(0, 120);
  if (!ctx.isControlled(r.id)) r.speech = { text: `✨ ${wish.type === "makeup" ? "So glad we made up!" : "My wish came true!"}`, from: now, until: now + 7000 };
  const other = wish.with ? state.residents.find(o => o.id === wish.with) : null;
  if (other && wish.type === "makeup") feel(other, "🤝", `Made up with ${r.name}`, { valence: 4, now });
  ctx.addEvent(`✨ ${r.name}'s wish came true: ${wish.text}.`, now);
}

// --- Choosing ---

/**
 * Choose among the good options rather than always the top one. Options
 * within reach of the best are weighted by how good they are; the less
 * conscientious or the lower someone feels, the more freely they choose.
 * Strict duties (school) and emergencies take the best option.
 */
function choose(results, resident, traits, { strict = false, critical = false } = {}, random = Math.random) {
  const best = results[0];
  if (!best || strict || critical) return best;
  const valence = resident.mood?.valence ?? 60;
  const temperature = 0.12 + (1 - traits.conscientiousness) * 0.2 + clamp((55 - valence) / 100, 0, 0.25);
  const pool = results.filter(item => item.score >= best.score - 0.6);
  const weights = pool.map(item => Math.exp((item.score - best.score) / temperature));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) return pool[i]; }
  return best;
}

/** How much a resident's wishes and memories pull them to a place. */
function placeBonus(resident, placeKey, presentIds) {
  let value = 0;
  let reason = null;
  for (const wish of resident.wishes || []) {
    let v = 0;
    if (wish.place === placeKey) v = 0.9;
    else if (wish.with && presentIds.includes(wish.with)) v = wish.type === "makeup" ? 0.7 : 1;
    if (v > value) { value = v; reason = wish.reason; }
  }
  const affinity = Number(resident.placeAffinity?.[placeKey]) || 0;
  value += affinity * 0.5;
  if (!reason && affinity > 0.3) reason = "likes it here";
  return { value, reason };
}

// --- Invitations ---

const INVITE_LINES = ["Want to come to {place} with me?", "Come to {place} with me?", "Let's go to {place}!"];
const YES_LINES = ["Yes, let's go!", "Ooh, okay!", "Sure, I'd love to!"];
const LATER_LINES = ["Maybe later!", "Not right now, but thanks!", "Next time, okay?"];
const BUSY_LINES = ["Can't right now, I'm busy!", "Sorry, I've got things to do!"];

function tryInvite(state, a, now, ctx) {
  const wish = a.wishes.find(w => w.place);
  if (!wish || a.place === wish.place) return;
  const { extraversion: E } = ctx.mindFor(a.id).traits;
  if (ctx.random() > 0.2 + E * 0.4) return;
  const friend = state.residents
    .filter(b => b !== a && !b.asleep && !(b.path || []).length && !ctx.isControlled(b.id) && ctx.sameSpot(a, b)
      && Math.hypot(a.x - b.x, a.y - b.y) < 80 && (Number(a.relationships[b.id]) || 0) >= 30)
    .sort((x, y) => (Number(a.relationships[y.id]) || 0) - (Number(a.relationships[x.id]) || 0))[0];
  if (!friend) return;
  const placeName = places[wish.place].name;
  const pick = list => list[Math.floor(ctx.random() * list.length)];
  a.speech = { text: pick(INVITE_LINES).replace("{place}", placeName), from: now, until: now + 7000 };
  const tb = ctx.mindFor(friend.id).traits;
  const busy = Boolean(ctx.obligation(friend, new Date(now)));
  const keen = (Number(friend.relationships[a.id]) || 0) / 100 * 0.6 + tb.agreeableness * 0.3
    + (100 - (friend.needs?.social ?? 50)) / 100 * 0.3 + placeBonus(friend, wish.place, []).value * 0.3
    + (ctx.mindFor(friend.id).interests.some(tag => places[wish.place].tags.includes(tag)) ? 0.2 : 0) + ctx.random() * 0.3;
  if (busy || keen < 0.65) {
    friend.speech = { text: pick(busy ? BUSY_LINES : LATER_LINES), from: now + 2500, until: now + 9000 };
    feel(a, "🙂", `${friend.name} said maybe later`, { valence: -1, hours: 1, now });
    return;
  }
  friend.speech = { text: pick(YES_LINES), from: now + 2500, until: now + 9000 };
  const why = `going to ${placeName} with ${friend.name}`;
  if (!ctx.go(a, wish.place, why)) return;
  ctx.go(friend, wish.place, `going to ${placeName} with ${a.name}`);
  feel(a, "😊", `${friend.name} said yes!`, { valence: 4, now });
  feel(friend, "😊", `${a.name} invited me along`, { valence: 4, now });
  ctx.addEvent(`${a.name} invited ${friend.name} to ${placeName}, and ${friend.name} said yes!`, now);
}

// --- Tick ---

/**
 * Called every few seconds by the server. `ctx` supplies the world:
 * mindFor, activities, random, addEvent, isControlled, go(resident, place,
 * why), obligation(resident, date), sameSpot(a, b), showOn/showToday(date)
 * and isPerformer(resident).
 */
function tick(state, now, ctx) {
  for (const r of state.residents) {
    ensure(r);
    // Where they've been, and since when.
    if (r.place !== r.will.placeKey) { r.will.placeKey = r.place || ""; r.will.placeSince = now; }
    if (r.place && !(r.path || []).length) r.will.lastVisited[r.place] = now;
    r.feelings = r.feelings.filter(f => f.until > now);
    if (r.asleep) continue;

    const before = r.wishes.length;
    r.wishes = r.wishes.filter(w => w.until > now && (!w.with || state.residents.some(o => o.id === w.with)));
    for (const wish of [...r.wishes]) {
      if (!fulfilled(state, r, wish, now, ctx)) continue;
      r.wishes = r.wishes.filter(w => w !== wish);
      celebrate(state, r, wish, now, ctx);
    }
    if (r.wishes.length < MAX_WISHES && now >= r.will.nextWishAt) {
      const wish = newWish(state, r, now, ctx);
      if (wish) r.wishes.push(wish);
      r.will.nextWishAt = now + (20 + ctx.random() * 40) * 60_000;
    }
    if (r.wishes.length !== before) r.lifeRevision = (r.lifeRevision || 0) + 1;

    if (now >= r.will.nextInviteAt && !ctx.isControlled(r.id) && !(r.path || []).length && !ctx.obligation(r, new Date(now))) {
      r.will.nextInviteAt = now + (3 + ctx.random() * 6) * 60_000;
      tryInvite(state, r, now, ctx);
    }
  }
}

/** After a conversation: feelings and memories of places. */
function onConversation(a, b, kind, now) {
  ensure(a); ensure(b);
  if (kind === "friction") {
    feel(a, "😕", `Disagreed with ${b.name}`, { hours: 2, now });
    feel(b, "😕", `Disagreed with ${a.name}`, { hours: 2, now });
    like(a, a.place, -0.08); like(b, b.place, -0.08);
  } else {
    like(a, a.place, 0.03); like(b, b.place, 0.03);
    if (kind === "interest") { feel(a, "💬", `Great chat with ${b.name}`, { hours: 2, now }); feel(b, "💬", `Great chat with ${a.name}`, { hours: 2, now }); }
  }
}

/** What phones show: wishes, and feelings with reasons (including needs). */
function publicView(resident, now = Date.now()) {
  ensure(resident);
  const feelings = resident.feelings.filter(f => f.until > now).map(f => ({ emoji: f.emoji, text: f.text }));
  const needs = resident.needs || {};
  if (needs.energy < 25) feelings.push({ emoji: "😴", text: "Sleepy" });
  if (needs.hunger < 25) feelings.push({ emoji: "🍽️", text: "Hungry" });
  if (needs.social < 25) feelings.push({ emoji: "🫂", text: "Lonely" });
  if (needs.fun < 25) feelings.push({ emoji: "🥱", text: "Bored" });
  return { wishes: resident.wishes.map(w => ({ emoji: w.emoji, text: w.text })), feelings };
}

module.exports = { ensure, feel, choose, placeBonus, tick, onConversation, publicView, candidates, imperative, MAX_WISHES };
