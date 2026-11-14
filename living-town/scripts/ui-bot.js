"use strict";
/**
 * The UI keeper's eyes. Starts a private throwaway server, signs in a test phone (390x844), opens every
 * menu in every world, takes a picture of each and measures it against UI_RULES.md.
 *
 *   node scripts/ui-bot.js [outDir]      (default: a new folder in the system temp directory)
 *
 * Writes <outDir>/<screen>.jpg and <outDir>/report.json, prints one line per screen, and exits 1 if any
 * rule is broken. It never touches the live server or real accounts.
 * New menu or new world? Add it to SCREENS below (worlds are picked up from the World menu by themselves).
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawn } = require("node:child_process");
const { tempDir, freePort, spawnServer, waitForStart, api, stop } = require("../test/helpers");

const out = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "ui-bot-")));
const W = 390, H = 844;

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter(d => d.startsWith("chromium_headless_shell")).sort().reverse() : [];
  for (const d of dirs) { const p = path.join(cache, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell"); if (fs.existsSync(p)) return p; }
  const app = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (fs.existsSync(app)) return app;
  throw new Error("No Chrome found. Set CHROME=/path/to/chrome.");
}

// Every menu the home plot can show: [name, how to open it from the idle bar]. "pop:" taps a thing in the world.
const SCREENS = [
  ["idle", []], ["goals", ["Goals"]], ["story", ["Goals", "Story"]], ["build", ["Goals", "Build"]], ["book", ["Goals", "Book"]], ["level", ["Goals", "Level"]],
  ["pets", ["Pets"]], ["bag", ["Bag"]], ["look", ["Look"]], ["world", ["World"]], ["house", ["World", "Pick house"]],
  ["pop-plot", ["pop:plot"]], ["pop-pond", ["pop:pond"]], ["pop-mailbox", ["pop:mailbox"]], ["pop-crate", ["pop:crate"]], ["shop", ["pop:crate", "Seed shop"]]
];
// Every menu is pictured once, in the first world that has it (the menus are the same everywhere); these are pictured in every world, to see them on its colours.
const PICTURED_EVERYWHERE = ["idle", "goals", "pop-plot"];

// Runs in the page. Helpers to drive the real buttons, and the measuring stick for UI_RULES.md.
const PAGE = `(() => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const bar = () => document.querySelector(".home-bar"), pop = () => document.querySelector(".home-pop:not(.hidden)"), gate = () => document.querySelector("#playerGate .gate-card");
  const btn = (t, root) => [...(root || bar()).querySelectorAll("button")].find(b => b.innerText.includes(t));
  const T = () => window.LivingTownHome._test, canvas = () => document.querySelector("#homestead canvas");
  const tapAt = (x, y) => { const [sx, sy] = T().screenOf(x, y), r = canvas().getBoundingClientRect(); canvas().dispatchEvent(new MouseEvent("click", { clientX: r.left + sx, clientY: r.top + sy, bubbles: true })); };
  async function home() {   // back to the idle bar, whatever is open
    if (gate()) { document.querySelector("#playerGate #backMenu")?.click(); await w(250); }
    for (let i = 0; i < 6 && (pop() || !btn("Town")); i++) { const p = pop(); const b = (p && (btn("Done", p) || btn("Back", p) || btn("Stay", p) || btn("OK", p))) || btn("Back") || btn("Close") || btn("Done") || btn("Thanks") || btn("OK"); if (!b) break; b.click(); await w(250); }
    return !!btn("Town") && !pop();
  }
  async function open(steps) {
    if (!await home()) return "could not get back to the main buttons";
    for (const s of steps) {
      if (s.startsWith("pop:")) {
        const L = T().L(), k = s.slice(4), r = k === "plot" ? T().plotRect(0) : null;
        const at = k === "plot" ? [r.cx, r.cy] : k === "pond" ? [L.pond.x, L.pond.y] : L[k];
        tapAt(at[0], at[1]); await w(450); if (!pop()) return "nothing popped up for the " + k;
      } else if (pop()) {   // a pop-up button: the player walks over first, then the menu opens
        const b = btn(s, pop()); if (!b) return "missing"; b.click();
        for (let i = 0; i < 40 && (pop() || btn("Town")); i++) await w(250);
        if (btn("Town")) return "nothing opened after tapping " + s;
      } else { const b = btn(s); if (!b) return "missing"; b.click(); await w(450); }
    }
    return "";
  }
  function audit() {
    const bad = [], vw = innerWidth, vh = innerHeight, name = b => JSON.stringify(b.innerText.replace(/\\s+/g, " ").trim().slice(0, 24));
    const boxes = (gate() ? [["the full-screen editor", gate()]] : [[".home-bar", bar()], [".home-pop", pop()]]).filter(x => x[1]);
    // The finger ring (a .home-pop.home-ring) has its own rules: round buttons fully on screen, and a Done in the middle.
    const ring = pop() && pop().classList.contains("home-ring") ? pop() : null;
    if (ring) {
      for (const b of ring.querySelectorAll("button")) {
        const q = b.getBoundingClientRect();
        if (q.width < 44 || q.height < 44) bad.push("ring button " + name(b) + " is smaller than 44x44");
        if (q.left < -0.5 || q.right > vw + 0.5 || q.top < -0.5 || q.bottom > vh + 0.5) bad.push("ring button " + name(b) + " runs off the screen");
        const barTop = bar()?.getBoundingClientRect().top ?? vh; if (q.bottom > barTop + 0.5) bad.push("ring button " + name(b) + " is under the bottom bar");
      }
      if (!ring.querySelector(".ring-mid")) bad.push("the ring has no Done in the middle");
      for (const e of ring.querySelectorAll(".ring-btn span")) if (e.scrollWidth > e.clientWidth + 1) bad.push("ring text " + JSON.stringify(e.innerText.slice(0, 24)) + " is cut off");
    }
    for (const [sel, el] of boxes) {
      if (el === ring) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -0.5 || r.right > vw + 0.5) bad.push(sel + " runs off the side of the screen");
      if (r.top < -0.5 || r.bottom > vh + 0.5) bad.push(sel + " runs off the top or bottom of the screen");
      if (el.scrollWidth > el.clientWidth + 1) bad.push(sel + " scrolls sideways");
      for (const b of el.querySelectorAll("button")) {
        const q = b.getBoundingClientRect(); if (!q.width) continue;
        if (q.height < 44 || q.width < 44) bad.push("button " + name(b) + " is " + Math.round(q.width) + "x" + Math.round(q.height) + " (smallest allowed is 44x44)");
        if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) bad.push("button " + name(b) + " has clipped text");
        if (q.height > 62) bad.push("button " + name(b) + " wraps onto too many lines (" + Math.round(q.height) + "px tall)");
        if (q.right > r.right + 0.5 || q.left < r.left - 0.5) bad.push("button " + name(b) + " sticks out of its panel");
      }
      for (const e of el.querySelectorAll("b, span, small, p")) { if (e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== "inline") bad.push("text " + JSON.stringify(e.innerText.slice(0, 24)) + " is cut off"); }
    }
    // The way out is always the last button, and it is in view without scrolling.
    for (const [sel, el] of boxes) {
      if (el === ring) continue;
      const all = [...el.querySelectorAll(".home-actions button")], last = all[all.length - 1]; if (!last) continue;
      if (!btn("Town", el) && !/^(Back|Done|Close|OK|Stay|Stop|Thanks!?)$/.test(last.innerText.replace(/^[^A-Za-z]+/, "").trim())) bad.push(sel + " has no way out as its last button (it ends with " + name(last) + ")");
      const r = el.getBoundingClientRect(), q = last.getBoundingClientRect();
      if (q.bottom > r.bottom + 0.5 || q.top < r.top - 0.5) bad.push(sel + " hides its last button " + name(last) + " until you scroll");
    }
    // A full-screen editor keeps Back and its main button pinned at the bottom, in view without scrolling.
    if (gate()) for (const sel of ["#backMenu", ".look-foot .wide-button"]) { const e = gate().querySelector(sel), q = e && e.getBoundingClientRect(); if (!e) bad.push("the full-screen editor has no " + sel + " at the bottom"); else if (q.bottom > vh + 0.5 || q.top < vh * 0.6) bad.push("the full-screen editor's " + name(e) + " is not pinned at the bottom by the thumbs"); }
    const b = gate() ? null : bar(); if (b) { const r = b.getBoundingClientRect(); if (r.height > vh * 0.5) bad.push(".home-bar covers " + Math.round(100 * r.height / vh) + "% of the screen (clean and compact: keep it under half)"); if (vh - r.bottom > 40) bad.push(".home-bar is not at the bottom by the thumbs"); }
    const top = document.querySelector(".home-top"); if (top && top.querySelector("button, a, input")) bad.push("the top bar has something to tap (the top is display-only)");
    // One look everywhere: the same panel, button and text styles in every world.
    const cs = (e, keys) => e ? keys.map(k => getComputedStyle(e)[k]).join("|") : "";
    const first = b && b.querySelector(".home-actions button:not(.big):not(:disabled)"), big = b && b.querySelector(".home-actions button.big");
    const look = { bar: cs(b, ["backgroundColor", "borderRadius", "color", "fontFamily", "padding"]), button: cs(first, ["backgroundColor", "borderRadius", "color", "fontFamily", "fontSize", "fontWeight", "minHeight"]),
      big: cs(big, ["backgroundColor", "color"]), top: cs(top, ["color", "fontFamily", "fontSize", "fontWeight"]) };
    return { bad, look, text: (pop() || b)?.innerText.replace(/\\s+/g, " ").slice(0, 160) || "" };
  }
  async function worlds() { if (!await home()) return []; btn("World").click(); await w(400); const names = [...bar().querySelectorAll("button")].map(x => x.innerText.trim()).filter(t => !/Back|Pick house|Glint/.test(t)); await home(); return names; }
  async function goWorld(label) { if (!await home()) return false; btn("World").click(); await w(400); const b = btn(label); if (!b) return false; b.click(); await w(400); await home(); return true; }
  window.__ui = { open, audit, home, worlds, goWorld, ready: () => !!(window.LivingTownHome && canvas() && bar() && btn("Town") && T().view()) };
  return true;
})()`;

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const dataDir = tempDir("ui-bot-data-"), port = await freePort(), debugPort = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_MRE_AI: "off" });
  let chrome = null;
  const report = { when: new Date().toISOString(), screens: [], problems: [] };
  const problem = (screen, text) => { report.problems.push({ screen, text }); };
  try {
    await waitForStart(server);
    const cookie = (await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
    const url = `http://127.0.0.1:${port}/`;
    chrome = spawn(findChrome(), ["--headless", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--window-size=${W},${H}`, `--user-data-dir=${tempDir("ui-bot-chrome-")}`, "about:blank"], { stdio: "ignore" });
    let target = null;
    for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(t => t.type === "page"); } catch { /* not up yet */ } }
    if (!target) throw new Error("Chrome did not start");
    const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0; const waiting = new Map(), errors = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.split("\n")[0] || m.params.exceptionDetails.text);
    };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params = {}) => new Promise(res => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const run = async expression => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "page error"); return r.result?.result?.value; };
    const shot = async name => { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 }); fs.writeFileSync(path.join(out, name + ".jpg"), Buffer.from(r.result.data, "base64")); };
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    const [cname, ...cval] = cookie.split("="); await send("Network.setCookie", { name: cname, value: cval.join("="), url });
    await send("Page.navigate", { url }); await sleep(4000);
    for (let i = 0; i < 12 && !await run("!!window.LivingTownHome?.isOpen"); i++) await sleep(500);   // the app opens the home plot by itself after sign-in
    await run("window.LivingTownHome?.isOpen && window.LivingTownHome.close()"); await sleep(1500);
    await shot("town"); report.screens.push({ screen: "town", bad: [] });
    await run(`document.querySelector("#homeButton")?.click()`); await sleep(4000);
    await run(PAGE);
    for (let i = 0; i < 20 && !await run("window.__ui.ready()"); i++) await sleep(500);
    if (!await run("window.__ui.ready()")) { await shot("stuck"); throw new Error(`The home plot did not open (see ${path.join(out, "stuck.jpg")})`); }

    const worlds = await run("window.__ui.worlds()"); const looks = {}, pictured = new Set();
    for (const [wi, label] of worlds.entries()) {
      const tag = label.replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/ /g, "-").toLowerCase();
      if (!await run(`window.__ui.goWorld(${JSON.stringify(label)})`)) { problem(tag, "could not switch to this world from the World menu"); continue; }
      await sleep(6000);   // the world's pictures load
      for (const [name, steps] of SCREENS) {
        const screen = `${tag}_${name}`, miss = await run(`window.__ui.open(${JSON.stringify(steps)})`);
        if (miss === "missing") { if (name !== "house") problem(screen, "this menu is missing in this world"); continue; }
        if (miss) { problem(screen, miss); continue; }
        const a = await run("window.__ui.audit()");
        for (const b of a.bad) problem(screen, b);
        for (const [k, v] of Object.entries(a.look)) { if (!v) continue; const key = `${name}.${k}`; if (!(key in looks)) looks[key] = { v, screen }; else if (looks[key].v !== v) problem(screen, `${k} style differs from ${looks[key].screen}: "${v}" vs "${looks[key].v}"`); }
        if (!pictured.has(name) || PICTURED_EVERYWHERE.includes(name)) { await shot(screen); pictured.add(name); }
        report.screens.push({ screen, bad: a.bad, text: a.text });
      }
      await run("window.__ui.home()");
    }
    for (const e of [...new Set(errors)]) problem("page", "script error: " + e);
  } catch (err) { problem("ui-bot", String(err.message || err)); }
  finally { chrome?.kill(); await stop(server).catch(() => {}); }

  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  for (const s of report.screens) { const n = report.problems.filter(p => p.screen === s.screen).length; console.log(`${n ? "✗" : "✓"} ${s.screen}${n ? ` (${n})` : ""}`); }
  for (const p of report.problems) console.log(`  ✗ ${p.screen}: ${p.text}`);
  console.log(`\n${report.screens.length} screens checked, ${report.problems.length} problem${report.problems.length === 1 ? "" : "s"}. Pictures and report.json: ${out}`);
  process.exit(report.problems.length ? 1 : 0);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
main();
