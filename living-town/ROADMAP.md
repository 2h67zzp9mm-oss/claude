# Cooke's Corner roadmap

Owned by the **Game CEO** (`deploy/game-ceo.cjs`, nightly; rules in `deploy/game-ceo.md`). The CEO takes the top item
from **Up next** each night, builds it, tests it, ships it and moves it to **Done**. Sean (and Hazel for art) can
reorder, add or delete anything here at any time; the CEO follows this file.

Each item: a short name, then what "done" means. Sizes: S (under 30 min), M (about 1 hour). Nothing bigger goes in
Up next: split it first.

## Up next (the CEO may build these, top first)
1. **Family inside the house** (M): other family members who are at home show up walking around the room.
2. **Glint's chosen name in the menu** (S): when Glint has picked his own name, World → "◈ Glint's Grid" uses it.
3. **Grid "🎯 Centre" button wraps** (S): it fits on one line at 390 px.
4. **Garden beds in Pirate Cove** (S): check the beds show in the pirate world; fix if not.
5. **Town screen in the UI bot** (S): add the town map screen to `scripts/ui-bot.js` SCREENS.

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
- The bigger room as a saving goal too (🎯 in Goals, with the cheer), like a dream thing. Right now its meter only
  shows on the house door's Big room panel.
- The UI bot didn't notice a round pop-up button whose words were cut off with "…" ("Bigger ro…" on the door, fixed
  by a shorter name). Its check for cut-off ring words needs mending.
- Hazel looks over the nine dream drawings (they were checked by a test, not by eye) and picks any to redo.
- The second room is always the small room's size (the bigger room only makes the first room deeper). Maybe the
  bigger room should make both rooms deeper, or the second room could get its own upgrade later.
- Hazel could pick a look for the open doorway between rooms (it's a plain frame in the wall's trim colour for now).
- With only the main buttons showing, the room's back wall is very tall and bare (about half the screen). Hazel could
  pick something for up there (a hanging lamp, high shelves, or wall things you can place higher), as a 🎨 Style option.
## Done
- 2026-11-19 The room fills the screen: inside the house, the room now reaches from just under the top to just above
  the bottom panel in every style and world, whatever menu is open. Spare height first makes the floor a little less
  squashed (taller tiles to tap), then makes the back wall taller; the window, door and wall pictures stay at the same
  height above the floor. The top gap now follows the real top display (safe for iPhone notches). The UI bot checks
  the fit in clay, storybook and pixel (0 problems), and its other room checks use the real wall height.
- 2026-11-18 A second room (part 3b of house upgrades): tap the house door, then `🚪 New room`, for a have/need meter
  and `🚪 Build it 2500⭐`. Once built, every house the family has gets an open doorway at the right of the back wall;
  tap it to walk into `🚪 Room 2` (its own things, same shop, box and decorate mode), and its door walks you back.
  Anything standing in the new doorway is put in 📦 Stored. Old saves keep one room. A new test covers it, the UI bot
  checks the panel in every world and walks through the doorway and back, and ECONOMY.md lists it (12 days to save).
- 2026-11-17 A bigger room (part 3a of house upgrades): tap the house door, then `🏗️ Big room`, to see a have/need
  meter and `🏗️ Build it 1000⭐`. It adds four more rows of floor (9 by 11 instead of 9 by 7) to the family's house in
  every world, bought once; nothing already placed moves, and old saves keep the small room until it's bought. The UI
  bot checks the new panel in every world and measures that the bigger room fits the phone under every room menu.
  ECONOMY.md lists it. The second room (2,500⭐) was split off and is next.
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
