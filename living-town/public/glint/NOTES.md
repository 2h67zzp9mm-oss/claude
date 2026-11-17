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

## Welcome Arch (build 17, 2026-11-17)
- `kind: "arch"` at (12,20), `flat: true` (walk under it), r 1.5. Posts drawn one tile either side ((11,20),(13,20) are moss,
  so not walkable). Violet curved band, gold board "KINDLE'S" (canvas text, carved look), pink crown gem, lamp on each post.
- grid.js: arch reacts like a mat (walker on its tile sets `tapped`, 4 s); letters light one by one, sparks lift off the lamps.
  `?pose=welcome` holds the arch letters lit too.
- Map: Signpost moved (12,19) -> (10,19) (moss (10-11,19-20)); Lantern Street path extended to (12,21) through the arch.
  The road south of the arch is open for whatever comes next (stars were wished for but never built; no star code exists).

## Gate trees (build 18, 2026-11-17)
- `kind: "tree"` with `gate: -1|1` (side of the arch) -> `gateTree()` in things.js draws extras: flower ring at the foot,
  gold blossoms, a bough with 3 hanging lights reaching toward the arch. Chimes (glow + falling petals, 4 s) when the arch
  is `tapped` (walk-under or touch) or the tree itself is tapped. `?pose=welcome` shows it.
- Placed at y=21, not y=20: at (14,20) the canopy hid the Glowing Coat stand (14,19) and at (10,20) the Signpost.
  A tree's canopy covers about 1.6 tiles above its own tile, so check what's north of any new tree.

## Still open
- First Little House: teal `door` ["#6dffc6", "#27c9c2", "#0f6a72"], `settled: true`, a teal mat (`x:14, y:18, ox:-0.36, flat`),
  lit path + flowers on the east side (free moss at (13,16)); the sign at (13,15) is in the way of a path there.
- THINGS.traveler (pirate look, coat when `wearing === "coat"`, keep name label), THINGS.neighbour.
- Bench by the Door Lamp, more street trees up toward the square, a lit path/hedge past the gate trees, third house (pink roof), bakery on the east road, stars in the sky.
