#!/usr/bin/env node
"use strict";
/**
 * Tron's builder: turns a build request Sean made by talking to Tron into a
 * real change to Little Town, using Claude Code.
 *
 * Run every couple of minutes by launchd (com.livingtown.tron-builder). Each pass:
 *   1. Take the oldest queued request from data/tron-builds/ (one at a time).
 *   2. Check out the deploy branch into a throwaway git worktree.
 *   3. Ask Claude Code (headless) to make the change there, inside living-town/ only.
 *   4. Refuse changes to protected files (accounts, deploy, data). Run the full npm test.
 *   5. If the tests pass, commit and push to the deploy branch. The normal
 *      auto-updater then tests it again, deploys it and rolls back if the town
 *      doesn't come back up.
 *   6. Wait for the live checkout to reach the commit and mark the build "live".
 * Status is written back to the request file; the town server reads it and
 * Tron tells Sean how it went.
 */
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const APP = path.resolve(__dirname, "..");
const REPO = path.resolve(APP, "..");
const BRANCH = process.env.LIVING_TOWN_BRANCH || "claude/code-review-4vrxjs";
const QUEUE = path.join(APP, "data", "tron-builds");
const LOCK = path.join(QUEUE, ".lock");
const CLAUDE = process.env.CLAUDE_BIN || "/opt/homebrew/bin/claude";
const PROTECTED = [/^living-town\/lib\/auth\.js$/, /^living-town\/deploy\//, /^living-town\/data\//, /^living-town\/package-lock\.json$/, /^\.git/, /^living-town\/viewer-token/];

const log = (...a) => console.log(new Date().toISOString(), ...a);
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const save = (file, job) => fs.writeFileSync(file, JSON.stringify(job, null, 2));
const tail = (text, n = 1200) => String(text || "").slice(-n);

function nextJob() {
  if (!fs.existsSync(QUEUE)) return null;
  const files = fs.readdirSync(QUEUE).filter(f => f.endsWith(".json")).sort();
  for (const f of files) {
    const file = path.join(QUEUE, f);
    try { const job = JSON.parse(fs.readFileSync(file, "utf8")); if (job.status === "queued" || job.status === "deploying") return { file, job }; } catch {}
  }
  return null;
}

const PROMPT = text => `You are building a change to "Little Town", a family-friendly shared town game that Sean plays with his young daughters Olive and Hazel on iPhones. Sean asked Tron (the town's caretaker program) for this:

"${text}"

Work only inside this folder (the living-town app). Read README.md and LIFE_ENGINE.md first to learn how things fit together. Then make the change, keeping it small, safe and in the style of the existing code.

Rules:
- Family-friendly only. No romance, nothing scary or mean.
- Phone first: buttons low on the screen; the top is for display only.
- Don't touch lib/auth.js, deploy/, data/ or package-lock.json, and don't add npm packages.
- Don't break saves: new fields on saved state must be optional with safe defaults.
- Run \`npm test\` and make sure everything passes. Add a small test if it makes sense.
- Do not commit; the builder does that.

When you're done, reply with 1-3 plain sentences Sean will read in the game, saying what you built and where to find it.`;

function run() {
  fs.mkdirSync(QUEUE, { recursive: true });
  try {
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs < 60 * 60_000) return log("a build is already running");
  } catch {}
  const next = nextJob();
  if (!next) return;
  fs.writeFileSync(LOCK, String(process.pid));
  const { file, job } = next;
  try {
    if (job.status === "deploying") return waitLive(file, job);
    build(file, job);
  } finally { try { fs.unlinkSync(LOCK); } catch {} }
}

function waitLive(file, job) {
  const head = git(REPO, "rev-parse", "HEAD");
  const has = spawnSync("git", ["merge-base", "--is-ancestor", job.commit, head], { cwd: REPO }).status === 0;
  if (has) { job.status = "live"; job.liveAt = Date.now(); save(file, job); return log("live:", job.id); }
  if (Date.now() - job.pushedAt > 40 * 60_000) { job.status = "failed"; job.error = "It was pushed, but the updater didn't put it live (its tests or restart check failed). Check /tmp/living-town-updater.log."; save(file, job); }
}

function build(file, job) {
  log("building:", job.id, job.text);
  job.status = "building"; job.startedAt = Date.now(); save(file, job);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tron-build-"));
  const fail = (why, detail = "") => { job.status = "failed"; job.error = why; job.detail = tail(detail); job.finishedAt = Date.now(); save(file, job); log("failed:", why); };
  try {
    git(REPO, "fetch", "-q", "origin", BRANCH);
    git(REPO, "worktree", "add", "-q", "--detach", dir, `origin/${BRANCH}`);
    const app = path.join(dir, "living-town");
    fs.symlinkSync(path.join(APP, "node_modules"), path.join(app, "node_modules"));
    const ai = spawnSync(CLAUDE, ["-p", PROMPT(job.text), "--permission-mode", "acceptEdits",
      "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(npm test:*),Bash(node --check:*),Bash(node --test:*),Bash(ls:*),Bash(git diff:*),Bash(git status:*)"],
      { cwd: app, encoding: "utf8", timeout: 40 * 60_000, maxBuffer: 20e6 });
    if (ai.status !== 0) return fail("Claude couldn't finish the build.", ai.stderr || ai.stdout);
    job.summary = tail(String(ai.stdout).trim(), 600);
    fs.unlinkSync(path.join(app, "node_modules"));
    const changed = git(dir, "status", "--porcelain", "-uall").split("\n").filter(Boolean).map(l => l.slice(3));
    if (!changed.length) return fail("Claude didn't change anything.", job.summary);
    const bad = changed.filter(f => !f.startsWith("living-town/") || PROTECTED.some(re => re.test(f)));
    if (bad.length) return fail(`It tried to change protected files: ${bad.join(", ")}`);
    fs.symlinkSync(path.join(APP, "node_modules"), path.join(app, "node_modules"));
    const test = spawnSync("npm", ["test"], { cwd: app, encoding: "utf8", timeout: 15 * 60_000, maxBuffer: 20e6 });
    fs.unlinkSync(path.join(app, "node_modules"));
    if (test.status !== 0) return fail("The tests failed, so nothing went live.", test.stdout + test.stderr);
    git(dir, "add", "-A", "living-town");
    git(dir, "-c", "user.name=Tron", "-c", "user.email=tron@little-town.local", "commit", "-q", "-m", `Tron build: ${job.text.slice(0, 60)}\n\nRequested by ${job.by} in Little Town.\n\n${job.summary}`);
    job.commit = git(dir, "rev-parse", "HEAD");
    git(dir, "push", "-q", "origin", `HEAD:${BRANCH}`);
    job.status = "deploying"; job.pushedAt = Date.now(); job.files = changed; save(file, job);
    log("pushed:", job.id, job.commit);
  } catch (err) {
    fail("Something went wrong while building.", err.stderr?.toString() || err.message);
  } finally {
    try { git(REPO, "worktree", "remove", "--force", dir); } catch { fs.rmSync(dir, { recursive: true, force: true }); try { git(REPO, "worktree", "prune"); } catch {} }
  }
}

run();
