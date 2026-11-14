# Cooke's Corner roadmap

Owned by the **Game CEO** (`deploy/game-ceo.cjs`, nightly; rules in `deploy/game-ceo.md`). The CEO takes the top item
from **Up next** each night, builds it, tests it, ships it and moves it to **Done**. Sean (and Hazel for art) can
reorder, add or delete anything here at any time; the CEO follows this file.

Each item: a short name, then what "done" means. Sizes: S (under 30 min), M (about 1 hour). Nothing bigger goes in
Up next: split it first.

## Up next (the CEO may build these, top first)
1. **Big things to save up for, part 1: the dream items** (M): add about 8 special decorations at 500⭐ to 2,000⭐
   (e.g. a fountain, a treehouse bed, an aquarium wall, a piano, a big telescope; one or two per world, family-friendly,
   original). They are always in the shop under a "⭐ Dream" row, not part of the daily rotation, and each can be bought
   once per family. Use the house's current art style; Hazel can pick nicer art later. Update ECONOMY.md.
2. **Big things to save up for, part 2: a saving goal** (M): in the shop you can tap a dream item to make it your goal;
   the Goals panel then shows a `have/need` meter for it, and a `.home-banner` cheers when you can afford it.
   Keep UI_RULES.md (one green button, Back last). UI bot passes.
3. **Big things to save up for, part 3: house upgrades** (M): a bigger room (more floor space) at 1,000⭐ and a second
   room at 2,500⭐, bought from the house door pop-up. Saves stay safe (old houses keep the small room until upgraded).
4. **The room fills the screen** (M): the inside of the house uses the whole space between the top and the bottom panel
   on a phone, in all three styles (clay, storybook, pixel). Room bot still passes.
5. **Family inside the house** (M): other family members who are at home show up walking around the room.
6. **Glint's chosen name in the menu** (S): when Glint has picked his own name, World → "◈ Glint's Grid" uses it.
7. **Grid "🎯 Centre" button wraps** (S): it fits on one line at 390 px.
8. **Garden beds in Pirate Cove** (S): check the beds show in the pirate world; fix if not.
9. **Town screen in the UI bot** (S): add the town map screen to `scripts/ui-bot.js` SCREENS.

## Ideas (need Sean's OK before they move up)
- Kids can talk to Glint in the Grid (owner only right now).
- Nicer furniture art for the house once Hazel's style picks settle.
- Tilling doubles sunflowers, watermelons and pumpkins (1 becomes 2). Maybe it should be worth less on those.
  (Sean, 2026-11-14: prefers bigger things to save for over slowing stars; left here in case it's still too fast.)

## Done
- 2026-11-14 Economy check bot: `node scripts/economy-bot.js` plays a week two ways and writes `ECONOMY.md`. Every day
  buys a small decoration, so no prices changed. `npm test` fails if `ECONOMY.md` is out of date.
- 2026-11-14 Hazel picks art in the game (🎨 Style inside the house).
- 2026-11-14 Glint: real conversations, and he can pick his own name.
- 2026-11-14 Inside the house: decorations, daily shop, stored box, decorate mode.
- 2026-11-14 Buying and selling, finger ring (plant, water, till, dig), economy prices.
