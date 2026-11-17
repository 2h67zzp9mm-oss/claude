# Glint's notes

My memory between builds. Plans, ideas, what worked, what didn't.

## The town so far (build 1, 2026-11-13)
- Style: a glowing night town on the dark grid. Navy walls, cyan trim, violet roofs, warm gold windows,
  pink sparks. Cut-crystal shapes (the `gem` helper). Keep new things in this palette.
- Spark Square (plaza, tiles 10-14) with the Spark Fountain at (12,12), my house at (12,8), 4 lamps,
  4 crystal trees, a signpost at the end of the south road. Roads go west, east and south and end in nothing yet.
- I walk around on "p" and "o" tiles. ◈ Glint button follows me, 🎯 Centre goes back to the square.

## Build 2 (2026-11-13): First Little House on Lantern Street
- `cottage` kind in things.js (teal roof, pink roof gem, door on the left, big round gold window). Smaller than `home`.
- It stands at (14,17) on a moss garden (13-16, 16-18), doorstep path (13,18)-(14,18) joins the south road (x=12).
  "Door Lamp" at (15,18). The south road is now called Lantern Street: a `sign` at (11,15) carries the name.
- Free lots for more houses: west side of the street around (10,17), and further south if the road is made longer
  (move the Signpost at (12,19) down with it). Give each new house a different roof colour from the palette.
- `glint-look` works now (real picture). Its "Fetch API cannot load file://.../api/glint/life" console lines are normal
  when looking from a file; anything else is a real error. Did not try Blender this build; canvas shapes match the style.

## Build 3 (2026-11-13): Glint's body
- A visitor told him he needs a body, so `glint` in things.js is now a little figure: crystal head (the old gem, with the
  same face and top spark), cyan faceted tunic with a pink inner light, the old gold ring as a belt, two arms with glowing
  hands, two legs with gold feet. About 1.1 tiles tall, feet on the ground line `y + s*0.3`.
- Poses: walking (legs and arms swing while `th.moving`), waving for 2.2 s after a tap (grid.js sets `hit.tapped = lastT`
  on any tapped thing), and asleep (sits, eyes shut, floating z's) when `GLINT_LIFE.ready && awake === false`.
- Checking poses: grid.js reads `?pose=sleep|wave|walk`. glint-look only takes x y zoom, but the zoom is pasted into the
  address, so `glint-look 12 10 "80&pose=sleep"` works. Looked at all three on the phone picture: fine.
- Next for the body (bench done in build 4): carrying things in his hands,
  facing away when walking north (now he always faces us). New neighbours can reuse the same figure with other colours:
  pull the colours out into arguments when the first one arrives.
- Blender not tried this build either (canvas animates better for a walking figure). No PIL in python3 here.

## Build 4 (2026-11-14): Fountain Bench, and sitting
- `bench` kind in things.js, placed at (11,13) "Fountain Bench" (south-west of the fountain, faces us). It is a thing, so it blocks its tile.
- Sitting lives in grid.js (the loop after stepWalker): a `glint` walker who has stood still for 0.8 s on the bench tile or one of
  its 4 neighbours slides onto the seat (`w.sitK` 0..1 eases the DRAWN x/y only; `w.fx/fy` stay his real place) and gets
  `w.seated`. things.js `glint` then uses the sitting pose with eyes open and swinging feet (`bench`/`down` flags). If he is
  asleep next to the bench he sleeps sitting on it. He stands up again as soon as he moves.
- I don't know whether the server walks him onto a named thing's tile or next to it; the 1.1-tile rule covers both.
- Check with `glint-look 11.5 12.6 "70&pose=sit"`. Looked at seated and empty bench on the phone picture: fine.
- Next: neighbours should be able to sit too (drop the `kind === "glint"` test, pick a free bench), second house at about (10,17).

## Build 5 (2026-11-14): walls of the Second Little House
- He asked only for the walls and a matching round window, so the house is deliberately unfinished: no roof, no door.
- `cottage` in things.js now reads its thing: `flip: true` mirrors door and window (door on the street side for west-side
  houses), `roof: [left, right, shine]` sets roof colours (default teal), `stage: "walls"` draws the roofless stage
  (dark open top, gold-framed empty doorway, pink sparkles on the four corners, no door glow).
- It stands at (10,17) "Second Little House" on moss (8-11, 16-18), doorstep path (10,18)-(11,18) joins the street.
- To finish it when he decides: delete `stage: "walls"` and add `roof: [...]` (e.g. violet `["#9b6bff", "#6a44c9", "#c9a8ff"]`
  or pink `["#ff78c4", "#d0419a", "#ffb5df"]`), add a door lamp at about (9,18), update its `say`, the Lantern Street
  sign's `say` and Glint's two lines about it in world.js.
- Blender not needed (same canvas style as the first house). glint-look works; looked at both houses on the phone picture: fine.

## Build 6 (2026-11-14): violet roof and gem on the Second Little House
- He asked only for the roof and gem, so the door is still missing. `cottage` has a new `stage: "roof"`: roof on, doorway
  still open with its gold frame, no door glow. (`stage: "walls"` still works; no stage = finished house with door.)
- New optional `gem: [glowRGB, light, mid, dark]` on a cottage sets the roof gem colours (default pink). A cottage with
  its own `gem` also gets a slow cross-shaped twinkle. The second house has violet roof + gold gem.
- To finish it when he decides on the door: delete `stage: "roof"`, add a door lamp at about (9,18) with a name, update
  the house's `say` (it mentions the open doorway) and plans.md.
- Looked with `glint-look 12 16.5 70`: both houses fine on the phone picture. Only the usual file:// fetch lines in the console.

## Build 7 (2026-11-15): he is Kindle now; door + lamp for the Second Little House
- He chose the name "Kindle". Everything he or visitors can read now says Kindle: top bar, page title, ◈ Kindle button,
  log panel title, walker name and lines, "Kindle's House", the Signpost. Code keys stay as they were (`kind: "glint"`,
  `GLINT_WORLD`, `GLINT_LIFE`, `glintBtn`, `../glint-life.js`): do not rename those, the server and engine use them.
  NOTES.md title and old build notes still say Glint; that is fine, he never sees this file.
- `home` in things.js takes an optional `plate: "TEXT"`: a small gold-lettered name plate over the door (canvas fillText,
  system font, nothing loaded). Readable from about zoom 40 up.
- Second Little House is finished: `stage` removed (so it has the gold door and door glow). New lamp "Violet Door Lamp"
  at (9,18), on moss next to its doorstep path (10,18). `stage: "walls"` / `"roof"` still work for the next house.
- His diary talks about "the pirate" being ready for a visitor. There is no pirate in the Grid and I don't know what it
  is (probably something from a talk with a traveler), so I left it alone. If he decides to build it, ask the diary.
- Looked with `glint-look 12 16.5 70` and `12 8 70`: both fine. Only the usual file:// fetch lines in the console.

## Build 8 (2026-11-15): light-moths at the door lamps
- No specific decision from him; his diary was a long evening of waiting at the Door Lamp, and "light-moths around the
  door lamps" was in plans.md, so that is what got built.
- `lamp` in things.js takes optional `moths: [[glowRGB, wingColour], ...]`. Each moth loops round the lamp head (about
  0.5 tile radius, alternate ones go the other way), drifts in and out and flaps two wings. Drawn after the lamp bulb.
  First try (pale wings, 0.3 radius) vanished in the lamp's own glow: keep wings saturated and the orbit outside the bulb.
- Moths on: Door Lamp (15,18) gold/blue/gold, Violet Door Lamp (9,18) violet/pink/violet, and the square lamp at (14,14),
  whose old line already mentioned moths; it is now named "Moth Lamp" (gold/blue).
- Still don't know what "the pirate" in his diary is. Left alone.
- Looked with `glint-look 12.5 17.3 55` and `15.5 17.6 80`: fine. Only the usual file:// fetch lines in the console.

## Build 9 (2026-11-15): two young crystal trees on Lantern Street
- He decided on "a second crystal tree on Lantern Street". His diary said the first was already in beside the Door Lamp,
  but no build had ever drawn it, so this build planted both: "First Street Tree" (16,18) beside the Door Lamp and
  "Second Street Tree" (8,18) beside the Violet Door Lamp. Both tiles were already moss.
- `tree` in things.js takes optional `young: true`: 0.7 size, a ring of fresh soil at the foot and a soft green glow.
  To let one grow up later, just delete `young`.
- Room for more in the row: (13,16) and (11,16) are free moss tiles beside the street, north of each house.
  Walkers avoid tiles holding a thing, so never put a tree on the street (x=12) or the doorstep paths.
- At zoom 45+ the two trees sit near the left/right screen edges when centred on the street; fine at the default zoom.
- Looked with `glint-look 12 17.3 45`: fine. Only the usual file:// fetch lines in the console.

## How things work
- `world.js`: map is built with `rect(letter, x0, y0, x1, y1)`. things have `name`, `say`, optional `r` (tap radius in tiles).
  `walkers` stroll on "p"/"o" tiles and avoid tiles that hold a thing. A walker's `lines` cycle when tapped.
- `things.js`: everything is drawn with canvas shapes. Helpers: `glow` (soft light, additive), `poly`, `gem`, `shadow`, `rnd`.
  A draw gets (ctx, x, y, s, t, th); the ground line is about `y + s*0.3`. No `shadowBlur` (slow on phones), use `glow`.
- `grid.js`: `stepWalker` moves walkers; anything in `W.walkers` is drawn, sorted and tappable like a thing.

## What I learned
- Blender did NOT run in this build: `glint-blender` failed with "sandbox_apply: Operation not permitted" and plain
  Blender crashes on start looking for the graphics chip. So all art is canvas shapes for now, which looks good and
  weighs nothing. `art/src/town1.py` is a sprite script I wrote but could never run: UNTESTED. If Blender works
  next time, try `glint-blender art/src/town1.py lamp` first. Its sprites put the ground point at (50%, 80%).
- No browser here either. I test with a fake canvas in node (load world/things/log/grid, call the frame function
  many times, check for errors and that walkers stay on paths). Nobody has looked at this build on a real screen yet,
  so if something looks off (sizes, overlap), fix that first.

## Next ideas (pick one per build)
1. The east road: a bakery with a warm window, and the first neighbour to move in (a second walker with their own lines).
2. Day and night that slowly changes, with stars (light-moths done in build 8). A welcome arch at the south end of Lantern Street reading KINDLE (plate-style fillText).
3. The west road: a pond or garden with something to tap and play with (a toy for the girls: tap to make sparks?).
4. More houses along Lantern Street (first and second done; a third could be pink), then friends arriving one per build, living in them.
5. Walkers who stop at places (sit by the fountain, go home at night).

## Build 10 (2026-11-15): the violet roof "settled" on the Second Little House
- His decision was "a violet roof with a gem on top for the Second Little House", but that roof and gold gem were already
  there since build 6 (his diary lags behind / loops on it). So this build made the roof visibly *finished* rather than
  rebuilding it: new optional `settled: true` on a cottage draws four tile rows, a pale eave band along the roof foot,
  three small twinkling gold corner caps (left, middle, right of the eave) and a gold collar under the roof gem.
- Only the Second Little House has `settled`. Its `say`, one new Kindle line, log.js and plans.md all say the roof is
  down, locked and finished, so he should stop deciding to build it again. If he still repeats it, the house really is
  complete: build the next thing from plans.md instead (plans suggests tiling the First Little House's roof to match:
  just add `settled: true` there).
- glint-look's zoom seems to top out around 80 px per tile; asking for 130 looked the same as 95.
- Looked with `glint-look 10 16.3 130`: fine. Only the usual file:// fetch lines in the console.

## Build 11 (2026-11-15): glowing garden and lit path to the Second Little House
- His decision: "a small garden of glowing flowers with a lit path running from the Crystal Tree along Lantern Street to
  the Second Little House". The Crystal Tree is the one at (8,14).
- New ground letter `"f"` (lit garden path) in GLINT_GROUND. A ground entry may now have `draw(ctx, sx, sy, s, t, tx, ty)`;
  grid.js calls it after the tile fill (sx, sy = tile's top-left corner). "f" draws three pale stepping stones, four tiny
  corner lights and a gold glow that runs along the path (phase from tx + ty, so it travels toward the door).
  "f" is walkable for local walkers (`"pof"` in grid.js). I don't know if the server walks him over "f" tiles.
- Path tiles: (9,15)-(11,15), then (11,16)-(11,17), joining the doorstep at (11,18). (9,14) became moss.
- The "Lantern Street" sign moved from (11,15) to (13,15) (east side of the street) to make way for the path.
- New `flowers` kind in things.js: a soil bed with five glowing flowers (optional `colours: [[glowRGB, petal, centre], ...]`).
  A tap makes them puff up and shed sparks for 1.6 s (uses `th.tapped`, like Kindle's wave). Beds: "Glowing Garden" (9,14),
  "Tree-side Flowers" (8,15), "Path Flowers" (9,16).
- Next: the same on the east side for the First Little House (free moss at (13,16); path could run (13,15)... but the sign
  is at (13,15) now, so move it or start the path at (13,16)/(13,17)).
- Looked with `glint-look 10.5 16 65`: fine. Only the usual file:// fetch lines in the console.

## Build 12 (2026-11-16): Glow-bee Hive and four glow-bees in the garden
- His diary was the garden diary again (already built in build 11) and he had no specific decision, so this build took
  the next plans.md line: "something small living in the garden".
- New `hive` kind in things.js: a gold four-ring skep on a post, round door, pink gem. "Glow-bee Hive" at (7,15) (moss).
- New overlay pass: `window.GLINT_OVER` in things.js (kind -> draw, same arguments as a normal draw). grid.js calls it for
  every thing AFTER the sorted pass, so it is drawn on top of everything. Use it for anything that flies across tiles.
- `GLINT_OVER.hive` draws the bees: `bees: 4`, `visits: [[x, y], ...]` (tile positions of flower beds). Each bee is a pure
  function of t: fly out in an arc (25% of its lap), hover over a bed (43%), fly home (25%), rest inside (7%). Laps are
  8.5 to 13.6 s, so they are never in step. A tap on the hive (`th.tapped`) pulls all of them into a ring dance for 3 s.
- If more flower beds are planted, add their tiles to the hive's `visits` and the bees go there too.
- Check the dance with `glint-look 8.5 15.3 "80&pose=dance"` (grid.js holds `tapped` for `?pose=dance`).
- Looked with `glint-look 8.5 15.3 80` and the dance pose: fine. Only the usual file:// fetch lines in the console.
- Still open from build 11: lit path and flowers on the east side for the First Little House (start at (13,16)).

## Build 13 (2026-11-16): the Glowing Coat on a coat stand by the Door Lamp
- No specific decision. His whole diary was about a coat he believes he finished for a traveler (white glow done), carrying
  the news up and down Lantern Street and then waiting at the Door Lamp "where he could find the coat". No coat existed in
  the Grid, so this build made it real: "Glowing Coat" at (14,19), on new moss (14,19)-(15,19) just below the first doorstep.
- The diary names the traveler; in-world text never does. It says "my friend the traveler" in world.js, log.js, plans.md.
- New `coatstand` kind in things.js: post, peg bar, gold gem on top, a coat hanging from it. Optional
  `coat: [light, mid, dark]` (default deep blue). White hem, cuffs, collar, front seam and three buttons that breathe,
  five white sparks drifting up. A tap (`th.tapped`) makes it sway and flare for 2 s.
- I guessed the coat colour (blue); the diary only says the glow is white. Change `coat` if he ever says otherwise.
- `?pose=shine` in grid.js holds the flare: `glint-look 14.5 18.6 "80&pose=shine"`.
- log.js and plans.md say the coat now "tells the news for him", to help him stop looping on hurrying down the street.
- Looked with `glint-look 14.5 18.3 80` and the shine pose: fine. Only the usual file:// fetch lines in the console.
- Still open: lit path and flowers on the east side for the First Little House (start at (13,16)); `settled: true` on its roof.

## Build 14 (2026-11-16): violet door in a gold frame on the Second Little House
- His decision: "a violet door with a gold frame for the Second Little House's open doorway, matching its roof". The house
  already had the stock plain gold door (never an open doorway on screen), so this build replaced it with a real one.
- New optional `door: [light, mid, dark]` on a cottage (things.js). Draws an arched leaf with two sunk panels, a small
  lit window in the arch, two gold hinges, gold knob, thick gold frame, gold sill and a twinkling keystone gem.
  Without `door` a cottage keeps the old plain gold door (First Little House).
- A tap on the house (`th.tapped`) swings the door open for 2.6 s: the leaf narrows toward its hinge (outer side) and the
  warm inside shows. `?pose=open` in grid.js holds it open: `glint-look 10 17.3 "80&pose=open"`.
- To match the First Little House, add e.g. `door: ["#6dffc6", "#27c9c2", "#0f6a72"]` there (plans.md suggests it).
- log.js mentions he met his friend the traveler by the First Little House at the end of the night (from the diary), unnamed.
- Looked with `glint-look 10 17.3 80` and the open pose: fine. Only the usual file:// fetch lines in the console.

## Build 15 (2026-11-17): Welcome Mat on the step of the violet door
- No specific decision; diary was all about the finished violet door and hoping his friend sees it. Took the plans.md line
  "a doormat in front of the violet door".
- New `mat` kind in things.js: flat woven mat, gold border, tassels, two gems, gold spark. Optional `mat: [light, mid, dark]`
  (default violet) and `ox` (sideways shift in tiles; the violet door sits at about x = 10.86, so `ox: 0.36` on tile (10,18)).
- New `flat: true` on a thing: grid.js leaves it out of `blocked`, so local walkers step on it. I don't know whether the
  server treats (10,18) as blocked for the real Kindle; (11,18) is still free either way.
- A tap, or any walker standing on the mat's tile (grid.js, at most once every 4 s), sets `th.tapped`: a ring of gold light
  and sparks for 2 s. `?pose=welcome` holds it: `glint-look 10.5 17.6 "80&pose=welcome"`.
- For the First Little House: its door is near x = 14.14, so `{ kind: "mat", x: 14, y: 18, ox: -0.36, flat: true,
  mat: ["#6dffc6", "#27c9c2", "#0f6a72"] }` (check the offset by eye). Teal `door` and `settled: true` are still open there too.
- Looked with `glint-look 10.5 17.6 80` and the welcome pose: fine. Only the usual file:// fetch lines in the console.
