"use strict";
/**
 * Plays "inside your house" end to end on a private throwaway server with a test account (never the live one):
 * goes in through the door, buys three things in today's shop, puts one out, drags it, turns it, puts it
 * away, hangs a picture, and walks back out. Pictures go to <outDir>.
 *
 *   node scripts/room-bot.js [outDir]
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawn } = require("node:child_process");
const { tempDir, freePort, spawnServer, waitForStart, api, stop } = require("../test/helpers");

const out = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "room-bot-")));
const W = 390, H = 844, sleep = ms => new Promise(r => setTimeout(r, ms));
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter(d => d.startsWith("chromium_headless_shell")).sort().reverse() : [];
  for (const d of dirs) { const p = path.join(cache, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell"); if (fs.existsSync(p)) return p; }
  throw new Error("No Chrome found. Set CHROME=/path/to/chrome.");
}
// Runs in the page: drive the real buttons and fingers.
const PAGE = `(() => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const bar = () => document.querySelector(".home-bar"), pop = () => document.querySelector(".home-pop:not(.hidden)");
  const btn = (t, root) => [...(root || bar()).querySelectorAll("button")].find(b => b.innerText.includes(t) && !b.disabled);
  const H = () => window.LivingTownHome._test, Rm = () => window.LivingTownRoom._test, room = () => document.querySelector("canvas.house-room");
  const decor = () => H().view().decor;
  const finger = (type, x, y) => { const r = room().getBoundingClientRect(); room().dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: 7, bubbles: true })); };
  async function click(t, root) { const b = btn(t, root); if (!b) throw new Error("no button: " + t + " in " + (root || bar()).innerText.replace(/\\s+/g, " ")); b.click(); await w(600); }
  async function goInside() {
    const L = H().L(), [sx, sy] = H().screenOf(L.house.door[0] + 0.3, L.house.door[1]), c = document.querySelector("#homestead canvas"), r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent("click", { clientX: r.left + sx, clientY: r.top + sy - 70, bubbles: true })); await w(500);
    await click("Go inside", pop()); for (let i = 0; i < 40 && !window.LivingTownRoom.isOpen; i++) await w(250);
    if (!window.LivingTownRoom.isOpen) throw new Error("didn't get inside");
    await w(500);
  }
  async function drag(uid, dx, dy) {
    const b = Rm().boxOf(uid), x = (b.x0 + b.x1) / 2, y = b.y1 - 6, [ax, ay] = Rm().screenOf(0, 0), [bx, by] = Rm().screenOf(dx, dy);
    finger("pointerdown", x, y); await w(60);
    for (let i = 1; i <= 6; i++) { finger("pointermove", x + (bx - ax) * i / 6, y + (by - ay) * i / 6); await w(40); }
    finger("pointerup", x + (bx - ax), y + (by - ay)); await w(700);
  }
  window.__room = { click, goInside, drag, decor, stars: () => H().view().stars, pop: () => pop()?.innerText || "", bar: () => bar().innerText.replace(/\\s+/g, " "), ready: () => !!(window.LivingTownHome && H().view() && btn("Town")) };
  return true;
})()`;

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const dataDir = tempDir("room-bot-data-"), log = [], ok = (cond, text) => { log.push(`${cond ? "✓" : "✗"} ${text}`); if (!cond) throw new Error(text); };
  let server = spawnServer(dataDir, await freePort(), { LIVING_TOWN_MRE_AI: "off" }), chrome = null;
  try {
    await waitForStart(server);
    const cookie = (await api(server.port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
    // give the test player some stars to spend: stop, edit the save, start again
    await stop(server);
    const file = fs.readdirSync(dataDir).map(f => path.join(dataDir, f)).find(f => /state.*\.json$/.test(f) && JSON.parse(fs.readFileSync(f, "utf8")).residents);
    const st = JSON.parse(fs.readFileSync(file, "utf8")); for (const r of st.residents) r.stars = 500; fs.writeFileSync(file, JSON.stringify(st));
    server = spawnServer(dataDir, await freePort(), { LIVING_TOWN_MRE_AI: "off" }); await waitForStart(server);
    const url = `http://127.0.0.1:${server.port}/`, debugPort = await freePort();
    chrome = spawn(findChrome(), ["--headless", "--disable-gpu", `--remote-debugging-port=${debugPort}`, `--window-size=${W},${H}`, `--user-data-dir=${tempDir("room-bot-chrome-")}`, "about:blank"], { stdio: "ignore" });
    let target = null;
    for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(t => t.type === "page"); } catch { /* not up yet */ } }
    const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0; const waiting = new Map(), errors = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.split("\n")[0]); };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const send = (method, params = {}) => new Promise(res => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const run = async expression => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "page error"); return r.result?.result?.value; };
    const shot = async name => { const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 75 }); fs.writeFileSync(path.join(out, name + ".jpg"), Buffer.from(r.result.data, "base64")); };
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    const [cname, ...cval] = cookie.split("="); await send("Network.setCookie", { name: cname, value: cval.join("="), url });
    await send("Page.navigate", { url }); await sleep(4000);
    for (let i = 0; i < 12 && !await run("!!window.LivingTownHome?.isOpen"); i++) await sleep(500);
    if (!await run("window.LivingTownHome.isOpen")) { await run(`document.querySelector("#homeButton")?.click()`); await sleep(4000); }
    await run(PAGE);
    for (let i = 0; i < 20 && !await run("window.__room.ready()"); i++) await sleep(500);

    await run("window.__room.goInside()"); await shot("1-inside"); ok(true, "went inside through the door");
    const stars0 = await run("window.__room.stars()");
    await run(`window.__room.click("Shop")`);
    for (const name of ["Wooden Chair", "Round Rug", "Flower Picture"]) await run(`window.__room.click(${JSON.stringify(name)})`);
    await shot("2-shop");
    const d1 = await run("window.__room.decor()"), stars1 = await run("window.__room.stars()");
    ok(d1.storage.length === 3, `bought 3 things (box has ${d1.storage.length})`);
    ok(stars0 - stars1 === 12 + 15 + 16, `paid ${stars0 - stars1}⭐ (12+15+16)`);
    await run(`window.__room.click("Back")`); await run(`window.__room.click("Stored")`); await shot("3-stored");
    await run(`window.__room.click("Round Rug")`); await run(`window.__room.click("Wooden Chair")`);
    let d = await run("window.__room.decor()");
    const chair = d.room.find(t => t.id === "chair"); ok(chair && d.room.some(t => t.id === "rug_round"), `put out the rug and the chair (at ${chair?.x},${chair?.y})`);
    ok((await run("window.__room.pop()")).includes("Turn"), "the chair is picked, with Turn, Store and Done on it");
    await shot("4-placed");
    await run(`window.__room.drag(${chair.uid}, 3, 3)`);
    d = await run("window.__room.decor()"); const moved = d.room.find(t => t.uid === chair.uid);
    ok(moved.x === chair.x + 3 && moved.y === chair.y + 3, `dragged the chair from ${chair.x},${chair.y} to ${moved.x},${moved.y}`);
    await shot("5-dragged");
    await run(`window.__room.click("Turn", document.querySelector(".home-pop"))`);
    d = await run("window.__room.decor()"); ok(d.room.find(t => t.uid === chair.uid).rot === 1, "turned the chair");
    await run(`window.__room.click("Turn", document.querySelector(".home-pop"))`); await shot("6-turned");
    await run(`window.__room.click("Flower Picture")`);
    d = await run("window.__room.decor()"); ok(d.room.some(t => t.id === "pic_flower" && t.y === 0), "hung the picture on the wall");
    await run(`window.__room.click("Store", document.querySelector(".home-pop"))`);
    d = await run("window.__room.decor()"); ok(d.storage.some(t => t.id === "pic_flower") && !d.room.some(t => t.id === "pic_flower"), "put the picture back in the box");
    await shot("7-decorated");
    await run(`window.__room.click("Back")`); await run(`window.__room.click("Back")`);
    ok(!await run("window.LivingTownRoom.isOpen") && (await run("window.__room.bar()")).includes("Town"), "walked back out to the garden");
    await shot("8-outside");
    ok(!errors.length, `no script errors${errors.length ? ": " + errors.join("; ") : ""}`);
  } catch (err) { log.push(`✗ ${err.message}`); process.exitCode = 1; }
  finally { chrome?.kill(); await stop(server).catch(() => {}); }
  console.log(log.join("\n") + `\nPictures: ${out}`);
}
main();
