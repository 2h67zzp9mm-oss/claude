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

## Builds 41-43 (short)
- Lantern Street Hedge: moss (13,24-26), vertical `hedge` (y 23.6). "Lantern Street Lanterns" `roadlamps` y 26.95, opts `west`, `forward`,
  `board: "door"`, `wave: "<hedge name>"`, zone [11.6,13.6,23.3,27.4]. Fourth house idea now crosses the hedge (split it or go further south).
- `vane` things-vane.js on the bakery roof, exposes `window.GLINT_WIND` (heading, radians; slow sines, no real data), `?pose=gust`.
- `mill` things-mill.js "Glass Windmill" (18.1,19.5) scale 1.25 on moss (18,20); angle integrated in th.ang; tap whirl, `?pose=whirl`.
- glint-look must run alone (not after `&&`), else it silently leaves the old .look/grid.png. No PIL; sips can't write (sandbox).

## Builds 44-49 (short)
- `lampsong` (14,10.01) bell on the Humming Lamp, publishes `window.GLINT_SONG = {since,bx,by,step}`; lamps in `heads()` bloom at
  dist*step (new singing lamps: add to heads()). `tealamp` (14,17.01); Teal Door Bench `bench wood one teal` + `lanternLight()`.
  `flags` things-flags.js (17.4,21.06), `from`/`to` absolute, answers GLINT_SONG. Web Audio unlocked on pointerup (iOS).
- North: Meadow moss (11-17,0-4); path (13,9)-(14,9) then North Road x=14 y 2-9 (Humming Lamp at (14,10) blocks walking).
  North Road Lanterns `roadlamps` (15.05, 5.4/3.6). `cairn` things-cairn.js (14,1) scale 1.6, far stars `th.stars` (y<0), `?pose=climb`.
  Map touches y=0: growing north means shifting everything down (start, coords, absolute points, zones, spots); prefer sideways.
- Build 49: path (13,2). "Star Lookout" `bench wood night blanket` (12.8,1.55) scale 1.35 seatX -0.24 (new woodbench opts:
  `night` palette + gold stars on both cushions; `blanket` folded on the back, fringe on GLINT_WIND). `spyglass` things-lookout.js
  "Star Spyglass" (11.55,1.45): tap = shooting star `from`->`to` (absolute) + burst + giggle bells; auto star every 40 s at dusk; `?pose=wish`.
- Pose check keeping glint-look's camera: temporary `<script>history.replaceState(null,"",location.search+(location.search?"&":"?")+"pose=X")</script>`
  before glint-life.js, look, then delete it.
- Next ideas: lantern by the Star Lookout (into heads()), wish-card box, meadow paths west/east, grinding stone at the mill,
  teal mat (13-14,18), pink door lantern. things.js is ~63 KB: split it next time it grows.

## Builds 50-51
- `chimes` things-chimes.js "Giggle Chimes" (16.1,2.6) scale 1.3: canvas only; sway from breeze sum + GLINT_WIND; walker within 2.2 = tinkle;
  answers GLINT_SONG visually (not in heads()); tap = giggle notes, `?pose=giggle`. Lesson: draw all "lighter" glows first, then solids.
- `wishlamp` things-wishlamp.js "Wish Lantern" (12.8,0.9) scale 1.3, right behind the Star Lookout bench (draws before it; post base hidden
  by the bench back). Crook leans west, night-blue lantern (inner ctx.scale 1.4) hangs over the left cushion. Wish Box on the post.
  In heads() at [x+0.08, y-0.37]. GLINT_OVER draws the light pool on the cushions, the flying card (box -> lantern -> sky, 5 s) and
  "wish stars" (th._wishes, 60 s, max 6, in memory only). Tap point `spot` [12.9,0.5]. `?pose=wishcard` holds the card mid-flight.
- Still free in the North Meadow: east (16-17, 0-1), (15-17, 3-4); west (11-12, 3-4). Ideas: meadow paths west/east,
  a shape made of wish stars, grinding stone at the mill, teal mat (13-14,18), pink door lantern. things.js ~63 KB: split when it grows.
