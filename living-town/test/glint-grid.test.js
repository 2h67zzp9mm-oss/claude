"use strict";
// Glint's Grid (public/glint/) is built by Glint on his own. These checks keep every build safe to ship.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..", "public", "glint");
const files = (d = DIR) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);

test("glint grid: the page and its scripts are there and every script parses", () => {
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  assert.match(html, /href="\.\.\/"/, "keeps a way back home");
  assert.match(html, /<script src="\.\.\/glint-life\.js"><\/script>/, "keeps Glint alive (../glint-life.js)");
  for (const src of [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])) {
    assert.ok(fs.existsSync(path.join(DIR, src)), `index.html loads ${src}, which is missing`);
  }
  for (const f of files().filter(f => f.endsWith(".js") && !f.includes(`${path.sep}src${path.sep}`))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(f, "utf8"), { filename: f }), `${path.relative(DIR, f)} has a syntax error`);
  }
});

test("glint grid: self-contained, small, and nothing from the internet", () => {
  let total = 0;
  for (const f of files()) {
    const size = fs.statSync(f).size; total += size;
    const rel = path.relative(DIR, f);
    if (/\.(png|jpe?g|webp|gif)$/i.test(f)) assert.ok(size <= 1024 * 1024, `${rel} is over 1 MB`);
    else assert.ok(size <= 2 * 1024 * 1024, `${rel} is over 2 MB`);
    if (/\.(html|js|css)$/.test(f)) {
      const text = fs.readFileSync(f, "utf8");
      assert.ok(!/(src|href)\s*=\s*["']?\s*(https?:)?\/\//i.test(text) && !/url\(\s*["']?(https?:)?\/\//i.test(text) && !/(fetch|import|XMLHttpRequest|WebSocket|EventSource)\s*\(\s*["'`](https?:|wss?:)?\/\//i.test(text), `${rel} reaches out to the internet`);
    }
  }
  assert.ok(total <= 40 * 1024 * 1024, "the grid folder is over 40 MB");
});

test("glint grid: everything on the map has a drawing", () => {
  const w = {}; w.window = w; vm.createContext(w);
  for (const f of ["world.js", "things.js"]) vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), w);
  const T = w.GLINT_THINGS || {};
  for (const th of w.GLINT_WORLD?.things || []) {
    const k = T[th.kind];
    assert.ok(typeof k === "function" || typeof k?.draw === "function", `"${th.kind}" is on the map but has no drawing in things.js`);
  }
});
