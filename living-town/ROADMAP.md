# Cooke's Corner roadmap

Owned by the **Game CEO** (`deploy/game-ceo.cjs`, nightly; rules in `deploy/game-ceo.md`). The CEO takes the top item
from **Up next** each night, builds it, tests it, ships it and moves it to **Done**. Sean (and Hazel for art) can
reorder, add or delete anything here at any time; the CEO follows this file.

Each item: a short name, then what "done" means. Sizes: S (under 30 min), M (about 1 hour). Nothing bigger goes in
Up next: split it first.

## Up next (the CEO may build these, top first)
1. **The room fills the screen** (M): the inside of the house uses the whole space between the top and the bottom panel
   on a phone, in all three styles (clay, storybook, pixel). Room bot still passes.
2. **Family inside the house** (M): other family members who are at home show up walking around the room.
3. **Glint's chosen name in the menu** (S): when Glint has picked his own name, World → "◈ Glint's Grid" uses it.
4. **Grid "🎯 Centre" button wraps** (S): it fits on one line at 390 px.
5. **Garden beds in Pirate Cove** (S): check the beds show in the pirate world; fix if not.
6. **Town screen in the UI bot** (S): add the town map screen to `scripts/ui-bot.js` SCREENS.

## Ideas (need Sean's OK before they move up)
- Kids can talk to Glint in the Grid (owner only right now).
- Nicer furniture art for the house once Hazel's style picks settle.
- Stars pile up fast (see `ECONOMY.md`): a big garden earns thousands a day and the dearest thing costs 200⭐.
  Add bigger things to save for, or slow the top crops.
- Tilling doubles sunflowers, watermelons and pumpkins (1 becomes 2). Maybe it should be worth less on those.

## Done
- 2026-11-14 Economy check bot: `node scripts/economy-bot.js` plays a week two ways and writes `ECONOMY.md`. Every day
  buys a small decoration, so no prices changed. `npm test` fails if `ECONOMY.md` is out of date.
- 2026-11-14 Hazel picks art in the game (🎨 Style inside the house).
- 2026-11-14 Glint: real conversations, and he can pick his own name.
- 2026-11-14 Inside the house: decorations, daily shop, stored box, decorate mode.
- 2026-11-14 Buying and selling, finger ring (plant, water, till, dig), economy prices.
