# Living Town resident AI: gap analysis against a "Sims 3 level" target

Scope: the codebase at `/home/user/claude/living-town` at commit `0eba37f` ("Living Town 0.5.1"). All sources below are local repo files; line numbers refer to that commit. I did not modify the repo. I ran `npm test` (20/20 pass, about 13.5 s), started a throwaway server on port 4399 with a scratch data directory to measure WebSocket payloads, and ran an in-process one-day simulation of the mind and life modules (scratch script, not in the repo). Measurements were taken in the research container, not on "Mouse" (the family's Mac server). Comparisons with The Sims come from general knowledge of the games, not from web sources. They appear only as framing in Inferences.

## 1. How do decisions work today, and what is persisted per resident?

### Takeaway
The resident AI is a utility scorer over six coarse "places", not over objects. Each resident scores every place from four needs, a fixed weekly obligation schedule, interest tags, the two strongest bonds present, crowding, stress and boredom. The resident then commits to the winner for 25 to 100 minutes. Conversations are pairwise dice rolls every 15 s. Life events are separate random draws every 15 to 45 minutes that nudge mood, goal progress and career progress. Mood valence, goals, memories, knowledge and careers never feed back into where a resident goes or what they do.

### Cited Findings
**Tick loop and movement (server.js)**
- The server ticks once per real second (`TICK_MS = 1000`) and broadcasts a tick payload after every tick. — [server.js:35](/home/user/claude/living-town/server.js), [server.js:581](/home/user/claude/living-town/server.js)
- Per tick, each resident runs `updateResident`: needs decay by `mind.decayRates`, `life.tickMood` pulls mood toward baseline, then `mind.decide` runs unless a player controls the resident. — [server.js:188-205](/home/user/claude/living-town/server.js)
- Elapsed time per tick is capped at 5 s (`Math.min(5, …)`), so a stalled event loop loses simulated time rather than jumping. — [server.js:248](/home/user/claude/living-town/server.js)
- Movement follows walkway waypoints at `40 * speed` map units per second, carrying leftover movement over to the next waypoint. While a path remains, the activity is overwritten with "walking to X". — [server.js:207-220](/home/user/claude/living-town/server.js)
- On arrival `mind.onArrive` picks an activity unless a life event's `activityUntil` is still active. A resident is asleep only when at "homes" during their sleep window. — [server.js:222-229](/home/user/claude/living-town/server.js)
- Needs restore only when the resident is within `PLACE_RADIUS` (70) of the place spot, at the place's hourly `needs` rates. Energy restores 1.4× while asleep. — [server.js:231-238](/home/user/claude/living-town/server.js), [shared/world.js:99](/home/user/claude/living-town/shared/world.js)
- Subsystem cadences: `socialTick` every 15 s, autonomous-experience check every 10 s, birthdays every 60 s. — [server.js:254-269](/home/user/claude/living-town/server.js)
- Routing uses Dijkstra over a hard-coded walkway graph of about 29 nodes and 31 edges, precomputed from every node at load. `route()` joins the two nearest nodes at each end. — [shared/world.js:52-72](/home/user/claude/living-town/shared/world.js), [shared/world.js:138-175](/home/user/claude/living-town/shared/world.js)
- Catch-up after downtime (capped at 30 days) does four things. It applies a closed-form need adjustment with floors (energy ≥ 30; hunger, social and fun ≥ 25). It forces a fresh `decide` for everyone and teleports residents into clusters at their chosen place. It then runs `runOfflineLife`. There are no offline conversations and no offline relationship changes. — [server.js:274-308](/home/user/claude/living-town/server.js)
- Offline life gives one experience per 8 offline hours, at most 12 per resident, spread evenly across the outage. — [lib/life.js:657-674](/home/user/claude/living-town/lib/life.js)

**Places (the only "objects")**
- The world has exactly six places: square, cafe, park, market, workshop and homes. Each has `needs` restore rates, a `quiet` value and interest `tags`. "homes" resolves to each resident's own front door. — [shared/world.js:17-48](/home/user/claude/living-town/shared/world.js), [shared/world.js:92-97](/home/user/claude/living-town/shared/world.js)
- Only four needs exist: energy, hunger, social and fun (default 82/78/72/75). — [shared/world.js:104](/home/user/claude/living-town/shared/world.js)

**Minds (lib/mind.js)**
- Each resident's mind is a static, code-defined record. It holds Big Five traits (0–1), interest tags, walking speed, wake and bed hours, weekend lie-in, weekly obligations, and a voice (share, reply and push templates). — [lib/mind.js:21-106](/home/user/claude/living-town/lib/mind.js)
- An unknown resident id falls back to `defaultMind`. — [lib/mind.js:108-114](/home/user/claude/living-town/lib/mind.js)
- Need decay depends on personality and age. Social decay is scaled by extraversion and fun decay by openness. Children get 1.2× hunger and 1.15× energy decay, seniors 1.2× energy decay. Sleep slows decay to 0.4×. — [lib/mind.js:213-225](/home/user/claude/living-town/lib/mind.js)
- `scorePlaces` adds up the following for every place — [lib/mind.js:235-301](/home/user/claude/living-town/lib/mind.js):
  - need deficit, squared and weighted by trait (lines 248-253)
  - an obligation bonus: 5 for strict obligations (school), otherwise 1.2 + 2.2·C (255-259)
  - an interest-tag match, capped at 2 tags (261-266)
  - social pull from the two strongest bonds present, with a family bonus, scaled by social need and clamped to [-1, 1.2] (268-278)
  - an introvert crowd penalty (279)
  - a quiet bonus when stress is above 50 (281-285)
  - a boredom penalty for staying, with a stickiness bonus of +0.3 (287-291)
  - a distance cost and random noise that grows with low conscientiousness (293-294)
- The top-scoring reason becomes the player-visible `intent` string. — [lib/mind.js:296-297](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:335](/home/user/claude/living-town/lib/mind.js)
- `decide` works as follows — [lib/mind.js:316-337](/home/user/claude/living-town/lib/mind.js):
  - During sleep hours, or when energy is below 8 after 19:00, the resident goes home with intent "bedtime".
  - Otherwise the resident re-scores only when the commitment has expired, the obligation window changes, or any need is below 15.
  - A new commitment lasts `25 + 50·C + rand·25` minutes.
- The activity is flavour text chosen on arrival. The obligation activity wins; otherwise a liked-tag activity is picked 75% of the time. Activities have no mechanical effect. — [lib/mind.js:117-124](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:303-310](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:339-344](/home/user/claude/living-town/lib/mind.js)
- `socialTick` checks every awake pair in O(n²). A pair is eligible when both are within 60 map units, they have not talked to each other for 20 minutes, and neither has talked to anyone for 4 minutes. Each resident has at most one conversation per check. The chance is `conversationChance`, clamped to 0.01–0.3. — [lib/mind.js:464-481](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:372-378](/home/user/claude/living-town/lib/mind.js)
- `converse` picks one of four conversation kinds — [lib/mind.js:384-424](/home/user/claude/living-town/lib/mind.js):
  - **friction** has a base chance of 3%, raised by low agreeableness, stress and incompatibility, and halved when the relationship is above 60.
  - **interest** requires a shared interest that is not a recent topic, then fires 55% of the time.
  - **news** transfers one stored fact through `shareKnowledge`.
  - **smalltalk** is the fallback.
- Effects of a conversation — [lib/mind.js:426-454](/home/user/claude/living-town/lib/mind.js):
  - Relationships change asymmetrically. Friction costs 2 to 5 points; other kinds add `1 + 2·compat (+1 for interest)`. Values are clamped to [-100, 100].
  - Social need and mood (valence and stress) change.
  - A 9–11 s speech bubble is set for each speaker.
  - A memory entry `{at, about, text, type:"conversation", tone}` is added to each speaker, capped at 120.
- Compatibility is 1 minus the mean absolute difference across the Big Five. — [lib/mind.js:348-352](/home/user/claude/living-town/lib/mind.js)

**Life (lib/life.js)**
- Profiles are static and code-defined. Each has a birth date, role, summary, likes, dislikes, values, three goals, family links, a career, career stages or ladder, and history tracks. — [lib/life.js:28-123](/home/user/claude/living-town/lib/life.js)
- Background history is 10 years × 3 events, deterministic and seeded, and age-gated. Career entries appear only after `careerStartAge`, and marriage and parenting entries only from age 25. — [lib/life.js:281-334](/home/user/claude/living-town/lib/life.js)
- Mood is two scalars (valence, stress) plus a derived label with 7 values and a `reason` string. It decays toward a trait-dependent baseline, and needs below 25 or 15 add stress and reduce valence. There is no list of timed, stacking effects. — [lib/life.js:459-488](/home/user/claude/living-town/lib/life.js)
- `runAutonomousExperience` draws a weighted event kind: family, play or school (minors), career (non-retired adults), mentoring (retired), interest or community. Trait weights shape the draw. Each event nudges mood by `delta × 0.6`, advances the single active goal, and for career events advances `career.progress`. Reaching 100 progress means a rank-up on the ladder. The event sets a 45 s activity override. — [lib/life.js:523-636](/home/user/claude/living-town/lib/life.js)
- Goals: one active goal at a time, progressed only by random experiences (`goalDelta × (0.7 + 0.6·C)`). Completed goals are kept, up to 8. New goals come from the profile first, then from likes-derived templates. — [lib/life.js:356-369](/home/user/claude/living-town/lib/life.js), [lib/life.js:593-607](/home/user/claude/living-town/lib/life.js), [lib/life.js:416-420](/home/user/claude/living-town/lib/life.js)
- Knowledge holds only facts learned from others, capped at 240. Recent experiences are favoured 60% of the time when sharing. — [lib/life.js:638-651](/home/user/claude/living-town/lib/life.js), [lib/life.js:409-413](/home/user/claude/living-town/lib/life.js)
- Birthdays add +15 valence and push a birthday experience. — [lib/life.js:677-692](/home/user/claude/living-town/lib/life.js)

**State that never feeds back into decisions (verified by grep)**
- `lib/mind.js` never reads `goals`, `career`, `knowledge`, `memories` or `mood.valence` when choosing places or conversations. Of mood it uses only `stress`. — [lib/mind.js:281](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:376](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:391](/home/user/claude/living-town/lib/mind.js)
- Memories are written (mind.js:451-452; life.js:503) but never read by any logic. Their only reader is the client/serialiser.
- Career progress comes only from random "career" experiences. Attending work obligations has no effect on career or goals. — [lib/life.js:564-578](/home/user/claude/living-town/lib/life.js)

**Persisted per resident.** The whole `state` object is written by `store.save(state)` ([server.js:312-320](/home/user/claude/living-town/server.js)); the controller map is kept out of it ([server.js:137](/home/user/claude/living-town/server.js)).
- Base fields: `id, name, color, x, y, targetX, targetY, place, activity, needs{energy,hunger,social,fun}, memories[], relationships{id:number}, lastTalk, path[]` — [server.js:54-61](/home/user/claude/living-town/server.js)
- Runtime flags: `arrived, asleep, intent, speech{text,from,until}, activityUntil` — [server.js:164](/home/user/claude/living-town/server.js), [server.js:228](/home/user/claude/living-town/server.js), [lib/mind.js:446-447](/home/user/claude/living-town/lib/mind.js), [lib/life.js:631](/home/user/claude/living-town/lib/life.js)
- `mind{commitUntil, arrivedAt, obligationKey, talkedWith{id:ts}, recentTopics[≤6], version:1}` — [lib/mind.js:172-185](/home/user/claude/living-town/lib/mind.js)
- Life fields: `profile` (a derived snapshot), `lastKnownAge, lifeHistory[], historyVersion, career{kind,organization,rank,progress,successes,setbacks,level,title}, experiences[≤120], memories[≤120], knowledge[≤240], lifeRevision, goals[], mood{label,valence,stress,reason}, autonomy{nextEventAt,eventCount}` — [lib/life.js:379-434](/home/user/claude/living-town/lib/life.js)
- Top level: `version, lastRealTime, eventId, events[≤200], residents, lifeEngine{…}, familyBondsSeeded` — [server.js:70](/home/user/claude/living-town/server.js), [server.js:117](/home/user/claude/living-town/server.js), [lib/life.js:455](/home/user/claude/living-town/lib/life.js)
- Traits, interests, voices, schedules, profiles and likes are **not** in the save. They are code constants looked up by id. — [lib/mind.js:22-114](/home/user/claude/living-town/lib/mind.js), [lib/life.js:28-123](/home/user/claude/living-town/lib/life.js)

**Observed behaviour: one simulated day (in-process script, residents teleported to their chosen place)**
- Per day: 49 place changes across the 7 residents, 132 conversations (news 111, interest 13, friction 8), and 237 autonomous experiences (about 34 per resident). — measured by a scratch script calling the `lib/mind.js` and `lib/life.js` functions directly
- Relationships saturate quickly. After one day Olive→Hazel was 100 and Olive→Sean 95.5, while Olive→Zara and Olive→Finn stayed at the starting 20 because they never talked. — same run
- Seven moods ended at "content" or "happy". — same run

### Inferences
- "News" dominates conversation (about 84%). Interest talk needs a shared, non-recent interest, and the knowledge pool (about 30 history facts per resident plus experiences) is rarely exhausted. Talk will read as residents reciting biographies to each other.
- The one-number relationship saturates within a day for family and co-located pairs. After that it stops carrying information: nothing decays it, and 100 is the cap.
- The architecture is a clean, testable "needs + utility + commitment" core, close in spirit to Sims 1 place-level motives. What it lacks is the object/advertisement layer and the feedback loops (moodlets, wishes, memories) that make Sims 3 feel reactive.

### Gaps
- I did not measure behaviour on the real deployment (Mouse, macOS) or with real walking times. My one-day sim teleports residents, which overstates co-location and so conversation counts.
- I did not run a multi-week soak to see whether mood or relationship distributions stabilise. `test/life.test.js:63` has a "long soak" test, but it covers goals and moods, not relationships.

## 2. What is missing compared with The Sims 2/3?

### Takeaway
Nearly every Sims 3 system is absent or present only as a single scalar or a flavour string. Partial analogues exist: Big Five traits (a stand-in for traits), goals (a weak stand-in for wishes or lifetime wishes), careers with ladders (no pay or performance), memories and knowledge (write-only), and fact-passing between residents (a proto-gossip mechanic). Missing entirely: objects, advertisements, moodlets, fears, skills, money, acceptance or rejection, group activities, invitations and an interaction queue.

### Cited Findings
| Sims system | Living Town today | Evidence |
|---|---|---|
| Objects and interactions below place level | None. Six places with flat `needs` rates and tags; "activities" are text only | [shared/world.js:17-48](/home/user/claude/living-town/shared/world.js); [lib/mind.js:117-124](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:303-310](/home/user/claude/living-town/lib/mind.js) |
| Moodlets with durations | None. Mood is valence and stress scalars plus one `reason` string overwritten by the latest event | [lib/life.js:422-428](/home/user/claude/living-town/lib/life.js), [lib/life.js:623-626](/home/user/claude/living-town/lib/life.js) |
| Wishes and fears | No fears. One active "goal" that progresses by random events; it does not change decisions | [lib/life.js:593-607](/home/user/claude/living-town/lib/life.js); mind.js never references goals (grep) |
| Traits beyond the Big Five | Big Five numbers plus interest tags. Likes, dislikes and values exist in profiles but are used only as text (likes also seed goal and experience text) | [lib/mind.js:21-24](/home/user/claude/living-town/lib/mind.js); [lib/life.js:364](/home/user/claude/living-town/lib/life.js), [lib/life.js:584](/home/user/claude/living-town/lib/life.js) |
| Relationship axes and levels | One number per directed pair, -100 to 100. Family seeded at ≥ 55. No friend or enemy levels, no daily/lifetime split, no decay | [server.js:50](/home/user/claude/living-town/server.js); [lib/mind.js:188-195](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:428-429](/home/user/claude/living-town/lib/mind.js) |
| Interaction acceptance and rejection | None. Once the chance roll passes, the conversation always happens; friction is the only "negative" outcome | [lib/mind.js:475-477](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:401-405](/home/user/claude/living-town/lib/mind.js) |
| Memories that change later behaviour | Memories are written with `about`, `type` and `tone`, but nothing reads them | [lib/mind.js:451-452](/home/user/claude/living-town/lib/mind.js); [lib/life.js:500-506](/home/user/claude/living-town/lib/life.js) |
| Gossip | A partial analogue. `shareKnowledge` passes facts *about the speaker only* (`ownFacts(b)`); there is no third-party gossip or re-telling of learned facts | [lib/life.js:639-651](/home/user/claude/living-town/lib/life.js), [lib/life.js:371-377](/home/user/claude/living-town/lib/life.js) |
| Group activities and invitations | None. Conversations are strictly pairwise; the "busy" set blocks a third participant | [lib/mind.js:464-481](/home/user/claude/living-town/lib/mind.js) |
| Money and economy | None (no money, price or funds fields in lib/, shared/ or client.js; grep) | grep over lib, shared, public/client.js |
| Skills | None. "skill" appears only inside story text | [lib/life.js:35](/home/user/claude/living-town/lib/life.js), [lib/life.js:136](/home/user/claude/living-town/lib/life.js) |
| Career performance | Rank and progress from random events only; no attendance, pay or performance meter | [lib/life.js:564-578](/home/user/claude/living-town/lib/life.js), [lib/life.js:609-621](/home/user/claude/living-town/lib/life.js) |
| Background story progression | Per-resident experiences, ladder promotions, birthdays and offline catch-up. No town-level events, no new residents except code seeds, no aging into new life stages beyond the label | [lib/life.js:523-636](/home/user/claude/living-town/lib/life.js), [lib/life.js:677-692](/home/user/claude/living-town/lib/life.js); [server.js:106-112](/home/user/claude/living-town/server.js) |
| Player commands queued alongside free will | None. A player can only send `control {x,y}` for their own resident, which walks there and suspends free will entirely until release | [server.js:499-503](/home/user/claude/living-town/server.js), [server.js:521-537](/home/user/claude/living-town/server.js), [server.js:193-196](/home/user/claude/living-town/server.js) |
| Autonomy while player-controlled | Needs and mood still tick, but `decide` is skipped and the intent reads "following a player's lead". On release `commitUntil = 0`, so the resident re-plans immediately | [server.js:193-196](/home/user/claude/living-town/server.js), [server.js:180-186](/home/user/claude/living-town/server.js) |
| Needs | 4 motives (Sims 3 has more, including bladder, hygiene and social) | [shared/world.js:104](/home/user/claude/living-town/shared/world.js) |
| Obligations | Hard-coded weekly windows per resident; only school is "strict" | [lib/mind.js:27](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:207-210](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:255-259](/home/user/claude/living-town/lib/mind.js) |

### Inferences
- The two biggest missing loops are (a) *object and interaction advertisements*, the finer-grained "what can I do here", and (b) *feedback from outcomes into state that biases the next decision*: moodlets, memories and wishes. Adding (b) on top of the existing place scorer is cheaper and yields more "aliveness" per line of code than (a).
- Bladder and hygiene needs would add chores rather than stories and are awkward for a family audience; the four existing needs are probably enough.
- Money is the most design-risky addition for the 7-year-old (pressure, "poor" labels) and is low on the fun-per-effort curve for an observer game.

### Gaps
- No design documents in the repo describe intended Sims-style systems. The parking lot lists only generative dialogue, interiors, town editing and TV mode ([PROJECT_LOG.md:121-127](/home/user/claude/living-town/PROJECT_LOG.md)). The priorities are therefore not stated by the owners.

## 3. Where can each system be added with least disruption, and what needs a save migration?

### Takeaway
Most new systems can be added as new optional fields, hydrated with defaults by the existing `ensure*` functions, with no schema bump. The pattern is already "normalize on load". One trap: `ensureMind` and `ensureResidentLife` rebuild `resident.mind`, `resident.career` and `resident.mood` as whitelisted objects, so new sub-fields placed there are silently dropped on the next load unless those functions are updated. Changing a relationship from a number to an object is the one change that truly needs a version-4 migration, because at least ten call sites treat `relationships[id]` as a number.

### Cited Findings
**Migration machinery**
- `SCHEMA_VERSION = 3`. On load the server accepts versions 1, 2 and 3 (`store.load([1, 2, SCHEMA_VERSION])`) and runs `migrate()`. `migrate()` normalizes residents, adds missing seeds, hydrates life, runs `ensureMind` on everyone, seeds family bonds once, and stamps the version. — [server.js:34](/home/user/claude/living-town/server.js), [server.js:97-120](/home/user/claude/living-town/server.js), [server.js:136](/home/user/claude/living-town/server.js)
- Persistence rejects any version not in the supported list (`unsupported schema version`). — [lib/persistence.js:100](/home/user/claude/living-town/lib/persistence.js)
- `normalizeResident` coerces needs, relationships, memories, knowledge, experiences, position and path. It iterates `DEFAULT_NEEDS`, so a new need added there is auto-filled. — [server.js:75-95](/home/user/claude/living-town/server.js)
- `ensureMind` rebuilds `resident.mind` from a fixed field list (`commitUntil, arrivedAt, obligationKey, talkedWith, recentTopics, version`). Any other key is discarded. — [lib/mind.js:172-185](/home/user/claude/living-town/lib/mind.js)
- `ensureResidentLife` rebuilds `career` from a fixed field list and `mood` as `{label, valence, stress, reason}`. Extra keys are discarded. — [lib/life.js:392-405](/home/user/claude/living-town/lib/life.js), [lib/life.js:422-428](/home/user/claude/living-town/lib/life.js)
- There is a content-versioning precedent that regenerates derived data without a schema bump: `HISTORY_VERSION` / `historyVersion`. — [lib/life.js:13](/home/user/claude/living-town/lib/life.js), [lib/life.js:386-390](/home/user/claude/living-town/lib/life.js)
- The integration test starts from a legacy save and checks migration. It is the natural place for a v3→v4 regression test. — [test/integration.test.js:29](/home/user/claude/living-town/test/integration.test.js); [PROJECT_LOG.md:81](/home/user/claude/living-town/PROJECT_LOG.md) (0.2.4 legacy-save coverage)

**Call sites that assume `relationships[id]` is a number** (these must change if relationships become multi-axis)
- Seed values: [server.js:50](/home/user/claude/living-town/server.js), [server.js:56](/home/user/claude/living-town/server.js), [server.js:67](/home/user/claude/living-town/server.js), [server.js:109](/home/user/claude/living-town/server.js)
- Family seed: [lib/mind.js:192](/home/user/claude/living-town/lib/mind.js)
- Social pull: [lib/mind.js:271](/home/user/claude/living-town/lib/mind.js)
- Chance and friction: [lib/mind.js:374](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:390](/home/user/claude/living-town/lib/mind.js)
- Update: [lib/mind.js:428-429](/home/user/claude/living-town/lib/mind.js)
- Client "Closest" sort: [public/client.js:484](/home/user/claude/living-town/public/client.js)
- Serialised wholesale to clients: [server.js:330](/home/user/claude/living-town/server.js)

**Extension points per system (file:line anchors)**
- *Smart objects and advertisements.* Add an `objects` table per place in `shared/world.js` next to `places` ([shared/world.js:17-48](/home/user/claude/living-town/shared/world.js)). Replace or augment `pickActivity` ([lib/mind.js:303-310](/home/user/claude/living-town/lib/mind.js)) so the resident scores object advertisements on arrival. Replace the flat place `needs` restoration in `updateResident` ([server.js:231-238](/home/user/claude/living-town/server.js)) with the chosen object's per-need rates. `scorePlaces` can take the best advertisement at each place as the place's value ([lib/mind.js:248-253](/home/user/claude/living-town/lib/mind.js)). Object definitions are static code, so the only save addition is something like `resident.using = {objectId, until}`; no migration is needed if it is defaulted.
- *Moodlets.* Add `resident.moodlets = [{id, until, valence, stress, source}]` at the resident's top level (not inside `mood`, which gets rebuilt). Emit moodlets from:
  - `converse`, in place of the direct mood edits at [lib/mind.js:433-436](/home/user/claude/living-town/lib/mind.js)
  - `runAutonomousExperience`, at [lib/life.js:623-626](/home/user/claude/living-town/lib/life.js)
  - `checkBirthdays`, at [lib/life.js:686](/home/user/claude/living-town/lib/life.js)
  - low needs inside `tickMood`, at [lib/life.js:481-484](/home/user/claude/living-town/lib/life.js)

  Make `tickMood` compute valence and stress as baseline plus active moodlets, then expire old ones. `scorePlaces` can then read `mood.valence` as well as stress.
- *Wishes and fears.* The goals array ([lib/life.js:356-369](/home/user/claude/living-town/lib/life.js), [lib/life.js:416-420](/home/user/claude/living-town/lib/life.js)) is the nearest home, but `ensureResidentLife` keeps only one active goal (line 420). Short-lived wishes fit better as a separate `resident.wishes[]`: generated from traits and interests, each scored as a bonus term in `scorePlaces` (after [lib/mind.js:266](/home/user/claude/living-town/lib/mind.js)) and fulfilled in `onArrive` or `converse`, where fulfilment emits a moodlet. Fears could be a negative term in the same spot.
- *Traits beyond the Big Five.* Traits live in code ([lib/mind.js:22-106](/home/user/claude/living-town/lib/mind.js)) and profiles in code ([lib/life.js:28-123](/home/user/claude/living-town/lib/life.js)). Named traits (e.g. "animal lover", "neat") can be added as static arrays with no save change, then referenced from `scorePlaces`, `decayRates` and `converse`. Profile `likes`, `dislikes` and `values` already exist and are unused by the AI, which makes them cheap hooks.
- *Multi-axis relationships.* Needs a v4 migration: convert `relationships[id]: n` to `{friendship: n, familiarity, trust, lastSeen, …}`, or add a parallel `bonds{}` map so the numeric one can stay for compatibility. The parallel map avoids touching the ten call sites above but duplicates state.
- *Interaction acceptance and rejection.* Insert between the chance roll and `converse` in `socialTick` ([lib/mind.js:475-477](/home/user/claude/living-town/lib/mind.js)), or at the top of `converse` ([lib/mind.js:384-393](/home/user/claude/living-town/lib/mind.js)). A rejection produces a new `kind` with a mild moodlet and a memory.
- *Memories that change behaviour.* Memories already carry `about` and `tone` ([lib/mind.js:451-452](/home/user/claude/living-town/lib/mind.js)). Read them in `conversationChance` ([lib/mind.js:372-378](/home/user/claude/living-town/lib/mind.js)) and in the friction formula ([lib/mind.js:392-393](/home/user/claude/living-town/lib/mind.js)). Keep the 120 cap in mind ([lib/life.js:16](/home/user/claude/living-town/lib/life.js)): memory importance or salience needs a separate small "notable" list if it must survive the cap.
- *Gossip.* Extend `shareKnowledge` ([lib/life.js:639-651](/home/user/claude/living-town/lib/life.js)) so a resident can re-tell facts from their own `knowledge` about third parties. `learnedFrom` and `subjectId` are already stored, so gossip chains need no new fields.
- *Group activities and invitations.* Needs a new top-level `state.gatherings = [{place, activity, members, until}]` (defaultable, no bump), a planner in `tick` next to the social check ([server.js:254-257](/home/user/claude/living-town/server.js)), and a bonus term in `scorePlaces` for invited residents.
- *Interaction queue and player commands.* Extend `validateClientMessage` ([server.js:493-510](/home/user/claude/living-town/server.js)) with a new message type (e.g. `{type:"suggest", residentId, action}`). Add `resident.queue[]`, which `decide` consults before scoring ([lib/mind.js:326-331](/home/user/claude/living-town/lib/mind.js)). Keep the queue out of the save, or cap it: controller state is deliberately never persisted ([PROJECT_LOG.md:31](/home/user/claude/living-town/PROJECT_LOG.md)), and queued commands probably shouldn't be either.
- *Skills.* Add `resident.skills{}` as a new top-level field. Increment it in `updateResident` while the resident uses a skill object or activity ([server.js:231-238](/home/user/claude/living-town/server.js)), and gate advertisements on skill level.
- *Money.* Add `resident.funds` as a new field, with income tied to obligation attendance (detected in `updateResident` when `activeObligation` matches `r.place`).
- *Background story progression.* Hooks already exist: the `runOfflineLife` / `catchUpOnBoot` pair ([server.js:304-307](/home/user/claude/living-town/server.js)) and the autonomy check ([server.js:258-265](/home/user/claude/living-town/server.js)). Offline catch-up currently skips conversations and relationships entirely; a coarse offline social pass could be added there.

### Inferences
- A no-bump approach is viable for moodlets, wishes, skills, funds, queues, gatherings and object use, provided the new fields sit at the resident's top level or `ensureMind`/`ensureResidentLife` are extended. Save one real v4 migration for relationships and do everything in that release.
- Rollback risk: once a v4 save is written, an older 0.5.x server will refuse it ([lib/persistence.js:100](/home/user/claude/living-town/lib/persistence.js)). Backups and hourly snapshots of v3 data are kept ([README.md:79](/home/user/claude/living-town/README.md)), but they roll back town progress. Staged, additive fields avoid this.
- Because traits, profiles and schedules are code constants, content changes such as new traits or new objects ship with code and need no migration. This is a strength worth preserving (content version constants, as with `HISTORY_VERSION`).

### Gaps
- I did not inspect `lib/persistence.js` beyond the version check and write path, so I can't say how corrupted-field recovery would interact with new nested objects.

## 4. What does the client show today, and what UI do iPhone players need?

### Takeaway
The phone client is a portrait canvas map with a bottom sheet. For the selected resident it shows: activity plus place, "Why: <intent>", a mood label, age, the single "Closest" friend, four need bars, a summary, career, the current goal with a progress bar, family, the latest memory, and tabs for town feed, history and learned facts. On the map, speech bubbles truncate at 54 characters. The client does not show thought bubbles or intent on the map, mood reasons, a relationship list or web, memories as a list, or anything for moodlets, wishes or skills.

### Cited Findings
- Layout — [public/index.html:16-88](/home/user/claude/living-town/public/index.html):
  - a top bar with profile, title and a live clock
  - a canvas world card with a place chip and a recenter button
  - a bottom sheet with portrait, name, activity, intent, and quick stats (Mood / Age / Closest)
  - expandable details: needs, summary, Life/Goal, Family, latest memory, and tabs Town feed / History / Learned
  - a dock with Town / Play / People / Stories
  - a "While you were away" return card
- Per-tick dynamic rendering updates the activity and place, "Why: intent", the place chip, the mood label and the need bars. It deliberately does not rebuild lists. — [public/client.js:458-473](/home/user/claude/living-town/public/client.js)
- Detail rendering rebuilds only when `lifeRevision`, the detail revision or the player's look changes. — [public/client.js:447-456](/home/user/claude/living-town/public/client.js), [public/client.js:475-509](/home/user/claude/living-town/public/client.js)
- Relationships are reduced to one name: "Closest" is the top entry of the sorted `relationships`. — [public/client.js:484-485](/home/user/claude/living-town/public/client.js)
- `mood.reason` is sent to clients ([server.js:324](/home/user/claude/living-town/server.js)) but never rendered. Only `mood.label` is shown ([public/client.js:464](/home/user/claude/living-town/public/client.js)); a grep for "reason" in client.js finds only the control-rejected toast.
- Speech bubbles are drawn on the canvas for each resident while `speech.from ≤ now < speech.until`, truncated to 54 characters (51 plus an ellipsis) and at most 230 screen px wide. — [public/client.js:366-367](/home/user/claude/living-town/public/client.js), [public/client.js:426-444](/home/user/claude/living-town/public/client.js)
- Names are drawn only for the selected resident, or for everyone when zoomed in above 1.1×. — [public/client.js:392-393](/home/user/claude/living-town/public/client.js)
- Sleeping residents are hidden inside houses, and the house sign shows "z…". — [public/client.js:344](/home/user/claude/living-town/public/client.js), [public/client.js:405-424](/home/user/claude/living-town/public/client.js)
- The town feed shows the latest 8 events. — [public/client.js:511-513](/home/user/claude/living-town/public/client.js)
- The Learned tab shows the latest 20 facts. — [public/client.js:502-508](/home/user/claude/living-town/public/client.js)
- "Find someone interesting" picks whoever is talking, otherwise the resident with the most extreme valence. — [public/client.js:629-636](/home/user/claude/living-town/public/client.js)
- Play mode is tap-to-walk only. Tapping a sign walks to its door; there is no interaction menu. — [public/client.js:545-565](/home/user/claude/living-town/public/client.js)
- The client releases control when the page is hidden, which matters on iPhone because backgrounding the PWA drops control. — [public/client.js:799-804](/home/user/claude/living-town/public/client.js)
- The bottom sheet is capped at `max-height: 78dvh`, with safe-area insets on the top bar and dock. — [public/styles.css:148-164](/home/user/claude/living-town/public/styles.css), [public/styles.css:49](/home/user/claude/living-town/public/styles.css), [public/styles.css:383](/home/user/claude/living-town/public/styles.css)
- Detail data (history, knowledge, experiences, 30 memories) is pulled on demand with an `inspect` message. The server rate-limits it to one per 200 ms per socket and caches it by revision. — [server.js:505-507](/home/user/claude/living-town/server.js), [server.js:512-519](/home/user/claude/living-town/server.js), [server.js:553-565](/home/user/claude/living-town/server.js); [public/client.js:164-170](/home/user/claude/living-town/public/client.js)
- A stated open question from playtesting: "Do the new personalities read clearly on a phone, or do intents and voices need more room?" — [PROJECT_LOG.md:115-118](/home/user/claude/living-town/PROJECT_LOG.md)

### Inferences
Proposed UI for richer AI on a portrait iPhone (my design suggestions, not in the repo):
- **Thought bubbles on the map.** A small icon bubble above each resident (a need, wish or moodlet icon), distinct from speech. Icons avoid the 54-character truncation and suit a 7-year-old reader. Reuse the `drawChatBubble` path ([public/client.js:426-444](/home/user/claude/living-town/public/client.js)) with an icon glyph. Show them only for the selected resident, or when zoomed in, so the small screen doesn't clutter; the name-label rule at client.js:393 is a precedent.
- **Moodlet strip** in the quick-stats row: 3–5 emoji or icon chips with remaining-time rings. Tapping one shows its text reason (and would finally surface `mood.reason`).
- **Wishes panel** with 1–3 wish cards. For players, a "help with this" button could enqueue a suggestion (see the queue in Q3).
- **Relationship view.** A sorted list with small bars per axis is more phone-friendly than a force-directed web; a simple radial "web" around the selected resident with 6 others is feasible at 7 residents. Replaces the single "Closest" value.
- **Memory and gossip tab** next to History and Learned, showing "remembers" entries that affect behaviour, with "heard from X" provenance (already stored as `learnedFrom`).
- **Interaction menu (play mode).** Long-press or tap another resident to get 3–4 big buttons (chat, play, share news, invite). Minimum 44 pt touch targets. Hit-testing already enlarges targets ([public/client.js:549-552](/home/user/claude/living-town/public/client.js)).
- The feed shows only 8 events. A richer AI generates many more events (about 370 per day measured above), so a filtered "stories worth seeing" digest will matter more than a raw feed.

### Gaps
- I did not render the client on an iPhone viewport or take screenshots, so I can't judge current crowding of the sheet or map.
- There is no usage data on what the children actually look at.

## 5. Performance and budget: what is the headroom?

### Takeaway
Server CPU for the AI is negligible: about 13 µs per tick for all seven residents in my run, against a 1000 ms tick. Bandwidth and save size are the real constraints. The tick broadcast is about 2.4 KB per phone per second even when idle, because every resident's dynamic record is sent every tick. Any change to a resident's life resends a full summary of about 3 KB. The whole state (about 200 KB after one simulated day, and growing toward the caps) is serialised synchronously every 10 s. Richer AI should add compact, delta-friendly fields to `residentDynamic` and keep long lists in the on-demand `inspect` detail.

### Cited Findings
**Measured (scratch server on port 4399, fresh town, 20 ticks)**
- The full-state message on connect was 10,642 bytes. Tick messages were 2,315–2,617 bytes (average 2,435) with no `changed` residents. The dynamic record was about 298 bytes per resident. A fresh resident's detail was 6,695 bytes.

**Measured (in-process one-day sim, after 24 h of simulated life)**
- Per-resident `residentSummary`-equivalent fields: about 2.9–3.4 KB each.
- Detail payload: about 16.5–24.3 KB each.
- Whole state `JSON.stringify`: about 199 KB; Olive alone about 34 KB.
- Experiences reached about 30–33 per resident and memories 68–86 per resident in one day, so the caps of 120 ([lib/life.js:15-16](/home/user/claude/living-town/lib/life.js)) will be reached in about 4 days and 1.5–2 days respectively.
- Knowledge was at 7–35 of the 240 cap ([lib/life.js:14](/home/user/claude/living-town/lib/life.js)).
- The AI logic cost about 1.15 s of CPU per 86,400 simulated ticks, roughly 13.3 µs per tick for 7 residents. This covers decay, mood, decide, social and autonomy, and excludes movement, JSON and WebSocket costs.

**Code facts**
- Each tick serialises `residentDynamic` for every resident: position, target, place, activity, intent, asleep, needs, mood (including the reason string), speech and lifeRevision. On top of that it adds `residentSummary` for any resident whose `lifeRevision` changed, plus new events. The same JSON string is broadcast to all clients. — [server.js:337-345](/home/user/claude/living-town/server.js), [server.js:358-366](/home/user/claude/living-town/server.js), [server.js:480](/home/user/claude/living-town/server.js), [server.js:581](/home/user/claude/living-town/server.js)
- `lifeRevision` increments on every conversation, experience and learned fact ([lib/mind.js:438](/home/user/claude/living-town/lib/mind.js); [lib/life.js:505](/home/user/claude/living-town/lib/life.js), [lib/life.js:649](/home/user/claude/living-town/lib/life.js)). Each increment triggers a full summary resend, including the whole `relationships`, `profile`, `goals`, and 5 experiences and memories ([server.js:326-335](/home/user/claude/living-town/server.js)).
- The autosave writes all state every 10 s with synchronous `JSON.stringify`, `writeFileSync`, `fsync` and `rename` on the main thread. It also keeps rolling backups every 60 s (30 kept) and hourly snapshots (168 kept). — [server.js:36](/home/user/claude/living-town/server.js), [server.js:41-47](/home/user/claude/living-town/server.js), [server.js:582](/home/user/claude/living-town/server.js); [lib/persistence.js:17-30](/home/user/claude/living-town/lib/persistence.js), [lib/persistence.js:132-157](/home/user/claude/living-town/lib/persistence.js)
- Inbound WebSocket messages are capped at 1024 bytes, and inbound HTTP JSON at 4 KB. A command queue message must fit. — [server.js:37](/home/user/claude/living-town/server.js), [server.js:470](/home/user/claude/living-town/server.js), [server.js:400](/home/user/claude/living-town/server.js)
- The client interpolates positions at display rate and renders on canvas with cached sprites. It clamps the backing-store resolution to at most 2× device pixel ratio. — [public/client.js:326-339](/home/user/claude/living-town/public/client.js), [public/client.js:243-248](/home/user/claude/living-town/public/client.js), [public/client.js:271-277](/home/user/claude/living-town/public/client.js)
- `socialTick` is O(n²) over awake residents. It is trivial at n = 7 (21 pairs). — [lib/mind.js:467-479](/home/user/claude/living-town/lib/mind.js)
- `scorePlaces` is O(places × residents), because `peopleAt` filters all residents for each place. — [lib/mind.js:227-229](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:244-268](/home/user/claude/living-town/lib/mind.js)

### Inferences
- **CPU headroom** is roughly 4–5 orders of magnitude for decision logic. Even object-level advertisement scoring (say 50 objects × 7 residents, evaluated only when a resident is "due") would stay well under 1 ms per tick. The binding CPU cost is more likely the synchronous save as state grows. At about 0.5–1 MB of JSON once all caps fill (an estimate extrapolated from about 200 KB at one day; not measured), stringify plus fsync every 10 s on a Mac is probably tens of milliseconds. That is fine at 1 Hz, but worth measuring on Mouse.
- **Bandwidth.** About 2.4 KB/s idle per phone is about 8.8 MB per hour of an open tab. Over Tailscale on home Wi-Fi this is fine, but on cellular it adds up. Every new per-resident field in `residentDynamic` multiplies by 7 residents × 1 Hz; a 5-moodlet array with short strings could add about 1–2 KB per tick. Options:
  - send moodlets, wishes and thought icons as ids or codes rather than text
  - include them only when changed, by moving them to a revisioned channel like `lifeRevision`
  - drop unchanged residents from `residents[]` when they are asleep or stationary
  - stop resending `mood.reason` every tick
- The full-summary resend on each `lifeRevision` bump will grow with richer AI, because more events mean more bumps. Splitting revisions per facet (for example `socialRevision` and `moodRevision`) would keep payloads small.
- iPhone rendering: thought bubbles drawn on canvas for 7 residents are cheap. Rebuilding DOM lists every second is not, which is why the client already separates dynamic and detail renders ([public/client.js:458](/home/user/claude/living-town/public/client.js)). New panels should follow the same keyed-rebuild pattern.
- Thermal and battery cost on iPhone from continuous `requestAnimationFrame` plus a 1 Hz socket are pre-existing and not made worse by AI data. Richer on-map animation (bubbles bobbing) could be.

### Gaps
- I did not measure save latency on Mouse or on-device frame rate or battery on an iPhone.
- My summary and detail sizes approximate the server functions by reconstructing the same fields in a script; they are not captured from the live server after a day of play.

## 6. Kid-safety constraints already in code and docs

### Takeaway
Kid-safety today comes from curated content plus review gates, not from runtime filtering. The rules are:
- no deaths and no romance for minors
- age-gated histories and events
- child-safe disagreement topics
- mandatory Claude review before any LLM dialogue or memory, and before any change to what Olive reads

Every new Sims-style system must follow these by construction. That means curated text pools, no romance axis at all (or adult-only and never shown), and "friction" limited to mild, reversible topics.

### Cited Findings
- "Nobody dies, and there is no romance for minors." "Children only receive age-appropriate events and child-safe disagreements." "There is no generative dialogue until the LLM review gate is passed." — [LIFE_ENGINE.md:75-77](/home/user/claude/living-town/LIFE_ENGINE.md)
- "There is no generative AI in this release." — [LIFE_ENGINE.md:5](/home/user/claude/living-town/LIFE_ENGINE.md)
- Mandatory Claude review checkpoints include: "Before any LLM-generated dialogue or memory is enabled: review hardware limits, cost controls, privacy, and child-safety boundaries", and "Before releasing any change that affects what Olive sees or reads, including generated text, real friends' names, or personal information." — [PROJECT_LOG.md:39-43](/home/user/claude/living-town/PROJECT_LOG.md)
- "Safe failure: nobody dies in this prototype." — [PROJECT_LOG.md:14](/home/user/claude/living-town/PROJECT_LOG.md)
- Free-form generated dialogue is "deliberately out of scope until the LLM review gate … is passed". The server is for "trusted family devices on Tailscale only". — [README.md:23-25](/home/user/claude/living-town/README.md)
- The friction topics are a fixed, benign list (music turns, firewood, pineapple on pizza, the shortest path, board game rules, the dishwasher). The friction line template is fixed: "I still say you're wrong about …". — [lib/mind.js:159-166](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:402-405](/home/user/claude/living-town/lib/mind.js)
- The "push" voice lines are mild ("Nuh-uh!", "respectfully? no."). — [lib/mind.js:31](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:42](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:103](/home/user/claude/living-town/lib/mind.js)
- Age gating in history: career entries appear only from `careerStartAge`, and marriage and parenting only from 25. — [lib/life.js:300-304](/home/user/claude/living-town/lib/life.js)
- A test asserts no work content before age 14. — [test/life.test.js:24](/home/user/claude/living-town/test/life.test.js)
- Runtime events for minors are limited to play or school (children get "play", teens "school"); career events are excluded. Kid setbacks are small and end in "then bounced back". — [lib/life.js:529-536](/home/user/claude/living-town/lib/life.js), [lib/life.js:554-558](/home/user/claude/living-town/lib/life.js), [lib/life.js:219-224](/home/user/claude/living-town/lib/life.js)
- There is no romance code anywhere. Relationships are one friendship-like number; "spouse" exists only as a static family label for Milo and Zara. — [lib/life.js:73](/home/user/claude/living-town/lib/life.js), [lib/life.js:87](/home/user/claude/living-town/lib/life.js)
- Real family members appear as residents: Sean, Olive (born 2011, so 15) and Hazel (born 2019, so 7). "Sean's Systems" is a real-seeming business name. — [lib/life.js:28-65](/home/user/claude/living-town/lib/life.js)
- All user-visible text is HTML-escaped in the client (`escapeHtml`), and the CSP forbids inline scripts. — [public/client.js:808](/home/user/claude/living-town/public/client.js); [server.js:374](/home/user/claude/living-town/server.js)
- Player accounts restrict control to the player's own resident. Only olive, hazel and dad are playable. — [server.js:526-528](/home/user/claude/living-town/server.js); [shared/world.js:102](/home/user/claude/living-town/shared/world.js)

### Inferences
- **Friction and rejection.** The current friction path is not age-aware: children get the same benign list as adults, which works only because the list is universally mild. A new rejection mechanic, negative relationship axis, "enemy" level or fear system should keep that property: mild, recoverable, with no insults and no exclusion of a child resident by others as a repeating pattern. It would help to add an explicit life-stage check and a test like test/life.test.js:24.
- **Romance.** A Sims-style romance axis should either be omitted or restricted to the existing adult spouse pair as flavour only, never shown in a relationship web a child reads. Olive (15) and Nova (19, born 2007) are both on-screen. Keep the "no romance for minors" rule enforceable by construction by not having the axis at all.
- **Memories and gossip.** Third-party gossip involving the real children (e.g. "Hazel had a rough moment when…") would spread setbacks about a real 7-year-old through the town. Consider marking kid setbacks non-shareable (history facts are already `shareable: true` at [lib/life.js:330](/home/user/claude/living-town/lib/life.js), but the flag is never checked) before enabling gossip.
- **Checkpoint 3 applies to these features.** Thought bubbles, moodlet text, wishes and fears all change what Olive reads. Under the log's rules they need a review pass before release, even without an LLM.
- **Money and fears.** These need careful framing for a 7-year-old: no "broke" or "poor" labels, and no fear of death or darkness. Fears could be playful ("scared of the market goose").

### Gaps
- There is no automated content-safety test for the conversation or voice text pools. Only the history work-age test exists. I found no stated rules for teen-specific content (Olive at 15) beyond "no romance for minors".
- The repo gives no guidance on how the family wants disagreements between the real children's residents handled. I found no playtest notes.
