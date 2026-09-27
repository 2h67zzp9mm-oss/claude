"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const root = path.resolve(__dirname, "..");
const children = new Set();
const sockets = new Set();

// Kill leftover servers and sockets so a failed assertion can't hang the run.
function cleanup() {
  for (const ws of sockets) try { ws.terminate(); } catch {}
  for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
}

function tempDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

function spawnServer(dataDir, port, extraEnv = {}, args = ["server.js"]) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    // The visitor window and the Big Top troupe stay off unless a test turns them on.
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), LIVING_TOWN_DATA_DIR: dataDir, LIVING_TOWN_VIEWER: "off", LIVING_TOWN_TROUPE: "off", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"]
  });
  children.add(child);
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  return { child, port, output: () => output, setupCode: () => (output.match(/setup code: (\d{6})/) || [])[1] };
}

async function until(check, label, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(`timeout: ${label}`);
}

async function waitForStart(proc) {
  await until(() => {
    if (proc.child.exitCode !== null) throw new Error(`server exited ${proc.child.exitCode}: ${proc.output()}`);
    return proc.output().includes("Living Town server running");
  }, `server start: ${proc.output()}`);
}

function waitForExit(child, timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve(child.exitCode);
    const timer = setTimeout(() => reject(new Error("process exit timeout")), timeout);
    child.once("exit", code => { clearTimeout(timer); resolve(code); });
  });
}

async function stop(proc) {
  if (proc.child.exitCode !== null) return proc.child.exitCode;
  proc.child.kill("SIGTERM");
  return waitForExit(proc.child);
}

// A client that keeps a merged view of residents from full states and ticks.
function connectClient(port, { cookie, origin } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (origin) headers.Origin = origin;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    sockets.add(ws);
    const client = { ws, residents: new Map(), events: [], messages: [], detail: null, closedWith: null, looks: {} };
    ws.on("message", raw => {
      const msg = JSON.parse(raw.toString());
      client.messages.push(msg);
      if (msg.type === "state") {
        client.looks = msg.looks;
        msg.state.residents.forEach(r => client.residents.set(r.id, r));
        client.events = msg.state.events;
      }
      if (msg.type === "tick") {
        for (const r of [...msg.changed, ...msg.residents]) client.residents.set(r.id, { ...(client.residents.get(r.id) || {}), ...r });
        client.events = [...msg.events.reverse(), ...client.events];
      }
      if (msg.type === "looks") client.looks = msg.looks;
      if (msg.type === "resident-detail") client.detail = msg.resident;
    });
    ws.on("close", code => { client.closedWith = code; });
    ws.once("open", () => resolve(client));
    ws.once("error", reject);
  });
}

async function api(port, method, pathName, body, cookie) {
  const response = await fetch(`http://127.0.0.1:${port}${pathName}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  const setCookie = response.headers.get("set-cookie");
  return { status: response.status, body: json, cookie: setCookie ? setCookie.split(";")[0] : null, headers: response.headers };
}

module.exports = { cleanup, root, tempDir, freePort, spawnServer, until, waitForStart, waitForExit, stop, connectClient, api };
