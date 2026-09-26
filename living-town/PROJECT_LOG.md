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
2. Should character creation or richer conversations come first?
3. After Mouse deployment, should character creation or richer memories come first?

## Parking lot — not promised yet

- Character creator and outfits
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
