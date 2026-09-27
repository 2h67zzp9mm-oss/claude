"use strict";

const test = require("node:test");
const assert = require("node:assert");
const speech = require("../lib/speech");
const life = require("../lib/life");
const mind = require("../lib/mind");
const will = require("../lib/will");
const world = require("../shared/world");
const interiors = require("../shared/interiors");
const { cleanup, tempDir, freePort, spawnServer, until, waitForStart, stop, connectClient, api } = require("./helpers");

test.after(cleanup);

test("lines stay up long enough to read, and longer lines stay longer", () => {
  assert.ok(speech.readingMs("Hi!") >= 2800);
  assert.ok(speech.readingMs("Oh, you'll love this: the cafe is testing a cardamom bun and it is honestly the best thing I've tasted all week.") > speech.readingMs("Hi there!"));
  assert.ok(speech.readingMs("word ".repeat(200)) <= 11_000);
});

test("a conversation takes turns: nobody talks over anyone, and nothing gets cut off", () => {
  const a = { name: "A" }, b = { name: "B" };
  const now = 1_000_000;
  const end = speech.conversation([[a, "Guess what?! The ducks are back at the pond!"], [b, "No way!"], [a, "They were all in a row, like a little parade."], [b, "See you later!"]], now);
  const lines = [a.speech, ...a.speechQueue, ...b.speechQueue].filter(Boolean).sort((x, y) => x.from - y.from);
  assert.strictEqual(lines.length, 4);
  for (let i = 1; i < lines.length; i++) assert.ok(lines[i].from >= lines[i - 1].until, "each line waits for the one before");
  assert.ok(end >= lines[3].until);
  // A new line waits for the current one rather than replacing it.
  speech.say(a, "Oh, and one more thing!", now + 100);
  assert.strictEqual(a.speech.text, "Guess what?! The ducks are back at the pond!");
  // The tick brings each line up in its turn.
  const state = { residents: [a, b] };
  speech.tick(state, lines[1].from + 1);
  assert.strictEqual(b.speech.text, "No way!");
  assert.ok(!a.speech, "A has finished her first line");
  speech.tick(state, lines[2].from + 1);
  assert.strictEqual(a.speech.text, "They were all in a row, like a little parade.");
});

test("residents' own chats flow: an opener, an answer, a follow-up and a goodbye", () => {
  const now = Date.now();
  const state = { residents: ["olive", "hazel"].map(id => ({ id, name: life.profiles[id].name, x: 0, y: 0, place: "square", needs: { energy: 80, hunger: 80, social: 40, fun: 40 }, memories: [], relationships: { olive: 60, hazel: 60 }, lastTalk: 0 })) };
  life.hydrateLifeState(state, now);
  state.residents.forEach(r => { mind.ensureMind(r); will.ensure(r); });
  const [olive, hazel] = state.residents;
  mind.converse(olive, hazel, now, "Town Square");
  const lines = [olive.speech, hazel.speech, ...(olive.speechQueue || []), ...(hazel.speechQueue || [])].filter(Boolean).sort((x, y) => x.from - y.from);
  assert.ok(lines.length >= 3 && lines.length <= 5, `${lines.length} turns`);
  for (let i = 1; i < lines.length; i++) assert.ok(lines[i].from >= lines[i - 1].until);
  assert.match(lines[lines.length - 1].text, /later|Bye|lovely day|Talk soon|agree to disagree|We'll see/);
});

test("everyone at home is inside their own home, and nowhere else", () => {
  const cast = ["dad", "olive", "hazel", "milo", "zara", "nova", "finn"];
  for (const id of cast) {
    const home = world.homeOf(id);
    const [x, y] = world.walkNodes[home.node];
    const r = { id, place: "homes", x, y, targetX: x, targetY: y };
    assert.strictEqual(interiors.locate(r, world)?.id, home.id, `${id} is inside ${home.name}`);
  }
  world.setHomeAssignments({ "t-plum": "bigTop" });
  const [bx, by] = world.walkNodes.bigTop;
  assert.strictEqual(interiors.locate({ id: "t-plum", place: "homes", x: bx, y: by, targetX: bx, targetY: by }, world)?.id, "bigTop", "the troupe lives in the Big Top");
  // A visitor standing at the Big Top's door is in the Big Top, not the market next door.
  assert.strictEqual(interiors.locate({ id: "olive", place: null, visiting: "bigTop", x: bx, y: by, targetX: bx, targetY: by }, world)?.id, "bigTop");
  world.setHomeAssignments({});
});

test("on a real server, every door leads into its own building, and visitors don't nap in others' beds", async () => {
  const dataDir = tempDir("living-town-doors-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off" });
  await waitForStart(server);
  const owner = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
  const sean = await connectClient(port, { cookie: owner });
  await until(() => sean.residents.get("dad"), "Sean");
  const dad = () => sean.residents.get("dad");
  const goTo = async (node, label) => {
    const [x, y] = world.walkNodes[node];
    sean.ws.send(JSON.stringify({ type: "control", residentId: "dad", x, y }));
    await until(() => Math.hypot(dad().x - x, dad().y - y) < 1, label, 45000);
  };
  const where = () => interiors.locate(dad(), world)?.id || null;
  world.setHomeAssignments({});

  await goTo("bigTop", "Sean walks to the Big Top");
  await until(() => where() === "bigTop", "inside the Big Top, not the market");
  assert.strictEqual(dad().visiting, "bigTop");
  sean.ws.send(JSON.stringify({ type: "use", residentId: "dad", objectId: "bed1" }));
  await until(() => sean.messages.some(m => m.type === "control-rejected" && /someone else's bed/.test(m.reason)), "no napping in their beds");
  sean.ws.send(JSON.stringify({ type: "use", residentId: "dad", objectId: "sofa" }));
  await until(() => dad().using === "sofa", "but the sofa is fine");
  sean.ws.send(JSON.stringify({ type: "leave-home", residentId: "dad" }));
  await until(() => !dad().visiting && dad().using === null && where() === null, "back outside");

  await goTo("finnHome", "Sean walks to Finn's Cottage");
  await until(() => where() === "finnCottage", "inside Finn's Cottage");
  await goTo("market", "Sean walks to the market door");
  await until(() => where() === "market", "inside the Corner Market");
  await goTo("seanHome", "Sean walks home");
  await until(() => where() === "seanHouse" && dad().place === "homes", "home");
  sean.ws.close();
  assert.strictEqual(await stop(server), 0);
});
