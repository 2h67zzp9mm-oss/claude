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
- First Little House (14,17): teal roof, teal `door` (build 45), round window, Door Lamp (15,18), First Street Tree (16,18),
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

## Builds 28-40 (short)
- Pink house (10,24) set: mat, tree, flowers, `homelight`, Doorstep Bench `bench wood` (things-woodbench.js), Bun Table. Cooling Shelf, Corner Lamp
  + amber `trail`, Hedge Lanterns, Violet Door Bench, Bread Basket, Bakery Table + Table Sign. `roadlamps` (lamps [x,y,pdx,pdy], zone, board) used 3x.
  Waiting Lamp `waitlamp` (12.42,17.95). Each kind has a `?pose=` to hold its lit state.
- Fractional things are drawn at x+0.5; `hedge`/`lamps` points are absolute. glint-look 3rd arg = px per tile (~90 max).

## Builds 41-43 (short)
- Lantern Street Hedge: moss (13,24-26), vertical `hedge` (y 23.6). "Lantern Street Lanterns" `roadlamps` y 26.95, opts `west`, `forward`,
  `board: "door"`, `wave: "<hedge name>"`, zone [11.6,13.6,23.3,27.4]. Fourth house idea now crosses the hedge (split it or go further south).
- `vane` things-vane.js on the bakery roof, exposes `window.GLINT_WIND` (heading, radians; slow sines, no real data), `?pose=gust`.
- `mill` things-mill.js "Glass Windmill" (18.1,19.5) scale 1.25 on moss (18,20); angle integrated in th.ang; tap whirl, `?pose=whirl`.
- glint-look must run alone (not after `&&`), else it silently leaves the old .look/grid.png. No PIL; sips can't write (sandbox).

## Builds 44-52 (short)
- `lampsong` bell (14,10.01) publishes `window.GLINT_SONG`; singing lamps go in heads(). Web Audio unlocked on pointerup.
- North Meadow (moss 6-17,0-4), North Road x=14 y 2-9: `cairn` (14,1), Star Lookout bench, `spyglass`, `chimes` (16.1,2.6),
  `wishlamp` (12.8,0.9). Lesson: draw all "lighter" glows first, then solids.
- Meadow Path: "f" tiles listed in meadowlamp `path`; things-meadowpath.js wraps G.f.draw (stones on a bezier). `meadowlamp` `_wave`
  (3 tiles/s west), `?pose=stones`. rect() needs x0<=x1.
- Pose check keeping the camera: zoom arg `"75&pose=X"` works with glint-look.

## Builds 53-54 (short)
- `starring` (7,2) things-starring.js: last "f" tile of meadowlamp `path`, scale 1.55, flat + `seat` (grid.js BENCHES includes th.seat).
  Back stones main pass, front stones GLINT_OVER. `stars` absolute (y<0) + `shape` gold threads (a house); `_go` lights it. `?pose=ring`.
- `blanketstone` (6.53,2.1) things-blanketstone.js, `spot`, warmth `_k` (Kindle seated / traveler near), tap = breath. `?pose=warmstone`.
- Free meadow: (6-10, 0-1), (6, 3-4), (7-8, 3-4), (10-11, 4). Map touches y=0 and x=6 is the west edge of the meadow.

## Builds 55-56 (short)
- `starflowers` (10,3) flat stub, flowers from meadowlamp `path`, halos in GLINT_OVER; open at night or on a wave. `?pose=starbloom|starbud`.
- `starchart` (9.6,0.85): `shapes` [{name, rgb, heart, pts absolute y<0, lines}]; next shape on tap/near/16 s at night. `?pose=starchart0|1|2`.

## Builds 57-61 (short)
- `westlamp` (5.8,2.3) honey post, 7 soft pools west, tap wave (th.tapped). `sparklamp` (3.0,2.35) draws 3 stepping stones (`steps`, x+0.5);
  fountain sparks every 6 s, `_col`/`_land`. `westflowers` (4,2) flat, all drawn in GLINT_OVER, colour flush from sparklamp. Every new kind
  needs a stub `kind() {},` in things.js (a build failed without it). Quote pose zoom: `glint-look 3.5 2 "90&pose=sparklamp"`.
- `hearth` (10.45,4.15) scale 1.7 publishes `window.GLINT_HEARTH {k, wave, from}`; things-meadowpath.js warms the path stones and runs an
  amber pulse (auto 18 s / 9 s mornings, tap). `?pose=hearth`. glint-look zoom caps ~90 px/tile.

## Build 62: Hearth Bench (things-woodbench.js + things-hearth.js)
- `bench wood ember` (8.95,3.98) scale 1.3, seatX -0.24, spot [9.4,4.3]: EMBER palette (cushions + glowberry), stitched gold flames,
  bread basket + gold toasting fork at the right end. Warms with window.GLINT_HEARTH (pulse wave -> planks glow + sparks). Kindle
  sits from path tile (9,3) (Manhattan 1.03 < 1.1). Hearth option `toast: true` draws a round loaf on the grate with steam.
- Next ideas: hearth warmth to the West Meadow stepping stones (sparklamp `steps`), cup hook by the hearth.

## Build 63: Keeping Shelf (things-warmshelf.js)
- `warmshelf` (11.5,4.95) scale 1.65, spot [11.6,5.4], just SE of the hearth (clear of its logs). Canvas-only: stone cubby with glowing
  arch, plate + toast + pink star tag, honey-wood plank, copper kettle (steam), honey jar, teal/pink cups on gold hooks.
  Reads window.GLINT_HEARTH.wave (pulse arrives 0.8 s later -> flare + puff), th.tapped (lid rattle, cup swing), near walkers.
  `?pose=keeping`. Stub in things.js, script after things-hearth.js in index.html. Test passes.
- Why: diary had the toast for Pip going cold on the fork while Kindle tended the Glowing Garden; plans asked for a cup shelf.
- Next ideas: hearth warmth to the West Meadow stepping stones (sparklamp `steps`); Kindle pouring cups when a traveler sits.
