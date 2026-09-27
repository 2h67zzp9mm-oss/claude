"use strict";
/**
 * Mr. E — the town's mysterious, kind storyteller.
 *
 * Every so often Mr. E stirs up a small surprise: a festival, a rain shower,
 * a gift, a riddle, a lost-and-found. A local AI model (Ollama on Mouse, so
 * nothing leaves the house) chooses which surprise and writes his line, but
 * only from a fixed menu of gentle event types. Everything it returns is
 * validated and filtered; anything odd falls back to built-in templates, and
 * the same templates run when no model is available.
 */

const life = require("./life");

const DAY_START = 7;
const DAY_END = 21;
const GAP_MIN = 25;
const GAP_SPREAD = 25;

const PUBLIC_PLACES = ["park", "square", "cafe", "market", "workshop"];

const TYPES = {
  festival: "a small pop-up festival or party at a public place (needs place and title)",
  talent_show: "a talent show at the Town Square",
  rain: "a short, cozy rain shower that sends people indoors",
  sunshine: "a burst of lovely sunshine that draws people outside",
  gift: "a tiny surprise gift for one resident (needs residentId and item)",
  note: "a riddle note for one resident (needs residentId)",
  friends: "nudges two residents to meet up at a place (needs residentId, otherResidentId, place)",
  treats: "free treats at the cafe or market (needs place)",
  lost_item: "a resident misplaces a small item that someone will find later (needs residentId and item)"
};

const templates = {
  festivalTitles: ["kite festival", "bubble parade", "chalk art party", "silly hat parade", "picnic party", "paper boat race"],
  gifts: ["a shiny marble", "a paper crane", "a tiny potted plant", "a smooth river stone", "a golden star sticker", "a new sketchbook"],
  lostItems: ["a favorite scarf", "a lucky pebble", "a library book", "a red mitten", "a toy boat"],
  riddles: [
    "What has keys but can't open locks? A piano!",
    "What gets wetter the more it dries? A towel!",
    "What has a face and two hands but no arms? A clock!",
    "What can you catch but not throw? A cold... or a smile!",
    "What has many teeth but never bites? A comb!"
  ]
};

// Words Mr. E must never say. Roots match any word starting with them;
// exact words match whole words only (so "lovely" is fine but "love" is not).
const BLOCKED_ROOTS = /\b(kill|die|dead|death|blood|injur|weapon|gun|knife|sword|bomb|burn|scar(y|e)|terrif|horror|monster|demon|hell|damn|hate|stupid|idiot|dumb|ugly|kiss|sexy|sex|naked|drunk|beer|wine|alcohol|drug|smok|steal|stole|rob|fight|punch|slap|war|police|arrest|jail|vomit|poop|money|cash|dollar|http|www)/i;
const BLOCKED_WORDS = /\b(hurt|fire|love|date|dating|crush|fat|sick|pee|cry|lost forever|alone)\b/i;

function isSafe(text) { return !BLOCKED_ROOTS.test(text) && !BLOCKED_WORDS.test(text); }

function clean(value, max) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const text = value.replace(/[\u0000-\u001f\u007f<>{}[\]\\`]/g, " ").replace(/\s+/g, " ").trim();
  if (!text || text.length > max || !isSafe(text)) return null;
  return text;
}

/** Talks to a local Ollama server. Returns an async generate(system, user, schema). */
function ollamaGenerator({ url = "http://127.0.0.1:11434", model = "llama3.2:3b", timeoutMs = 90_000 } = {}) {
  const generate = async (system, user, schema) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: schema,
          options: { temperature: 0.9, num_predict: 220 },
          messages: [{ role: "system", content: system }, { role: "user", content: user }]
        })
      });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
      const body = await response.json();
      return JSON.parse(body.message?.content || "{}");
    } finally {
      clearTimeout(timer);
    }
  };
  generate.label = `local AI (${model})`;
  return generate;
}

const SYSTEM_PROMPT = [
  "You are Mr. E, a mysterious, kind and playful spirit who looks after a cozy little pixel-art town called Living Town.",
  "Children aged 7 and 15 play this game with their dad. Everything you do must be gentle, cheerful and safe for a 7-year-old:",
  "no danger, injuries, fear, sadness that lasts, romance, money, meanness, or real-world topics.",
  "You create one small surprise at a time that makes the town feel alive and brings residents together.",
  "Choose an event that fits the time of day and what residents are doing, and avoid repeating recent surprises.",
  "Write the announcement in Mr. E's voice: short, whimsical, a little mysterious, at most 120 characters."
].join(" ");

function schemaFor(state) {
  const ids = state.residents.map(r => r.id);
  return {
    type: "object",
    properties: {
      type: { type: "string", enum: Object.keys(TYPES) },
      place: { type: "string", enum: PUBLIC_PLACES },
      residentId: { type: "string", enum: ids },
      otherResidentId: { type: "string", enum: ids },
      title: { type: "string" },
      item: { type: "string" },
      announcement: { type: "string" }
    },
    required: ["type", "announcement"]
  };
}

function describeTown(state, now, placeName) {
  const date = new Date(now);
  const weather = activeEffects(state, now).find(e => e.kind === "weather")?.weather || "clear";
  const residents = state.residents.filter(r => !r.asleep).map(r => ({
    id: r.id, name: r.name, age: r.profile?.age, mood: r.mood?.label, at: placeName(r), doing: r.activity
  }));
  const recentEvents = state.events.slice(0, 6).map(e => e.text);
  const recentSurprises = (state.mre?.recent || []).slice(0, 4);
  return [
    `Time: ${date.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })}. Weather: ${weather}.`,
    `Residents who are awake: ${JSON.stringify(residents)}`,
    `Recent town events: ${JSON.stringify(recentEvents)}`,
    `Your recent surprises (don't repeat these): ${JSON.stringify(recentSurprises)}`,
    `Event types you may choose: ${JSON.stringify(TYPES)}`,
    "Reply with JSON only."
  ].join("\n");
}

function activeEffects(state, now) { return (state.effects || []).filter(e => e.until > now); }

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

/**
 * Turn a proposal (from the AI or the built-in director) into a complete,
 * safe plan. Invalid fields are replaced; an invalid type means rejection.
 */
function normalizePlan(raw, state, now) {
  if (!raw || !TYPES[raw.type]) return null;
  const awake = state.residents.filter(r => !r.asleep);
  const byId = id => awake.find(r => r.id === id);
  const plan = { type: raw.type };
  const needsResident = ["gift", "note", "friends", "lost_item"].includes(plan.type);
  if (needsResident) {
    if (!awake.length) return null;
    plan.resident = byId(raw.residentId) || pick(awake);
  }
  if (plan.type === "friends") {
    const others = awake.filter(r => r.id !== plan.resident.id);
    if (!others.length) return null;
    plan.other = (raw.otherResidentId !== plan.resident.id && byId(raw.otherResidentId)) || pick(others);
  }
  if (plan.type === "treats") plan.place = ["cafe", "market"].includes(raw.place) ? raw.place : pick(["cafe", "market"]);
  else if (plan.type === "talent_show") plan.place = "square";
  else if (["festival", "friends"].includes(plan.type)) plan.place = PUBLIC_PLACES.includes(raw.place) ? raw.place : pick(PUBLIC_PLACES);
  if (plan.type === "rain" && activeEffects(state, now).some(e => e.weather === "rain")) return null;
  plan.title = clean(raw.title, 32) || pick(templates.festivalTitles);
  plan.item = clean(raw.item, 28) || pick(plan.type === "lost_item" ? templates.lostItems : templates.gifts);
  plan.announcement = clean(raw.announcement, 140);
  plan.fromAI = Boolean(raw.fromAI);
  return plan;
}

function templateAnnouncement(plan, placeName) {
  const where = plan.place ? placeName({ place: plan.place }) : "";
  switch (plan.type) {
    case "festival": return `A ${plan.title} at ${where}! Everyone is invited...`;
    case "talent_show": return "Talent show at the Town Square! Bring your very best trick.";
    case "rain": return "Pitter-patter... a little rain is on its way. Cozy up indoors!";
    case "sunshine": return "The sun is out and everything is glowing. Go and play!";
    case "gift": return `Psst, ${plan.resident.name}... check your pocket.`;
    case "note": return `${plan.resident.name}, I left you a little riddle...`;
    case "friends": return `${plan.resident.name} and ${plan.other.name} should meet at ${where}. I have a feeling...`;
    case "treats": return `Free treats at ${where} for a little while!`;
    case "lost_item": return `Oh my, ${plan.resident.name} misplaced ${plan.item}. Keep an eye out!`;
    default: return "Something curious is afoot...";
  }
}

/** Built-in director: favours surprises that haven't happened lately. */
function builtInProposal(state, now) {
  const recent = state.mre?.recent || [];
  const hour = new Date(now).getHours();
  const options = Object.keys(TYPES).filter(type => !recent.slice(0, 3).includes(type) && !(type === "sunshine" && hour >= 18));
  return { type: pick(options.length ? options : Object.keys(TYPES)) };
}

function createMrE({ generate = null, log = console, random = Math.random } = {}) {
  let busy = false;
  let lastBrain = generate ? generate.label || "local AI" : "built-in storyteller";

  function ensureState(state) {
    state.effects = Array.isArray(state.effects) ? state.effects : [];
    const mre = state.mre && typeof state.mre === "object" ? state.mre : {};
    state.mre = {
      nextAt: Number(mre.nextAt) || 0,
      recent: Array.isArray(mre.recent) ? mre.recent.slice(0, 8) : [],
      pending: Array.isArray(mre.pending) ? mre.pending : [],
      visit: mre.visit && mre.visit.until > Date.now() ? mre.visit : null
    };
  }

  function scheduleNext(state, now) {
    state.mre.nextAt = now + (GAP_MIN + random() * GAP_SPREAD) * 60_000;
  }

  function experience(resident, now, text, type = "mre") {
    if (!Array.isArray(resident.experiences) || !resident.mood) return;
    life.pushExperience(resident, { id: `${now}-mre`, at: now, type, text, place: resident.place, promoted: false });
  }

  function bond(a, b, amount) {
    a.relationships[b.id] = Math.min(100, (Number(a.relationships[b.id]) || 0) + amount);
    b.relationships[a.id] = Math.min(100, (Number(b.relationships[a.id]) || 0) + amount);
  }

  function nudge(state, ids) {
    for (const r of state.residents) {
      if (r.asleep || (ids && !ids.includes(r.id))) continue;
      if (r.mind) r.mind.commitUntil = 0;
    }
  }

  /** Apply a validated plan to the world. */
  function apply(state, plan, now, helpers) {
    const announcement = plan.announcement || templateAnnouncement(plan, helpers.placeName);
    const effect = (fields) => state.effects.push({ id: `${now}-${plan.type}`, until: now + fields.minutes * 60_000, ...fields });
    let where = plan.place ? helpers.spotFor(null, plan.place) : null;

    switch (plan.type) {
      case "festival":
        effect({ kind: "happening", place: plan.place, pull: 2.2, minutes: 60, reason: plan.title });
        nudge(state);
        break;
      case "talent_show":
        effect({ kind: "happening", place: "square", pull: 2.4, minutes: 50, reason: "the talent show" });
        nudge(state);
        break;
      case "treats":
        effect({ kind: "happening", place: plan.place, pull: 1.6, minutes: 40, reason: "free treats" });
        nudge(state);
        break;
      case "rain":
        state.effects = state.effects.filter(e => e.kind !== "weather");
        effect({ kind: "weather", weather: "rain", minutes: 40, reason: "staying out of the rain", pulls: { park: -1.4, square: -1, market: -0.5, homes: 0.8, cafe: 0.9 } });
        nudge(state);
        where = helpers.spotFor(null, "square");
        break;
      case "sunshine":
        state.effects = state.effects.filter(e => e.kind !== "weather");
        effect({ kind: "weather", weather: "sunny", minutes: 60, reason: "enjoying the sunshine", pulls: { park: 1.1, square: 0.5 } });
        nudge(state);
        where = helpers.spotFor(null, "park");
        break;
      case "gift": {
        const r = plan.resident;
        r.mood.valence = Math.min(100, r.mood.valence + 12);
        r.mood.stress = Math.max(0, r.mood.stress - 5);
        experience(r, now, `${r.name} found a surprise from Mr. E: ${plan.item}.`);
        where = { x: r.x, y: r.y };
        break;
      }
      case "note": {
        const r = plan.resident;
        r.needs.fun = Math.min(100, r.needs.fun + 10);
        r.mood.valence = Math.min(100, r.mood.valence + 5);
        experience(r, now, `${r.name} found a riddle from Mr. E: "${pick(templates.riddles)}"`);
        where = { x: r.x, y: r.y };
        break;
      }
      case "friends":
        bond(plan.resident, plan.other, 5);
        effect({ kind: "meetup", place: plan.place, residentIds: [plan.resident.id], pull: 3, minutes: 40, reason: `meeting ${plan.other.name}` });
        effect({ kind: "meetup", place: plan.place, residentIds: [plan.other.id], pull: 3, minutes: 40, reason: `meeting ${plan.resident.name}` });
        nudge(state, [plan.resident.id, plan.other.id]);
        break;
      case "lost_item": {
        const r = plan.resident;
        r.mood.stress = Math.min(100, r.mood.stress + 6);
        r.mood.valence = Math.max(0, r.mood.valence - 4);
        state.mre.pending.push({ kind: "found", ownerId: r.id, item: plan.item, at: now + (20 + random() * 20) * 60_000 });
        where = { x: r.x, y: r.y };
        break;
      }
    }

    state.mre.recent = [plan.type, ...state.mre.recent].slice(0, 8);
    if (where) state.mre.visit = { x: where.x + 16, y: where.y + 4, until: now + 45_000, text: announcement };
    helpers.addEvent(`✦ Mr. E: "${announcement}"`, now, "mre");
    return announcement;
  }

  function resolvePending(state, now, helpers) {
    const due = state.mre.pending.filter(p => p.at <= now);
    if (!due.length) return;
    state.mre.pending = state.mre.pending.filter(p => p.at > now);
    for (const p of due) {
      const owner = state.residents.find(r => r.id === p.ownerId);
      if (!owner) continue;
      const nearby = state.residents.filter(r => r.id !== owner.id && !r.asleep).sort((a, b) => Math.hypot(a.x - owner.x, a.y - owner.y) - Math.hypot(b.x - owner.x, b.y - owner.y));
      const finder = nearby[0];
      if (!finder) { p.at = now + 30 * 60_000; state.mre.pending.push(p); continue; }
      bond(owner, finder, 6);
      owner.mood.valence = Math.min(100, owner.mood.valence + 10);
      owner.mood.stress = Math.max(0, owner.mood.stress - 6);
      experience(owner, now, `${finder.name} found ${owner.name}'s missing ${p.item.replace(/^(a|an|the) /, "")} and gave it back.`);
      helpers.addEvent(`${finder.name} found ${owner.name}'s missing ${p.item.replace(/^(a|an|the) /, "")} and gave it back!`, now);
    }
  }

  async function propose(state, now, helpers) {
    if (generate) {
      try {
        const raw = await generate(SYSTEM_PROMPT, describeTown(state, now, helpers.placeName), schemaFor(state));
        const plan = normalizePlan({ ...raw, fromAI: true }, state, Date.now());
        lastBrain = generate.label || "local AI";
        if (plan) return plan;
        log.warn("Mr. E: the AI suggested something unusable; using a built-in surprise instead.");
      } catch (err) {
        if (lastBrain !== "built-in storyteller (AI offline)") log.warn(`Mr. E: local AI unavailable (${err.message}); using built-in surprises.`);
        lastBrain = "built-in storyteller (AI offline)";
      }
    }
    return normalizePlan(builtInProposal(state, now), state, now);
  }

  /** Run one surprise now. Resolves to the announcement, or null. */
  async function surprise(state, helpers) {
    if (busy) return null;
    busy = true;
    try {
      ensureState(state);
      const plan = await propose(state, Date.now(), helpers);
      return plan ? apply(state, plan, Date.now(), helpers) : null;
    } finally {
      busy = false;
    }
  }

  /** Called from the simulation tick. Never blocks it. */
  function tick(state, now, helpers) {
    ensureState(state);
    state.effects = activeEffects(state, now);
    if (state.mre.visit && state.mre.visit.until <= now) state.mre.visit = null;
    resolvePending(state, now, helpers);
    const hour = new Date(now).getHours();
    if (!state.mre.nextAt) scheduleNext(state, now - GAP_MIN * 60_000 * 0.8);
    if (now < state.mre.nextAt || busy) return;
    scheduleNext(state, now);
    if (hour < DAY_START || hour >= DAY_END) return;
    surprise(state, helpers).catch(err => log.error("Mr. E error:", err));
  }

  return { tick, surprise, ensureState, get brain() { return lastBrain; }, get busy() { return busy; } };
}

module.exports = { createMrE, ollamaGenerator, normalizePlan, isSafe, clean, TYPES, SYSTEM_PROMPT };
