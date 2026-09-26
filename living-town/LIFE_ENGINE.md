# Living Town Life Engine (0.5)

## Honest model

Residents are simulated people, not sentient agents. Their behavior comes from stored personality traits, needs, relationships, routines, and weighted random choices. Every outcome is written to the save, so nothing rerolls after a restart. There is no generative AI in this release.

## Minds (`lib/mind.js`)

Each resident has five personality traits (openness, conscientiousness, extraversion, agreeableness, neuroticism), a set of interests, a walking speed, wake and bed times, and a weekly routine.

| Resident | In short | Routine |
| --- | --- | --- |
| Olive | Curious, thoughtful, a bit introverted | School on weekdays 8–15; sleeps in on weekends |
| Hazel | Loud, fearless, fastest walker | School on weekdays 8–14; in bed by 20:00 |
| Sean | Steady and practical | Workshop jobs on weekdays 8–12 and 13–17 |
| Milo | Everyone's friend | Runs the cafe Monday to Saturday 6–14; up at 5:30 |
| Zara | Artistic, sensitive | Teaches studio classes Tuesday to Saturday 10–15 |
| Finn | Quiet, patient, slow walker | Retired; up at 5:00, in bed at 21:00 |
| Nova | Spontaneous night owl | Market shifts on weekday evenings and Saturdays; bed after midnight |

**Needs.** Hunger, energy, social, and fun drain at personal rates. Extraverts get lonely faster, curious residents get bored faster, and children get hungry and tired sooner.

**Decisions.** A resident re-decides when their current plan expires (conscientious residents stick with plans longer), when a routine starts or ends, or when a need turns critical. Each place is scored by:

- what it restores, weighted by how badly that need is felt
- routine obligations (school is not optional; work weighs more for conscientious people)
- matching interests
- the two strongest friends or family members already there, scaled by how socially hungry the resident is
- crowding, which introverts avoid
- quiet places when stressed
- boredom with the current place (curious residents get restless sooner)
- distance
- a little randomness, more for spontaneous people

The strongest reason is shown to players as the resident's **intent**.

**Activities.** On arrival a resident picks an activity that fits their interests: Hazel watches the ducks, Finn counts birds, Zara sketches the fountain.

**Conversations.** Nearby awake residents may talk. The chance rises with extraversion, friendship, and social need, and falls with stress. A conversation is one of:

- **shared interest:** topic lines like "there's a heron at the pond again"
- **news:** a real stored fact about the speaker, retold in their own words
- **small talk**
- **mild disagreement:** more likely between disagreeable, stressed, or mismatched people, and less likely between close friends. Always child-safe, e.g. "whether pineapple belongs on pizza".

Each resident has a voice. Hazel says "Guess what?! …!", Finn says "Hm. …, as it happens.", Nova says "ok so …, right?". Relationships change by personality compatibility, and disagreements cost a little friendship and add stress. Recent topics are not repeated right away.

## Life (`lib/life.js`)

**Background.** Every resident has ten years of history before the town opened in 2026. Hazel has seven, her whole life, starting from toddler moments. History is age-appropriate: nobody works before their career start age, marriage and parenting chapters are adult-only, and each career stage change produces exactly one promotion or transition event. Fact ids are anchored to 2026, so they never change with the calendar.

**Ages.** Residents have birth dates. Ages and life stages advance in real time, and birthdays are announced in the town feed.

**Careers.** Working adults climb a personal career ladder, for example Milo goes from cafe manager to catering lead, general manager, then co-owner. Rank and title persist. Retired Finn mentors instead of earning promotions.

**Experiences.** Each resident has a life event every 15–45 minutes. Personality weights which kinds happen: family, school or play, work, mentoring, interests, or community. Conscientious residents succeed at work more often, and anxious residents feel setbacks more. Children have small, kid-safe setbacks too.

**Mood.** Events nudge mood, and mood decays toward a personal baseline (lower and more stressed for anxious residents). Low needs raise stress. Labels: delighted, happy, content, low, tense, discouraged, overwhelmed.

**Goals.** Each resident starts with three profile goals, then goals drawn from their likes. Up to eight completed goals are kept. Goal text never nests or grows.

**Learning.** A resident's own history and experiences can never be forgotten; they are derived, not stored as copies. `knowledge` holds only facts learned from others (up to 240), and recent experiences are the most likely to be shared.

**Offline life.** On restart, each resident gets one experience per eight offline hours (twelve at most), spread evenly across the outage.

## Family

- Sean is Olive and Hazel's father; Olive and Hazel are sisters.
- Milo and Zara are married and are Nova's parents.
- Finn is Milo's father, Zara's father-in-law, and Nova's grandfather.
- Family bonds start at 55 or higher and pull family members toward each other.

## Boundaries

- Nobody dies, and there is no romance for minors.
- Children only receive age-appropriate events and child-safe disagreements.
- There is no generative dialogue until the LLM review gate is passed.
