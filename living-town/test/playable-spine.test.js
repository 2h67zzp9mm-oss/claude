"use strict";

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { cleanup, tempDir, freePort, spawnServer, waitForStart, stop, api } = require("./helpers");

test.after(cleanup);

test("playable spine is protected without weakening the town shell", async () => {
  const dataDir = tempDir("living-town-preview-auth-");
  const previewDir = tempDir("living-town-preview-build-");
  const inline = "window.previewBooted = true;";
  fs.writeFileSync(path.join(previewDir, "index.html"), `<!doctype html><script src="index.js"></script><script>${inline}</script>`);
  fs.writeFileSync(path.join(previewDir, "index.js"), "window.previewLoaded = true;");
  fs.writeFileSync(path.join(previewDir, "index.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));

  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_PLAYABLE_SPINE_DIR: previewDir });
  await waitForStart(server);
  const url = pathName => `http://127.0.0.1:${port}${pathName}`;

  const signedOutPage = await fetch(url("/playable-spine/"), { redirect: "manual" });
  assert.strictEqual(signedOutPage.status, 302);
  assert.strictEqual(signedOutPage.headers.get("location"), "/?next=%2Fplayable-spine%2F");
  const signedOutAsset = await fetch(url("/playable-spine/index.wasm"));
  assert.strictEqual(signedOutAsset.status, 401);

  const root = await fetch(url("/"));
  assert.ok(!root.headers.get("content-security-policy").includes("wasm-unsafe-eval"));
  const setup = await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" });
  assert.strictEqual(setup.status, 200);

  const headers = { Cookie: setup.cookie };
  const page = await fetch(url("/playable-spine/"), { headers });
  assert.strictEqual(page.status, 200);
  assert.strictEqual(page.headers.get("cache-control"), "private, no-store");
  const csp = page.headers.get("content-security-policy");
  const hash = crypto.createHash("sha256").update(inline).digest("base64");
  assert.ok(csp.includes("'wasm-unsafe-eval'"));
  assert.ok(csp.includes(`'sha256-${hash}'`));

  const wasm = await fetch(url("/playable-spine/index.wasm"), { headers });
  assert.strictEqual(wasm.status, 200);
  assert.strictEqual(wasm.headers.get("content-type"), "application/wasm");
  assert.strictEqual(wasm.headers.get("cache-control"), "private, no-store");

  const serviceWorker = await (await fetch(url("/sw.js"))).text();
  assert.ok(serviceWorker.includes('rel.startsWith("/playable-spine/")'), "the service worker never caches the preview");
  assert.strictEqual(await stop(server), 0);
});

test("real Godot preview is completely served through the protected mount", {
  skip: !process.env.CCC_REAL_PREVIEW_DIR
}, async () => {
  const previewDir = path.resolve(process.env.CCC_REAL_PREVIEW_DIR);
  const dataDir = tempDir("living-town-real-preview-auth-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, { LIVING_TOWN_PLAYABLE_SPINE_DIR: previewDir });
  await waitForStart(server);
  const url = pathName => `http://127.0.0.1:${port}${pathName}`;

  assert.strictEqual((await fetch(url("/playable-spine/index.pck"))).status, 401);
  const setup = await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" });
  assert.strictEqual(setup.status, 200);
  const headers = { Cookie: setup.cookie };
  const files = fs.readdirSync(previewDir).filter(name => fs.statSync(path.join(previewDir, name)).isFile());
  assert.ok(files.includes("index.html") && files.includes("index.js") && files.includes("index.wasm") && files.includes("index.pck"));
  for (const file of files) {
    const response = await fetch(url(`/playable-spine/${file}`), { headers });
    assert.strictEqual(response.status, 200, `${file} should be served`);
    assert.strictEqual(response.headers.get("cache-control"), "private, no-store");
    await response.arrayBuffer();
  }
  const page = await fetch(url("/playable-spine/"), { headers });
  const csp = page.headers.get("content-security-policy");
  assert.ok(csp.includes("'wasm-unsafe-eval'"));
  assert.ok(csp.includes("'sha256-"));
  assert.strictEqual(await stop(server), 0);
});

test("real Milestone 2 tactical preview is protected and completely served", {
  skip: !process.env.CCC_REAL_PREVIEW_M2_DIR
}, async () => {
  const previewDir = path.resolve(process.env.CCC_REAL_PREVIEW_M2_DIR);
  const dataDir = tempDir("living-town-real-m2-preview-auth-");
  const port = await freePort();
  const server = spawnServer(dataDir, port, {
    LIVING_TOWN_PLAYABLE_SPINE_DIR: process.env.CCC_REAL_PREVIEW_DIR || previewDir,
    LIVING_TOWN_PLAYABLE_SPINE_M2_DIR: previewDir
  });
  await waitForStart(server);
  const url = pathName => `http://127.0.0.1:${port}${pathName}`;

  assert.strictEqual((await fetch(url("/playable-spine-m2/index.pck"))).status, 401);
  const setup = await api(port, "POST", "/api/auth/setup", { code: server.setupCode(), pin: "246810" });
  assert.strictEqual(setup.status, 200);
  const headers = { Cookie: setup.cookie };
  const files = fs.readdirSync(previewDir).filter(name => fs.statSync(path.join(previewDir, name)).isFile());
  assert.ok(files.includes("index.html") && files.includes("index.js") && files.includes("index.wasm") && files.includes("index.pck"));
  for (const file of files) {
    const response = await fetch(url(`/playable-spine-m2/${file}`), { headers });
    assert.strictEqual(response.status, 200, `${file} should be served`);
    assert.strictEqual(response.headers.get("cache-control"), "private, no-store");
    await response.arrayBuffer();
  }
  const page = await fetch(url("/playable-spine-m2/"), { headers });
  const csp = page.headers.get("content-security-policy");
  assert.ok(csp.includes("'wasm-unsafe-eval'"));
  assert.ok(csp.includes("'sha256-"));
  assert.strictEqual(await stop(server), 0);
});
