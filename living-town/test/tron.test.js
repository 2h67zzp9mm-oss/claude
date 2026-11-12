const test = require("node:test");
const assert = require("node:assert");
const world = require("../shared/world");
const { createTron } = require("../lib/tron");

test("Glint walks, notices odd things, and answers from his notes", () => {
  const tron = createTron({ world, dir: null, random: () => 0.3 });
  const r = (id, extra) => ({ id, name: id, place: "square", activity: "chatting", needs: { hunger: 80, energy: 80, social: 80, fun: 80 }, relationships: {}, x: 100, y: 100, ...extra });
  const state = { residents: [r("A", { needs: { hunger: 5, energy: 80, social: 80, fun: 80 } }), r("B"), r("P", { x: 300 })], programme: {} };
  const ctx = { players: () => [state.residents[2]], isPlayer: x => x.id === "P" };
  const now = Date.now();
  tron.tick(state, now, ctx);
  const notes = tron.notes(state).map(n => n.text).join(" | ");
  assert.match(notes, /A is running very low on hunger/);
  assert.match(notes, /A and B are standing on exactly the same spot/);
  assert.match(tron.answer(state, "anything weird?"), /same spot/);
  assert.match(tron.answer(state, "who needs help"), /hunger/);
  const v = tron.publicView(state);
  assert.ok(Number.isFinite(v.x) && v.notes >= 2);
});
