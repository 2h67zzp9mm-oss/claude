/**
 * Static world definition shared by the server (CommonJS) and the browser
 * (global `LivingTownWorld`). Keep this file free of Node-only APIs.
 */
(function (root, factory) {
  const world = factory();
  if (typeof module === "object" && module.exports) module.exports = world;
  else root.LivingTownWorld = world;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAP = { width: 960, height: 640, margin: 20 };

  // `tags` describe what a place offers; residents with matching interests
  // are drawn to it. `needs` are hourly restore rates while spending time there.
  // Spot coordinates match the painted town map (960x640 map units).
  const places = {
    square: {
      name: "Town Square", x: 477, y: 330, color: "#d9caa2", quiet: 0.2,
      needs: { social: 9, fun: 3 },
      tags: ["community", "people", "games", "gossip", "school"]
    },
    cafe: {
      name: "Moonbeam Cafe", x: 665, y: 180, color: "#d47f65", quiet: 0.4,
      needs: { hunger: 20, social: 5 },
      tags: ["food", "gossip", "music", "community"]
    },
    park: {
      name: "Juniper Park", x: 240, y: 105, color: "#70a964", quiet: 0.8,
      needs: { fun: 13, energy: 2 },
      tags: ["nature", "animals", "sport", "exploring", "birds", "play"]
    },
    market: {
      name: "Corner Market", x: 800, y: 398, color: "#d2a24c", quiet: 0.3,
      needs: { hunger: 7, fun: 3 },
      tags: ["food", "business", "shopping", "design"]
    },
    workshop: {
      name: "Workshop", x: 228, y: 476, color: "#688eb0", quiet: 0.6,
      needs: { fun: 8 },
      tags: ["tinkering", "art", "teaching", "business", "craft"]
    },
    homes: {
      name: "Home", x: 478, y: 556, color: "#a878b5", quiet: 0.9,
      needs: { energy: 16, hunger: 4 },
      tags: ["family", "rest", "stories"]
    }
  };

  // Walkways painted on the map. Residents travel along these edges so they
  // never cut across roofs, water, or cliffs.
  const walkNodes = {
    square: [477, 330], plazaN: [477, 190], plazaW: [365, 262], plazaE: [600, 262], plazaSW: [375, 318],
    northRoad: [480, 90], parkStairs: [320, 178], parkPath: [290, 145], park: [240, 105],
    cafeStairs: [697, 215], cafe: [665, 180], marketSt: [660, 318], marketLane: [673, 400], market: [800, 398],
    westStairs: [285, 372], workshopPath: [290, 462], workshop: [228, 476], southWest: [293, 575],
    southWalk: [400, 600], homes: [478, 556], homesLow: [487, 600], southWalkE: [600, 600],
    seanHome: [483, 518], miloStairs: [603, 572], miloHome: [608, 520],
    westRoad: [190, 322], finnGate: [128, 300], finnHome: [129, 268], roseHome: [437, 516],
    bigTop: [852, 432]
  };
  const walkEdges = [
    ["square", "plazaW"], ["square", "plazaE"], ["square", "plazaSW"], ["plazaSW", "plazaW"],
    ["plazaN", "plazaW"], ["plazaN", "plazaE"], ["plazaN", "northRoad"],
    ["plazaW", "parkStairs"], ["parkStairs", "parkPath"], ["parkPath", "park"],
    ["plazaE", "cafeStairs"], ["cafeStairs", "cafe"],
    ["plazaE", "marketSt"], ["square", "marketSt"], ["marketSt", "marketLane"], ["marketLane", "market"],
    ["plazaSW", "westStairs"], ["westStairs", "workshopPath"], ["workshopPath", "workshop"],
    ["workshopPath", "southWest"], ["southWest", "southWalk"], ["southWalk", "homes"],
    ["homes", "seanHome"], ["homes", "homesLow"], ["southWalk", "homesLow"], ["homesLow", "southWalkE"],
    ["southWalkE", "miloStairs"], ["miloStairs", "miloHome"],
    ["plazaSW", "westRoad"], ["westRoad", "finnGate"], ["finnGate", "finnHome"], ["homes", "roseHome"], ["market", "bigTop"]
  ];

  // Named buildings: a sign on the map, the walkway node at the door, and
  // who lives there. Everyone's "homes" place resolves to their own house.
  const buildings = [
    { id: "cafe", name: "Moonbeam Cafe", x: 700, y: 72, node: "cafe", place: "cafe" },
    { id: "workshop", name: "Workshop", x: 170, y: 335, node: "workshop", place: "workshop" },
    { id: "market", name: "Corner Market", x: 790, y: 262, node: "market", place: "market" },
    { id: "park", name: "Juniper Park", x: 175, y: 30, node: "park", place: "park" },
    { id: "square", name: "Town Square", x: 477, y: 212, node: "square", place: "square" },
    { id: "roseCottage", name: "Rose Cottage", x: 378, y: 424, node: "roseHome", place: "homes", residents: [] },
    { id: "seanHouse", name: "Sean's House", x: 493, y: 396, node: "seanHome", place: "homes", residents: ["dad", "olive", "hazel"] },
    { id: "miloHouse", name: "Milo & Zara's", x: 648, y: 436, node: "miloHome", place: "homes", residents: ["milo", "zara", "nova"] },
    { id: "finnCottage", name: "Finn's Cottage", x: 130, y: 212, node: "finnHome", place: "homes", residents: ["finn"] },
    // A striped circus tent drawn on the mosaic plaza below the market.
    { id: "bigTop", name: "Big Top", x: 852, y: 368, node: "bigTop", place: "homes", residents: [], tent: { x: 852, y: 432, w: 66, h: 60 } }
  ];

  const homeBuildings = buildings.filter(building => Array.isArray(building.residents));

  // Custom residents (and anyone who moves) get an explicit home assignment
  // that overrides the built-in household lists.
  const homeAssignments = {};
  function setHomeAssignments(map) {
    for (const key of Object.keys(homeAssignments)) delete homeAssignments[key];
    Object.assign(homeAssignments, map || {});
  }

  function homeOf(residentId) {
    const assigned = homeAssignments[residentId];
    if (assigned) return buildings.find(building => building.id === assigned) || null;
    return buildings.find(building => building.residents?.includes(residentId)) || null;
  }

  /** Where a resident stands for a place: their own front door for "homes". */
  function spotFor(residentId, placeKey) {
    const home = placeKey === "homes" ? homeOf(residentId) : null;
    if (home) return { x: walkNodes[home.node][0], y: walkNodes[home.node][1] };
    const place = places[placeKey];
    return place ? { x: place.x, y: place.y } : null;
  }

  const PLACE_RADIUS = 70;

  // Residents a signed-in player may steer. Everyone else is autonomous.
  const PLAYABLE_IDS = ["olive", "hazel", "dad"];

  const DEFAULT_NEEDS = { energy: 82, hunger: 78, social: 72, fun: 75 };

  const residentSeeds = [
    { id: "olive", name: "Olive", color: "#a98cff", x: 462, y: 552 },
    { id: "hazel", name: "Hazel", color: "#f28482", x: 476, y: 560 },
    { id: "dad", name: "Sean", color: "#4fc3a1", x: 492, y: 552 },
    { id: "milo", name: "Milo", color: "#ff9966", x: 470, y: 566 },
    { id: "zara", name: "Zara", color: "#ff6f91", x: 486, y: 568 },
    { id: "finn", name: "Finn", color: "#64b5f6", x: 454, y: 564 },
    { id: "nova", name: "Nova", color: "#ffd166", x: 500, y: 562 }
  ];

  // The last few styles and accessories came with the Big Top troupe.
  const HAIR_STYLES = ["short", "long", "pigtails", "buns", "curls", "swoop", "bald", "bunny", "yarn", "jester", "rook", "ribbons", "robot"];
  const ACCESSORIES = ["none", "bow", "headband", "star", "glasses", "beard", "overalls", "stitches", "ruff", "partyMask"];
  const SKIN_TONES = ["#f6d5bd", "#f2c7a5", "#e0ac86", "#d8a47f", "#c68642", "#a8683c", "#8d5524", "#6f4125"];

  function nearestPlace(x, y) {
    let best = "homes";
    let bestDist = Infinity;
    for (const [key, place] of Object.entries(places)) {
      const dist = Math.hypot(place.x - x, place.y - y);
      if (dist < bestDist) { best = key; bestDist = dist; }
    }
    return { key: best, dist: bestDist };
  }

  const edgeList = walkEdges.map(([a, b]) => [a, b, Math.hypot(walkNodes[a][0] - walkNodes[b][0], walkNodes[a][1] - walkNodes[b][1])]);

  function nearestNodes(x, y, count) {
    return Object.keys(walkNodes)
      .map(id => ({ id, dist: Math.hypot(walkNodes[id][0] - x, walkNodes[id][1] - y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count);
  }

  function shortestFrom(source) {
    const dist = { [source]: 0 };
    const prev = {};
    const open = new Set(Object.keys(walkNodes));
    while (open.size) {
      let best = null;
      for (const id of open) if (dist[id] !== undefined && (best === null || dist[id] < dist[best])) best = id;
      if (best === null) break;
      open.delete(best);
      for (const [a, b, len] of edgeList) {
        const other = a === best ? b : b === best ? a : null;
        if (!other || !open.has(other)) continue;
        if (dist[other] === undefined || dist[best] + len < dist[other]) { dist[other] = dist[best] + len; prev[other] = best; }
      }
    }
    return { dist, prev };
  }
  const shortest = Object.fromEntries(Object.keys(walkNodes).map(id => [id, shortestFrom(id)]));

  /** Waypoints from (fx, fy) to (tx, ty) along the walkways, ending at the target. */
  function route(fx, fy, tx, ty) {
    if (Math.hypot(tx - fx, ty - fy) < 45) return [{ x: tx, y: ty }];
    let best = null;
    for (const start of nearestNodes(fx, fy, 2)) {
      for (const end of nearestNodes(tx, ty, 2)) {
        const along = shortest[start.id].dist[end.id];
        if (along === undefined) continue;
        const total = start.dist + along + end.dist;
        if (!best || total < best.total) best = { total, start: start.id, end: end.id };
      }
    }
    if (!best) return [{ x: tx, y: ty }];
    const ids = [best.end];
    while (ids[0] !== best.start) ids.unshift(shortest[best.start].prev[ids[0]]);
    const points = ids.map(id => ({ x: walkNodes[id][0], y: walkNodes[id][1] }));
    points.push({ x: tx, y: ty });
    return points;
  }

  /** The closest point on any walkway, so taps on roofs or water still work. */
  function snapToWalkable(x, y) {
    let best = { x, y, dist: Infinity };
    for (const [a, b] of walkEdges) {
      const [ax, ay] = walkNodes[a], [bx, by] = walkNodes[b];
      const lenSq = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lenSq));
      const px = ax + t * (bx - ax), py = ay + t * (by - ay);
      const dist = Math.hypot(px - x, py - y);
      if (dist < best.dist) best = { x: px, y: py, dist };
    }
    // Allow standing a little off the path centre line.
    if (best.dist <= 22) return { x, y };
    const k = 18 / best.dist;
    return { x: best.x + (x - best.x) * k, y: best.y + (y - best.y) * k };
  }

  return { MAP, places, walkNodes, walkEdges, buildings, homeBuildings, setHomeAssignments, SKIN_TONES, homeOf, spotFor, route, snapToWalkable, PLACE_RADIUS, PLAYABLE_IDS, DEFAULT_NEEDS, residentSeeds, HAIR_STYLES, ACCESSORIES, nearestPlace };
});
