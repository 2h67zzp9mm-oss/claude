"use strict";
/**
 * Economy check bot: plays a week of game time on the real home-plot rules (lib/homestead.js, no server, no
 * browser) and prints the stars earned each day against what things cost (decorations, garden upgrades, the pet
 * seller). Two kinds of player: a little play (two short visits a day) and a big play (four visits, upgrades
 * the garden). Each is played many times with different luck and averaged.
 *
 *   node scripts/economy-bot.js          prints the numbers and writes ECONOMY.md
 *   node scripts/economy-bot.js --check  prints only; exits 1 if a day of play can't buy one small decoration
 *
 * The rule it checks: on every day, even an unlucky one, a little play leaves enough stars (after seeds) for the
 * cheapest thing in the house shop.
 */
const fs = require("node:fs"), path = require("node:path");
const { createHomestead, CROPS } = require("../lib/homestead");
const Decor = require("../shared/decor");

const DAYS = 7, RUNS = 25, HOME = "economy-bot";
const START = [2026, 10, 16];   // Monday 16 November 2026, in whatever time zone this runs in
const PLAYERS = [
  { key: "little", name: "A little play", what: "two short visits (after school and before bed), 3 casts at the pond each visit, never upgrades the garden", hours: [16, 19], casts: 3, upgrades: false },
  { key: "big", name: "A big play", what: "four visits (morning, lunch, after school, before bed), 6 casts each visit, upgrades the garden as soon as it can", hours: [8, 12, 16, 19], casts: 6, upgrades: true }
];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const at = (day, hour) => new Date(START[0], START[1], START[2] + day, hour, 0, 0).getTime();

/** Minutes a crop needs if it's watered when planted: full speed while wet, slow once it dries out. */
function ripeIn(crop, wetHours) {
  const m = CROPS[crop].minutes, wet = wetHours * 60;
  return m <= wet ? m : wet + (m - wet) / 0.35;
}

/** Play one week. Returns one row per day: { earned, sold, rewards, seeds, upgrades, spare, beds }. */
function playWeek(player, seed) {
  const hs = createHomestead({ random: rng(seed) });
  const me = { id: "kid", name: "Kid", stars: 0 }, state = { residents: [me, { id: "nova", name: "Nova" }] };
  const rows = [];
  let now = 0, row = null;
  const act = msg => {
    now += 4000;
    const before = me.stars, res = hs.act(state, HOME, me, msg, now), d = me.stars - before;
    if (d > 0) { row.earned += d; const sold = Math.min(d, res.sold || 0); row.sold += sold; row.rewards += d - sold; }
    else if (d < 0) row[msg.action === "upgrade" ? "upgrades" : "seeds"] -= d;
    return res;
  };
  for (let day = 0; day < DAYS; day++) {
    row = { earned: 0, sold: 0, rewards: 0, seeds: 0, upgrades: 0, spare: 0, beds: 0 }; rows.push(row);
    player.hours.forEach((hour, i) => {
      now = at(day, hour);
      const next = i + 1 < player.hours.length ? at(day, player.hours[i + 1]) : at(day + 1, player.hours[0]);
      const gapMin = (next - now) / 60_000 - 5;
      let v = hs.view(state, HOME, me, now);
      if (!v.pets.owned.length) act({ action: "petStart", species: "kitty", color: "cream" });
      if (v.mail) act({ action: "mail" });
      v.plots.forEach((p, n) => { if (p.crop && p.growth >= 1) act({ action: "harvest", plot: n }); });
      if (Object.keys(hs.view(state, HOME, me, now).bag).length) act({ action: "sell" });
      v = hs.view(state, HOME, me, now);
      if (player.upgrades && v.upgrade && me.stars >= v.upgrade.cost + 10) { act({ action: "upgrade" }); v = hs.view(state, HOME, me, now); }
      const wetH = 6;   // the plain watering can; a level perk only makes it better
      for (let n = 0; n < v.beds; n++) {
        const p = hs.view(state, HOME, me, now).plots[n];
        if (p.crop) { if (p.growth < 1 && !p.wet) act({ action: "water", plot: n }); continue; }
        // the seed that pays best and is ready by the next visit (a seed already in the bag is free)
        const seeds = hs.home(state, HOME).seeds;
        const can = Object.keys(CROPS).filter(c => seeds[c] > 0 || (v.shop.includes(c) && me.stars >= CROPS[c].seed));
        if (!can.length) continue;
        const pay = c => CROPS[c].sell * (CROPS[c].yield + 1) - (seeds[c] > 0 ? 0 : CROPS[c].seed);
        const soon = can.filter(c => ripeIn(c, wetH) <= gapMin), pick = (soon.length ? soon : can).sort((a, b) => pay(b) - pay(a))[0];
        if (!p.tilled) act({ action: "till", plot: n });
        if (!(seeds[pick] > 0)) act({ action: "buy", crop: pick });
        if (act({ action: "plant", plot: n, crop: pick }).ok) act({ action: "water", plot: n });
      }
      for (let c = 0; c < player.casts; c++) { now += 16_000; act({ action: "fish" }); }
      if (Object.keys(hs.view(state, HOME, me, now).bag).length) act({ action: "sell" });
      for (const s of hs.view(state, HOME, me, now).pets.spots) act({ action: "treat", spot: s.i });
      for (let f = 0; f < 6; f++) { const pv = hs.view(state, HOME, me, now).pets; if (!pv.wild || pv.treats < 1) break; act({ action: "petFeed" }); }
    });
    row.spare = row.earned - row.seeds; row.beds = hs.view(state, HOME, me, now).beds;
  }
  return rows;
}

/** Play every kind of player RUNS times. Per day: the average, and the unluckiest run's spare stars. */
function simulate() {
  return PLAYERS.map(player => {
    const weeks = Array.from({ length: RUNS }, (_, i) => playWeek(player, 1000 + i * 77));
    const days = Array.from({ length: DAYS }, (_, d) => {
      const avg = k => Math.round(weeks.reduce((t, w) => t + w[d][k], 0) / RUNS);
      const sold = avg("sold"), rewards = avg("rewards"), seeds = avg("seeds");   // whole stars that still add up across the row
      return { day: d + 1, earned: sold + rewards, sold, rewards, seeds, upgrades: avg("upgrades"), spare: sold + rewards - seeds,
        unlucky: Math.min(...weeks.map(w => w[d].spare)), beds: Math.max(...weeks.map(w => w[d].beds)) };
    });
    const perDay = Math.round(days.reduce((t, x) => t + x.spare, 0) / DAYS);
    return { ...player, days, perDay, week: days.reduce((t, x) => t + x.spare, 0) };
  });
}

const cheapest = () => Decor.CATALOG.reduce((a, b) => (b.price < a.price ? b : a));
/** The rule: every day of a little play, even the unluckiest, can buy the cheapest decoration. Returns the days that can't. */
function problems(sim = simulate()) {
  const small = cheapest(), little = sim.find(p => p.key === "little");
  return little.days.filter(d => d.unlucky < small.price).map(d => `Day ${d.day}: a little play can end with ${d.unlucky}⭐, but the ${small.name} costs ${small.price}⭐.`);
}

function prices() {
  const { LEVELS } = createHomestead();
  const kinds = [
    ["Always in the shop", Decor.CATALOG.filter(d => d.basic)],
    ["Small things", Decor.CATALOG.filter(d => !d.basic && !d.rare && d.price <= 30)],
    ["Big things", Decor.CATALOG.filter(d => !d.rare && !d.dream && d.price > 30)],
    ["Rare things", Decor.CATALOG.filter(d => d.rare)],
    ["Dream things, one each", Decor.CATALOG.filter(d => d.dream)]
  ].map(([name, list]) => ({ name, low: Math.min(...list.map(d => d.price)), high: Math.max(...list.map(d => d.price)), n: list.length }));
  const others = [{ name: "Pet seller", price: 40 }, ...LEVELS.filter(l => l.cost).map(l => ({ name: `Garden upgrade to ${l.beds} beds`, price: l.cost })),
    { name: "Bigger room in the house, once", price: Decor.BIG_ROOM_PRICE }];
  return { kinds, others };
}

function report(sim) {
  const { kinds, others } = prices(), small = cheapest(), bad = problems(sim);
  // how many of a thing one day's spare stars buy, or how many days of saving it takes
  const days = (price, p) => (price <= p.perDay ? `${Math.floor(p.perDay / price)} a day` : `${Math.ceil(price / Math.max(1, p.perDay))} days to save`);
  const out = ["# Cooke's Corner economy", "",
    "Made by the economy bot (`node scripts/economy-bot.js`). Don't edit by hand: run the bot again.", "",
    `The bot plays ${DAYS} days from a brand new home, ${RUNS} times with different luck, on the real game rules.`,
    "It plants the best seed that will be ready by the next visit, waters, picks, sells, fishes, checks the mail and feeds pets.",
    "It does not give to the family build or buy decorations, so **spare** is what's left to spend after seeds.", ""];
  for (const p of sim) {
    out.push(`## ${p.name}`, "", `${p.what[0].toUpperCase()}${p.what.slice(1)}.`, "",
      "| Day | Earned | From selling | From goals, levels, story | Seeds | Garden upgrades | Spare | Spare on an unlucky day | Beds |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...p.days.map(d => `| ${d.day} | ${d.earned}⭐ | ${d.sold}⭐ | ${d.rewards}⭐ | ${d.seeds}⭐ | ${d.upgrades}⭐ | ${d.spare}⭐ | ${d.unlucky}⭐ | ${d.beds} |`),
      "", `About **${p.perDay}⭐ spare a day**, ${p.week}⭐ in the week.`, "");
  }
  out.push("## What a day buys", "", `| Thing | Price | ${sim.map(p => p.name).join(" | ")} |`, `| --- | --- | ${sim.map(() => "---").join(" | ")} |`,
    ...kinds.map(k => `| ${k.name} (${k.n}) | ${k.low}⭐ to ${k.high}⭐ | ${sim.map(p => (days(k.low, p) === days(k.high, p) ? days(k.low, p) : `${days(k.low, p)} (cheapest), ${days(k.high, p)} (dearest)`)).join(" | ")} |`),
    ...others.map(o => `| ${o.name} | ${o.price}⭐ | ${sim.map(p => (o.price <= p.perDay ? "under a day" : days(o.price, p))).join(" | ")} |`), "",
    "## The check", "", `Rule: every day of a little play, even an unlucky one, can buy the cheapest decoration (${small.name}, ${small.price}⭐).`, "",
    bad.length ? `**Not OK:**\n\n${bad.map(b => `- ${b}`).join("\n")}` : "**OK.** Every day passes, so prices stay as they are.", "");
  return out.join("\n");
}

if (require.main === module) {
  const sim = simulate(), text = report(sim), bad = problems(sim);
  console.log(text);
  if (!process.argv.includes("--check")) { fs.writeFileSync(path.join(__dirname, "..", "ECONOMY.md"), text); console.log("Wrote ECONOMY.md"); }
  if (bad.length) { console.error(`${bad.length} problem${bad.length > 1 ? "s" : ""}`); process.exit(1); }
  console.log("0 problems");
}

module.exports = { simulate, problems, report, playWeek, PLAYERS, DAYS };
