"use strict";
/**
 * Inside your house: things to buy in today's shop, a box of stored things, and a room in each world's
 * house to put them in. The family shares the house: one room per world, one storage box.
 * Saved on the homestead (state.homesteads[householdId]):
 *   h.rooms[world] = { items: [{ uid, id, x, y, rot }] }   h.storage = [{ uid, id }]   h.decorUid = next uid
 *   h.rareDay = { day, ids }   (a rare thing can be bought once on the day it shows up)
 * The catalog and the fit check live in shared/decor.js so the phone can check a drag before asking.
 */
const D = require("../shared/decor");

const ACTIONS = ["decorBuy", "decorPlace", "decorMove", "decorRotate", "decorStore", "artPick"];
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
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);

/** What the phone needs: today's shop, what's in the box, and this world's room. */
function view(h, { world, householdId, now }) {
  const day = dayKey(now), rare = h.rareDay?.day === day ? h.rareDay.ids || [] : [];
  return {
    stock: D.shopToday(day, world, householdId).map(id => ({ id, soldOut: Boolean(D.BY_ID[id].rare && rare.includes(id)) })),
    storage: storageOf(h).map(({ uid, id }) => ({ uid, id })),
    room: roomOf(h, world).items.map(({ uid, id, x, y, rot }) => ({ uid, id, x, y, rot: rot || 0 })),
    art: artOf(h)
  };
}

/** decorBuy {item}, decorPlace {uid,x,y,rot}, decorMove {uid,x,y}, decorRotate {uid}, decorStore {uid}. Returns { ok, toast, ... }. */
function act(h, r, msg, { world, householdId, now }) {
  const room = roomOf(h, world), box = storageOf(h), uid = Number(msg.uid);
  switch (msg.action) {
    case "artPick": {
      const key = String(msg.key || ""), v = String(msg.item || "");
      if (!ART[key]?.includes(v)) return { ok: false, toast: "Hmm, I don't know that style." };
      h.art = { ...artOf(h), [key]: v };
      return { ok: true, artPicked: key, toast: "🎨 New look!" };
    }
    case "decorBuy": {
      const id = typeof msg.item === "string" ? msg.item : typeof msg.id === "string" ? msg.id : "", d = D.BY_ID[id], day = dayKey(now);
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
      if (!D.fits(room.items, d.id, x, y, rot)) return { ok: false, toast: "It doesn't fit there. Try another spot!" };
      const [it] = box.splice(i, 1); room.items.push({ uid: it.uid, id: it.id, x, y, rot });
      return { ok: true, decorPlaced: it.uid, toast: `${d.emoji} Nice spot!` };
    }
    case "decorMove": case "decorRotate": {
      const it = room.items.find(t => t.uid === uid); if (!it) return { ok: false, toast: "Hmm, I can't find that." };
      const d = D.BY_ID[it.id];
      if (msg.action === "decorMove") {
        const x = num(msg.x), y = d.kind === "wall" ? 0 : num(msg.y);
        if (!D.fits(room.items, it.id, x, y, it.rot || 0, uid)) return { ok: false, toast: "It doesn't fit there." };
        it.x = x; it.y = y; return { ok: true };
      }
      if (d.kind === "wall") return { ok: false, toast: "That one hangs on the wall." };
      const rot = ((it.rot || 0) + 1) % 4, f = D.footprint(d, rot);
      // turning a long thing near a wall: slide it back into the room if it would poke out
      const x = Math.min(it.x, D.ROOM.w - f.w), y = Math.min(it.y, D.ROOM.d - f.h);
      if (!D.fits(room.items, it.id, x, y, rot, uid)) return { ok: false, toast: "No room to turn it here. Move it first!" };
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

module.exports = { ACTIONS, ART, CATALOG: D.CATALOG, BY_ID: D.BY_ID, ROOM: D.ROOM, shopToday: D.shopToday, fits: D.fits, footprint: D.footprint, view, act, dayKey };
