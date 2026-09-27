# Game-AI Techniques for Believable Autonomous Characters in Social / Colony Sims (beyond The Sims)

Method note: WebFetch was blocked by the egress proxy for every domain tried (gameaipro.com, arxiv.org, rimworldwiki.com, zenn.dev, versu.com, mtreanor.com, agentpatterns.ai, eatcreatesleep.net). So every finding below comes from search-result snippets, not full-text reads. Anything marked **[prior knowledge, unverified]** comes from the researcher's background knowledge of these well-known sources. It could not be checked in this session and is kept in Inferences or Gaps, not Cited Findings. The report writer should treat those numbers as "likely, confirm before quoting".

Target context throughout: 7 characters, server-side Node.js, no ML or LLM, family game for children aged 7 and 15.

---

## 1. Utility AI (Dave Mark, Kevin Dill, IAUS, response curves, considerations, bucketing, inertia)

### Takeaway
Utility AI is the best fit for the core "what do I do next" loop of a 7-character town sim. It is cheap (7 agents × roughly 30 actions × roughly 5 considerations each is trivial), easy to tune, and gives graded, personality-driven choices. There are two reliable tools against robotic or dithering behaviour: (a) bucketing or dual utility, followed by weighted-random choice among the top options, and (b) inertia, meaning a momentum bonus plus a minimum commit time.

### Cited Findings
- IAUS was proposed by Dave Mark (Intrinsic Algorithm) in GDC lectures, in his book *Behavioral Mathematics for Game AI*, and in the Game AI Pro series. — [Zenn IAUS intro](https://zenn.dev/sanmal/articles/9ed9989c11b7eb?locale=en)
- The basic unit is the *consideration*. A consideration maps one input (normalised 0–1) through a response curve to a score. All of a behaviour's consideration scores are **multiplied** to give its final score. "Infinite axis" means you can add any number of considerations. — [Zenn](https://zenn.dev/sanmal/articles/9ed9989c11b7eb?locale=en); [Utility Intelligence docs: Considerations](https://uintel-go.utilityworlds.com/Documentation/UtilityIntelligence/Considerations/)
- Multiplying scores has a problem: the result shrinks as considerations are added (0.8×0.8×0.8 = 0.512). Dave Mark's fix is a **compensation factor**, first presented in the GDC talk "Building a Better Centaur: AI at Massive Scale" (around 09:10). — [Zenn](https://zenn.dev/sanmal/articles/9ed9989c11b7eb?locale=en)
- Kevin Dill's **dual-utility reasoning** combines two scores:
  - **Absolute utility** (priority, the "bucket") sorts options into categories, so only options from the most important relevant category can be chosen.
  - **Relative utility** (weight) then drives a **weighted-random pick** within that category. — [Kevin Dill, Game AI Pro 2 ch.3 "Dual-Utility Reasoning"](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter03_Dual-Utility_Reasoning.pdf)
- Bucketing in general: actions go into buckets, each bucket has a weight, and higher-priority buckets are always processed first. — [Falmouth comp250 wiki, Utility-based AI](https://github.com/Falmouth-Games-Academy/comp250-wiki/wiki/Utility-based-AI)
- **Inertia and dithering:** an agent that re-decides every tick oscillates when two actions score nearly the same. Fixes:
  - a selection bonus (hysteresis) on the currently running action;
  - a **minimum commit time**, so a marginally higher score cannot interrupt the current action;
  - a lock on the chosen action for a short time unless a high-priority interrupt fires.

  A cited "momentum bonus" gives the last chosen behaviour a **flat 25% bonus** on the next think cycle. — [Bugnet blog: fixing utility AI oscillation](https://bugnet.io/blog/how-to-fix-utility-ai-oscillating-between-actions); [Falmouth wiki](https://github.com/Falmouth-Games-Academy/comp250-wiki/wiki/Utility-based-AI). (Secondary sources. The 25% figure may come from a particular framework rather than from Dave Mark.)
- Further primary reading, not fetched: Dill, "Design Patterns for the Configuration of Utility-Based AI" ([PDF](https://course.ccs.neu.edu/cs5150f13/readings/dill_designpatterns.pdf)); Mike Lewis, "Choosing Effective Utility-Based Considerations", Game AI Pro 3 ch.13 ([PDF](https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter13_Choosing_Effective_Utility-Based_Considerations.pdf)); Rez Graham, "An Introduction to Utility Theory", Game AI Pro ch.9 ([PDF](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf)); apoch/curvature utility editor and crash course ([wiki](https://github.com/apoch/curvature/wiki/Utility-Theory-Crash-Course)).

### Inferences
- **[prior knowledge, unverified]** The compensation factor usually quoted from Dave Mark's talk: with `n` considerations, `modFactor = 1 - 1/n`, `makeUp = (1 - score) * modFactor`, `score' = score + makeUp * score`. Apply this to each consideration score before multiplying.
- **[prior knowledge, unverified]** Typical IAUS response-curve parameters `(type, m, k, b, c)`:
  - linear or quadratic: `y = m * (x - c)^k + b`
  - logistic: `y = k / (1 + e^{-m (x - c)}) + b`

  Clamp the result to [0,1]. Each consideration = `{input, curve, min, max}`, with the input normalised as `(v - min)/(max - min)`.
- Suggested Node.js structure for the town:
  - `action = {id, bucket, weight, considerations:[{input:'hunger', curve:{type:'logistic',m:10,k:1,b:0,c:0.6}}], minCommitSec, interruptible}`.
  - Each think tick: filter to the highest non-empty bucket, score with the compensation factor, multiply by `weight` and the personality multiplier, add 10–25% momentum to the current action, keep options scoring at least 80–90% of the best, and pick one by weighted random.
  - Cost is on the order of a few thousand multiplications per tick for 7 agents, which is negligible.
- Personality in utility AI: trait multipliers on action weights (for example "outgoing": ×1.5 on social actions) give characters distinct habits without separate code. Combined with weighted-random among the top options, this is the main defence against "robotic" sameness.
- Think every 1–5 simulated seconds or on events (action complete, need crosses threshold, someone greets me), not every frame. This cuts cost and dithering.
- Kid-safe: utility AI is content-neutral, and safety depends on which actions exist. Keep the action list to wholesome actions.

### Gaps
- I could not read Dave Mark's GDC talks or the IAUS Game AI Pro chapters in full text. The compensation formula and curve equations above are unverified.
- I found no primary source for the "25% momentum" figure.

---

## 2. GOAP (Orkin, F.E.A.R.) and HTN planning for life sims

### Takeaway
Planning is worth adding only for a small number of multi-step goals (for example "earn money → buy ingredients → cook → invite friend"). With 7 agents a tiny planner is cheap. For a life sim, a hand-authored **HTN** (or even a scripted "recipe" sequence chosen by utility) is more predictable and easier to author than GOAP's open-ended search. The recommended hybrid: utility picks *which goal*, and HTN or GOAP works out *how*.

### Cited Findings
- F.E.A.R.'s AI used an FSM with only **three states**, and used A* to plan both actions and paths. Real-time planning let characters adapt to the situation. — [Orkin, "Three States and a Plan" (GDC 2006)](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf)
- GOAP differs from STRIPS in three ways: it adds a **cost per action**, removes Add/Delete lists for effects, and adds **procedural preconditions and effects**. Actions have preconditions and effects. With a cost metric, A* finds the lowest-cost action sequence that satisfies the goal. — [Orkin GDC 2006](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf); [Game Developer: Building the AI of F.E.A.R. with GOAP](https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning)
- **HTN (Troy Humphreys, Game AI Pro ch.12):** a total-order forward-decomposition planner used on *Transformers: Fall of Cybertron*. Compound tasks hold several *methods*. The planner takes the first method whose conditions are valid and pushes its subtasks onto the processing stack. It was **considerably faster than the GOAP system** in the previous game (*War for Cybertron*), because a method choice culls large parts of the network. — [Humphreys, "Exploring HTN Planners through Example"](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter12_Exploring_HTN_Planners_through_Example.pdf)
- A reference open-source HTN implementation exists: Fluid HTN (C#, builder pattern), which is easy to port to JS. — [ptrefall/fluid-hierarchical-task-network](https://github.com/ptrefall/fluid-hierarchical-task-network)
- Planner optimisation techniques are covered in Éric Jacopin, "Optimizing Practical Planning for Game AI". — [Game AI Pro 2 ch.13](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter13_Optimizing_Practical_Planning_for_Game_AI.pdf)

### Inferences
- GOAP world state for a town sim can be a small key/value object, e.g. `{hasMoney:true, hasIngredients:false, mealReady:false, friendInvited:false}`. Actions:
  - `Work {pre:{}, eff:{hasMoney:true}, cost:4}`
  - `BuyFood {pre:{hasMoney:true}, eff:{hasIngredients:true}, cost:2}`
  - `Cook {pre:{hasIngredients:true}, eff:{mealReady:true}, cost:2}`
  - `Invite {pre:{mealReady:true}, eff:{friendInvited:true}, cost:1}`

  A* over fewer than 30 actions at a depth of 4–6 costs microseconds in Node.
- The HTN equivalent: compound task `HostDinner` with methods such as
  - [hasMeal → Invite]
  - [hasIngredients → Cook, Invite]
  - [hasMoney → Shop, Cook, Invite]
  - [else → Work, Shop, Cook, Invite]

  This is authored explicitly, so designers (and children watching) see sensible, legible plans.
- Plans must be **interruptible and re-planned** when the world changes (the shop is closed, the friend is busy). That is the point of Orkin's approach. Re-plan only on failure or a significant event, not every tick.
- Planning shines for legibility: a displayed plan ("Mia is saving up to cook for Leo") gives observers a story hook. This is a cheap, big win for believability.
- Costs of planning: authoring effort, debugging "why did it choose that?", and plans that look too optimal or robotic. With 7 agents the CPU cost is not an issue.

### Gaps
- I did not read the full Orkin or Humphreys texts. I found no published life-sim-specific GOAP or HTN case study; the dinner example is illustrative.

---

## 3. Social AI research: CiF / Prom Week, Versu, Talk of the Town, Façade

### Takeaway
The academic systems give three reusable ideas:
1. **Social exchanges** (CiF): authored two-person interactions with intent, volition rules, accept/reject rules and effects, driven by relationship values and a history database.
2. **Social practices** (Versu): shared situations (dinner, greeting, a game) that offer role-specific actions to everyone present, so agents coordinate without a central script.
3. **Subjective, fallible knowledge** (Talk of the Town): per-character beliefs that spread, mutate and fade, which produces gossip and misinformation.

Façade adds a **drama manager** that sequences "beats" to follow a tension curve.

### Cited Findings
**Comme il Faut / Prom Week**
- CiF (McCoy et al.) is an authorable model of social interaction for autonomous agents. It powers *Prom Week*. — [McCoy et al., "Comme il Faut: A System for Authoring Playable Social Models" (AIIDE 2011)](https://cdn.aaai.org/ojs/12454/12454-52-15982-1-2-20201228.pdf); [Social Story Worlds with CiF (TCIAIG)](https://mtreanor.com/publications/TCIAIG-CiF.pdf)
- Social exchanges are the main unit. **Initiator influence rules** set a character's *volition* (desire) to start an exchange with someone. **Responder influence rules** decide accept or reject. Each exchange's own rules combine with a much larger set of inherited general rules called **microtheories**. These inputs feed the decision:
  - characters and the current social state;
  - the **Social Facts Database (SFDB)** history;
  - authored exchanges and microtheories;
  - the **Cultural Knowledge Base (CKB)**. — [CiF-Bannerlord thesis summary](https://fenix.tecnico.ulisboa.pt/downloadFile/844820067127173/96987-Filipe-Silveira-resumo.pdf); [McCoy et al. 2011](http://www.ben-samuel.com/wp-content/uploads/2015/09/CiF-AIIDE2011.pdf)
- Prom Week has three social networks: **Buddy, Romance, Cool**. It has 12 intents:
  - six network intents: increase or decrease friendship, romance and cool;
  - six relationship intents: start or end dating, start or end friendship.

  **Statuses** are binary, temporary feelings that often come from several interactions; some (e.g. embarrassed) are private. There are **over 5,000 social considerations** and **over 40 social exchanges**. — [Prom Week blog: Social Exchanges](https://promweek.soe.ucsc.edu/2012/02/22/prom-weeks-social-exchanges/); [Prom Week: Social Physics as Gameplay (FDG 2011)](http://www.ben-samuel.com/wp-content/uploads/2015/09/FDG-2011-Prom-Week-Social-Physics-as-Gameplay.pdf)
- A Game AI Pro chapter describes a CiF-style architecture for practitioners: "An Architecture for Character-Rich Social Simulation" (ch.43). — [PDF](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter43_An_Architecture_for_Character-Rich_Social_Simulation.pdf)

**Versu**
- Versu (Richard Evans and Emily Short) is a text-based simulationist interactive drama. It uses autonomous agents and relies on **social practices** to coordinate them. Content is written in **Praxis**, a logic-programming language based on **exclusion (eremic) logic**. Praxis specifies social practices and world truths, and gives fine control over what is true and what each agent wants. — [IFWiki: Versu](https://www.ifwiki.org/Versu); [Evans & Short, "Versu—A Simulationist Storytelling System"](https://www.semanticscholar.org/paper/Versu%E2%80%94A-Simulationist-Storytelling-System-Evans-Short/74c6364ae004ce58e3f15a20c1e6d22198a93e21)
- Exclusion logic is a modal logic based on hierarchical finite-state machines. Evans used it to model social practices. — [Using Exclusion Logic to Model Social Practices](https://www.researchgate.net/publication/221611501_Using_Exclusion_Logic_to_Model_Social_Practices)

**Talk of the Town**
- Talk of the Town (James Ryan et al.) simulates an American small town over its history. Characters live abstracted lives of major events and routines, with rich modelling of **knowledge phenomena**. Characters form mental models of other characters, and **propagation, misremembering and forgetting** are simulated. As characters interact, they share their mental models (for example someone's appearance or workplace). — [James Ryan site](https://jamesryan.computer/); [Bad News project page](http://www.ben-samuel.com/projects/bad-news/)
- **Attribute saliences** set how likely a character feature is to be *observed* and *talked about*. Each facet of a mental model stores data about the belief, for example occupation (company, job title, shift, status) and appearance (24 facial attributes). — [Simulating Character Knowledge Phenomena in Talk of the Town](https://www.researchgate.net/publication/335746180_Simulating_Character_Knowledge_Phenomena_in_Talk_of_the_Town)

**Façade**
- Façade's drama manager is a **beat sequencer**. It picks the unused beat whose preconditions hold and whose story-tension effects best match the near-term path of an author-specified **Aristotelian tension arc**. Weights and priorities also factor in. Beats hold local reactive behaviours; the drama manager sequences them globally. — [Mateas & Stern, "Structuring Content in the Façade Interactive Drama Architecture" (AIIDE 2005)](https://users.soe.ucsc.edu/~michaelm/publications/mateas-aiide2005.pdf); [Game Developer: The Story of Façade](https://www.gamedeveloper.com/design/the-story-of-facade-the-ai-powered-interactive-drama)

### Inferences
- **[prior knowledge, unverified]** In CiF the network values run 0–100. Volition for an exchange is the **sum of the weights of all influence rules whose conditions hold**. Each character forms volitions toward every other character, and the top few exchanges per pair are offered. SFDB entries are tagged with labels (e.g. "cool", "mean", "romantic") so later rules can ask "has X been mean to Y recently?". Treat these as probable, not confirmed.
- A cheap CiF-lite for Node:
  - `exchange = {id:'ComplimentOutfit', intent:{net:'friend', dir:+1}, preconditions:[fn], initiatorRules:[{cond:fn, w:+20}], responderRules:[{cond:fn, w:+15}], effects:{accept:[...], reject:[...]}, sfdbLabel:'nice'}`.
  - Accept if the sum of responder rule weights is above 0, or pass it through a logistic curve for a softer yes/no.
  - With 7 characters there are only 42 directed pairs, so evaluating everything every social tick is trivial.
- **Versu-style practices** fit a town sim well: a "Family Dinner" or "Game Night" object that, while active, offers actions (pass food, tell a story, compliment the cook) to anyone present in a role. Utility AI then scores those actions. This gives coordinated group scenes without scripted cutscenes.
- **Talk-of-the-Town-lite gossip:** each agent keeps `beliefs[subjectId][attribute] = {value, confidence, source, learnedAt}`.
  - On a conversation, share beliefs chosen by salience.
  - Confidence drops each hop and over time.
  - When confidence falls low, there is a small chance of *mutation* (the value swaps to a similar value) or deletion (forgetting).
- **Façade-lite pacing:** keep a numeric `tension` target curve for the day or week. Tag events and social exchanges with `tensionDelta`, and have a director favour those that move actual tension toward the target (see section 7).
- Kid-safe: Prom Week's romance network, dating intents and "mean" exchanges need softening. Replace Romance with a "close friends / crush-free" axis or restrict romance to adult NPC couples off-screen. Replace "Cool" with "respect/admiration". Keep negative exchanges mild (tease → apologise), and bias outcomes toward making up.

### Gaps
- I could not read the CiF, Versu or Talk of the Town full texts, so I have no exact rule-weight scales, belief decay constants or Praxis syntax.
- I found no published numbers for Talk of the Town's mutation or forgetting probabilities.

---

## 4. Emergent-story systems: RimWorld, Dwarf Fortress, Crusader Kings

### Takeaway
All three games create memorable stories from **many small, labelled, timed modifiers** (thoughts, opinions, stress) that sum into a visible state, plus **threshold events** (mental breaks, grudges) that turn the accumulated numbers into dramatic, attributable moments. Each modifier carries a human-readable reason ("ate without table −3", "insulted me −15"), so players can explain what happened as a story. With 7 characters, making the causes legible matters more than how many there are.

### Cited Findings
**RimWorld**
- Mood is related to the **sum of all active thoughts**. Small moodlets stack: several −3s from pain, hunger, eating without a table or darkness can reach −20 or more. — [RimWorld Wiki: Mood](https://rimworldwiki.com/wiki/Mood) (via search snippet)
- For a normal colonist, mental-break thresholds are **35% minor, 20% major, 5% extreme**. Traits shift them; *Steadfast* raises and *Nervous* lowers the threshold. The major threshold is always 4/7 and the extreme threshold 1/7 of the Mental Break Threshold stat. Trait effects add together, and the minor threshold is capped between 1% and 50%. — [RimWorld Wiki: Mental break](https://rimworldwiki.com/wiki/Mental_break); [Mental Break Threshold](https://rimworldwiki.com/wiki/Mental_Break_Threshold)
- After a break, a positive **catharsis** thought applies. Catharses stack up to 5 times with diminishing effect. Negative thoughts are not reset after a break. — [RimWorld Wiki: Mental break](https://rimworldwiki.com/wiki/Mental_break)
- ThoughtDef fields:
  - `durationDays`, `stackLimit`, `stackedEffectMultiplier`. Example: the "AteCorpse" thought has durationDays 1.0, stackLimit 3 and stackedEffectMultiplier 0.5. Each extra stack contributes a diminished amount.
  - Social memory thoughts (`Thought_MemorySocial`) also carry `stackLimitPerPawn` and `baseOpinionOffset`. Example: **DeepTalk** has durationDays 20, stackLimitPerPawn 10, stackedEffectMultiplier 0.88 and baseOpinionOffset +15. — [Steam/Ludeon modding threads citing Core defs](https://steamcommunity.com/app/294100/discussions/0/1693788384146294148/); [RimWorld Wiki: Thoughts/Memory Social](https://rimworldwiki.com/wiki/Thoughts/Memory_Social)
- Mood has a *current mood* that moves toward a *mood target* (the thought sum) over time rather than jumping. — [eatcreatesleep: Mood vs Mood Target](https://eatcreatesleep.net/how-the-rimworld-mood-system-really-works-mood-vs-mood-target/) (title and snippet only; the rate was not retrieved)

**Dwarf Fortress**
- Each personality facet has a value from 0–100. It is reported in one of seven bands, and 40–60 is not reported. Facets marked "†" drive relationships: large differences (above 60 in one creature and below 40 in the other) contribute to **grudges**. Species set facet medians (dwarves' greed median is 55; goblins' altruism median is 25, capped at 50). — [DF Wiki: Personality facet](http://www.dwarffortresswiki.org/index.php/Personality_facet)
- **Needs** are derived from facets and values. Unmet needs cause complaints, stress and distraction; met needs raise satisfaction and focus. — [DF Wiki: Personality facet](http://www.dwarffortresswiki.org/index.php/Personality_facet); [DF2014 Thoughts and preferences](https://dwarffortresswiki.org/index.php/DF2014:Thoughts_and_preferences); [DF2014 Personality value](https://dwarffortresswiki.org/index.php/DF2014:Personality_value)
- Academic analysis of characterisation and emergent narrative in DF: [Characterization and Emergent Narrative in Dwarf Fortress](https://www.researchgate.net/publication/356686095_Characterization_and_Emergent_Narrative_in_Dwarf_Fortress)

**Crusader Kings III**
- Stress runs from **0 to 400**. Crossing **100, 200 or 300** for the first time triggers an immediate **mental break** of level 1–3. Higher stress levels bring growing health and fertility penalties. Break events offer two choices:
  - lose stress by gaining one of two traits (a **coping mechanism** or worse);
  - or gain more stress.

  Level-3 breaks can injure or kill, or cause murder or abdication. **Characters mainly gain stress by acting against their personality traits.** — [CK3 Dev Diary #31 "A Stressful Situation"](https://forum.paradoxplaza.com/forum/developer-diary/ck3-dev-diary-31-a-stressful-situation.1399764/page-14); [CK3 Dev Diary #58](https://forum.paradoxplaza.com/forum/developer-diary/ck3-dev-diary-58-stre-ss-tching-the-traits.1472092/page-3); [GameRant stress guide](https://gamerant.com/ck3-crusader-kings-3-how-check-reduce-stress-levels/)
- CK3 opinion modifiers are timed. Scripts add them with `add_opinion = { modifier = X days/months/years = Y target = Z }`, and a modifier can also **decay or grow** over its duration (the decaying and growing timed opinions were fixed in patch 1.19). — [CK3 Wiki: Patch 1.19](https://ck3.paradoxwikis.com/Patch_1.19); [CK3 modding wiki: Commands](https://github.com/jesec/ck3-modding-wiki/blob/master/wiki_pages/Commands.md)

### Inferences
- **[prior knowledge, unverified]**
  - RimWorld's "expectations" add a mood bonus that shrinks as colony wealth grows, which creates a hedonic treadmill.
  - Mental-break chance is a mean-time-between (MTB) roll while below a threshold, not a certainty.
  - Opinion of another pawn is the sum of social thoughts about them, clamped to ±100.
- **[prior knowledge, unverified]** CK3 opinion is a sum of labelled modifiers (e.g. "+20 Same faith", "−30 Imprisoned me (decaying)"). Personality compatibility gives opinion bonuses and penalties between trait pairs (e.g. two Gregarious characters like each other; Honest vs Deceitful dislike each other).
- Why these games get memorable stories from few characters:
  1. Every state change has a **named cause**.
  2. **Thresholds** turn quiet accumulation into visible, surprising moments.
  3. **Traits bias both decisions and reactions**, so the same event lands differently on different characters.
  4. Memories **persist for days or weeks**, so events echo later.
  5. Contrasting pairs of traits generate friction automatically.
- Suggested thought structure for Node: `thought = {defId, label, mood, opinionTarget?, opinion, createdAt, durationH, stackKey}`. Mood target = Σ over stack groups of `effect * (1 + m + m^2 + …)` up to `stackLimit`. Current mood moves toward the target at a fixed rate per tick (e.g. `mood += clamp(target - mood, -r, r)`). Expired thoughts are removed, or faded linearly for "decaying" ones.
- **Kid-safe softening:**
  - Replace mental breaks with gentle, recoverable "grumpy spells": sulk in room, refuse chores, need a hug or cake. Pair them with a catharsis-style "feeling better" boost. No violence, self-harm, binge drinking or the "berserk" equivalents.
  - Drop CK3's murder or death outcomes and its health penalties.
  - Drop DF's grudge → violence path. Keep grudges as "not getting along" and add built-in reconciliation events.
  - Remove death-of-friend thoughts, or use "friend moved away / went on holiday" instead.
  - Keep negatives mild (−2 to −8) and give characters obvious ways to fix them.

### Gaps
- I could not retrieve RimWorld's mood-approach rate, break MTB values, full thought value tables or expectations numbers (the wiki was blocked).
- I have no CK3 exact opinion decay formulas or DF numeric stress constants.

---

## 5. Memory and gossip models (Generative Agents and non-LLM emulation)

### Takeaway
The Generative Agents architecture (memory stream → retrieval by recency, importance and relevance → reflection when accumulated importance passes a threshold → hierarchical planning) can be emulated without an LLM:
- importance = an authored per-event-type constant;
- relevance = tag overlap;
- reflection = rule-based summarisation ("X has been nice to me 3 times → X is my friend").

### Cited Findings
- The architecture stores experiences in a **memory stream** and retrieves a subset using **recency** (exponential decay on time since last access), **importance** (an integer score from the language model that separates mundane from core memories) and **relevance** (similarity to the current query). The scores are **normalised and combined with equal weights**. — [Park et al. 2023, "Generative Agents" (arXiv 2304.03442)](https://arxiv.org/pdf/2304.03442); [Lukyanenko paper review](https://andlukyane.com/blog/paper-review-ishb)
- **Reflections** are generated when the **sum of importance scores of recent events exceeds a threshold (150 in their implementation)**. — [Park et al. 2023](https://arxiv.org/pdf/2304.03442) (via search snippet); [emergentmind summary](https://www.emergentmind.com/topics/generative-agents)
- Recency decay factor **0.995**. — The search snippet mentioned it only because it echoed my query, so it is not independently confirmed. It matches the paper to the best of the researcher's knowledge (see Inferences).

### Inferences
- **[prior knowledge, unverified]** Details from Park et al. that could not be checked here:
  - Retrieval: `score = α_rec·recency + α_imp·importance + α_rel·relevance`, all α = 1, each component min-max normalised to [0,1].
  - Recency: `0.995^(hours since last retrieval)`, in sandbox game hours.
  - Importance: rated 1–10 (1 = brushing teeth, 10 = break-up or college acceptance).
  - Relevance: cosine similarity of embeddings.
  - Reflection: the agent asks the 3 most salient questions about its 100 most recent memories and writes insights with pointers back to the evidence. It reflects roughly 2–3 times a day.
  - Planning: a broad day plan (5–8 chunks), then hourly chunks, then 5–15-minute actions. The agent re-plans when it reacts to an observation.
- Non-LLM emulation for 7 characters:
  - `memory = {id, t, type:'gift'|'insult'|'party'|..., actors:[ids], place, tags:['food','Leo'], importance:1..10 (from event-type table), valence:-1..+1, lastAccess}`
  - `retrieve(query)`: `rel = |tags∩queryTags| / |queryTags|`, `rec = 0.995^(gameHoursSince(lastAccess))`, `imp = importance/10`. Sort by `rec+imp+rel` and return the top k (3–5). Set `lastAccess = now` for the returned items; this is what makes memories that keep coming up stay fresh.
  - **Forgetting:** delete memories with `importance ≤ 3` older than N days, or once `rec*imp` drops below ε. Keep at most about 200 per agent. Storage is trivial.
  - **Reflection by rules:** add up importance since the last reflection. When it passes a threshold (scaled down, e.g. 30–50, because authored importance is sparse), run pattern rules over recent memories, e.g. `count(valence>0 && actor==X) ≥ 3 → belief "X is kind to me" (importance 6)`. Reflections become memories and can feed opinion modifiers.
  - **Gossip:** during a chat, the speaker retrieves memories with high importance and mentions of third parties, weighted by "juiciness" = importance × |valence|. The listener stores a second-hand memory `{source: speaker, confidence: speakerConfidence*0.7}`. The listener's opinion of the subject shifts by `valence*confidence*trust(speaker)`. Low-confidence items can mutate (Talk-of-the-Town style).
- Kid-safe gossip: allow gossip about harmless facts ("Leo loves pancakes", "Mia won the painting contest") and mild negatives. Add "rumour correction": when the subject hears a false rumour, they can clear it up, which gives a positive resolution arc. Avoid rumours about romance, bodies or appearance.

### Gaps
- The exact retrieval details (decay unit, importance scale, reflection procedure) are from memory, because arxiv.org could not be fetched. Confirm against the PDF.

---

## 6. Relationship models (multi-axis, opinion modifiers with decay, compatibility)

### Takeaway
Use a **multi-axis relationship record per directed pair**:
- persistent slow-moving axes (friendship, familiarity, respect);
- a **list of timed, labelled opinion modifiers**, CK3 and RimWorld style;
- a static **compatibility** term from personality similarity or difference, Dwarf Fortress style.

Displayed opinion = compatibility + axes + Σ active modifiers.

### Cited Findings
- Prom Week uses three independent networks: Buddy (friendship), Romance and Cool (social status or respect). Discrete relationships (friends, dating) are separate from the scalar networks. Binary statuses are timed. — [Prom Week blog](https://promweek.soe.ucsc.edu/2012/02/22/prom-weeks-social-exchanges/)
- RimWorld social thoughts carry both a `baseOpinionOffset` (e.g. DeepTalk +15) and a duration (20 days), with per-pawn stack limits (10) and diminishing stacking (0.88). — [RimWorld Wiki: Thoughts/Memory Social](https://rimworldwiki.com/wiki/Thoughts/Memory_Social); [Steam modding thread](https://steamcommunity.com/app/294100/discussions/0/1693788384146294148/)
- CK3 opinion modifiers are timed and can decay or grow over their duration. — [CK3 Wiki: Patch 1.19](https://ck3.paradoxwikis.com/Patch_1.19); [CK3 modding wiki: Commands](https://github.com/jesec/ck3-modding-wiki/blob/master/wiki_pages/Commands.md)
- In Dwarf Fortress, large facet differences (above 60 vs below 40) on relationship-relevant facets feed grudges, which is a compatibility mechanism. — [DF Wiki: Personality facet](http://www.dwarffortresswiki.org/index.php/Personality_facet)

### Inferences
- A Node data structure:
  ```js
  rel[a][b] = {
    friendship: 0,      // -100..100, slow; moved by social exchanges
    familiarity: 0,     // 0..100, grows with time spent together, decays slowly when apart
    respect: 0,         // -100..100 (kid-safe replacement for "cool")
    // romance omitted or adults-only
    modifiers: [ {label:'Shared cookies', value:+10, createdAt, durationH:72, decay:'linear'|'none', stackKey:'gift', stackMult:0.88} ],
    labels: ['friend'|'best_friend'|'rival'|'sibling'...]
  }
  opinion(a,b) = compat(a,b) + 0.5*friendship + 0.2*respect + Σ modifiers(value * (decay? remaining/duration : 1)) // clamp ±100
  compat(a,b) = Σ_traits pairTable[tA][tB]  // or  k * (1 - |facetA - facetB|/100) over a few facets
  ```
- Label transitions use hysteresis so relationships don't flicker: become "friend" when friendship > 40, lose it only when friendship < 20.
- Familiarity gates what exchanges are available (you don't give a deep talk to a stranger). This is realistic and slows relationship growth for pacing.
- Asymmetry (a→b ≠ b→a) is a key story source: one-sided admiration and a hurt friend.
- Kid-safe: make romance off-screen or adults-only, or omit it. Rename "rival" to "friendly rival". Cap negative opinion (e.g. −40) and add passive drift of friendship toward a mildly positive baseline, so nobody stays enemies for good.

### Gaps
- I found no published concrete formula for The Sims-like "familiarity" or multi-axis combination weights. The weights above are design suggestions.

---

## 7. Pacing and director systems

### Takeaway
A small world goes stale without a **director**. The recommended director tracks a tension or excitement measure, follows a target curve with cycles (RimWorld's Cassandra alternates on and off periods; Façade matches an arc), picks events by fitness to the curve, respects cooldowns, and adapts to how the player is doing.

### Cited Findings
- **Cassandra Classic** (RimWorld's default storyteller) averages about **8.5 major threats per in-game year**, ramping up over time with breaks every 1–2 raids. **Cassandra and Phoebe alternate safe and dangerous periods** (on/off cycles), which are deterministic across saves. — [RimWorld Wiki: Cassandra Classic](https://rimworldwiki.com/wiki/Cassandra_Classic); [AI Storytellers](https://rimworldwiki.com/wiki/AI_Storytellers)
- Threat size scales with wealth: between 14,000 and 400,000 storyteller wealth, raid points rise about 1 point per 160.83 wealth. An **adaptation factor** grows over time, **drops after a colonist is lost** (a breather), then gradually recovers. — [Steam discussion: Wealth and Base Point stats](https://steamcommunity.com/app/294100/discussions/0/598519173680808900/); [RimWorld Wiki: AI Storytellers](https://rimworldwiki.com/wiki/AI_Storytellers) (the adaptation description comes partly from community posts)
- **PopulationIntent** = `populationIntentFactorFromPopCurve × populationIntentFactorFromPopAdaptDaysCurve`. It steers whether the storyteller sends events that add colonists. — [Steam community discussions](https://steamcommunity.com/app/294100/discussions/0/3416559828445292909)
- Façade's beat sequencer picks beats whose tension effect best matches an authored arc. — [Mateas & Stern 2005](https://users.soe.ucsc.edu/~michaelm/publications/mateas-aiide2005.pdf)
- Literary analysis of storytellers as genre-shaping agents: [Medium: Algorithmic Authors](https://medium.com/@coyega1328/algorithmic-authors-rimworlds-ai-storytellers-as-agents-of-literary-genre-eff70ea4560c)

### Inferences
- A director for a 7-character town:
  - `event = {id, tags, preconds(world), tensionDelta, weight, cooldownH, lastFired, perCharCooldownH}`.
  - Every in-game hour:
    - `target = base + A*sin(2π t/periodDays)`, or on/off phases like Cassandra;
    - `actual` = an exponential moving average of recent event tension plus average negative mood;
    - `need = target - actual`.
  - Candidate events are those whose preconditions hold and whose cooldowns have expired. Score each as `weight * (1 - |tensionDelta - need|/range)` times a novelty bonus for event types not seen recently, then pick by weighted random. Also enforce a global minimum gap between director events.
- **Adaptation:** if average mood is low or a child player seems frustrated (for example, many unresolved problems), lower the target for a while, like RimWorld's post-loss breather.
- **Spotlight rotation:** track "screen time" per character and give the least-featured character a bonus. With only 7 characters, this stops one resident from hogging the story.
- **Positive events count:** for kids, "tension" can be excitement: a festival, a lost puppy, a bake-off, a surprise visitor, a rainstorm. The director should alternate problems with celebrations.
- Kid-safe: no raids, deaths, fires that harm people or disease plagues. Replace threats with solvable, low-stakes problems (a broken fountain, the power goes out, lost pet, garden pests).

### Gaps
- I did not obtain RimWorld's exact cycle lengths (days on and off), MTB values or the storyteller curves themselves. Tynan Sylvester's GDC talk and *Designing Games* were not accessed.
