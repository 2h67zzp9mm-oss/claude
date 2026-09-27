"use strict";

const test = require("node:test");
const assert = require("node:assert");
const life = require("../lib/life");
const mind = require("../lib/mind");
const will = require("../lib/will");
const social = require("../lib/social");
const { isSafe } = require("../lib/mre");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

const NOW = new Date("2026-10-10T11:00:00").getTime();

function town() {
  const state = {
    events: [],
    residents: Object.keys(life.profiles).filter(id => !life.profiles[id].custom).map(id => ({
      id, name: life.profiles[id].name, x: 477, y: 330, place: "square", needs: { energy: 80, hunger: 40, social: 50, fun: 50 }, memories: [], relationships: {}, lastTalk: 0, asleep: false
    }))
  };
  life.hydrateLifeState(state, NOW);
  state.residents.forEach(r => { mind.ensureMind(r); will.ensure(r); });
  for (const a of state.residents) for (const b of state.residents) if (a !== b) a.relationships[b.id] = 50;
  return state;
}

function ctx(state, roll, extra = {}) {
  const calls = { follow: [], goTo: [] };
  return {
    calls, mindFor: mind.mindFor, random: () => roll, addEvent: text => state.events.push(text),
    obligation: () => null, isFamily: (a, b) => (a.profile?.family || []).some(l => l.id === b.id),
    startFollow: (who, leader) => calls.follow.push([who.id, leader.id]),
    goTo: (who, place) => calls.goTo.push([who.id, place]), ...extra
  };
}
const get = (state, id) => state.residents.find(r => r.id === id);

test("every line is gentle, and there's no romance of any kind", () => {
  for (const [id, a] of Object.entries(social.ACTIONS)) {
    assert.ok(!/flirt|kiss|date|love|crush|romance/i.test(`${id} ${a.label}`), id);
    const texts = [...a.ask, ...a.yes, ...a.no, ...(a.yesEffect.feel || []), ...(a.noEffect.feel || []), ...(a.yesEffect.actorFeel || []), ...(a.noEffect.actorFeel || [])];
    for (const text of texts) assert.ok(isSafe(text.replace(/\{\w+\}/g, "Olive")), `${id}: ${text}`);
  }
  assert.ok(social.menu().length >= 10);
});

test("they're people about it: a warm joke lands, a flop doesn't, and friendship moves", () => {
  const state = town();
  const hazel = get(state, "hazel"), finn = get(state, "finn");
  const yes = social.perform(state, hazel, finn, "joke", NOW, ctx(state, 0.01));
  assert.ok(yes.accepted);
  assert.ok(finn.relationships.hazel > 50 && finn.feelings.some(f => f.emoji === "😂"));
  assert.ok(hazel.speech.text && finn.speechQueue[0].from >= hazel.speech.until, "she says it, then he answers once she's finished");
  assert.ok(finn.memories[0].text.includes(hazel.speech.text), "he remembers it");
  const before = finn.relationships.hazel;
  const no = social.perform(state, hazel, finn, "joke", NOW + 5000, ctx(state, 0.99));
  assert.ok(!no.accepted);
  assert.ok(finn.relationships.hazel <= before);
  assert.ok(hazel.feelings.some(f => /fell flat/.test(f.text)));
});

test("hugs need a friendship (family always counts); a treat fills you up", () => {
  const state = town();
  const olive = get(state, "olive"), nova = get(state, "nova"), dad = get(state, "dad");
  nova.relationships.olive = 10;
  assert.ok(!social.perform(state, olive, nova, "hug", NOW, ctx(state, 0)).accepted, "not with someone she barely knows");
  dad.relationships.olive = 10;
  assert.ok(social.perform(state, olive, dad, "hug", NOW, ctx(state, 0)).accepted, "Dad always hugs");
  const hunger = olive.needs.hunger;
  assert.ok(social.perform(state, olive, get(state, "milo"), "beg", NOW, ctx(state, 0)).accepted);
  assert.ok(olive.needs.hunger > hunger && olive.feelings.some(f => f.emoji === "🍪"));
});

test("teasing can go wrong, and saying sorry puts it right (and counts toward making up)", () => {
  const state = town();
  const plum = get(state, "hazel"), zara = get(state, "zara");
  zara.relationships.hazel = 20;
  const teased = social.perform(state, plum, zara, "tease", NOW, ctx(state, 0.99));
  assert.ok(!teased.accepted && zara.relationships.hazel < 20);
  assert.ok(zara.feelings.some(f => f.emoji === "😠") && zara.memories[0].tone === "friction");
  assert.ok(state.events.some(e => /didn't like Hazel's teasing/.test(e)));
  // Zara now wishes to make up; a sorry does it.
  const wish = will.candidates(state, zara, NOW + 1000, { mindFor: mind.mindFor, activities: mind.activities }).find(w => w.type === "makeup");
  zara.wishes = [{ ...wish, createdAt: NOW + 1000, until: NOW + 3_600_000 }];
  const sorry = social.perform(state, plum, zara, "sorry", NOW + 2000, ctx(state, 0.01));
  assert.ok(sorry.accepted);
  assert.ok(!zara.feelings.some(f => f.emoji === "😠"), "no longer upset");
  zara.will.nextWishAt = Infinity; zara.will.nextInviteAt = Infinity;
  will.tick(state, NOW + 3000, { mindFor: mind.mindFor, activities: mind.activities, random: () => 0.5, addEvent: t => state.events.push(t), isControlled: () => true, obligation: () => null, sameSpot: () => true, go: () => false });
  assert.ok(state.events.some(e => /Zara's wish came true: Make up with Hazel/.test(e)));
});

test("asking about wishes, following, invitations, and busy people", () => {
  const state = town();
  const hazel = get(state, "hazel"), olive = get(state, "olive");
  olive.wishes = [{ type: "do", place: "park", text: "Watch the ducks at Juniper Park", reason: "wants to watch the ducks", emoji: "🦆" }];
  const asked = social.perform(state, hazel, olive, "wish", NOW, ctx(state, 0.01));
  assert.match(asked.targetLine, /watch the ducks/);
  const c = ctx(state, 0.01);
  social.perform(state, hazel, olive, "follow", NOW, c);
  assert.deepStrictEqual(c.calls.follow, [["olive", "hazel"]]);
  const c2 = ctx(state, 0.01);
  assert.ok(social.perform(state, hazel, olive, "invite", NOW, c2, { place: "park" }).accepted);
  assert.deepStrictEqual(c2.calls.goTo, [["olive", "park"]]);
  assert.ok(social.perform(state, hazel, olive, "invite", NOW, ctx(state, 0.01)).error, "an invitation needs a place");
  const busy = ctx(state, 0.01, { obligation: () => ({ place: "square", strict: true }) });
  assert.ok(!social.perform(state, hazel, olive, "follow", NOW, busy).accepted, "not while she's in class");
  assert.strictEqual(social.relLabel(90, false), "Best friends");
  assert.strictEqual(social.relLabel(-5, false), "Not getting along");
});

test("on a real server: only your own character, only close by, never someone asleep", async () => {
  const dataDir = tempDir("living-town-social-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off" });
  await waitForStart(server);
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  const sean = await connectClient(port, { cookie: owner });
  await until(() => sean.residents.size === 7, "everyone");
  const result = () => sean.messages.filter(m => m.type === "social-result").pop();
  const count = () => sean.messages.filter(m => m.type === "social-result").length;

  sean.ws.send(JSON.stringify({ type: "social", residentId: "olive", targetId: "dad", action: "chat" }));
  await until(() => count() === 1, "reply");
  assert.match(result().error, /your own character/);

  const others = () => [...sean.residents.values()].filter(r => r.id !== "dad");
  // Walk Sean somewhere well away from everyone, then try to chat across town.
  const spots = [[130, 290], [852, 440], [240, 105], [665, 180], [228, 476]];
  const lonely = spots.sort((a, b) => Math.min(...others().map(o => Math.hypot(o.x - b[0], o.y - b[1]))) - Math.min(...others().map(o => Math.hypot(o.x - a[0], o.y - a[1]))))[0];
  sean.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: lonely[0], y: lonely[1] }));
  await until(() => { const d = sean.residents.get("dad"); return Math.hypot(d.targetX - d.x, d.targetY - d.y) < 1 && Math.hypot(d.x - lonely[0], d.y - lonely[1]) < 30; }, "Sean walks off", 45000);
  const dad = sean.residents.get("dad");
  const far = others().sort((a, b) => Math.hypot(b.x - dad.x, b.y - dad.y) - Math.hypot(a.x - dad.x, a.y - dad.y))[0];
  assert.ok(Math.hypot(far.x - dad.x, far.y - dad.y) > 60, "someone is out of reach");
  await new Promise(resolve => setTimeout(resolve, 1600));
  sean.ws.send(JSON.stringify({ type: "social", residentId: "dad", targetId: far.id, action: "chat" }));
  await until(() => count() === 2, "reply");
  assert.match(result().error, /closer|asleep/);

  // Walk over to someone awake and say hi.
  const awake = others().find(r => !r.asleep);
  if (awake) {
    // They may wander a little (people mill about), so keep heading their way until close.
    let aimed = 0;
    await until(() => {
      const t = sean.residents.get(awake.id), d = sean.residents.get("dad");
      if (Date.now() - aimed > 1500) { aimed = Date.now(); sean.ws.send(JSON.stringify({ type: "control", residentId: "dad", x: t.x + 6, y: t.y })); }
      return Math.hypot(d.x - t.x, d.y - t.y) < 30;
    }, "Sean walks over", 60000);
    await new Promise(resolve => setTimeout(resolve, 1600));
    sean.ws.send(JSON.stringify({ type: "social", residentId: "dad", targetId: awake.id, action: "compliment" }));
    await until(() => count() === 3, "reply");
    const r = result();
    if (r.error) assert.match(r.error, /asleep|closer/);
    else {
      assert.strictEqual(typeof r.accepted, "boolean");
      assert.ok(r.actorLine && r.targetLine && r.relationship);
      await until(() => sean.residents.get(awake.id).speech?.text === r.targetLine, "their reply shows as a bubble");
    }
    // Two in a row: the second is too soon.
    await new Promise(resolve => setTimeout(resolve, 1600));
    sean.ws.send(JSON.stringify({ type: "social", residentId: "dad", targetId: awake.id, action: "chat" }));
    sean.ws.send(JSON.stringify({ type: "social", residentId: "dad", targetId: awake.id, action: "joke" }));
    await until(() => count() === 5, "replies");
    assert.match(result().error || "", /One thing at a time|asleep|closer/, "not too fast");
  }
  sean.ws.close();
  assert.strictEqual(await stop(server), 0);
});
