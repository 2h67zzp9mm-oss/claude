"use strict";
/**
 * Tron: Sean's caretaker program who lives in Little Town. He walks the
 * streets like everyone else, watches how the town is running, and keeps
 * notes on anything odd (someone stuck doing the same thing for hours, very
 * hungry or tired residents, people standing on top of each other, events
 * nobody went to, favours nobody answered, friendships going cold). Tap him
 * to talk: he reports what's going on and what he'd change.
 *
 * He never moves or changes anyone. Notes are also written to
 * tron/world-state/observations.md so they last between sessions.
 */
const fs = require("fs");
const path = require("path");

const SPEED = 34;                 // map units per second
const SCAN_MS = 60_000;
const NOTE_LIMIT = 40;

function createTron({ world, dir, log = console, random = Math.random }) {
  const seen = new Map();         // residentId -> { key, since }
  let lastScan = 0, lastMove = 0, lastWrite = 0;

  function ensure(state) {
    if (!state.tron || typeof state.tron !== "object") state.tron = {};
    const t = state.tron;
    if (!t.walker || !Number.isFinite(t.walker.x)) {
      const s = world.spotFor(null, "park") || world.spotFor(null, "square");
      t.walker = { x: s.x - 20, y: s.y + 8, path: [], watching: "park", restUntil: 0 };
    }
    if (!Array.isArray(t.walker.path)) t.walker.path = [];
    if (!Array.isArray(t.notes)) t.notes = [];
    return t;
  }

  function wander(t, now) {
    const w = t.walker;
    const seconds = Math.min(5, Math.max(0, (now - (lastMove || now)) / 1000));
    lastMove = now;
    let budget = SPEED * seconds;
    while (budget > 0 && w.path.length) {
      const n = w.path[0], gap = Math.hypot(n.x - w.x, n.y - w.y);
      if (gap <= budget) { w.x = n.x; w.y = n.y; budget -= gap; w.path.shift(); }
      else { w.x += (n.x - w.x) / gap * budget; w.y += (n.y - w.y) / gap * budget; budget = 0; }
    }
    if (w.path.length || now < w.restUntil) return;
    // Look in on somewhere else: wherever the notes point, or anywhere.
    const keys = Object.keys(world.places).filter(k => k !== "homes");
    const hot = t.notes.find(n => n.place && now - n.at < 10 * 60_000)?.place;
    const key = hot && hot !== w.watching && random() < 0.5 ? hot : keys[Math.floor(random() * keys.length)];
    const s = world.spotFor(null, key);
    if (!s) return;
    const to = world.snapToWalkable(s.x + (random() - 0.5) * 70, s.y + 14 + (random() - 0.5) * 30);
    w.path = world.route(w.x, w.y, to.x, to.y);
    w.watching = key;
    w.restUntil = now + 60_000 + random() * 120_000;
  }

  function note(t, now, key, text, kind, place = null) {
    const old = t.notes.find(n => n.key === key);
    if (old) { old.text = text; old.at = now; old.count = (old.count || 1) + 1; return; }
    t.notes.unshift({ key, text, kind, place, at: now, first: now, count: 1 });
    t.notes = t.notes.slice(0, NOTE_LIMIT);
  }

  function scan(state, now, ctx) {
    const t = ensure(state);
    const hour = new Date(now).getHours();
    const placeName = k => world.places[k]?.name || "town";
    const awake = state.residents.filter(r => !r.asleep && !r.away);
    // Stuck doing the same thing for a long time.
    for (const r of state.residents) {
      const key = `${r.place}|${r.activity}`;
      const s = seen.get(r.id);
      if (!s || s.key !== key) { seen.set(r.id, { key, since: now }); continue; }
      const hours = (now - s.since) / 3600_000;
      if (!r.asleep && !ctx.isPlayer(r) && hours >= 3) note(t, now, `stuck:${r.id}`, `${r.name} has been "${r.activity}" for ${Math.floor(hours)} hours. That looks stuck.`, "weird", r.place);
    }
    for (const r of awake) {
      const low = Object.entries(r.needs || {}).filter(([, v]) => v < 15).map(([k]) => k);
      if (low.length) note(t, now, `needs:${r.id}`, `${r.name} is running very low on ${low.join(" and ")}.`, "care", r.place);
      if ((hour >= 1 && hour < 5) && !ctx.isPlayer(r)) note(t, now, `night:${r.id}`, `${r.name} is still up at ${hour} in the morning (${r.activity}).`, "weird", r.place);
    }
    // People standing on top of each other outdoors.
    const outside = awake.filter(r => !r.path?.length && !r.indoor);
    for (let i = 0; i < outside.length; i++) for (let j = i + 1; j < outside.length; j++) {
      const a = outside[i], b = outside[j];
      if ((a.destinationId || "") === (b.destinationId || "") && Math.hypot(a.x - b.x, a.y - b.y) < 3) note(t, now, `overlap:${[a.id, b.id].sort().join(":")}`, `${a.name} and ${b.name} are standing on exactly the same spot near ${placeName(a.place)}.`, "weird", a.place);
    }
    // The event now: is anyone there?
    const ev = state.programme?.current;
    if (ev && now > ev.start + 15 * 60_000) {
      const there = state.residents.filter(r => r.place === ev.place && !r.asleep).length;
      if (there <= 1) note(t, now, `empty:${ev.id}`, `Hardly anyone came to the ${ev.name} at ${placeName(ev.place)}${hour < 15 ? " (it's during school hours)" : ""}.`, "change", ev.place);
    }
    // Favours left waiting, friendships going cold for the players.
    for (const p of ctx.players()) {
      const waiting = (p.questOffers || []).filter(q => now - Number(String(q.id).split("-")[0]) > 3 * 3600_000);
      if (waiting.length) note(t, now, `favours:${p.id}`, `${waiting.map(q => q.requesterName).join(", ")} ${waiting.length > 1 ? "have" : "has"} been waiting a while for ${p.name} to help with a favour.`, "care");
      // Only neighbours in the same town, and one note per player.
      const cold = state.residents.filter(r => r !== p && !ctx.isPlayer(r) && (r.destinationId || "little-town") === (p.destinationId || "little-town"))
        .filter(r => { const v = Number(r.relationships?.[p.id]); return v > 0 && v < 40; });
      if (cold.length) note(t, now, `cold:${p.id}`, `${p.name} hasn't spent time with ${cold.slice(0, 3).map(r => r.name).join(", ")}${cold.length > 3 ? ` and ${cold.length - 3} more` : ""} lately.`, "care");
    }
    // Forget notes that stopped being true an hour ago.
    t.notes = t.notes.filter(n => now - n.at < 60 * 60_000 || n.kind === "change");
    t.notes = t.notes.filter(n => now - n.at < 24 * 3600_000 && !/^cold:[^:]+:/.test(n.key));
  }

  function writeNotes(state, now) {
    if (!dir) return;
    const t = ensure(state);
    const lines = t.notes.map(n => `- ${new Date(n.at).toLocaleString()} · ${n.kind} · ${n.text}${n.count > 1 ? ` (seen ${n.count}×)` : ""}`);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "observations.md"), `# What Tron is noticing\n\nUpdated ${new Date(now).toLocaleString()}.\n\n${lines.join("\n") || "- All quiet. Nothing odd right now."}\n`);
    } catch (err) { log.error("Tron notes:", err.message); }
  }

  function tick(state, now, ctx) {
    const t = ensure(state);
    wander(t, now);
    if (now - lastScan >= SCAN_MS) { lastScan = now; try { scan(state, now, ctx); } catch (err) { log.error("Tron scan:", err); } }
    if (now - lastWrite >= 10 * 60_000) { lastWrite = now; writeNotes(state, now); }
  }

  /** A plain answer from his notes, used when the AI is off or slow. */
  function answer(state, text) {
    const t = ensure(state);
    const q = String(text || "").toLowerCase();
    const pick = kinds => t.notes.filter(n => kinds.includes(n.kind)).slice(0, 4).map(n => n.text);
    let items, intro;
    if (/weird|odd|strange|wrong|stuck|bug|broken/.test(q)) { items = pick(["weird"]); intro = "Here's what looks off to me:"; }
    else if (/change|improv|recommend|better|fix|should/.test(q)) { items = pick(["change", "weird"]); intro = "What I'd change:"; }
    else if (/who|need|help|care|friend|favour|favor/.test(q)) { items = pick(["care"]); intro = "People who could use some attention:"; }
    else { items = t.notes.slice(0, 4).map(n => n.text); intro = "Here's what's going on:"; }
    if (!items.length) return "Scanning… everything is running smoothly right now. No glitches in the grid.";
    return `${intro} ${items.map(s => `• ${s}`).join(" ")}`;
  }

  function publicView(state) {
    const t = ensure(state);
    const w = t.walker;
    return { x: Math.round(w.x * 10) / 10, y: Math.round(w.y * 10) / 10, walking: w.path.length > 0, watching: world.places[w.watching]?.name || null, notes: t.notes.length };
  }

  return { tick, scan, answer, publicView, ensure, notes: state => ensure(state).notes };
}

module.exports = { createTron };
