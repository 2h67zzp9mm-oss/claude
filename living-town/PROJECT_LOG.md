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

# Version 0.10.0: the visitor's window

A read-only view of the town for family who aren't on the tailnet (the girls' mum), published with Tailscale Funnel so she needs no app and no account.

## Network exposure review (checkpoints 1 and 3)

This is the first thing published to the internet, so it was designed to expose as little as possible.

- **Separate server, separate port.** `lib/viewer.js` runs its own HTTP server on `127.0.0.1:4311`. None of the main server's routes exist on it: no accounts, no `/api`, no commands. Funnel publishes only this port. The main server stays on the Tailscale address at 4310 and is never published.
- **Secret link.** Everything is under `/v/<token>/`. The token has 24 random bytes (32 characters), lives in `viewer-token` (mode 600, git-ignored, not in `data/`) and is compared in constant time. Any other path, a wrong token, or a WebSocket from another site's page gets a 404. Replacing the token (`npm run viewer-link -- --new`, then a restart) cuts off the old link; `tailscale funnel reset` takes the window down.
- **Read-only.** The visitor socket only sends; any incoming message closes it (code 1008), and nothing a visitor does can change the town. The visitor copy of the page never sends and never registers the offline cache.
- **Allowlisted data.** Visitors get each resident's name, position, place, activity, intent, needs, mood label, speech bubble, looks and where they are inside their house, and Mr. E's position and announcements. Ages, birthdays, background histories, experiences, memories, learned facts, goals, careers and friendships are never sent, and feed items about birthdays or ages are filtered out. The page hides the profile menu, Play, editing and the history tabs.
- **Limits.** At most 12 visitors at once, messages capped at 256 bytes, dead sockets dropped every 30 seconds, the same security headers as the main server, and `Cache-Control: no-store`.
- **Remaining risk.** Anyone who has the link can watch, including anyone it gets forwarded to. They see the family's first names, what their residents are doing, and speech bubbles, which can retell stories from the residents' fictional histories. Replacing the link is the remedy. Funnel's public address carries this Mac's Tailscale machine name.
- **Tests** (`test/viewer.test.js`): wrong or partial tokens, main-app paths and `/api` all get 404s; the page is marked read-only; foreign-origin and wrong-token sockets are refused; no private field reaches a visitor; roster changes still arrive; sending a message closes the socket and moves no one; the main server still requires sign-in; and the window stays off without a token. The normal test servers run with the window off.
- **Checked in a headless phone-sized browser:** the visitor page loads live, makes no `/api` requests, shows no errors, and hides the profile menu, Play and editing.

# Version 0.11.0: the cafe, workshop and market inside

- **Three new floor plans** in `shared/interiors.js`, drawn in `public/rooms.js`:
  - Moonbeam Cafe: the kitchen, Milo's office, and the cafe with its counter, cake case, hot chocolate machine, radio, three tables, a booth and a piano.
  - Workshop: the shop floor with two workbenches, a tool wall, a control panel, a bike stand and a wood rack; Zara's studio with paints, easels and a craft table; and the order office with a kettle.
  - Corner Market: the shop with fruit racks, shelves, sweet jars, flowers and the counter; the storeroom; and the bread corner.
- **Who is inside.** Each building lists which activities happen indoors. Staff on shift stand behind the counter or at the bench: Milo running the cafe, Sean on a job or wiring a control panel, Zara teaching, Nova on the market floor. Other activities go to the right spot (cake for today's special, the booth for sketching). Outdoor ones, like news over coffee on the terrace, browsing the stalls or the Saturday stall, stay on the map.
- **Players** walk in through the door of the cafe, workshop or market like at home, use about 25 new things (each with a gentle boost), and walk out through the front door. The server applies the same rule the phones use, and furniture boosts now end when you leave that place.
- **Nobody in two places at once.** One function, `locate`, decides whether each person is out on the map or inside exactly one building. The map, every inside view, the building signs and the server all use it. A test throws 3,000 random situations at it: nobody is ever inside two buildings, anyone walking is on the map, homes only hold their own family, and a public building only holds people at that place.
- **Tests:** all seven plans are checked (every spot and staff spot can be reached, no blocked doors, activity targets exist); staff placement and the indoor/outdoor split are covered; and the server test walks Sean into the cafe for cake, checks there are no beds there, and walks him out.

# Version 0.12.0: the Big Top troupe

- **Six new residents** (`lib/troupe.js`): original characters with a toybox-circus feel, inspired by the style of animated circus shows but not copies of any show's characters. Names, looks, personalities and voices are our own.
  - **Plum**, a purple bunny in orange overalls: a cheerful clown who makes himself the joke.
  - **Patches**, a patchwork rag doll with honey-colored yarn hair: she makes the costumes and looks after everyone.
  - **Tumble**, a green-and-gold jester: nervous but brave, and an acrobat.
  - **Rook**, an old chess-castle gentleman: forgetful, fond of puzzles and his garden.
  - **Ribbons**, a shy dancer made of streamers, with a starry party mask.
  - **Bolt**, a nine-year-old block-built toy robot who goes to school on weekdays like Hazel.
- **Kid safety:** the troupe is purely cheerful, with none of the darker themes such shows can have. Their summaries, likes, goals and every voice line pass Mr. E's word filter (a test checks this), and there is no romance, fear or danger.
- **Home:** the Big Top, a striped tent drawn onto the mosaic plaza below the Corner Market, with a new walkway from the market. Inside are two bunk wagons with a bed each, a practice ring with a trampoline, a low trapeze and juggling pins, a sofa, and a kitchen wagon.
- **Routine:** they rehearse in the ring on Tuesday and Thursday afternoons, and put on a circus show in the Town Square on Saturday and Sunday from 2 to 4. During a show everyone else is drawn to the square ("watching the circus show"), and the feed announces it once per show.
- **They're custom residents with hand-written presets,** so the owner can restyle them or let them move away. They arrive once (`troupeArrived` in the save), never twice, and don't come back after moving away. Room for custom residents went from 12 to 18. `LIVING_TOWN_TROUPE=off` keeps them away, and the test servers use it.
- **New looks for everyone** in the character editor: bunny ears, yarn hair, a jester hat, a castle crown, streamers and a robot head; plus overalls, rag-doll stitches, a jester ruff and a party mask.
- **Tests** (`test/troupe.test.js`): six unique members whose looks pass the look check and whose words pass the filter; everyone is in the show, and Bolt has school; a bed each in the Big Top; the show pulls everyone but the troupe to the square once per show, only on weekend afternoons, and not once they've gone; and on a real server they arrive once, keep their looks, don't duplicate on restart, and stay gone after moving away.
- **Checked in a headless browser:** the tent on the map, the Big Top's inside, and all six sprites drawn large.

# Version 0.13.0: upstairs

- **Two-storey homes.** Sean's House, Milo & Zara's and Rose Cottage now have two floors (`floors` in `shared/interiors.js`; single-storey buildings are their own ground floor).
  - Downstairs: the living room, kitchen, a playroom (a den at Milo & Zara's) and a hall with coat hooks and the stairs.
  - Upstairs: three bedrooms, a landing with a bookshelf, beanbag and runner rug, and a bathroom with a bubble bath, sink and towel.
  - Sean's House: Olive's, Hazel's and Sean's rooms upstairs.
  - Milo & Zara's: Nova's room, Zara's studio (with a spare daybed) and Milo & Zara's room with their double bed.
  - Finn's Cottage, the Big Top, the cafe, workshop and market stay single-storey.
- **Getting around.** Routes between floors go by the stairs. Residents walk to the stairs, arrive at the top (or bottom), and carry on to their bed or the kitchen. Every object and spot knows its floor, and object ids are unique across the whole house, so the server and the phones agree which floor anyone is on.
- **Playing.** Tap the stairs to go up or down, and the view follows your character. The front door is only downstairs. An Upstairs/Downstairs button lets anyone switch floors and shows how many people are on the other one. The server accepts a `floor` on indoor moves (ignoring floors a house doesn't have) and finds furniture on either floor.
- **Saves:** existing indoor positions still work. Furniture ids that moved upstairs (the beds, Olive's desk, Hazel's toys) kept their names, and positions without a floor are treated as downstairs.
- **Tests:** every floor of every building is checked (spots can be reached, nothing blocks doors or stairs, the stairs lead somewhere, the front door is downstairs); every room on every floor can be reached from the front door, with routes that stay on the floor except when using the stairs; everyone's bed is upstairs and family time is downstairs; and the server test takes Sean upstairs for a bubble bath and ignores a floor that doesn't exist.
- **Checked on a headless phone-sized browser:** walk home, tap the stairs, the view follows upstairs, bath, back down, out the front door, with no errors.

