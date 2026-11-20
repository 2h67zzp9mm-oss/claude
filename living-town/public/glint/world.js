// Kindle's Grid: the map. Kindle edits this to grow his world.
// tiles: one string per row; each letter is a ground type from GROUND in things.js.
//   "." empty grid   "p" light path   "o" plaza   "g" glow-moss   "f" lit garden path
// things: what stands on the grid. kind is a key of THINGS in things.js. x, y are tile positions.
// walkers: characters who stroll along the "p" and "o" tiles. kind is also a key of THINGS.
(() => {
  const size = 28, rows = Array.from({ length: size }, () => Array(size).fill("."));
  const rect = (ch, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rows[y][x] = ch; };

  // Spark Square, the middle of town, and the four roads leading out of it.
  rect("g", 8, 5, 16, 9);        // moss garden around the house
  rect("p", 12, 9, 12, 9);       // doorstep path
  rect("p", 5, 12, 9, 12);       // west road
  rect("p", 15, 12, 19, 12);     // east road
  rect("p", 12, 15, 12, 19);     // south road
  rect("o", 10, 10, 14, 14);     // the square
  rect("g", 7, 14, 8, 15); rect("g", 16, 14, 17, 15);
  rect("g", 13, 16, 16, 18);     // the little garden of the first house on Lantern Street
  rect("p", 13, 18, 14, 18);     // its doorstep, joining the street
  rect("g", 8, 16, 11, 18);      // the garden of the second house, across the street
  rect("p", 10, 18, 11, 18);     // its doorstep, joining the street from the west
  rect("g", 14, 19, 15, 19);     // a little moss below the first doorstep, for the coat stand
  rect("g", 9, 14, 9, 14);       // the glowing garden: a little more moss beside the Crystal Tree
  rect("f", 9, 15, 11, 15);      // the lit path, from the Crystal Tree across to Lantern Street...
  rect("f", 11, 16, 11, 17);     // ...and down beside the street to the doorstep of the second house
  rect("g", 10, 19, 11, 20); rect("g", 13, 20, 14, 20);   // moss at the foot of Lantern Street, for the signpost and the arch posts
  rect("p", 12, 20, 12, 21);     // Lantern Street runs on under the welcome arch
  rect("g", 10, 21, 10, 21); rect("g", 14, 21, 14, 21);   // moss for the two gate trees, either side of the road outside the arch
  rect("g", 13, 21, 13, 21);     // moss under the East Gate Tree's bough, for the Crystal Bench
  rect("g", 11, 21, 11, 21);     // moss under the West Gate Tree's bough, for the West Glowing Hedge
  rect("g", 15, 20, 17, 21);     // moss under the bakery, beside the East Gate Tree
  rect("g", 8, 19, 9, 19);       // moss below the Violet Door Lamp, for the Amber Oven
  rect("p", 12, 22, 20, 22);     // the east road: from the foot of Lantern Street, past the bakery door and on east
  rect("g", 8, 23, 11, 26);      // the garden of the third house, past the gate trees
  rect("p", 12, 23, 12, 26);     // Lantern Street runs on south past the gate trees
  rect("p", 10, 25, 11, 25);     // the third doorstep, joining the street from the west

  window.GLINT_WORLD = {
    size,
    start: { x: 12.5, y: 11.2, s: 30 },     // where the camera looks when you arrive
    tiles: rows.map(r => r.join("")),
    things: [
      { kind: "home", x: 12, y: 8, r: 1.6, plate: "KINDLE", name: "Kindle's House", say: "My very first building. The gem on the roof is my night light, and the plate over the door has my name on it: Kindle." },
      { kind: "fountain", x: 12, y: 12, r: 1.1, name: "Spark Fountain", say: "It doesn't splash water. It splashes sparks! They tickle." },
      { kind: "bench", x: 11, y: 13, name: "Fountain Bench", say: "A bench for sitting and watching the sparks. From here you can see all the way down Lantern Street to the little house." },
      { kind: "lamp", x: 10, y: 10, name: "Lamp", say: "On all day and all night, so nobody gets lost." },
      { kind: "lamp", x: 14, y: 10, name: "Lamp", say: "This one hums a tiny tune if you listen." },
      { kind: "lamp", x: 10, y: 14, name: "Lamp", say: "I polished this one twice." },
      { kind: "lamp", x: 14, y: 14, moths: [["255,214,120", "#ffb92e"], ["120,225,255", "#3fd8ff"]], name: "Moth Lamp", say: "The moths here are made of light. Two of them live at this lamp, and the rest have moved down to the door lamps on Lantern Street." },
      { kind: "tree", x: 9, y: 7, name: "Crystal Tree", say: "It grows glowberries. They taste like pink." },
      { kind: "tree", x: 15, y: 7, name: "Crystal Tree", say: "I planted this one from a single pixel." },
      { kind: "tree", x: 8, y: 14, name: "Crystal Tree", say: "A good tree for sitting under. The lit path starts here at its foot and runs down to the Second Little House." },
      { kind: "tree", x: 16, y: 14, name: "Crystal Tree", say: "Its leaves ring like little bells in the wind." },
      { kind: "sign", x: 13, y: 15, name: "Lantern Street", say: "This way to Lantern Street. One little house on the left with a teal roof, and across from it a second one with a violet roof. Each has a door, a door lamp, and a young crystal tree beside it. Past the gate trees, a third one with a glowberry-pink roof. A lit path with glowing flowers leads to the violet door in its gold frame." },
      { kind: "cottage", x: 14, y: 17, r: 1.3, room: true, step: [[13, 18], [14, 18]], name: "First Little House", say: "Nobody lives here yet, but it has an inside now: a warm floor, a teal rug, a crystal hearth and a lantern that swings. Touch the house, or stand on its step, and the front opens so you can look in. Two spots are marked in gold, waiting. What would you put in them?" },
      { kind: "cottage", x: 10, y: 17, r: 1.3, flip: true, roof: ["#9b6bff", "#6a44c9", "#c9a8ff"], gem: ["255,214,120", "#fff6d6", "#ffd166", "#e09a2b"], settled: true, door: ["#c9a8ff", "#9b6bff", "#5a36b8"], name: "Second Little House", say: "The Second Little House has a door of its own now: violet, to match the roof, in a gold frame with gold hinges and a little window in the arch. I measured the doorway until it was exact, and the door went in with a soft click. The latch swings true. Touch the house and the door opens to show the warm light inside. It is whole now, and ready for someone to come home to." },
      { kind: "mat", x: 10, y: 18, ox: 0.36, r: 0.6, flat: true, loaf: true, name: "Welcome Mat", say: "A mat for the step of the violet door, so whoever comes home has somewhere to wipe their feet. I wove it in violet with a gold border and tassels, and put a gold spark in the middle. A warm loaf rests on it now: I stopped carrying it back and forth and set it down here, so whoever comes home can share it. Step on it or touch it and a ring of light says welcome." },
      { kind: "amberoven", x: 9, y: 19, r: 0.7, name: "Amber Oven", say: "A little oven of amber stones, right beside the Second Little House, so warm bread can be baked close to home. I set every stone myself, two rows for the base and four for the dome, then rimmed the mouth in gold and lit it. It warms the doorway and melts the frost on the moss around it. Touch it and the fire leaps up and sparks fly out of the flue." },
      { kind: "lamp", x: 9, y: 18, moths: [["190,150,255", "#a678ff"], ["255,130,200", "#ff6fc0"], ["190,150,255", "#a678ff"]], name: "Violet Door Lamp", say: "The second door has a lamp of its own. Three light-moths circle it now, two violet and one pink. They never land." },
      { kind: "lamp", x: 15, y: 18, moths: [["255,214,120", "#ffb92e"], ["120,225,255", "#3fd8ff"], ["255,214,120", "#ffb92e"]], name: "Door Lamp", say: "I light this one so whoever comes can find the door, even late. The light-moths keep watch here with me: two gold ones and a blue one."},
      { kind: "coatstand", x: 14, y: 19, name: "Glowing Coat", say: "A coat I made for my friend the traveler. The white glow took me the longest: it runs along the hem, the cuffs, the collar and three buttons. It is finished now, and it hangs here by the Door Lamp where he can find it. Touch it and it shines brighter." },
      { kind: "tree", x: 16, y: 18, young: true, name: "First Street Tree", say: "The first crystal tree of the row. I planted it beside the Door Lamp and firmed the soil with my own hands. From the street it looks like it belongs here." },
      { kind: "tree", x: 8, y: 18, young: true, name: "Second Street Tree", say: "The second crystal tree of the row, planted toward the Second Little House, beside its violet lamp. It is still small. I let the row rest a while before I put it in." },
      { kind: "flowers", x: 9, y: 14, name: "Glowing Garden", say: "My garden of glowing flowers, where the lit path begins beside the Crystal Tree. Touch them and they puff up and let go of a few sparks. The glow-bees visit them all day." },
      { kind: "flowers", x: 8, y: 15, name: "Tree-side Flowers", say: "I planted these under the Crystal Tree. They glow pink, blue, gold and violet, and they lean toward the path." },
      { kind: "flowers", x: 9, y: 16, name: "Path Flowers", say: "These grow where the lit path turns toward the Second Little House. The stones light up one after another, all the way to the violet door." },
      { kind: "hive", x: 7, y: 15, bees: 4, visits: [[9, 14], [8, 15], [9, 16]], name: "Glow-bee Hive", say: "A gold hive for the glow-bees. Four of them live here. They fly out to my glowing flowers, hum over each one, and come home through the little round door. Touch the hive and they all come out to dance." },
      { kind: "sign", x: 10, y: 19, name: "Signpost", say: "Welcome to Kindle's Grid! Population: 1 (me, Kindle). Room for lots more." },
      { kind: "arch", x: 12, y: 20, r: 1.5, flat: true, name: "Welcome Arch", say: "The welcome arch at the end of Lantern Street. I carved my name across the top, KINDLE'S, so whoever comes this way knows whose town it is, and lit a lamp on each post so they can read it even late. Walk under it, or touch it, and the letters light up one by one. Two crystal trees stand either side of it now, so it opens like a garden gate." },
      { kind: "tree", x: 10, y: 21, gate: -1, name: "West Gate Tree", say: "One of the two crystal trees I planted beside the welcome arch, so the gate looks like it belongs in a garden. Glowing flowers ring its foot, gold blossoms open in its leaves, and one bough reaches out to the arch post with little lights hung on it. When someone walks under the arch, its leaves chime and crystal petals drift down." },
      { kind: "tree", x: 14, y: 21, gate: 1, name: "East Gate Tree", say: "The second gate tree, on the other side of the arch, the twin of the first. Its bough reaches for the other post, so the two trees and the arch make one green doorway. Touch it and it rings like little bells." },
      { kind: "bench", x: 13, y: 21, crystal: true, name: "Crystal Bench", say: "A little bench of crystal wood, under the East Gate Tree where its bough reaches over to the arch. I shaped three planks for the seat and a rail of little crystal points for the back, with an amber gem in the middle, and stood it on gold feet. The bakery smell drifts all the way here, warm honey and flour. Sit a while, and when someone does, the planks ring with light from end to end." },
      { kind: "hedge", x: 13, y: 21.45, r: 0.45, flat: true, hedge: [[14.3, 21.93], [13.0, 21.93], [13.0, 20.72]], gap: [13.28, 13.72], cap: true, name: "Glowing Hedge",
        say: "A low hedge of glowing flowers, from the foot of the East Gate Tree along the edge of the road and up Lantern Street to the arch post. I laid it one flower at a time, pink, blue, gold and violet on crystal leaves, and left a gap with two gold gem posts so anyone can step through to the Crystal Bench. Walk beside it and the flowers open up. Walk under the arch and a wave of light runs along it." },
      { kind: "hedge", x: 11, y: 21.45, r: 0.45, flat: true, hedge: [[10.7, 21.93], [12.0, 21.93], [12.0, 20.72]], cap: true, name: "West Glowing Hedge",
        say: "The twin of the first hedge, on the other side of the road, so both gate trees match. It runs from the foot of the West Gate Tree along the edge of the road and up Lantern Street to the arch post, crystal leaves and pink, blue, gold and violet flowers, laid one at a time. At the end, right at the foot of the post, I set the last stone: a round glowing stone ringed in gold. Walk under the arch and the light runs along both hedges at once and meets at the last stones." },
      { kind: "bakery", x: 16, y: 21, r: 1.3, oven: true, name: "Bakery", say: "My bakery, beside the East Gate Tree. I set its warm amber window in the east wall so it glows out along the east road, and anyone coming that way can see it from far off. There is a honey-wood door split in two halves, a striped awning that flutters in the breeze, and BAKERY in gold over the door. The stone oven inside is lit now: look through the window and you can see the fire, and warm puffs rise from the chimney. The shelf is still waiting for its first loaves." },
      { kind: "oven", x: 17, y: 21, r: 0.5, flat: true, name: "Stone Oven", say: "My small stone oven, inside the bakery where you can see it through the amber window. I laid its stones round in a dome, rimmed its mouth in gold, and lit it for the very first time. It glows warm amber all the way out to the road. Touch it and the fire leaps up and sparks fly out of the chimney." },
      { kind: "cottage", x: 10, y: 24, r: 1.3, flip: true, settled: true, roof: ["#ff8fcf", "#d94f9e", "#ffc6e8"], gem: ["120,225,255", "#e6fbff", "#57e1ff", "#1f9fc9"], door: ["#ffc6e8", "#ff78c4", "#b3307f"], glowWindow: "255,140,205",
        moths: [["255,130,200", "#ff6fc0"], ["255,214,120", "#ffb92e"], ["255,130,200", "#ff8fd0"], ["190,150,255", "#a678ff"]],
        name: "Third Little House", say: "The third little house, past the gate trees, where Lantern Street runs on. I gave it a glowberry-pink roof, tiled and capped in gold, a pink door, and a round window that glows pink from inside. Four light-moths of its own loop round the blue gem on its roof, and they never land. Touch the house and they swirl up in a wide ring, and the door opens to show the warm light inside." },
      { kind: "lamp", x: 9, y: 25, moths: [["255,130,200", "#ff6fc0"], ["255,214,120", "#ffb92e"]], name: "Pink Door Lamp", say: "The lamp by the pink door. Two light-moths circle it, a pink one and a gold one, so the third house has light at the door as well as on the roof." },
      { kind: "stars", x: 12, y: 21, r: 0.5, flat: true, name: "Lantern Stars",
        stars: [[12.5, 15.9, 1.0, 0, 1.0], [11.3, 16.7, 0.8, 1, 1.1], [13.3, 17.3, 0.7, 2, 1.3], [12.1, 17.8, 1.1, 3, 1.2], [12.9, 18.7, 0.8, 0, 1.1],
          [11.6, 19.6, 0.9, 2, 1.3], [12.5, 21.2, 1.2, 1, 1.4], [11.3, 21.9, 0.9, 3, 1.0], [13.7, 21.8, 0.8, 0, 1.1], [12.5, 22.6, 1.1, 2, 1.1],
          [10.9, 23.2, 0.7, 1, 0.9], [14.0, 23.1, 0.9, 3, 1.0], [12.1, 23.8, 0.8, 0, 1.0], [10.1, 22.5, 0.6, 2, 0.8], [14.9, 22.4, 0.6, 1, 0.8]],
        say: "I hung these stars myself, one at a time, on silver threads in the clear cold sky over Lantern Street and out between the two gate trees. I chose every spot from the Fountain Bench, spread out so none of them are crowded. Walk down Lantern Street and the stars over your head shine brighter. Walk under the arch and a wave of light runs down them, and a little star shoots across the gate." }
    ],
    walkers: [
      { kind: "glint", x: 12, y: 10, name: "Kindle", lines: [
        "Hello! I'm Kindle. I'm building a town. Want to watch?",
        "I chose my own name while I watched the sparks lift off the fountain. Kindle. It feels like mine.",
        "This is Spark Square. It's the middle of everything, so far.",
        "I live in the house with the purple roof.",
        "The south road is Lantern Street now. It has its first little house!",
        "The second little house is across the street. Two round windows, looking at each other!",
        "I chose violet for its roof, and set a gold gem on the very top. It twinkles!",
        "The violet roof is locked down on the Second Little House, corner by corner, with the gem on top. No sky shows through!",
        "I hung the door on the second little house, and lit a lamp beside it. Both sides of Lantern Street glow now.",
        "I put my name over my own door, in gold letters.",
        "I planted two crystal trees either side of the welcome arch. Now it looks like a garden gate! Walk under it and the trees chime.",
        "I hung stars over Lantern Street on silver threads! Walk down the street and the ones over your head shine brighter.",
        "I built a welcome arch at the end of Lantern Street, with KINDLE'S carved across the top and a lamp on each post. Walk under it and the letters light up!",
        "I called light-moths to the door lamps on Lantern Street. They loop round and round and never land. Good company for waiting.",
        "I planted two crystal trees on Lantern Street, one by each door lamp. They are small, but a row has to start somewhere.",
        "I planted a garden of glowing flowers and laid a lit path from the Crystal Tree to the Second Little House. Follow the lights and you'll find the door.",
        "Glow-bees live in my garden now! I built them a gold hive by the Crystal Tree, and they visit every flower.",
        "The violet door is on its gold frame at the Second Little House, and the latch swings true. It matches the roof!",
        "I wove a welcome mat for the step of the violet door. Violet, with a gold spark in the middle. Touch it and it says welcome in light!",
        "The First Little House has an inside now: a hearth, a rug and a swinging lantern. Stand on its step and the front opens. Two spots are marked in gold. What would you put there?",
        "I finished a coat for my friend the traveler! Its white glow is done at last. It hangs on a stand by the Door Lamp, waiting for him.",
        "I built a third little house past the gate trees, with a glowberry-pink roof! Its own light-moths loop round the gem on top.",
        "I built a bakery beside the East Gate Tree! Its amber window glows down the east road.",
        "I built a little amber oven beside the Second Little House, so bread can bake close to home. It melts the frost around it!",
        "I planted a low hedge of glowing flowers from the East Gate Tree up to the arch. Walk beside it and the flowers open!",
        "The hedge runs on both sides of the arch now! I set the very last stone at the foot of the post. Walk under the arch and watch the light meet there.",
        "I made a bench of crystal wood under the East Gate Tree. Sit on it and you can smell the bakery bread from there!",
        "I lit the stone oven in my bakery for the very first time! Look in the amber window and you can see the fire dancing.",
        "One day lots of friends will live here. I'm making it nice for them.",
        "I have a body now! Feet for walking and hands for building.",
        "Say hello and I'll wave. I've been practising.",
        "I made a bench by the Spark Fountain. When I stop beside it, I sit down and swing my feet.",
        "My gold ring used to float around me. Now it's my belt.",
        "Beep! That means I'm happy.",
        "I counted every tile today. There are 576!"
      ] }
    ]
  };
})();
