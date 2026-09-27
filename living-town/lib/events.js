"use strict";
/**
 * Mr. E's daily programme: there's always something going on.
 *
 * Every hour from 7:00 to 21:00 Mr. E starts a new town event that runs for
 * 30–45 minutes: treasure hunts (tap to collect), gatherings (be there to
 * join in), and his riddles (pick the right answer). Each day's line-up is
 * different but worked out from the date, so everyone sees the same
 * programme and it can be shown ahead of time. Players earn Town Stars and
 * keepsakes for their sticker book. All text here is hand-written and
 * child-safe, so it works whether or not Mr. E's AI brain is on.
 */

const { places, snapToWalkable, inPlace } = require("../shared/world");

const FIRST_HOUR = 7;
const LAST_HOUR = 20; // the last event starts at 20:00

const CATALOG = {
  acorns: { kind: "hunt", name: "Golden acorn hunt", emoji: "🌰", place: "park", minutes: 35, count: 6, item: { emoji: "🌰", name: "golden acorn" },
    keepsake: { emoji: "🌰", name: "Golden acorn" }, line: "Six golden acorns are hiding in Juniper Park. Can you find them all?" },
  feathers: { kind: "hunt", name: "Feather hunt", emoji: "🪶", place: "square", minutes: 35, count: 6, item: { emoji: "🪶", name: "bright feather" },
    keepsake: { emoji: "🪶", name: "Rainbow feather" }, line: "Bright feathers have floated down around the Town Square. Collect them!" },
  shells: { kind: "hunt", name: "Shell hunt", emoji: "🐚", place: "market", minutes: 35, count: 5, item: { emoji: "🐚", name: "river shell" },
    keepsake: { emoji: "🐚", name: "Swirly shell" }, line: "The river has left pretty shells near the Corner Market. How many can you find?" },
  stars: { kind: "hunt", name: "Fallen star hunt", emoji: "⭐", place: "square", minutes: 40, count: 6, evening: true, item: { emoji: "⭐", name: "little fallen star" },
    keepsake: { emoji: "🌟", name: "Pocket star" }, line: "Little stars have tumbled into the Town Square tonight. Catch them before they twinkle away!" },
  duckRace: { kind: "gather", name: "Duck race at the pond", emoji: "🦆", place: "park", minutes: 40, activity: "cheering on the duck race",
    keepsake: { emoji: "🦆", name: "Duck race ribbon" }, line: "The rubber duck race is starting at the pond! Come and cheer!" },
  kites: { kind: "gather", name: "Kite hour", emoji: "🪁", place: "park", minutes: 45, activity: "flying a kite", day: true,
    keepsake: { emoji: "🪁", name: "Tiny kite" }, line: "The wind is just right. Kite hour in Juniper Park!" },
  chalk: { kind: "gather", name: "Chalk art party", emoji: "🖍️", place: "square", minutes: 45, activity: "drawing with chalk", day: true,
    keepsake: { emoji: "🖍️", name: "Chalk rainbow" }, line: "Chalk art party on the Town Square! Draw something wonderful." },
  bubbles: { kind: "gather", name: "Bubble parade", emoji: "🫧", place: "square", minutes: 35, activity: "blowing giant bubbles",
    keepsake: { emoji: "🫧", name: "Bubble wand" }, line: "Giant bubbles are floating through the Town Square. Join the bubble parade!" },
  band: { kind: "gather", name: "Music in the square", emoji: "🎺", place: "square", minutes: 40, activity: "dancing to the band",
    keepsake: { emoji: "🎺", name: "Little trumpet" }, line: "A little band is playing on the Town Square. Come and dance!" },
  boats: { kind: "gather", name: "Paper boat race", emoji: "⛵", place: "park", minutes: 40, activity: "racing paper boats",
    keepsake: { emoji: "⛵", name: "Paper boat" }, line: "Fold a paper boat! The race on the pond begins now." },
  snacks: { kind: "gather", name: "Pop-up snack stand", emoji: "🥨", place: "cafe", minutes: 35, activity: "trying a free snack",
    keepsake: { emoji: "🥨", name: "Pretzel sticker" }, line: "A pop-up snack stand has appeared at Moonbeam Cafe. Free snacks!" },
  pumpkin: { kind: "gather", name: "Guess the pumpkin", emoji: "🎃", place: "market", minutes: 40, activity: "guessing how heavy the big pumpkin is",
    keepsake: { emoji: "🎃", name: "Mini pumpkin" }, line: "An enormous pumpkin is at the Corner Market. Guess how heavy it is!" },
  story: { kind: "gather", name: "Story time by the fountain", emoji: "📖", place: "square", minutes: 40, activity: "listening to a story", evening: true,
    keepsake: { emoji: "📖", name: "Storybook bookmark" }, line: "Gather round the fountain. Story time is about to begin..." },
  fireflies: { kind: "gather", name: "Firefly count", emoji: "✨", place: "park", minutes: 45, activity: "counting fireflies", evening: true,
    keepsake: { emoji: "✨", name: "Firefly jar" }, line: "The fireflies are out in Juniper Park. Let's count them together!" },
  riddle: { kind: "riddle", name: "Mr. E's riddle", emoji: "🔮", place: "square", minutes: 45,
    keepsake: { emoji: "🔮", name: "Mystery marble" }, line: "I have a riddle for you... tap me to answer!" }
};

const RIDDLES = [
  { q: "What has keys but can't open a door?", options: ["A piano", "A treasure chest", "A car"], answer: 0 },
  { q: "What gets wetter the more it dries?", options: ["A sponge", "A towel", "The rain"], answer: 1 },
  { q: "What has a face and two hands but no arms?", options: ["A clock", "A doll", "A snowman"], answer: 0 },
  { q: "What has many teeth but never bites?", options: ["A comb", "A shark", "A zipper"], answer: 0 },
  { q: "What goes up but never comes down?", options: ["A balloon", "Your age", "A kite"], answer: 1 },
  { q: "What can you catch but not throw?", options: ["A ball", "A cold", "A fish"], answer: 1 },
  { q: "What has one eye but can't see?", options: ["A needle", "A pirate", "A potato"], answer: 0 },
  { q: "What has a neck but no head?", options: ["A giraffe", "A bottle", "A shirt"], answer: 1 },
  { q: "What is full of holes but still holds water?", options: ["A bucket", "A sponge", "A net"], answer: 1 },
  { q: "What can travel around the world while staying in a corner?", options: ["A stamp", "A spider", "A map"], answer: 0 }
];

// A small, repeatable random number generator, so a day's programme is the same for everyone.
function seeded(seed) {
  let h = seed >>> 0 || 1;
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function dayKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

/** The day's programme: one event per hour, no repeats, evening ones in the evening. */
function programmeFor(date, { showHours = [] } = {}) {
  const key = dayKey(date);
  const rand = seeded([...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
  const used = new Set();
  const list = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    if (showHours.includes(hour)) continue; // the circus show has the square
    const evening = hour >= 19;
    const fits = Object.entries(CATALOG).filter(([id, e]) => !used.has(id) && (evening ? !e.day : !e.evening));
    const pool = fits.length ? fits : Object.entries(CATALOG).filter(([, e]) => (evening ? !e.day : !e.evening));
    // Riddles and hunts a bit more often: they're things to do.
    const weights = pool.map(([, e]) => (e.kind === "gather" ? 1 : 1.4));
    let roll = rand() * weights.reduce((a, b) => a + b, 0), chosen = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) { chosen = pool[i]; break; } }
    used.add(chosen[0]);
    const start = new Date(date); start.setHours(hour, 0, 0, 0);
    list.push({ id: `${key}-${hour}`, type: chosen[0], hour, start: start.getTime(), end: start.getTime() + chosen[1].minutes * 60_000 });
  }
  return list;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/**
 * Creates the running programme. `ctx`: addEvent, announce(text, placeKey),
 * showHours(date), players() -> resident list, reward(resident, stars,
 * keepsake, why), random.
 */
function createProgramme(ctx) {
  function ensure(state) {
    const saved = state.programme && typeof state.programme === "object" ? state.programme : {};
    state.programme = {
      current: saved.current && typeof saved.current === "object" ? saved.current : null,
      rewarded: Array.isArray(saved.rewarded) ? saved.rewarded.slice(-200) : []
    };
    return state.programme;
  }

  function hideItems(event, def) {
    const center = places[def.place].area || places[def.place];
    const items = [];
    for (let i = 0; i < 60 && items.length < def.count; i++) {
      const angle = ctx.random() * Math.PI * 2, r = 20 + ctx.random() * 70;
      const p = snapToWalkable(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r * 0.7);
      if (items.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 18)) continue;
      items.push({ id: `${event.id}-${items.length}`, x: Math.round(p.x), y: Math.round(p.y), takenBy: [] });
    }
    return items;
  }

  function start(state, planned, now) {
    const def = CATALOG[planned.type];
    const event = { ...planned, name: def.name, emoji: def.emoji, kind: def.kind, place: def.place, joined: [], answered: [] };
    if (def.kind === "hunt") event.items = hideItems(event, def);
    if (def.kind === "riddle") { const r = RIDDLES[Math.floor(ctx.random() * RIDDLES.length)]; event.riddle = { q: r.q, options: r.options, answer: r.answer }; }
    // Residents are drawn to the event and join in.
    state.effects = Array.isArray(state.effects) ? state.effects : [];
    state.effects.push({ id: `${event.id}-pull`, kind: "happening", programme: true, place: def.place, pull: def.kind === "gather" ? 1.2 : 0.7, until: event.end, reason: def.name.toLowerCase(), activity: def.activity || null });
    state.programme.current = event;
    ctx.announce(def.line, def.place, now);
  }

  function finish(state, now) {
    const event = state.programme.current;
    if (!event) return;
    state.programme.current = null;
    const def = CATALOG[event.type];
    if (event.joined.length || event.answered.length) ctx.addEvent(`${def.emoji} ${def.name} is over. Thanks for joining in!`, now);
  }

  /** Called every few seconds from the server tick. */
  function tick(state, now) {
    ensure(state);
    const date = new Date(now);
    const current = state.programme.current;
    if (current && now >= current.end) finish(state, now);
    if (!state.programme.current) {
      const due = programmeFor(date, { showHours: ctx.showHours(date) }).find(e => now >= e.start && now < e.end);
      if (due && !state.programme.rewarded.includes(`started:${due.id}`)) {
        state.programme.rewarded.push(`started:${due.id}`);
        start(state, due, now);
      }
    }
    // Gatherings: players who've been there a couple of minutes have joined in.
    const event = state.programme.current;
    if (event?.kind === "gather") {
      for (const r of ctx.players()) {
        if (event.joined.includes(r.id) || r.asleep || !inPlace(event.place, r.id, r.x, r.y)) { r.eventHereSince = null; continue; }
        r.eventHereSince = r.eventHereSince || now;
        if (now - r.eventHereSince < 2 * 60_000) continue;
        event.joined.push(r.id);
        const def = CATALOG[event.type];
        ctx.reward(r, 2, def.keepsake, `joined the ${def.name.toLowerCase()}`);
        r.activity = def.activity;
      }
    }
  }

  /** A player taps a hidden item. */
  function collect(state, r, itemId, now) {
    const event = state.programme?.current;
    const item = event?.kind === "hunt" && event.items.find(i => i.id === itemId);
    if (!item) return { error: "That's gone now." };
    if (item.takenBy.includes(r.id)) return { error: "You already found that one!" };
    if (Math.hypot(item.x - r.x, item.y - r.y) > 30) return { error: "Walk a bit closer first." };
    item.takenBy.push(r.id);
    const def = CATALOG[event.type];
    const found = event.items.filter(i => i.takenBy.includes(r.id)).length;
    ctx.reward(r, 1, null, `found a ${def.item.name}`, { quiet: true });
    if (found === event.items.length) {
      ctx.reward(r, 3, def.keepsake, `found every ${def.item.name}`);
      ctx.addEvent(`${def.emoji} ${r.name} found all ${event.items.length} in the ${def.name.toLowerCase()}!`, now);
    }
    return { found, total: event.items.length, item: def.item };
  }

  /** A player answers Mr. E's riddle (one try each). */
  function answer(state, r, choice, now) {
    const event = state.programme?.current;
    if (event?.kind !== "riddle") return { error: "There's no riddle right now." };
    if (event.answered.includes(r.id)) return { error: "You've already answered this one!" };
    event.answered.push(r.id);
    const right = choice === event.riddle.answer;
    if (right) {
      ctx.reward(r, 3, CATALOG.riddle.keepsake, "solved Mr. E's riddle");
      ctx.addEvent(`🔮 ${r.name} solved Mr. E's riddle!`, now);
    } else ctx.reward(r, 1, null, "had a good guess at Mr. E's riddle", { quiet: true });
    return { right, answer: event.riddle.options[event.riddle.answer] };
  }

  /** What phones see: what's on now, what's next, and today's line-up. */
  function publicView(state, now) {
    ensure(state);
    const date = new Date(now);
    const event = state.programme.current;
    const today = programmeFor(date, { showHours: ctx.showHours(date) }).map(e => ({ id: e.id, hour: e.hour, name: CATALOG[e.type].name, emoji: CATALOG[e.type].emoji, place: places[CATALOG[e.type].place].name, start: e.start, end: e.end }));
    return {
      now: event ? {
        id: event.id, name: event.name, emoji: event.emoji, kind: event.kind, place: event.place, placeName: places[event.place].name, end: event.end,
        items: event.items?.map(i => ({ id: i.id, x: i.x, y: i.y, takenBy: i.takenBy })) || null,
        riddle: event.riddle ? { q: event.riddle.q, options: event.riddle.options } : null,
        joined: event.joined, answered: event.answered, itemEmoji: CATALOG[event.type].item?.emoji || null
      } : null,
      today
    };
  }

  return { tick, collect, answer, publicView, ensure };
}

module.exports = { CATALOG, RIDDLES, programmeFor, createProgramme, dayKey, clamp };
