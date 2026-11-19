# Glint's notes (builder only)

Summary of how the Grid works and what's next. Kept short: fold old entries into the summary.

## Style and checking
- Glowing night town: navy walls, cyan trim (#57e1ff), violet roofs, warm gold (#ffd166) windows, pink sparks. Cut-crystal
  shapes via `gem()`. All drawing is canvas shapes in things.js (no Blender used yet; canvas animates better).
- `glint-look x y zoom` works. Zoom tops out around 70-80 px/tile. The zoom is pasted into the URL, so
  `glint-look 14 16.8 "95&pose=inside"` passes a pose. "Fetch API cannot load file://.../api/glint/life" lines are normal.
- sips cannot write here (sandbox), and there's no PIL: no cropping the screenshot, just Read the whole thing.
- Poses (grid.js `?pose=`): sleep, wave, walk, sit (Kindle); open (coloured doors); welcome (mat); dance (hive);
  shine (coat stand); inside (rooms, snaps `roomK` to 1).

## Engine (grid.js)
- Draws ground tiles from `GLINT_GROUND` (a ground may have `draw(ctx, sx, sy, s, t, tx, ty)`), then things + walkers sorted,
  then `GLINT_OVER[kind]` for every thing on top (flying bees).
- Any tapped thing gets `th.tapped = t`; draw functions animate from it. `flat: true` things don't block walking.
- Walkable for local walkers: "p", "o", "f". Walkers (Kindle, travelers, neighbours) are in `WALKERS` = `GLINT_GRID.walkers`;
  positions use `fx/fy` (fall back to `x/y`). A `glint` walker standing still by a bench sits on it (`sitK`, `seated`).
- Mats light up when any walker stands on their tile. Rooms open when a walker stands on a `step` tile (below).

## The map (world.js, size 24)
- Spark Square (10-14, 10-14): Spark Fountain (12,12), Fountain Bench (11,13), 4 lamps (Moth Lamp at 14,14), Kindle's House
  (12,8) with KINDLE plate, crystal trees at (9,7) (15,7) (8,14) (16,14). Roads west (y=12), east (y=12), south = Lantern Street
  (x=12, y 15-19). Signpost (10,19), Welcome Arch (12,20), Lantern Street sign (13,15),
  West/East Gate Trees (10,21) (14,21) on moss.
- First Little House (14,17): teal roof, plain gold door, round window, Door Lamp (15,18), First Street Tree (16,18),
  Glowing Coat on its stand (14,19). Doorstep (13,18)-(14,18). Has `room: true` (build 16).
- Second Little House (10,17): `flip`, violet roof, gold gem, `settled` (tiled roof, gold caps), violet `door` that swings open
  on tap. Violet Door Lamp (9,18), Second Street Tree (8,18), Welcome Mat on (10,18) `ox: 0.36`.
- Glowing garden: flower beds (9,14) (8,15) (9,16), lit path "f" (9,15)-(11,15),(11,16)-(11,17), Glow-bee Hive (7,15) with 4 bees
  that visit the beds in `visits`.

## Kinds in things.js (~54 KB; split into several files once it passes ~60 KB)
- home, cottage, lamp (`moths`), tree (`young`), sign, fountain, bench, flowers (`colours`), hive, coatstand (`coat`), mat, arch, glint.
- cottage options: `flip`, `roof: [l, r, shine]`, `gem: [rgb, light, mid, dark]`, `stage: "walls"|"roof"`, `settled`,
  `door: [light, mid, dark]`, `room` + `step`.
- No THINGS.traveler / THINGS.neighbour yet: glint-life.js draws plain figures. The coat on a traveler (`wearing: "coat"`)
  and the empty stand are handled by glint-life.js for now. Kindle designed a pirate with a three-cornered hat for one traveler.

## Rooms (build 16)
- `room: true, step: [[x,y],...]` on a cottage: grid.js eases `th.roomK` 0..1 while tapped (6 s) or a walker is on a step tile;
  things.js `room()` draws the cutaway (hearth, rug, lantern, back window, two dashed gold "empty spots"). Mirrors for `flip`.
- Next: replace a gold spot with furniture once decided (maybe a `furniture: [...]` list). Second House could get `room` too.

## Arch + gate trees (builds 17-18)
- `kind: "arch"` (12,20) `flat`, reacts like a mat (walker on tile sets `tapped`, 4 s), letters light one by one; `?pose=welcome`.
- Gate trees: `kind: "tree"` + `gate: -1|1` -> `gateTree()`; chime when the arch or tree is tapped. A tree canopy covers
  ~1.6 tiles above its tile: check what's north of any new tree.

## Lantern Stars (build 19, 2026-11-18)
- `kind: "stars"` at (12,21), `flat`, r 0.5, `stars: [[x, y, size, colour 0-3, lift]]` (x/y absolute tile spot, n+0.5 = tile centre;
  drawn `lift` tiles above it). THINGS.stars is a no-op stub (the test only loads world.js + things.js and needs a draw there);
  the real drawing is GLINT_OVER.stars (on top of everything): ground pool, silver thread, 5-point star, cross flare when bright.
  Brightens under any walker (within 1.7 tiles); arch tap / own tap runs a wave down by y and a shooting star over the gate
  (also every 11 s). grid.js tap test uses each star's lifted position for things with `stars`.
- Keep stars clear of the KINDLE'S board (screen y about 19.0 at the arch). `?pose=welcome` shows the wave.
- The test (test/glint-grid.test.js) loads only world.js + things.js: any kind on the map must have a draw in things.js
  (a stub that defers to another file is fine). The failed "hedge" build put a hedge on the map without a drawing.
- things.js is ~60 KB: new kinds go in things-*.js files (script tag in index.html after things.js) with a stub in things.js.

## Bakery (build 20)
- `kind: "bakery"` at (16,21) r 1.3, drawn by things-bakery.js (stub `bakery() {}` in things.js, overwritten on load).
  Three-quarter view: front gable faces south, east wall visible with the amber window; light fan spills east on the ground.
  Brightens when tapped (3.5 s) or a walker is within ~1.8 tiles of (16.6,21.9). Name board in the gable, striped awning, split door.
- Map: moss (15-17, 20-21); east road "p" (12-20, 22) from the foot of Lantern Street past the bakery door.

## Stone Oven (build 21, 2026-11-18)
- Bakery has `oven: true`. things-bakery.js draws a domed stone oven (gold-rimmed arched mouth, keystone gem, flue, dancing
  flame tongues, ember bed) inside the east window, clipped to the glass. Window enlarged to U 0.12-0.9, V 0.24s-0.84s;
  a transom at V0+0.4s, mullion only above it so the oven shows whole. Fire kindles up over the first ~3 s after load.
- `kind: "oven"` at (17,21), `flat`, r 0.5, name "Stone Oven": a tap spot only (stub `oven() {}` in things.js). Its `tapped`
  makes the fire roar (4 s): brighter window/fan, spark shower from the chimney. `?pose=roar` holds that.
- glint-look must run on its own: piping it (`| grep`) silently keeps the OLD .look/grid.png (check the "N built" count).
- Updater log: still "isn't a fast-forward from 12f06c4" - the live checkout is on commit 12f06c4 (branch
  kindle-warnings-and-weather: grid-weather.js etc.), which the main branch doesn't contain. Needs merging outside this folder.

## Still open
- First Little House: teal `door` ["#6dffc6", "#27c9c2", "#0f6a72"], `settled: true`, a teal mat (`x:14, y:18, ox:-0.36, flat`),
  lit path + flowers on the east side (free moss at (13,16)); the sign at (13,15) is in the way of a path there.
- THINGS.traveler (pirate look, coat when `wearing === "coat"`, keep name label), THINGS.neighbour.
- Bench by the Door Lamp, more street trees up toward the square, a lit path/hedge past the gate trees, third house (pink roof), more stars over the square.
- Bakery: bread on the shelf (left upper pane, line at V0+0.44s), a bread basket by the door, a table and a lamp by the east road.
