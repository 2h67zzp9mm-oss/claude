"use strict";
/**
 * Life engine: biographies, background histories, careers, goals, moods,
 * autonomous experiences and fact sharing. Random events use `random()`,
 * which tests can replace with `setRandom()`; every outcome is persisted,
 * so nothing rerolls after a restart.
 */

const HISTORY_YEARS = 10;
// Background histories describe the years before the town opened in 2026.
// Anchoring to a fixed year keeps fact ids stable no matter the calendar.
const HISTORY_ANCHOR_YEAR = 2026;
const HISTORY_VERSION = 3;
const MAX_LEARNED = 240;
const MAX_EXPERIENCES = 120;
const MAX_MEMORIES = 120;
const MAX_COMPLETED_GOALS = 8;
const DAY_MS = 86_400_000;
// Life events arrive every 15–45 minutes per resident and nudge mood
// rather than slamming it; tickMood pulls it back toward baseline.
const EVENT_GAP_MIN = 15;
const EVENT_GAP_SPREAD = 30;
const MOOD_IMPACT = 0.6;

let random = Math.random;
function setRandom(fn) { random = typeof fn === "function" ? fn : Math.random; }

const profiles = {
  olive: {
    name: "Olive", born: "2011-04-12", role: "Student and storyteller",
    summary: "A curious teenager who notices patterns, collects stories, and wants to understand how the town fits together.",
    likes: ["drawing maps", "strange stories", "music", "late-afternoon walks"],
    dislikes: ["being rushed", "repetitive chores", "people talking over her"],
    values: ["curiosity", "loyalty", "independence"],
    goals: ["finish a town story collection", "learn a new creative skill", "discover a place nobody else notices"],
    family: [{ id: "dad", type: "father" }, { id: "hazel", type: "younger sister" }],
    career: { kind: "school", title: "Student", level: 3, organization: "Living Town School" },
    historyTracks: ["school", "creative", "friendship", "family"]
  },
  hazel: {
    name: "Hazel", born: "2019-06-03", role: "Student and fearless explorer",
    summary: "An energetic kid who turns ordinary errands into adventures and makes friends with nearly everything that moves.",
    likes: ["animals", "soccer", "treasure hunts", "bright colors"],
    dislikes: ["sitting still", "missing the fun", "giving up"],
    values: ["bravery", "play", "family"],
    goals: ["make an animal field guide", "master a new soccer move", "build the best secret fort"],
    family: [{ id: "dad", type: "father" }, { id: "olive", type: "older sister" }],
    career: { kind: "school", title: "Elementary student", level: 1, organization: "Living Town School" },
    historyTracks: ["school", "play", "animals", "family"]
  },
  dad: {
    name: "Sean", born: "1988-02-20", role: "Independent systems contractor",
    summary: "A practical problem-solver building a business while trying to remain present for Olive and Hazel.",
    likes: ["fixing difficult problems", "old games", "building useful things", "quiet drives"],
    dislikes: ["dishonesty", "wasted effort", "unlabeled wiring"],
    values: ["family", "transparency", "craftsmanship"],
    goals: ["build a dependable local business", "teach the girls how to make things", "improve the town workshop"],
    family: [{ id: "olive", type: "daughter" }, { id: "hazel", type: "daughter" }],
    career: { kind: "work", level: 5, organization: "Sean's Systems" },
    careerStartAge: 18,
    careerStages: ["service technician", "lead installer", "project manager", "operations manager", "independent systems contractor"],
    transitions: { "independent systems contractor": "left a steady job to go independent as an" },
    ladder: ["Independent systems contractor", "Systems contractor with a first hire", "Owner of a three-person systems crew", "Owner of the town's go-to systems company"],
    historyTracks: ["career", "family", "problem-solving", "community"]
  },
  milo: {
    name: "Milo", born: "1982-05-09", role: "Manager of Moonbeam Cafe",
    summary: "A sociable café manager who remembers everyone's order and quietly keeps half the town connected.",
    likes: ["new recipes", "busy mornings", "local gossip", "jazz records"],
    dislikes: ["wasted food", "cold coffee", "unnecessary grudges"],
    values: ["hospitality", "patience", "community"],
    goals: ["publish a town recipe book", "train a future café manager", "host a perfect block breakfast"],
    family: [{ id: "zara", type: "spouse" }, { id: "nova", type: "child" }, { id: "finn", type: "father" }],
    career: { kind: "work", level: 5, organization: "Moonbeam Cafe" },
    careerStartAge: 16,
    careerStages: ["dishwasher", "prep cook", "barista", "shift lead", "cafe manager"],
    ladder: ["Cafe manager", "Cafe manager and catering lead", "General manager of Moonbeam Cafe", "Co-owner of Moonbeam Cafe"],
    historyTracks: ["career", "marriage", "parenting", "community"]
  },
  zara: {
    name: "Zara", born: "1984-01-27", role: "Muralist and studio teacher",
    summary: "A working artist who paints public spaces, teaches patient beginners, and sees possibilities in blank walls.",
    likes: ["bold colors", "thrift-store frames", "teaching", "rainy studio days"],
    dislikes: ["beige walls", "careless criticism", "paint drying too fast"],
    values: ["creativity", "generosity", "courage"],
    goals: ["paint a town history mural", "open a shared studio", "help Nova finish a first major project"],
    family: [{ id: "milo", type: "spouse" }, { id: "nova", type: "child" }, { id: "finn", type: "father-in-law" }],
    career: { kind: "work", level: 5, organization: "Juniper Studio" },
    careerStartAge: 20,
    careerStages: ["sign painter", "gallery assistant", "freelance illustrator", "muralist", "studio teacher"],
    transitions: { "freelance illustrator": "left the gallery to work as a", "studio teacher": "added teaching to her work and became a" },
    ladder: ["Muralist and studio teacher", "Lead muralist for the town", "Director of Juniper Studio", "Founder of the Juniper shared studio"],
    historyTracks: ["career", "marriage", "parenting", "creative"]
  },
  finn: {
    name: "Finn", born: "1958-03-30", role: "Retired carpenter and town mentor",
    summary: "A quiet retired carpenter whose best stories arrive halfway through helping someone repair something.",
    likes: ["hand tools", "early mornings", "birdhouses", "teaching patiently"],
    dislikes: ["rushed repairs", "throwing useful things away", "loud arguments"],
    values: ["patience", "durability", "keeping promises"],
    goals: ["finish a community bench", "pass on every useful shop trick", "catalog the workshop tools"],
    family: [{ id: "milo", type: "son" }, { id: "zara", type: "daughter-in-law" }, { id: "nova", type: "grandchild" }],
    career: { kind: "retired", title: "Retired master carpenter", level: 6, organization: "Living Town Workshop" },
    careerStartAge: 18,
    careerStages: ["site foreman", "workshop owner", "retired master carpenter"],
    transitions: { "retired master carpenter": "handed over the workshop keys and became a" },
    historyTracks: ["career", "family", "mentoring", "craft"]
  },
  nova: {
    name: "Nova", born: "2007-02-14", role: "Market assistant and design student",
    summary: "A playful young designer balancing a first real job with ambitious ideas and a famously unfinished sketchbook.",
    likes: ["poster design", "night markets", "inventing games", "spicy snacks"],
    dislikes: ["early alarms", "being underestimated", "blank application forms"],
    values: ["originality", "friendship", "freedom"],
    goals: ["design the town festival poster", "earn a first promotion", "complete a public art project"],
    family: [{ id: "milo", type: "father" }, { id: "zara", type: "mother" }, { id: "finn", type: "grandfather" }],
    career: { kind: "work-study", level: 2, organization: "Corner Market" },
    careerStartAge: 14,
    careerStages: ["neighborhood helper", "festival volunteer", "stock assistant", "market assistant"],
    ladder: ["Market assistant", "Senior market assistant", "Market shift lead", "Market display designer"],
    historyTracks: ["school", "first-jobs", "friendship", "creative"]
  }
};

const moments = {
  toddler: [
    "took a first wobbly step toward the family dog",
    "said a first word that everyone argued about",
    "fell asleep in the middle of a birthday party",
    "discovered that pots and spoons make an excellent drum kit",
    "laughed at a pigeon until everyone else laughed too"
  ],
  child: [
    "turned a cardboard box into the centerpiece of an adventure",
    "made a new friend by inviting someone into a game",
    "learned a new skill after insisting on doing it without help",
    "asked a question that made an adult reconsider the answer",
    "rescued a bug everyone else was trying to avoid"
  ],
  animals: [
    "spent a whole afternoon following a duck family around the pond",
    "learned the names of every dog on the street",
    "built a very serious hotel for garden snails",
    "helped a neighbor look for a runaway cat and found it asleep in a box"
  ],
  school: [
    "finished a project that looked impossible at first",
    "helped a classmate understand a difficult lesson",
    "had to redo an assignment and made the second version better",
    "discovered a subject worth learning more about",
    "spoke up even though being quiet would have been easier"
  ],
  friendship: [
    "stuck by a friend during a hard month",
    "patched up a falling-out with a long, honest walk",
    "started a club that met exactly three times and was still worth it",
    "found a friend in someone who seemed completely different at first"
  ],
  family: [
    "started a family tradition after an ordinary day became memorable",
    "learned that an apology works better when it includes changed behavior",
    "helped during a stressful week and became someone the family could count on",
    "kept a promise that mattered more than expected",
    "turned a small disagreement into a better understanding"
  ],
  marriage: [
    "planned a surprise anniversary picnic that got rained on and was perfect anyway",
    "learned to split the chores in a way that actually stuck",
    "took a long-overdue trip away together"
  ],
  parenting: [
    "stayed up late helping with a school project that became a family legend",
    "learned to listen first and fix things second",
    "taught a first bike ride with far too much running alongside"
  ],
  work: [
    "solved a customer problem nobody had diagnosed correctly",
    "made a mistake, admitted it quickly, and repaired the damage",
    "trained a nervous new coworker who later became dependable",
    "handled a chaotic day without taking the stress out on anyone",
    "proposed a small process change that saved hours of work",
    "stood up for quality when rushing would have been easier",
    "earned trust by finishing an unpleasant job properly"
  ],
  creative: [
    "made something strange that eventually became a favorite",
    "abandoned a safe idea and tried the more interesting one",
    "shared unfinished work and received useful advice",
    "learned a new technique through several ugly attempts",
    "found inspiration in an overlooked corner of town"
  ],
  community: [
    "volunteered when an event was short-handed",
    "helped repair something everyone used",
    "welcomed a newcomer who did not know anybody",
    "organized neighbors around a simple shared problem",
    "quietly returned something valuable its owner had lost"
  ],
  problem: [
    "traced a stubborn fault to one loose connection",
    "fixed a neighbor's heater before the cold snap",
    "turned a pile of spare parts into something genuinely useful"
  ],
  mentoring: [
    "showed a nervous beginner how to sharpen a chisel properly",
    "told a story about an old job that turned out to be exactly the advice someone needed",
    "spent the morning fixing a wobbly chair with a young helper"
  ]
};

const challenges = [
  "a plan fell apart at the last minute",
  "two responsibilities landed on the same day",
  "a friend misunderstood a kind gesture",
  "the first solution failed",
  "being right and being helpful pulled in different directions"
];

const kidSetbacks = [
  "a spelling test did not go the way it was supposed to",
  "a favorite toy went missing for most of the afternoon",
  "a game ended in an argument about the rules",
  "a drawing got smudged right before it was finished"
];

const trackMoments = {
  school: "school", play: "child", animals: "animals", friendship: "friendship", family: "family",
  marriage: "marriage", parenting: "parenting", career: "work", "first-jobs": "work",
  creative: "creative", craft: "creative", community: "community", mentoring: "mentoring",
  "problem-solving": "problem"
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seedText) {
  let state = hashString(seedText) || 1;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rng = random) {
  return list[Math.floor(rng() * list.length)];
}

function ageAt(profile, when) {
  const born = new Date(`${profile.born}T00:00:00`);
  const date = new Date(when);
  let age = date.getFullYear() - born.getFullYear();
  if (date.getMonth() < born.getMonth() || (date.getMonth() === born.getMonth() && date.getDate() < born.getDate())) age -= 1;
  return age;
}

function lifeStageFor(age) {
  if (age < 13) return "child";
  if (age < 18) return "teen";
  if (age < 25) return "young-adult";
  if (age < 65) return "adult";
  return "senior";
}

function birthYear(profile) { return Number(profile.born.slice(0, 4)); }

function historyYearsFor(id) {
  const profile = profiles[id];
  if (!profile || profile.noHistory) return 0;
  return Math.min(HISTORY_YEARS, HISTORY_ANCHOR_YEAR - birthYear(profile));
}

function buildHistory(id) {
  const profile = profiles[id];
  const rng = seededRandom(`living-town-history-v${HISTORY_VERSION}:${id}`);
  const years = historyYearsFor(id);
  const firstYear = HISTORY_ANCHOR_YEAR - years;
  const startAge = profile.careerStartAge ?? Infinity;
  const workYears = [];
  for (let year = firstYear; year < HISTORY_ANCHOR_YEAR; year++) if (year - birthYear(profile) >= startAge) workYears.push(year);
  const stages = profile.careerStages || [];
  const stageForYear = year => {
    const index = workYears.indexOf(year);
    return index < 0 || !stages.length ? -1 : Math.floor(index * stages.length / workYears.length);
  };

  const history = [];
  for (let year = firstYear; year < HISTORY_ANCHOR_YEAR; year++) {
    const age = year - birthYear(profile);
    const stage = stageForYear(year);
    const working = stage >= 0;
    const tracks = profile.historyTracks.filter(track => {
      if (track === "career" || track === "first-jobs") return working;
      if (track === "marriage" || track === "parenting") return age >= 25;
      return true;
    });
    const chapter = age <= 3 ? "early-years" : pick(tracks.length ? tracks : ["family"], rng);
    const pool = age <= 3 ? moments.toddler
      : age < 10 && (chapter === "play" || chapter === "school") ? moments.child
      : moments[trackMoments[chapter]] || moments.family;
    const title = working ? stages[stage] : null;
    const promotedThisYear = working && stage > 0 && stageForYear(year - 1) !== stage;

    for (let index = 0; index < 3; index++) {
      const base = pick(pool, rng);
      let text;
      let type = chapter;
      if (promotedThisYear && index === 0) {
        const previous = stages[stage - 1];
        const verb = profile.transitions?.[title];
        text = verb
          ? `${profile.name} ${verb} ${title}, moving on from ${previous}.`
          : `${profile.name} earned a promotion from ${previous} to ${title} after proving ready for more responsibility.`;
        type = /retired/.test(title) ? "retirement" : "promotion";
      } else if (working && (chapter === "career" || chapter === "first-jobs") && index === 0) {
        text = `While working as ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}, ${profile.name} ${base}.`;
      } else if (index === 2 && age > 5) {
        text = `${profile.name} had a year when ${pick(challenges, rng)}, and still ${base}.`;
      } else {
        text = `${profile.name} ${base}.`;
      }
      history.push({ id: `${id}-history-${year}-${index}`, year, age, type, text, shareable: true });
    }
  }
  return history;
}

function careerTitle(profile, career) {
  if (profile.ladder) return profile.ladder[Math.min(career.rank || 0, profile.ladder.length - 1)];
  return profile.career.title;
}

function profileSnapshot(profile, now) {
  const age = ageAt(profile, now);
  return {
    age,
    born: profile.born,
    lifeStage: lifeStageFor(age),
    role: profile.role,
    summary: profile.summary,
    likes: [...profile.likes],
    dislikes: [...profile.dislikes],
    values: [...profile.values],
    family: profile.family.map(link => ({ ...link }))
  };
}

function newGoal(text, now, source = "profile") {
  return { text, source, progress: 0, completed: false, startedAt: now };
}

function nextGoalText(profile, resident) {
  const used = new Set(resident.goals.map(goal => goal.text));
  const fromProfile = profile.goals.find(goal => !used.has(goal));
  if (fromProfile) return fromProfile;
  const ideas = profile.likes.flatMap(like => [`get noticeably better at ${like}`, `share ${like} with someone new`]);
  const fresh = ideas.filter(idea => !used.has(idea));
  // Once everything has been tried, recycle the least recent idea instead
  // of generating ever-longer derived text.
  return fresh.length ? pick(fresh) : pick(ideas);
}

function ownFacts(resident) {
  const facts = (resident.lifeHistory || []).map(event => ({ factId: event.id, text: event.text, at: null }));
  for (const experience of resident.experiences || []) {
    facts.push({ factId: `${resident.id}-experience-${experience.id}`, text: experience.text, at: experience.at });
  }
  return facts;
}

function ensureResidentLife(resident, now = Date.now()) {
  const profile = profiles[resident.id];
  if (!profile) return resident;
  resident.name = profile.name;
  resident.profile = profileSnapshot(profile, now);
  resident.lastKnownAge = Number.isInteger(resident.lastKnownAge) ? resident.lastKnownAge : resident.profile.age;

  const expected = historyYearsFor(resident.id) * 3;
  if (resident.historyVersion !== HISTORY_VERSION || !Array.isArray(resident.lifeHistory) || resident.lifeHistory.length !== expected) {
    resident.lifeHistory = buildHistory(resident.id);
    resident.historyVersion = HISTORY_VERSION;
  }

  // Keep earned rank and progress; only fill in what is missing.
  const saved = resident.career && typeof resident.career === "object" ? resident.career : {};
  const career = {
    kind: profile.career.kind,
    organization: profile.career.organization,
    rank: Number.isInteger(saved.rank) ? saved.rank : 0,
    progress: Number(saved.progress) || 0,
    successes: Number(saved.successes) || 0,
    setbacks: Number(saved.setbacks) || 0
  };
  if (profile.career.kind === "retired") career.progress = 0;
  career.level = profile.career.level + career.rank;
  career.title = careerTitle(profile, career);
  resident.career = career;

  resident.experiences = Array.isArray(resident.experiences) ? resident.experiences : [];
  resident.memories = Array.isArray(resident.memories) ? resident.memories : [];
  // Knowledge holds only facts learned from other people. A resident's own
  // history and experiences are derived, so they can never be forgotten.
  resident.knowledge = (Array.isArray(resident.knowledge) ? resident.knowledge : [])
    .filter(fact => fact && fact.learnedFrom !== "self" && fact.subjectId !== resident.id)
    .slice(-MAX_LEARNED);
  if (!Number.isInteger(resident.lifeRevision)) resident.lifeRevision = 1;

  if (!Array.isArray(resident.goals) || resident.goals.length === 0) resident.goals = [newGoal(profile.goals[0], now)];
  resident.goals = resident.goals.filter(goal => goal && typeof goal.text === "string" && goal.text.length < 120);
  if (!resident.goals.some(goal => !goal.completed)) resident.goals.push(newGoal(nextGoalText(profile, resident), now));
  const completed = resident.goals.filter(goal => goal.completed).slice(-MAX_COMPLETED_GOALS);
  resident.goals = [...completed, ...resident.goals.filter(goal => !goal.completed).slice(0, 1)];

  const mood = resident.mood && typeof resident.mood === "object" ? resident.mood : {};
  resident.mood = {
    label: typeof mood.label === "string" ? mood.label : "content",
    valence: Number.isFinite(mood.valence) ? mood.valence : 60,
    stress: Number.isFinite(mood.stress) ? mood.stress : 20,
    reason: typeof mood.reason === "string" ? mood.reason : "settling into the day"
  };
  if (!resident.autonomy || typeof resident.autonomy !== "object") {
    const rng = seededRandom(`${resident.id}:${now}:autonomy`);
    resident.autonomy = { nextEventAt: now + (EVENT_GAP_MIN * rng() + 2) * 60_000, eventCount: 0 };
  }
  return resident;
}

function hydrateLifeState(state, now = Date.now()) {
  for (const resident of state.residents) ensureResidentLife(resident, now);
  const historyById = new Map(state.residents
    .filter(resident => Array.isArray(resident.lifeHistory))
    .map(resident => [resident.id, new Map(resident.lifeHistory.map(event => [event.id, event]))]));
  for (const resident of state.residents) {
    if (!Array.isArray(resident.knowledge)) continue;
    const seen = new Set();
    resident.knowledge = resident.knowledge.filter(fact => {
      if (typeof fact.factId !== "string" || seen.has(fact.factId)) return false;
      seen.add(fact.factId);
      const history = historyById.get(fact.subjectId);
      if (!history || !fact.factId.startsWith(`${fact.subjectId}-history-`)) return true;
      const event = history.get(fact.factId);
      if (!event) return false; // obsolete fact from an older history version
      fact.text = event.text; // keep learned copies in sync with corrected history
      return true;
    });
  }
  state.lifeEngine = { version: 3, historyVersion: HISTORY_VERSION, historyAnchorYear: HISTORY_ANCHOR_YEAR, lastProcessedAt: now };
  return state;
}

function moodFrom(valence, stress) {
  if (stress > 72) return "overwhelmed";
  if (valence > 80) return "delighted";
  if (valence > 64) return "happy";
  if (valence < 32) return "discouraged";
  if (stress > 52) return "tense";
  if (valence < 45) return "low";
  return "content";
}

/**
 * Pull mood back toward a personal baseline over time. `temperament` is the
 * resident's neuroticism (0–1): anxious residents rest at a lower, more
 * stressed baseline and feel low needs more sharply.
 */
function tickMood(resident, dtHours, temperament = 0.4) {
  const mood = resident.mood;
  if (!mood || dtHours <= 0) return;
  const baseValence = 70 - temperament * 22;
  const baseStress = 12 + temperament * 22;
  mood.valence += (baseValence - mood.valence) * Math.min(1, dtHours * 0.8);
  mood.stress += (baseStress - mood.stress) * Math.min(1, dtHours * 0.7);
  for (const value of Object.values(resident.needs || {})) {
    if (value < 25) mood.stress += dtHours * (3 + temperament * 6);
    if (value < 15) mood.valence -= dtHours * 4;
  }
  mood.valence = clamp(mood.valence, 0, 100);
  mood.stress = clamp(mood.stress, 0, 100);
  mood.label = moodFrom(mood.valence, mood.stress);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function familyMember(state, resident) {
  const links = resident.profile?.family || [];
  const present = links.map(link => ({ link, person: state.residents.find(other => other.id === link.id) })).filter(item => item.person);
  if (!present.length) return null;
  const { link, person } = pick(present);
  return { name: person.name, relationship: link.type };
}

function pushExperience(resident, experience) {
  resident.experiences.unshift(experience);
  resident.experiences = resident.experiences.slice(0, MAX_EXPERIENCES);
  resident.memories.unshift({ at: experience.at, about: resident.id, text: experience.text, type: experience.type });
  resident.memories = resident.memories.slice(0, MAX_MEMORIES);
  resident.lifeRevision += 1;
}

function weightedPick(options) {
  const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
  let roll = random() * total;
  for (const option of options) {
    roll -= Math.max(0, option.weight);
    if (roll <= 0) return option;
  }
  return options[options.length - 1];
}

/**
 * One autonomous life event. `traits` (optional) is the resident's
 * personality from the mind module; it shapes which kinds of events happen
 * and how strongly they land.
 */
function runAutonomousExperience(state, resident, now = Date.now(), quiet = false, traits = {}) {
  const profile = profiles[resident.id];
  if (!profile) return null;
  const O = traits.openness ?? 0.5, C = traits.conscientiousness ?? 0.5, E = traits.extraversion ?? 0.5;
  const A = traits.agreeableness ?? 0.5, N = traits.neuroticism ?? 0.4;
  const stage = resident.profile?.lifeStage || "adult";
  const isMinor = stage === "child" || stage === "teen";
  const retired = resident.career?.kind === "retired";
  const working = ["work", "work-study"].includes(resident.career?.kind);
  const family = familyMember(state, resident);

  const options = [
    { kind: "family", weight: family ? 0.18 * (0.6 + A) : 0 },
    { kind: isMinor ? (stage === "child" ? "play" : "school") : "none", weight: isMinor ? 0.45 : 0 },
    { kind: "career", weight: working && !isMinor ? 0.35 * (0.6 + C) : 0 },
    { kind: "mentoring", weight: retired ? 0.3 : 0 },
    { kind: "interest", weight: 0.22 * (0.5 + O) },
    { kind: "community", weight: 0.12 * (0.4 + E + A) }
  ];
  const kind = weightedPick(options).kind;

  let type = kind;
  let text;
  let valenceDelta = 5;
  let stressDelta = -2;
  let goalDelta = 4;

  if (kind === "family") {
    text = `${resident.name} spent time with ${family.name}, their ${family.relationship}, and ${pick(moments.family)}.`;
    valenceDelta = 7 + A * 3;
    goalDelta = 2;
  } else if (kind === "play" || kind === "school") {
    if (random() < 0.12 + N * 0.12) {
      text = `${resident.name} had a rough moment when ${pick(kidSetbacks)}, then bounced back.`;
      valenceDelta = -3 - N * 4;
      stressDelta = 5 + N * 6;
      goalDelta = 1;
    } else {
      text = `${resident.name} ${pick(kind === "play" ? moments.child : moments.school)}.`;
      valenceDelta = 6;
      goalDelta = 6;
    }
  } else if (kind === "career") {
    if (random() < 0.62 + C * 0.25) {
      text = `At ${resident.career.organization}, ${resident.name} ${pick(moments.work)}.`;
      resident.career.successes += 1;
      resident.career.progress += 5 + C * 4;
      valenceDelta = 6;
      goalDelta = 5;
    } else {
      text = `At ${resident.career.organization}, ${resident.name} ran into trouble when ${pick(challenges)}. ${resident.name} worked out what to try differently next time.`;
      resident.career.setbacks += 1;
      resident.career.progress += 2;
      valenceDelta = -4 - N * 6;
      stressDelta = 6 + N * 10;
      goalDelta = 2;
    }
  } else if (kind === "mentoring") {
    text = `${resident.name} ${pick([...moments.mentoring, ...moments.creative])}.`;
    valenceDelta = 7;
    goalDelta = 5;
  } else if (kind === "interest") {
    text = `${resident.name} made time for ${pick(profile.likes)} and came away with a new idea.`;
    valenceDelta = 5 + O * 3;
    goalDelta = 5;
  } else {
    text = `${resident.name} ${pick(moments.community)}.`;
    valenceDelta = 5;
    goalDelta = 3;
  }

  let activeGoal = resident.goals.find(goal => !goal.completed);
  if (!activeGoal) {
    activeGoal = newGoal(nextGoalText(profile, resident), now);
    resident.goals.push(activeGoal);
  }
  activeGoal.progress = Math.min(100, activeGoal.progress + goalDelta * (0.7 + C * 0.6));
  if (activeGoal.progress >= 100) {
    activeGoal.completed = true;
    activeGoal.completedAt = now;
    text += ` This completed the goal to ${activeGoal.text}.`;
    valenceDelta += 8;
    resident.goals.push(newGoal(nextGoalText(profile, resident), now));
    const completed = resident.goals.filter(goal => goal.completed).slice(-MAX_COMPLETED_GOALS);
    resident.goals = [...completed, ...resident.goals.filter(goal => !goal.completed)];
  }

  let promoted = false;
  if (profile.ladder && !isMinor && !retired && resident.career.progress >= 100) {
    resident.career.progress -= 100;
    if (resident.career.rank < profile.ladder.length - 1) {
      resident.career.rank += 1;
      resident.career.level = profile.career.level + resident.career.rank;
      resident.career.title = careerTitle(profile, resident.career);
      text += ` The steady work earned a step up: ${resident.career.title}.`;
      type = "promotion";
      promoted = true;
      valenceDelta += 10;
    }
  }

  resident.mood.valence = clamp(resident.mood.valence + valenceDelta * MOOD_IMPACT, 0, 100);
  resident.mood.stress = clamp(resident.mood.stress + stressDelta * MOOD_IMPACT, 0, 100);
  resident.mood.label = moodFrom(resident.mood.valence, resident.mood.stress);
  resident.mood.reason = text;
  // A life moment shows for a little while, then they go back to what they
  // were doing (a shift at the cafe, a show in the square).
  if (!resident.activityAfter) resident.activityAfter = resident.activity || null;
  resident.activity = kind === "career" || promoted ? "handling a work situation"
    : kind === "family" ? "having family time"
    : kind === "mentoring" ? "helping someone at the workbench"
    : "following a personal interest";
  resident.activityUntil = now + 45_000;
  const experience = { id: `${now}-${resident.autonomy.eventCount++}`, at: now, type, text, place: resident.place, promoted };
  pushExperience(resident, experience);
  resident.autonomy.nextEventAt = now + (EVENT_GAP_MIN + random() * EVENT_GAP_SPREAD) * 60_000;
  return quiet ? null : text;
}

/** `a` learns one fact about `b` from `b`. Recent experiences are favoured. */
function shareKnowledge(a, b, now = Date.now()) {
  const known = new Set(a.knowledge.map(fact => fact.factId));
  const candidates = ownFacts(b).filter(fact => !known.has(fact.factId));
  if (candidates.length === 0) return null;
  const recent = candidates.filter(fact => fact.at !== null);
  const pool = recent.length && random() < 0.6 ? recent.slice(0, 10) : candidates;
  const source = pick(pool);
  const learned = { factId: source.factId, subjectId: b.id, text: source.text, learnedFrom: b.id, learnedAt: now };
  a.knowledge.push(learned);
  a.knowledge = a.knowledge.slice(-MAX_LEARNED);
  a.lifeRevision += 1;
  return learned;
}

/**
 * Experiences for the time the server was down: one per eight hours per
 * resident (max twelve), spread evenly across the outage.
 */
function offlineEventCount(elapsedHours) {
  return Math.min(12, Math.floor(elapsedHours / 8));
}

function runOfflineLife(state, elapsedHours, now = Date.now(), traitsFor = () => ({})) {
  const count = offlineEventCount(elapsedHours);
  if (count <= 0) return 0;
  const start = now - elapsedHours * 3_600_000;
  const step = (now - start) / (count + 1);
  for (const resident of state.residents) {
    for (let index = 1; index <= count; index++) {
      runAutonomousExperience(state, resident, Math.round(start + step * index), true, traitsFor(resident.id));
    }
    if (resident.autonomy) resident.autonomy.nextEventAt = now + (EVENT_GAP_MIN + random() * EVENT_GAP_SPREAD) * 60_000;
    resident.activityUntil = 0;
  }
  return count;
}

/** Returns birthday announcements for anyone whose age ticked over. */
function checkBirthdays(state, now) {
  const texts = [];
  for (const resident of state.residents) {
    const profile = profiles[resident.id];
    if (!profile) continue;
    const age = ageAt(profile, now);
    if (age > resident.lastKnownAge) {
      resident.lastKnownAge = age;
      resident.profile = profileSnapshot(profile, now);
      resident.mood.valence = clamp(resident.mood.valence + 15, 0, 100);
      pushExperience(resident, { id: `${now}-birthday`, at: now, type: "birthday", text: `${resident.name} turned ${age} today.`, place: resident.place, promoted: false });
      texts.push(`It's ${resident.name}'s birthday. ${resident.name} is ${age} today.`);
    }
  }
  return texts;
}

/** Add or replace a character profile at runtime (custom residents). */
function registerProfile(id, profile) { profiles[id] = profile; }
function unregisterProfile(id) { delete profiles[id]; }

module.exports = {
  pushExperience,
  registerProfile,
  unregisterProfile,
  HISTORY_YEARS,
  HISTORY_ANCHOR_YEAR,
  DAY_MS,
  profiles,
  ageAt,
  historyYearsFor,
  buildHistory,
  hydrateLifeState,
  ensureResidentLife,
  runAutonomousExperience,
  runOfflineLife,
  offlineEventCount,
  shareKnowledge,
  tickMood,
  checkBirthdays,
  moodFrom,
  setRandom
};
