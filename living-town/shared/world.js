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
  const places = {
    square: {
      name: "Town Square", x: 480, y: 320, color: "#d9caa2", quiet: 0.2,
      needs: { social: 9, fun: 3 },
      tags: ["community", "people", "games", "gossip", "school"]
    },
    cafe: {
      name: "Moonbeam Cafe", x: 735, y: 160, color: "#d47f65", quiet: 0.4,
      needs: { hunger: 20, social: 5 },
      tags: ["food", "gossip", "music", "community"]
    },
    park: {
      name: "Juniper Park", x: 215, y: 190, color: "#70a964", quiet: 0.8,
      needs: { fun: 13, energy: 2 },
      tags: ["nature", "animals", "sport", "exploring", "birds", "play"]
    },
    market: {
      name: "Corner Market", x: 730, y: 475, color: "#d2a24c", quiet: 0.3,
      needs: { hunger: 7, fun: 3 },
      tags: ["food", "business", "shopping", "design"]
    },
    workshop: {
      name: "Workshop", x: 225, y: 480, color: "#688eb0", quiet: 0.6,
      needs: { fun: 8 },
      tags: ["tinkering", "art", "teaching", "business", "craft"]
    },
    homes: {
      name: "Maple Apartments", x: 470, y: 520, color: "#a878b5", quiet: 0.9,
      needs: { energy: 16, hunger: 4 },
      tags: ["family", "rest", "stories"]
    }
  };

  const PLACE_RADIUS = 95;

  // Residents a signed-in player may steer. Everyone else is autonomous.
  const PLAYABLE_IDS = ["olive", "hazel", "dad"];

  const DEFAULT_NEEDS = { energy: 82, hunger: 78, social: 72, fun: 75 };

  const residentSeeds = [
    { id: "olive", name: "Olive", color: "#a98cff", x: 430, y: 500 },
    { id: "hazel", name: "Hazel", color: "#f28482", x: 455, y: 520 },
    { id: "dad", name: "Sean", color: "#4fc3a1", x: 505, y: 505 },
    { id: "milo", name: "Milo", color: "#ff9966", x: 720, y: 190 },
    { id: "zara", name: "Zara", color: "#ff6f91", x: 205, y: 210 },
    { id: "finn", name: "Finn", color: "#64b5f6", x: 245, y: 455 },
    { id: "nova", name: "Nova", color: "#ffd166", x: 500, y: 300 }
  ];

  const HAIR_STYLES = ["short", "long", "pigtails", "buns", "curls", "swoop", "bald"];
  const ACCESSORIES = ["none", "bow", "headband", "star", "glasses", "beard"];

  function nearestPlace(x, y) {
    let best = "homes";
    let bestDist = Infinity;
    for (const [key, place] of Object.entries(places)) {
      const dist = Math.hypot(place.x - x, place.y - y);
      if (dist < bestDist) { best = key; bestDist = dist; }
    }
    return { key: best, dist: bestDist };
  }

  return { MAP, places, PLACE_RADIUS, PLAYABLE_IDS, DEFAULT_NEEDS, residentSeeds, HAIR_STYLES, ACCESSORIES, nearestPlace };
});
