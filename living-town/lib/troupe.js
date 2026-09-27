"use strict";
/**
 * The Big Top troupe: six original toybox-circus characters who live in a
 * striped tent by the market and put on a show in the Town Square on
 * weekend afternoons. They are custom residents (so the owner can restyle
 * them or let them move away) with hand-written personalities instead of
 * the age-based presets.
 */

const WEEKEND = [0, 6];
const SHOW = { days: WEEKEND, from: 14, to: 16, place: "square", activity: "performing in the circus show" };
const REHEARSAL = { days: [2, 4], from: 16, to: 18, place: "homes", activity: "rehearsing a circus act in the ring" };

const members = [
  {
    id: "t-plum", name: "Plum", age: 26,
    look: { skin: "#9b7fd4", hair: "#9b7fd4", style: "bunny", shirt: "#fff2e0", pants: "#f28c28", shoes: "#3a2a20", accessory: "overalls" },
    role: "Circus clown", summary: "Plum is a purple bunny in orange overalls who can't resist a silly joke, and always makes sure the joke is on himself.",
    likes: ["harmless jokes", "carrot cake", "juggling", "making people laugh"], dislikes: ["mean jokes", "sitting still", "soggy carrots"],
    traits: { openness: 0.75, conscientiousness: 0.3, extraversion: 0.9, agreeableness: 0.6, neuroticism: 0.3 },
    interests: ["games", "play", "people", "music"], speed: 1.2, wake: 8, bed: 23.5, weekendLie: 1,
    voice: { share: ["Heh, get this: {x}.", "Okay okay, {x}!"], reply: ["Ha! Classic.", "No way, really?", "That's the best!"], push: ["Pfft, nah.", "Ehh, I'd hop the other way on that."] },
    goals: ["teach Hazel a juggling trick", "tell a joke that makes Finn laugh", "invent a brand-new clown act"]
  },
  {
    id: "t-patches", name: "Patches", age: 34,
    look: { skin: "#f3d9b1", hair: "#f2b705", style: "yarn", shirt: "#7fd1b9", pants: "#7fd1b9", shoes: "#8a5a36", accessory: "stitches" },
    role: "Costume maker", summary: "Patches is a cheerful patchwork rag doll with honey-colored yarn hair. She sews every costume in the troupe and has a kind word for everyone.",
    likes: ["sewing costumes", "tea parties", "cheering people up", "bright buttons"], dislikes: ["frowns", "loose threads", "rainy picnics"],
    traits: { openness: 0.6, conscientiousness: 0.7, extraversion: 0.7, agreeableness: 0.95, neuroticism: 0.35 },
    interests: ["craft", "people", "food", "stories"], speed: 1, wake: 7, bed: 22.5, weekendLie: 0.5,
    voice: { share: ["Oh, sweetie, {x}!", "Guess what, dear? {x}."], reply: ["How lovely!", "Oh, that's wonderful!", "Aww, good for you."], push: ["Now, let's be kind about it.", "Hmm, I see it a little differently."] },
    goals: ["sew new costumes for the whole troupe", "throw a tea party at the Big Top", "make a friend in every house"]
  },
  {
    id: "t-tumble", name: "Tumble", age: 19,
    look: { skin: "#fbe3d0", hair: "#2e7d32", style: "jester", shirt: "#2e7d32", pants: "#f2c14e", shoes: "#2e7d32", accessory: "ruff" },
    role: "Acrobat", summary: "Tumble is the newest jester in the troupe: a little nervous, surprisingly brave, and never happier than in the middle of a cartwheel.",
    likes: ["cartwheels", "maps", "quiet mornings", "the trampoline"], dislikes: ["getting lost", "loud surprises", "being rushed"],
    traits: { openness: 0.65, conscientiousness: 0.55, extraversion: 0.45, agreeableness: 0.75, neuroticism: 0.7 },
    interests: ["sport", "play", "exploring", "music"], speed: 1.3, wake: 7.5, bed: 22.5, weekendLie: 1,
    voice: { share: ["Um, so, {x}?", "I-I noticed that {x}."], reply: ["Oh! Okay, good.", "Phew, that's nice.", "Really? Wow."], push: ["I-I don't think so...", "Um, maybe not?"] },
    goals: ["land a triple cartwheel in the show", "learn every path in town", "be brave enough to do a solo act"]
  },
  {
    id: "t-rook", name: "Rook", age: 72,
    look: { skin: "#e8e4da", hair: "#cfc9bb", style: "rook", shirt: "#e8e4da", pants: "#3a3a4a", shoes: "#3a3a4a", accessory: "glasses" },
    role: "Ringmaster emeritus", summary: "Rook is a kindly old chess-castle gentleman who ran the ring for years. He is fond of puzzles and his little garden, and forgets where he put his spectacles.",
    likes: ["puzzles", "his little garden", "long stories", "a good game of chess"], dislikes: ["hurrying", "losing his spectacles", "cold tea"],
    traits: { openness: 0.55, conscientiousness: 0.6, extraversion: 0.45, agreeableness: 0.85, neuroticism: 0.3 },
    interests: ["games", "nature", "stories", "birds"], speed: 0.7, wake: 6, bed: 21, weekendLie: 0,
    voice: { share: ["Ah! Where was I... {x}.", "Now then, {x}."], reply: ["Splendid, splendid.", "Well, I never!", "How marvelous."], push: ["Hmm, check... no, wait.", "I'm not certain about that."] },
    goals: ["win a game of chess against Sean", "grow the biggest sunflower in town", "remember where he left his spectacles"]
  },
  {
    id: "t-ribbons", name: "Ribbons", age: 23,
    look: { skin: "#fff0f5", hair: "#ff6f91", style: "ribbons", shirt: "#ff6f91", pants: "#ffd1dc", shoes: "#ff6f91", accessory: "partyMask" },
    role: "Ribbon dancer", summary: "Ribbons is a shy dancer made of pink streamers who wears a starry party mask. On stage she twirls like a spinning top.",
    likes: ["dancing", "music boxes", "baking cookies", "sparkly things"], dislikes: ["crowds that are too close", "tangles", "loud bangs"],
    traits: { openness: 0.7, conscientiousness: 0.6, extraversion: 0.3, agreeableness: 0.85, neuroticism: 0.65 },
    interests: ["music", "art", "food", "design"], speed: 1.1, wake: 8, bed: 23, weekendLie: 1,
    voice: { share: ["Oh... {x}, I think.", "Um, {x}!"], reply: ["That's nice.", "Oh, how sweet.", "I like that."], push: ["Oh. Okay...", "Maybe not, sorry."] },
    goals: ["dance a solo in the circus show", "bake cookies for the whole town", "make a friend who likes music"]
  },
  {
    id: "t-bolt", name: "Bolt", age: 9,
    look: { skin: "#a7b0b8", hair: "#e63946", style: "robot", shirt: "#4a90d9", pants: "#f2c14e", shoes: "#3a3f44", accessory: "none" },
    role: "Toy robot", summary: "Bolt is a block-built toy robot who goes to school with Hazel. He takes everything apart to see how it works, and usually puts it back together.",
    likes: ["building things", "gears", "school", "beep-boop songs"], dislikes: ["rust", "puddles", "missing pieces"],
    traits: { openness: 0.8, conscientiousness: 0.55, extraversion: 0.7, agreeableness: 0.7, neuroticism: 0.35 },
    interests: ["tinkering", "games", "exploring", "sport"], speed: 1.15, wake: 7, bed: 20, weekendLie: 0.5,
    voice: { share: ["Beep! {x}.", "Fact detected: {x}!"], reply: ["Affirmative!", "Processing... cool!", "Beep-boop, nice!"], push: ["Error: I disagree.", "Does not compute!"] },
    goals: ["build a robot friend", "win the talent show", "learn to whistle"],
    school: true
  }
];

const byId = new Map(members.map(m => [m.id, m]));

function memberFor(resident) { return resident?.custom?.troupe ? byId.get(resident.custom.troupe) || null : null; }

/** Hand-written profile for a troupe member, in the shape cast.js builds. */
function profileFor(member, born) {
  const child = member.age < 13;
  return {
    name: member.name, born, role: member.role, custom: true, noHistory: true, summary: member.summary,
    likes: member.likes, dislikes: member.dislikes, values: ["kindness", "a good show"], goals: member.goals,
    family: [], historyTracks: ["community"],
    career: child ? { kind: "school", title: "Elementary student", level: 1, organization: "Living Town School" }
      : { kind: "free", title: member.role, level: 1, organization: "The Big Top" }
  };
}

function mindFor(member) {
  const obligations = member.school
    ? [{ days: [1, 2, 3, 4, 5], from: 8, to: 14, place: "square", activity: "in class at the schoolhouse by the square", strict: true }, SHOW]
    : [SHOW, REHEARSAL];
  return { traits: member.traits, interests: member.interests, speed: member.speed, wake: member.wake, bed: member.bed, weekendLie: member.weekendLie, obligations, voice: member.voice };
}

/** Is a show on right now? */
function showOn(date) {
  return SHOW.days.includes(date.getDay()) && date.getHours() >= SHOW.from && date.getHours() < SHOW.to;
}

/**
 * While a show is on and the troupe is in town, everyone else is drawn to
 * the square to watch. Announced once per show.
 */
function tick(state, now, addEvent) {
  const date = new Date(now);
  if (!showOn(date) || !state.residents.some(r => memberFor(r))) return;
  state.effects = Array.isArray(state.effects) ? state.effects : [];
  if (state.effects.some(e => e.kind === "happening" && e.show && e.until > now)) return;
  const end = new Date(date);
  end.setHours(SHOW.to, 0, 0, 0);
  const others = state.residents.filter(r => !memberFor(r)).map(r => r.id);
  state.effects.push({ id: `${now}-show`, kind: "happening", show: true, place: "square", pull: 1.8, residentIds: others, until: end.getTime(), reason: "watching the circus show" });
  addEvent("🎪 The Big Top troupe's circus show is starting in the Town Square! Everyone's invited.", now);
}

module.exports = { members, memberFor, profileFor, mindFor, showOn, tick, SHOW };
