"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createGridWeather, skyOf } = require("../lib/grid-weather");

test("weather is fetched once, cached for hours, and described without a place name", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grid-weather-"));
  let t = 1_000_000, calls = 0, asked = "";
  const fetchImpl = async url => { calls++; asked = url; return { ok: true, json: async () => ({ current: { temperature_2m: 47.6, weather_code: 61, wind_speed_10m: 12, is_day: 1 } }) }; };
  const w = createGridWeather({ dataDir, fetchImpl, now: () => t });
  await w.refresh();
  assert.equal(calls, 1);
  assert.match(asked, /latitude=36\.33534&longitude=-92\.38516/);
  assert.equal(w.describe(), "rainy, cold (48°F), breezy");
  assert.doesNotMatch(w.describe(), /Mountain|Arkansas/);
  t += 60 * 60_000; await w.refresh(); assert.equal(calls, 1, "still fresh after an hour");
  t += 3 * 60 * 60_000; await w.refresh(); assert.equal(calls, 2, "fetched again after three hours");
});

test("a failed fetch keeps the last reading and never throws", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grid-weather-"));
  const w = createGridWeather({ dataDir, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(await w.refresh(), null);
  assert.equal(w.describe(), "");
  assert.equal(skyOf(0), "clear");
  assert.equal(skyOf(95), "stormy");
});
