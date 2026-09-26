"use strict";

const HISTORY_YEARS = 10;
const MAX_KNOWLEDGE = 180;
const MAX_EXPERIENCES = 120;

const profiles = {
  olive: {
    name: "Olive", age: 15, lifeStage: "teen", role: "Student and storyteller",
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
    name: "Hazel", age: 7, lifeStage: "child", role: "Student and fearless explorer",
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
    name: "Sean", age: 38, lifeStage: "adult", role: "Independent systems contractor",
    summary: "A practical problem-solver building a business while trying to remain present for Olive and Hazel.",
    likes: ["fixing difficult problems", "old games", "building useful things", "quiet drives"],
    dislikes: ["dishonesty", "wasted effort", "unlabeled wiring"],
    values: ["family", "transparency", "craftsmanship"],
    goals: ["build a dependable local business", "teach the girls how to make things", "improve the town workshop"],
    family: [{ id: "olive", type: "daughter" }, { id: "hazel", type: "daughter" }],
    career: { kind: "work", title: "Independent systems contractor", level: 5, organization: "Sean's Systems" },
    careerStages: ["service technician", "lead installer", "project manager", "operations manager", "independent systems contractor"],
    historyTracks: ["career", "family", "problem-solving", "community"]
  },
  milo: {
    name: "Milo", age: 44, lifeStage: "adult", role: "Manager of Moonbeam Cafe",
    summary: "A sociable café manager who remembers everyone's order and quietly keeps half the town connected.",
    likes: ["new recipes", "busy mornings", "local gossip", "jazz records"],
    dislikes: ["wasted food", "cold coffee", "unnecessary grudges"],
    values: ["hospitality", "patience", "community"],
    goals: ["publish a town recipe book", "train a future café manager", "host a perfect block breakfast"],
    family: [{ id: "zara", type: "spouse" }, { id: "nova", type: "child" }, { id: "finn", type: "father" }],
    career: { kind: "work", title: "Cafe manager", level: 5, organization: "Moonbeam Cafe" },
    careerStages: ["dishwasher", "prep cook", "barista", "shift lead", "cafe manager"],
    historyTracks: ["career", "marriage", "parenting", "community"]
  },
  zara: {
    name: "Zara", age: 42, lifeStage: "adult", role: "Muralist and studio teacher",
    summary: "A working artist who paints public spaces, teaches patient beginners, and sees possibilities in blank walls.",
    likes: ["bold colors", "thrift-store frames", "teaching", "rainy studio days"],
    dislikes: ["beige walls", "careless criticism", "paint drying too fast"],
    values: ["creativity", "generosity", "courage"],
    goals: ["paint a town history mural", "open a shared studio", "help Nova finish a first major project"],
    family: [{ id: "milo", type: "spouse" }, { id: "nova", type: "child" }, { id: "finn", type: "father-in-law" }],
    career: { kind: "work", title: "Muralist and studio teacher", level: 5, organization: "Juniper Studio" },
    careerStages: ["sign painter", "gallery assistant", "freelance illustrator", "muralist", "studio teacher"],
    historyTracks: ["career", "marriage", "parenting", "creative"]
  },
  finn: {
    name: "Finn", age: 68, lifeStage: "senior", role: "Retired carpenter and town mentor",
    summary: "A quiet retired carpenter whose best stories arrive halfway through helping someone repair something.",
    likes: ["hand tools", "early mornings", "birdhouses", "teaching patiently"],
    dislikes: ["rushed repairs", "throwing useful things away", "loud arguments"],
    values: ["patience", "durability", "keeping promises"],
    goals: ["finish a community bench", "pass on every useful shop trick", "catalog the workshop tools"],
    family: [{ id: "milo", type: "son" }, { id: "zara", type: "daughter-in-law" }, { id: "nova", type: "grandchild" }],
    career: { kind: "retired", title: "Retired master carpenter", level: 6, organization: "Living Town Workshop" },
    careerStages: ["carpenter's apprentice", "cabinetmaker", "site foreman", "workshop owner", "retired master carpenter"],
    historyTracks: ["career", "family", "mentoring", "craft"]
  },
  nova: {
    name: "Nova", age: 19, lifeStage: "young-adult", role: "Market assistant and design student",
    summary: "A playful young designer balancing a first real job with ambitious ideas and a famously unfinished sketchbook.",
    likes: ["poster design", "night markets", "inventing games", "spicy snacks"],
    dislikes: ["early alarms", "being underestimated", "blank application forms"],
    values: ["originality", "friendship", "freedom"],
    goals: ["design the town festival poster", "earn a first promotion", "complete a public art project"],
    family: [{ id: "milo", type: "father" }, { id: "zara", type: "mother" }, { id: "finn", type: "grandfather" }],
    career: { kind: "work-study", title: "Market assistant", level: 2, organization: "Corner Market" },
    careerStages: ["neighborhood helper", "festival volunteer", "stock assistant", "market assistant"],
    historyTracks: ["school", "first-jobs", "friendship", "creative"]
  }
};

const schoolMoments = [
  "finished a project that looked impossible at first",
  "helped a classmate understand a difficult lesson",
  "had to redo an assignment and made the second version better",
  "discovered a subject worth learning more about",
  "spoke up even though being quiet would have been easier"
];
const familyMoments = [
  "started a family tradition after an ordinary day became memorable",
  "learned that an apology works better when it includes changed behavior",
  "helped during a stressful week and became someone the family could count on",
  "kept a promise that mattered more than expected",
  "turned a small disagreement into a better understanding"
];
const workMoments = [
  "solved a customer problem nobody had diagnosed correctly",
  "made a mistake, admitted it quickly, and repaired the damage",
  "trained a nervous new coworker who later became dependable",
  "handled a chaotic day without taking the stress out on anyone",
  "proposed a small process change that saved hours of work",
  "stood up for quality when rushing would have been easier",
  "earned trust by finishing an unpleasant job properly"
];
const creativeMoments = [
  "made something strange that eventually became a favorite",
  "abandoned a safe idea and tried the more interesting one",
  "shared unfinished work and received useful advice",
  "learned a new technique through several ugly attempts",
  "found inspiration in an overlooked corner of town"
];
const communityMoments = [
  "volunteered when an event was short-handed",
  "helped repair something everyone used",
  "welcomed a newcomer who did not know anybody",
  "organized neighbors around a simple shared problem",
  "quietly returned something valuable its owner had lost"
];
const childMoments = [
  "turned a cardboard box into the centerpiece of an adventure",
  "made a new friend by inviting someone into a game",
  "learned a new skill after insisting on doing it without help",
  "asked a question that made an adult reconsider the answer",
  "rescued a bug everyone else was trying to avoid"
];
const challenges = [
  "a plan fell apart at the last minute",
  "two responsibilities landed on the same day",
  "someone misunderstood their intentions",
  "the first solution failed",
  "they had to choose between being right and being helpful"
];

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

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function historyYearsFor(id) {
  return id === "hazel" ? 7 : HISTORY_YEARS;
}

function buildHistory(id, now = Date.now()) {
  const profile = profiles[id];
  const random = seededRandom(`living-town-0.3:${id}`);
  const currentYear = new Date(now).getFullYear();
  const history = [];
  const tracks = profile.historyTracks;
  const historyYears = historyYearsFor(id);
  for (let offset = historyYears; offset >= 1; offset--) {
    const year = currentYear - offset;
    const age = profile.age - offset;
    const familyContext = age < 0;
    const chapter = familyContext ? "family-context" : pick(tracks.filter(track => track !== "family-context"), random);
    const moments = familyContext ? familyMoments
      : profile.lifeStage === "child" ? childMoments
      : chapter === "career" || chapter === "first-jobs" ? workMoments
      : chapter === "creative" || chapter === "craft" ? creativeMoments
      : chapter === "school" ? schoolMoments
      : chapter === "community" || chapter === "mentoring" ? communityMoments
      : familyMoments;
    const eventCount = 3;
    for (let index = 0; index < eventCount; index++) {
      const stageIndex = profile.careerStages
        ? Math.min(profile.careerStages.length - 1, Math.max(0, Math.floor((historyYears - offset) / 2)))
        : null;
      const careerTitle = stageIndex === null ? profile.career.title : profile.careerStages[stageIndex];
      const base = pick(moments, random);
      const challenge = pick(challenges, random);
      let text;
      let eventType = chapter;
      if (familyContext) {
        text = `Before ${profile.name} was born, the family ${base}. This became part of the story ${profile.name} grew up hearing.`;
      } else if (profile.careerStages && index === 0 && stageIndex > 0 && (historyYears - offset) % 2 === 0) {
        const previousTitle = profile.careerStages[stageIndex - 1];
        text = `${profile.name} earned a promotion from ${previousTitle} to ${careerTitle} after proving ready for more responsibility.`;
        eventType = "promotion";
      } else if ((chapter === "career" || chapter === "first-jobs") && index === 0) {
        text = `While working as ${careerTitle}, ${profile.name} ${base}.`;
      } else if (index === 2) {
        text = `${profile.name} faced a year when ${challenge}; ${base}.`;
      } else {
        text = `${profile.name} ${base}.`;
      }
      history.push({
        id: `${id}-history-${year}-${index}`,
        year,
        age: familyContext ? null : age,
        type: eventType,
        text,
        shareable: true
      });
    }
  }
  return history;
}

function initialGoal(profile) {
  return { text: profile.goals[0], progress: 5, completed: false, startedAt: Date.now() };
}

function ensureResidentLife(resident, now = Date.now()) {
  const profile = profiles[resident.id];
  if (!profile) return resident;
  resident.name = profile.name;
  resident.profile = {
    age: profile.age,
    lifeStage: profile.lifeStage,
    role: profile.role,
    summary: profile.summary,
    likes: [...profile.likes],
    dislikes: [...profile.dislikes],
    values: [...profile.values],
    family: profile.family.map(link => ({ ...link }))
  };
  const expectedHistoryCount = historyYearsFor(resident.id) * 3;
  if (resident.historyVersion !== 2 || !Array.isArray(resident.lifeHistory) || resident.lifeHistory.length !== expectedHistoryCount) {
    resident.lifeHistory = buildHistory(resident.id, now);
    resident.historyVersion = 2;
  }
  if (!resident.career || typeof resident.career !== "object") {
    resident.career = { ...profile.career, progress: 0, successes: 0, setbacks: 0 };
  } else {
    resident.career = { ...profile.career, progress: resident.career.progress || 0, successes: resident.career.successes || 0, setbacks: resident.career.setbacks || 0 };
  }
  if (!Array.isArray(resident.knowledge)) resident.knowledge = [];
  const knownIds = new Set(resident.knowledge.map(fact => fact.factId));
  for (const event of resident.lifeHistory) {
    if (knownIds.has(event.id)) continue;
    resident.knowledge.push({ factId: event.id, subjectId: resident.id, text: event.text, learnedFrom: "self", learnedAt: now });
  }
  resident.knowledge = resident.knowledge.slice(-MAX_KNOWLEDGE);
  if (!Array.isArray(resident.experiences)) resident.experiences = [];
  if (!Number.isInteger(resident.lifeRevision)) resident.lifeRevision = 1;
  if (!Array.isArray(resident.goals) || resident.goals.length === 0) resident.goals = [initialGoal(profile)];
  if (!resident.mood || typeof resident.mood !== "object") resident.mood = { label: "content", valence: 60, stress: 20, energy: 65, reason: "settling into the day" };
  if (!resident.autonomy || typeof resident.autonomy !== "object") {
    const random = seededRandom(`${resident.id}:${now}:autonomy`);
    resident.autonomy = { nextEventAt: now + (2 + random() * 4) * 60_000, eventCount: 0 };
  }
  return resident;
}

function hydrateLifeState(state, now = Date.now()) {
  for (const resident of state.residents) ensureResidentLife(resident, now);
  const validHistoryFacts = new Map(state.residents
    .filter(resident => Array.isArray(resident.lifeHistory))
    .map(resident => [resident.id, new Set(resident.lifeHistory.map(event => event.id))]));
  for (const resident of state.residents) {
    if (!Array.isArray(resident.knowledge)) continue;
    resident.knowledge = resident.knowledge.filter(fact => {
      const validFacts = validHistoryFacts.get(fact.subjectId);
      if (!validFacts || typeof fact.factId !== "string") return true;
      const historyPrefix = `${fact.subjectId}-history-`;
      return !fact.factId.startsWith(historyPrefix) || validFacts.has(fact.factId);
    });
  }
  state.lifeEngine = { version: 2, defaultHistoryYears: HISTORY_YEARS, residentHistoryYears: { hazel: 7 }, lastProcessedAt: now };
  return state;
}

function familyName(state, resident) {
  const links = resident.profile?.family || [];
  if (links.length === 0) return null;
  const link = links[Math.floor(Math.random() * links.length)];
  const person = state.residents.find(other => other.id === link.id);
  return person ? { name: person.name, relationship: link.type } : null;
}

function moodFrom(valence, stress) {
  if (stress > 72) return "overwhelmed";
  if (valence > 78) return "delighted";
  if (valence > 62) return "happy";
  if (valence < 32) return "discouraged";
  if (stress > 52) return "tense";
  return "content";
}

function pushExperience(resident, experience) {
  resident.experiences.unshift(experience);
  resident.experiences = resident.experiences.slice(0, MAX_EXPERIENCES);
  resident.memories.unshift({ at: experience.at, about: resident.id, text: experience.text, type: experience.type });
  resident.memories = resident.memories.slice(0, 120);
  const factId = `${resident.id}-experience-${experience.id}`;
  resident.knowledge.push({ factId, subjectId: resident.id, text: experience.text, learnedFrom: "self", learnedAt: experience.at });
  resident.knowledge = resident.knowledge.slice(-MAX_KNOWLEDGE);
  resident.lifeRevision += 1;
}

function runAutonomousExperience(state, resident, now = Date.now(), quiet = false) {
  const profile = profiles[resident.id];
  if (!profile) return null;
  const family = familyName(state, resident);
  const isMinor = profile.lifeStage === "child" || profile.lifeStage === "teen";
  const roll = Math.random();
  let type = "personal";
  let text;
  let valenceDelta = 4;
  let stressDelta = -2;
  let goalDelta = 4;

  if (family && roll < 0.22) {
    type = "family";
    text = `${resident.name} spent time with ${family.name}, their ${family.relationship}, and ${pick(familyMoments, Math.random)}.`;
    valenceDelta = 8;
    goalDelta = 2;
  } else if (isMinor && roll < 0.58) {
    type = profile.lifeStage === "child" ? "play" : "school";
    text = `${resident.name} ${pick(profile.lifeStage === "child" ? childMoments : schoolMoments, Math.random)}.`;
    valenceDelta = 6;
    goalDelta = 6;
  } else if (!isMinor && roll < 0.62) {
    type = "career";
    const success = Math.random() > 0.24;
    if (success) {
      text = `At ${resident.career.organization}, ${resident.name} ${pick(workMoments, Math.random)}.`;
      resident.career.successes += 1;
      resident.career.progress += 7;
      valenceDelta = 7;
      goalDelta = 5;
    } else {
      text = `At ${resident.career.organization}, ${resident.name} ran into trouble when ${pick(challenges, Math.random)}. They decided what to try differently next time.`;
      resident.career.setbacks += 1;
      resident.career.progress += 2;
      valenceDelta = -5;
      stressDelta = 10;
      goalDelta = 2;
    }
  } else if (roll < 0.82) {
    type = "interest";
    const interest = pick(profile.likes, Math.random);
    text = `${resident.name} made time for ${interest} and came away with a new idea.`;
    valenceDelta = 6;
    goalDelta = 5;
  } else {
    type = "community";
    text = `${resident.name} ${pick(communityMoments, Math.random)}.`;
    valenceDelta = 5;
    goalDelta = 3;
  }

  const activeGoal = resident.goals.find(goal => !goal.completed) || initialGoal(profile);
  if (!resident.goals.includes(activeGoal)) resident.goals.push(activeGoal);
  activeGoal.progress = Math.min(100, activeGoal.progress + goalDelta);
  if (activeGoal.progress >= 100 && !activeGoal.completed) {
    activeGoal.completed = true;
    activeGoal.completedAt = now;
    const nextText = profile.goals.find(goal => !resident.goals.some(existing => existing.text === goal)) || `help someone else pursue ${activeGoal.text}`;
    resident.goals.push({ text: nextText, progress: 0, completed: false, startedAt: now });
    text += ` This completed the goal to ${activeGoal.text}.`;
  }

  let promoted = false;
  if (!isMinor && resident.career.kind !== "retired" && resident.career.progress >= 100) {
    resident.career.progress -= 100;
    resident.career.level += 1;
    resident.career.title = `Senior ${resident.career.title.replace(/^Senior /, "")}`;
    text += ` The steady work earned a promotion to ${resident.career.title}.`;
    type = "promotion";
    promoted = true;
    valenceDelta += 10;
  }

  resident.mood.valence = Math.max(0, Math.min(100, resident.mood.valence + valenceDelta));
  resident.mood.stress = Math.max(0, Math.min(100, resident.mood.stress + stressDelta));
  resident.mood.label = moodFrom(resident.mood.valence, resident.mood.stress);
  resident.mood.reason = text;
  resident.activity = type === "career" || promoted ? "handling a work situation" : type === "family" ? "having family time" : "following a personal interest";
  resident.activityUntil = now + 45_000;
  const experience = { id: `${now}-${resident.autonomy.eventCount++}`, at: now, type, text, place: resident.place, promoted };
  pushExperience(resident, experience);
  resident.autonomy.nextEventAt = now + (2 + Math.random() * 5) * 60_000;
  return quiet ? null : text;
}

function shareKnowledge(a, b, now = Date.now()) {
  const known = new Set(a.knowledge.map(fact => fact.factId));
  const candidates = b.knowledge.filter(fact => fact.subjectId === b.id && !known.has(fact.factId));
  if (candidates.length === 0) return null;
  const source = candidates[Math.floor(Math.random() * candidates.length)];
  const learned = { ...source, learnedFrom: b.id, learnedAt: now };
  a.knowledge.push(learned);
  a.knowledge = a.knowledge.slice(-MAX_KNOWLEDGE);
  a.lifeRevision += 1;
  return learned;
}

function runOfflineLife(state, elapsedHours, now = Date.now()) {
  const texts = [];
  const countPerResident = Math.min(12, Math.floor(elapsedHours / 8));
  if (countPerResident <= 0) return texts;
  for (const resident of state.residents) {
    for (let index = 0; index < countPerResident; index++) {
      const eventTime = now - (countPerResident - index) * 60_000;
      const text = runAutonomousExperience(state, resident, eventTime, true);
      if (text) texts.push(text);
    }
  }
  return texts;
}

module.exports = {
  HISTORY_YEARS,
  historyYearsFor,
  profiles,
  buildHistory,
  hydrateLifeState,
  ensureResidentLife,
  runAutonomousExperience,
  runOfflineLife,
  shareKnowledge
};
