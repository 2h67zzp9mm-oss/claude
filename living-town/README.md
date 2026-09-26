# Living Town

Living Town is Sean, Olive, and Hazel's shared, persistent little world. The canonical simulation runs as one Node.js process on Mouse. Every browser connects to that same server over WebSocket and sees the same residents, positions, needs, events, and memories.

## Honest status

This is **Living World 0.3.2**, the first release line where residents have persistent lives rather than only schedules and needs.

### What changed in 0.3.2

- Unknown resident ids now receive safe fallback data and a home schedule instead of crashing the simulation.
- History migrations remove obsolete history facts from both the resident and anyone who previously learned them.
- Added hourly snapshots retained for seven days alongside the twenty rapid autosave backups.
- Uncaught exceptions now exit non-zero so process supervision can distinguish a crash from a clean shutdown.
- Catch-up conversations now receive the current restart timestamp.
- Removed the unused legacy hosting configuration.
- Added regression coverage for unknown residents, stale history facts, snapshots, and crash exit status.

### What changed in 0.3.1

- Hazel now receives exactly seven lived years with three age-appropriate events per year.
- Removed the three years of pre-birth family context that appeared in 0.3.0.
- Olive and the adult residents retain ten years of history.
- Existing 0.3.0 data automatically replaces Hazel's thirty-entry draft background with the corrected twenty-one-entry history without touching her live experiences.

### What changed in 0.3.0

- Every resident receives ten chronological years containing three background events per year.
- Residents have biographies, ages, family links, values, likes, dislikes, careers or school paths, moods, and long-term goals.
- Milo, Zara, Nova, and Finn form a multigenerational family; Sean is Olive and Hazel's father.
- Adults have unique career histories containing work problems and promotions. Olive and Hazel retain age-appropriate histories.
- Conversations transfer real stored facts. A resident can inspectably learn another resident's history and remember who shared it.
- Residents generate new personal, family, career, school, interest, and community experiences without player input.
- Downtime produces bounded offline experiences rather than only reducing needs.
- Sean is named Sean everywhere and his placeholder figure is bald with a beard.
- Existing schema-1 saves migrate to schema 2 without losing the established town.

### What changed in 0.2.4

- Locked Olive, Hazel, and Sean into the core resident roster.
- Added Hazel as a seventh resident with her own schedule, personality, placeholder figure, and direct-control button.
- Standardized Sean's visible name throughout the live world.
- Added an automatic old-save upgrade so the existing Mouse town gains Hazel without losing memories, needs, relationships, positions, or event history.

### What changed in 0.2.3

- Replaced lettered map dots with six distinct full-body character figures.
- Added individual skin tones, hair styles, outfits, faces, accessories, shadows, and walking animation.
- Added matching illustrated portraits in the resident panel.
- This is a visual-only change; the shared simulation and existing saved town remain compatible.

Working now:

- One server-owned world ticking once per second
- Seven residents with schedules, needs, moods, goals, biographies, careers, family trees, long-term histories, and durable learning
- One shared state file with atomic saving, rapid backups, and hourly snapshots
- Multiple simultaneous browser clients over WebSocket
- Observer mode and direct control of Olive, Hazel, or Sean
- Recovery after server downtime, hard crashes, and a corrupt primary save
- Single-writer protection so two server processes cannot write the town at once

Not built yet:

- Character creation or outfits
- Free-form generated dialogue (0.3 uses safe structured conversation and fact sharing)
- LLM-generated scenes
- Authentication outside the private Tailscale network
- Public internet hosting
- SQLite or another database

JSON storage is intentional at this scale. A database becomes worthwhile when the world grows beyond a handful of residents and a short event log.

## Project layout

- `server.js` — canonical simulation, persistence, WebSocket server, and recovery
- `life.js` — biographies, ten-year histories, goals, moods, autonomous experiences, careers, and learning
- `public/` — shared-world browser client
- `test/integration.js` — independent end-to-end server test
- `data/` — created at runtime; canonical town state, rapid backups, and hourly snapshots
- `dist/` — legacy browser-only Tech Demo 0.1, retained as a visual reference
- `PROJECT_LOG.md` — decisions and progress

## Verify before installing

```bash
npm ci
npm test
```

The test covers ten-year histories, age-safe history migration, stale-fact cleanup, unknown-resident safety, promotions, family links, knowledge transfer, autonomous experiences, offline life, shared state, malformed commands, control restrictions, autosaving, rapid backups, hourly snapshots, exclusive locking, non-zero crash exit, hard-crash recovery, and corrupt-primary recovery.

## Run on Mouse

```bash
cd living-town
npm ci
npm start
```

The default address on Mouse is:

```text
http://127.0.0.1:4310
```

For a manual Tailscale-only test, start it with:

```bash
HOST=100.66.214.35 npm start
```

Other tailnet devices then open:

```text
http://100.66.214.35:4310
```

The server defaults to `127.0.0.1`, so it is not exposed to the home LAN accidentally. The Mouse launch service will explicitly set `HOST=100.66.214.35` to listen only on Mouse's Tailscale interface.

The production install should ultimately run under macOS `launchd` so it starts automatically after Mouse reboots. The service must use Mouse's absolute Node path, set its working directory, set the Tailscale-only `HOST`, and use `KeepAlive`. If Tailscale is not ready during boot, launchd will retry until the server can bind successfully. Until that service is installed, closing the Terminal process stops the live simulation; the next start catches up from the last saved timestamp.

## Safety and persistence

- The server owns all durable state; browsers do not use `localStorage` for the town.
- Controller claims are tied to live WebSocket connections and are never saved.
- Dead connections are detected with WebSocket ping/pong health checks.
- Saves use same-filesystem temporary files, `fsync`, and atomic rename.
- The newest 20 rapid backups are kept under `data/backups/`.
- Up to 168 hourly snapshots are kept under `data/snapshots/`, providing roughly seven days of slower rollback points.
- A fresh lock refuses a second writer; a stale crash lock can be recovered after 20 seconds.
- A lock owner token prevents an older process from deleting a newer process's lock.

## Version 0.4.0

The 0.4 release replaces the old desktop-first map with a portrait-first mobile game interface while preserving the 0.3 life engine and state format.

- Original high-detail pixel-art town map with the existing destinations aligned to its park, cafe, market, workshop, homes, and town square
- Small animated residents layered over the map rather than baked into the artwork
- Live conversation bubbles drawn from actual recent resident memories
- Touch drag, pinch zoom, tap selection, and tap-to-move
- Collapsible resident sheet, town feed, history, learned facts, and mobile navigation
- First-run owner setup, 4–6 digit PIN login, player switching, and owner-created player profiles
- Server-side scrypt PIN hashing; plaintext PINs are never stored
- One player profile is linked to one controllable resident, and the server rejects attempts to control somebody else
- Lightweight appearance creator for hair, accessory, and shirt color
- Installable portrait PWA shell with offline caching for static artwork and interface assets

On the first 0.4 launch, Sean creates the owner PIN. From the profile menu, the owner can create Olive and Hazel's player profiles and assign their separate PINs.

## Current design boundary

The server is intended for Mouse plus trusted family devices over Tailscale. Player accounts protect resident control from other family sessions, but this is not an internet-hardened public service and should not be port-forwarded directly to the internet.
