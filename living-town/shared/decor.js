/**
 * Things for inside your house: the catalog, the room's size and the "does it fit here?" check.
 * Shared by the server (lib/decor.js, CommonJS) and the browser (global `LivingTownDecor`, used by
 * public/house-room.js to check a drag before it asks the server). Keep it free of Node-only APIs.
 *
 * Every thing has a footprint in floor tiles (w across, h deep). `kind` is where it goes:
 * floor (furniture, can't overlap other furniture), rug (lies flat; furniture can stand on it) or
 * wall (hangs on the back wall, only w matters). `worlds` is "all" or the worlds it belongs in.
 */
(function (root, factory) {
  const decor = factory();
  if (typeof module === "object" && module.exports) module.exports = decor;
  else root.LivingTownDecor = decor;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // The room: 9 tiles across, 7 deep, and a back wall 9 tiles wide with the door and a window in it.
  // The tiles just inside the door are the doormat, so nothing ever blocks the way out.
  const ROOM = { w: 9, d: 7, door: [0, 2], window: [5, 2], mat: { x: 0, y: 0, w: 2, h: 1 } };

  const T = (id, name, emoji, price, w, h, kind = "floor", worlds = "all", extra = {}) => ({ id, name, emoji, price, w, h, kind, worlds, ...extra });
  const CATALOG = [
    // basics: always in the shop
    T("chair", "Wooden Chair", "🪑", 12, 1, 1, "floor", "all", { basic: true }),
    T("plant", "Potted Plant", "🪴", 14, 1, 1, "floor", "all", { basic: true }),
    T("rug_round", "Round Rug", "⭕", 15, 2, 2, "rug", "all", { basic: true }),
    T("pic_flower", "Flower Picture", "🖼️", 16, 1, 1, "wall", "all", { basic: true }),
    // small things
    T("stool", "Little Table", "🍵", 18, 1, 1),
    T("sunpot", "Sunflower Pot", "🌻", 18, 1, 1),
    T("teddy", "Big Teddy", "🧸", 22, 1, 1),
    T("clock", "Wall Clock", "🕰️", 24, 1, 1, "wall"),
    T("lamp", "Floor Lamp", "💡", 25, 1, 1, "floor", "all", { glow: true }),
    T("beanbag", "Beanbag", "🫘", 26, 1, 1),
    T("toybox", "Toy Box", "🧩", 28, 1, 1),
    T("shelf", "Wall Shelf", "🪵", 28, 2, 1, "wall"),
    T("flags", "Bunting Flags", "🎏", 20, 2, 1, "wall"),
    T("bigplant", "Big Leafy Plant", "🌿", 30, 1, 1),
    T("pic_sun", "Sunny Painting", "🌅", 30, 2, 1, "wall"),
    // big things
    T("rug_stripe", "Stripy Rug", "🟫", 35, 3, 2, "rug"),
    T("armchair", "Armchair", "💺", 40, 1, 1),
    T("dresser", "Dresser", "🗄️", 40, 2, 1),
    T("desk", "Desk", "✏️", 45, 2, 1),
    T("horse", "Rocking Horse", "🐴", 45, 1, 1),
    T("books", "Bookshelf", "📚", 50, 2, 1),
    T("table", "Dinner Table", "🍽️", 55, 2, 2),
    T("bed", "Cozy Bed", "🛏️", 60, 2, 3),
    T("rug_star", "Star Rug", "⭐", 60, 3, 3, "rug"),
    T("telescope", "Telescope", "🔭", 70, 1, 1),
    T("sofa", "Comfy Sofa", "🛋️", 80, 3, 1),
    T("tank", "Fish Tank", "🐠", 95, 2, 1),
    T("bunk", "Bunk Bed", "🪜", 110, 2, 3),
    T("piano", "Little Piano", "🎹", 120, 2, 1),
    // only in one world
    T("robot", "Robot Pal", "🤖", 85, 1, 1, "floor", ["scifi"], { glow: true }),
    T("spacelamp", "Space Lamp", "🪐", 35, 1, 1, "floor", ["scifi"], { glow: true }),
    T("armour", "Knight Armour", "🛡️", 90, 1, 1, "floor", ["castle"]),
    T("banner", "Castle Banner", "🚩", 30, 1, 1, "wall", ["castle"]),
    T("shroom", "Glow Mushroom", "🍄", 40, 1, 1, "floor", ["night"], { glow: true }),
    T("lantern", "Firefly Jar", "🫙", 25, 1, 1, "floor", ["night", "pirate"], { glow: true }),
    T("wheel", "Ship's Wheel", "☸️", 45, 2, 1, "wall", ["pirate"]),
    T("chest", "Treasure Chest", "💰", 75, 2, 1, "floor", ["pirate"]),
    // rare: now and then, one a day
    T("canopy", "Canopy Bed", "👑", 180, 2, 3, "floor", "all", { rare: true }),
    T("rainbow", "Rainbow Rug", "🌈", 150, 3, 3, "rug", "all", { rare: true }),
    T("globe", "Star Globe", "🌟", 200, 1, 1, "floor", "all", { rare: true, glow: true })
  ];
  const BY_ID = Object.fromEntries(CATALOG.map(d => [d.id, d]));
  const inWorld = (d, world) => d.worlds === "all" || d.worlds.includes(world);

  function seeded(str) { let x = 2166136261; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296; }
  /** Today's shop: the basics, 5 things that change every day, and on some days one rare thing. The same for the whole family all day. */
  function shopToday(dayKey, world, householdId = "") {
    const rnd = seeded(`decor|${dayKey}|${world}|${householdId}`);
    const pool = CATALOG.filter(d => !d.basic && !d.rare && inWorld(d, world));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const rot = pool.slice(0, 5).sort((a, b) => a.price - b.price);
    const rares = CATALOG.filter(d => d.rare && inWorld(d, world));
    const rare = rnd() < 0.34 ? [rares[Math.floor(rnd() * rares.length)]] : [];
    return [...CATALOG.filter(d => d.basic), ...rot, ...rare].map(d => d.id);
  }

  /** The tiles a thing covers when turned rot quarter-turns (wall things don't turn). */
  function footprint(d, rot = 0) { return d.kind === "wall" ? { w: d.w, h: 1 } : rot % 2 ? { w: d.h, h: d.w } : { w: d.w, h: d.h }; }
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  /** Can this thing go at x,y turned rot in this room? items: what's already placed ({uid,id,x,y,rot}); skip: a uid to ignore (the thing being moved). */
  function fits(items, id, x, y, rot = 0, skip = null) {
    const d = BY_ID[id]; if (!d || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(rot)) return false;
    const f = footprint(d, rot), box = { x, y: d.kind === "wall" ? 0 : y, ...f };
    if (box.x < 0 || box.y < 0 || box.x + f.w > ROOM.w) return false;
    if (d.kind === "wall") {
      if (y !== 0) return false;
      for (const [x0, w] of [ROOM.door, ROOM.window]) if (hit(box, { x: x0, y: 0, w, h: 1 })) return false;
    } else {
      if (box.y + f.h > ROOM.d || hit(box, ROOM.mat)) return false;
    }
    for (const it of items || []) {
      const o = BY_ID[it.id]; if (!o || it.uid === skip) continue;
      const same = d.kind === "wall" ? o.kind === "wall" : d.kind === "rug" ? o.kind === "rug" : o.kind === "floor";
      if (same && hit(box, { x: it.x, y: o.kind === "wall" ? 0 : it.y, ...footprint(o, it.rot || 0) })) return false;
    }
    return true;
  }
  /** The first spot a thing fits, scanning from the back of the room (or null if the room is full). */
  function freeSpot(items, id, rot = 0) {
    const d = BY_ID[id]; if (!d) return null;
    for (let y = 0; y < (d.kind === "wall" ? 1 : ROOM.d); y++) for (let x = 0; x < ROOM.w; x++) if (fits(items, id, x, y, rot)) return { x, y, rot };
    if (d.kind !== "wall" && d.w !== d.h && rot === 0) return freeSpot(items, id, 1);
    return null;
  }

  return { ROOM, CATALOG, BY_ID, inWorld, shopToday, footprint, fits, freeSpot };
});
