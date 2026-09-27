"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../deploy/auto-update.js"), "utf8");

test("the auto-updater only fast-forwards, tests before deploying, and rolls back on a failed restart", () => {
  assert.match(source, /merge-base", "--is-ancestor"/, "refuses rewritten history");
  assert.match(source, /merge", "--ff-only"/, "fast-forward only");
  assert.match(source, /git\("status", "--porcelain"\)/, "leaves a checkout alone while someone is working in it");
  assert.ok(source.indexOf("testCandidate(target") < source.indexOf('merge", "--ff-only"'), "tests the new version before it goes live");
  assert.match(source, /ROLLING BACK/);
  assert.match(source, /worktree", "add", "--detach"/, "tests in a separate copy");
  assert.ok(!/data\//.test(source.replace(/`data\/`/g, "")), "never names data/ (git never touches it: it's ignored)");
});

test("the updater's service file and installer point at the right branch and script", () => {
  const plist = fs.readFileSync(path.join(__dirname, "../deploy/com.livingtown.updater.plist"), "utf8");
  assert.match(plist, /<string>claude\/code-review-4vrxjs<\/string>/);
  assert.match(plist, /auto-update\.js/);
  assert.match(plist, /<key>StartInterval<\/key><integer>300<\/integer>/);
  const installer = fs.readFileSync(path.join(__dirname, "../deploy/install-updater.sh"), "utf8");
  assert.match(installer, /launchctl bootstrap/);
});
