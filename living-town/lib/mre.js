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
 *
 * He is always on the map for players, strolling between places to see what
 * everyone is up to. Residents never see him: he is not a resident, nothing
 * in their minds reads his position, and their memories of his surprises
 * never name him. When the town has gone quiet, he makes something happen.
 */

const life = require("./life");
const world = require("../shared/world");

const DAY_START = 7;
const DAY_END = 21;
// Mr. E only stirs things up once the town has been quiet this long, and
// never more often than MIN_GAP.
const QUIET_MINUTES = 8;
const MIN_GAP_MINUTES = 20;
// Talk this recent means something is going on.
const RECENT_TALK_MINUTES = 5;
// Walking speeds in map units per second: strolling, and hurrying to a surprise.
const STROLL_SPEED = 22;
const HURRY_SPEED = 70;
const ANNOUNCE_MS = 60_000;

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
// Blocked words match as whole words plus common endings (died, monsters,
// burning), so harmless words that merely start the same way (hello, warm,
// robin, diet, lovely, campfire) are still allowed.
const BLOCKED_WORDS = /\b(kill|die|dead|death|blood|bloody|injury|injuries|injure|weapon|gun|knife|knives|sword|bomb|burn|scary|scare|terrify|terrified|horror|monster|demon|hell|damn|hate|stupid|idiot|dumb|ugly|kiss|sexy|sex|naked|drunk|beer|wine|alcohol|drug|smoke|smoking|steal|stole|stolen|rob|robbed|robber|fight|punch|slap|war|police|arrest|jail|vomit|poop|money|cash|dollar|hurt|fire|love|date|dating|crush|fat|sick|pee|cry|cries|cried|shoot|blame)(s|es|d|ed|ing|er|ers)?\b/i;
const BLOCKED_PATTERNS = /(https?:|www\.|@\w)/i;

function isSafe(text) { return !BLOCKED_WORDS.test(text) && !BLOCKED_PATTERNS.test(text); }

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
  // Is Ollama running, and is the model downloaded? Used for the status label.
  generate.check = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${url}/api/tags`, { signal: controller.signal });
      if (!response.ok) return `built-in storyteller (AI offline)`;
      const { models = [] } = await response.json();
      const found = models.some(m => m.name === model || m.name === `${model}:latest` || m.model === model);
      return found ? generate.label : `built-in storyteller (${model} not downloaded)`;
    } catch {
      return "built-in storyteller (AI offline)";
    } finally {
      clearTimeout(timer);
    }
  };
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

function describeTown(state, now, placeName, focus = null) {
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
    ...(focus?.lonely.length ? [`The town has gone quiet. These residents are on their own or bored, so pick something that gives them something to do together: ${JSON.stringify(focus.lonely.map(r => r.name))}`] : []),
    `Event types you may choose: ${JSON.stringify(TYPES)}`,
    "Reply with JSON only."
  ].join("\n");
}

function activeEffects(state, now) { return (state.effects || []).filter(e => e.until > now); }

function random() { return Math.random(); }
function pick(list) { return list[Math.floor(random() * list.length)]; }

/**
 * Turn a proposal (from the AI or the built-in director) into a complete,
 * safe plan. Invalid fields are replaced; an invalid type means rejection.
 */
function normalizePlan(raw, state, now) {
  if (!raw || !TYPES[raw.type]) return null;
  const awake = state.residents.filter(r => !r.asleep);
  const byId = id => awake.find(r => r.id === id);
  const plan = { type: raw.type };
  // If we have to substitute a resident or place, the proposed announcement
  // may name the wrong person or place, so it is replaced with a template.
  let substituted = false;
  const needsResident = ["gift", "note", "friends", "lost_item"].includes(plan.type);
  if (needsResident) {
    if (!awake.length) return null;
    plan.resident = byId(raw.residentId);
    if (!plan.resident) { plan.resident = pick(awake); substituted = true; }
  }
  if (plan.type === "friends") {
    const others = awake.filter(r => r.id !== plan.resident.id);
    if (!others.length) return null;
    plan.other = raw.otherResidentId !== plan.resident.id ? byId(raw.otherResidentId) : null;
    if (!plan.other) { plan.other = pick(others); substituted = true; }
  }
  const allowedPlaces = plan.type === "treats" ? ["cafe", "market"] : plan.type === "talent_show" ? ["square"] : ["festival", "friends"].includes(plan.type) ? PUBLIC_PLACES : null;
  if (allowedPlaces) {
    plan.place = allowedPlaces.includes(raw.place) ? raw.place : pick(allowedPlaces);
    if (plan.place !== raw.place && plan.type !== "talent_show") substituted = true;
  }
  const weather = activeEffects(state, now).find(e => e.kind === "weather")?.weather;
  if ((plan.type === "rain" && weather === "rain") || (plan.type === "sunshine" && weather === "sunny")) return null;
  plan.title = clean(raw.title, 32) || pick(templates.festivalTitles);
  plan.item = clean(raw.item, 28) || pick(plan.type === "lost_item" ? templates.lostItems : templates.gifts);
  plan.announcement = substituted ? null : clean(raw.announcement, 140);
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

/**
 * How lively is the town? Something is going on when one of Mr. E's events is
 * running or residents have talked recently. `lonely` lists awake residents
 * who are on their own or bored, most in need first.
 */
function assessTown(state, now) {
  const awake = state.residents.filter(r => !r.asleep);
  const happening = activeEffects(state, now).some(e => e.kind === "happening" || e.kind === "meetup");
  const talking = awake.filter(r => now - (Number(r.lastTalk) || 0) < RECENT_TALK_MINUTES * 60_000).length;
  // Family at home together count as company; strangers on different doorsteps don't.
  const sameSpot = (a, b) => a.place === b.place && (a.place !== "homes" || world.homeOf(a.id)?.id === world.homeOf(b.id)?.id);
  const company = r => awake.some(o => o !== r && sameSpot(o, r));
  const need = r => Math.min(Number(r.needs?.fun) || 0, Number(r.needs?.social) || 0);
  const lonely = awake.filter(r => !company(r) || need(r) < 45).sort((a, b) => need(a) - need(b));
  return { awake, lonely, busy: happening || talking >= 2, quiet: awake.length > 0 && !happening && talking < 2 };
}

/** Built-in director: favours surprises that haven't happened lately. */
function builtInProposal(state, now, focus = null) {
  // A quiet town with people on their own: bring two of them together, or
  // give one of them something to do.
  if (focus?.lonely.length >= 2 && random() < 0.6) {
    return { type: "friends", residentId: focus.lonely[0].id, otherResidentId: focus.lonely[1].id };
  }
  if (focus?.lonely.length === 1 && random() < 0.5) {
    return { type: pick(["note", "gift"]), residentId: focus.lonely[0].id };
  }
  const recent = state.mre?.recent || [];
  const hour = new Date(now).getHours();
  const weather = activeEffects(state, now).find(e => e.kind === "weather")?.weather;
  const possible = Object.keys(TYPES).filter(type => !(type === "sunshine" && (hour >= 18 || weather === "sunny")) && !(type === "rain" && weather === "rain"));
  const fresh = possible.filter(type => !recent.slice(0, 3).includes(type));
  return { type: pick(fresh.length ? fresh : possible) };
}

function createMrE({ generate = null, log = console, random = Math.random } = {}) {
  let busy = false;
  let lastBrain = generate ? "checking the local AI…" : "built-in storyteller";
  let lastCheck = 0;
  async function checkBrain() {
    if (!generate?.check) return;
    lastCheck = Date.now();
    try { lastBrain = await generate.check(); } catch {}
  }

  function ensureState(state) {
    state.effects = Array.isArray(state.effects) ? state.effects : [];
    const mre = state.mre && typeof state.mre === "object" ? state.mre : {};
    state.mre = {
      nextAt: Number(mre.nextAt) || 0,
      recent: Array.isArray(mre.recent) ? mre.recent.slice(0, 8) : [],
      pending: Array.isArray(mre.pending) ? mre.pending : [],
      visit: mre.visit && mre.visit.until > Date.now() && typeof mre.visit.text === "string" ? { text: mre.visit.text, until: mre.visit.until } : null,
      walker: normalizeWalker(mre.walker)
    };
  }

  function normalizeWalker(w) {
    const ok = w && Number.isFinite(w.x) && Number.isFinite(w.y) && w.x >= 0 && w.y >= 0 && w.x <= world.MAP.width && w.y <= world.MAP.height;
    if (!ok) {
      const start = world.spotFor(null, "square");
      return { x: start.x + 26, y: start.y + 6, path: [], watching: "square", lingerUntil: 0, hurry: false, lastPlaces: [] };
    }
    // Keep his walk going between ticks; drop anything malformed from a save.
    if (!Array.isArray(w.path) || !w.path.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) w.path = [];
    if (!world.places[w.watching]) w.watching = null;
    w.lingerUntil = Number(w.lingerUntil) || 0;
    w.hurry = Boolean(w.hurry);
    w.lastPlaces = Array.isArray(w.lastPlaces) ? w.lastPlaces.filter(k => world.places[k]).slice(0, 2) : [];
    return w;
  }

  function walkTo(walker, x, y, hurry) {
    const to = world.snapToWalkable(x, y);
    walker.path = world.route(walker.x, walker.y, to.x, to.y);
    walker.hurry = hurry;
    walker.arrived = false;
  }

  /** Pick the next place to look in on: busy places first, somewhere new. */
  function surveyNext(state, now) {
    const walker = state.mre.walker;
    const night = isNight(now);
    const keys = Object.keys(world.places).filter(k => k !== "homes");
    const weights = keys.map(k => {
      if (walker.lastPlaces.includes(k)) return 0.15;
      const people = state.residents.filter(r => r.place === k && !r.asleep).length;
      return night ? (k === "square" || k === "park" ? 2 : 1) : 1 + people * 1.5;
    });
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    let key = keys[keys.length - 1];
    for (let i = 0; i < keys.length; i++) { roll -= weights[i]; if (roll <= 0) { key = keys[i]; break; } }
    const spot = world.spotFor(null, key);
    walker.watching = key;
    walker.lastPlaces = [key, ...walker.lastPlaces.filter(k => k !== key)].slice(0, 2);
    walkTo(walker, spot.x + (random() - 0.5) * 60, spot.y + 12 + (random() - 0.5) * 24, false);
  }

  let lastMove = 0;
  function patrol(state, now) {
    const walker = state.mre.walker;
    const seconds = Math.min(5, Math.max(0, (now - (lastMove || now)) / 1000));
    lastMove = now;
    let budget = (walker.hurry ? HURRY_SPEED : STROLL_SPEED) * (isNight(now) && !walker.hurry ? 0.7 : 1) * seconds;
    while (budget > 0 && walker.path.length) {
      const next = walker.path[0];
      const gap = Math.hypot(next.x - walker.x, next.y - walker.y);
      if (gap <= budget) { walker.x = next.x; walker.y = next.y; budget -= gap; walker.path.shift(); }
      else { walker.x += (next.x - walker.x) / gap * budget; walker.y += (next.y - walker.y) / gap * budget; budget = 0; }
    }
    if (walker.path.length) return;
    if (!walker.arrived) {
      walker.arrived = true;
      walker.hurry = false;
      // Stay a while to watch; longer beside a surprise he just made.
      const announcing = state.mre.visit && state.mre.visit.until > now;
      walker.lingerUntil = now + (announcing ? 45_000 : (25 + random() * 35) * 1000) * (isNight(now) ? 2 : 1);
    }
    if (now >= walker.lingerUntil) surveyNext(state, now);
  }

  function isNight(now) {
    const hour = new Date(now).getHours();
    return hour < DAY_START || hour >= DAY_END;
  }

  function experience(resident, now, text, type = "mre") {
    if (!Array.isArray(resident.experiences) || !resident.mood) return;
    life.pushExperience(resident, { id: `${now}-mre`, at: now, type, text, place: resident.place, promoted: false });
  }

  function bond(a, b, amount) {
    a.relationships[b.id] = Math.min(100, (Number(a.relationships[b.id]) || 0) + amount);
    b.relationships[a.id] = Math.min(100, (Number(b.relationships[a.id]) || 0) + amount);
    // Bump revisions so clients receive the new relationship values.
    a.lifeRevision = (a.lifeRevision || 0) + 1;
    b.lifeRevision = (b.lifeRevision || 0) + 1;
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
        experience(r, now, `${r.name} found a mysterious surprise: ${plan.item}.`);
        where = { x: r.x, y: r.y };
        break;
      }
      case "note": {
        const r = plan.resident;
        r.needs.fun = Math.min(100, r.needs.fun + 10);
        r.mood.valence = Math.min(100, r.mood.valence + 5);
        experience(r, now, `${r.name} found a mysterious riddle note: "${pick(templates.riddles)}"`);
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
    state.mre.nextAt = now + MIN_GAP_MINUTES * 60_000;
    state.mre.visit = { until: now + ANNOUNCE_MS, text: announcement };
    // He hurries over to stand beside his surprise.
    const walker = state.mre.walker;
    if (where) {
      walker.watching = plan.place || null;
      walkTo(walker, where.x + 18, where.y + 6, true);
    }
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

  async function propose(state, now, helpers, focus, at = () => now) {
    if (generate) {
      try {
        const raw = await generate(SYSTEM_PROMPT, describeTown(state, now, helpers.placeName, focus), schemaFor(state));
        const plan = normalizePlan({ ...raw, fromAI: true }, state, at());
        lastBrain = generate.label || "local AI";
        if (plan) return plan;
        log.warn("Mr. E: the AI suggested something unusable; using a built-in surprise instead.");
      } catch (err) {
        if (lastBrain !== "built-in storyteller (AI offline)") log.warn(`Mr. E: local AI unavailable (${err.message}); using built-in surprises.`);
        lastBrain = "built-in storyteller (AI offline)";
      }
    }
    // A built-in proposal can still be unusable (e.g. nobody awake for a
    // gift), so try a few before giving up.
    for (let attempt = 0; attempt < 6; attempt++) {
      const plan = normalizePlan(builtInProposal(state, now, attempt < 2 ? focus : null), state, now);
      if (plan) return plan;
    }
    return null;
  }

  /** Run one surprise now. Resolves to the announcement, or null. */
  async function surprise(state, helpers, focus = null, now = Date.now()) {
    if (busy) return null;
    busy = true;
    quietSince = 0;
    // Town time, carried forward by however long the AI took to answer.
    const started = Date.now();
    const at = () => now + (Date.now() - started);
    try {
      ensureState(state);
      const plan = await propose(state, now, helpers, focus, at);
      return plan ? apply(state, plan, at(), helpers) : null;
    } finally {
      busy = false;
    }
  }

  // When the town went quiet (0 while something is going on).
  let quietSince = 0;

  /** Called from the simulation tick. Never blocks it. */
  function tick(state, now, helpers) {
    ensureState(state);
    if (generate?.check && now - lastCheck > 10 * 60_000) checkBrain();
    state.effects = activeEffects(state, now);
    if (state.mre.visit && state.mre.visit.until <= now) state.mre.visit = null;
    resolvePending(state, now, helpers);
    patrol(state, now);

    const town = assessTown(state, now);
    if (!town.quiet || isNight(now)) { quietSince = 0; return; }
    if (!quietSince) quietSince = now;
    if (busy || now < state.mre.nextAt || now - quietSince < QUIET_MINUTES * 60_000) return;
    surprise(state, helpers, town, now).catch(err => log.error("Mr. E error:", err));
  }

  /** What phones need to draw him: where he is and what he's saying. */
  function publicView(state, now) {
    const walker = state.mre?.walker;
    if (!walker) return null;
    const visit = state.mre.visit && state.mre.visit.until > now ? state.mre.visit : null;
    return {
      x: Math.round(walker.x * 10) / 10, y: Math.round(walker.y * 10) / 10, walking: walker.path.length > 0,
      watching: walker.watching ? world.places[walker.watching]?.name || null : null,
      text: visit?.text || null, until: visit?.until || 0
    };
  }

  /** Announce something (the daily programme) and hurry over to it. */
  function announce(state, text, placeKey, now) {
    ensureState(state);
    state.mre.visit = { until: now + ANNOUNCE_MS, text };
    const spot = world.spotFor(null, placeKey);
    if (spot) { state.mre.walker.watching = placeKey; walkTo(state.mre.walker, spot.x + 18, spot.y + 6, true); }
  }

  return { tick, surprise, announce, ensureState, checkBrain, publicView, get brain() { return lastBrain; }, get busy() { return busy; } };
}

module.exports = { createMrE, ollamaGenerator, normalizePlan, assessTown, isSafe, clean, TYPES, SYSTEM_PROMPT };
