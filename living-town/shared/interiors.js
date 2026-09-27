/**
 * House floor plans, shared by the server (CommonJS) and the browser (global
 * `LivingTownInteriors`). Keep this file free of Node-only APIs.
 *
 * Plans are drawn top-down with a 3/4 view on a 192x144 pixel grid: each room
 * is a rectangle whose top WALL pixels are the back wall's face, and whose
 * floor is everything below it. Doorways join rooms, and the front door is
 * on the bottom edge. Furniture has a footprint (x, y, w, h) for drawing and
 * tapping, a `spot` where someone stands to use it, and optional `seats`.
 */
(function (root, factory) {
  const interiors = factory();
  if (typeof module === "object" && module.exports) module.exports = interiors;
  else root.LivingTownInteriors = interiors;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PLAN = { width: 192, height: 144 };
  const WALL = 16;

  // What using each piece of furniture does: activity text and hourly need boosts.
  const furniture = {
    bed: { label: "Bed", activity: "napping in bed", needs: { energy: 30 } },
    sofa: { label: "Sofa", activity: "relaxing on the sofa", needs: { fun: 10, energy: 6 } },
    armchair: { label: "Armchair", activity: "resting in the armchair", needs: { fun: 8, energy: 8 } },
    table: { label: "Table", activity: "sitting at the kitchen table", needs: { hunger: 12, social: 6 } },
    fridge: { label: "Fridge", activity: "grabbing a snack from the fridge", needs: { hunger: 45 } },
    stove: { label: "Stove", activity: "cooking something tasty", needs: { hunger: 30, fun: 6 } },
    bookshelf: { label: "Bookshelf", activity: "reading a book from the shelf", needs: { fun: 14 } },
    desk: { label: "Desk", activity: "drawing at the desk", needs: { fun: 12 } },
    toys: { label: "Toy box", activity: "playing with toys", needs: { fun: 18, social: 3 } },
    rug: { label: "Rug", activity: "playing a board game on the rug", needs: { fun: 16, social: 5 } },
    tv: { label: "Game console", activity: "playing an old game on the TV", needs: { fun: 16 } },
    easel: { label: "Easel", activity: "painting at the easel", needs: { fun: 16 } },
    records: { label: "Record player", activity: "listening to records", needs: { fun: 14, social: 3 } },
    fireplace: { label: "Fireplace", activity: "getting cozy by the fireplace", needs: { energy: 8, fun: 8 } },
    workbench: { label: "Workbench", activity: "building a birdhouse at the workbench", needs: { fun: 14 } },
    // Smaller things around the house.
    chair: { label: "Chair", activity: "sitting at the kitchen table", needs: { hunger: 12, social: 6 }, sit: true },
    sink: { label: "Sink", activity: "getting a glass of water", needs: { hunger: 8 } },
    counter: { label: "Counter", activity: "making a sandwich", needs: { hunger: 35 } },
    fruit: { label: "Fruit bowl", activity: "eating a piece of fruit", needs: { hunger: 25 } },
    herbs: { label: "Herb pots", activity: "watering the herbs", needs: { fun: 6 } },
    wardrobe: { label: "Wardrobe", activity: "picking out a new outfit", needs: { fun: 8 } },
    dresser: { label: "Dresser", activity: "tidying the drawers", needs: { fun: 5 } },
    clothesRack: { label: "Clothes rack", activity: "trying on clothes", needs: { fun: 10 } },
    nightstand: { label: "Bedside lamp", activity: "reading a bedtime story", needs: { fun: 10, energy: 4 } },
    floorLamp: { label: "Reading lamp", activity: "reading by the lamp", needs: { fun: 10 } },
    coffeeTable: { label: "Coffee table", activity: "doing a jigsaw puzzle", needs: { fun: 12, social: 3 } },
    beanbag: { label: "Beanbag", activity: "flopping onto the beanbag", needs: { energy: 10, fun: 6 }, sit: true },
    ball: { label: "Ball", activity: "bouncing a ball", needs: { fun: 14 } },
    plant: { label: "Plant", activity: "watering the plants", needs: { fun: 6 } },
    window: { label: "Window", activity: "looking out of the window", needs: { fun: 6 } },
    picture: { label: "Picture", activity: "looking at a picture on the wall", needs: { fun: 3 } },
    poster: { label: "Poster", activity: "looking at a poster", needs: { fun: 3 } },
    binoculars: { label: "Binoculars", activity: "watching birds through the binoculars", needs: { fun: 14 } },
    birdhouse: { label: "Birdhouse", activity: "painting a little birdhouse", needs: { fun: 12 } },
    logs: { label: "Log pile", activity: "putting a log on the fire", needs: { fun: 4 } },
    console: { label: "Game console", activity: "playing an old game on the TV", needs: { fun: 16 } },
    // The cafe, workshop and market.
    cafeCounter: { label: "Counter", activity: "ordering at the counter", needs: { hunger: 25, social: 5 } },
    coffee: { label: "Hot chocolate machine", activity: "making a hot chocolate", needs: { hunger: 10, fun: 5 } },
    cakes: { label: "Cake case", activity: "choosing a slice of cake", needs: { hunger: 30 } },
    cafeTable: { label: "Cafe table", activity: "sharing a table", needs: { hunger: 8, social: 10 }, sit: true },
    booth: { label: "Booth", activity: "sitting in a cozy booth", needs: { social: 8, fun: 6 }, sit: true },
    piano: { label: "Piano", activity: "playing a tune on the piano", needs: { fun: 16 } },
    toolwall: { label: "Tool wall", activity: "picking a tool off the wall", needs: { fun: 6 } },
    panel: { label: "Control panel", activity: "wiring up a control panel", needs: { fun: 12 } },
    bike: { label: "Bike stand", activity: "fixing a bike", needs: { fun: 14 } },
    lumber: { label: "Wood rack", activity: "sorting the wood", needs: { fun: 6 } },
    paints: { label: "Paint shelf", activity: "mixing paint colors", needs: { fun: 12 } },
    craftTable: { label: "Craft table", activity: "making something at the craft table", needs: { fun: 14, social: 5 }, sit: true },
    orders: { label: "Order desk", activity: "sorting out orders", needs: { fun: 6 } },
    kettle: { label: "Kettle", activity: "making a cup of tea", needs: { hunger: 8, social: 4 } },
    till: { label: "Shop counter", activity: "chatting at the counter", needs: { social: 10 } },
    produce: { label: "Fruit and veg", activity: "picking fresh fruit", needs: { hunger: 20 } },
    groceries: { label: "Shelves", activity: "filling a basket with groceries", needs: { hunger: 15 } },
    flowers: { label: "Flowers", activity: "smelling the flowers", needs: { fun: 8 } },
    sweets: { label: "Sweet jars", activity: "choosing a sweet treat", needs: { hunger: 10, fun: 6 } },
    boxes: { label: "Boxes", activity: "stacking boxes", needs: { fun: 4 } },
    bread: { label: "Bread shelves", activity: "choosing warm bread", needs: { hunger: 25 } },
    // The Big Top.
    ring: { label: "Circus ring", activity: "rehearsing a circus act", needs: { fun: 16, social: 6 } },
    trampoline: { label: "Trampoline", activity: "bouncing on the trampoline", needs: { fun: 18 } },
    trapeze: { label: "Low trapeze", activity: "swinging on the low trapeze", needs: { fun: 16 } },
    juggling: { label: "Juggling pins", activity: "practicing juggling", needs: { fun: 14 } }
  };
  // Furniture you sit on (the rest you stand at).
  for (const kind of ["sofa", "armchair", "table"]) furniture[kind].sit = true;

  // --- Plans ---
  const room = (id, name, x, y, w, h, look) => ({ id, name, x, y, w, h, ...look });
  // Doorways through a back wall (between a room and the one below it) or a side wall.
  const hDoor = (x, rooms, y = 64) => ({ x, y: y - 4, w: 14, h: WALL + 8, rooms, wall: "back" });
  const vDoor = (y, rooms, x = 80) => ({ x: x - 4, y, w: 8, h: 24, rooms, wall: "side" });
  const bed = (id, x, y, owner, opts = {}) => {
    const w = opts.double ? 28 : 16, h = 26;
    return { id, kind: "bed", x, y, w, h, owner, double: Boolean(opts.double), blanket: opts.blanket, pattern: opts.pattern, spot: opts.spot || [x + w + 5, y + 18] };
  };

  // Three bedrooms over a kitchen and a living room. Sean's House and Rose
  // Cottage share this shape; everything personal is in the options.
  function familyHouse(id, looks, owners, extras) {
    return {
      id, ...PLAN,
      rooms: [
        room("room1", looks.names[0], 0, 0, 64, 64, looks.rooms[0]),
        room("room2", looks.names[1], 64, 0, 64, 64, looks.rooms[1]),
        room("room3", looks.names[2], 128, 0, 64, 64, looks.rooms[2]),
        room("kitchen", "Kitchen", 0, 64, 80, 80, looks.kitchen),
        room("living", "Living room", 80, 64, 112, 80, looks.living)
      ],
      doors: [hDoor(6, ["room1", "kitchen"]), hDoor(96, ["room2", "living"]), hDoor(150, ["room3", "living"]), vDoor(100, ["kitchen", "living"])],
      frontDoor: { x: 160, w: 16, room: "living" },
      objects: [
        bed("bed1", 44, 16, owners[0], { ...looks.beds[0], spot: [52, 50] }),
        { id: "desk1", kind: "desk", x: 22, y: 12, w: 20, h: 16, spot: [32, 34], owner: owners[0] },
        bed("bed2", 108, 16, owners[1], { ...looks.beds[1], spot: [100, 36] }),
        { id: "toys", kind: "toys", x: 68, y: 18, w: 18, h: 12, spot: [77, 38] },
        bed("bed3", 168, 16, owners[2], { ...looks.beds[2], spot: [160, 38] }),
        { id: "fridge", kind: "fridge", x: 60, y: 66, w: 14, h: 24, spot: [66, 96] },
        { id: "stove", kind: "stove", x: 42, y: 72, w: 14, h: 14, spot: [49, 94] },
        { id: "table", kind: "table", x: 20, y: 106, w: 28, h: 14, spot: [34, 128], seats: [[14, 116], [54, 116], [34, 128]] },
        { id: "sofa", kind: "sofa", x: 114, y: 78, w: 32, h: 14, spot: [130, 98], seats: [[122, 98], [138, 98]] },
        { id: "bookshelf", kind: "bookshelf", x: 166, y: 66, w: 22, h: 22, spot: [176, 94] },
        { id: "tv", kind: "tv", x: 176, y: 98, w: 14, h: 24, spot: [166, 112] },
        { id: "rug", kind: "rug", x: 104, y: 112, w: 52, h: 22, spot: [130, 130], seats: [[118, 124], [142, 124]] }
      ],
      decor: [
        { kind: "window", x: 6, y: 3, w: 14, h: 10 }, { kind: "window", x: 90, y: 3, w: 14, h: 10 }, { kind: "window", x: 136, y: 3, w: 14, h: 10 },
        { kind: "window", x: 24, y: 67, w: 16, h: 9, curtains: false }, { kind: "window", x: 124, y: 66, w: 12, h: 10 },
        { kind: "counter", x: 22, y: 72, w: 20, h: 14 }, { kind: "sink", x: 27, y: 73, w: 10, h: 6 },
        { kind: "chair", x: 10, y: 110, w: 6, h: 8 }, { kind: "chair", x: 52, y: 110, w: 6, h: 8 }, { kind: "fruit", x: 30, y: 107, w: 7, h: 4 },
        { kind: "coffeeTable", x: 120, y: 103, w: 20, h: 7 }, { kind: "floorLamp", x: 88, y: 76, w: 6, h: 16, light: true },
        { kind: "plant", x: 84, y: 124, w: 8, h: 12 }, { kind: "plant", x: 4, y: 128, w: 8, h: 12 },
        { kind: "nightstand", x: 128 + 2, y: 20, w: 10, h: 8, lamp: true }, { kind: "dresser", x: 130, y: 36, w: 14, h: 12 },
        ...extras
      ],
      entrance: [168, 134]
    };
  }

  const plans = {
    seanHouse: familyHouse("seanHouse", {
      names: ["Olive's room", "Hazel's room", "Sean's room"],
      rooms: [
        { wall: "#6f93bf", wallTrim: "#4d6f99", pattern: "stars", floor: "carpet", floorColor: "#9c89b8" },
        { wall: "#ffc98b", wallTrim: "#e39b53", pattern: "dots", floor: "carpet", floorColor: "#f4a7bb" },
        { wall: "#8fae8b", wallTrim: "#62805f", pattern: "stripes", floor: "wood", floorColor: "#a8794f" }
      ],
      kitchen: { wall: "#f1dfae", wallTrim: "#c9ae6f", pattern: "tiles", floor: "tile", floorColor: "#e8e0cc" },
      living: { wall: "#5d7fa8", wallTrim: "#3f5d82", pattern: "stripes", floor: "wood", floorColor: "#b98a5a" },
      beds: [{ blanket: "#a98cff", pattern: "stars" }, { blanket: "#f28482", pattern: "dots" }, { blanket: "#4fc3a1", pattern: "plaid" }]
    }, ["olive", "hazel", "dad"], [
      { kind: "poster", x: 24, y: 2, w: 12, h: 9, art: "map" }, { kind: "fairyLights", x: 2, y: 1, w: 60, h: 3, light: true },
      { kind: "poster", x: 68, y: 3, w: 12, h: 9, art: "duck" }, { kind: "ball", x: 90, y: 50, w: 6, h: 6 }, { kind: "nightlight", x: 118, y: 44, w: 4, h: 4, light: true },
      { kind: "picture", x: 170, y: 3, w: 12, h: 9, art: "kids" }, { kind: "console", x: 176, y: 120, w: 8, h: 4 }
    ]),
    roseCottage: familyHouse("roseCottage", {
      names: ["Front bedroom", "Middle bedroom", "Back bedroom"],
      rooms: [
        { wall: "#e8a0b4", wallTrim: "#c47a90", pattern: "dots", floor: "carpet", floorColor: "#cdb4db" },
        { wall: "#a8dadc", wallTrim: "#6fa8ab", pattern: "stripes", floor: "carpet", floorColor: "#bde0fe" },
        { wall: "#f6d6ad", wallTrim: "#d0a878", pattern: "stars", floor: "wood", floorColor: "#c89f7a" }
      ],
      kitchen: { wall: "#fbeec1", wallTrim: "#d8c188", pattern: "tiles", floor: "tile", floorColor: "#efe6d2" },
      living: { wall: "#e8a0b4", wallTrim: "#c47a90", pattern: "stripes", floor: "wood", floorColor: "#c89f7a" },
      beds: [{ blanket: "#ffafcc", pattern: "dots" }, { blanket: "#bde0fe", pattern: "stripes" }, { blanket: "#cdb4db", pattern: "stars" }]
    }, [null, null, null], [
      { kind: "picture", x: 24, y: 2, w: 12, h: 9, art: "flower" }, { kind: "picture", x: 170, y: 3, w: 12, h: 9, art: "flower" }
    ]),

    miloHouse: {
      id: "miloHouse", ...PLAN,
      rooms: [
        room("bedroom", "Milo & Zara's room", 0, 0, 96, 64, { wall: "#e0a458", wallTrim: "#b97d3a", pattern: "stripes", floor: "wood", floorColor: "#8a5a3b" }),
        room("nova", "Nova's room", 96, 0, 96, 64, { wall: "#7a6bd1", wallTrim: "#5446a6", pattern: "stars", floor: "carpet", floorColor: "#f2c14e" }),
        room("kitchen", "Kitchen", 0, 64, 96, 80, { wall: "#f4d58d", wallTrim: "#c9a24f", pattern: "tiles", floor: "tile", floorColor: "#e7dcc6" }),
        room("living", "Living room", 96, 64, 96, 80, { wall: "#6a994e", wallTrim: "#4a7236", pattern: "stripes", floor: "wood", floorColor: "#9a6a45" })
      ],
      doors: [hDoor(78, ["bedroom", "kitchen"]), hDoor(140, ["nova", "living"]), vDoor(100, ["kitchen", "living"], 96)],
      frontDoor: { x: 156, w: 16, room: "living" },
      objects: [
        bed("bed1", 34, 16, ["milo", "zara"], { double: true, blanket: "#ff9966", pattern: "plaid", spot: [48, 50] }),
        bed("bed2", 172, 16, "nova", { blanket: "#ffd166", pattern: "stars", spot: [164, 38] }),
        { id: "desk1", kind: "desk", x: 100, y: 12, w: 22, h: 16, spot: [111, 34], owner: "nova" },
        { id: "stove", kind: "stove", x: 30, y: 72, w: 14, h: 14, spot: [37, 94] },
        { id: "fridge", kind: "fridge", x: 60, y: 66, w: 14, h: 24, spot: [67, 96] },
        { id: "table", kind: "table", x: 20, y: 106, w: 36, h: 14, spot: [38, 128], seats: [[14, 116], [62, 116], [38, 128]] },
        { id: "sofa", kind: "sofa", x: 106, y: 78, w: 32, h: 14, spot: [122, 98], seats: [[114, 98], [130, 98]] },
        { id: "records", kind: "records", x: 160, y: 70, w: 16, h: 16, spot: [168, 94] },
        { id: "easel", kind: "easel", x: 176, y: 100, w: 14, h: 22, spot: [168, 118] },
        { id: "rug", kind: "rug", x: 104, y: 110, w: 44, h: 22, spot: [126, 128], seats: [[114, 122], [138, 122]] }
      ],
      decor: [
        { kind: "window", x: 78, y: 3, w: 14, h: 10 }, { kind: "window", x: 150, y: 3, w: 14, h: 10 },
        { kind: "window", x: 6, y: 67, w: 14, h: 9, curtains: false }, { kind: "window", x: 114, y: 66, w: 14, h: 10 },
        { kind: "wardrobe", x: 4, y: 8, w: 18, h: 24 }, { kind: "nightstand", x: 22, y: 22, w: 10, h: 8, lamp: true }, { kind: "nightstand", x: 64, y: 22, w: 10, h: 8, lamp: true },
        { kind: "picture", x: 40, y: 2, w: 16, h: 10, art: "painting" },
        { kind: "poster", x: 128, y: 3, w: 12, h: 9, art: "stars" }, { kind: "beanbag", x: 130, y: 36, w: 14, h: 10 }, { kind: "clothesRack", x: 150, y: 24, w: 16, h: 14 },
        { kind: "counter", x: 2, y: 72, w: 28, h: 14 }, { kind: "sink", x: 10, y: 73, w: 10, h: 6 }, { kind: "counter", x: 44, y: 72, w: 14, h: 14 }, { kind: "herbs", x: 46, y: 70, w: 10, h: 4 },
        { kind: "chair", x: 10, y: 110, w: 6, h: 8 }, { kind: "chair", x: 58, y: 110, w: 6, h: 8 }, { kind: "fruit", x: 34, y: 107, w: 7, h: 4 },
        { kind: "coffeeTable", x: 112, y: 103, w: 20, h: 7 }, { kind: "floorLamp", x: 99, y: 76, w: 6, h: 16, light: true },
        { kind: "plant", x: 98, y: 126, w: 8, h: 12 }, { kind: "plant", x: 82, y: 126, w: 8, h: 12 }, { kind: "picture", x: 176, y: 67, w: 12, h: 9, art: "painting" }
      ],
      entrance: [164, 134]
    },

    finnCottage: {
      id: "finnCottage", ...PLAN,
      rooms: [
        room("bedroom", "Finn's room", 0, 0, 80, 64, { wall: "#8a6f4d", wallTrim: "#6b5236", pattern: "stripes", floor: "wood", floorColor: "#6e4b2e" }),
        room("study", "Workroom", 80, 0, 112, 64, { wall: "#7e8f6a", wallTrim: "#5b6b49", pattern: "planks", floor: "wood", floorColor: "#7a5534" }),
        room("main", "Kitchen & sitting room", 0, 64, 192, 80, { wall: "#c9a877", wallTrim: "#9c7c4c", pattern: "stone", floor: "wood", floorColor: "#8a5f3a" })
      ],
      doors: [hDoor(60, ["bedroom", "main"]), hDoor(92, ["study", "main"])],
      frontDoor: { x: 84, w: 16, room: "main" },
      objects: [
        bed("bed1", 30, 16, "finn", { blanket: "#64b5f6", pattern: "plaid", spot: [22, 38] }),
        { id: "workbench", kind: "workbench", x: 110, y: 12, w: 36, h: 16, spot: [128, 36] },
        { id: "bookshelf", kind: "bookshelf", x: 150, y: 6, w: 18, h: 24, spot: [159, 36] },
        bed("bed2", 172, 30, null, { blanket: "#c9ada7", pattern: "stripes", spot: [164, 52] }),
        { id: "fireplace", kind: "fireplace", x: 8, y: 66, w: 26, h: 24, spot: [21, 98] },
        { id: "armchair", kind: "armchair", x: 38, y: 90, w: 16, h: 14, spot: [46, 110], seats: [[46, 108]] },
        { id: "stove", kind: "stove", x: 144, y: 72, w: 14, h: 14, spot: [151, 94] },
        { id: "fridge", kind: "fridge", x: 162, y: 66, w: 14, h: 24, spot: [169, 96] },
        { id: "table", kind: "table", x: 120, y: 108, w: 30, h: 14, spot: [135, 130], seats: [[114, 118], [156, 118], [135, 130]] },
        { id: "rug", kind: "rug", x: 14, y: 112, w: 50, h: 22, spot: [39, 130], seats: [[28, 124], [50, 124]] }
      ],
      decor: [
        { kind: "window", x: 60, y: 3, w: 14, h: 10 }, { kind: "window", x: 90, y: 3, w: 14, h: 10, feeder: true },
        { kind: "window", x: 116, y: 67, w: 14, h: 9, curtains: false }, { kind: "window", x: 178, y: 66, w: 12, h: 10 },
        { kind: "wardrobe", x: 4, y: 8, w: 18, h: 24 }, { kind: "nightstand", x: 50, y: 22, w: 10, h: 8, lamp: true },
        { kind: "birdhouse", x: 116, y: 10, w: 7, h: 7 }, { kind: "birdhouse", x: 132, y: 11, w: 7, h: 7 }, { kind: "binoculars", x: 94, y: 13, w: 6, h: 4 },
        { kind: "counter", x: 110, y: 72, w: 34, h: 14 }, { kind: "sink", x: 118, y: 73, w: 10, h: 6 },
        { kind: "chair", x: 110, y: 112, w: 6, h: 8 }, { kind: "chair", x: 152, y: 112, w: 6, h: 8 }, { kind: "fruit", x: 131, y: 109, w: 7, h: 4 },
        { kind: "floorLamp", x: 78, y: 76, w: 6, h: 16, light: true }, { kind: "logs", x: 36, y: 78, w: 10, h: 8 },
        { kind: "plant", x: 180, y: 126, w: 8, h: 12 }, { kind: "picture", x: 40, y: 67, w: 14, h: 9, art: "bird" }
      ],
      entrance: [92, 134]
    },

    // The Big Top troupe's striped tent: two bunk wagons, a practice ring
    // and a kitchen wagon.
    bigTop: {
      id: "bigTop", ...PLAN,
      activities: [[/rehears|circus act/, "ring"], [/juggl/, "juggling"], [/trampoline|bounc/, "trampoline"]],
      rooms: [
        room("bunks1", "Bunk wagon", 0, 0, 96, 64, { wall: "#d64545", wallTrim: "#f1e6cc", pattern: "stripes", floor: "wood", floorColor: "#a8794f" }),
        room("bunks2", "Bunk wagon", 96, 0, 96, 64, { wall: "#3d6fb6", wallTrim: "#f1e6cc", pattern: "stripes", floor: "wood", floorColor: "#a8794f" }),
        room("ring", "The ring", 0, 64, 128, 80, { wall: "#6c3483", wallTrim: "#f2c14e", pattern: "stars", floor: "carpet", floorColor: "#d9b77a" }),
        room("kitchen", "Kitchen wagon", 128, 64, 64, 80, { wall: "#f4d58d", wallTrim: "#c9a24f", pattern: "tiles", floor: "tile", floorColor: "#e7dcc6" })
      ],
      doors: [hDoor(40, ["bunks1", "ring"]), hDoor(117, ["bunks2", "ring"]), vDoor(100, ["ring", "kitchen"], 128)],
      frontDoor: { x: 56, w: 16, room: "ring" },
      objects: [
        bed("bed1", 6, 16, "t-plum", { blanket: "#f28c28", pattern: "stripes" }),
        bed("bed2", 36, 16, "t-tumble", { blanket: "#2e7d32", pattern: "stars" }),
        bed("bed3", 66, 16, "t-bolt", { blanket: "#4a90d9", pattern: "plaid" }),
        bed("bed4", 102, 16, "t-patches", { blanket: "#7fd1b9", pattern: "dots" }),
        bed("bed5", 134, 16, "t-rook", { blanket: "#cfc9bb", pattern: "plaid" }),
        bed("bed6", 164, 16, "t-ribbons", { blanket: "#ff6f91", pattern: "stars", spot: [158, 50] }),
        { id: "ring", kind: "ring", x: 36, y: 96, w: 72, h: 36, spot: [72, 126], seats: [[50, 116], [94, 116]] },
        { id: "juggling", kind: "juggling", x: 64, y: 104, w: 16, h: 10, spot: [72, 118] },
        { id: "trampoline", kind: "trampoline", x: 6, y: 84, w: 22, h: 12, spot: [17, 104] },
        { id: "trapeze", kind: "trapeze", x: 80, y: 66, w: 20, h: 24, spot: [90, 96] },
        { id: "sofa", kind: "sofa", x: 4, y: 112, w: 28, h: 14, spot: [18, 132], seats: [[12, 132], [24, 132]] },
        { id: "stove", kind: "stove", x: 132, y: 72, w: 14, h: 14, spot: [139, 94] },
        { id: "fridge", kind: "fridge", x: 172, y: 66, w: 14, h: 24, spot: [179, 96] },
        { id: "table", kind: "table", x: 140, y: 110, w: 28, h: 12, spot: [154, 130], seats: [[136, 118], [174, 118], [154, 130]] }
      ],
      decor: [
        { kind: "window", x: 50, y: 3, w: 12, h: 10 }, { kind: "window", x: 150, y: 3, w: 12, h: 10 },
        { kind: "poster", x: 20, y: 66, w: 16, h: 11, art: "stars" }, { kind: "picture", x: 102, y: 66, w: 12, h: 10, art: "painting" },
        { kind: "counter", x: 146, y: 72, w: 24, h: 14 }, { kind: "sink", x: 152, y: 73, w: 10, h: 6 },
        { kind: "clothesRack", x: 26, y: 40, w: 16, h: 14 }, { kind: "fairyLights", x: 56, y: 65, w: 22, h: 3, light: true },
        { kind: "nightlight", x: 90, y: 50, w: 4, h: 4, light: true }, { kind: "plant", x: 180, y: 126, w: 8, h: 12 }
      ],
      entrance: [64, 134]
    },

    // --- Public buildings ---
    // `inside` says which activities happen indoors (the rest stay on the
    // map), and `activities` sends each one to the right spot; "staff"
    // stands behind the counter or at the bench.
    cafe: {
      id: "cafe", ...PLAN, public: true,
      inside: /cafe counter|special|radio|booth|notebook/,
      activities: [[/cafe counter/, "counter", "staff"], [/special|something to eat/, "cakes"], [/radio/, "radio"], [/booth|sketch/, "booth"], [/notebook|news|coffee/, "cafeTable1"]],
      rooms: [
        room("kitchen", "Kitchen", 0, 0, 112, 60, { wall: "#f4d58d", wallTrim: "#c9a24f", pattern: "tiles", floor: "tile", floorColor: "#e7dcc6" }),
        room("office", "Milo's office", 112, 0, 80, 60, { wall: "#a3c4bc", wallTrim: "#6f948b", pattern: "stripes", floor: "wood", floorColor: "#8a5f3a" }),
        room("cafe", "Moonbeam Cafe", 0, 60, 192, 84, { wall: "#2f4858", wallTrim: "#e0a458", pattern: "stars", floor: "wood", floorColor: "#9a6a45" })
      ],
      doors: [hDoor(20, ["kitchen", "cafe"], 60), hDoor(160, ["office", "cafe"], 60)],
      frontDoor: { x: 88, w: 16, room: "cafe" },
      objects: [
        { id: "counter", kind: "cafeCounter", x: 14, y: 90, w: 56, h: 12, spot: [42, 110], staff: [42, 86] },
        { id: "cakes", kind: "cakes", x: 70, y: 88, w: 26, h: 14, spot: [83, 110] },
        { id: "coffee", kind: "coffee", x: 42, y: 64, w: 14, h: 18, spot: [49, 86] },
        { id: "radio", kind: "records", x: 100, y: 66, w: 14, h: 14, spot: [107, 86] },
        { id: "cafeTable1", kind: "cafeTable", x: 118, y: 92, w: 16, h: 10, spot: [112, 102], seats: [[112, 102], [140, 102]] },
        { id: "cafeTable2", kind: "cafeTable", x: 146, y: 114, w: 16, h: 10, spot: [140, 124], seats: [[140, 124], [168, 124]] },
        { id: "cafeTable3", kind: "cafeTable", x: 112, y: 122, w: 16, h: 10, spot: [134, 132], seats: [[134, 132], [108, 116]] },
        { id: "booth", kind: "booth", x: 162, y: 80, w: 26, h: 16, spot: [175, 100], seats: [[168, 100], [182, 100]] },
        { id: "piano", kind: "piano", x: 4, y: 108, w: 24, h: 16, spot: [16, 130] },
        { id: "stove", kind: "stove", x: 40, y: 8, w: 14, h: 14, spot: [47, 30] },
        { id: "fridge", kind: "fridge", x: 92, y: 2, w: 14, h: 24, spot: [99, 32] },
        { id: "desk1", kind: "desk", x: 118, y: 10, w: 22, h: 16, spot: [129, 32] },
        { id: "bookshelf", kind: "bookshelf", x: 168, y: 4, w: 18, h: 24, spot: [177, 34] },
        { id: "armchair", kind: "armchair", x: 144, y: 30, w: 16, h: 14, spot: [152, 50], seats: [[152, 48]] }
      ],
      decor: [
        { kind: "counter", x: 56, y: 8, w: 34, h: 14 }, { kind: "sink", x: 64, y: 9, w: 10, h: 6 }, { kind: "counter", x: 4, y: 8, w: 36, h: 14 },
        { kind: "sacks", x: 6, y: 40, w: 14, h: 12 }, { kind: "window", x: 18, y: 3, w: 14, h: 10, curtains: false },
        { kind: "window", x: 150, y: 3, w: 12, h: 10 }, { kind: "window", x: 124, y: 64, w: 16, h: 10 }, { kind: "window", x: 177, y: 64, w: 12, h: 10 },
        { kind: "poster", x: 66, y: 63, w: 18, h: 11, art: "menu" }, { kind: "picture", x: 8, y: 63, w: 12, h: 10, art: "moon" },
        { kind: "plant", x: 180, y: 126, w: 8, h: 12 }, { kind: "plant", x: 70, y: 126, w: 8, h: 12 },
        { kind: "floorLamp", x: 150, y: 76, w: 6, h: 16, light: true }
      ],
      entrance: [96, 134]
    },

    workshop: {
      id: "workshop", ...PLAN, public: true,
      inside: /Sean's Systems|control panel|studio class|taking apart|planing|paint|orders|shop trick/,
      activities: [[/Sean's Systems|taking apart|shop trick/, "workbench1", "staff"], [/control panel/, "panel", "staff"], [/studio class/, "craftTable", "staff"], [/planing/, "workbench2"], [/paint/, "paints"], [/orders/, "orders"]],
      rooms: [
        room("shop", "Workshop", 0, 0, 120, 144, { wall: "#7d8b99", wallTrim: "#56626f", pattern: "planks", floor: "tile", floorColor: "#b8b2a7" }),
        room("studio", "Zara's studio", 120, 0, 72, 80, { wall: "#e8d5b7", wallTrim: "#c4a882", pattern: "dots", floor: "wood", floorColor: "#c9a877" }),
        room("office", "Order office", 120, 80, 72, 64, { wall: "#dfe7ea", wallTrim: "#a9b8bf", pattern: "stripes", floor: "carpet", floorColor: "#6d8a96" })
      ],
      doors: [vDoor(40, ["shop", "studio"], 120), vDoor(108, ["shop", "office"], 120)],
      frontDoor: { x: 52, w: 16, room: "shop" },
      objects: [
        { id: "workbench1", kind: "workbench", x: 6, y: 22, w: 36, h: 16, spot: [24, 46], staff: [24, 44] },
        { id: "workbench2", kind: "workbench", x: 54, y: 22, w: 36, h: 16, spot: [72, 46] },
        { id: "toolwall", kind: "toolwall", x: 8, y: 3, w: 40, h: 12, spot: [28, 22], hanging: true },
        { id: "panel", kind: "panel", x: 98, y: 4, w: 16, h: 22, spot: [106, 32], staff: [104, 32] },
        { id: "bike", kind: "bike", x: 8, y: 70, w: 26, h: 16, spot: [21, 94] },
        { id: "lumber", kind: "lumber", x: 96, y: 60, w: 18, h: 40, spot: [86, 82] },
        { id: "paints", kind: "paints", x: 124, y: 4, w: 22, h: 20, spot: [135, 32] },
        { id: "easel1", kind: "easel", x: 152, y: 24, w: 14, h: 22, spot: [159, 52] },
        { id: "easel2", kind: "easel", x: 172, y: 24, w: 14, h: 22, spot: [179, 52] },
        { id: "craftTable", kind: "craftTable", x: 134, y: 56, w: 32, h: 10, spot: [150, 72], seats: [[130, 70], [170, 70]], staff: [150, 72] },
        { id: "orders", kind: "orders", x: 126, y: 88, w: 24, h: 16, spot: [138, 112] },
        { id: "kettle", kind: "kettle", x: 170, y: 88, w: 14, h: 12, spot: [177, 108] },
        { id: "armchair", kind: "armchair", x: 168, y: 118, w: 16, h: 14, spot: [176, 138], seats: [[176, 136]] }
      ],
      decor: [
        { kind: "window", x: 60, y: 3, w: 14, h: 10, curtains: false }, { kind: "window", x: 164, y: 3, w: 14, h: 10 }, { kind: "window", x: 156, y: 83, w: 10, h: 9 },
        { kind: "crates", x: 60, y: 100, w: 20, h: 14 }, { kind: "sawhorse", x: 44, y: 70, w: 22, h: 10 },
        { kind: "floorLamp", x: 44, y: 22, w: 6, h: 16, light: true }, { kind: "plant", x: 124, y: 126, w: 8, h: 12 }, { kind: "picture", x: 132, y: 83, w: 12, h: 9, art: "painting" }
      ],
      entrance: [60, 134]
    },

    market: {
      id: "market", ...PLAN, public: true,
      inside: /market floor|rearranging|shopping at the market/,
      activities: [[/market floor/, "till", "staff"], [/rearranging/, "island"], [/shopping at the market/, "groceries"]],
      rooms: [
        room("shop", "Corner Market", 0, 0, 136, 144, { wall: "#b5d99c", wallTrim: "#7fa866", pattern: "stripes", floor: "tile", floorColor: "#efe6d2" }),
        room("store", "Storeroom", 136, 0, 56, 72, { wall: "#b7a58c", wallTrim: "#8c7a60", pattern: "planks", floor: "wood", floorColor: "#8a6440" }),
        room("bakery", "Bread corner", 136, 72, 56, 72, { wall: "#f6d6ad", wallTrim: "#d0a878", pattern: "tiles", floor: "tile", floorColor: "#f3e9d8" })
      ],
      doors: [vDoor(34, ["shop", "store"], 136), vDoor(104, ["shop", "bakery"], 136)],
      frontDoor: { x: 60, w: 16, room: "shop" },
      objects: [
        { id: "till", kind: "till", x: 90, y: 108, w: 32, h: 12, spot: [106, 128], staff: [106, 104] },
        { id: "produce", kind: "produce", x: 6, y: 22, w: 18, h: 52, spot: [32, 48] },
        { id: "groceries", kind: "groceries", x: 36, y: 4, w: 44, h: 18, spot: [58, 30] },
        { id: "island", kind: "groceries", x: 42, y: 52, w: 40, h: 12, spot: [62, 72] },
        { id: "sweets", kind: "sweets", x: 94, y: 22, w: 16, h: 14, spot: [102, 44] },
        { id: "flowers", kind: "flowers", x: 6, y: 92, w: 22, h: 14, spot: [17, 114] },
        { id: "boxes", kind: "boxes", x: 150, y: 22, w: 30, h: 20, spot: [165, 50] },
        { id: "bread", kind: "bread", x: 146, y: 74, w: 38, h: 16, spot: [165, 100] },
        { id: "chair1", kind: "chair", x: 170, y: 118, w: 6, h: 8, spot: [173, 126] }
      ],
      decor: [
        { kind: "window", x: 84, y: 3, w: 14, h: 10 }, { kind: "window", x: 112, y: 3, w: 14, h: 10 },
        { kind: "poster", x: 16, y: 3, w: 14, h: 10, art: "flower" }, { kind: "baskets", x: 90, y: 128, w: 14, h: 8 },
        { kind: "plant", x: 120, y: 126, w: 8, h: 12 }
      ],
      entrance: [68, 134]
    }
  };

  function planFor(buildingId) { return plans[buildingId] || null; }

  /** Is this activity one that happens indoors? Always true at home. */
  function indoorActivity(plan, activity) { return !plan.public || plan.inside.test(String(activity || "")); }

  /**
   * Where someone is: the one building they're inside, or null when they're
   * out on the map. The map, every interior and the building signs all ask
   * this, so nobody can be in two places at once. Inside means they've
   * arrived and are either at home, doing something indoors at the cafe,
   * workshop or market, or standing right at its door (a player walking in).
   */
  function locate(r, world) {
    if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)) return null;
    const b = r.place === "homes" ? world.homeOf(r.id) : world.buildings.find(x => x.place === r.place && !x.residents && plans[x.id]);
    if (!b || !plans[b.id]) return null;
    if (Math.hypot((r.targetX ?? r.x) - r.x, (r.targetY ?? r.y) - r.y) >= 3) return null;
    if (b.residents) return b;
    const [doorX, doorY] = world.walkNodes[b.node];
    return r.indoor || indoorActivity(plans[b.id], r.activity) || Math.hypot(r.x - doorX, r.y - doorY) < 3 ? b : null;
  }

  // --- Geometry ---
  const inRect = (x, y, r, pad = 0) => x >= r.x + pad && x <= r.x + r.w - pad && y >= r.y + pad && y <= r.y + r.h - pad;

  /** The walkable part of a room: below the back wall, inside the side walls. */
  function floorOf(r) { return { x: r.x + 4, y: r.y + WALL + 4, w: r.w - 8, h: r.h - WALL - 8 }; }

  function frontDoorRect(plan) { return { x: plan.frontDoor.x, y: plan.height - 10, w: plan.frontDoor.w, h: 10 }; }

  function isWalkable(plan, x, y) {
    return plan.rooms.some(r => inRect(x, y, floorOf(r))) || plan.doors.some(d => inRect(x, y, d)) || inRect(x, y, frontDoorRect(plan));
  }

  function roomAt(plan, x, y) {
    const inside = plan.rooms.find(r => inRect(x, y, r));
    if (inside) return inside.id;
    const door = plan.doors.find(d => inRect(x, y, d));
    return door ? door.rooms[0] : null;
  }

  /** The nearest walkable point: taps on walls and furniture still work. */
  function snapInside(plan, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: plan.entrance[0], y: plan.entrance[1] };
    if (isWalkable(plan, x, y)) return { x, y };
    let best = null;
    for (const r of plan.rooms) {
      const f = floorOf(r);
      const px = Math.max(f.x, Math.min(f.x + f.w, x)), py = Math.max(f.y, Math.min(f.y + f.h, y));
      const d = Math.hypot(px - x, py - y);
      if (!best || d < best.d) best = { x: px, y: py, d };
    }
    return { x: best.x, y: best.y };
  }

  function doorCenter(d) { return { x: d.x + d.w / 2, y: d.y + d.h / 2 }; }

  /** Waypoints from one point to another, through doorways between rooms. */
  function routeInside(plan, from, to) {
    const start = roomAt(plan, from.x, from.y), goal = roomAt(plan, to.x, to.y);
    if (!start || !goal || start === goal) return [{ x: to.x, y: to.y }];
    const prev = { [start]: null };
    const queue = [start];
    while (queue.length) {
      const here = queue.shift();
      if (here === goal) break;
      for (const d of plan.doors) {
        if (!d.rooms.includes(here)) continue;
        const next = d.rooms[0] === here ? d.rooms[1] : d.rooms[0];
        if (next in prev) continue;
        prev[next] = { room: here, door: d };
        queue.push(next);
      }
    }
    if (!(goal in prev)) return [{ x: to.x, y: to.y }];
    const points = [{ x: to.x, y: to.y }];
    for (let at = goal; prev[at]; at = prev[at].room) {
      // Step through the doorway: approach from one side, leave from the other.
      const door = prev[at].door;
      points.unshift(...roomOrder(plan, prev[at].room, at, doorCenter(door), door.wall === "side"));
    }
    return points;
  }

  // Two points either side of a doorway, ordered from the `from` room to the `to` room.
  function roomOrder(plan, fromRoom, toRoom, c, vertical) {
    const a = plan.rooms.find(r => r.id === fromRoom), b = plan.rooms.find(r => r.id === toRoom);
    if (vertical) {
      const leftFirst = a.x < b.x;
      return leftFirst ? [{ x: c.x - 8, y: c.y }, { x: c.x + 8, y: c.y }] : [{ x: c.x + 8, y: c.y }, { x: c.x - 8, y: c.y }];
    }
    // Horizontal walls: the upper room's floor ends at the wall; the lower
    // room's floor starts below its wall face.
    const upperFirst = a.y < b.y;
    const top = { x: c.x, y: c.y - 14 }, bottom = { x: c.x, y: c.y + 14 };
    return upperFirst ? [top, bottom] : [bottom, top];
  }

  // --- Who goes where ---
  const ownerList = o => (Array.isArray(o.owner) ? o.owner : o.owner ? [o.owner] : []);
  const capacity = o => (o.double ? 2 : 1);

  /** Beds for a household: own beds first, then spare beds in order. */
  function assignBeds(plan, householdIds) {
    const beds = plan.objects.filter(o => o.kind === "bed");
    const result = new Map();
    const used = new Map(beds.map(b => [b.id, 0]));
    for (const id of householdIds) {
      const own = beds.find(b => ownerList(b).includes(id));
      if (own) { result.set(id, { bed: own, slot: ownerList(own).indexOf(id) }); used.set(own.id, used.get(own.id) + 1); }
    }
    for (const id of householdIds) {
      if (result.has(id)) continue;
      const spare = beds.find(b => !ownerList(b).length && used.get(b.id) < capacity(b)) ||
        beds.find(b => used.get(b.id) < capacity(b) && ownerList(b).every(owner => !householdIds.includes(owner)));
      if (spare) { result.set(id, { bed: spare, slot: used.get(spare.id) }); used.set(spare.id, used.get(spare.id) + 1); }
    }
    return result;
  }

  /** The room a resident thinks of as theirs: where their bed is. */
  function ownRoomOf(plan, beds, id) {
    const b = beds.get(id)?.bed;
    return b ? plan.rooms.find(r => inRect(b.x + b.w / 2, b.y + b.h / 2, r)) : null;
  }

  // Everyday activities at home, mapped to the furniture that fits them.
  const activityKinds = [
    [/cook|recipe|bak/, ["stove"]], [/snack|fridge/, ["fridge"]],
    [/family|eat|breakfast|lunch|dinner|table/, ["table"]],
    [/couch|sofa/, ["sofa", "armchair"]], [/read|book|stor/, ["bookshelf", "armchair", "sofa"]],
    [/old game|console|tv/, ["tv", "rug"]], [/board game|game|rug/, ["rug"]],
    [/toy|play/, ["toys", "rug"]], [/paint|easel/, ["easel", "desk"]], [/draw|sketch|map/, ["desk", "table"]],
    [/record|music|jazz/, ["records", "sofa"]], [/birdhouse|workbench|tinker|fix|build/, ["workbench", "desk"]],
    [/fire/, ["fireplace", "armchair"]], [/armchair/, ["armchair", "sofa"]]
  ];

  /**
   * Where everyone at home is, as a Map of id -> { x, y, objectId, bed, slot }.
   * Deterministic, so every phone draws the same scene. `occupants` are
   * { id, asleep, activity, indoor } in household order.
   */
  function placeHousehold(plan, occupants, householdIds) {
    const beds = assignBeds(plan, householdIds || occupants.map(o => o.id));
    const byId = id => plan.objects.find(o => o.id === id);
    const taken = new Map();
    const seatAt = object => {
      const n = taken.get(object.id) || 0;
      taken.set(object.id, n + 1);
      const seats = object.seats || [object.spot];
      const [x, y] = seats[n % seats.length];
      // Past the last seat, stand a little to the side.
      return { x: x + Math.floor(n / seats.length) * 8, y, objectId: object.id };
    };
    const result = new Map();
    for (const o of occupants) {
      const mine = beds.get(o.id);
      if (o.indoor && Number.isFinite(o.indoor.x) && Number.isFinite(o.indoor.y)) {
        const object = o.indoor.objectId ? byId(o.indoor.objectId) : null;
        if (object?.kind === "bed") { result.set(o.id, { x: object.spot[0], y: object.spot[1], objectId: object.id, bed: object, slot: mine?.bed === object ? mine.slot : 0 }); continue; }
        if (!o.indoor.objectId || object) { const p = snapInside(plan, o.indoor.x, o.indoor.y); result.set(o.id, { ...p, objectId: object?.id || null }); continue; }
      }
      if (o.asleep && mine) { result.set(o.id, { x: mine.bed.spot[0], y: mine.bed.spot[1], objectId: mine.bed.id, bed: mine.bed, slot: mine.slot }); continue; }
      const text = String(o.activity || "");
      // The building's own activities first: staff go behind the counter.
      const own = (plan.activities || []).find(([pattern]) => pattern.test(text));
      const target = own && byId(own[1]);
      if (target && own[2] === "staff" && target.staff) {
        const n = taken.get(`staff:${target.id}`) || 0;
        taken.set(`staff:${target.id}`, n + 1);
        result.set(o.id, { x: target.staff[0] + n * 10, y: target.staff[1], objectId: null, staff: true });
        continue;
      }
      if (target) { result.set(o.id, seatAt(target)); continue; }
      let object = null;
      for (const [pattern, kinds] of activityKinds) {
        if (!pattern.test(text)) continue;
        for (const kind of kinds) {
          const candidates = plan.objects.filter(obj => obj.kind === kind);
          // Your own desk before someone else's.
          object = candidates.find(obj => ownerList(obj).includes(o.id)) || candidates.find(obj => !ownerList(obj).length) || candidates[0];
          if (object) break;
        }
        if (object) break;
      }
      if (!object && /rest/.test(text)) {
        // Resting happens in your own room, beside your bed.
        const room = ownRoomOf(plan, beds, o.id);
        if (room && mine) { result.set(o.id, { x: mine.bed.spot[0], y: mine.bed.spot[1], objectId: null }); continue; }
      }
      if (!object) object = byId("sofa") || byId("armchair") || plan.objects.find(obj => obj.seats);
      result.set(o.id, seatAt(object));
    }
    return result;
  }

  // Anything in `decor` that can be used becomes an object with its own id
  // and a spot to stand (or sit) at. Purely decorative things stay decor.
  const HANGING = new Set(["window", "picture", "poster"]);
  for (const plan of Object.values(plans)) {
    const counts = {};
    const decor = [];
    for (const d of plan.decor) {
      if (!furniture[d.kind]) { decor.push(d); continue; }
      counts[d.kind] = (counts[d.kind] || 0) + 1;
      const id = `${d.kind}${counts[d.kind]}`;
      const room = plan.rooms.find(r => inRect(d.x + d.w / 2, d.y + d.h / 2, r));
      let spot;
      if (d.kind === "chair" || d.kind === "beanbag") spot = [d.x + d.w / 2, d.y + d.h];
      else if (HANGING.has(d.kind) && room) spot = [d.x + d.w / 2, room.y + WALL + 8];
      else spot = [d.x + d.w / 2, d.y + d.h + 6];
      const p = snapInside(plan, spot[0], spot[1]);
      plan.objects.push({ ...d, id, spot: [Math.round(p.x), Math.round(p.y)], hanging: HANGING.has(d.kind) });
    }
    plan.decor = decor;
  }

  return { PLAN, WALL, furniture, plans, planFor, indoorActivity, locate, floorOf, frontDoorRect, isWalkable, roomAt, snapInside, routeInside, assignBeds, placeHousehold };
});
