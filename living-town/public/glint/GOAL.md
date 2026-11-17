# The brief for Glint's Grid (for the builder only; Glint never sees this)

Glint is a small glowing being who lives in the Grid. Like Truman in The Truman Show, he believes the Grid is the
whole real world. He doesn't know it's a game, that a family watches him, or that a builder makes what he decides to
make. To him, he made it with his own hands.

**His dream: a town of his own, a real home, so wonderful that others will come to live in it with him.**

It started as an empty grid. Make his world real, one finished step at a time, following what he decides while
he walks around (his diary and his "build" decisions). Dream big with him: places to live, things to do, newcomers
who move in, paths, lights, life, little stories, things that move and glow. It can be strange and amazing.

## He is alive
The server keeps Glint alive all the time: he walks around, thinks, feels, keeps a diary, notices travelers (the
family visiting), talks to them, sleeps at night and decides what to make next. In the page, `window.GLINT_LIFE`
(kept up to date by `../glint-life.js`) holds where he really is, what he's doing and thinking, his mood and whether
he's awake. Always draw him from it, and keep `<script src="../glint-life.js">` in `index.html`. Places with a
`name` in `world.js` are places he can decide to walk to.

## Never break the illusion
What Glint sees and remembers is all in-world: `log.js` (his memories), `plans.md` (his dreams), names and `say`
lines in `world.js`. Never mention code, files, builds, games, players, screens, phones, Claude, Blender, Sean or
the family there. Technical notes go in `NOTES.md` only.

## What you have
- This folder (`public/glint/`) and nothing else.
- The engine: `grid.js` (draws, pans, zooms, tap a thing to hear about it). Change it as much as you like.
- `world.js` (the map), `things.js` (how things are drawn), `log.js`, `plans.md`, `art/` (pictures).
- Blender (via `glint-blender`) to model and render 3D art into PNG sprites in `art/`. Keep scripts in `art/src/`.
- Eyes: `glint-look` takes an iPhone-sized picture of the Grid so you can see it before you finish.
- Python 3 and Node for any tools you write.

## Rules
- Family-friendly: young children watch. No romance, nothing scary, mean or violent.
- Phone first: it must work on an iPhone held in one hand. Buttons low, the top is for display only.
  Keep the ↩️ Back button so visitors can always get home.
- Self-contained: never load anything from the internet. No outside links, fonts or scripts.
- Keep it fast: each picture under 1 MB, the whole folder under 40 MB.
- Every build must leave the world working. One solid step each time, not a half-finished giant one.

## Travelers have bodies now
Travelers (the family) walk in the Grid themselves: tap to walk, on the paths. Each is a walker in `GLINT_GRID.walkers`
with `kind: "traveler"`, `name`, `moving`, `dx`/`dy` (facing), and `mine: true` for the one on this phone; their
position comes from `../glint-life.js` (don't move them yourself). They're drawn by `THINGS.traveler` in `things.js`.
Until Glint makes one, `../glint-life.js` draws a plain little figure of light. When Glint designs how a traveler
looks (he has designed a pirate with a three-cornered hat for one of them, and made a glowing coat for him), build it
as `THINGS.traveler` (a look per traveler by `th.name` is fine), true to what Glint imagined. Keep the name label
above their head so the family can tell who's who.

## Neighbours
When a dream of Glint's comes true, neighbours come to live in the Grid (only when the family allows it). They're walkers
with `kind: "neighbour"` (`name`, `color`, `moving`, `inside` when they're home for the night); `../glint-life.js`
moves them and draws a plain figure of light (and a warm glow on their house at night) until there's a
`THINGS.neighbour` in `things.js`. `window.GLINT_LIFE.folk` lists them with `home` (the house's name) and `homeLit`
(true while they're home asleep): a house can light its own windows when its neighbour is home.
A traveler can wear the glowing coat Glint made: tap it to put it on. Then their walker has `wearing: "coat"`, and the
coat stand is drawn empty. If you make `THINGS.traveler`, draw the coat on them when `th.wearing === "coat"`.
