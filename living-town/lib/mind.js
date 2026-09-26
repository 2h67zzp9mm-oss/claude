"use strict";
/**
 * Resident minds: personality, daily rhythm, utility-based decisions,
 * personal activities, and conversations with a voice of their own.
 *
 * Each resident scores every place by what it offers *them* — their needs,
 * interests, friends who are there, crowding, boredom, stress, obligations —
 * then commits to a choice for a while instead of re-deciding every tick.
 * The winning reason is exposed as `intent` so players can see why.
 */

const { places } = require("../shared/world");
const { shareKnowledge } = require("./life");

let random = Math.random;
function setRandom(fn) { random = typeof fn === "function" ? fn : Math.random; }

const WEEKDAYS = [1, 2, 3, 4, 5];
const SCHOOL = "in class at the schoolhouse by the square";

// Traits are 0–1: openness, conscientiousness, extraversion, agreeableness, neuroticism.
const minds = {
  olive: {
    traits: { openness: 0.9, conscientiousness: 0.55, extraversion: 0.35, agreeableness: 0.7, neuroticism: 0.5 },
    interests: ["stories", "art", "exploring", "music", "people"],
    speed: 1.0, wake: 7, bed: 22, weekendLie: 1.5,
    obligations: [{ days: WEEKDAYS, from: 8, to: 15, place: "square", activity: SCHOOL, strict: true }],
    voice: {
      share: ["I keep thinking about how {x}.", "Did you know {x}? It's kind of a story.", "Okay, so {x}. I'm putting it in my notebook."],
      reply: ["Huh. I'm writing that down.", "That's more interesting than it sounds.", "Wait, tell me the rest later."],
      push: ["I don't think that's right, though.", "Can I finish my point?"]
    }
  },
  hazel: {
    traits: { openness: 0.75, conscientiousness: 0.3, extraversion: 0.95, agreeableness: 0.75, neuroticism: 0.35 },
    interests: ["animals", "sport", "play", "exploring", "games"],
    speed: 1.3, wake: 6.5, bed: 20, weekendLie: 0.5,
    obligations: [{ days: WEEKDAYS, from: 8, to: 14, place: "square", activity: SCHOOL, strict: true }],
    voice: {
      share: ["Guess what?! {x}!", "Okay okay listen: {x}!", "You'll never believe it: {x}!"],
      reply: ["No way!", "Whoa, really?!", "That's SO cool!", "Can I come next time?!"],
      push: ["Nuh-uh!", "That's not fair!"]
    }
  },
  dad: {
    traits: { openness: 0.6, conscientiousness: 0.85, extraversion: 0.45, agreeableness: 0.7, neuroticism: 0.45 },
    interests: ["tinkering", "games", "business", "family", "craft"],
    speed: 1.0, wake: 6, bed: 23, weekendLie: 1,
    obligations: [
      { days: WEEKDAYS, from: 8, to: 12, place: "workshop", activity: "on a job for Sean's Systems" },
      { days: WEEKDAYS, from: 13, to: 17, place: "workshop", activity: "wiring up a client's control panel" }
    ],
    voice: {
      share: ["Quick one: {x}.", "So, {x}. Had to see it to believe it.", "Funny thing: {x}."],
      reply: ["Makes sense.", "Good to know.", "Huh, fair enough.", "I'll remember that."],
      push: ["I hear you, but no.", "Let's agree to disagree."]
    }
  },
  milo: {
    traits: { openness: 0.55, conscientiousness: 0.7, extraversion: 0.95, agreeableness: 0.85, neuroticism: 0.3 },
    interests: ["food", "gossip", "music", "community", "people"],
    speed: 1.0, wake: 5.5, bed: 22, weekendLie: 0.5,
    obligations: [{ days: [1, 2, 3, 4, 5, 6], from: 6, to: 14, place: "cafe", activity: "running the cafe counter" }],
    voice: {
      share: ["Oh, you'll love this: {x}.", "Heard it at the counter: {x}.", "Between us? {x}."],
      reply: ["Ha! Coffee's on me for that one.", "I'm telling everyone.", "Now that's a story."],
      push: ["Now hold on a second.", "Let's not spoil a nice day over it."]
    }
  },
  zara: {
    traits: { openness: 0.95, conscientiousness: 0.45, extraversion: 0.6, agreeableness: 0.7, neuroticism: 0.55 },
    interests: ["art", "teaching", "design", "nature", "craft"],
    speed: 0.95, wake: 8, bed: 23.5, weekendLie: 1,
    obligations: [{ days: [2, 3, 4, 5, 6], from: 10, to: 15, place: "workshop", activity: "teaching a studio class" }],
    voice: {
      share: ["Picture this: {x}.", "It's got such good colors, this: {x}.", "I can't stop thinking about it: {x}."],
      reply: ["Ooh, I can see it.", "That's a mural waiting to happen.", "Gorgeous. Truly."],
      push: ["That's a very beige opinion.", "We see it differently, and that's fine."]
    }
  },
  finn: {
    traits: { openness: 0.4, conscientiousness: 0.9, extraversion: 0.2, agreeableness: 0.8, neuroticism: 0.2 },
    interests: ["craft", "tinkering", "birds", "teaching", "nature"],
    speed: 0.7, wake: 5, bed: 21, weekendLie: 0,
    obligations: [],
    voice: {
      share: ["Hm. {x}, as it happens.", "Reminds me: {x}.", "Worth knowing: {x}."],
      reply: ["Well now.", "Hm. Good.", "That'll do.", "Mm."],
      push: ["I'd not do it that way.", "We'll see."]
    }
  },
  nova: {
    traits: { openness: 0.9, conscientiousness: 0.3, extraversion: 0.75, agreeableness: 0.6, neuroticism: 0.5 },
    interests: ["design", "games", "food", "art", "shopping"],
    speed: 1.1, wake: 9, bed: 24.5, weekendLie: 1.5,
    obligations: [
      { days: WEEKDAYS, from: 15, to: 20, place: "market", activity: "working the market floor" },
      { days: [6], from: 10, to: 17, place: "market", activity: "running the Saturday stall" }
    ],
    voice: {
      share: ["ok so {x}, right?", "not to be dramatic but {x}.", "lowkey {x}."],
      reply: ["iconic.", "wait that's actually amazing", "stealing that for a poster"],
      push: ["respectfully? no.", "agree to disagree, I guess"]
    }
  }
};

const defaultMind = {
  traits: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.6, neuroticism: 0.4 },
  interests: ["people", "community"], speed: 1, wake: 7, bed: 22, weekendLie: 0, obligations: [],
  voice: { share: ["{x}."], reply: ["Oh, nice."], push: ["Hmm."] }
};

function mindFor(id) { return minds[id] || defaultMind; }
function traitsFor(id) { return mindFor(id).traits; }

const activities = {
  square: [["people", "people-watching from the fountain"], ["games", "playing chess on the stone table"], ["gossip", "catching up on town news"], ["community", "reading the community noticeboard"], ["play", "racing laps around the fountain"], ["stories", "listening to someone's long story"], [null, "seeing who is around"]],
  cafe: [["food", "trying today's special"], ["music", "humming along to the cafe radio"], ["gossip", "trading news over coffee"], ["art", "sketching in a corner booth"], ["stories", "writing in a notebook by the window"], [null, "having something to eat"]],
  park: [["animals", "watching the ducks"], ["birds", "counting birds by the pond"], ["sport", "kicking a ball around"], ["exploring", "exploring behind the hedges"], ["nature", "lying in the grass watching clouds"], ["play", "climbing the big oak"], ["art", "sketching the fountain"], [null, "enjoying the park"]],
  market: [["food", "tasting samples at the fruit stall"], ["design", "rearranging a display so it looks better"], ["business", "haggling cheerfully"], ["shopping", "browsing the stalls"], [null, "shopping at the market"]],
  workshop: [["tinkering", "taking apart something that stopped working"], ["craft", "planing a board smooth"], ["art", "mixing paint colors"], ["teaching", "showing someone a shop trick"], ["business", "sorting out orders"], [null, "working on a small project"]],
  homes: [["family", "having family time"], ["stories", "reading on the couch"], ["games", "playing an old game"], ["rest", "resting at home"], [null, "resting at home"]]
};

const topicLines = {
  animals: ["there's a heron at the pond again", "the market cat finally let me pet it", "ducks can sleep with one eye open"],
  birds: ["a woodpecker has moved into the old oak", "the swallows are back early this year"],
  nature: ["the clouds over the park looked like a staircase today", "the first leaves are turning by the pond"],
  sport: ["I almost pulled off a proper bicycle kick", "the park goalposts finally got new nets"],
  play: ["the hedge maze has a secret shortcut", "I invented a game with only one rule"],
  exploring: ["there's a path behind the workshop nobody uses", "I found a door in the market wall that goes nowhere"],
  games: ["someone left a chess game half-finished on the square", "I finally beat that old game on the hardest level"],
  art: ["blue and orange are secretly best friends", "the fountain looks different in afternoon light"],
  design: ["the market signs would look better in one font", "a good poster should work from across the street"],
  stories: ["the oldest bench in the square has initials carved from 1952", "every street here is named after somebody's grandmother"],
  music: ["the cafe radio played a song I haven't heard in years", "somebody was practicing trumpet near the homes"],
  food: ["the cafe is testing a cardamom bun", "the fruit stall has those tiny sweet tomatoes again"],
  gossip: ["someone is repainting the benches in the square", "the market might stay open late on Fridays"],
  community: ["the noticeboard wants volunteers for a clean-up", "people are talking about a town picnic"],
  tinkering: ["a good clamp solves half of everything", "that squeaky gate just needed a washer"],
  craft: ["oak takes a finish better if you're patient", "the old hand plane still beats the power tool"],
  teaching: ["beginners learn fastest when they're allowed to mess up", "the best lessons are the short ones"],
  business: ["small jobs done well bring the big ones", "a clear quote saves a lot of arguments"],
  shopping: ["the market has a new stall of odd little trinkets", "the thrift bin had a perfect frame"],
  family: ["family dinners are the best part of the week", "we're starting a new Sunday tradition"],
  people: ["the square has been busier than usual", "everyone seems to know everyone today"],
  rest: ["a proper nap is underrated", "quiet evenings are the best"]
};

const topicLabels = {
  animals: "animals", birds: "birds", nature: "nature", sport: "sport", play: "games of make-believe",
  exploring: "secret places in town", games: "games", art: "art", design: "design", stories: "town stories",
  music: "music", food: "food", gossip: "town news", community: "town plans", tinkering: "fixing things",
  craft: "woodworking", teaching: "teaching", business: "work", shopping: "market finds", family: "family",
  people: "the neighbors", rest: "taking it easy"
};

const frictionSubjects = [
  "whose turn it was to pick the music",
  "the best way to stack firewood",
  "whether pineapple belongs on pizza",
  "which path to the park is actually shorter",
  "the rules of a board game",
  "the right way to load a dishwasher"
];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pick(list) { return list[Math.floor(random() * list.length)]; }
function hourOf(date) { return date.getHours() + date.getMinutes() / 60; }

function ensureMind(resident) {
  const saved = resident.mind && typeof resident.mind === "object" ? resident.mind : {};
  resident.mind = {
    commitUntil: Number(saved.commitUntil) || 0,
    arrivedAt: Number(saved.arrivedAt) || 0,
    obligationKey: typeof saved.obligationKey === "string" ? saved.obligationKey : "",
    talkedWith: saved.talkedWith && typeof saved.talkedWith === "object" ? saved.talkedWith : {},
    recentTopics: Array.isArray(saved.recentTopics) ? saved.recentTopics.slice(0, 6) : [],
    version: 1
  };
  if (typeof resident.intent !== "string") resident.intent = "";
  resident.asleep = Boolean(resident.asleep);
  return resident;
}

/** Family links start (and stay) warmer than acquaintances. */
function seedFamilyBonds(state) {
  for (const resident of state.residents) {
    for (const link of resident.profile?.family || []) {
      if (!state.residents.some(other => other.id === link.id)) continue;
      resident.relationships[link.id] = Math.max(Number(resident.relationships[link.id]) || 0, 55);
    }
  }
}

function isAsleepTime(id, date) {
  const mind = mindFor(id);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const wake = mind.wake + (weekend ? mind.weekendLie : 0);
  const hour = hourOf(date);
  const bed = mind.bed;
  if (bed >= 24) return hour >= bed - 24 && hour < wake;
  return hour >= bed || hour < wake;
}

function activeObligation(id, date) {
  const hour = hourOf(date);
  return mindFor(id).obligations.find(item => item.days.includes(date.getDay()) && hour >= item.from && hour < item.to) || null;
}

/** Hourly need decay, shaped by personality and age. */
function decayRates(resident) {
  const { traits } = mindFor(resident.id);
  const stage = resident.profile?.lifeStage;
  const kid = stage === "child";
  const senior = stage === "senior";
  const sleepFactor = resident.asleep ? 0.4 : 1;
  return {
    hunger: 3.5 * (kid ? 1.2 : 1) * sleepFactor,
    energy: resident.asleep ? 0 : 2.1 * (kid ? 1.15 : senior ? 1.2 : 1),
    social: 1.7 * (0.4 + traits.extraversion * 1.2) * sleepFactor,
    fun: 1.3 * (0.5 + traits.openness) * sleepFactor
  };
}

function peopleAt(state, placeKey, exceptId) {
  return state.residents.filter(other => other.id !== exceptId && !other.asleep && other.place === placeKey);
}

/**
 * Score every place for this resident and return the best, with the
 * dominant reason. Pure apart from random noise.
 */
function scorePlaces(state, resident, date) {
  const mind = mindFor(resident.id);
  const { openness: O, conscientiousness: C, extraversion: E, agreeableness: A, neuroticism: N } = mind.traits;
  const obligation = activeObligation(resident.id, date);
  const now = date.getTime();
  const familyIds = new Set((resident.profile?.family || []).map(link => link.id));
  const needWeights = { hunger: 1.1, energy: 1, social: 0.5 + E, fun: 0.6 + O * 0.6 };
  const results = [];

  for (const [key, place] of Object.entries(places)) {
    const reasons = [];
    let score = 0;

    for (const [need, rate] of Object.entries(place.needs)) {
      const deficit = (100 - resident.needs[need]) / 100;
      const value = needWeights[need] * (rate / 20) * deficit * deficit * 4;
      score += value;
      if (value > 0.6) reasons.push([value, need === "hunger" ? "hungry" : need === "energy" ? "tired" : need === "social" ? "lonely" : "bored"]);
    }

    if (obligation && obligation.place === key) {
      const value = obligation.strict ? 5 : 1.2 + C * 2.2;
      score += value;
      reasons.push([value, obligation.strict ? "school time" : "work hours"]);
    }

    const matches = place.tags.filter(tag => mind.interests.includes(tag));
    if (matches.length) {
      const value = Math.min(2, matches.length) * 0.35 * (0.5 + O * 0.5);
      score += value;
      reasons.push([value, `loves ${topicLabels[matches[0]] || matches[0]}`]);
    }

    const present = peopleAt(state, key, resident.id);
    // Only the two strongest bonds count, so a crowd doesn't outweigh everything.
    const bonds = present.map(other => {
      const rel = Number(resident.relationships[other.id]) || 0;
      return { name: other.name, value: (rel / 100) * (0.3 + E * 0.7) * 0.35 + (familyIds.has(other.id) ? 0.08 + A * 0.08 : 0) };
    }).sort((a, b) => b.value - a.value);
    const bestFriend = bonds[0] || null;
    // Company matters more when a resident is craving it.
    const pull = clamp((bonds.slice(0, 2).reduce((sum, bond) => sum + bond.value, 0)) * 0.8 * (0.5 + (100 - resident.needs.social) / 100), -1, 1.2);
    score += pull;
    if (bestFriend && pull > 0.35) reasons.push([pull, `${bestFriend.name} is there`]);
    if (E < 0.5) score -= present.length * (0.5 - E) * 0.14;

    if (resident.mood?.stress > 50) {
      const value = place.quiet * (resident.mood.stress / 100) * (0.5 + N);
      score += value;
      if (value > 0.4) reasons.push([value, "needs some quiet"]);
    }

    if (key === resident.place && resident.mind.arrivedAt && !(obligation && obligation.place === key)) {
      const hours = (now - resident.mind.arrivedAt) / 3_600_000;
      score -= Math.min(1, hours / 3) * (0.25 + O * 0.5);
      score += 0.3; // stickiness so residents don't flip-flop
    }

    score -= Math.hypot(place.x - resident.x, place.y - resident.y) / 900 * 0.3;
    score += random() * (0.15 + (1 - C) * 0.4);

    reasons.sort((a, b) => b[0] - a[0]);
    results.push({ key, score, reason: reasons[0]?.[1] || "felt like it" });
  }
  results.sort((a, b) => b.score - a.score);
  return { best: results[0], obligation };
}

function pickActivity(resident, placeKey, obligation) {
  if (obligation && obligation.place === placeKey) return obligation.activity;
  const mind = mindFor(resident.id);
  const options = activities[placeKey] || [[null, "looking around"]];
  const liked = options.filter(([tag]) => tag && mind.interests.includes(tag));
  if (liked.length && random() < 0.75) return pick(liked)[1];
  return pick(options)[1];
}

/**
 * Decide where the resident should be. Returns a place key when the
 * resident should head somewhere new, otherwise null.
 */
function decide(state, resident, date) {
  const now = date.getTime();
  const mind = mindFor(resident.id);
  const sleepy = isAsleepTime(resident.id, date) || (resident.needs.energy < 8 && hourOf(date) > 19);
  if (sleepy) {
    resident.intent = "bedtime";
    if (resident.place !== "homes") return "homes";
    return null;
  }

  const obligation = activeObligation(resident.id, date);
  const obligationKey = obligation ? `${obligation.place}:${obligation.from}` : "";
  const critical = Object.values(resident.needs).some(value => value < 15);
  const due = now >= resident.mind.commitUntil || obligationKey !== resident.mind.obligationKey || critical;
  if (!due) return null;

  const { best } = scorePlaces(state, resident, date);
  resident.mind.obligationKey = obligationKey;
  resident.mind.commitUntil = now + (25 + mind.traits.conscientiousness * 50 + random() * 25) * 60_000;
  resident.intent = best.reason;
  return best.key === resident.place ? null : best.key;
}

function onArrive(resident, placeKey, date) {
  const obligation = activeObligation(resident.id, date);
  resident.mind.arrivedAt = date.getTime();
  if (resident.asleep) return;
  resident.activity = pickActivity(resident, placeKey, obligation);
}

// --- Conversations ---

function compatibility(a, b) {
  const ta = traitsFor(a.id), tb = traitsFor(b.id);
  const keys = Object.keys(ta);
  return 1 - keys.reduce((sum, key) => sum + Math.abs(ta[key] - tb[key]), 0) / keys.length;
}

function sharedInterests(a, b) {
  const other = new Set(mindFor(b.id).interests);
  return mindFor(a.id).interests.filter(tag => other.has(tag));
}

function voiceLine(id, kind, content) {
  const template = pick(mindFor(id).voice[kind] || defaultMind.voice[kind]);
  return template.replace("{x}", content || "");
}

/** Turn a third-person fact about the speaker into something they'd say. */
function firstPerson(name, text) {
  return String(text)
    .replace(new RegExp(`\\b${name}\\b`, "g"), "I")
    .replace(/, their /g, ", my ")
    .replace(/\.$/, "");
}

function conversationChance(a, b) {
  const ta = traitsFor(a.id), tb = traitsFor(b.id);
  const rel = ((Number(a.relationships[b.id]) || 0) + (Number(b.relationships[a.id]) || 0)) / 200;
  const socialNeed = (200 - a.needs.social - b.needs.social) / 200;
  const stressDrag = ((a.mood?.stress || 0) + (b.mood?.stress || 0)) / 200 * (1 - (ta.extraversion + tb.extraversion) / 2);
  return clamp(0.03 + 0.12 * (ta.extraversion + tb.extraversion) / 2 + rel * 0.08 + socialNeed * 0.1 - stressDrag * 0.08, 0.01, 0.3);
}

/**
 * Run one conversation between two residents. Returns an object describing
 * what happened so the caller can log it; mutates both residents.
 */
function converse(a, b, now, placeName) {
  // The more outgoing resident usually starts the conversation.
  if (traitsFor(b.id).extraversion > traitsFor(a.id).extraversion && random() < 0.7) [a, b] = [b, a];
  const ta = traitsFor(a.id), tb = traitsFor(b.id);
  const compat = compatibility(a, b);
  const shared = sharedInterests(a, b).filter(tag => !a.mind.recentTopics.includes(tag));
  const rel = ((Number(a.relationships[b.id]) || 0) + (Number(b.relationships[a.id]) || 0)) / 2;
  const stress = ((a.mood?.stress || 0) + (b.mood?.stress || 0)) / 200;
  let frictionChance = 0.03 + ((1 - ta.agreeableness) + (1 - tb.agreeableness)) / 2 * 0.1 + stress * 0.1 + (1 - compat) * 0.06;
  if (rel > 60) frictionChance /= 2;

  let kind;
  let line;
  let reply;
  let topic = null;
  let learned = null;

  if (random() < frictionChance) {
    kind = "friction";
    topic = pick(frictionSubjects);
    line = `I still say you're wrong about ${topic}.`;
    reply = voiceLine(b.id, "push");
  } else if (shared.length && random() < 0.55) {
    kind = "interest";
    topic = pick(shared);
    line = voiceLine(a.id, "share", pick(topicLines[topic] || ["it's a nice day"]));
    reply = voiceLine(b.id, "reply");
  } else {
    learned = shareKnowledge(b, a, now);
    if (learned) {
      kind = "news";
      line = voiceLine(a.id, "share", firstPerson(a.name, learned.text));
      reply = voiceLine(b.id, "reply");
    } else {
      kind = "smalltalk";
      const own = pick(mindFor(a.id).interests);
      topic = own;
      line = voiceLine(a.id, "share", pick(topicLines[own] || ["it's a nice day"]));
      reply = voiceLine(b.id, "reply");
    }
  }

  const bondA = kind === "friction" ? -2 - (1 - ta.agreeableness) * 3 : 1 + compat * 2 + (kind === "interest" ? 1 : 0);
  const bondB = kind === "friction" ? -2 - (1 - tb.agreeableness) * 3 : 1 + compat * 2 + (kind === "interest" ? 1 : 0);
  a.relationships[b.id] = clamp((Number(a.relationships[b.id]) || 0) + bondA, -100, 100);
  b.relationships[a.id] = clamp((Number(b.relationships[a.id]) || 0) + bondB, -100, 100);

  for (const [self, traits] of [[a, ta], [b, tb]]) {
    self.needs.social = clamp(self.needs.social + (kind === "friction" ? 4 : 10 + traits.extraversion * 6), 0, 100);
    if (self.mood) {
      if (kind === "friction") { self.mood.stress = clamp(self.mood.stress + 4 + traits.neuroticism * 8, 0, 100); self.mood.valence = clamp(self.mood.valence - 3, 0, 100); }
      else { self.mood.valence = clamp(self.mood.valence + 2 + traits.extraversion * 2, 0, 100); self.mood.stress = clamp(self.mood.stress - 2, 0, 100); }
    }
    self.lastTalk = now;
    self.lifeRevision = (self.lifeRevision || 0) + 1;
  }
  if (topic) {
    a.mind.recentTopics = [topic, ...a.mind.recentTopics].slice(0, 6);
    b.mind.recentTopics = [topic, ...b.mind.recentTopics].slice(0, 6);
  }
  a.mind.talkedWith[b.id] = now;
  b.mind.talkedWith[a.id] = now;
  a.speech = { text: line, from: now, until: now + 9000 };
  b.speech = { text: reply, from: now + 2500, until: now + 11000 };

  const memoryA = kind === "friction" ? `${b.name} and I disagreed about ${topic}.` : kind === "news" ? `I told ${b.name}: ${line}` : `${b.name} and I talked about ${topicLabels[topic] || "the day"}. "${line}"`;
  const memoryB = kind === "friction" ? `${a.name} and I disagreed about ${topic}.` : learned ? `${a.name} told me: ${learned.text}` : `${a.name} said: "${line}"`;
  a.memories.unshift({ at: now, about: b.id, text: memoryA, type: "conversation", tone: kind });
  b.memories.unshift({ at: now, about: a.id, text: memoryB, type: "conversation", tone: kind });
  a.memories = a.memories.slice(0, 120);
  b.memories = b.memories.slice(0, 120);

  const event = kind === "friction" ? `${a.name} and ${b.name} had a small disagreement about ${topic} at ${placeName}.`
    : kind === "news" ? `${b.name} learned something new from ${a.name} at ${placeName}: ${learned.text}`
    : kind === "interest" ? `${a.name} and ${b.name} swapped thoughts about ${topicLabels[topic] || topic} at ${placeName}.`
    : `${a.name} chatted with ${b.name} at ${placeName}.`;
  return { kind, event, a, b };
}

/** Try conversations between nearby, awake residents. */
function socialTick(state, now, placeName) {
  const results = [];
  const busy = new Set();
  const awake = state.residents.filter(r => !r.asleep);
  for (let i = 0; i < awake.length; i++) {
    for (let j = i + 1; j < awake.length; j++) {
      const a = awake[i], b = awake[j];
      if (busy.has(a.id) || busy.has(b.id)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 60) continue;
      if (now - (Number(a.mind.talkedWith[b.id]) || 0) < 20 * 60_000) continue;
      if (now - (Number(a.lastTalk) || 0) < 4 * 60_000 || now - (Number(b.lastTalk) || 0) < 4 * 60_000) continue;
      if (random() >= conversationChance(a, b)) continue;
      busy.add(a.id); busy.add(b.id);
      results.push(converse(a, b, now, placeName(a)));
    }
  }
  return results;
}

module.exports = {
  minds,
  mindFor,
  traitsFor,
  ensureMind,
  seedFamilyBonds,
  isAsleepTime,
  activeObligation,
  decayRates,
  scorePlaces,
  decide,
  onArrive,
  pickActivity,
  socialTick,
  converse,
  compatibility,
  firstPerson,
  setRandom
};
