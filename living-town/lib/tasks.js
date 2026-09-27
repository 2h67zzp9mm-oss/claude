"use strict";
/**
 * Favours: residents ask players for help (a ❗ over their head).
 *
 * Each player gets their own offers through the day from people who know
 * them: find something they lost, cheer them up with a joke or a hug, play
 * a game, bring a friend somewhere, make them a hot chocolate, check on the
 * ducks. A player takes up to three at a time; finishing one earns Town
 * Stars, a keepsake from that person, and a warmer friendship. Everything
 * is hand-written and child-safe.
 */

const { places, snapToWalkable } = require("../shared/world");

const MAX_ACTIVE = 3;
const MAX_OFFERS = 2;

// What each person gives as a thank-you (anyone else: a thank-you card).
const GIFTS = {
  olive: { emoji: "🗺️", name: "Olive's hand-drawn map" }, hazel: { emoji: "🪨", name: "Hazel's shiny pebble" },
  dad: { emoji: "🤖", name: "Sean's tiny robot" }, milo: { emoji: "🥐", name: "Milo's cinnamon bun sticker" },
  zara: { emoji: "🎨", name: "Zara's tiny painting" }, finn: { emoji: "🐦", name: "Finn's carved wooden bird" },
  nova: { emoji: "📿", name: "Nova's friendship bracelet" }, "t-plum": { emoji: "🤡", name: "Plum's clown nose" },
  "t-patches": { emoji: "🧵", name: "Patches' button badge" }, "t-tumble": { emoji: "🔔", name: "Tumble's jingle bell" },
  "t-rook": { emoji: "♟️", name: "Rook's chess piece" }, "t-ribbons": { emoji: "🎀", name: "Ribbons' pink ribbon" },
  "t-bolt": { emoji: "⚙️", name: "Bolt's lucky gear" }
};
const giftFrom = r => GIFTS[r.id] || { emoji: "💌", name: `A thank-you card from ${r.name}` };

const LOST = [
  { emoji: "📚", name: "library book" }, { emoji: "🧣", name: "favourite scarf" }, { emoji: "🔑", name: "little brass key" },
  { emoji: "🧸", name: "teddy bear" }, { emoji: "🧤", name: "red mitten" }, { emoji: "👓", name: "spare glasses" },
  { emoji: "🎈", name: "runaway balloon" }, { emoji: "📓", name: "sketchbook" }
];

// Kinds of favour. `make` builds one for a requester, or returns null if it doesn't fit.
const KINDS = {
  find(requester, player, rand) {
    const item = LOST[Math.floor(rand() * LOST.length)];
    const placeKeys = Object.keys(places).filter(k => k !== "homes");
    const place = placeKeys[Math.floor(rand() * placeKeys.length)];
    const center = places[place].area || places[place];
    const angle = rand() * Math.PI * 2, r = 15 + rand() * 45;
    const p = snapToWalkable(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r * 0.7);
    return { kind: "find", item, place, x: Math.round(p.x), y: Math.round(p.y), found: false, emoji: "🔎",
      ask: `I lost my ${item.name} somewhere near ${places[place].name}. Could you find it for me?`,
      text: `Find ${requester.name}'s ${item.name} near ${places[place].name}, then give it back` };
  },
  joke: requester => ({ kind: "social", action: "joke", emoji: "😂", ask: "I could really use a good laugh today. Tell me a joke?", text: `Make ${requester.name} laugh with a joke` }),
  hug: (requester, player) => ((Number(requester.relationships?.[player.id]) || 0) >= 30 || (requester.profile?.family || []).some(l => l.id === player.id)
    ? { kind: "social", action: "hug", emoji: "🤗", ask: "It's been a long day. Could I have a hug?", text: `Give ${requester.name} a hug` } : null),
  game: requester => ({ kind: "social", action: "rps", emoji: "✂️", ask: "I'm bored! Play rock, paper, scissors with me?", text: `Play rock, paper, scissors with ${requester.name}` }),
  compliment: requester => ({ kind: "social", action: "compliment", emoji: "🌟", ask: "I'm feeling a bit down. Could you say something nice?", text: `Cheer ${requester.name} up with a compliment` }),
  bring(requester, player, rand, state) {
    const friends = state.residents.filter(o => o !== requester && o !== player && !o.asleep && (Number(requester.relationships?.[o.id]) || 0) >= 25);
    if (!friends.length) return null;
    const friend = friends[Math.floor(rand() * friends.length)];
    const place = ["cafe", "park", "square", "market"][Math.floor(rand() * 4)];
    return { kind: "invite", friendId: friend.id, place, emoji: "📍", ask: `I miss ${friend.name}! Could you invite them to ${places[place].name}?`,
      text: `Invite ${friend.name} to ${places[place].name} for ${requester.name}` };
  },
  cocoa: requester => ({ kind: "use", use: "coffee", building: "cafe", emoji: "☕", ask: "Brrr! Could you make me a hot chocolate at Moonbeam Cafe?", text: `Make ${requester.name} a hot chocolate at Moonbeam Cafe` }),
  ducks: requester => ({ kind: "visit", place: "park", emoji: "🦆", ask: "Could you check the ducks at Juniper Park are okay for me?", text: `Check on the ducks at Juniper Park for ${requester.name}` }),
  flowers: requester => ({ kind: "visit", place: "market", emoji: "💐", ask: "Could you go and see if the flowers at the Corner Market are out yet?", text: `Look at the flowers at the Corner Market for ${requester.name}` })
};

function ensure(r) {
  r.quests = Array.isArray(r.quests) ? r.quests.filter(q => q && q.id && q.text) : [];
  r.questOffers = Array.isArray(r.questOffers) ? r.questOffers.filter(q => q && q.id && q.text) : [];
  r.questsNextAt = Number(r.questsNextAt) || 0;
  r.stars = Number.isFinite(r.stars) ? r.stars : 0;
  r.keepsakes = Array.isArray(r.keepsakes) ? r.keepsakes.slice(-200) : [];
  return r;
}

/**
 * New offers for players now and then (roughly every 20–40 minutes each,
 * while they're awake), from residents who know them. Offers and tasks
 * last until the end of the day.
 */
function tick(state, now, { players, random, dayEnd }) {
  for (const player of players()) {
    ensure(player);
    player.questOffers = player.questOffers.filter(q => q.until > now && state.residents.some(o => o.id === q.requesterId));
    player.quests = player.quests.filter(q => q.until > now && state.residents.some(o => o.id === q.requesterId));
    if (now < player.questsNextAt || player.questOffers.length >= MAX_OFFERS) continue;
    player.questsNextAt = now + (20 + random() * 20) * 60_000;
    const busy = new Set([...player.questOffers, ...player.quests].map(q => q.requesterId));
    const askers = state.residents.filter(o => o !== player && !o.asleep && !busy.has(o.id) && (Number(o.relationships?.[player.id]) || 0) >= 5);
    if (!askers.length) continue;
    const requester = askers[Math.floor(random() * askers.length)];
    const kinds = Object.keys(KINDS);
    for (let attempt = 0; attempt < 6; attempt++) {
      const quest = KINDS[kinds[Math.floor(random() * kinds.length)]](requester, player, random, state);
      if (!quest) continue;
      player.questOffers.push({ ...quest, id: `${now}-${requester.id}`, requesterId: requester.id, requesterName: requester.name, until: dayEnd(now), stars: quest.kind === "find" || quest.kind === "invite" ? 3 : 2 });
      player.lifeRevision = (player.lifeRevision || 0) + 1;
      break;
    }
  }
}

function accept(player, offerId, yes) {
  ensure(player);
  const offer = player.questOffers.find(q => q.id === offerId);
  if (!offer) return { error: "That favour isn't open any more." };
  player.questOffers = player.questOffers.filter(q => q !== offer);
  player.lifeRevision = (player.lifeRevision || 0) + 1;
  if (!yes) return { declined: true };
  if (player.quests.length >= MAX_ACTIVE) { player.questOffers.push(offer); return { error: "You're already helping three people. Finish one first!" }; }
  player.quests.push(offer);
  return { accepted: offer };
}

function complete(state, player, quest, now, reward, addEvent) {
  player.quests = player.quests.filter(q => q !== quest);
  const requester = state.residents.find(o => o.id === quest.requesterId);
  if (!requester) return;
  requester.relationships[player.id] = Math.min(100, (Number(requester.relationships[player.id]) || 0) + 8);
  player.relationships[requester.id] = Math.min(100, (Number(player.relationships[requester.id]) || 0) + 5);
  requester.speech = { text: `Thank you so much, ${player.name}! This is for you.`, from: now + 2500, until: now + 9500 };
  reward(player, quest.stars, giftFrom(requester), `helped ${requester.name}`);
  addEvent(`${quest.emoji} ${player.name} helped ${requester.name}: ${quest.text.charAt(0).toLowerCase()}${quest.text.slice(1)}.`, now);
}

// --- Progress from things players do ---

function onSocial(state, player, target, action, accepted, now, ctx) {
  ensure(player);
  for (const quest of [...player.quests]) {
    if (quest.kind === "social" && quest.requesterId === target.id && quest.action === action && accepted) complete(state, player, quest, now, ctx.reward, ctx.addEvent);
    if (quest.kind === "invite" && action === "invite" && accepted && target.id === quest.friendId && ctx.place === quest.place) complete(state, player, quest, now, ctx.reward, ctx.addEvent);
  }
}

function onUse(state, player, kind, buildingId, now, ctx) {
  ensure(player);
  for (const quest of [...player.quests]) if (quest.kind === "use" && quest.use === kind && quest.building === buildingId) complete(state, player, quest, now, ctx.reward, ctx.addEvent);
}

/** Visiting places, and picking up lost things. */
function onTick(state, player, now, ctx) {
  ensure(player);
  for (const quest of [...player.quests]) {
    if (quest.kind === "visit" && player.place === quest.place && !(player.path || []).length) complete(state, player, quest, now, ctx.reward, ctx.addEvent);
  }
}

/** Pick up a lost thing (tap it on the map). */
function pickUp(player, questId) {
  ensure(player);
  const quest = player.quests.find(q => q.id === questId && q.kind === "find");
  if (!quest || quest.found) return { error: "Nothing to pick up there." };
  if (Math.hypot(quest.x - player.x, quest.y - player.y) > 30) return { error: "Walk a bit closer first." };
  quest.found = true;
  player.lifeRevision = (player.lifeRevision || 0) + 1;
  return { found: quest.item, forName: quest.requesterName };
}

/** Hand a found thing back to its owner (tap them). */
function giveBack(state, player, target, now, ctx) {
  ensure(player);
  const quest = player.quests.find(q => q.kind === "find" && q.found && q.requesterId === target.id);
  if (!quest) return { error: "You haven't found anything of theirs yet." };
  target.speech = null;
  complete(state, player, quest, now, ctx.reward, ctx.addEvent);
  return { given: quest.item };
}

module.exports = { ensure, tick, accept, onSocial, onUse, onTick, pickUp, giveBack, KINDS, GIFTS, LOST, MAX_ACTIVE };
