"use strict";
/**
 * Social interactions a player can start with another resident, Sims-style:
 * chat, jokes, compliments, high fives, hugs, puppy-eyes begging, games,
 * invitations, "follow me", teasing and saying sorry.
 *
 * The other resident is a person about it: whether they go along depends
 * on their personality, mood, needs and how well they know you, with a
 * little chance. Outcomes change friendships, needs and feelings, and both
 * remember it. Everything here is gentle and child-safe, and there is no
 * romance of any kind.
 */

const will = require("./will");
const { places } = require("../shared/world");

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const ACTIONS = {
  chat: {
    label: "Chat", emoji: "💬",
    ask: ["Hi! How's your day going?", "Hey there! What's new?", "Hello! Nice to see you."],
    yes: ["Pretty good, thanks for asking!", "Oh, hello! Lovely to see you.", "Not bad at all!"],
    no: ["Oh, hi. I'm a bit busy right now.", "Hi... sorry, not really in a chatty mood."],
    chance: ({ rel, t, mood }) => 0.55 + rel * 0.3 + t.extraversion * 0.2 + mood * 0.15,
    yesEffect: { rel: 3, social: 12, feel: ["💬", "Nice chat with {actor}"] },
    noEffect: { rel: -1, social: 2 }
  },
  joke: {
    label: "Tell a joke", emoji: "😂",
    ask: ["Why did the cookie go to the doctor? It felt crummy!", "What do you call a sleeping dinosaur? A dino-snore!", "Why are fish so smart? They live in schools!", "What do you call a bear with no teeth? A gummy bear!"],
    yes: ["Ha! That's a good one!", "Hahaha! I'm telling everyone that!", "Ha! You're so silly!"],
    no: ["...I don't get it.", "Hmm. That one fell a bit flat.", "Oh. Ha. Ha."],
    chance: ({ rel, t, mood }) => 0.35 + t.openness * 0.25 + t.extraversion * 0.15 + rel * 0.2 + mood * 0.15,
    yesEffect: { rel: 4, fun: 14, social: 6, feel: ["😂", "{actor} told a great joke"], actorFeel: ["😄", "{target} laughed at my joke"] },
    noEffect: { rel: 0, fun: 2, actorFeel: ["😅", "My joke fell flat"] }
  },
  compliment: {
    label: "Compliment", emoji: "🌟",
    ask: ["I really like your style!", "You're really good at what you do.", "You always make people smile.", "That's a great outfit!"],
    yes: ["Aww, thank you! That's so kind.", "You just made my day!", "Oh, stop it! Thank you!"],
    no: ["Oh... um, thanks, I guess?", "Hm, okay. Thanks."],
    chance: ({ rel, t, mood }) => 0.6 + t.agreeableness * 0.25 + rel * 0.15 + mood * 0.1,
    yesEffect: { rel: 5, social: 8, mood: 5, feel: ["🌟", "{actor} gave me a compliment"] },
    noEffect: { rel: 1, social: 2 }
  },
  highFive: {
    label: "High five", emoji: "✋",
    ask: ["High five!", "Up top!"],
    yes: ["Yeah! High five!", "Nice one!"],
    no: ["Oops, missed!", "Ha, maybe next time!"],
    chance: ({ rel, t, mood }) => 0.6 + t.extraversion * 0.25 + rel * 0.15 + mood * 0.05,
    yesEffect: { rel: 3, fun: 6, social: 6, feel: ["✋", "High five with {actor}"] },
    noEffect: { rel: 0, fun: 2 }
  },
  hug: {
    label: "Hug", emoji: "🤗", minRel: 30,
    ask: ["Can I have a hug?", "Hug?"],
    yes: ["Of course! Come here!", "Aww, yes! Big hug!"],
    no: ["Hmm, how about a high five instead?", "Maybe when we know each other a bit better!"],
    chance: ({ rel, t, mood, family }) => (family ? 0.7 : 0.1) + rel * 0.8 + t.agreeableness * 0.15 + mood * 0.1 - (rel < 0.4 ? 0.4 : 0),
    yesEffect: { rel: 6, social: 16, mood: 6, stress: -6, feel: ["🤗", "A warm hug from {actor}"], actorFeel: ["🤗", "A warm hug from {target}"] },
    noEffect: { rel: -1, actorFeel: ["😳", "{target} wasn't ready for a hug"] }
  },
  beg: {
    label: "Beg for a treat", emoji: "🥺", minRel: 10,
    ask: ["Pretty please, can I have a treat? 🥺", "Pleeease? Just one little treat?", "Puppy eyes! Can I have a snack?"],
    yes: ["Oh, how can I say no to that face? Here!", "Alright, alright! Here's a cookie.", "Just this once! Here you go."],
    no: ["Nice try! Not right now.", "Ha! Those puppy eyes won't work on me today.", "Maybe after dinner!"],
    chance: ({ rel, t, mood, actorKid }) => 0.2 + rel * 0.4 + t.agreeableness * 0.25 + mood * 0.1 + (actorKid ? 0.15 : 0),
    yesEffect: { rel: 1, actorHunger: 25, actorFeel: ["🍪", "{target} gave me a treat"], feel: ["🥺", "Couldn't say no to {actor}"] },
    noEffect: { rel: 0, actorFeel: ["🙃", "No treat from {target} this time"] }
  },
  rps: {
    label: "Rock, paper, scissors", emoji: "✂️",
    ask: ["Rock, paper, scissors?", "Best of three: rock, paper, scissors!"],
    yes: ["You're on!", "Okay, ready... go!"],
    no: ["Maybe later!", "Not right now, thanks!"],
    chance: ({ rel, t, mood }) => 0.55 + t.extraversion * 0.2 + t.openness * 0.1 + rel * 0.15 + mood * 0.05,
    yesEffect: { rel: 3, fun: 12, social: 6, game: true },
    noEffect: { rel: 0 }
  },
  wish: {
    label: "Ask what they wish for", emoji: "🙋",
    ask: ["What are you wishing for today?", "If you could do anything today, what would it be?"],
    yes: [],
    no: ["Oh, I'm not sure yet!", "Hmm, I haven't decided!"],
    chance: ({ rel, t, mood }) => 0.7 + rel * 0.2 + t.extraversion * 0.1 + mood * 0.05,
    yesEffect: { rel: 2, social: 6, revealWish: true },
    noEffect: { rel: 0, social: 3 }
  },
  follow: {
    label: "Follow me!", emoji: "🚶",
    ask: ["Come with me!", "Follow me, I want to show you something!"],
    yes: ["Okay, lead the way!", "Ooh, where are we going?"],
    no: ["Maybe later, I'm in the middle of something.", "Not right now, sorry!"],
    chance: ({ rel, t, mood, busy }) => (busy ? -1 : 0.25 + rel * 0.5 + t.openness * 0.15 + t.extraversion * 0.1 + mood * 0.1),
    yesEffect: { rel: 2, social: 6, follow: true },
    noEffect: { rel: 0 }
  },
  invite: {
    label: "Invite somewhere", emoji: "📍", needsPlace: true,
    ask: ["Want to come to {place} with me?", "Let's go to {place}!"],
    yes: ["Yes, let's go!", "Ooh, okay! See you there!"],
    no: ["Maybe later!", "Not right now, but thanks for asking!"],
    chance: ({ rel, t, mood, busy, likesPlace }) => (busy ? -1 : 0.2 + rel * 0.45 + t.agreeableness * 0.15 + mood * 0.1 + (likesPlace ? 0.2 : 0)),
    yesEffect: { rel: 3, social: 6, goTo: true, feel: ["😊", "{actor} invited me along"] },
    noEffect: { rel: 0 }
  },
  tease: {
    label: "Tease", emoji: "😜",
    ask: ["Nice hair... did a bird make a nest in it?", "Bet you can't catch me!", "You walk like a penguin!"],
    yes: ["Hey! Ha, very funny!", "Oh, you're on!", "Ha! Takes one to know one!"],
    no: ["Hey, that's not very nice.", "That wasn't very kind.", "Hmph. Not funny."],
    chance: ({ rel, t, mood }) => 0.1 + rel * 0.5 + t.agreeableness * 0.15 + (1 - t.neuroticism) * 0.15 + mood * 0.1,
    yesEffect: { rel: 2, fun: 8, feel: ["😜", "Playful teasing with {actor}"] },
    noEffect: { rel: -6, stress: 8, mood: -4, friction: true, feel: ["😠", "{actor} teased me"], actorFeel: ["😬", "Teasing {target} went wrong"] }
  },
  sorry: {
    label: "Say sorry", emoji: "🙏",
    ask: ["I'm sorry. I didn't mean it.", "Sorry about before. Friends?", "I want to say sorry."],
    yes: ["It's okay. Thanks for saying sorry.", "Friends! Of course.", "Apology accepted!"],
    no: ["I'm still a little upset. Maybe later.", "Thanks... I just need a bit of time."],
    chance: ({ rel, t, mood, upset }) => (upset ? 0.4 : 0.8) + t.agreeableness * 0.3 + rel * 0.2 + mood * 0.05,
    yesEffect: { rel: 6, stress: -8, makeUp: true, feel: ["🤝", "Made up with {actor}"], actorFeel: ["🤝", "Made up with {target}"] },
    noEffect: { rel: 1 }
  }
};

const RPS = ["rock", "paper", "scissors"];

function relLabel(value, family) {
  if (family && value >= 40) return "Family";
  if (value < 0) return "Not getting along";
  if (value < 20) return "Acquaintances";
  if (value < 40) return "Friendly";
  if (value < 65) return "Friends";
  if (value < 85) return "Good friends";
  return "Best friends";
}

/**
 * The actor (a player's resident) tries `action` with `target`. `ctx`
 * supplies mindFor, random, obligation(resident, date), isFamily(a, b),
 * startFollow(target, actor), goTo(target, placeKey) and addEvent.
 * Returns { accepted, actorLine, targetLine, event } or { error }.
 */
function perform(state, actor, target, actionId, now, ctx, { place = null } = {}) {
  const action = ACTIONS[actionId];
  if (!action) return { error: "That's not something you can do." };
  if (action.needsPlace && (!place || !places[place] || place === "homes")) return { error: "Pick somewhere to go." };
  will.ensure(actor); will.ensure(target);
  const pick = list => list[Math.floor(ctx.random() * list.length)];
  const t = ctx.mindFor(target.id).traits;
  const relValue = Number(target.relationships[actor.id]) || 0;
  const family = ctx.isFamily(actor, target);
  const facts = {
    rel: clamp(relValue / 100, -1, 1), t, family,
    mood: ((target.mood?.valence ?? 60) - 50) / 100,
    busy: Boolean(ctx.obligation(target, new Date(now))),
    actorKid: ["child", "teen"].includes(actor.profile?.lifeStage),
    likesPlace: place ? ctx.mindFor(target.id).interests.some(tag => places[place].tags.includes(tag)) : false,
    upset: (target.feelings || []).some(f => f.emoji === "😠" && f.text.includes(actor.name))
  };
  const placeName = place ? places[place].name : "";
  const fill = text => text.replace(/\{actor\}/g, actor.name).replace(/\{target\}/g, target.name).replace(/\{place\}/g, placeName);
  // Some things (a hug, a treat) need a friendship first; family always qualifies.
  const allowed = action.minRel === undefined || relValue >= action.minRel || family;
  const accepted = allowed && ctx.random() < clamp(action.chance(facts), 0, 0.97);
  const effect = accepted ? action.yesEffect : action.noEffect;

  const actorLine = fill(pick(action.ask));
  let targetLine = fill(pick(accepted && action.yes.length ? action.yes : action.no));
  let event = null;

  // Friendship both ways, needs and mood.
  const bump = (from, to, amount) => { from.relationships[to.id] = clamp((Number(from.relationships[to.id]) || 0) + amount, -100, 100); };
  bump(target, actor, effect.rel || 0);
  bump(actor, target, Math.round((effect.rel || 0) * 0.7));
  const needs = (r, key, amount) => { if (amount && r.needs) r.needs[key] = clamp(r.needs[key] + amount, 0, 100); };
  for (const r of [actor, target]) { needs(r, "social", effect.social); needs(r, "fun", effect.fun); }
  needs(actor, "hunger", effect.actorHunger);
  if (target.mood) {
    target.mood.valence = clamp(target.mood.valence + (effect.mood || 0), 0, 100);
    target.mood.stress = clamp(target.mood.stress + (effect.stress || 0), 0, 100);
  }
  if (effect.feel) will.feel(target, effect.feel[0], fill(effect.feel[1]), { now });
  if (effect.actorFeel) will.feel(actor, effect.actorFeel[0], fill(effect.actorFeel[1]), { now });

  // Special outcomes.
  if (accepted && effect.game) {
    const a = pick(RPS), b = pick(RPS);
    const win = (x, y) => (x === "rock" && y === "scissors") || (x === "paper" && y === "rock") || (x === "scissors" && y === "paper");
    const result = a === b ? "It's a tie!" : win(a, b) ? `${actor.name} wins!` : `${target.name} wins!`;
    targetLine = `${capitalize(b)}! You picked ${a}. ${result}`;
    will.feel(target, "✂️", `Played rock, paper, scissors with ${actor.name}`, { now });
  }
  if (accepted && effect.revealWish) {
    const wish = (target.wishes || [])[0];
    targetLine = wish ? `I really want to ${wish.reason?.replace(/^wants to /, "") || wish.text.toLowerCase()}!` : "Honestly? I'm happy just as I am today!";
  }
  if (accepted && effect.follow) ctx.startFollow(target, actor);
  if (accepted && effect.goTo) { ctx.goTo(target, place, `going to ${placeName} with ${actor.name}`); event = `${actor.name} invited ${target.name} to ${placeName}, and ${target.name} said yes!`; }
  if (accepted && effect.makeUp) {
    target.feelings = (target.feelings || []).filter(f => !(f.emoji === "😠" && f.text.includes(actor.name)));
    for (const [self, other] of [[actor, target], [target, actor]]) {
      self.memories = [{ at: now, about: other.id, text: `${other.name} and I made up.`, type: "conversation", tone: "makeup" }, ...(self.memories || [])].slice(0, 120);
    }
  }

  // Both remember it (a friendly moment counts toward "make up" wishes).
  const tone = effect.friction ? "friction" : accepted ? "friendly" : "declined";
  const memory = (self, other, text) => { self.memories = [{ at: now, about: other.id, text, type: "conversation", tone }, ...(self.memories || [])].slice(0, 120); };
  memory(target, actor, `${actor.name}: "${actorLine}" I said: "${targetLine}"`);
  memory(actor, target, `I said to ${target.name}: "${actorLine}" ${target.name} said: "${targetLine}"`);
  for (const r of [actor, target]) {
    r.lastTalk = now;
    if (r.mind?.talkedWith) r.mind.talkedWith[r === actor ? target.id : actor.id] = now;
    r.lifeRevision = (r.lifeRevision || 0) + 1;
  }
  actor.speech = { text: actorLine, from: now, until: now + 7000 };
  target.speech = { text: targetLine, from: now + 2200, until: now + 10000 };
  if (!event && effect.friction) event = `${target.name} didn't like ${actor.name}'s teasing.`;
  if (!event && accepted && ["hug", "sorry"].includes(actionId)) event = actionId === "hug" ? `${actor.name} and ${target.name} shared a hug.` : `${actor.name} said sorry to ${target.name}, and they made up.`;
  if (event) ctx.addEvent(event, now);
  return { accepted, actorLine, targetLine, event, relationship: relLabel(Number(target.relationships[actor.id]) || 0, family) };
}

function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

/** What the phone menu needs: the actions, and which need a close friendship. */
function menu() {
  return Object.entries(ACTIONS).map(([id, a]) => ({ id, label: a.label, emoji: a.emoji, minRel: a.minRel ?? null, needsPlace: Boolean(a.needsPlace) }));
}

module.exports = { ACTIONS, perform, menu, relLabel };
