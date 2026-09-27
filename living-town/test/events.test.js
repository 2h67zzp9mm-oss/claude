"use strict";

const test = require("node:test");
const assert = require("node:assert");
const world = require("../shared/world");
const life = require("../lib/life");
const mind = require("../lib/mind");
const will = require("../lib/will");
const events = require("../lib/events");
const tasks = require("../lib/tasks");
const { isSafe } = require("../lib/mre");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

const DAY = new Date("2026-10-10T00:00:00");
const at = (h, m = 0) => { const d = new Date(DAY); d.setHours(h, m, 0, 0); return d.getTime(); };

test("Mr. E's programme: something every hour, no repeats, evening things in the evening, same for everyone", () => {
  const list = events.programmeFor(DAY);
  assert.deepStrictEqual(list.map(e => e.hour), [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.strictEqual(new Set(list.map(e => e.type)).size, list.length, "no repeats in a day");
  for (const e of list) {
    const def = events.CATALOG[e.type];
    if (e.hour >= 19) assert.ok(!def.day, `${def.name} isn't a daytime-only thing at ${e.hour}`);
    else assert.ok(!def.evening, `${def.name} isn't an evening thing at ${e.hour}`);
    assert.ok(e.end > e.start && e.end - e.start <= 45 * 60_000);
  }
  assert.deepStrictEqual(events.programmeFor(new Date(DAY)), list, "the same programme for everyone");
  assert.notDeepStrictEqual(events.programmeFor(new Date("2026-10-11T00:00:00")).map(e => e.type), list.map(e => e.type), "a different day, a different line-up");
  assert.ok(!events.programmeFor(DAY, { showHours: [14, 15] }).some(e => [14, 15].includes(e.hour)), "the circus show keeps its hours");
  // Across a fortnight every kind of event turns up.
  const seen = new Set();
  for (let d = 0; d < 14; d++) events.programmeFor(new Date(DAY.getTime() + d * 86_400_000)).forEach(e => seen.add(e.type));
  assert.strictEqual(seen.size, Object.keys(events.CATALOG).length);
});

test("everything Mr. E says, every keepsake and every riddle is gentle", () => {
  for (const def of Object.values(events.CATALOG)) for (const text of [def.name, def.line, def.keepsake.name, def.activity || "", def.item?.name || ""]) assert.ok(isSafe(text), text);
  for (const r of events.RIDDLES) {
    assert.ok(isSafe(r.q) && r.options.every(isSafe), r.q);
    assert.ok(r.answer >= 0 && r.answer < 3 && r.options.length === 3);
  }
  for (const make of Object.values(tasks.KINDS)) assert.strictEqual(typeof make, "function");
  for (const gift of Object.values(tasks.GIFTS)) assert.ok(isSafe(gift.name), gift.name);
  for (const lost of tasks.LOST) assert.ok(isSafe(lost.name));
});

function player(id = "olive") {
  return { id, name: life.profiles[id]?.name || id, x: 240, y: 105, targetX: 240, targetY: 105, place: "park", path: [], relationships: {}, memories: [], needs: { energy: 80, hunger: 80, social: 70, fun: 70 }, mood: { valence: 60, stress: 20 } };
}

function programmeFor(state, players) {
  const rewards = [];
  const feed = [];
  let seed = 5;
  const p = events.createProgramme({
    addEvent: text => feed.push(text), announce: text => feed.push(`Mr. E: ${text}`), showHours: () => [], players: () => players,
    reward: (r, stars, keepsake, why) => rewards.push({ who: r.id, stars, keepsake: keepsake?.name || null, why }),
    random: () => (seed = (seed * 16807) % 2147483647) / 2147483647
  });
  return { p, rewards, feed };
}

test("hunts: items on the walkways, everyone can find every one, and finding them all earns a keepsake", () => {
  const state = { residents: [], effects: [] };
  const olive = player("olive"), hazel = player("hazel");
  const { p, rewards, feed } = programmeFor(state, [olive, hazel]);
  const hunt = events.programmeFor(DAY).find(e => events.CATALOG[e.type].kind === "hunt");
  p.tick(state, hunt.start + 1000);
  const event = state.programme.current;
  assert.strictEqual(event.type, hunt.type);
  assert.ok(feed.some(t => t.startsWith("Mr. E:")), "Mr. E announces it");
  assert.ok(state.effects.some(e => e.programme && e.place === event.place), "residents are drawn to it");
  for (const item of event.items) {
    const onPath = world.snapToWalkable(item.x, item.y);
    assert.ok(Math.hypot(onPath.x - item.x, onPath.y - item.y) < 1, "on the walkways");
  }
  assert.match(p.collect(state, olive, event.items[0].id, Date.now()).error, /closer/);
  for (const item of event.items) {
    Object.assign(olive, { x: item.x, y: item.y });
    Object.assign(hazel, { x: item.x, y: item.y });
    assert.ok(p.collect(state, olive, item.id, Date.now()).found);
    assert.ok(p.collect(state, hazel, item.id, Date.now()).found, "Hazel can find it too");
  }
  assert.match(p.collect(state, olive, event.items[0].id, Date.now()).error, /already/);
  assert.ok(rewards.some(r => r.who === "olive" && r.keepsake) && rewards.some(r => r.who === "hazel" && r.keepsake));
  p.tick(state, event.end + 1);
  assert.strictEqual(state.programme.current, null, "and then it's over");
});

test("gatherings reward joining in; riddles reward the right answer, one try each", () => {
  const state = { residents: [], effects: [] };
  const olive = player("olive");
  const { p, rewards } = programmeFor(state, [olive]);
  // Find a day with a gathering and a riddle.
  let gather, riddle;
  for (let d = 0; d < 30 && !(gather && riddle); d++) {
    const list = events.programmeFor(new Date(DAY.getTime() + d * 86_400_000));
    gather = gather || list.find(e => events.CATALOG[e.type].kind === "gather" && events.CATALOG[e.type].place === "park");
    riddle = riddle || list.find(e => events.CATALOG[e.type].kind === "riddle");
  }
  p.tick(state, gather.start + 1000);
  p.tick(state, gather.start + 60_000);
  assert.ok(!rewards.length, "not after a moment");
  p.tick(state, gather.start + 3.5 * 60_000);
  p.tick(state, gather.start + 5 * 60_000);
  assert.strictEqual(rewards.filter(r => r.keepsake).length, 1, "joined in, once");
  p.tick(state, gather.end + 1);

  p.tick(state, riddle.start + 1000);
  const answer = state.programme.current.riddle.answer;
  assert.ok(p.answer(state, olive, answer, Date.now()).right);
  assert.match(p.answer(state, olive, answer, Date.now()).error, /already/);
  assert.ok(rewards.some(r => /riddle/.test(r.why) && r.keepsake));
  const view = p.publicView(state, riddle.start + 2000);
  assert.ok(view.now.riddle.q && !("answer" in view.now.riddle), "phones never see the answer");
  assert.strictEqual(view.today.length, 14);
});

test("favours: offers from people who know you, up to three at a time, each done the right way", () => {
  const now = at(10);
  const state = { residents: Object.keys(life.profiles).filter(id => !life.profiles[id].custom).map(id => ({ ...player(id), place: "square", x: 477, y: 330 })) };
  life.hydrateLifeState(state, now);
  state.residents.forEach(r => { mind.ensureMind(r); will.ensure(r); tasks.ensure(r); });
  for (const a of state.residents) for (const b of state.residents) if (a !== b) a.relationships[b.id] = 40;
  const olive = state.residents.find(r => r.id === "olive");
  const rewards = [], feed = [];
  const ctx = { reward: (r, stars, keepsake) => rewards.push({ who: r.id, stars, keepsake }), addEvent: t => feed.push(t) };
  let seed = 3;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6; i++) { olive.questsNextAt = 0; tasks.tick(state, now + i, { players: () => [olive], random, dayEnd: () => now + 86_400_000 }); }
  assert.ok(olive.questOffers.length >= 1 && olive.questOffers.length <= 2, "a couple of offers at a time");
  for (const offer of olive.questOffers) assert.ok(isSafe(offer.ask) && isSafe(offer.text), offer.text);

  // Each kind, done properly.
  const finn = state.residents.find(r => r.id === "finn");
  const make = (kind, extra = {}) => ({ ...tasks.KINDS[kind](finn, olive, random, state), id: `q-${kind}`, requesterId: "finn", requesterName: "Finn", until: now + 3_600_000, stars: 2, ...extra });
  olive.quests = [make("joke"), make("cocoa"), make("ducks")];
  olive.questOffers.push(make("compliment", { id: "extra" }));
  assert.match(tasks.accept(olive, "extra", true).error, /three/, "no more than three at a time");
  tasks.onSocial(state, olive, finn, "joke", false, now, ctx);
  assert.strictEqual(olive.quests.length, 3, "a joke that falls flat doesn't count");
  tasks.onSocial(state, olive, finn, "joke", true, now, ctx);
  tasks.onUse(state, olive, "coffee", "cafe", now, ctx);
  olive.place = "park";
  tasks.onTick(state, olive, now, ctx);
  assert.strictEqual(olive.quests.length, 0);
  assert.strictEqual(rewards.filter(r => r.keepsake?.name === "Finn's carved wooden bird").length, 3, "Finn's thank-you gift");
  assert.ok(finn.relationships.olive > 40);

  // Finding something he lost, and giving it back.
  const lost = make("find");
  olive.quests = [lost];
  assert.match(tasks.pickUp(olive, lost.id).error, /closer/);
  Object.assign(olive, { x: lost.x, y: lost.y });
  assert.ok(tasks.pickUp(olive, lost.id).found);
  assert.ok(tasks.giveBack(state, olive, finn, now, ctx).given);
  assert.ok(feed.some(t => /Olive helped Finn: find Finn's/.test(t)));
});

test("on a real server: today's line-up reaches phones, and a favour can be taken on", async () => {
  const dataDir = tempDir("living-town-events-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off" });
  await waitForStart(server);
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  const sean = await connectClient(port, { cookie: owner });
  await until(() => sean.messages.some(m => m.type === "state" && m.town?.programme?.today?.length), "today's programme");
  const today = sean.messages.find(m => m.type === "state").town.programme.today;
  assert.ok(today.length >= 12 && today.every(e => e.name && e.emoji && e.start));
  await until(() => sean.residents.get("dad")?.questOffers?.length > 0, "a favour for Sean", 20000);
  const offer = sean.residents.get("dad").questOffers[0];
  sean.ws.send(JSON.stringify({ type: "quest", residentId: "dad", offerId: offer.id, accept: true }));
  await until(() => sean.messages.some(m => m.type === "play-result" && m.kind === "quest"), "reply");
  assert.strictEqual(sean.messages.find(m => m.type === "play-result" && m.kind === "quest").accepted, offer.text);
  await until(() => sean.residents.get("dad").quests?.some(q => q.id === offer.id), "it's on Sean's list");
  sean.ws.send(JSON.stringify({ type: "quest", residentId: "olive", offerId: offer.id, accept: true }));
  await until(() => sean.messages.filter(m => m.type === "play-result").length === 2, "reply");
  assert.match(sean.messages.filter(m => m.type === "play-result")[1].error, /own character/);
  sean.ws.close();
  assert.strictEqual(await stop(server), 0);
});
