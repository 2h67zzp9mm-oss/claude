# Little Town playtest notes (2026-11-10/11)

**How it was tested.** Headless Chrome at iPhone size (390x844, touch, 2x). Screenshots are in
`/private/tmp/claude-501/-Users-sean-Games/adc8dba7-96ea-4f1b-967a-746f6425cdb8/scratchpad/lt-playtest/shots/`
(shortened to `shots/` below).

- **Live, as a guest.** I went through the gateway's "Visit as a guest" page. It asks for an access code or guest pass, and I didn't use one. Then I opened the live app behind the gateway, which is what a guest sees after the code: watch only. It was 11:49 pm, so everyone was asleep and nothing happened live.
- **To actually play without touching the family world**, I ran a throwaway copy of the server from the same code on port 4399. It used a copy of `town-state.json` in scratch. I made my own owner PIN there (no family accounts or sessions were copied) and set the clock to afternoon. Then I played as "Sean" for about 30 minutes: Today, favours, the acorn hunt, social actions, interiors, Travel, the editor and the feed.
- The copy has been stopped and its data deleted. Nothing in the project, the live data or the live servers was changed. The live server PID is unchanged.

---

## 1. Top 5 changes

### 1. Fix the Corner Market crash. It freezes the whole town and can lock a kid out.
**Why.** Tapping **Today → "Browse the market"** (one of the six main cards), or walking into the market, throws
`TypeError: Cannot read properties of undefined (reading 'id')` at `seatAt` (`shared/interiors.js:605`, called from `placeHousehold`).
- This happens inside the `requestAnimationFrame` loop, so the whole client stops: the market shows an empty brown box, the clock stops and the map never redraws (`shots/26b-market-inside.jpg`, `shots/28c.jpg` shows the clock still at 2:56 a minute later).
- **Reloading doesn't help.** While your character is in the market, every load opens straight into the broken interior with "--:-- Loading town" (`shots/29-hunt-start.jpg`). I only got out by tapping "‹ Town" and then tapping the frozen map blind to walk away. A kid would think the game is broken.

**Cause.** The player's activity "looking around Corner Market" doesn't match any market activity. The fallback is `byId("sofa") || byId("armchair") || objects.find(obj => obj.seats)`, and the market has none of those, so `seatAt(undefined)`.

**Fix.**
- Guard `seatAt` and fall back to a floor spot near the entrance (`snapInside`).
- Wrap `drawInterior`/`frame` in try/catch so one bad draw can never kill the loop.
- Add a test that runs `placeHousehold` for every plan with an unknown activity.

### 2. Make the top of the screen display-only, and stop it hiding the action
**Why.** The name pill and the purple event banner sit over the map at y≈96–145, and the banner is a button. This breaks the thumb-layout rule and also blocks play.
- The acorn hunt items in Juniper Park are at the top edge of the map, which clamps there. **4 of 6 acorns sat behind the banner.** Tapping them opened the Today card instead (`shots/35-at-park.jpg`, `shots/36-acorns-visible.jpg`). I only got them after zooming to about 3x and dragging (`shots/39-zoomed-park.jpg`).
- Labels and speech bubbles are also clipped under the pill ("Moonbeam Cafe", "Juniper Park").

**Fix.**
- Move the event banner into the bottom area, as a chip just above the dock. Keep only the clock and town name at the top.
- Let the camera clamp allow about 150px of overscroll at the top.
- Keep hunt items away from map edges.

### 3. Make the hunt and favour targets thumb-sized, and show where they are
**Why.**
- A hunt item counts as tapped within 10 map px. At the default zoom (0.9) that is a target about 18px across, well under the 44px guideline. A tap 20px off just walks you there.
- Tapping a person picks whoever is drawn in front. Residents often stand on top of each other (Hazel under Plum in `shots/49-chat2.jpg`), so I tapped Hazel and told **Plum** the joke.
- A favour target inside a building (Nova "in" the market) can't be tapped on the map at all. The only way to reach her was Today → Find.

**Fix.**
- Use a radius of at least 22 screen px for hunt items, scaled by zoom, and add a gentle bob or sparkle.
- When a tap hits two people, show a small "Who?" picker with their two faces.
- Add a **Talk** button on the resident sheet, so you can reach anyone you can see listed.
- Add an arrow at the screen edge pointing to off-screen ❗ and hunt items.

### 4. Give friendship, needs and stars a reason to matter (consequences and depth)
**Why.** In the live save, Sean, Olive and Hazel each have **friendship 100 with every Little Town resident**. NPC needs sit at 70–100 (Nova: hunger 100, fun 100, social 98).
- Every social action returns "liked that!" (`shots/49-chat2.jpg`). Tease can't really backfire when everyone is a best friend.
- Stars (Sean has 411) buy nothing.
- The sticker book is a flat wall of 60 duplicate emoji with no names, no sets and no count (`shots/13-today-stickers.jpg`).
- So there's no "easy but hard" layer: nothing to lose, aim for or work toward.

**Fix.**
- Let friendship slowly drift without contact, so you have to keep it up. Then bands like "Missing you" and "Close friend" mean something.
- Make the sticker book a real album: 15 event slots plus 1 per resident, greyed until earned, with "x3" counts and a "2/15 this week" line.
- Give stars one sink that changes the world, not a shop. For example, vote stars toward a town project (a bench, a stall or a new flower bed at the fountain) that everyone sees getting built.

### 5. Simplify the dock and the confusing extras for kids
**Why.**
- The dock has 6 buttons in a 5-column grid, so **Stories wraps to a hidden second row**. Only its ✦ icon peeks out at the bottom edge, under the home indicator (`shots/04-live-watch.jpg`, dock scrollHeight 82 vs clientHeight 69).
- **People** doesn't list people. It just opens the sheet of whoever is selected. **Stories** opens the same sheet, where the feed is about 1,200px down.
- **Tron** ("caretaker… helps you decide what to improve") is a developer chat sitting in a kid's main menu.
- **Travel** sends you to a different town that still says "Little Town" in the header and reuses the same place names (Juniper Park, Finn's Cottage, Workshop). The family disappears and only strangers (Moss, Nell) are around.
  - The live save already has Sean parked in "Copper & Clover", so in my copy I started in the wrong town and couldn't work out why Milo, Zara and the kids were missing (`shots/43-travel.jpg`).
  - Coming home says "Welcome to your new destination."

**Fix.**
- Use 4 dock buttons: **Town · Play · People (a roster with faces, ❗ badges and where each person is) · Today**.
- Move Tron and Travel into the profile menu, owner-only for now.
- Show the current town's name in the header.

---

## 2. Bugs found

| # | Bug | Repro | Evidence |
|---|---|---|---|
| B1 | **Market interior crash freezes the client and soft-locks on reload** (see Top 5 #1) | Play mode → banner → "Browse the market" → wait until you arrive. Console shows the TypeError at `interiors.js:605` and the town stops updating. Reload: it opens straight back into the broken market. | `shots/26b-market-inside.jpg`, `shots/29-hunt-start.jpg`, `shots/55-market-via-today.jpg` |
| B2 | Hunt items under the top banner can't be tapped. The tap opens Today instead. | Go to the acorn hunt in Juniper Park at default zoom and tap an acorn just below the purple banner. | `shots/35-at-park.jpg`, `shots/36-acorns-visible.jpg` |
| B3 | A collapsed resident sheet keeps its scroll position. The header and the expand ⌃ button scroll out of view, so you see random "FEELING" chips and have no button to reopen it. | Tap ⌃ → scroll the sheet down → tap ⌄ to collapse. | `shots/61-collapsed-after-scroll.jpg`, `shots/19-recenter.jpg` |
| B4 | Stories wraps to a hidden second dock row, clipped at the bottom. | Any load at 390x844. | `shots/04-live-watch.jpg`, `shots/11-sandbox-first-play.jpg` |
| B5 | A favour's words contradict the resident's mood: Nova's favour says "I'm feeling a bit down, could you say something nice?" while her sheet says **Mood: Delighted**, fun 100. | Today → Favours → Find Nova, then open her sheet. | `shots/14-find-nova.jpg`, `shots/16-people.jpg` |
| B6 | Your own character walks off to work by itself whenever the socket drops (phone lock, app switch, reload). Opening the app again doesn't take control back until you tap. The README says players' characters are never moved. | Play, walk somewhere, reload → within seconds "Walking to Workshop · Why: work hours". | `shots/29-hunt-start.jpg` (sheet), `shots/31-hunt-on.jpg`, `shots/59-stories.jpg` |
| B7 | The resident sheet line for the player goes stale: it showed "Walking to Workshop" while the server said "looking around Corner Market". | Walk somewhere via a sign and compare the sheet with where you are. | `shots/22-walk-market.jpg` |
| B8 | "Ask what they wish for" on someone with no wishes is shown as a rejection: "Tumble wasn't keen this time." | Ask Tumble (empty `wishes`). | social-result in the session log |
| B9 | Accepting a favour closes the menu, so you have to find the person again to do the actual thing (the compliment). For a resident who is indoors, the only route back is Today. | Accept Nova's compliment favour. | `shots/15-accepted.jpg` |
| B10 | Some favours complete the moment you accept, with no effort: Finn's "see if the flowers at the Corner Market are out" paid instantly because I was standing there. | Accept a "go and look" favour while already at that place. | reward message, +2 ⭐ and Finn's carved bird |
| B11 | Other towns reuse Little Town's header and place names. The return message says "Welcome to your new destination." | Travel → Little Town. | `shots/43-travel.jpg`, `shots/44-back-home.jpg` |
| B12 | The character editor title reads "Who's visiting town?" because it reuses the login card. | ✎ on your sheet. | `shots/56-editor.jpg` |
| B13 (gateway, minor) | At `127.0.0.1:4316/little-town/guest` the gateway serves the login page again, because the path isn't stripped. It works on the public URL, so this only matters for local testing. | Open the local link. | `shots/02-guest-code.jpg` |

No other console errors showed up in about 30 minutes of play. The live watch-only load was clean.

---

## 3. Phone and UI problems

- **The top of the screen is busy and interactive.** Profile button (top-left), name pill, event banner (a button), "‹ Town" and "Upstairs/Downstairs" inside houses are all at the top, and the social menu's ✕ is near its top. Move these actions low. "‹ Town" could become a dock button while you're indoors.
- **Small targets:**
  - Dock buttons are 75x38.
  - Sheet ✎ and ⌃ are 36x36, and the social ✕ is 30x30.
  - Skin swatches are 32x32.
  - Hunt items are about 18px.
  - "Just watch the town" on the gate is a thin text link.
- **The social menu is semi-transparent.** The resident sheet text shows through behind the bottom row ("Rearranging a display…" behind Invite/Tease/Say sorry, `shots/14-find-nova.jpg`). Make it opaque.
- **Toasts cover the sheet header** (`shots/15-accepted.jpg`). Put them above the sheet or near the top as display only.
- **There's wasted space.**
  - The map ends about 40px above the sheet, leaving a dark band.
  - Inside buildings, the interior is drawn in the top half, with about 350px of empty brown below the hint text (`shots/31-hunt-on.jpg`). Scale the interior up to fill the width and height, and put the room's actions low.
- **Labels and bubbles clip at the screen edge** ("Moonb…", "Milo & Zara's · 2 z…", a cut-off speech bubble in `shots/19-recenter.jpg`). The banner text is cut off too ("· 6/6 f…").
- **In Play mode the camera snaps back to your character 4 seconds after you pan.** Looking around the map for ❗ or items keeps getting yanked back. Hold the pan until the next tap or until ⌖ is pressed.
- **The resident sheet uses adult and developer language:** "Planning ahead · Taking care of the moment", "4848 plans completed · 64 recent learning moments · adaptive planner", plus energy, hunger, social and fun bars. The feed has lines like "Patches organized neighbors around a simple shared problem" and "learned that an apology works better when it includes changed behavior". Hide the planner block for the kids, and keep feed lines concrete and about people they know.
- **Sprites overlap** despite the personal-space rule: Hazel and Plum, Sean and Mr. E (`shots/49-chat2.jpg`, `shots/61-collapsed-after-scroll.jpg`). In Copper & Clover the player stood on a bakery roof during the hunt (`shots/40-after-hunt.jpg`).
- **Good things worth keeping:**
  - The painted maps are lovely.
  - The interiors read well, and Upstairs works (`shots/44-back-home.jpg`, `shots/46-stairs.jpg`, `shots/53-cafe.jpg`).
  - The social grid sits low, with big buttons.
  - The Today cards are big and clear.

---

## 4. Fun and depth: what's missing for long-term play

- **No first-time guidance.** A new player lands on the map with a toast saying "Playing as Sean". Nothing says "tap the purple banner", "❗ means someone needs you" or "tap the ground to walk". Add a 3-step coach that disappears on first use: tap to walk → tap someone → open Today.
- **A guest can't actually play.** After entering a code, a guest only gets three family PIN cards and "Just watch the town" (`shots/03-live-first-load.jpg`). If guests (cousins, friends) are meant to play, they need a temporary visitor character, perhaps staying at Rose Cottage and removed at midnight.
- **The day ends after one loop.** Doing a hunt and two favours takes about 10 minutes, and after that there's nothing new. Gatherings are just "stand there", and the only effort a hunt takes is finding where to tap. Most events (7am–3pm) happen while the girls are at school, and the only riddle is at 10am.
- **Social actions are thin.** The lines are canned and always positive ("Hi! How's your day going?" / "Pretty good, thanks for asking!"). Rock-paper-scissors is decided for you (fine, no mini game), but the reaction is still "liked that!" even when Tumble wins.
- **No consequences.** Friendships are maxed, needs refill, there are no stakes and nothing decays where you'd notice. Sandbox ideas that fit your taste (no mini games):
  - **Things you leave in the world stay there.** Plant a flower bed and it grows over real days, wilting if nobody waters it. Chalk drawings stay until rain. Gifts sit on a resident's shelf in their room.
  - **Residents remember and act on what you did.** If you skip Hazel's favour three times she asks someone else and mentions it. If you invite Tumble and don't show up, he's a bit hurt tomorrow. The engine already has memories and wishes, but there isn't yet any visible payoff a kid can see.
  - **Town projects** that cost the whole family's stars and change the map (see Top 5 #4).
  - **Per-kid goals**, for example "Help Finn finish his boat (3/5 parts)", lasting several days. This is depth without a mini game.
- **Reasons to come back tomorrow.** Today the pull is "a new event every hour" and "favours refresh". Stronger pulls:
  - A **daily postcard from Mr. E** saying what changed overnight. The "While you were away" card exists in the HTML, but I never saw it.
  - Plants and projects that progress between visits.
  - Birthdays as events the kids can prepare for: bring a gift, decorate.
  - A weekly sticker page to fill.

---

## 5. Quick wins (under an hour each)

1. Guard `seatAt` and add a try/catch around the frame's `drawInterior` (B1). About 15 minutes, and it removes the worst bug.
2. Fix the dock to `grid-template-columns: repeat(6,1fr)`, or drop Tron and Travel from it (B4).
3. Reset `residentSheet.scrollTop = 0` on collapse (B3).
4. Make the social menu background opaque, and move toasts above the sheet.
5. Raise the hunt tap radius to at least 22 screen px, and keep hunt item spawns at least 60 map px from the map's top edge (B2).
6. Hide the "Planning ahead / plans completed / adaptive planner" block unless the role is owner.
7. Show the town name in the header when you're away from home. Change "Welcome to your new destination" to "Welcome home!" when going back to Little Town.
8. Change "wasn't keen" to "isn't sure what they want yet 🙂" when there are no wishes (B8).
9. When a favour is accepted, run its action straight away ("I'll help!" → does the compliment), instead of closing the menu (B9).
10. Name the stickers under each emoji (the data already has `k.name`) and group duplicates as "🎺 x7".
11. Re-take control on reconnect if the player was in Play mode, so the character doesn't wander off to work (B6).
12. Pick favour text by mood: don't use "I'm feeling down" when the resident is Delighted (B5).
13. Change the editor title from "Who's visiting town?" to "Customize Sean" (B12).

---
## Fixed 2026-11-11 (live, not committed: the checkout has other uncommitted work mixed into these files)
- B1 market crash: `placeHousehold` falls back to a spot by the entrance; the frame loop survives a bad draw (`public/client.js`). New `test/interiors.test.js`.
- B2 and top-5 #2: the event banner now sits low, above the resident sheet, instead of over the map's top edge.
- B4: the dock fits all six buttons, so Stories is no longer cut off.
- The service worker cache version is now actually stamped (`replaceAll` in server.js), so phones drop old caches on update.
- Known pre-existing test failure: playable-spine test (service worker path check), unrelated.
- Round 2 (2026-11-11): hunt items tap within 24 screen px (nearest wins) and draw bigger; a "Who?" picker when a tap hits two people; a dropped connection holds your character for 30 min (explicit Town/release still frees it); repeat actions on the same person lose effect; "Give a gift (5⭐)"; friendship keepsakes at 50 and 85; friendships with players fade 6/day after a day apart (floor 30, family 60); sticker book grouped with names and counts; toast shows 💗 change.
