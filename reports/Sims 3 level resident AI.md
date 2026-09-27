# Close the loops that make Sims feel alive

Living Town can reach "Sims 3 level" without an LLM, new hardware or a rewrite. Its residents already choose places by utility; what they lack are the **feedback loops** that make Sims 3 characters seem to have inner lives. In Sims 3, events create timed, labelled moodlets. Mood changes how carefully a Sim chooses. Traits shape which actions tempt a Sim, how it reacts and what it wishes for. Wishes and memories then pull the next decision. Today Living Town writes goals, memories, knowledge and mood valence and **never reads them back** when a resident decides what to do ([lib/mind.js](/home/user/claude/living-town/lib/mind.js)). The highest-value work is therefore not objects or more needs. It is five cheap loops built on the existing place scorer: moodlets, mood-sensitive choice, named traits, wishes with gentle fears, and memories that matter. Together they are roughly 15–20 developer-days. After that come multi-axis relationships with authored social exchanges (the fix for the fact that one simulated day already pushes relationships to 100), smart objects, group gatherings, and a kid-friendly "storyteller". CPU is not a constraint: the whole AI costs about 13 µs per one-second tick. Phone bandwidth, save migration and the family's content-review rule are the real constraints, and the roadmap below is ordered around them.

## Sims 2 and 3 run on advertisements, curves and timed modifiers

### Motives set the urgency and objects offer the actions

The Sims' "motive" system gives each Sim decaying needs. The Sims 2 has eight (Hunger, Comfort, Hygiene, Bladder, Energy, Fun, Social, Environment), each decaying constantly, and some activities speed that up ([StrategyWiki](https://strategywiki.org/wiki/The_Sims_2/Needs)). Decay is a per-motive rate that other systems can change: the Sims 2 "Slower Motive Decay" reward cuts it by **12% per purchase** ([Sims Wiki](https://sims.fandom.com/wiki/Aspiration_benefit)). The Sims 3 cut the list to six (Hunger, Bladder, Energy, Social, Hygiene, Fun) ([Carl's Sims 3 Guide](https://www.carls-sims-3-guide.com/info/motives.php)); comfort and environment effects became moodlets. Will Wright modelled the ordering on Maslow's hierarchy of needs: primal needs come first, so "a Sim won't enjoy a movie if she's hungry" ([Psychology Today](https://www.psychologytoday.com/us/articles/200311/the-sims-suburban-rhapsody)).

The key architectural idea is the **smart object**. When a Sim decides what to do, "it quickly makes a list of every object in the house and what they can offer". Maxis calls each offer an **advertisement**, and the Sim weights it "by applying a multiplier to the promised score, based on the Sim's current motive levels" ([GMTK](https://gmtk.substack.com/p/the-genius-ai-behind-the-sims)). That multiplier is a non-linear "contribution curve" ([SimsTek](https://simstek.fandom.com/wiki/SimAntics)), so a hungry Sim values food far more than a full one. In The Sims 1 and 2, each advertisement lives in a TTAB tuning resource with four fields ([Mod The Sims](https://modthesims.info/wiki.php?title=TTAB)). **Minimum** is the base value advertised to every Sim. **Delta** is a bonus that scales with a personality attribute. **Type** names that attribute. **Attenuation** sets how close the Sim must be before the offer attracts it.

Behaviour lives in the objects, written in the SimAntics scripting language with one thread per object ([Simpson, GDC 2005](https://archive.org/details/GDC2005Simpson)). So adding a new object adds new behaviour without changing the Sim's brain. The Sims 3 kept this idea in ITUN XML tuning. Every autonomous interaction lists which "commodities" it advertises and how strongly, which ages may use it, whether it can be autonomous, and which traits it **requires or bans** ([Nona Mena, ITUN guide](https://simlogical.com/ContentUploadsRemote/uploads/1588/ITUN_Modding_Discussion_Explanation.pdf)). The commodities cover the basic motives and also trait-specific wants ([Nona's Sims](https://nonasims.wordpress.com/2012/04/25/tutorial-tuning-mods-and-commodity-kinds/)).

Put together, the scoring is roughly `score = Σ curve(motive) × (Minimum + Delta × personality) × distance attenuation`. The field names are documented; the exact way they combine, the curve shapes and the decay rates are not public in any source the researchers could reach. Treat that formula as a sound reconstruction, not a copy.

### Sims 3 made mood control how sensible a Sim's choices are

Richard Evans, the Sims 3 AI lead, picked actions with "a modified version of the Boltzmann distribution… using a temperature that is low when the Sim is happy, and high when the Sim is doing badly", so an unhappy Sim is more likely to pick a low-utility action ([Wikipedia: Utility system](https://en.wikipedia.org/wiki/Utility_system), summarising Evans' GDC talk). This is a subtle, cheap and very "alive" effect: a happy Sim behaves sensibly and a miserable one acts erratically. Free will has three settings, High, Low and Off, and it chooses interactions by traits, favourites and compatibility with other Sims ([Sims Wiki](https://sims.fandom.com/wiki/Free_will)). Some life actions (paying bills, finding a job) are always left to the player ([Wikipedia](https://en.wikipedia.org/wiki/The_Sims_(video_game))).

**Moodlets** ("buffs" internally) are timed modifiers with a positive or negative value. Mood is roughly their sum, capped at **+150**, with negative stages below −10 and −50 ([Sims Wiki: Mood](https://sims.fandom.com/wiki/Mood)). Mood matters everywhere. Good mood improves work performance and how others receive a Sim's socials; bad mood can make a Sim refuse skill-building ([Sims Wiki: Mood](https://sims.fandom.com/wiki/Mood)). At +50 or more, lifetime happiness points accrue every in-game minute, fastest at +140 ([Sims Wiki](https://sims.fandom.com/wiki/Lifetime_happiness)). The structural shift from Sims 2 is that low motives mostly reach mood through moodlets such as "Hungry", so every mood change has a named, visible cause. That legibility is what Living Town is missing.

### Traits are tuning overlays, not personality sliders

The Sims 3 offers **60+ named traits** ([Carl's Sims 3 Guide](https://www.carls-sims-3-guide.com/traits/)), such as Neat, Loner, Hot-Headed, Family-Oriented, Loves the Outdoors and Good Sense of Humor ([Sims Wiki](https://sims.fandom.com/wiki/Category:Traits_from_The_Sims_3_(base_game))). Each trait is a bundle of rules. **Neat** "cleans regardless of mood, gets upset by filth". **Loner** "will never approach anyone who isn't a close friend" and gets nervous in large groups ([Carl's](https://www.carls-sims-3-guide.com/traits/)). **Over-Emotional** scales every moodlet by **1.25** ([Mod The Sims](https://modthesims.info/wiki.php?title=Sims_3%3AMoodlets)). **Ambitious** adds 15% to the lifetime-wish reward ([Sims Wiki](https://sims.fandom.com/wiki/Lifetime_wish)).

Evans' stated goal was that personality be "clearly manifest in autonomous behavior". Because the social system was fully data-driven, designers wrote "hundreds of interactions, and thousands of production-rules" ([GDC Vault](https://www.gdcvault.com/play/1012450/Modeling-Individual-Personalities-in-The)). An engineer can copy this as a four-part overlay per trait:

- **Gates:** unlock or forbid particular interactions.
- **Multipliers:** raise or lower the score of particular commodities.
- **Moodlet hooks:** trigger trait-specific moodlets (a Neat Sim upset by a dirty room).
- **Wish weights:** bias which wishes the Sim generates.

This is the difference between Living Town's Big Five numbers, which gently nudge scores, and traits a child can name and predict: "Hazel's an animal lover, so she went to see the ducks."

### Wishes, fears and lifetime wishes turn state into wanting

The Sims 2 gives each Sim **4 want slots and 3 fear slots**, filled from the Sim's aspiration, its personality and the current situation. The player can lock one want so it is not re-rolled ([Sims Wiki](https://sims.fandom.com/wiki/Wants_and_fears)). Fulfilling a want earns aspiration points and meeting a fear costs them, scaled by difficulty ([TheGamer](https://www.thegamer.com/the-sims-2-wants-and-fears-explained-aspiration-rewards-goals-lifetime/)). "Universal" wants and fears come from personality: Neat Sims fear roaches, Outgoing Sims want parties, and one Sim's want can be another's fear ([SimsCommunity](https://simscommunity.info/2022/08/31/looking-back-at-the-sims-2-wants-and-fears/)), which is a built-in source of mild friction.

The Sims 3 replaced this with trait- and context-driven wishes. The player "promises" up to **4** of them, which pays lifetime happiness points. A single **lifetime wish**, chosen around the teen-to-young-adult age-up, pays **20,000–65,000** points ([Sims Wiki](https://sims.fandom.com/wiki/Lifetime_happiness); [Sims Wiki](https://sims.fandom.com/wiki/Lifetime_wish)). Wishes do two jobs at once. They make a Sim's intentions visible, and they give the player something to help with. That is exactly the role Living Town's single, invisible "active goal" fails to fill.

### Relationships split fast feelings from slow bonds

The Sims 2 keeps two scores for each directed pair of Sims, both on a −100 to +100 scale. **Daily** is volatile and drops by 2 every day at 4 pm. **Lifetime** does not decay; three times a day it moves 3 points toward Daily ([StrategyWiki](https://strategywiki.org/wiki/The_Sims_2/Relationships)). Named states come from thresholds on these scores:

| State | Threshold |
|---|---|
| Friend | both Sims' Daily ≥ 50 |
| Best Friend | both Lifetime > 50 |
| Crush | Daily > 70 |
| Love | Lifetime > 70 |
| Enemy | one Sim's Daily < −50 |

Source: [StrategyWiki](https://strategywiki.org/wiki/The_Sims_2/Relationships).

Nightlife added 0–3 "chemistry" bolts computed from turn-ons ([StrategyWiki](https://strategywiki.org/wiki/The_Sims_2:_Nightlife/Attraction_and_Chemistry)). The Sims 3 hides the numbers behind one bar with named levels (Stranger → Acquaintance → Friend → Good Friend → Best Friend, plus Disliked and Enemy) ([Sims Wiki](https://sims.fandom.com/wiki/Friendship)), and mood changes how likely a social is to be accepted ([Sims Wiki: Mood](https://sims.fandom.com/wiki/Mood)).

One more commonly described Sims 3 mechanism could not be verified from a source: a short-term "conversation context" (friendly, awkward, hostile) that gates which socials are available. It is still a good design idea, and the CiF-lite proposal below covers the same ground.

### Story progression and memories make the town move without you

With story progression on, "uncontrolled Sims' lives progress normally: Neighbors may move away, new ones will move in, get promotions, get married, have children, make enemies" ([Sims Wiki](https://sims.fandom.com/wiki/Story_progression)). The NRaas mod improves on this by matching jobs to Sims' lifetime wishes instead of drafting them into whatever job is short-staffed ([itlandm](https://itlandm-sims.livejournal.com/49328.html)). The engineering pattern is a coarse "life-event" simulator for characters off-screen, running at low frequency.

The Sims 2 **memories** record major events with a positive or negative valence and a strength. They can be witnessed, passed on and discussed, and stronger memories come up in conversation more often ([PleasantSims](https://pleasantsims.com/sims-2-review-base-game/)).

### The series' known failures are useful warnings

Players criticise odd pathing, actions that silently vanish at doors ([NRaas](https://www.nraas.net/community/chatterbox/topic13069)), and needs left to fail with a toilet nearby ([NRaas](https://www.nraas.net/community/chatterbox/topic10652)). Sims 4 players add context-blind choices such as push-ups at a wedding ([Steam](https://steamcommunity.com/app/1222670/discussions/0/3172198151262339776/)). Most of these come from greedy local utility with no notion of social context and no re-planning after failure. Living Town's walkway graph and 25–100-minute commitments already avoid the worst of it, but any new object layer must re-plan when a route or action fails rather than drop it.

## Published game-AI research supplies five patterns worth copying

**Utility AI is the right core, with two anti-robot fixes.** Dave Mark's Infinite Axis Utility System scores each behaviour as the **product** of "considerations". Each consideration maps one normalised input through a response curve. Because products shrink as considerations are added (0.8³ = 0.512), Mark adds a compensation factor ([Zenn IAUS intro](https://zenn.dev/sanmal/articles/9ed9989c11b7eb?locale=en)).

Kevin Dill's **dual-utility reasoning** gives the first fix. An absolute priority ("bucket") first narrows the options to the most important relevant category, and a weighted-random pick then chooses among them ([Game AI Pro 2](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter03_Dual-Utility_Reasoning.pdf)). This makes emergencies override whims while ordinary choices stay varied. The second fix is **inertia**: a momentum bonus on the current action plus a minimum commit time. One framework gives a flat **25%** bonus to the last-chosen behaviour ([Bugnet](https://bugnet.io/blog/how-to-fix-utility-ai-oscillating-between-actions)); that figure is from a secondary source. Living Town already has commitment windows and stickiness, so it has half of this.

**Planners are for a few legible multi-step goals, not the main loop.** F.E.A.R. used only three FSM states and A* planning over actions that have preconditions, effects and costs ([Orkin, GDC 2006](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf)). Hierarchical task networks (HTNs) decompose authored compound tasks by trying methods in order. On *Transformers: Fall of Cybertron* this was "considerably faster" than the previous game's GOAP ([Humphreys, Game AI Pro](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter12_Exploring_HTN_Planners_through_Example.pdf)), and there is a portable open-source reference implementation ([Fluid HTN](https://github.com/ptrefall/fluid-hierarchical-task-network)). For a family town, a hand-authored HTN "recipe" wins over open-ended GOAP because the resulting plan is predictable and can be shown on screen ("Hazel is collecting flowers to give Dad").

**Comme il Faut shows how to author social choice.** Prom Week's CiF engine is built on authored **social exchanges**. Initiator influence rules set a character's *volition* to start an exchange with someone, and responder rules decide whether the other accepts. Both draw on a social-facts history database, a cultural knowledge base, and a large set of shared "microtheories" ([McCoy et al., AIIDE 2011](https://cdn.aaai.org/ojs/12454/12454-52-15982-1-2-20201228.pdf); [CiF thesis summary](https://fenix.tecnico.ulisboa.pt/downloadFile/844820067127173/96987-Filipe-Silveira-resumo.pdf)). Prom Week has three networks (Buddy, Romance, Cool), 12 intents, timed binary "statuses", **over 40 exchanges and over 5,000 social considerations** ([Prom Week blog](https://promweek.soe.ucsc.edu/2012/02/22/prom-weeks-social-exchanges/)). With only 42 directed pairs, Living Town can afford to evaluate every exchange for every pair on every social tick.

**Versu shows how to coordinate groups without scripting them.** Evans and Emily Short's Versu coordinates autonomous agents through **social practices**, shared situations such as a dinner that offer role-specific actions to everyone present. It is written in Praxis, a language based on exclusion logic ([IFWiki](https://www.ifwiki.org/Versu); [Evans & Short](https://www.semanticscholar.org/paper/Versu%E2%80%94A-Simulationist-Storytelling-System-Evans-Short/74c6364ae004ce58e3f15a20c1e6d22198a93e21)). In Living Town, "Family Dinner", "Game Night" or "Market Day" would each be a temporary object that feeds actions into each attendee's utility scorer.

**Talk of the Town turns gossip into story.** In James Ryan's town simulation, characters hold fallible mental models of each other. **Attribute saliences** decide what gets noticed and talked about, and beliefs propagate, get misremembered and are forgotten ([Ryan et al.](https://www.researchgate.net/publication/335746180_Simulating_Character_Knowledge_Phenomena_in_Talk_of_the_Town)). Living Town's `shareKnowledge` already stores `learnedFrom` and `subjectId`, so it is one step from third-party gossip.

**RimWorld, Dwarf Fortress and Crusader Kings get their stories from labelled, timed, stacking modifiers plus thresholds.**

- **RimWorld:** mood is the sum of active "thoughts". Each thought has a duration, a stack limit and a diminishing multiplier. For example, *DeepTalk* gives +15 opinion for 20 days, stacks up to 10 times per pawn, and each repeat counts ×0.88 ([RimWorld Wiki](https://rimworldwiki.com/wiki/Thoughts/Memory_Social)). Mental breaks fire below 35%, 20% and 5% mood, shifted by traits, and a positive "catharsis" thought follows ([RimWorld Wiki](https://rimworldwiki.com/wiki/Mental_break)).
- **Crusader Kings III:** stress runs from 0 to 400, with breaks when it first crosses 100, 200 and 300. Characters mainly gain stress **by acting against their own traits** ([CK3 Dev Diary #31](https://forum.paradoxplaza.com/forum/developer-diary/ck3-dev-diary-31-a-stressful-situation.1399764/page-14)). Opinion modifiers are timed and can decay ([CK3 Wiki](https://ck3.paradoxwikis.com/Patch_1.19)).
- **Dwarf Fortress:** grudges come from large gaps between personality facets (above 60 in one creature, below 40 in the other) ([DF Wiki](http://www.dwarffortresswiki.org/index.php/Personality_facet)).
- **RimWorld's storyteller:** Cassandra alternates calm and busy periods ([RimWorld Wiki](https://rimworldwiki.com/wiki/AI_Storytellers)). Façade's drama manager similarly picks "beats" that fit an authored tension arc ([Mateas & Stern](https://users.soe.ucsc.edu/~michaelm/publications/mateas-aiide2005.pdf)).

What these games share is that every number has a **named cause** that players can retell as a story. With only 7 characters, making causes legible matters more than having many of them.

**Generative Agents' memory works without the LLM.** Park et al. retrieve memories by recency, importance and relevance, each normalised and **weighted equally**. An agent reflects when the summed importance of recent events passes **150** ([Park et al. 2023](https://arxiv.org/pdf/2304.03442)). The reported recency decay is 0.995 per game hour; that value was not independently confirmed here. Without an LLM, each part has a simple substitute:

| Generative Agents | Non-LLM substitute |
|---|---|
| Importance scored by the language model | An authored constant per event type |
| Relevance by embedding similarity | Overlap between memory tags and query tags |
| Reflection written by the language model | Rules, e.g. "X was kind to me 3 times → X is kind to me" |

## Living Town already has a Sims-1-style core whose outputs go nowhere

The codebase at 0.5.1 is a clean "needs + utility + commitment" engine. The server ticks once a second. `scorePlaces` sums the following for each of **six places** ([lib/mind.js:235-301](/home/user/claude/living-town/lib/mind.js)):

- squared need deficits weighted by traits
- obligation bonuses
- interest-tag matches
- pull toward the two strongest bonds present
- a crowd penalty for introverts
- a quiet bonus when stressed
- a boredom penalty
- distance and noise

The winner's top reason becomes the visible "Why" string, and the resident commits for `25 + 50·C + rand·25` minutes, where C is conscientiousness ([lib/mind.js:316-337](/home/user/claude/living-town/lib/mind.js)). Conversations are pairwise rolls every 15 s that pick one of four kinds: friction, interest, news or smalltalk ([lib/mind.js:384-424](/home/user/claude/living-town/lib/mind.js)). Life events are separate random draws that nudge mood, goal progress and career progress ([lib/life.js:523-636](/home/user/claude/living-town/lib/life.js)).

The central finding is that **`lib/mind.js` never reads goals, career, knowledge, memories or mood valence**. It uses only stress. Memories are written but read only by the client ([lib/mind.js:451-452](/home/user/claude/living-town/lib/mind.js)).

A one-day in-process simulation shows the symptoms. There were **132 conversations, 111 of them "news"** (about 84%), so talk reads as residents reciting biographies to each other. Relationships saturated: Olive→Hazel reached 100 and Olive→Sean 95.5 in a day, while pairs who never met stayed at 20. All seven moods ended "content" or "happy". The simulation teleports residents, which overstates how often they meet, but the saturation follows directly from the code: nothing decays relationships, and 100 is the cap.

| Sims 3 system | Living Town today | Gap |
|---|---|---|
| Smart objects and advertisements | 6 places with flat need rates; activities are text only ([shared/world.js:17-48](/home/user/claude/living-town/shared/world.js)) | Large |
| Moodlets | Valence and stress scalars plus one overwritten `reason` ([lib/life.js:459-488](/home/user/claude/living-town/lib/life.js)) | Large, cheap to fix |
| Mood affects choice | Stress only; valence unused | Small, cheap |
| Named traits | Big Five numbers plus interest tags; likes, dislikes and values unused ([lib/mind.js:21-106](/home/user/claude/living-town/lib/mind.js)) | Medium |
| Wishes and fears | One invisible goal advanced by random events; no fears | Large |
| Relationships | One number per directed pair, no decay, no levels ([lib/mind.js:428-429](/home/user/claude/living-town/lib/mind.js)) | Large, needs migration |
| Accept/reject socials | None; friction is the only negative outcome | Medium |
| Memories and gossip | Write-only memories; facts shared only about the speaker ([lib/life.js:639-651](/home/user/claude/living-town/lib/life.js)) | Medium |
| Group activities | None; conversations strictly pairwise ([lib/mind.js:464-481](/home/user/claude/living-town/lib/mind.js)) | Medium |
| Story progression | Offline catch-up skips conversations and relationships ([server.js:274-308](/home/user/claude/living-town/server.js)) | Small |
| Player commands | Tap-to-walk only; free will fully suspended while controlled ([server.js:193-196](/home/user/claude/living-town/server.js)) | Medium |

Three technical facts shape the roadmap.

First, **CPU is effectively free**. The AI costs about 13 µs per tick for all seven residents, against a 1,000 ms tick budget.

Second, **bandwidth is the real budget**. Every tick sends about **2.4 KB per phone**, and each `lifeRevision` bump resends a summary of about 3 KB ([server.js:326-345](/home/user/claude/living-town/server.js)). New per-resident fields should therefore be sent as compact codes and only when they change.

Third, **most new state can be added without a schema bump**. The server already normalises data on load, but there is a trap: `ensureMind` and `ensureResidentLife` rebuild `mind`, `career` and `mood` from fixed field lists, so any new sub-field placed there is silently dropped on the next load ([lib/mind.js:172-185](/home/user/claude/living-town/lib/mind.js); [lib/life.js:392-428](/home/user/claude/living-town/lib/life.js)). New fields belong at the resident's top level. Turning `relationships[id]` from a number into an object is the one change that needs a real **v4 migration**, because about ten call sites treat it as a number.

## A prioritised roadmap: loops first, social depth second, objects third

Effort figures are my rough estimates in focused developer-days for one person who knows the codebase. Each includes server logic, a minimal iPhone UI, tests and a content pass. The ordering follows three principles:

- ship the loops that make existing state matter before adding new state
- batch every relationship-schema change into one v4 release
- make each feature visible on a phone, because an invisible Sims 3 feature is worth nothing to a 7-year-old

| # | Feature | What it is concretely | Where it hooks in | Effort |
|---|---|---|---|---|
| 0 | Safety and payload groundwork | Content-lint test over all text pools; life-stage check on friction; enforce the unused `shareable` flag; split `lifeRevision` into facet revisions; send new fields as short codes | [test/](/home/user/claude/living-town/test/life.test.js), [lib/life.js:330](/home/user/claude/living-town/lib/life.js), [server.js:326-366](/home/user/claude/living-town/server.js) | 2–3 d |
| 1 | **Moodlets** | `resident.moodlets[] = {id, value, stress, until, stackKey, reason}`; mood target = baseline + Σ moodlets (diminishing stacks); mood eases toward target; low needs emit "Hungry"/"Sleepy" moodlets; emoji chips with reasons in the sheet | Replace direct mood edits in `converse`, `runAutonomousExperience`, `checkBirthdays`, `tickMood` | 3–4 d |
| 2 | **Mood-sensitive choice** | Read valence in `scorePlaces`; pick by softmax over the top options with temperature rising as mood falls (Evans); keep an emergency bucket for needs < 15 | [lib/mind.js:293-301](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:316-337](/home/user/claude/living-town/lib/mind.js) | 1–2 d |
| 3 | **Named traits** | 3–4 named traits per resident (e.g. Animal Lover, Bookworm, Neat, Chatterbox, Night Owl, Homebody), each a data overlay of gates, commodity multipliers, moodlet hooks and wish weights; seeded from Big Five and profile likes | Static tables beside [lib/mind.js:22-106](/home/user/claude/living-town/lib/mind.js); read in `scorePlaces`, `decayRates`, `converse` | 3 d |
| 4 | **Wishes and playful fears** | 3 wish slots from trait, interest, relationship and memory templates ("Visit the park with Hazel", "Learn a new song"); bonus term in `scorePlaces`; fulfilment gives a moodlet and "happy points"; players can "promise" one; 1 playful fear each ("the market goose") | New top-level `wishes[]`; score after [lib/mind.js:266](/home/user/claude/living-town/lib/mind.js); fulfil in `onArrive`/`converse` | 4–5 d |
| 5 | **Memories that matter** | Add `importance`, `valence` and `tags`; a small protected "notable" list; retrieval by recency + importance + tag overlap; memories bias `conversationChance`, friction and topics; rule-based reflections ("Olive is kind to me") | [lib/mind.js:372-393](/home/user/claude/living-town/lib/mind.js), [lib/mind.js:451](/home/user/claude/living-town/lib/mind.js) | 3 d |
| 6 | **Multi-axis relationships (v4)** | `{friendship, familiarity, respect, modifiers[], labels[]}`; Sims 2-style fast "today" vs slow "overall" split; timed labelled opinion modifiers with stacking; trait compatibility; hysteresis on labels; drift toward a mildly positive baseline; negative floor about −40; **no romance axis** | Migration in `migrate()` ([server.js:97-120](/home/user/claude/living-town/server.js)) plus the ~10 numeric call sites | 4–5 d |
| 7 | **CiF-lite social exchanges** | 25–40 authored exchanges (compliment, share snack, tell joke, ask for help, teach, play tag, apologise, make up) with intents, volition rules, accept/decline rules and effects; a polite "not now" decline; demotes "news" to one option among many | Replaces the kind switch in `converse` ([lib/mind.js:384-454](/home/user/claude/living-town/lib/mind.js)) | 6–8 d |
| 8 | **Gossip and rumour correction** | Re-tell third-party facts from `knowledge`, weighted by salience; confidence falls per hop; the subject can correct a wrong rumour; kid setbacks never shareable | Extend `shareKnowledge` ([lib/life.js:639-651](/home/user/claude/living-town/lib/life.js)) | 2–3 d |
| 9 | **People and memory views** | Replace "Closest" with a sorted relationship list showing axis bars and named labels; "Remembers" tab with "heard from X" provenance | [public/client.js:484](/home/user/claude/living-town/public/client.js), detail tabs | 2–3 d |
| 10 | **Gatherings (Versu-style practices)** | `state.gatherings[]` for Family Dinner, Game Night, Market Day and Picnic; invitations; role-based actions offered to attendees; lets group scenes break the pairwise limit | Planner beside `socialTick` ([server.js:254-257](/home/user/claude/living-town/server.js)); bonus in `scorePlaces` | 5–7 d |
| 11 | **Smart objects and advertisements** | 4–8 objects per place (swings, pond, bakery counter, workbench, bench, bookshelf) with Minimum + trait-Delta + distance attenuation per need; activities gain mechanical effects; place score = best advertisement | New `objects` table in [shared/world.js](/home/user/claude/living-town/shared/world.js); `pickActivity`; need restore in [server.js:231-238](/home/user/claude/living-town/server.js) | 6–10 d (art-dependent) |
| 12 | **Skills and legible plans** | `skills{}` grown by object use (baking, drawing, fixing, music); HTN "recipes" for multi-step wishes shown as plan text ("Zara is gathering berries to bake a pie") | `updateResident`; small HTN module | 4–5 d |
| 13 | **Lifetime dream and career performance** | One long-term dream per teen or adult; career progress driven by attending obligations and by mood, not only by dice | [lib/life.js:564-621](/home/user/claude/living-town/lib/life.js) | 3 d |
| 14 | **Kind storyteller** | Director with an "excitement" curve alternating calm and busy spells; positive and low-stakes events (festival, lost puppy, bake-off, fountain breaks); cooldowns; spotlight rotation so all 7 residents get stories | New module ticked hourly | 4–5 d |
| 15 | **Grumpy spells** | Threshold event when mood stays low: sulk, need a hug or cake, then a "feeling better" catharsis moodlet; a softened version of RimWorld and CK3 breaks | Mood module | 2 d |
| 16 | **Player suggestions** | `{type:"suggest"}` message plus a short `queue[]`; tap a resident to get 3–4 big buttons (chat, play, share news, invite); free will continues around suggestions | [server.js:493-510](/home/user/claude/living-town/server.js), `decide` | 3–4 d |
| 17 | **Offline story progression and digest** | Coarse offline social pass (relationship drift, gossip, wish fulfilment); a "stories worth seeing" digest instead of an 8-item raw feed | [server.js:274-308](/home/user/claude/living-town/server.js), return card | 3–4 d |

### Phase 1 (items 0–5, about 16–20 days) converts write-only state into behaviour

This phase alone moves Living Town from "Sims 1 with places" to recognisably Sims 3.

Moodlets come first because every later feature produces them: wishes, gossip, exchanges and gatherings all emit moodlets as their visible outcome. They also finally surface `mood.reason`, which the server already sends but the client never renders ([public/client.js:464](/home/user/claude/living-town/public/client.js)). Moodlets should reach the phone as short codes such as `["hug","snack","sleepy"]` rather than text, so the 2.4 KB/s tick grows by tens of bytes, not kilobytes.

Mood-sensitive choice is a one-day change with a large effect. Named traits are what the 7-year-old will talk about. Traits should be few and legible, with 3–4 per resident, and each should show up at least once a day in behaviour a child can see.

Wishes are the most important player-facing addition. They make intentions visible, they let Olive and Hazel help their own residents, and they give the existing goal system a short-term companion. Put them in a new top-level array rather than stretching the single-goal list, which `ensureResidentLife` limits to one active goal.

### Phase 2 (items 6–9, about 14–19 days) fixes relationships and conversation

The relationship migration is the only risky step, so it should bundle every schema change into one v4 release. An older server refuses a v4 save ([lib/persistence.js:100](/home/user/claude/living-town/lib/persistence.js)), so the v3 hourly snapshots are the rollback path. Add a legacy-save test alongside the existing one ([test/integration.test.js:29](/home/user/claude/living-town/test/integration.test.js)).

The Sims 2 split between a fast score and a slow score, combined with RimWorld-style timed modifiers, stops the one-day saturation. It also gives every change a reason a child can read ("+10 shared cookies"). CiF-lite exchanges are the biggest content job, but they bring the biggest change in how conversation reads. Rejection must stay gentle: "maybe later!" rather than a snub, followed by a mild moodlet and a built-in path to making up.

### Phase 3 (items 10–13, about 18–25 days) adds things to do

Smart objects rank below the loops because Living Town's place scorer already produces sensible movement. Objects add variety and give activities mechanical effects, but most of the "alive" feeling in Sims 3 comes from the feedback systems. Gatherings deserve to come before objects. Group scenes ("everyone's at Game Night") are the most visible missing behaviour on a map of seven people, and they break the strictly pairwise conversation model.

### Phase 4 (items 14–17, about 12–15 days) lets the town tell its own stories

The storyteller should frame "tension" as excitement for this audience, alternating small problems with celebrations. Spotlight rotation matters when only 7 residents exist and three of them are real family members; nobody's resident should become the town's permanent headline. Player suggestions come last because Sims 3 itself leaves most life to free will, and because a queue adds client UI and protocol work. Queued suggestions must fit the 1,024-byte inbound WebSocket message limit and should not be persisted, just like controller state today.

### What to deliberately leave out

Three things should stay out:

- **Bladder and hygiene needs** add chores, not stories.
- **Money** creates pressure and "poor" labels for a 7-year-old, for little gain in a game you mostly watch.
- **Romance** of any kind should not exist as an axis at all. Olive (15) and Nova (19) are both on screen, and "no romance for minors" is easiest to guarantee when the code has nothing to turn off.

Open-ended GOAP search is not worth its debugging cost when authored HTN recipes are more readable. Death, mental-break violence and CK3-style health penalties do not belong in this game; the gentle "grumpy spell" keeps the storytelling value without the harm.

## Kid safety works by construction, not by filtering

Living Town's current safety model is curated content plus review gates. "Nobody dies, and there is no romance for minors." "Children only receive age-appropriate events and child-safe disagreements" ([LIFE_ENGINE.md:75-77](/home/user/claude/living-town/LIFE_ENGINE.md)). A mandatory review applies "before releasing any change that affects what Olive sees or reads" ([PROJECT_LOG.md:39-43](/home/user/claude/living-town/PROJECT_LOG.md)).

Every item in the roadmap changes what the daughters read, so each needs that review even without an LLM. The practical approach is to make unsafe states impossible to express. That means authored text pools only, no negative relationship label stronger than "not getting along", a floor on negative opinion, built-in reconciliation exchanges, and positive drift so nobody stays at odds for good.

Two specific risks deserve tests before gossip ships. First, the history facts are already flagged `shareable: true`, but nothing checks the flag ([lib/life.js:330](/home/user/claude/living-town/lib/life.js)). Without that check, third-party gossip would spread a real 7-year-old's setbacks around town. Second, friction is not age-aware ([lib/mind.js:159-166](/home/user/claude/living-town/lib/mind.js)). It is safe today only because the topic list is universally mild, and any new rejection or fear system must keep that property explicitly. A content-lint test over all text pools, alongside the existing no-work-before-14 test ([test/life.test.js:24](/home/user/claude/living-town/test/life.test.js)), turns these rules from convention into enforcement.

## Conclusion

The research changes the question from "how do we add Sims 3's systems" to "how do we make Living Town's existing state matter". Sims 3's apparent intelligence comes less from clever decision-making than from **legible causality**. Every mood has a named moodlet, every trait shows up in behaviour, every relationship change has a reason, and wishes announce what a Sim is about to do. RimWorld and CK3 reach the same result with the same trick. Living Town already computes most of the raw material and then discards it. The first 15–20 days of work cost almost nothing in CPU and mostly add readability, and that readability is exactly what a 7-year-old watching on an iPhone experiences as "alive".

Doing this now also lays the ground for LLM dialogue later. Structured moodlets, wishes, tagged memories and relationship modifiers are the context a future dialogue model would need, and they can go through the review gate before any generated text exists. One uncertainty remains: the exact Sims 2 and 3 curves, decay rates and random-choice rules were not recoverable from public sources. Tuning should therefore come from watching the family play, not from copying numbers.
