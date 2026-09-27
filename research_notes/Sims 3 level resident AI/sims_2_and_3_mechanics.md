# Sims 2 and Sims 3 AI Mechanics (motives, advertisements, autonomy, traits, moodlets, wishes, relationships, story progression)

> **Research-environment caveat (important for the report writer):** In this session, WebFetch was blocked by the network egress proxy for every domain tried (modthesims.info, sims.fandom.com, thesimswiki.com, carls-sims-3-guide.com, donhopkins.com, wikipedia.org, gmtk.substack.com, yo252yo.com). All "Cited Findings" below therefore come from **search-engine result summaries** of the linked pages, not from reading the full pages. Treat the numbers as plausible but not double-checked against the full page. Anything drawn from my own background knowledge and not confirmed by a search result is kept **only** under "Inferences" and labelled **[background, unverified]**. Primary sources that exist but could not be read are listed under Gaps so the writer can point to them.

---

## 1. Motives/needs: which exist, how they decay, how motive level maps to desire

### Takeaway
Sims 2 has 8 motives (Hunger, Comfort, Hygiene, Bladder, Energy, Fun, Social, Environment). Sims 3 cut this to 6 (Hunger, Bladder, Energy, Social, Hygiene, Fun) and turned comfort/environment into moodlets. Every motive decays over time, and some activities speed that up. Autonomy weighs an object's advertised gain by a multiplier that depends on the Sim's current motive level. That multiplier is the non-linear "motive curve" idea. I could not find exact decay rates or curve formulas in any source I could reach.

### Cited Findings
- Sims 2 motive system: 8 core needs (Hunger, Comfort, Hygiene, Bladder, Fun, Social, Energy, Environment). Each decays at different rates depending on the activity, life stage and outside factors — [Grokipedia: The Sims 2](https://grokipedia.com/page/The_Sims_2) (aggregator; matches [StrategyWiki: The Sims 2/Needs](https://strategywiki.org/wiki/The_Sims_2/Needs)).
- "Each Need will constantly degrade over time, no matter what actions your Sim performs, although some activities will hasten the decay of specific motives." — [StrategyWiki: The Sims 2/Needs](https://strategywiki.org/wiki/The_Sims_2/Needs)
- Sims 2 aspiration benefit "Slower Motive Decay" cuts decay of the affected motives by 12% per purchase, and purchases stack. This shows decay is a per-motive rate multiplier that game systems can change — [Sims Wiki: Aspiration benefit](https://sims.fandom.com/wiki/Aspiration_benefit)
- Sims 3 motives page lists Hunger, Bladder, Social, Fun, Hygiene and Energy as the needs — [Carl's Sims 3 Guide: Motives](https://www.carls-sims-3-guide.com/info/motives.php) (title of page)
- Wright based the motive system on Maslow's hierarchy of needs: primal needs are satisfied before higher ones, e.g. "a Sim won't enjoy a movie if she's hungry" — [Psychology Today, "The Sims: Suburban Rhapsody" (2003)](https://www.psychologytoday.com/us/articles/200311/the-sims-suburban-rhapsody)
- Objects advertise a score. The Sim "weigh[s] it based on its current needs by applying a multiplier to the promised score, based on the Sim's current motive levels". Objects advertise verbs to the character AI, and "the interaction of this scheme with the contribution curves determines how a person's motives factor into the decision" — [Mark Brown/GMTK, "The Genius AI Behind The Sims"](https://gmtk.substack.com/p/the-genius-ai-behind-the-sims); [SimsTek wiki: SimAntics](https://simstek.fandom.com/wiki/SimAntics)
- Will Wright's GDC 2003 talk "Dynamics for Designers" covers emergent systems design. A recording is archived — [Internet Archive](https://archive.org/details/2003_GDC_-_Friday_3pm-4pm_03-07-2003_-_Dynamics_for_Designers_-_Will_Wright); [Game Developer](https://www.gamedeveloper.com/design/video-will-wright-s-dynamics-for-designers-from-gdc-2003)

### Inferences
- [background, unverified] In The Sims 1 and 2, motives run from -100 to +100. The commonly described curve design makes the weight on a motive rise steeply as it approaches the bottom. Hunger at -80 might weigh several times more than hunger at +20. Near-full motives get close to zero weight, so a full Sim does not keep eating. Some descriptions also give the Sim an overall "mood/happiness" equal to a weighted sum of the curved motives. Autonomy then picks the action that raises this sum the most. The curve for Hunger/Bladder/Energy is steeper, and the one for Fun/Social is gentler. This is how the Maslow ordering is produced.
- [background, unverified] Simple re-implementation: `desire_i = curve_i(motive_i)`, with curve_i a convex piecewise-linear or quadratic function such as `w = ((100 - m)/200)^2 * k_i`. Then `score(action) = Σ_i desire_i * advertised_delta_i(action)`. This matches the "multiplier on the advertised score" description above.
- In Sims 3, comfort and environment became moodlets (e.g. comfortable seating, room decor) rather than decaying motives. That fits the 6-motive list, but the direct cause was not confirmed in these results.

### Gaps
- No per-hour decay rates for any Sims 2 or Sims 3 motive were in the search summaries. The StrategyWiki Needs page and the MoreAwesomeThanYou forum thread ["Motive Decay rates"](http://www.moreawesomethanyou.com/smf/index.php?topic=19627.0) may have them but could not be fetched.
- I could not fetch the exact shape of the motive/attenuation curves from Don Hopkins' writings (e.g. donhopkins.com design docs such as [TechnicalEmail.pdf](https://donhopkins.com/home/TheSimsDesignDocuments/TechnicalEmail.pdf)) or from Wright's talk.

---

## 2. Smart objects and advertisements: scoring, picking, interaction queues

### Takeaway
Objects hold the behaviour ("smart objects"). Each interaction advertises how much it would satisfy each motive, and the Sim scores every advertised interaction on the lot against its own current needs. In Sims 1 and 2 tuning (the TTAB resource), each advertisement has a floor value, a personality-scaled extra amount, and a distance "attenuation" value. In Sims 3 the same idea lives in ITUN XML tuning, where each interaction lists the commodities it advertises plus trait requirements and bans.

### Cited Findings
- "Whenever the Sim decides what to do, it quickly makes a list of every object in the house and what they can offer." Maxis calls these "advertisements", and the Sim weights them by its current needs — [GMTK](https://gmtk.substack.com/p/the-genius-ai-behind-the-sims)
- TTAB (Sims 1/2 interaction table) advertisement fields, from Mod The Sims:
  - **Minimum**: the base level advertised to all Sims for that motive.
  - **Delta**: extra amount advertised to Sims with a particular attribute, on a sliding scale by how much of that attribute they have.
  - **Type**: which Sim attribute (personality) controls the delta.
  - **Attenuation**: how close the Sim must be to the object to be attracted; higher values mean the Sim must be closer.
  - Autonomy flag values are noted as "32 for auto and 64 for non-auto".
  - Sources: [Mod The Sims – TTAB wiki](https://modthesims.info/wiki.php?title=TTAB); [MTS: changing fun advertisement](https://modthesims.info/showthread.php?t=622020); [MTS: fun motive and room value](https://modthesims.info/showthread.php?p=2088808)
- Sims 2 scripting language: SimAntics, edited in the in-engine tool "Edith" ("Edit Hierarchies/Edit House"). SimAntics is multi-threaded with one thread per object. It uses yielding primitives that wait until routing, animation or sleeping finishes, and scripts can be changed while the game runs — [Jake Simpson GDC 2005, "Scripting and Sims2: Coding the Psychology of Little People" (Internet Archive)](https://archive.org/details/GDC2005Simpson); [GDC Vault](https://www.gdcvault.com/play/1020311/Scripting-and-Sims2-Coding-the); [SimsTek: SimAntics](https://simstek.fandom.com/wiki/SimAntics)
- Sims 3 ITUN ("Interaction TUNing") XML: every interaction that can be done autonomously must have an ITUN. It sets allowed ages/species, whether the action can be autonomous, restrictions, whether traits apply, which lots it works on, and "advertising and fulfillment of sim needs". The "advertised" field sets how attractive the interaction is: higher means more attractive. An ITUN can require a trait or ban a trait — [Nona Mena, ITUN Modding Discussion (Simlogical PDF)](https://simlogical.com/ContentUploadsRemote/uploads/1588/ITUN_Modding_Discussion_Explanation.pdf); [Nona's Sims: Tuning mods and Commodity Kinds](https://nonasims.wordpress.com/2012/04/25/tutorial-tuning-mods-and-commodity-kinds/)
- Sims 3 uses "CommodityKinds", which cover both basic motives and trait-specific commodities, as the currencies interactions advertise — [MTS: Store Skills GUID and CommodityKinds](https://modthesims.info/showthread.php?t=654540); [Nona's Sims](https://nonasims.wordpress.com/2012/04/25/tutorial-tuning-mods-and-commodity-kinds/)

### Inferences
- [background, unverified] Sims 1/2 selection is usually described like this. Compute scores for all available (object, interaction) pairs, reduce each by distance, keep the top few (often said to be around 3–4), and pick one of those at random, weighted or uniform. This keeps Sims from looking robotic. Ken Forbus' Northwestern course notes on The Sims describe this. I could not reach them.
- [background, unverified] Sims 1/2 interaction queue: the player queues actions, shown as icons top-left, up to about 8. Autonomous actions go into the same queue. A queued player command is normally not overridden by free will. Exception: critical motives (e.g. bladder failure, starvation) and some urgent events (fire, death) can push in or cancel actions.
- Advertisement score for re-implementation (Sims 2 style): `adv_m = Minimum_m + Delta_m * (personality[Type_m]/10)`, then `score = Σ_m curve_m(motive_m) * adv_m`, then `score *= attenuation(distance, Attenuation)`. The component names come from TTAB. How they combine is my inference.

### Gaps
- Exact attenuation function, including whether it is linear or inverse distance.
- Exact "top N" count and the random-weighting rule in Sims 2.
- Queue length limits and how player/autonomous actions are prioritised, taken from a primary source.

---

## 3. Autonomy: levels, re-evaluation frequency, free will vs player commands

### Takeaway
Sims 3 offers free-will settings of High, Low and Off. The action choice uses a Boltzmann (softmax) distribution whose "temperature" depends on the Sim's mood. A happy Sim picks near-optimally. An unhappy Sim acts more randomly and may choose low-utility actions. Sims 2 free will is a game option. Both games leave some life actions (paying bills, finding a job) to the player.

### Cited Findings
- Sims 3 (Richard Evans, AI lead): action selection uses "a modified version of the Boltzmann distribution… using a temperature that is low when the Sim is happy, and high when the Sim is doing badly to make it more likely that an action with a low utility is chosen" — [Wikipedia: Utility system](https://en.wikipedia.org/wiki/Utility_system) (secondary; primary is Evans' GDC talk)
- Evans' personality model extended numeric needs and satisfaction values to include preferences, described as "a sort of 3-axis model", so different Sims react differently in the same situation — [Wikipedia: Utility system](https://en.wikipedia.org/wiki/Utility_system)
- Sims 3 free will settings: high, low and off. Free will picks interactions based on the Sim's traits, favourites, and compatibility with other Sims — [Sims Wiki: Free will](https://sims.fandom.com/wiki/Free_will)
- Sims are not fully autonomous. Some actions need player commands, e.g. paying bills, finding a job, exercising, conceiving children — [Wikipedia: The Sims (video game)](https://en.wikipedia.org/wiki/The_Sims_(video_game)) (summary covers the series; mainly describes The Sims 1)

### Inferences
- Boltzmann choice for re-implementation: `P(a) = exp(U(a)/T) / Σ exp(U(b)/T)`, with `T = f(mood)` decreasing as mood rises. The exact function T(mood) and what "modified" means were not found.
- [background, unverified] Autonomy runs when the Sim's queue is empty or its current autonomous action ends, and after an idle timeout. User-directed actions are not interrupted by autonomy except in motive emergencies. I found no numeric re-evaluation interval in a source.

### Gaps
- Re-evaluation frequency (sim-minutes between autonomy passes) for either game.
- What Sims 3 "Low" free will restricts (for example, whether it limits autonomy to motive-driven actions).
- The GDC Vault page and the YouTube recording of Evans' talk ([GDC Vault](https://www.gdcvault.com/play/1012450/Modeling-Individual-Personalities-in-The), [YouTube](https://www.youtube.com/watch?v=DVMs5_B611E)) could not be viewed.

---

## 4. Sims 3 traits: how they change autonomy, socials and moodlets

### Takeaway
There are 60+ traits in total. The base game groups them roughly as Mental, Physical, Social and Lifestyle. Traits work through data. ITUN tuning can require or ban a trait for an interaction. Traits add their own "commodities" that autonomy weighs, as if the trait were an extra need. Trait-specific moodlets change mood. Evans' fully data-driven social system had "hundreds of interactions and thousands of production-rules" written by designers.

### Cited Findings
- More than 60 traits can be chosen in CAS — [Carl's Sims 3 Guide: Traits](https://www.carls-sims-3-guide.com/traits/); [StrategyWiki: The Sims 3/Traits](https://strategywiki.org/wiki/The_Sims_3/Traits)
- Base-game trait examples by group. Social: Charismatic, Commitment Issues, Dislikes Children, Easily Impressed, Flirty, Friendly, Good Sense of Humor, Great Kisser, Grumpy, Hopeless Romantic, Inappropriate, Loner, Loser, Mean Spirited, Mooch, No Sense of Humor, Party Animal, Schmoozer, Snob, Unflirty. Lifestyle: Ambitious, Angler, Childish, Daredevil, Evil, Family-Oriented, Frugal, Good, Hates the Outdoors, Hot-Headed, Kleptomaniac, Loves the Outdoors, Over-Emotional, Perfectionist, Technophobe, Vegetarian, Workaholic. Physical includes Neat, Never Nude, Slob, Unlucky — [Sims Wiki: base-game traits category](https://sims.fandom.com/wiki/Category:Traits_from_The_Sims_3_(base_game)); [Sims 3 Wiki Trait List](https://thesims3.fandom.com/wiki/Sims_3_Trait_List)
- Trait effect examples (in-game descriptions):
  - **Neat**: cleans regardless of mood, gets upset by filth, never leaves a mess.
  - **Slob**: no negative effects from dirty surroundings, can eat spoiled food.
  - **Loner**: enjoys solitude, will never approach anyone who isn't a close friend, gets nervous in large groups.
  - **Kleptomaniac**: autonomously "permanently borrows" items from work, school or neighbours.
  - **Hot-Headed**: quick to anger.
  - Source: [Carl's Sims 3 Guide: Traits](https://www.carls-sims-3-guide.com/traits/); [Thonky Sims 3 Traits](https://www.thonky.com/the-sims-3/traits)
- **Over-Emotional**: +25% to all moodlet strength, both positive and negative — [Mod The Sims moodlet search summary](https://modthesims.info/wiki.php?title=Sims_3%3AMoodlets)
- **Ambitious**: +15% lifetime happiness from completing the lifetime wish (rounded to multiples of 500) — [Sims Wiki: Lifetime wish](https://sims.fandom.com/wiki/Lifetime_wish)
- ITUN can require or ban traits for an interaction, and can flag whether traits are considered in autonomy — [Nona Mena ITUN PDF](https://simlogical.com/ContentUploadsRemote/uploads/1588/ITUN_Modding_Discussion_Explanation.pdf)
- Evans (GDC 2010): the goal was that each Sim's individual personality should be "clearly manifest in autonomous behavior". "Because the social system was fully data-driven, non-technical producers and designers were able to specify hundreds of interactions, and thousands of production-rules." — [GDC Vault abstract](https://www.gdcvault.com/play/1012450/Modeling-Individual-Personalities-in-The)
- Community comparison video on how traits drive autonomy in Sims 3 vs Sims 4 — [MTS thread](https://modthesims.info/showthread.php?t=633546)

### Inferences
- [background, unverified] Trait counts by age in Sims 3: Young Adult/Adult/Elder have 5 traits, Teen 4, Child 3, Toddler 2, Baby 2. Younger Sims gain traits on age-up, chosen by the player or influenced by upbringing. Hidden traits (e.g. from expansions) exist — see [Carl's traits page](https://www.carls-sims-3-guide.com/traits/) ("Traits List and Hidden Traits").
- [background, unverified] Trait mechanisms fall into four types:
  1. **Unlock**: trait-only socials (e.g. Evil "Evil Laugh"-style actions, Flirty extra flirts, Kleptomaniac "Swipe").
  2. **Forbid/penalise**: Loner avoids group activities; Unflirty lowers romance acceptance.
  3. **Autonomy bias**: trait commodities make matching actions score higher, e.g. Couch Potato watching TV, Bookworm reading.
  4. **Moodlet hooks**: trait-specific moodlets, e.g. Neat getting a negative moodlet in a dirty room, Loner getting a positive one when alone.
- This works as a 4-part "trait = tuning overlay" model an engineer can copy: (a) a gating whitelist/blacklist on interactions, (b) score multipliers per commodity, (c) moodlet triggers, (d) wish-generation weights.

### Gaps
- The exact trait count by version (the base-game figure is usually quoted as 63; "60+" is confirmed).
- Numeric autonomy multipliers applied by traits, e.g. how much Couch Potato raises TV score.

---

## 5. Sims 3 moodlets: structure, mood computation, mood gating

### Takeaway
Moodlets (called "buffs" internally) are timed modifiers with a positive or negative mood value. The Sim's mood is roughly the sum of active moodlet values. The mood meter tops out at +150. Negative stages start below -10 and -50. Mood feeds into lifetime happiness accrual (starting at +50, fastest at +140), work performance, social acceptance and willingness to build skills. Per the Boltzmann note in Q3, it also changes how random autonomy is.

### Cited Findings
- Positive moodlets raise mood, negative ones lower it, and they come from events and conditions — [MTS: Sims_3:Moodlets](https://modthesims.info/wiki.php?title=Sims_3%3AMoodlets); [Sims Wiki: Moodlet](https://sims.fandom.com/wiki/Moodlet)
- Mood meter maximum shown: +150. Two negative stages: the first below -10, the second below -50 — [Sims Wiki: Mood](https://sims.fandom.com/wiki/Mood)
- Good mood means better career performance and more positive reactions to socials. Bad mood means Sims may refuse to build skills, do poorly at work, or react badly to other Sims — [Sims Wiki: Mood](https://sims.fandom.com/wiki/Mood)
- Lifetime happiness accrues passively every in-game minute once net moodlets reach at least +50, fastest at +140 or more — [Sims Wiki: Lifetime happiness](https://sims.fandom.com/wiki/Lifetime_happiness)
- Over-Emotional scales all moodlets by 1.25 — [MTS moodlets](https://modthesims.info/wiki.php?title=Sims_3%3AMoodlets)
- Modders create custom moodlets (buff XML plus script) tied to custom traits — [MTS: Custom Moodlets](https://db.modthesims.info/showthread.php?t=387166)

### Inferences
- `mood = clamp(Σ moodlet.value * trait_multiplier, min, +150)`. Each moodlet has `{id, value, duration (sim-minutes, or indefinite while its condition holds), stacking rule, origin/reason text, visible flag}`. Duration and stacking fields are [background, unverified]. My recollection: most moodlets refresh on re-trigger instead of stacking, and some have escalating tiers, e.g. Hungry → Starving, Tired → Exhausted.
- [background, unverified] Low motives produce negative moodlets (Hungry, Tired, Smelly, etc.), so motives affect mood only through moodlets. This is the key Sims 3 structural change compared with Sims 2, where mood was a weighted sum of motives.

### Gaps
- Moodlet XML field names and typical values/durations, e.g. "Comfy +10 for 4 hours". Could not fetch MTS or Carl's moodlet lists.
- The lower bound of the mood meter.

---

## 6. Wishes/wants and fears

### Takeaway
**Sims 2:** Each Sim starts with 4 want slots and 3 fear slots, filled from its aspiration, its personality ("universal" wants/fears) and its current situation. Wants re-roll, and one can be locked. Fulfilling wants adds aspiration points and meeting fears removes them, scaled by difficulty/severity. **Sims 3:** Wishes come from traits and context. The player "promises" up to 4 wishes. Fulfilling them pays lifetime happiness points, and a lifetime wish pays 20,000–65,000.

### Cited Findings
- Sims 2: born with 4 want slots and 3 fear slots. College freshman year adds a 5th want slot, and graduating adds a 6th. Normally 1 lock slot, with a second after junior year of college. Locked items are exempt from re-rolls until fulfilled — [Sims Wiki: Wants and fears](https://sims.fandom.com/wiki/Wants_and_fears); [TheGamer](https://www.thegamer.com/the-sims-2-wants-and-fears-explained-aspiration-rewards-goals-lifetime/)
- Fulfilling a want gives aspiration points and a fear costs them. Harder wants give more, and worse fears cost more — [TheGamer](https://www.thegamer.com/the-sims-2-wants-and-fears-explained-aspiration-rewards-goals-lifetime/)
- "Universal" wants/fears come from personality, not aspiration. Neat Sims fear roaches and public toilets, and Outgoing Sims want parties. One Sim's want can be another's fear — [SimsCommunity: Looking back at Sims 2 Wants and Fears](https://simscommunity.info/2022/08/31/looking-back-at-the-sims-2-wants-and-fears/)
- Sims 3: lifetime happiness points come from fulfilling promised wishes, plus passive gain while in a good mood (see Q5). Lifetime wish reward: 20,000–65,000 points depending on expansion. The lifetime wish is chosen at teen→YA age-up, or earlier when a child/teen excels at a skill. 4 active wish slots — [Sims Wiki: Lifetime happiness](https://sims.fandom.com/wiki/Lifetime_happiness); [Sims Wiki: Lifetime wish](https://sims.fandom.com/wiki/Lifetime_wish)
- Unplayed Sims: story progression (the NRaas mod) tries to match jobs to lifetime wishes — [itlandm LiveJournal on StoryProgression](https://itlandm-sims.livejournal.com/49328.html)

### Inferences
- [background, unverified] Sims 2 aspirations: Romance, Family, Fortune, Knowledge, Popularity, plus Pleasure and Grilled Cheese (added in University), and a secondary aspiration in FreeTime. The aspiration meter runs through Platinum/Gold/Green/Red bands. Staying in red leads to an aspiration failure/breakdown, and platinum brings a mood lock-in. Sims 2 also has lifetime wants.
- [background, unverified] Sims 3 wish generation: a pool of wish templates, each with trigger conditions (e.g. "just met X" produces "Get to know X"; Bookworm produces "Read a book"; a skill level produces "Reach skill level N+1"), trait weights, and an expiry. Offered wishes appear in a separate rolling panel, and the player promotes some to the 4 promise slots.
- Re-implementation: `want_pool = aspiration_table ∪ personality_table ∪ event_triggered(memory/relationships)`. Sample weighted by relevance and fill slots. Reward = difficulty-scaled points into a meter that gates rewards and breakdowns.

### Gaps
- Exact aspiration point values per want, and wish point values in Sims 3.
- Want re-roll timing (e.g. on sleep, or after fulfilment).

---

## 7. Relationships and socials

### Takeaway
**Sims 2** has two scores per directed pair, each from -100 to +100. **Daily** is volatile and drops 2 points daily at 4 pm. **Lifetime** drifts toward Daily by 3 points, three times a day. Relationship states come from thresholds. **Nightlife** added chemistry: 0–3 bolts computed from turn-ons/turn-offs. **Sims 3** shows one relationship bar with named levels. The internal numbers are hidden but still exist.

### Cited Findings
- Sims 2 Daily vs Lifetime: Daily is short-term and volatile, and every day at 4 pm it drops by 2. Lifetime does not decay but "normalizes": three times a day it moves 3 points toward Daily — [StrategyWiki: The Sims 2/Relationships](https://strategywiki.org/wiki/The_Sims_2/Relationships)
- Sims 2 thresholds:
  - Friend: both Sims' Daily ≥ 50.
  - Best Friend: both Lifetime > 50.
  - Crush: Daily > 70.
  - Love: Lifetime > 70.
  - Enemy: one Sim's Daily < -50.
  - Scale is -100 to 100.
  - Source: [StrategyWiki: The Sims 2/Relationships](https://strategywiki.org/wiki/The_Sims_2/Relationships); [Sims Wiki: Relationship](https://sims.fandom.com/wiki/Relationship)
- Sims 2 Nightlife chemistry: up to 3 lightning bolts, or one crossed-out bolt for bad chemistry, shown in the relationship panel. Turn-ons and turn-offs are set in CAS for teens and older and include hair colour, body shape and supernatural states — [StrategyWiki: Nightlife Attraction and Chemistry](https://strategywiki.org/wiki/The_Sims_2:_Nightlife/Attraction_and_Chemistry); [Sims Wiki: Chemistry](https://sims.fandom.com/wiki/Chemistry)
- Sims 3: one relationship bar, no numbers shown. Levels: Stranger → Acquaintance (on first interaction) → Friend → Good Friend → Best Friend. Negative side: Disliked → Enemy. Values are still tracked internally — [Sims Wiki: Friendship](https://sims.fandom.com/wiki/Friendship); [Sims Wiki: Relationship](https://sims.fandom.com/wiki/Relationship); NRaas MasterController thread requesting a numeric display confirms a hidden value ([nraas](https://www.nraas.net/community/mastercontroller-discussion/topic9046))
- Sims 3 social system (Evans): data-driven, with hundreds of interactions and thousands of production rules, allowing "fine-grained personalities" — [GDC Vault abstract](https://www.gdcvault.com/play/1012450/Modeling-Individual-Personalities-in-The)
- Mood affects social acceptance in Sims 3: good mood means more positive responses, bad mood means negative reactions — [Sims Wiki: Mood](https://sims.fandom.com/wiki/Mood)

### Inferences
- [background, unverified] Sims 2 acceptance: the target's accept/reject test for a social depends on its relationship (Daily/Lifetime) with the actor, its own motives/mood, its personality (e.g. Playful for jokes, Outgoing for hugs), chemistry for romance, and whether it is committed elsewhere (jealousy). Failed socials lower Daily.
- [background, unverified] Sims 3 socials also use a **short-term conversation context (STC)**, a mood of the current conversation such as friendly, awkward, amorous or hostile. Each social's availability and acceptance depends on the STC, the long-term relationship level, traits and moodlets. This is the "production rule" system Evans mentions.
- [background, unverified] Sims 3 replaced turn-ons with trait-based compatibility plus "attraction" (added in later packs). Two Sims' trait pairings, e.g. Friendly + Mean-Spirited, change how easily they build relationships.

### Gaps
- The numeric band edges behind Sims 3 relationship levels.
- The Sims 2 chemistry formula (points per matching turn-on, penalties per turn-off).

---

## 8. Story progression (Sims 3 open neighbourhood)

### Takeaway
With story progression on, the base game moves unplayed households along "off-screen". Neighbours move in and out, get promotions, marry, have children, make enemies and die. NRaas/Twallan StoryProgression replaces this with a richer, configurable manager, e.g. matching jobs to lifetime wishes rather than drafting Sims into whatever job is short-staffed.

### Cited Findings
- With story progression on, "uncontrolled Sims' lives progress normally: Neighbors may move away, new ones will move in, get promotions, get married, have children, make enemies, and even die." — [Sims Wiki: Story progression](https://sims.fandom.com/wiki/Story_progression)
- The NRaas StoryProgression mod "plays" unplayed Sims more than the base game. It tries to match jobs to lifetime wants, whereas without it neighbours are "drafted into whichever job needs people at the time" — [itlandm LiveJournal](https://itlandm-sims.livejournal.com/49328.html); [NRaas StoryProgression FAQ](https://www.nraas.net/StoryProgression-FAQ-General)
- NRaas lets players exempt households and can apply story progression to the active household as well — [nraas forum](https://www.nraas.net/community/storyprogression-discussion/topic11819); [MTS](https://modthesims.info/t/589058)

### Inferences
- Engineering pattern: an abstract, low-frequency "life event" simulator for off-lot Sims, e.g. daily ticks that roll events (job assignment, relationship changes, marriage, pregnancy, move-out, death). It does not run full per-object autonomy. Full autonomy runs only for Sims on the active lot or in town. This is the usual level-of-detail AI approach [inference].

### Gaps
- The event probabilities and tick frequency in vanilla or NRaas story progression; NRaas docs could not be fetched.

---

## 9. Memories (Sims 2)

### Takeaway
Sims 2 records major life events as positive or negative memories, each with a strength. Memories can be witnessed, passed on through gossip, and brought up in conversation. Stronger memories come up more often.

### Cited Findings
- Sims get memories for major events such as a first kiss, engagement, marriage, having children and moving house. Memories can be witnessed and passed on to others, who can discuss them. They are positive or negative and each has a strength. More significant memories have more strength and are more likely to be conversation topics — [PleasantSims: Sims 2 base game review](https://pleasantsims.com/sims-2-review-base-game/); [Sims Wiki: Wants and fears](https://sims.fandom.com/wiki/Wants_and_fears)

### Inferences
- [background, unverified] Internally, memories are stored as "tokens" in the Sim's hidden inventory (modder knowledge). Memories also trigger wants and fears, e.g. a death memory can create a want to visit a grave or a fear of another loss, and a new baby can trigger "have another child" wants.
- Engineering pattern: `Memory {event_type, subject_sim, valence, strength, timestamp, witnessed_by}`. Uses: gossip topic selection weighted by strength; want/fear triggers; story log.

### Gaps
- Whether memory strength decays over time, and how exactly memories feed the want generator.

---

## 10. Known weaknesses and critiques

### Takeaway
Criticism across the series: pathing is poor (odd routes, getting stuck at doors and in tight rooms), actions get dropped, behaviour is context-blind (doing push-ups at a wedding), and Sims let critical needs fail (wetting themselves with a toilet nearby). Most of the specific complaints I found are about Sims 4. Some pathing complaints are series-wide.

### Cited Findings
- Sims take convoluted routes, e.g. out a patio door and through several rooms instead of through a nearby arch. They get stuck in walls and small rooms — [MTS: Sims take strange paths](https://modthesims.info/t/488719); [EA Forums: pathfinding stuck](https://answers.ea.com/t5/Game-and-Mod-CC-Issues/sims-pathfinding-stuck/td-p/11052222)
- Sims 3: Sims can't get through doors in apartment buildings. They walk up to the door and the action disappears — [NRaas forum](https://www.nraas.net/community/chatterbox/topic13069)
- Sims 3 NPCs on lots starving and wetting themselves — [NRaas forum](https://www.nraas.net/community/chatterbox/topic10652)
- Sims 4 complaints (for comparison only): illogical autonomous choices (push-ups at a wedding, computer during a date), frequent dropped actions, peeing themselves with toilets available — [Steam discussion](https://steamcommunity.com/app/1222670/discussions/0/3172198151262339776/); [EA Forums](https://answers.ea.com/t5/Technical-Issues-PC/Sims-peeing-themselves-instead-of-using-toilet/td-p/6889033)
- Some key life actions can't be done autonomously (bills, job-seeking, conception) — [Wikipedia: The Sims](https://en.wikipedia.org/wiki/The_Sims_(video_game))

### Inferences
- Many failures follow from the architecture. Local greedy utility with distance attenuation can undervalue a far-but-necessary object. Randomly picking among the top-N can occasionally choose a bad option. Utility scoring has no context/social-norm layer (wedding, date), and Sims 3's production rules only partly fix that. A path that fails silently drops the action instead of re-planning. This is inference, not a documented developer statement.

### Gaps
- Developer post-mortems that admit specific Sims 2/3 AI flaws were not found in search.

---

## Key primary sources (not readable in this session, but should be cited in the final report)
- Richard Evans, "Modeling Individual Personalities in The Sims 3", GDC 2010 — [GDC Vault](https://www.gdcvault.com/play/1012450/Modeling-Individual-Personalities-in-The) / [YouTube](https://www.youtube.com/watch?v=DVMs5_B611E)
- Jake Simpson, "Scripting and Sims2: Coding the Psychology of Little People", GDC 2005 — [Internet Archive](https://archive.org/details/GDC2005Simpson); slides "Making The Sims the Sims" — [SlidePlayer](https://slideplayer.com/slide/5885720/)
- Will Wright, "Dynamics for Designers", GDC 2003 — [Internet Archive](https://archive.org/details/2003_GDC_-_Friday_3pm-4pm_03-07-2003_-_Dynamics_for_Designers_-_Will_Wright)
- Don Hopkins, Sims design documents — [donhopkins.com TechnicalEmail.pdf](https://donhopkins.com/home/TheSimsDesignDocuments/TechnicalEmail.pdf)
- Yoann Bourse, "Artificial Intelligence in The Sims series" (ENS report, 2012), a compiled technical overview — [PDF](https://yo252yo.com/old/ens/sims-rapport.pdf)
- Nona Mena, ITUN modding guide (Sims 3 tuning) — [Simlogical PDF](https://simlogical.com/ContentUploadsRemote/uploads/1588/ITUN_Modding_Discussion_Explanation.pdf)
