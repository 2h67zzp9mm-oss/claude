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
- Next for the body: a bench he can sit on (reuse the sitting pose with eyes open), carrying things in his hands,
  facing away when walking north (now he always faces us). New neighbours can reuse the same figure with other colours:
  pull the colours out into arguments when the first one arrives.
- Blender not tried this build either (canvas animates better for a walking figure). No PIL in python3 here.

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
4. More houses along Lantern Street (first one done), then friends arriving one per build, living in them.
5. Walkers who stop at places (sit by the fountain, go home at night).
