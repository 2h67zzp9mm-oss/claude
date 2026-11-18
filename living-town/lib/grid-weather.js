"use strict";
/**
 * The Grid's sky follows the real weather over Mouse (Mountain Home, Arkansas), from Open-Meteo (no key).
 * Only the fixed coordinates below are ever sent. At most one fetch every few hours; the last reading is kept
 * in data/grid-weather.json. Kindle only ever hears it as the Grid's own weather, never a place name.
 */
const fs = require("fs");
const path = require("path");

const LAT = 36.33534, LON = -92.38516;   // Open-Meteo geocoding: "Mountain Home, Arkansas"
const EVERY = 3 * 60 * 60_000;
const SKY = [[0, "clear"], [1, "mostly clear"], [2, "partly cloudy"], [3, "cloudy"], [48, "foggy"], [57, "drizzly"], [67, "rainy"], [77, "snowy"], [82, "rain showers"], [86, "snow showers"], [99, "stormy"]];
const skyOf = code => (SKY.find(([max]) => code <= max) || [0, "strange"])[1];

function createGridWeather({ dataDir, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  const file = path.join(dataDir, "grid-weather.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } };
  let busy = false;
  /** Fetch a fresh reading if the last one is older than EVERY (or force). Never throws. */
  async function refresh(force = false) {
    const last = read();
    if (busy || (!force && last && now() - last.at < EVERY)) return last;
    busy = true;
    try {
      const r = await fetchImpl(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph`, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
      const c = (await r.json()).current || {};
      const w = { at: now(), sky: skyOf(Number(c.weather_code)), tempF: Math.round(c.temperature_2m), windMph: Math.round(c.wind_speed_10m), day: c.is_day === 1 };
      fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(w, null, 2));
      return w;
    } catch (err) { console.warn(new Date(now()).toISOString(), "Grid weather fetch failed:", err.message); return last; }
    finally { busy = false; }
  }
  /** One in-world line, e.g. "rainy, cool (48°F), breezy". */
  function describe() {
    const w = read(); if (!w) return "";
    const feel = w.tempF < 32 ? "freezing" : w.tempF < 50 ? "cold" : w.tempF < 65 ? "cool" : w.tempF < 80 ? "warm" : "hot";
    return `${w.sky}, ${feel} (${w.tempF}°F)${w.windMph >= 20 ? ", windy" : w.windMph >= 10 ? ", breezy" : ""}`;
  }
  return { refresh, read, describe };
}

module.exports = { createGridWeather, skyOf };
