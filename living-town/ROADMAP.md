# Cooke's Corner roadmap

Owned by the **Game CEO** (`deploy/game-ceo.cjs`, nightly; rules in `deploy/game-ceo.md`). The CEO takes the top item
from **Up next** each night, builds it, tests it, ships it and moves it to **Done**. Sean (and Hazel for art) can
reorder, add or delete anything here at any time; the CEO follows this file.

Each item: a short name, then what "done" means. Sizes: S (under 30 min), M (about 1 hour). Nothing bigger goes in
Up next: split it first.

## Up next (the CEO may build these, top first)
1. **Big things to save up for, part 3: house upgrades** (M): a bigger room (more floor space) at 1,000⭐ and a second
   room at 2,500⭐, bought from the house door pop-up. Saves stay safe (old houses keep the small room until upgraded).
2. **The room fills the screen** (M): the inside of the house uses the whole space between the top and the bottom panel
   on a phone, in all three styles (clay, storybook, pixel). Room bot still passes.
3. **Family inside the house** (M): other family members who are at home show up walking around the room.
4. **Glint's chosen name in the menu** (S): when Glint has picked his own name, World → "◈ Glint's Grid" uses it.
5. **Grid "🎯 Centre" button wraps** (S): it fits on one line at 390 px.
6. **Garden beds in Pirate Cove** (S): check the beds show in the pirate world; fix if not.
7. **Town screen in the UI bot** (S): add the town map screen to `scripts/ui-bot.js` SCREENS.

## Ideas (need Sean's OK before they move up)
- Kids can talk to Glint in the Grid (owner only right now).
- Nicer furniture art for the house once Hazel's style picks settle.
- Tilling doubles sunflowers, watermelons and pumpkins (1 becomes 2). Maybe it should be worth less on those.
  (Sean, 2026-11-14: prefers bigger things to save for over slowing stars; left here in case it's still too fast.)
- The test "Mr. E: owner can ask for a surprise" failed once with a server error and passed on the next run
  (2026-11-15). Worth finding why it wobbles.
- Let the nightly CEO run `node scripts/room-bot.js` and `npm run lint` (both are blocked for it; only `npm test` and
  `npm run ui` run), or fold the room bot's checks into the UI bot.
- A saving goal can only be picked in the world that sells it; a "you're saving for…" note on the shop's first row
  when the goal lives in another world would help.
- Hazel looks over the nine dream drawings (they were checked by a test, not by eye) and picks any to redo.

## Done
- 2026-11-16 A saving goal: in the house shop, tap a ⭐ Dream thing you can't pay for yet and it becomes your goal
  (🎯, one each for Sean, Olive and Hazel; tapping another swaps it). 🎯 Goals shows a `have/need` meter for it, a
  banner cheers when you have enough, and the thing turns green in the shop. The UI bot now checks all of this in
  every world. The room bot was extended too but still can't be run by the nightly CEO (it isn't allowed to start it).
- 2026-11-15 Dream items: nine big things at 500⭐ to 2,000⭐ (fountain, grand piano, aquarium wall, treehouse bed,
  giant telescope, plus a rocket, dragon, glow tree and ship in their own worlds) in a "⭐ Dream" row in the house
  shop, always there, one of each per family. The shop list now scrolls with Back pinned. ECONOMY.md has a dream row.
  The room bot was extended to buy and place a fountain but could not be run this night (see report).
- 2026-11-14 Economy check bot: `node scripts/economy-bot.js` plays a week two ways and writes `ECONOMY.md`. Every day
  buys a small decoration, so no prices changed. `npm test` fails if `ECONOMY.md` is out of date.
- 2026-11-14 Hazel picks art in the game (🎨 Style inside the house).
- 2026-11-14 Glint: real conversations, and he can pick his own name.
- 2026-11-14 Inside the house: decorations, daily shop, stored box, decorate mode.
- 2026-11-14 Buying and selling, finger ring (plant, water, till, dig), economy prices.
