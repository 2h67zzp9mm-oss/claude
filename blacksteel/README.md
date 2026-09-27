# The Blacksteel Pirates: The Island That Never Existed

A King's Quest VII–style point-and-click retelling of the Blacksteel Pirates prologue. Shannon narrates. The player plays young Sean.

Open `index.html` in any browser (phone, tablet, or PC). No install, no server.

## How it works

- Olive and Hazel each play separately and have their own save (stored in that browser).
- Whoever isn't playing appears in Shannon's frame scenes as a listener, with her own lines.
- If the player picks something Sean didn't do, Shannon corrects it, so the prologue stays canon.
- Hazel's game adds glowing nudges after 20 seconds idle. Both players have a Hint button.

## Built so far

- Title screen with a player picker
- Frame scene: Shannon tells the story, with the sister listening
- Lily's morning cutscene
- Chapter One, The Call: Sean's cabin, the communicator call, the chart, "sit down for ten more seconds", the packet, and the promise

## Next

- Chapter Two, The Reef
- Chapter Three onward follows the prologue: Deke on the beach, the shrine, the name, holding the street, "Not them", the aftermath, and Blacksteel

## Canon decisions (from Sean)

- The frame scene is canon: in-story Shannon tells in-story Olive and Hazel this story.
- Both girls get the same intensity. Nothing is softened for Hazel.
- Lily's morning is a cutscene with no narrator.
- Hazel appears only in the frame scenes, never inside Bellgrave. Her origin stays unwritten.
- No mystery gets answered: the Record-Stone, Olive's mark, the machinery, Nightforge, Deke and Mercer.

## Files

- `index.html`: the game engine, dialogue, and Chapter One's script
- `art.js`: painted scenes and animation (moving lamp light, waves, fog, rain, embers, the rocking cabin)
- `chars.js`: walking characters. Tap the floor to walk; tap an object and Sean walks over before acting.

## Characters

Characters are jointed rigs drawn in code (`chars.js`): hips, knees, ankles, shoulders and elbows follow a
walk cycle that advances with distance walked, so the feet plant. Each character's look (`LOOKS`) follows the
family's paintings: Sean is bald with glasses and a beard, in a long black coat with brass trim, a purple sash,
boots, and a plain gray Nightforge. The paintings themselves are used for portraits and the title screen.
