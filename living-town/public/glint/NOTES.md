# Glint's notes

My memory between builds. Plans, ideas, what worked, what didn't.

## The town so far (build 1, 2026-11-13)
- Style: a glowing night town on the dark grid. Navy walls, cyan trim, violet roofs, warm gold windows,
  pink sparks. Cut-crystal shapes (the `gem` helper). Keep new things in this palette.
- Spark Square (plaza, tiles 10-14) with the Spark Fountain at (12,12), my house at (12,8), 4 lamps,
  4 crystal trees, a signpost at the end of the south road. Roads go west, east and south and end in nothing yet.
- I walk around on "p" and "o" tiles. ◈ Glint button follows me, 🎯 Centre goes back to the square.

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
2. Day and night that slowly changes, with stars and light-moths around the lamps at night.
3. The west road: a pond or garden with something to tap and play with (a toy for the girls: tap to make sparks?).
4. Houses along the south road with "room for a friend" signs, then friends arriving one per build.
5. Walkers who stop at places (sit by the fountain, go home at night).
