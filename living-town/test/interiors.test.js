const test = require("node:test");
const assert = require("node:assert");
const I = require("../shared/interiors.js");

test("everyone can be placed in every building, even doing something unknown", () => {
  for (const [id, plan] of Object.entries(I.plans)) {
    const spots = I.placeHousehold(plan, [
      { id: "a", asleep: false, activity: "looking around " + id },
      { id: "b", asleep: false, activity: "zzz something nobody planned for" }
    ], []);
    for (const k of ["a", "b"]) {
      const p = spots.get(k);
      assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.y), id + " placed " + k);
    }
  }
});
