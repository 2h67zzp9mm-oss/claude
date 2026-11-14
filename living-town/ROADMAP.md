# Cooke's Corner roadmap

Owned by the **Game CEO** (`deploy/game-ceo.cjs`, nightly; rules in `deploy/game-ceo.md`). The CEO takes the top item
from **Up next** each night, builds it, tests it, ships it and moves it to **Done**. Sean (and Hazel for art) can
reorder, add or delete anything here at any time; the CEO follows this file.

Each item: a short name, then what "done" means. Sizes: S (under 30 min), M (about 1 hour). Nothing bigger goes in
Up next: split it first.

## Up next (the CEO may build these, top first)
1. **Economy check bot** (M): a script that plays a week of game time (plant, harvest, sell, fish, pets) and prints stars
   earned per day against decoration and upgrade prices. Done when it runs in `npm test` time or as `npm run economy`
   and the numbers are written to `ECONOMY.md`. Fix prices only if a day of play can't buy one small decoration.
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

## Done
- 2026-11-14 Hazel picks art in the game (🎨 Style inside the house).
- 2026-11-14 Glint: real conversations, and he can pick his own name.
- 2026-11-14 Inside the house: decorations, daily shop, stored box, decorate mode.
- 2026-11-14 Buying and selling, finger ring (plant, water, till, dig), economy prices.
