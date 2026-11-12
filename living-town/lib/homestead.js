"use strict";
/**
 * The home plot: each household's own little homestead next to town. The
 * family shares it: a garden of sixteen beds, a pond to fish in, a shipping crate
 * that buys what you grow and catch (for stars) and sells seeds, and a mailbox
 * with a letter from a neighbour every day.
 *
 * Crops grow in real time, faster when watered, so there's a reason to come
 * back later. Fishing is a timing game on the phone; the server picks the fish.
 * Saved in state.homesteads[householdId]; everything is optional on old saves.
 */

const CROPS = {
  carrot: { name: "Carrot", emoji: "🥕", minutes: 20, seed: 1, sell: 3 },
  strawberry: { name: "Strawberry", emoji: "🍓", minutes: 60, seed: 2, sell: 6 },
  tomato: { name: "Tomato", emoji: "🍅", minutes: 40, seed: 2, sell: 4 },
  blueberry: { name: "Blueberry", emoji: "🫐", minutes: 90, seed: 3, sell: 4 },
  corn: { name: "Corn", emoji: "🌽", minutes: 120, seed: 3, sell: 10 },
  sunflower: { name: "Sunflower", emoji: "🌻", minutes: 180, seed: 4, sell: 12 },
  watermelon: { name: "Watermelon", emoji: "🍉", minutes: 360, seed: 5, sell: 20 },
  pumpkin: { name: "Pumpkin", emoji: "🎃", minutes: 480, seed: 6, sell: 25 }
};
// weight: how common; hours: when they bite (any time if missing)
const FISH = {
  minnow: { name: "Minnow", sell: 1, weight: 30 },
  perch: { name: "Perch", sell: 3, weight: 22 },
  sunfish: { name: "Sunfish", sell: 4, weight: 16, hours: [8, 18] },
  catfish: { name: "Catfish", sell: 6, weight: 12, hours: [18, 6] },
  trout: { name: "Trout", sell: 8, weight: 9, hours: [5, 11] },
  koi: { name: "Koi", sell: 12, weight: 6 },
  pike: { name: "Pike", sell: 15, weight: 4, hours: [15, 22] },
  golden: { name: "Golden Fish", sell: 40, weight: 1 }
};
const PLOTS = 16;
const WORLDS = ["clay", "scifi", "castle"];
const WATER_HOURS = 6;
const DRY_SPEED = 0.35;
// Start small, then upgrade: each garden level opens more beds and better seeds.
const LEVELS = [
  { beds: 4, crops: ["carrot", "strawberry", "tomato"] },
  { beds: 8, crops: ["blueberry", "corn"], cost: 25 },
  { beds: 12, crops: ["sunflower", "watermelon"], cost: 60 },
  { beds: 16, crops: ["pumpkin"], cost: 120 }
];
// Daily goals: three little jobs each day, a few ⭐ each, a bonus for all three and a streak for days in a row.
const GOALS = {
  plant: { icon: "🌱", n: [2, 3], text: n => `Plant ${n} seeds` },
  water: { icon: "💧", n: [3, 5], text: n => `Water ${n} times` },
  harvest: { icon: "🧺", n: [2, 3], text: n => `Pick ${n} crops` },
  fish: { icon: "🎣", n: [1, 2], text: n => `Catch ${n} fish` },
  sell: { icon: "📦", n: [1, 1], text: () => "Sell at the crate" },
  mail: { icon: "✉️", n: [1, 1], text: () => "Check the mailbox" }
};
const GOAL_STARS = 3, ALL_BONUS = 5;

function levelOf(h) { return Math.min(LEVELS.length - 1, Math.max(0, Number(h.level) || 0)); }
function bedsOf(h) { return LEVELS[levelOf(h)].beds; }
function cropsOf(h) { return LEVELS.slice(0, levelOf(h) + 1).flatMap(l => l.crops); }

function createHomestead({ random = Math.random, isPlayer = () => false } = {}) {
  const positions = new Map(); // residentId -> { x, y, dir, at, household }
  const lastCast = new Map();

  function home(state, id) {
    if (!state.homesteads || typeof state.homesteads !== "object") state.homesteads = {};
    let h = state.homesteads[id];
    if (!h || typeof h !== "object") h = state.homesteads[id] = {};
    if (!Array.isArray(h.plots)) h.plots = [];
    while (h.plots.length < PLOTS) h.plots.push({ crop: null });
    if (!h.seeds || typeof h.seeds !== "object") h.seeds = { carrot: 4, strawberry: 2 };
    if (!h.bag || typeof h.bag !== "object") h.bag = {};
    if (!h.caught || typeof h.caught !== "object") h.caught = {};
    return h;
  }

  function inWindow(hours, hour) {
    if (!hours) return true;
    const [a, b] = hours;
    return a < b ? hour >= a && hour < b : hour >= a || hour < b;
  }

  // Move every growing crop forward to now.
  function grow(h, now) {
    for (const p of h.plots) {
      if (!p.crop || p.growth >= 1) continue;
      const last = Number(p.grewAt) || now;
      let ms = Math.max(0, now - last);
      const wetUntil = Number(p.wateredAt || 0) + WATER_HOURS * 3600_000;
      const wetMs = Math.max(0, Math.min(now, wetUntil) - last);
      const dryMs = ms - wetMs;
      const total = CROPS[p.crop].minutes * 60_000;
      p.growth = Math.min(1, (Number(p.growth) || 0) + (wetMs + dryMs * DRY_SPEED) / total);
      p.grewAt = now;
    }
  }

  function seeded(str) { let x = 2166136261; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296; }
  function daily(h, id, now) {
    const day = dayKey(now);
    if (h.daily?.day === day) return h.daily;
    const rnd = seeded(id + day), kinds = Object.keys(GOALS);
    const goals = [];
    while (goals.length < 3) { const k = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0]; const [a, b] = GOALS[k].n; goals.push({ k, n: a + Math.floor(rnd() * (b - a + 1)), have: 0 }); }
    return (h.daily = { day, goals, done: false });
  }
  function streakOf(h, now) {
    const today = dayKey(now), yesterday = dayKey(now - 86400_000);
    return h.streakDay === today || h.streakDay === yesterday ? Number(h.streak) || 0 : 0;
  }
  // Count a finished job toward today's goals. Returns what just got finished.
  function bump(h, id, r, kind, amount, now) {
    const d = daily(h, id, now), done = [];
    for (const g of d.goals) {
      if (g.k !== kind || g.have >= g.n) continue;
      g.have = Math.min(g.n, g.have + amount);
      if (g.have >= g.n) { r.stars = (Number(r.stars) || 0) + GOAL_STARS; done.push({ icon: GOALS[g.k].icon, text: GOALS[g.k].text(g.n), stars: GOAL_STARS }); }
    }
    let all = null;
    if (!d.done && d.goals.every(g => g.have >= g.n)) {
      d.done = true;
      h.streak = streakOf(h, now) + 1; h.streakDay = dayKey(now);
      const bonus = ALL_BONUS + Math.min(5, h.streak - 1);
      r.stars = (Number(r.stars) || 0) + bonus;
      all = { bonus, streak: h.streak };
    }
    return { done, all };
  }

  function view(state, id, me, now) {
    const h = home(state, id);
    grow(h, now);
    const hour = new Date(now).getHours();
    const others = [...positions.entries()].filter(([rid, p]) => p.household === id && rid !== me?.id && now - p.at < 15_000)
      .map(([rid, p]) => ({ id: rid, name: state.residents.find(r => r.id === rid)?.name || "", x: p.x, y: p.y, dir: p.dir, moving: p.moving }));
    return {
      plots: h.plots.map(p => p.crop ? { crop: p.crop, growth: Math.round(p.growth * 100) / 100, wet: now < Number(p.wateredAt || 0) + WATER_HOURS * 3600_000 } : { crop: null }),
      beds: bedsOf(h), level: levelOf(h) + 1, shop: cropsOf(h),
      upgrade: LEVELS[levelOf(h) + 1] ? { cost: LEVELS[levelOf(h) + 1].cost, beds: LEVELS[levelOf(h) + 1].beds, crops: LEVELS[levelOf(h) + 1].crops } : null,
      world: WORLDS.includes(h.world) ? h.world : "clay",
      seeds: h.seeds, bag: h.bag, caught: h.caught, stars: me?.stars || 0,
      mail: h.mailDay !== dayKey(now), others,
      goals: daily(h, id, now).goals.map(g => ({ icon: GOALS[g.k].icon, text: GOALS[g.k].text(g.n), have: g.have, n: g.n })),
      streak: streakOf(h, now), streakToday: h.streakDay === dayKey(now), goalStars: GOAL_STARS, allBonus: ALL_BONUS,
      crops: CROPS, fish: Object.fromEntries(Object.entries(FISH).map(([k, f]) => [k, { name: f.name, sell: f.sell, biting: inWindow(f.hours, hour) }]))
    };
  }

  function dayKey(now) { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

  function pickFish(now) {
    const hour = new Date(now).getHours();
    const pool = Object.entries(FISH).filter(([, f]) => inWindow(f.hours, hour));
    let roll = random() * pool.reduce((s, [, f]) => s + f.weight, 0);
    for (const [k, f] of pool) { roll -= f.weight; if (roll <= 0) return k; }
    return pool[0][0];
  }

  /** Do something on the home plot. Returns { ok, toast, ... } (the caller sends the new view). */
  function act(state, id, r, msg, now) {
    const res = doAct(state, id, r, msg, now);
    if (!res.ok || res.quiet) return res;
    const h = home(state, id);
    const kind = { plant: "plant", water: "water", harvest: "harvest", fish: "fish", sell: "sell", mail: "mail" }[msg.action];
    if (kind) { const g = bump(h, id, r, kind, 1, now); if (g.done.length) res.goals = g.done; if (g.all) res.allGoals = g.all; }
    return res;
  }
  function doAct(state, id, r, msg, now) {
    const h = home(state, id);
    grow(h, now);
    const plot = Number.isInteger(msg.plot) && msg.plot >= 0 && msg.plot < PLOTS ? h.plots[msg.plot] : null;
    if (plot && msg.plot >= bedsOf(h) && ["plant", "water", "harvest"].includes(msg.action)) return { ok: false, toast: "That bed isn't dug yet. Upgrade your garden at the crate!" };
    switch (msg.action) {
      case "pos": {
        const x = Number(msg.x), y = Number(msg.y);
        if (Number.isFinite(x) && Number.isFinite(y)) positions.set(r.id, { x, y, dir: Number(msg.dir) | 0, moving: Boolean(msg.moving), at: now, household: id });
        return { ok: true, quiet: true };
      }
      case "leave": positions.delete(r.id); return { ok: true, quiet: true };
      case "plant": {
        const crop = CROPS[msg.crop] ? msg.crop : null;
        if (!plot || !crop) return { ok: false, toast: "Pick a bed and a seed." };
        if (plot.crop) return { ok: false, toast: "Something's already growing there." };
        if (!(h.seeds[crop] > 0)) return { ok: false, toast: `No ${CROPS[crop].name.toLowerCase()} seeds left. The crate sells them.` };
        h.seeds[crop]--; Object.assign(plot, { crop, growth: 0, grewAt: now, wateredAt: 0, by: r.id });
        return { ok: true, planted: msg.plot, toast: `${CROPS[crop].emoji} Planted ${CROPS[crop].name.toLowerCase()} seeds. Water them to help them grow!` };
      }
      case "water": {
        if (!plot?.crop) return { ok: false, toast: "Plant something first." };
        if (plot.growth >= 1) return { ok: false, toast: "It's ready to pick!" };
        plot.wateredAt = now;
        return { ok: true, toast: "💧 Watered. It'll grow faster for a while.", splash: msg.plot };
      }
      case "harvest": {
        if (!plot?.crop) return { ok: false, toast: "Nothing growing there yet." };
        if (plot.growth < 1) return { ok: false, toast: `Not ready yet (${Math.round(plot.growth * 100)}% grown).` };
        const c = plot.crop, n = { strawberry: 3, blueberry: 3, carrot: 2, tomato: 2 }[c] || 1;
        h.bag[c] = (h.bag[c] || 0) + n;
        Object.assign(plot, { crop: null, growth: 0, wateredAt: 0 });
        return { ok: true, toast: `${CROPS[c].emoji} Picked ${n} ${CROPS[c].name.toLowerCase()}${n > 1 ? "s" : ""}!`, harvested: c, plot: msg.plot, count: n };
      }
      case "fish": {
        // The phone runs the timing game; this records the catch.
        if (now - (lastCast.get(r.id) || 0) < 3000) return { ok: false, toast: "Let the water settle a moment." };
        lastCast.set(r.id, now);
        const k = pickFish(now), f = FISH[k];
        h.bag[k] = (h.bag[k] || 0) + 1;
        const first = !h.caught[k];
        h.caught[k] = (h.caught[k] || 0) + 1;
        return { ok: true, fish: k, first, toast: `🎣 You caught a ${f.name}!${first ? " New in your fish book!" : ""}` };
      }
      case "sell": {
        let stars = 0, count = 0;
        for (const [k, n] of Object.entries(h.bag)) {
          const price = CROPS[k]?.sell ?? FISH[k]?.sell;
          if (!price || !(n > 0)) continue;
          stars += price * n; count += n; delete h.bag[k];
        }
        if (!count) return { ok: false, toast: "The crate is empty. Grow or catch something to sell!" };
        r.stars = (Number(r.stars) || 0) + stars;
        return { ok: true, sold: stars, toast: `📦 Sold ${count} thing${count > 1 ? "s" : ""} for ${stars} ⭐` };
      }
      case "buy": {
        const crop = CROPS[msg.crop] ? msg.crop : null;
        if (!crop) return { ok: false, toast: "Which seeds?" };
        if (!cropsOf(h).includes(crop)) return { ok: false, toast: "Upgrade your garden to grow those." };
        const cost = CROPS[crop].seed;
        if ((Number(r.stars) || 0) < cost) return { ok: false, toast: `You need ${cost} ⭐ for ${CROPS[crop].name.toLowerCase()} seeds.` };
        r.stars -= cost; h.seeds[crop] = (h.seeds[crop] || 0) + 1;
        return { ok: true, toast: `🌱 Bought ${CROPS[crop].name.toLowerCase()} seeds.` };
      }
      case "world": {
        if (!WORLDS.includes(msg.world)) return { ok: false, toast: "That world isn't built yet." };
        h.world = msg.world;
        return { ok: true, toast: { scifi: "🚀 Welcome to your space colony!", castle: "🏰 Welcome to Cloud Castle!" }[msg.world] || "🤍 Back to the clay world." };
      }
      case "upgrade": {
        const next = LEVELS[levelOf(h) + 1];
        if (!next) return { ok: false, toast: "Your garden is as big as it gets!" };
        if ((Number(r.stars) || 0) < next.cost) return { ok: false, toast: `You need ${next.cost} ⭐ to upgrade the garden.` };
        r.stars -= next.cost; h.level = levelOf(h) + 1;
        return { ok: true, toast: `🌱 Garden upgraded! ${next.beds} beds now, and new seeds: ${next.crops.map(c => CROPS[c].emoji).join(" ")}` };
      }
      case "mail": {
        if (h.mailDay === dayKey(now)) return { ok: false, toast: "No new mail today. Check again tomorrow!" };
        h.mailDay = dayKey(now);
        const friends = state.residents.filter(o => o.id !== r.id && !o.away && (o.destinationId || "little-town") === "little-town" && !isPlayer(o));
        const from = friends.length ? friends[Math.floor(random() * friends.length)] : null;
        const keys = cropsOf(h); const gift = keys[Math.floor(random() * keys.length)];
        h.seeds[gift] = (h.seeds[gift] || 0) + 2;
        const lines = ["I had extra seeds and thought of you!", "Your garden is looking lovely. Here's something for it!", "Found these in my shed. Happy planting!", "A little something to grow. Say hi next time you're in town!"];
        return { ok: true, letter: { from: from?.name || "A neighbour", text: lines[Math.floor(random() * lines.length)], gift: `2 ${CROPS[gift].name.toLowerCase()} seeds ${CROPS[gift].emoji}` } };
      }
      default: return { ok: false, toast: "Hmm, I don't know how to do that." };
    }
  }

  return { view, act, home, CROPS, FISH, LEVELS, GOALS };
}

module.exports = { createHomestead, CROPS, FISH };
