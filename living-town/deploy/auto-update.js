#!/usr/bin/env node
"use strict";
/**
 * Mouse's auto-updater: deploys whatever lands on the watched GitHub branch,
 * safely, without anyone having to be the middle man.
 *
 * Every few minutes (run by launchd as com.livingtown.updater):
 *   1. Fetch the branch. Nothing new, or someone is editing the checkout
 *      (uncommitted changes)? Do nothing.
 *   2. Only fast-forwards: history that's been rewritten is never taken.
 *   3. Test the new version in a separate temporary copy first (Living
 *      Town's full `npm test`; for Blacksteel, a syntax check of its code).
 *      Anything fails? Stop, log it, and leave the live town alone.
 *   4. Fast-forward the live checkout. Git never touches `data/` or
 *      `node_modules/` (both ignored). If the package lock changed, reinstall.
 *   5. Restart what changed (Living Town, and Blacksteel if it's installed)
 *      and check each answers. If one doesn't, roll back to the previous
 *      version and restart again.
 *
 * Usage:  node deploy/auto-update.js            (one update pass)
 *         node deploy/auto-update.js --check    (just say whether there's an update)
 *         node deploy/auto-update.js --self-test (test the current version in a temporary copy; changes nothing live)
 * Settings (environment): LIVING_TOWN_BRANCH (default claude/code-review-4vrxjs).
 * Log: /tmp/living-town-updater.log (via launchd).
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const REPO = path.resolve(__dirname, "..", "..");
const APP = path.join(REPO, "living-town");
const BRANCH = process.env.LIVING_TOWN_BRANCH || "claude/code-review-4vrxjs";
const UID = process.getuid();
const SERVICES = {
  town: { label: "com.livingtown.server", port: 4310, folder: "living-town" },
  blacksteel: { label: "com.blacksteel.game", port: 4320, folder: "blacksteel" }
};
const LOCK = path.join(os.tmpdir(), "living-town-updater.lock");

function log(message) { console.log(`${new Date().toISOString()} ${message}`); }
function run(cmd, args, opts = {}) { return execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim(); }
function git(...args) { return run("git", args); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function serviceLoaded(label) {
  try { run("launchctl", ["print", `gui/${UID}/${label}`]); return true; } catch { return false; }
}

/** The address a service listens on (its HOST from launchd), for the health check. */
function serviceHost(label) {
  try {
    const text = run("launchctl", ["print", `gui/${UID}/${label}`]);
    return text.match(/HOST => ([\d.]+)/)?.[1] || "127.0.0.1";
  } catch { return "127.0.0.1"; }
}

function answers(host, port) {
  return new Promise(resolve => {
    const req = http.get({ host, port, path: "/", timeout: 3000 }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function restartAndCheck(name) {
  const svc = SERVICES[name];
  run("launchctl", ["kickstart", "-k", `gui/${UID}/${svc.label}`]);
  const host = serviceHost(svc.label);
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await answers(host, svc.port)) { log(`${name}: restarted and answering on ${host}:${svc.port}`); return true; }
  }
  log(`${name}: did NOT answer on ${host}:${svc.port} after restart`);
  return false;
}

/** Test a version in a throwaway copy, so the live checkout is untouched until it passes. */
function testCandidate(sha, changed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-candidate-"));
  try {
    git("worktree", "add", "--detach", dir, sha);
    if (changed.town) {
      const app = path.join(dir, "living-town");
      // Tests need the packages; share the live ones unless the lock file changed.
      const lockChanged = changed.files.includes("living-town/package-lock.json");
      if (lockChanged) run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: app, timeout: 600_000 });
      else fs.symlinkSync(path.join(APP, "node_modules"), path.join(app, "node_modules"), "dir");
      log(`testing ${sha.slice(0, 7)}: living-town npm test...`);
      const out = run("npm", ["test"], { cwd: app, timeout: 900_000, env: { ...process.env, CI: "1" } });
      const fail = out.match(/ℹ fail (\d+)/)?.[1];
      if (fail !== "0") throw new Error(`living-town tests: ${fail ?? "?"} failing\n${out.split("\n").filter(l => /^✖/.test(l)).slice(0, 8).join("\n")}`);
      log(`living-town tests passed (${out.match(/ℹ pass (\d+)/)?.[1]} tests)`);
    }
    if (changed.blacksteel && fs.existsSync(path.join(dir, "blacksteel"))) {
      // Blacksteel has no test suite yet: at least make sure its code parses.
      for (const file of fs.readdirSync(path.join(dir, "blacksteel")).filter(f => f.endsWith(".js"))) run(process.execPath, ["--check", path.join(dir, "blacksteel", file)]);
      log("blacksteel: code checks passed");
    }
  } finally {
    try { git("worktree", "remove", "--force", dir); } catch { fs.rmSync(dir, { recursive: true, force: true }); try { git("worktree", "prune"); } catch {} }
  }
}

async function main() {
  const mode = process.argv[2] || "";
  if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 30 * 60_000) return log("another update is running; skipping");
  fs.writeFileSync(LOCK, String(process.pid));
  try {
    if (mode === "--self-test") {
      const head = git("rev-parse", "HEAD");
      testCandidate(head, { town: true, blacksteel: true, files: [] });
      return log(`self-test passed for ${head.slice(0, 7)} (nothing live was changed)`);
    }
    git("fetch", "--quiet", "origin", BRANCH);
    const head = git("rev-parse", "HEAD");
    const target = git("rev-parse", `origin/${BRANCH}`);
    if (head === target) return mode === "--check" ? log("up to date") : undefined;
    if (git("rev-parse", "--abbrev-ref", "HEAD") !== BRANCH) return log(`the checkout isn't on ${BRANCH}; skipping`);
    try { git("merge-base", "--is-ancestor", head, target); } catch { return log(`origin/${BRANCH} isn't a fast-forward from ${head.slice(0, 7)}; not taking rewritten history`); }
    const files = git("diff", "--name-only", head, target).split("\n").filter(Boolean);
    const changed = { files, town: files.some(f => f.startsWith("living-town/")), blacksteel: files.some(f => f.startsWith("blacksteel/")) };
    log(`update available: ${head.slice(0, 7)} -> ${target.slice(0, 7)} (${files.length} files; ${git("log", "--format=%s", `${head}..${target}`).split("\n").slice(0, 3).join(" | ")})`);
    if (mode === "--check") return;
    if (git("status", "--porcelain").length) return log("the live checkout has uncommitted changes (someone is working on it); skipping this time");

    try { testCandidate(target, changed); } catch (err) { return log(`NOT deploying ${target.slice(0, 7)}: ${err.message}`); }

    git("merge", "--ff-only", "--quiet", target);
    if (changed.files.includes("living-town/package-lock.json")) run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: APP, timeout: 600_000 });
    log(`live checkout is now ${target.slice(0, 7)}`);

    const restart = [];
    if (changed.town) restart.push("town");
    if (changed.blacksteel && serviceLoaded(SERVICES.blacksteel.label)) restart.push("blacksteel");
    else if (changed.blacksteel) log("blacksteel changed but isn't installed on this Mac yet (run blacksteel/deploy/install.sh once); not starting it");
    for (const name of restart) {
      if (await restartAndCheck(name)) continue;
      log(`ROLLING BACK to ${head.slice(0, 7)}`);
      git("reset", "--hard", "--quiet", head);
      if (changed.files.includes("living-town/package-lock.json")) run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: APP, timeout: 600_000 });
      for (const again of restart) await restartAndCheck(again);
      return log(`rolled back to ${head.slice(0, 7)}; ${target.slice(0, 7)} stays on GitHub for a fix`);
    }
    log(`deployed ${target.slice(0, 7)}`);
  } finally {
    fs.rmSync(LOCK, { force: true });
  }
}

main().catch(err => { log(`updater error: ${err.message}`); fs.rmSync(LOCK, { force: true }); process.exitCode = 1; });
