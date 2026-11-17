"use strict";
/**
 * Walks in Glint's Grid as a traveler on a private throwaway server with a test account (never the live one):
 * the traveler appears at the edge of town, taps a path tile, walks there, and the server sees where they are.
 *
 *   node scripts/grid-walk-bot.js [outDir]
 */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawn } = require("node:child_process");
const { tempDir, freePort, spawnServer, waitForStart, api, stop } = require("../test/helpers");

const out = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "grid-walk-bot-")));
const W = 390, H = 844, sleep = ms => new Promise(r => setTimeout(r, ms));
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter(d => d.startsWith("chromium_headless_shell")).sort().reverse() : [];
  for (const d of dirs) { const p = path.join(cache, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell"); if (fs.existsSync(p)) return p; }
  throw new Error("No Chrome found. Set CHROME=/path/to/chrome.");
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const dataDir = tempDir("room-bot-data-"), log = [], ok = (cond, text) => { log.push(`${cond ? "✓" : "✗"} ${text}`); if (!cond) throw new Error(text); };
  let server = spawnServer(dataDir, await freePort(), { LIVING_TOWN_MRE_AI: "off", LIVING_TOWN_FOLK_AI: "off" }), chrome = null;
  try {
    await waitForStart(server);
    const cookie = (await api(server.port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" })).cookie;
    // give the test player some stars to spend: stop, edit the save, start again
    await stop(server);
    const file = fs.readdirSync(dataDir).map(f => path.join(dataDir, f)).find(f => /state.*\.json$/.test(f) && JSON.parse(fs.readFileSync(f, "utf8")).residents);
    const st = JSON.parse(fs.readFileSync(file, "utf8")); for (const r of st.residents) r.stars = 700; fs.writeFileSync(file, JSON.stringify(st));
    server = spawnServer(dataDir, await freePort(), { LIVING_TOWN_MRE_AI: "off", LIVING_TOWN_FOLK_AI: "off" }); await waitForStart(server);
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
    await send("Page.navigate", { url: url + "glint/" }); await sleep(7000);
    const r0 = await run(`(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), me = window.GLINT_ME, G = window.GLINT_GRID, W = window.GLINT_WORLD;
      if (!me?.walker) return { attached: false };
      const start = [me.x, me.y];
      let goal = null;
      for (let r = 3; r < 9 && !goal; r++) for (let y = 0; y < W.size && !goal; y++) for (let x = 0; x < W.size && !goal; x++) if (Math.abs(x - me.x) + Math.abs(y - me.y) === r && "pof".includes((W.tiles[y] || "")[x]) && !W._blocked.has(x + "," + y)) goal = { x, y };
      G.cam.x = me.x; G.cam.y = me.y; G.cam.s = 40; await w(300);
      const sx = innerWidth / 2 + (goal.x + 0.5 - G.cam.x) * G.cam.s, sy = innerHeight / 2 + (goal.y + 0.5 - G.cam.y) * G.cam.s;
      window.__walk = { start, goal, sx, sy }; return { attached: true, sx, sy };
    })()`);
    if (r0.attached) {   // a real tap, like a finger
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: r0.sx, y: r0.sy, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r0.sx, y: r0.sy, button: "left", clickCount: 1 });
    }
    const r = r0.attached ? await run(`(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), me = window.GLINT_ME, G = window.GLINT_GRID, W = window.GLINT_WORLD, { start, goal } = window.__walk;
      const pathLen = me.path.length; await w(6000);
      const life = await (await fetch("../api/glint/life", { credentials: "same-origin" })).json();
      return { attached: true, start, goal, pathLen, end: [me.x, me.y], onPath: "pof".includes((W.tiles[Math.round(me.y)] || "")[Math.round(me.x)]), drawn: G.walkers.some(x => x.kind === "traveler"), server: life.travelers, me: life.me, error: document.body.dataset.error || "" };
    })()`) : { attached: false };
    await shot("1-walked");
    ok(r.attached, "the traveler appeared in the Grid");
    ok(r.drawn, "they are one of the Grid's walkers, drawn with everyone else");
    ok(r.pathLen > 0, `tapping a path found a way there (${r.pathLen} steps)`);
    ok(Math.hypot(r.end[0] - r.goal.x, r.end[1] - r.goal.y) < 0.05 && r.onPath, `walked from ${r.start} to ${r.end.map(n => n.toFixed(1))} (goal ${r.goal.x},${r.goal.y}), staying on the paths`);
    const seen = (r.server || []).find(t => t.name === r.me);
    ok(seen && Math.hypot(seen.x - r.end[0], seen.y - r.end[1]) < 1.01, `the server knows where they are (${seen ? seen.x + "," + seen.y : "no"})`);
    // a neighbour moves in only when the owner allows it, and shows up walking to their home
    const before = await run(`fetch("../api/glint/life", { credentials: "same-origin" }).then(r => r.json()).then(d => (d.folk || []).length)`);
    ok(before === 0, "nobody has moved in before it's allowed");
    const allowed = await run(`fetch("../api/glint/folk/allow", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: 1, home: "First Little House" }) }).then(r => r.json())`);
    ok(allowed.allowed === 1 && allowed.free.includes("First Little House"), `allowed one newcomer (free homes: ${allowed.free})`);
    await sleep(9000);
    const nb = await run(`(async () => { const d = await (await fetch("../api/glint/life", { credentials: "same-origin" })).json(); return { folk: d.folk, drawn: window.GLINT_GRID.walkers.filter(w => w.kind === "neighbour").map(w => w.name) }; })()`);
    await shot("2-neighbour");
    ok(nb.folk.length === 1 && nb.folk[0].home === "First Little House", `${nb.folk[0]?.name} moved in, heading for the ${nb.folk[0]?.home}`);
    ok(nb.drawn.includes(nb.folk[0]?.name), "they're drawn walking in the Grid");
    ok(!r.error && !errors.length, `no script errors${r.error || errors.length ? ": " + [r.error, ...errors].join("; ") : ""}`);
  } catch (err) { log.push(`✗ ${err.message}`); process.exitCode = 1; }
  finally { chrome?.kill(); await stop(server).catch(() => {}); }
  console.log(log.join("\n") + `\nPictures: ${out}`);
}
main();
