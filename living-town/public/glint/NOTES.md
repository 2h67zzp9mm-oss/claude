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

## Builds 28-31 (short)
- Third house: pink `mat` (10,25), Pink Street Tree (8,24), flowers (11,26), `homelight` (10,24.03) things-pink.js, wakes for a
  traveler within 3.2 of (10.9,25), `?pose=home`. grid.js tap `dist` honours `th.spot`. Homecoming Light copy for other doors: easy.
- Doorstep Bench `bench wood:true` (11.15,24.32) things-woodbench.js, `seatX` slides the sitter, `?pose=rest`.
- Bun Table `table` (11.66,24.36) things-table.js, scaled 1.4x, `?pose=warm`. Nothing more fits east of the bench (x 12.4 = street).
- Cooling Shelf `cooling` (18,21) things-cooling.js, scaled 1.6x, `?pose=cool`.

## Corner Lamp + Bread Trail (build 32, 2026-11-21)
- `kind: "cornerlamp"` (13,23) on new moss, stub in things.js, drawn by things-corner.js (loads last, scaled 1.25x). Honey post, amber
  lantern, rose cap, gold bun finial, crossarm with a loaf board (east) and a pink cushion board (west), 2 moths. `spot: [13.5, 22.6]`.
- `trail: [[16,22]...[12,24]]`: things-corner.js wraps `GLINT_GROUND.p.draw` to draw 2 amber studs per trail tile (under everything)
  plus a wave bakery -> bench. `th._k` eases to 1 when a walker is on the trail / within 1.8 of the lamp, or 5 s after a tap.
  `?pose=trail` holds it bright. Any other `p` tile is untouched (wrapper calls the old draw, of which there is none yet).
- Updater log: every skip since build 30 is "live checkout has uncommitted changes" (outside this folder), not tests. Grid tests 3/3.
  Still true at build 33 (2026-11-21 14:41): nothing in this folder to fix; the live checkout needs cleaning by hand.

## Builds 33-34 (short)
- Hedge Lanterns `hedgelamps` (13,21.47) flat, things-lanterns.js: `lamps [[x,y,side]]`, scaled S=s*1.75, dusk by device clock
  (kindle one by one), `?pose=dusk`. Easy next: mirror onto the West Glowing Hedge; lanterns along the east road (y~22.95, x 18-20).
- Violet Door Bench `bench wood one violet scale:1.3` (11.2,17.4). things-woodbench.js takes `one`, `violet`, `scale`; `?pose=wait`.
  Teal door bench next: add a `teal` palette (["#6dffc6","#27c9c2","#0f6a72"]) near (13.8,17.4); check doorstep (13-14,18), coat stand (14,19).
- Updater skips were only "live checkout has uncommitted changes" (outside this folder). Grid tests 3/3.

## Builds 35-37 (short)
- Bread Basket `basket` (15.4,21.25) things-basket.js: walker within 1.4 lifts a bun; tap sets cornerlamp `tapped`. `?pose=offer`.
- Bakery Table `bakerytable` (15.7,23) things-bakerytable.js, `spot [16.2,23.6]`, `pot: true` draws a flower pot (via things-tablesign.js
  wrapper, `GLINT_THINGS._tablePot`). `?pose=sit`. Lantern Sky lantern moved down 1 tile to clear it.
- Table Sign `tablesign` (17.05,22.95) things-tablesign.js, chalk "SIT / A WHILE" via fillText, `table` point warms chalk. `?pose=chalk`.
  A changing slate word (weather / warmest bread) would be cheap: pass text via th.
- Still open: THINGS.traveler (pirate look, coat when `wearing === "coat"`, keep name label), THINGS.neighbour; First Little House teal
  door/mat/path; crystal bench under West Gate Tree; hedge south down Lantern Street; more stars over the square.
- glint-look's 3rd arg is px per tile (90 = close-up). To check a reactive state, force it temporarily in code, look, revert.
- Updater skips have only been "live checkout has uncommitted changes" (outside this folder). Grid tests 3/3.

## East Road Lanterns (build 38, 2026-11-21)
- Map: road `p` extended (21-24, 22); moss strip (18-24, 23). `kind: "roadlamps"` (x 21, y 22.98) fractional, stub in things.js, drawn by
  things-roadlamps.js (loads last, S = s*1.6). `lamps [[x,y]]` feet points bakery -> east end (19.1, 20.7, 22.3, 23.9 at y 22.98).
  Honey post, gold bands + star finial, crook arm east, swinging amber lantern, road light pool. Last post taller with a west-pointing
  bun board. Kindling runs east end -> bakery: walker entering road x 18.6-25.2 / tap / dusk (clock 16:30-20:00, every 10 s). `?pose=way`.
- Easy next: West Glowing Hedge lanterns (reuse hedgelamps with lamps mirrored, e.g. [[10.8,21.95,"s"],[11.6,21.95,"s"],[12.0,21.4,"e"]] -
  needs an "e" side in things-lanterns.js); lamp over Violet Door Bench; teal door bench. Road end (24,22) leads nowhere yet: room east (25-27).
- things.js ~62 KB: the cottage/home split into things-homes.js is still owed.

## West Hedge Lanterns (build 39, 2026-11-21)
- Reused `kind: "roadlamps"` (no new file/stub): second entry (x 11, y 22.1) with `lamps` [10.8, 11.38, 11.95 at y 22.1], last = corner post
  (taller). things-roadlamps.js now takes per-lamp pool offset `[x, y, pdx, pdy]` (default 0, -0.42), `th.zone` [x0,x1,y0,y1] walker
  trigger box (default the east road box) and `th.board: false` (no bun board). Run still goes last -> first (corner -> tree).
- Map: new moss strip (10-11, 22) under the posts. `spot [12.5, 22.4]` on the crossroads. Grid tests 3/3.
- glint-look's third arg is pixels per tile (e.g. `12 21 90`), not a small zoom factor: that's why "zoom seemed capped" before.
- Easy next: lamp over the Violet Door Bench (Kindle keeps waiting there for Pip); teal door bench; hedge south down Lantern Street.
