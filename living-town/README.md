# Living Town

Living Town is Sean, Olive, and Hazel's shared, persistent little world. One Node.js process on Mouse runs the canonical simulation; every browser connects to it over WebSocket and sees the same residents, positions, needs, conversations, and memories.

## Honest status — 0.7.0

Working now:

- **House interiors**: tap a house sign to look inside. People at home go indoors, sleep in their own beds, and sit at the table, on the sofa or on the rug depending on what they're doing. In Play mode you can walk around your own house and use the bed, sofa, table, fridge, bookshelf or rug, and each one helps your character's needs.
- **Mr. E**, a mysterious town storyteller who stirs up gentle surprises: festivals, rain and sunshine, gifts, riddles, meet-ups, free treats, and lost-and-found stories. He runs on a local AI model on Mouse, or on built-in surprises when the AI is off.
- **Character customization**: skin, hair style and color, clothes, and accessory, with a live pixel preview. The owner can add new residents (name, age, home) and link any of them to a player.

- One server-owned world ticking once per real second, on the real wall clock
- Seven residents with distinct personalities, sleep times, weekly routines, interests, and speaking voices (see [LIFE_ENGINE.md](LIFE_ENGINE.md))
- Utility-based decisions with a visible reason ("Why: hungry", "Why: Olive is there", "Why: school time")
- Conversations shaped by personality and shared interests, including occasional mild disagreements
- Persistent careers, goals, moods, ages and birthdays, background histories, and learned facts
- Pixel-art residents that match the painted map, walking only on its paths and stairs
- Named buildings: each family has its own house, sleeping residents go inside, and tapping a sign walks you there
- Mobile camera: opens showing much more of the town, pinch out to see all of it, and follows your character while you play
- Portrait-first mobile client: drag, pinch, tap-to-move, chat bubbles, resident sheet, PWA install
- Player accounts: owner setup with a one-time console code, hashed PINs, lockouts, owner PIN resets and player removal, per-player looks
- Atomic saves, per-minute backups, hourly snapshots, recovery through all three, and single-writer locking

Not built yet:

- Free-form generated dialogue. This is deliberately out of scope until the LLM review gate in `PROJECT_LOG.md` is passed.
- Interiors, town editing, TV screensaver mode
- Public internet hosting. This server is for Mouse and trusted family devices on Tailscale only.

## Project layout

- `server.js` — HTTP and WebSocket wiring, simulation tick, boot catch-up
- `lib/mind.js` — personalities, routines, decisions, activities, conversations
- `lib/life.js` — histories, careers, goals, moods, experiences, birthdays, fact sharing
- `lib/persistence.js` — lock, atomic writes, backups, snapshots, recovery
- `lib/auth.js` — player accounts, PINs, sessions, rate limiting
- `shared/world.js` — places and residents, shared by server and browser
- `public/` — browser client
- `test/` — unit tests (`life`, `mind`) and end-to-end server tests (`integration`, `accounts`)
- `deploy/` — launchd service template for Mouse
- `data/` — created at runtime: town state, backups, snapshots, accounts, sessions

## Verify before installing

Requires Node.js 20 or newer.

```bash
npm ci
npm run lint
npm test
```

## Run on Mouse

```bash
npm ci --omit=dev
npm start
```

The server listens on `127.0.0.1:4310` by default, so it is never exposed to the home LAN by accident. To serve the tailnet, set `HOST` to Mouse's Tailscale address:

```bash
HOST=<mouse-tailscale-ip> npm start
```

**First launch:** the server prints a six-digit setup code. Open the app, enter the code, and choose Sean's six-digit owner PIN. From the profile menu, the owner can create Olive's and Hazel's players, reset PINs, and remove players.

### Automatic start (launchd)

`deploy/com.livingtown.server.plist` is a template. Fill in the Node path, the checkout directory, and the Tailscale address, then:

```bash
cp deploy/com.livingtown.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.livingtown.server.plist
```

`KeepAlive` restarts the server after crashes and retries until Tailscale is up at boot. After installing, gather the review evidence listed in `PROJECT_LOG.md`: the release checksum, the installed plist, `lsof -iTCP:4310 -sTCP:LISTEN`, and `npm test` output from Mouse.

## Mr. E's local AI (optional)

Mr. E works without any setup, using built-in surprises. To give him a real AI brain that runs privately on Mouse:

```bash
brew install ollama
brew services start ollama
ollama pull llama3.2:3b
```

Then restart Living Town. His status shows in the owner's profile menu under "Mr. E's brain". Settings:

- `LIVING_TOWN_MRE_MODEL` — which model to use (default `llama3.2:3b`)
- `LIVING_TOWN_OLLAMA_URL` — where Ollama is running (default `http://127.0.0.1:11434`)
- `LIVING_TOWN_MRE_AI=off` — switch the AI off and use only the built-in surprises

Nothing leaves the house: Ollama runs on Mouse and only listens locally.

## Safety and persistence

- The server owns all durable state. Browsers store nothing about the town.
- The primary save is written every 10 seconds, with a backup each minute (30 kept) and a snapshot each hour (168 kept). Startup falls back from primary to backups to snapshots.
- An uncaught exception writes a separate `crash-*.json` and exits non-zero. It never overwrites the last good save.
- A process that loses the lock refuses to save and exits.
- A damaged `player-accounts.json` falls back to its `.bak` copy. If both are damaged, the server refuses to start rather than reopening first-time setup.
- PINs are hashed with scrypt off the main thread. Five wrong PINs lock a profile, with the lockout doubling up to 15 minutes. Sessions persist across restarts and expire after 30 days.
- Every control command re-checks the session, so logging out, PIN resets, and removed players take effect on open sockets immediately.
- WebSocket connections from other sites are refused, and responses carry a strict Content-Security-Policy.

This is not an internet-hardened service. Do not port-forward it.
