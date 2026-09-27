"use strict";
/**
 * Personal space: nobody stands on anybody else.
 *
 * When someone picks where to stand at a place, they choose a free spot at
 * least BUBBLE map units from everyone else (where they're standing and
 * where they're heading), anywhere across the place's area rather than
 * piling into the middle. People standing around also mill about now and
 * then, so a place never looks like a frozen pile.
 */

const BUBBLE = 13;

function standing(o) { return { x: Number.isFinite(o.targetX) ? o.targetX : o.x, y: Number.isFinite(o.targetY) ? o.targetY : o.y }; }

function clear(p, others, bubble) {
  return others.every(o => {
    const t = standing(o);
    return Math.hypot(t.x - p.x, t.y - p.y) >= bubble && Math.hypot(o.x - p.x, o.y - p.y) >= bubble;
  });
}

/**
 * A free spot near `center`. `snap` keeps the spot on the walkways, `avoid`
 * lists points to keep away from (building doors), and the spot stays
 * within `placeRadius` so the person is still "at" the place.
 */
function freeSpot(others, center, { spread = 34, placeRadius = 62, snap = p => p, avoid = [], random = Math.random, bubble = BUBBLE } = {}) {
  let fallback = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    // Evenly across the area (not centre-first), widening further the busier it is.
    const radius = spread * Math.sqrt(random()) * (1 + Math.max(0, attempt - 20) / 40);
    const angle = random() * Math.PI * 2;
    const p = snap({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius * 0.6 });
    if (Math.hypot(p.x - center.x, p.y - center.y) > placeRadius) continue;
    if (avoid.some(a => Math.hypot(a.x - p.x, a.y - p.y) < 8)) continue;
    if (!fallback) fallback = p;
    if (clear(p, others, bubble)) return p;
  }
  return fallback || snap({ x: center.x, y: center.y });
}

/** Is this person standing too close to anyone else who's standing still? */
function crowded(self, others, bubble = BUBBLE) {
  return others.some(o => Math.hypot(o.x - self.x, o.y - self.y) < bubble * 0.8 && Math.hypot(standing(o).x - o.x, standing(o).y - o.y) < 1);
}

module.exports = { BUBBLE, freeSpot, crowded };
