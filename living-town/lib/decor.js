"use strict";
/**
 * Inside your house: things to buy in today's shop, a box of stored things, and a room in each world's
 * house to put them in. The family shares the house: one room per world, one storage box.
 * Saved on the homestead (state.homesteads[householdId]):
 *   h.rooms[world] = { items: [{ uid, id, x, y, rot }] }   h.storage = [{ uid, id }]   h.decorUid = next uid
 *   h.rareDay = { day, ids }   (a rare thing can be bought once on the day it shows up)
 *   h.dreams = [id]            (dream things the family has bought: one of each, ever; missing on old saves = none)
 *   h.bigRoom = true           (the family bought the bigger room; missing on old saves = the small room)
 *   h.dreamGoals = { [residentId]: id }   (the dream thing each person is saving up for; missing on old saves = no goal)
 * The catalog and the fit check live in shared/decor.js so the phone can check a drag before asking.
 */
const D = require("../shared/decor");

const ACTIONS = ["decorBuy", "decorPlace", "decorMove", "decorRotate", "decorStore", "artPick", "dreamGoal", "roomUpgrade"];
// Hazel picks the art in the game: the inside-the-house style and how people look in Pirate Cove. Saved for the whole family.
const ART = { room: ["clay", "story", "pixel"], pirate: ["A", "B", "C"] };
const ART_DEFAULT = { room: "clay", pirate: "B" };
const artOf = h => ({ ...ART_DEFAULT, ...(h.art || {}) });
function dayKey(now) { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function roomOf(h, world) {
  if (!h.rooms || typeof h.rooms !== "object") h.rooms = {};
  const r = h.rooms[world] ||= { items: [] };
  if (!Array.isArray(r.items)) r.items = [];
  if (r.items.some(it => !it || !D.BY_ID[it.id])) r.items = r.items.filter(it => it && D.BY_ID[it.id]);   // a thing that left the catalog
  return r;
}
function storageOf(h) {
  if (!Array.isArray(h.storage)) h.storage = [];
  if (h.storage.some(it => !it || !D.BY_ID[it.id])) h.storage = h.storage.filter(it => it && D.BY_ID[it.id]);
  return h.storage;
}
function nextUid(h) {
  const used = [...storageOf(h), ...Object.values(h.rooms || {}).flatMap(r => r.items || [])].map(it => it.uid);
  h.decorUid = Math.max(Number(h.decorUid) || 1, ...used.map(u => u + 1)); return h.decorUid++;
}
const sizeOf = h => D.roomFor(h.bigRoom === true);   // the small room unless the family bought the bigger one
const dreamsOf = h => (Array.isArray(h.dreams) ? h.dreams : []);
const goalsOf = h => (h.dreamGoals && typeof h.dreamGoals === "object" && !Array.isArray(h.dreamGoals) ? h.dreamGoals : {});
/** The dream thing this person is saving up for (null once the family has it, or if it left the catalog). */
function goalOf(h, r) {
  const id = r ? goalsOf(h)[r.id] : null, d = typeof id === "string" ? D.BY_ID[id] : null;
  if (!d?.dream || dreamsOf(h).includes(id)) return null;
  const have = Math.max(0, Number(r.stars) || 0);
  return { id, name: d.name, emoji: d.emoji, have, need: d.price, ready: have >= d.price };
}
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);

/** What the phone needs: today's shop, what's in the box, and this world's room. */
function view(h, { world, householdId, now, me }) {
  const day = dayKey(now), rare = h.rareDay?.day === day ? h.rareDay.ids || [] : [];
  return {
    stock: D.shopToday(day, world, householdId).map(id => ({ id, soldOut: Boolean(D.BY_ID[id].rare && rare.includes(id)) })),
    dreams: D.dreams(world).map(id => ({ id, owned: dreamsOf(h).includes(id) })),
    storage: storageOf(h).map(({ uid, id }) => ({ uid, id })),
    room: roomOf(h, world).items.map(({ uid, id, x, y, rot }) => ({ uid, id, x, y, rot: rot || 0 })),
    art: artOf(h), goal: goalOf(h, me), big: h.bigRoom === true, bigPrice: D.BIG_ROOM_PRICE
  };
}

/** dreamGoal {item}, decorBuy {item}, decorPlace {uid,x,y,rot}, decorMove {uid,x,y}, decorRotate {uid}, decorStore {uid}. Returns { ok, toast, ... }. */
function act(h, r, msg, { world, householdId, now }) {
  const room = roomOf(h, world), box = storageOf(h), uid = Number(msg.uid), size = sizeOf(h);
  switch (msg.action) {
    case "roomUpgrade": {   // the bigger room: bought once, for every house the family has; nothing inside moves
      if (h.bigRoom === true) return { ok: false, toast: "🏠 Your room is already the big one!" };
      if ((Number(r.stars) || 0) < D.BIG_ROOM_PRICE) return { ok: false, toast: `You need ${D.BIG_ROOM_PRICE}⭐ for the bigger room. Keep saving!` };
      r.stars -= D.BIG_ROOM_PRICE; h.bigRoom = true;
      return { ok: true, roomUpgraded: true };   // the phone cheers with a banner
    }
    case "artPick": {
      const key = String(msg.key || ""), v = String(msg.item || "");
      if (!ART[key]?.includes(v)) return { ok: false, toast: "Hmm, I don't know that style." };
      h.art = { ...artOf(h), [key]: v };
      return { ok: true, artPicked: key, toast: "🎨 New look!" };
    }
    case "dreamGoal": {   // pick a dream thing to save up for; picking another one swaps it
      const id = typeof msg.item === "string" ? msg.item : "", d = D.BY_ID[id];
      if (!d?.dream) return { ok: false, toast: "Pick a ⭐ Dream thing to save up for!" };
      if (!D.inWorld(d, world)) return { ok: false, toast: `The ${d.name} is sold in another world.` };
      if (dreamsOf(h).includes(id)) return { ok: false, toast: `${d.emoji} You already have the ${d.name}!` };
      h.dreamGoals = { ...goalsOf(h), [r.id]: id };
      return { ok: true, dreamGoal: id, toast: `🎯 Saving up for the ${d.name}!` };
    }
    case "decorBuy": {
      const id = typeof msg.item === "string" ? msg.item : typeof msg.id === "string" ? msg.id : "", d = D.BY_ID[id], day = dayKey(now);
      if (d?.dream) {   // always in the shop, one of each per family
        if (!D.inWorld(d, world)) return { ok: false, toast: `The ${d.name} is sold in another world.` };
        if (dreamsOf(h).includes(id)) return { ok: false, toast: `${d.emoji} You already have the ${d.name}!` };
        if ((Number(r.stars) || 0) < d.price) return { ok: false, toast: `You need ${d.price}⭐ for the ${d.name}. Keep saving!` };
        r.stars -= d.price; h.dreams = [...dreamsOf(h), id];
        if (h.dreamGoals) h.dreamGoals = Object.fromEntries(Object.entries(goalsOf(h)).filter(([, g]) => g !== id));   // goal reached
        const it = { uid: nextUid(h), id }; box.push(it);
        return { ok: true, decorBought: it, dreamBought: id, toast: `🎉 The ${d.name} is yours! It's in 📦 Stored.` };
      }
      if (!d || !D.shopToday(day, world, householdId).includes(id)) return { ok: false, toast: "That's not in the shop today. Come back tomorrow!" };
      if (d.rare && h.rareDay?.day === day && (h.rareDay.ids || []).includes(id)) return { ok: false, toast: `✨ Only one ${d.name} today!` };
      if ((Number(r.stars) || 0) < d.price) return { ok: false, toast: `You need ${d.price}⭐ for the ${d.name}. Grow and sell to save up!` };
      r.stars -= d.price;
      if (d.rare) { if (h.rareDay?.day !== day) h.rareDay = { day, ids: [] }; h.rareDay.ids.push(id); }
      const it = { uid: nextUid(h), id }; box.push(it);
      return { ok: true, decorBought: it, toast: `${d.emoji} You got a ${d.name}! It's in 📦 Stored.` };
    }
    case "decorPlace": {
      const i = box.findIndex(it => it.uid === uid); if (i < 0) return { ok: false, toast: "That isn't in your box." };
      const d = D.BY_ID[box[i].id], x = num(msg.x), y = d.kind === "wall" ? 0 : num(msg.y), rot = d.kind === "wall" ? 0 : ((num(msg.rot) || 0) % 4 + 4) % 4;
      if (!D.inWorld(d, world)) return { ok: false, toast: `The ${d.name} belongs in another world's house.` };
      if (!D.fits(room.items, d.id, x, y, rot, null, size)) return { ok: false, toast: "It doesn't fit there. Try another spot!" };
      const [it] = box.splice(i, 1); room.items.push({ uid: it.uid, id: it.id, x, y, rot });
      return { ok: true, decorPlaced: it.uid, toast: `${d.emoji} Nice spot!` };
    }
    case "decorMove": case "decorRotate": {
      const it = room.items.find(t => t.uid === uid); if (!it) return { ok: false, toast: "Hmm, I can't find that." };
      const d = D.BY_ID[it.id];
      if (msg.action === "decorMove") {
        const x = num(msg.x), y = d.kind === "wall" ? 0 : num(msg.y);
        if (!D.fits(room.items, it.id, x, y, it.rot || 0, uid, size)) return { ok: false, toast: "It doesn't fit there." };
        it.x = x; it.y = y; return { ok: true };
      }
      if (d.kind === "wall") return { ok: false, toast: "That one hangs on the wall." };
      const rot = ((it.rot || 0) + 1) % 4, f = D.footprint(d, rot);
      // turning a long thing near a wall: slide it back into the room if it would poke out
      const x = Math.min(it.x, size.w - f.w), y = Math.min(it.y, size.d - f.h);
      if (!D.fits(room.items, it.id, x, y, rot, uid, size)) return { ok: false, toast: "No room to turn it here. Move it first!" };
      Object.assign(it, { x, y, rot }); return { ok: true };
    }
    case "decorStore": {
      const i = room.items.findIndex(t => t.uid === uid); if (i < 0) return { ok: false, toast: "Hmm, I can't find that." };
      const [it] = room.items.splice(i, 1); box.push({ uid: it.uid, id: it.id });
      return { ok: true, toast: `📦 ${D.BY_ID[it.id].name} put away.` };
    }
  }
  return { ok: false, toast: "Hmm, I don't know how to do that." };
}

module.exports = { ACTIONS, ART, CATALOG: D.CATALOG, BY_ID: D.BY_ID, ROOM: D.ROOM, BIG_ROOM: D.BIG_ROOM, BIG_ROOM_PRICE: D.BIG_ROOM_PRICE, shopToday: D.shopToday, dreams: D.dreams, fits: D.fits, footprint: D.footprint, view, act, dayKey };
