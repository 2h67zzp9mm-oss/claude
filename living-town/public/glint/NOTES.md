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

## Rooms, arch, gate trees (builds 16-18)
- Cottage `room: true, step: [...]` eases `th.roomK` (tap 6 s / walker on step), cutaway with two gold "empty spots". Arch (12,20)
  `flat`, lights letters like a mat. Gate trees: `tree` + `gate: -1|1`.

## Lantern Stars (build 19)
- `stars` (12,21) `flat`, `stars: [[x, y, size, colour 0-3, lift]]` (absolute tile spot, drawn `lift` tiles up). THINGS.stars is a stub;
  GLINT_OVER.stars draws on top. Brighten under walkers; arch/own tap runs a wave + shooting star (also every 11 s). Keep clear of
  the KINDLE'S board. `?pose=welcome`.
- The test (test/glint-grid.test.js) loads only world.js + things.js: every kind on the map needs a draw (stub) in things.js.
  things.js is ~60 KB: new kinds go in things-*.js (script tag after things.js) with a stub in things.js.

## Bakery, ovens (builds 20-22)
- `bakery` (16,21) r 1.3 by things-bakery.js: front gable south, amber east window, light fan east; brightens on tap/near. `oven: true`
  draws the Stone Oven in the window; `oven` (17,21) is a tap-only stub (fire roars 4 s, `?pose=roar`). East road "p" (12-20, 22).
- `amberoven` (9,19) by things-amber.js; it wraps `mat`: `loaf: true` draws a loaf on the Welcome Mat. (8,19) free.
- glint-look piped (`| grep`) keeps the OLD png: run it alone.

## Third Little House (build 23, 2026-11-19)
- Map grown to 28. Lantern Street "p" continues x=12, y 23-26; moss (8-11, 23-26); doorstep "p" (10-11, 25).
- `cottage` at (10,24) `flip`, settled, pink roof, blue gem, pink `door`, plus two new options handled by things-pink.js
  (wraps GLINT_THINGS.cottage, loads after things.js): `moths: [[rgb, wing], ...]` loop round the roof gem (tap = wide fast
  swirl + pink sparks, 4 s) and `glowWindow: "r,g,b"` makes the round window glow. Pink Door Lamp (9,25), 2 moths.
- Lantern Stars (10.9,23.2) and (12.1,23.8) now hang over the pink roof; looks fine. Free: (8-9,23-24) and (11,23-24) moss for a
  tree/flowers; east side of the street south of y=22 is empty (a fourth house facing it at (14,24) with doorstep (13-14,25)).

## Crystal Bench (build 24)
- `bench` + `crystal: true` at (13,21), things-crystal.js wraps GLINT_THINGS.bench; sitting still works. Tap/seated -> chime. `?pose=chime`.

## Glowing Hedges (builds 25-26)
- `kind: "hedge"` (things-hedge.js), `flat`, at y 21.45 (sorts between the Crystal Bench and road walkers). `hedge: [[x,y],...]`
  absolute points; `gap: [x0,x1]` with gem posts; `cap: true` draws the glowing last stone at the end. East one at x 13
  (14.3,21.93)->(13,21.93)->(13,20.72), west one at x 11 mirrored. Flowers open near walkers; arch/tap runs a 3 s wave.
  Poses `bloom`, `meet`. grid.js tap `dist` handles `th.hedge`. Sizes must be big to read (mound 0.3 tile).
- Updater log (builds 23-28): only "origin/claude/code-review-4vrxjs isn't a fast-forward from 12f06c4; not taking rewritten
  history". Git history on the live checkout (branch was rewritten), not tests; can't be fixed from this folder. Grid tests pass.

## Lantern Sky (build 27, 2026-11-20)
- `kind: "skystars"` (stub in things.js, drawn by things-sky.js via GLINT_OVER, loads after things-hedge.js) at (15,25) `flat`.
  `sky: [[x,y,size,col]]` 18 small 4-point stars on "." tiles either side of Lantern Street (x 5-7, 18-21, y 16-27, and y~27.5).
  `lantern` 7 stars (hook at 22.75, top 23.3, roof y24, body to 25.6, base 26.3, x 15.1-16.5) + `lines` index pairs + `flame`.
  Arch lit (walker under it re-taps every 4 s) or own tap: `th._k` eases up, lines draw one by one from `th._drawn`, flame grows;
  fades ~2 s after. `?pose=sky`. grid.js tap `dist` handles `th.sky` (+ lantern points).
- The lantern hangs over the free ground where a fourth house at (14,24) could go; it's "high sky", fine over a roof, but
  shift `lantern`/`flame` x if it crowds the house.

## Third house finished (build 28, 2026-11-20)
- Pink Welcome Mat `mat` (10,25) `ox 0.42`, `mat: [light, mid, dark]` pink. Pink Street Tree young (8,24). Pink Door Flowers (11,26) `colours`.
- `kind: "homelight"` (stub in things.js, drawn by things-pink.js) at x 10, y 24.03 (house tile, so cottage geometry matches:
  wall foot b = y+0.45s, h = 0.95s; lantern at x+1.16s, b-0.55h). Reads walkers from `GLINT_GRID.walkers`: traveler within 3.2 of
  (10.9,25) -> `th._k` eases to 1 (Kindle alone 0.45); tap 5 s; heartbeat glow when idle. `?pose=home` holds it awake.
  grid.js tap `dist` now handles `th.spot: [x, y]` (a tap point away from the anchor), used here at (11.66,24.43).
- A Homecoming Light for the other two doors is an easy copy (same geometry; flip houses need the bracket on the right, non-flip
  First Little House would need it mirrored: door is at x-0.43s there).

## Still open
- First Little House: teal `door` ["#6dffc6", "#27c9c2", "#0f6a72"], `settled: true`, a teal mat (`x:14, y:18, ox:-0.36, flat`),
  lit path + flowers on the east side (free moss at (13,16)); the sign at (13,15) is in the way of a path there.
- THINGS.traveler (pirate look, coat when `wearing === "coat"`, keep name label), THINGS.neighbour.
- Matching crystal bench under the West Gate Tree (moss at (11,21)? check arch post), table by the Crystal Bench, bench by the Door Lamp, more street trees up toward the square, hedge on south down Lantern Street, cooling shelf by the bakery window (Kindle keeps circling it), more stars over the square.
- Bakery: bread on the shelf (left upper pane, line at V0+0.44s), a bread basket by the door, a table and a lamp by the east road.
