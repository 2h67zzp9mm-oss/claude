# UI rules for Cooke's Corner

One look for every screen, every menu and every world. The UI keeper (the `ui-keeper` agent) checks these after
every update with `npm run ui` (`scripts/ui-bot.js`) and fixes what's off. If a rule changes, change it here first.

## Who it's for
Sean's family on iPhones, including a 7-year-old. Everything must work one-handed, read at a glance, and feel
like a finished game, not a web page.

## Layout
- **Thumbs low.** Everything you tap lives in the bottom panel (`.home-bar`) or in the pop-up at your finger (`.home-pop`).
- **The top is display-only.** Name, level, streak and stars. Never a button up there.
- **Clean and compact.** The world is the star, so panels are as small as they can be and still read well: tight
  rows, short words, no filler sentences. The bottom panel hugs the bottom edge and stays under half the screen.
  Its buttons never move: if a panel is long, the part above the buttons scrolls and the buttons stay in view.
- The main bar and the Goals hub are a **dock** (`.home-actions.home-dock`): one row of picture buttons with a small
  word under each, and a little badge for a count.
- Nothing runs off the screen or scrolls sideways at 390 px wide. Respect the iPhone safe areas.
- Keep it uncluttered: at most six buttons on the main bar; deeper things go one tap down.

## Buttons
- At least 44x44 px to tap. Labels fit on one or two short lines and are never clipped.
- An emoji first, then one to three plain words: `🎣 Again`, `🧺 Give from bag`.
- One green main button (`.big`) per panel at most: the thing you most likely want.
- The way out is always the last button, and every panel and pop-up has one: `Back` in the bottom panel, `Done` in a pop-up.
- Tapping any bottom-panel button closes an open pop-up, so a pop-up never sits over a menu.
- Long names (house names) go two across with `.home-actions.wide` instead of wrapping onto three lines.

## Panels
- Built from the shared pieces only: `.home-title`, `.home-actions`, `.home-goals` rows (`.home-goal`, `.done`),
  `.home-meter` progress bars, `.home-say` speech, `.fish-book` / `.fish-card` grids, `.home-chip` pills for things
  you hold (seeds, crops, fish), `.home-banner` for good news, `.home-head` for a panel's name with a short note
  on the right.
- Rows are made with `row(icon, words, right side, done)` in `public/homestead.js`: the picture in its own column,
  the words, then the meter and the small text. A finished row turns green and its picture becomes ✅. Locked things say `🔒 Level N`.
- Inside the house (`public/house-room.js`) reuses the same top, bottom panel and pop-up. Its own pieces:
  `canvas.house-room` (the room, drawn under the panels), `.room-picks` (stored things to put out, in the part of the
  panel that scrolls) and `.home-pop.room-ring` (`↻ Turn`, `📦 Store`, `Done` on the thing you picked, one row).
- A new menu reuses these. If it truly needs a new piece, add it once in `public/map.css` and list it here.
- Progress is always shown the same way: `have/need` in small text, plus a meter when there's room.
- Rewards are always written `+N⭐` (and `🍪` for treats). Prices and what you have are `N⭐`, no space.

## Full-screen editors (the Look editor)
- The preview stays on top, the choices scroll in the middle, and `Back` and the green `Save` stay pinned at the
  bottom (`.look-foot`). Saving or going back returns you to where you came from.
- Colour dots are 44x44 to tap, like everything else.

## The same in every world
- Worlds change the scenery, never the UI. No per-world UI colours, fonts, shapes or button names.
- Every menu must exist and look the same in every world (a house picker only where the world has houses).
- Panels must stay readable over every world's colours, dark (Night Forest, Pirate Cove) and light (Clay, Cloud Castle).

## Words
- Short, warm and plain enough for a 7-year-old. No jargon, no long sentences, no romance, nothing scary.
- Say what to do next, not what went wrong: "Grow or catch something to sell!"

## Feel
- Every tap answers: a sound, a little burst, a number floating up, or a banner.
- Banners are for good news only and never cover the buttons.

## When something new is added
1. Add the new menu to `SCREENS` in `scripts/ui-bot.js` (new worlds are found by themselves).
2. Run `npm run ui`, look at the pictures, fix until it prints 0 problems.
3. Run `npm test`.
