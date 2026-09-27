# Living Town — Working Log

## North star

Build a warm, persistent town that Olive and Dad can create characters in, visit, and watch. The town should feel alive even after nobody has opened it for a while.

## Locked scope for prototype 1

- 2D, readable on Mac, iPhone, and TV-sized screens
- One town and one shared canon
- Real-world time by default
- Residents have routines, needs, relationships, and bounded memories
- Observer mode should feel like checking in on an episode
- Safe failure: nobody dies in this prototype
- Full-world reset is the only rollback for now

## Build 0.1 — 2026-09-23

Implemented a playable browser prototype with six residents, six town locations, schedules, needs, movement, social encounters, memories, observer controls, local persistence, and offline catch-up.

## Shared World 0.2 — 2026-09-23

Moved the simulation out of each browser and into one continuously running Node.js server intended for Mouse. Browsers now connect through WebSocket to the same canonical town. State saves to one server-owned JSON file with atomic writes, 20 rotating backups, schema checking, corrupt-primary recovery, and an exclusive writer lock.

Independent audit found and fixed three issues in the first server package:

1. Disconnected clients could leave a resident permanently controlled.
2. Controller claims were being stored in durable state and could return after a crash.
3. The first lock implementation had a race and could allow an old process to remove a newer lock.

Controller ownership is now tied directly to each WebSocket, dead sockets are terminated using ping/pong health checks, controller state is never saved, and lock creation is exclusive with an owner token.

Automated testing now covers two shared clients, malformed commands, control restrictions, disconnect release, autosave, backup creation, second-writer refusal, `SIGKILL` recovery, and recovery from a deliberately corrupted primary save.

## Project control and review gates

ChatGPT owns the canonical code, deployment, and project log. Claude serves as the independent reviewer and does not maintain a parallel fork. Reviews use the complete current canonical files rather than a prose summary.

Mandatory Claude review checkpoints:

1. After Shared World 0.2 is running on Mouse and Sean and Olive have confirmed they see the same town: review automatic startup and network exposure.
2. Before any LLM-generated dialogue or memory is enabled: review hardware limits, cost controls, privacy, and child-safety boundaries.
3. Before releasing any change that affects what Olive sees or reads, including generated text, real friends' names, or personal information.

### First review evidence package

After Mouse deployment and successful two-device testing, provide Claude with:

1. The complete canonical bundle, its semantic version, and its SHA-256 checksum.
2. The exact automatic-start configuration installed on Mouse.
3. The output of `lsof -iTCP:4310 -sTCP:LISTEN` from Mouse.
4. The complete `npm test` result produced on Mouse itself.

The review will verify unattended reboot recovery, network exposure, and permissions on the canonical data directory.

### Release discipline

Any change to the canonical bundle requires a version bump. Every packaged release receives a SHA-256 checksum after the archive is finalized. Shared World 0.2.1 was the first release using this rule.

## Shared World 0.2.2 — pre-deployment network hardening

Changed the server's default bind address from all interfaces to `127.0.0.1`. Mouse deployment will explicitly set `HOST=100.66.214.35`, limiting access to Mouse's Tailscale interface instead of exposing port 4310 to the entire home LAN.

The Mouse launchd service must use the absolute Node executable path, an explicit working directory, `RunAtLoad`, and `KeepAlive`. KeepAlive is required because the Tailscale interface may not exist yet when macOS first starts the service.

Before extraction on Mouse, verify the transferred archive against the release SHA-256.

## Shared World 0.2.3 — resident figures

- Replaced the colored initial dots with lightweight, code-drawn full-body people.
- Gave Olive, Dad, Milo, Zara, Finn, and Nova distinct skin tones, hair, clothes, shoes, faces, and accessories.
- Added walking motion, depth sorting, larger touch targets, selection outlines, nameplates, and matching resident portraits.
- No save-schema or simulation changes; existing 0.2.2 town data remains compatible.

## Shared World 0.2.4 — core family roster

- Made Olive, Hazel, and Sean permanent core residents.
- Added Hazel as the seventh resident with a schedule, personality, placeholder full-body figure, portrait, and player-control mode.
- Kept Sean's internal resident id as `dad` for save and command compatibility while standardizing his visible name.
- Added an automatic content migration that upgrades existing 0.2.x saves in place without resetting memories, needs, relationships, positions, or events.
- Added integration coverage that starts from a legacy save and verifies Olive, Hazel, and Sean after migration.

## Living World 0.3.0 — independent lives

- Standardized Sean's visible name as `Sean`; retained the internal `dad` id so saved controls and state remain compatible.
- Made Sean's placeholder figure bald with a beard.
- Added a separate deterministic life engine in `life.js`.
- Added ten years of background for every resident, three events per year. Hazel's first three years are inherited family context because she is seven; Olive receives ten age-appropriate years.
- Added a coherent family tree: Sean is Olive and Hazel's father; Milo and Zara are spouses and Nova's parents; Finn is Milo's father and Nova's grandfather.
- Added biographies, ages, life stages, likes, dislikes, values, careers or school paths, moods, and progressive goals.
- Adult histories include unique work situations and multiple promotions. Children remain excluded from adult work, marriage, and romance storylines.
- Conversations now transfer stored biographical or lived facts between residents. Learned facts retain their subject, source, and timestamp.
- Added autonomous personal, family, school, career, interest, community, setback, goal-completion, and promotion events.
- Added bounded offline living: one experience per resident per eight offline hours, capped at twelve per resident per restart.
- Migrated save schema from 1 to 2 in place. Existing positions, needs, memories, relationships, and events survive the migration.
- Expanded the resident panel so biographies, family, career, mood, goals, thirty-event histories, and learned facts are inspectable.
- Kept the engine local and deterministic; 0.3 does not use an LLM or incur API costs.

## Living World 0.3.1 — Hazel history correction

- Reduced Hazel's background from ten chapters to her seven actually lived years.
- Removed all pre-birth family-context chapters from Hazel's personal history.
- Hazel now has twenty-one background events; the other six residents retain thirty each, for 201 total town background experiences.
- Added a life-history content version so a 0.3.0 save automatically receives the corrected Hazel history without losing live experiences, needs, relationships, or memories.

## Living World 0.3.2 — deployment hardening

- Preserved unknown residents while giving them normalized arrays, numeric positions and needs, and a safe home schedule so an unexpected id cannot crash every simulation tick.
- Cleaned obsolete history facts from the affected resident and from anyone who learned those facts before a history migration.
- Kept the twenty rapid ten-second backups and added 168 hourly snapshots for roughly seven days of rollback coverage.
- Made uncaught exceptions exit with status 1 while SIGINT and SIGTERM remain clean status-0 shutdowns.
- Corrected restart catch-up timestamps and removed the unused legacy hosting configuration.
- Added regression tests for unknown residents, stale learned facts, hourly snapshots, and non-zero crash exits.

## Next decisions after playtesting

1. Does watching the residents feel fun without intervening?
2. Do the new personalities read clearly on a phone, or do intents and voices need more room?
3. What comes after 0.5: interiors, town editing, or the LLM dialogue review?

## Parking lot — not promised yet

- Shared Mac/iPhone town
- Generative dialogue
- Interior rooms
- Town editing
- TV screensaver mode
# Version 0.4.0 — mobile pixel-art town

- Rebuilt the client as a portrait-first touch app.
- Added an original detailed pixel-art town background aligned to the existing simulation destinations.
- Added live chat bubbles, drag/pinch camera controls, resident sheets, mobile navigation, and PWA caching.
- Added first-run owner setup, hashed PIN authentication, resident-linked player accounts, session ownership enforcement, and a lightweight character appearance creator.
- Preserved the version 2 town-state schema, autonomous life engine, histories, families, learning, backups, snapshots, and crash recovery.
- Added account and ownership integration tests alongside the complete 0.3.2 regression suite.

# Version 0.5.0 — independent review fixes and resident minds

An independent review of 0.4.0 found and reproduced these problems. All are fixed, with regression tests:

- **Accounts:**
  - After login, tap-to-move did nothing until the page was reloaded.
  - "Switch player" left the open socket with the previous player's control.
  - PINs could be guessed in minutes, and each guess stalled the simulation.
  - Before setup, anyone could steer anyone and claim the owner role.
  - A damaged accounts file reopened first-time setup.
- **Life engine:**
  - Runtime promotions were wiped on restart.
  - Residents forgot their own history.
  - Goal text nested forever.
  - Every mood ended at "delighted".
  - Nova had a duplicate promotion and worked as a nine-year-old.
  - Finn was "promoted" into retirement.
  - Ages never advanced.
  - Offline events were all stamped in the last few minutes.
- **Persistence:**
  - A crash handler could save half-updated state over the good save.
  - Rapid backups covered only about three minutes.
  - Snapshots were never used for recovery.
- **Client:**
  - The appearance creator had no effect.
  - The clock ran at the wrong speed on 120Hz screens.
  - Movement was choppy, and the panels were rebuilt every second.
  - The map image was 4 MB.
  - The service worker cached error pages.

New in 0.5:

- **Resident minds** (`lib/mind.js`): personality traits, personal sleep and weekly routines, utility-based place choice with visible reasons, interest-based activities, conversations in each resident's own voice, and mild child-safe disagreements. See `LIFE_ENGINE.md`.
- **Modules:** the code is split into `lib/` modules and `shared/world.js`.
- **Network:** clients get per-tick changes instead of the full state every second.
- **Server hardening:** the WebSocket Origin is checked and security headers are set.
- **Accounts:** owner PIN reset and player removal; sessions persist across restarts.
- **Tooling:** ESLint, `node:test` suites, and a launchd template.

Save schema 3 migrates 0.2 through 0.4 saves in place.

# Version 0.5.1: the town matches the map

- Place spots now sit on the painted locations: the park's pond and gazebo, the cafe terrace, the market plaza, in front of the fountain, the workshop yard, and the house doors.
- Residents walk along a network of paths and stairs traced from the map. Player taps snap onto the nearest path.
- Named buildings with signs:
  - Sean's House for Sean, Olive and Hazel
  - Milo & Zara's for Milo, Zara and Nova
  - Finn's Cottage
  - the cafe, market, workshop, park and square

  Sleeping residents go inside their house. Tapping a sign shows who's there, or walks your character there while playing.
- Residents are redrawn as pixel-art sprites with outlines, sized to fit the buildings.
- New camera: opens with the map filling the screen height, zooms out to the whole town, and follows the player's character.

# Version 0.6.0: Mr. E and custom characters

## LLM review gate (checkpoint 2), completed before enabling Mr. E's AI

- **Hardware:** a small local model (`llama3.2:3b`, about 2 GB) runs through Ollama on Mouse. Calls are asynchronous and never block the simulation tick, and there is at most one call at a time, about every 25–50 minutes, between 7:00 and 21:00.
- **Cost:** none. There is no cloud API and no key.
- **Privacy:** town state, including the family's first names, is only sent to Ollama on the same machine (127.0.0.1). Nothing is sent to the internet.
- **Child safety:**
  - The model can only choose from nine whitelisted, gentle event types, and the server applies each event's effects itself.
  - Resident IDs and places are checked against the town.
  - Free text (title, item, announcement) is capped in length, stripped of markup, and checked against a list of blocked words (violence, fear, romance, insults, substances, money, links). Anything that fails is replaced with a hand-written template.
  - If the model is unavailable, Mr. E uses built-in surprises.
  - Tests cover unsafe and invalid AI output and the offline fallback.
- **Remaining risk:** a harmless-looking but odd sentence can still get through the word filter. Owner-triggered surprises make it easy to spot-check, and `LIVING_TOWN_MRE_AI=off` turns the AI off.

## Features

- **Mr. E** appears as a cloaked visitor with a "?" face and announces surprises. His events are highlighted in gold in the feed.
  - Weather (rain, sunshine) and happenings pull residents toward or away from places, with a visible reason.
  - Lost items are found later by whoever is nearby.
  - The owner can ask for a surprise from the profile menu.
- **Characters:**
  - Looks live on the resident: skin, hair style and color, shirt, pants, shoes and accessory, edited with a live preview.
  - Players restyle their own character; the owner can restyle anyone.
  - The owner can add residents with a name, age and home, including the new Rose Cottage. New residents get a personality, schedule and voice generated from their age.
  - Any custom resident can be linked to a player.
  - The owner can rename, rehome or age custom residents, or let them move away.

# Version 0.7.0: house interiors

- Each home (Sean's House, Milo & Zara's, Finn's Cottage and Rose Cottage) has a pixel-art room with beds, a sofa, a kitchen table and chairs, a fridge and counter, a bookshelf, a rug and a plant, in its own palette. At night the window goes dark and the room dims.
- Residents who have arrived home are drawn inside instead of at the door. House signs show how many people are in, with a "z" if anyone is asleep.
- Inside, residents are placed by what they're doing: sleepers in their own beds (with floating z's), family time at the table, reading or resting on the sofa, games on the rug.
- In Play mode, at your own house:
  - Tap the floor to walk around.
  - Tap furniture to use it: nap, snack, read, relax or play. Each gives a 30-minute need boost.
  - The server checks ownership, that you're home, and that the furniture exists, and it keeps movement inside the room.
- Leaving the house clears indoor state.

# Version 0.8.0: Mr. E watches over the town

- **Always visible to players.** Mr. E has a permanent, server-owned position, so every phone sees him in the same place. He strolls the walkways between public places, lingering where people are, and walks more slowly with a lantern at night. Tap him to see what he's doing ("quietly watching Juniper Park…"). While he's announcing a surprise, taps on him come first; otherwise residents beside him get the tap.
- **Invisible to residents.** He is not a resident, and nothing in the residents' minds reads his position. Their memories of his surprises say "a mysterious surprise" or "a mysterious riddle note" and never name him. The feed still credits him for players. Older memories saved before 0.8 may still say "from Mr. E".
- **He makes something happen when nothing is going on.** The town counts as quiet when no Mr. E event is running and fewer than two awake residents have talked in the last 5 minutes. After 8 quiet minutes he hurries to the spot and creates a surprise, preferring ones that bring together residents who are on their own or bored. The AI is told who they are.
- **Change to the checkpoint 2 limits:** surprises used to come on a fixed 25–50 minute timer. Now they come only from a quiet town, and never more than one every 20 minutes. Everything else is unchanged: one AI call at a time, only between 7:00 and 21:00, local only, the same nine event types, and the same filtering. Because this changes what Olive sees, it falls under checkpoint 3.
- **Tests:** he strolls day and night and stays on the map, residents never name him, a quiet town gets a surprise after 8 minutes but no more than one per 20 minutes, a lively town and a night-time town get none, and phones receive his position. A timing race in the integration test (reading the snapshots folder before it existed, about 1 run in 6) is fixed.

# Version 0.9.0: real house interiors

- **Floor plans** (`shared/interiors.js`, shared by the server and phones): each home is a 192×144 top-down plan with rooms, doorways and a front door.
  - Sean's House: Olive's room, Hazel's room, Sean's room, the kitchen and the living room.
  - Milo & Zara's: their room, Nova's room, the kitchen and the living room.
  - Finn's Cottage: his room, a workroom with a spare bed, and the kitchen and sitting room.
  - Rose Cottage: three bedrooms for new residents.
- **Art** (`public/rooms.js`): drawn in code as pixel art. Plank, tile and carpet floors, patterned wallpaper with trim, doorways, and windows whose sky follows the time of day. Sunlight falls on the floor by day. In the evening and at night the rooms darken, and lamps, fairy lights, Hazel's night-light and Finn's fire glow; the lamps go out once everyone is asleep. The fire flickers, pots steam while someone cooks, and the TV comes on while someone plays.
- **Residents at home** go to the furniture that fits what they're doing (the table for family time, the TV for an old game, the sofa for reading) and walk between rooms through the doorways. Everyone sleeps in their own bed; Milo and Zara share theirs. Anyone who comes home walks in through the front door. Placement is deterministic, so every phone shows the same scene.
- **Walk in and out.** In Play mode, reaching your own front door zooms the view inside; tapping the front door walks you out onto the path (the new `leave-home` message) and zooms back to the map. The "‹ Town" button only closes the view. Other houses can still be peeked into from their signs.
- **Use almost anything.** Beyond the bed, sofa, table, fridge, bookshelf and rug, you can use the stove, sink, counter, chairs, fruit bowl, herbs, wardrobe, dresser, clothes rack, bedside and reading lamps, coffee table, beanbag, ball, plants, windows, pictures, TV, easel, record player, fireplace, log pile, workbench, birdhouses and binoculars. Each gives a gentle 30-minute boost to hunger, energy, social or fun. Chairs, sofas and beanbags seat you, and beds tuck you in.
- **Server checks:** you can only act in your own house, only once you're home, and only with furniture that exists. Taps outside the walls snap onto the floor.
- **Tests:** every home's rooms can be reached from the front door without leaving the floor; nothing blocks a doorway; every spot can be reached; everyone gets their own bed; activities go to the right furniture; small items are usable and only boost real needs; and the server test uses a sink, a chair, the fridge and the front door.
- **Checked in a headless iPhone-sized browser** against a throwaway server and a temporary town: walking home zooms inside, the sofa, a chair and a bed work from taps, and the front door takes you out, with no errors. `data/` was not touched.
- **Not yet:** the cafe, workshop and market interiors (0.10) and upstairs floors (0.11).

