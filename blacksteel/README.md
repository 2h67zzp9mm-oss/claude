# The Blacksteel Pirates: The Island That Never Existed

A King's Quest VII–style 3D adventure game of the Blacksteel Pirates prologue. Shannon tells the story. The player plays young Sean.

Open `index.html` in a browser (phone, tablet, or PC). No install, no server. The 3D scenes use three.js from a CDN.

## The story (all nine chapters of the written prologue)

1. **The Call**: Shannon's frame, Lily's morning (painted cutscene), then Sean's cabin in 3D.
2. **The Reef**: steer the frigate between the reef rocks, through the smoke of each cannon shot.
3. **Deke**: the beach. Deke, Harrow's order, and the mast.
4. **The Shrine**: up the burning village (the doll, Mercer's pistol), the tunnels, the Record-Stone, the cradle.
5. **The Name**: Olive.
6. **Holding the Street**: Harrow's voice, Nia's orders, and three moments in the fight.
7. **Not Them**: the cannons, Olive into Deke's arms, and the black arc (the player loses control on purpose).
8. **After**: the waterline, the hand that won't let go, Mercer's news, and the farewell at sunrise.
9. **Blacksteel**: the fishing boat, the news gull, the bounty, and "You're not theirs."

## How it plays

- Olive and Hazel each play separately and have their own save, which resumes at the chapter they reached.
- Whoever isn't playing is a listener in Shannon's frame scenes, with her own lines at the big moments.
- If the player picks something Sean didn't say or do, Shannon corrects it, so the prologue stays canon.
- Tap the floor to walk. Tap a person or object (or its name under "Things here") for what you can do.
- Hint button for both players. In Hazel's game the next thing to try glows after a short wait.
- **Voice**: every line is pre-recorded with ElevenLabs voices, one voice per character (see below). **Auto** turns the page when a line finishes. Both can be switched off.

## Voices (ElevenLabs)

Every spoken line is generated ahead of time and packed into one audio file per chapter (`voices/ch0.mp3` … `voices/ch8.mp3`), with `voices/manifest.json` saying where each line starts. The game plays a line only when its text matches exactly, so after changing any dialogue, regenerate.

Setup (once): in the environment settings, allow `api.elevenlabs.io` under network access and add the API key as `ELEVENLABS_API_KEY`. Then, in a new session:

```
python3 blacksteel/voices/extract_lines.py   # list every spoken line (voices/lines.json)
python3 blacksteel/voices/generate.py        # generate new or changed lines, then pack the chapter files
```

- `voices/cast.json` picks the ElevenLabs voice for each character. `generate.py --list` shows the voices your account can use. Change a `voice_id` and run `generate.py` again: only that character is regenerated.
- The whole prologue is about 44,000 characters, which fits ElevenLabs' Creator plan.
- Generated per-line audio is cached in `voices/cache/` (not committed), so reruns don't pay twice.

## Files

- `index.html`: the engine (dialogue, voices, verbs, inventory, hints, saves, title screen)
- `story.js`: the nine chapters
- `world3d.js`: the 3D engine (renderer, animated sea, fire, smoke, embers, camera moves, tap picking)
- `sets3d.js`: the 3D places (cabin, frigate deck, beach, village, tunnels, Record-Stone chamber, fishing boat)
- `people3d.js`: 3D characters (Sean, Deke, Mercer, Nia, troopers, Fleet soldiers, villagers, baby Olive) with walking and poses
- `art.js`: painted 2D scenes (Shannon's archive, Lily's morning, chapter cards, the title)
- `art/`: the family's artwork (title screen and portraits)
- `ART_PROMPTS.md`: prompts for making more paintings in the family's style

## Canon decisions (from Sean)

- The frame scene is canon: in-story Shannon tells in-story Olive and Hazel this story.
- Both girls get the same intensity. Nothing is softened for Hazel.
- Lily's morning is a cutscene.
- Hazel appears only in the frame scenes, never inside Bellgrave. Her origin stays unwritten.
- No mystery gets answered: the Record-Stone (its writing is deliberately unreadable), Olive's mark, the machinery, Nightforge, Deke and Mercer.

## Made up for the game (not in the written prologue)

- Shannon's asides and jokes, the sister's comments, and a few short lines (Mercer: "Lieutenant's by the boats").
- Appearances of Deke, Mercer, Nia and the villagers, beyond what the prologue describes.
- The newspaper's name ("The Central Authority Dispatch"). The currency stays unnamed.
