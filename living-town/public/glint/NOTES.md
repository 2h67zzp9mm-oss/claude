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

## Builds 28-40 (short)
- Third house (10,24) pink: mat (10,25), Pink Street Tree (8,24), flowers (11,26), `homelight` (10,24.03) `?pose=home`. Doorstep Bench
  `bench wood` (11.15,24.32) things-woodbench.js (`seatX`, `one`, `violet`, `scale`; `?pose=rest|wait`), Bun Table (11.66,24.36) `?pose=warm`.
- Cooling Shelf (18,21) `?pose=cool`. Corner Lamp `cornerlamp` (13,23) things-corner.js + amber `trail` studs (wraps GLINT_GROUND.p.draw), `?pose=trail`.
- Hedge Lanterns `hedgelamps` (13,21.47) things-lanterns.js `?pose=dusk`. Violet Door Bench (11.2,17.4). Bread Basket (15.4,21.25) `?pose=offer`.
  Bakery Table (15.7,23) `pot`, Table Sign (17.05,22.95) chalk via fillText `?pose=chalk`.
- `roadlamps` things-roadlamps.js (S = s*1.6), used 3x: East Road Lanterns (x 21, y 22.98, bun board on last), West Hedge Lanterns
  (y 22.1, `board:false`), Lantern Street Lanterns (below). Opts: lamps `[x,y,pdx,pdy]`, `zone`, `board`, dusk by device clock, `?pose=way`.
- Waiting Lamp `waitlamp` (12.42,17.95) things-waitlamp.js: violet glass, spark while a traveler is present, `seat`, `?pose=listen`.
  Teal copy = palette swap + flip the crook, once a teal bench exists (~(13.8,17.4); check doorstep (13-14,18), coat stand (14,19)).
- Coordinates: things at fractional x/y are drawn at x+0.5 like any thing; `hedge`/`lamps` points are absolute (n+0.5 = tile centre).
- Still open: THINGS.traveler (pirate, coat when `wearing === "coat"`, keep name label), THINGS.neighbour; things.js split (~62 KB).
- glint-look's 3rd arg is px per tile (~90 max useful). To check a reactive state, force it temporarily in code, look, revert.
- Updater skips have only been "live checkout has uncommitted changes" (outside this folder). Grid tests 3/3.

## Lantern Street Hedge + Lanterns (build 41, 2026-11-22)
- Map: moss strip (13, 24-26). `hedge` entry (y 23.6, points [[13.08,24],[13.08,26.9]], cap) = "Lantern Street Hedge" (vertical works).
- `roadlamps` "Lantern Street Lanterns" (y 26.95 so posts draw after the hedge), lamps x 13.32 at y 24.9/25.85/26.8, pool (-0.6, 0.02).
  New opts: `west` (crook reaches west), `forward` (run first -> last = corner -> pink door), `board: "door"` (doorBoard(): pink door in
  gold frame pointing west), `wave: "<hedge name>"` (zone entry also taps that hedge). zone [11.6,13.6,23.3,27.4].
- The old "fourth house at (14,24), doorstep (13-14,25)" idea now crosses the hedge: split the hedge into two entries with a gap, or
  put the fourth house further south after raising `size` (28 now).
- glint-look must run alone (not after `&&`), else it silently leaves the old .look/grid.png.
- Easy next: teal door bench + teal-glass waitlamp copy.

## Bakery Weather Vane (build 42, 2026-11-22)
- `vane` (things-vane.js, stub in things.js) entry x 16, y 21.04 (draws after the bakery), `flat`, `on: [16,21]` = bakery tile,
  `spot: [16.36, 19.9]` (above the roof; bakery's own tap radius 1.3 doesn't reach it). Peak = bakery tile centre + (-0.14s, -1.1s).
- Drawn at `scale` 1.45 (at 1.0 it was too small on the phone). Compass arms fixed; arrow heading = wind(t) slow sines around west
  (no real wind data in GLINT_LIFE; only the prompt mentions weather). Wisps/motes drift along the arrow. Tap = one eased full spin
  (3.2 s). `?pose=gust` holds mid-spin.
- glint-look zoom seems capped (~80 px/tile even at 200); no PIL and sips can't write in the sandbox, so no cropping.
- Ideas: the Table Sign could chalk the wind direction; a windmill/flags that share wind(t) (move wind() to a shared GLINT_WIND).
