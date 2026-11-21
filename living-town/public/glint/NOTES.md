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

## The map (world.js, size 28 since build 23)
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

## Older kinds (builds 16-27), short
- Rooms: cottage `room: true, step: [...]` eases `th.roomK` (tap 6 s / walker on step). Arch (12,20) `flat`. Gate trees `tree` + `gate`.
- `stars` (12,21): hanging Lantern Stars `[x,y,size,colour,lift]`, drawn by GLINT_OVER; `?pose=welcome`.
- `bakery` (16,21) things-bakery.js, `oven` stub (17,21) `?pose=roar`; `amberoven` (9,19) wraps `mat` (`loaf: true`).
- `cottage` (10,24) pink, things-pink.js adds `moths` + `glowWindow`. `bench` + `crystal` (13,21) `?pose=chime`.
- `hedge` (things-hedge.js) `hedge` points, `gap`, `cap`; poses bloom/meet. `skystars` (15,25) things-sky.js `?pose=sky`.
- Free: moss (8-9,23) (11,23); east side of Lantern St south of y=22 is empty (fourth house at (14,24), doorstep (13-14,25)).
- The test (../../test/glint-grid.test.js) loads only world.js + things.js: every kind needs a stub in things.js.

## Third house finished (build 28, 2026-11-20)
- Pink Welcome Mat `mat` (10,25) `ox 0.42`, `mat: [light, mid, dark]` pink. Pink Street Tree young (8,24). Pink Door Flowers (11,26) `colours`.
- `kind: "homelight"` (stub in things.js, drawn by things-pink.js) at x 10, y 24.03 (house tile, so cottage geometry matches:
  wall foot b = y+0.45s, h = 0.95s; lantern at x+1.16s, b-0.55h). Reads walkers from `GLINT_GRID.walkers`: traveler within 3.2 of
  (10.9,25) -> `th._k` eases to 1 (Kindle alone 0.45); tap 5 s; heartbeat glow when idle. `?pose=home` holds it awake.
  grid.js tap `dist` now handles `th.spot: [x, y]` (a tap point away from the anchor), used here at (11.66,24.43).
- A Homecoming Light for the other two doors is an easy copy (same geometry; flip houses need the bracket on the right, non-flip
  First Little House would need it mirrored: door is at x-0.43s there).

## Doorstep Bench (build 29, 2026-11-20)
- `bench` + `wood: true` at (11.15, 24.32) beside the pink door, under the Homecoming Light; drawn by things-woodbench.js (wraps
  GLINT_THINGS.bench, loads last). Fractional x/y = not in `blocked`, so the doorstep (11,25) stays walkable, and Kindle standing
  still on (11,25) sits (manhattan < 1.1). New `seatX` (grid.js) slides the sitter sideways: -0.24 = left cushion, right one free.
  `spot: [11.65, 24.7]` for taps (wins over the Homecoming Light spot near the seat). Tap/seated -> warm run + pink sparks.
  `?pose=rest` puts Kindle seated on it (sets `sitK = 1`: headless shots catch only a few frames, so the slide looked half-done).
- Updater log again only "isn't a fast-forward ... rewritten history" (live checkout git, not tests). Grid tests pass (3/3).

## Bun Table (build 30, 2026-11-20)
- `kind: "table"` at (11.66, 24.36) (fractional = not blocked), stub in things.js, drawn by things-table.js (loads last; scaled 1.4x
  around its foot via ctx.scale: at 1.0 it was unreadable on the phone). Round honey-wood top, pink cloth, loaf + pink cup with steam,
  bread-smell wisps drifting east, spare folded cushion on a shelf. Warms (tap 4 s, or anyone seated on the `wood` bench).
  `spot: [12.16, 24.65]`, `?pose=warm`. Right edge reaches ~x 12.4, the west edge of Lantern Street: nothing more fits east of the bench.

## Cooling Shelf (build 31, 2026-11-21)
- `kind: "cooling"` (18,21) on new moss, stub in things.js, drawn by things-cooling.js (loads last; ox = x-0.26s, scaled 1.6x around
  its foot). 3 slatted tiers: honey buns / 2 round loaves / glowberry rolls, steam per tier, smell wisps drift west. Warms on tap (4 s)
  or a walker within ~1.6 tiles; loaves hop on tap. `spot: [17.9, 21.0]`, `?pose=cool`. Bakery inside shelf now has 3 loaves.
- Updater log: last ship was skipped because the live checkout had uncommitted changes (not tests). Grid tests pass (3/3).

## Still open
- First Little House: teal `door` ["#6dffc6", "#27c9c2", "#0f6a72"], `settled: true`, a teal mat (`x:14, y:18, ox:-0.36, flat`),
  lit path + flowers on the east side (free moss at (13,16)); the sign at (13,15) is in the way of a path there.
- THINGS.traveler (pirate look, coat when `wearing === "coat"`, keep name label), THINGS.neighbour.
- Matching crystal bench under the West Gate Tree (moss at (11,21)? check arch post), table by the Crystal Bench (copy things-table.js), bench by the Door Lamp / violet door (copy `wood: true`), more street trees up toward the square, hedge on south down Lantern Street, more stars over the square.
- Bakery: a bread basket by the door, a table and a lamp by the east road.
