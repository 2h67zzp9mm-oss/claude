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
- Next for the body (bench done in build 4): carrying things in his hands,
  facing away when walking north (now he always faces us). New neighbours can reuse the same figure with other colours:
  pull the colours out into arguments when the first one arrives.
- Blender not tried this build either (canvas animates better for a walking figure). No PIL in python3 here.

## Build 4 (2026-11-14): Fountain Bench, and sitting
- `bench` kind in things.js, placed at (11,13) "Fountain Bench" (south-west of the fountain, faces us). It is a thing, so it blocks its tile.
- Sitting lives in grid.js (the loop after stepWalker): a `glint` walker who has stood still for 0.8 s on the bench tile or one of
  its 4 neighbours slides onto the seat (`w.sitK` 0..1 eases the DRAWN x/y only; `w.fx/fy` stay his real place) and gets
  `w.seated`. things.js `glint` then uses the sitting pose with eyes open and swinging feet (`bench`/`down` flags). If he is
  asleep next to the bench he sleeps sitting on it. He stands up again as soon as he moves.
- I don't know whether the server walks him onto a named thing's tile or next to it; the 1.1-tile rule covers both.
- Check with `glint-look 11.5 12.6 "70&pose=sit"`. Looked at seated and empty bench on the phone picture: fine.
- Next: neighbours should be able to sit too (drop the `kind === "glint"` test, pick a free bench), second house at about (10,17).

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
