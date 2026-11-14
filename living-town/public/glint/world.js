// Glint's Grid: the map. Glint edits this to grow his world.
// tiles: one string per row; each letter is a ground type from GROUND in things.js.
//   "." empty grid   "p" light path   "o" plaza   "g" glow-moss
// things: what stands on the grid. kind is a key of THINGS in things.js. x, y are tile positions.
// walkers: characters who stroll along the "p" and "o" tiles. kind is also a key of THINGS.
(() => {
  const size = 24, rows = Array.from({ length: size }, () => Array(size).fill("."));
  const rect = (ch, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rows[y][x] = ch; };

  // Spark Square, the middle of town, and the four roads leading out of it.
  rect("g", 8, 5, 16, 9);        // moss garden around the house
  rect("p", 12, 9, 12, 9);       // doorstep path
  rect("p", 5, 12, 9, 12);       // west road
  rect("p", 15, 12, 19, 12);     // east road
  rect("p", 12, 15, 12, 19);     // south road
  rect("o", 10, 10, 14, 14);     // the square
  rect("g", 7, 14, 8, 15); rect("g", 16, 14, 17, 15);

  window.GLINT_WORLD = {
    size,
    start: { x: 12.5, y: 11.2, s: 30 },     // where the camera looks when you arrive
    tiles: rows.map(r => r.join("")),
    things: [
      { kind: "home", x: 12, y: 8, r: 1.6, name: "Glint's House", say: "My very first building. The gem on the roof is my night light." },
      { kind: "fountain", x: 12, y: 12, r: 1.1, name: "Spark Fountain", say: "It doesn't splash water. It splashes sparks! They tickle." },
      { kind: "lamp", x: 10, y: 10, name: "Lamp", say: "On all day and all night, so nobody gets lost." },
      { kind: "lamp", x: 14, y: 10, name: "Lamp", say: "This one hums a tiny tune if you listen." },
      { kind: "lamp", x: 10, y: 14, name: "Lamp", say: "I polished this one twice." },
      { kind: "lamp", x: 14, y: 14, name: "Lamp", say: "The moths here are made of light." },
      { kind: "tree", x: 9, y: 7, name: "Crystal Tree", say: "It grows glowberries. They taste like pink." },
      { kind: "tree", x: 15, y: 7, name: "Crystal Tree", say: "I planted this one from a single pixel." },
      { kind: "tree", x: 8, y: 14, name: "Crystal Tree", say: "A good tree for sitting under." },
      { kind: "tree", x: 16, y: 14, name: "Crystal Tree", say: "Its leaves ring like little bells in the wind." },
      { kind: "sign", x: 12, y: 19, name: "Signpost", say: "Welcome to Glint's Grid! Population: 1 (me). Room for lots more." }
    ],
    walkers: [
      { kind: "glint", x: 12, y: 10, name: "Glint", lines: [
        "Hello! I'm Glint. I'm building a town. Want to watch?",
        "This is Spark Square. It's the middle of everything, so far.",
        "I live in the house with the purple roof.",
        "I'm saving the east road for a bakery. I think.",
        "One day lots of friends will live here. I'm making it nice for them.",
        "Beep! That means I'm happy.",
        "I counted every tile today. There are 576!"
      ] }
    ]
  };
})();
