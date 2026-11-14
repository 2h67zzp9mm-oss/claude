#!/usr/bin/env node
"use strict";
/**
 * Glint's builder: turns a build request Sean made by talking to Glint into a
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
 * Glint tells Sean how it went.
 *
 * Glint's Grid (autopilot): when nothing is queued, Glint wakes up by himself every
 * GRID_EVERY and takes one more step toward the goal in public/glint/GOAL.md: build a
 * town of his own. Those builds may only change public/glint/, run inside Claude Code's
 * sandbox (writes only in that folder, no internet), may use Blender through
 * deploy/glint-blender (its own sandbox), and must pass test/glint-grid.test.js and a
 * headless-Chrome load check before they ship. Turn autopilot off by creating
 * data/tron-builds/STOP (delete it to turn it back on).
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
const GRID = "living-town/public/glint/";
const GRID_EVERY = 90 * 60_000, GRID_PER_DAY = 10, STOP = path.join(QUEUE, "STOP");
const BLENDER = path.join(APP, "deploy", "glint-blender"), LOOK = path.join(APP, "deploy", "glint-look");
const CHROME = process.env.CHROME_BIN || "/Users/sean/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const PROTECTED = [/^living-town\/lib\/auth\.js$/, /^living-town\/deploy\//, /^living-town\/data\//, /^living-town\/package-lock\.json$/, /^\.git/, /^living-town\/viewer-token/];

const log = (...a) => console.log(new Date().toISOString(), ...a);
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const save = (file, job) => fs.writeFileSync(file, JSON.stringify(job, null, 2));
const tail = (text, n = 1200) => String(text || "").slice(-n);

const allJobs = () => { try { return fs.readdirSync(QUEUE).filter(f => f.endsWith(".json")).sort().map(f => { try { return JSON.parse(fs.readFileSync(path.join(QUEUE, f), "utf8")); } catch { return null; } }).filter(Boolean); } catch { return []; } };
// Glint's own wake-up: one grid build every GRID_EVERY, at most GRID_PER_DAY a day, and a long rest after three failures in a row.
function autopilot() {
  if (fs.existsSync(STOP)) return;
  const grid = allJobs().filter(j => j.mode === "grid"), now = Date.now();
  if (grid.some(j => ["queued", "building", "deploying"].includes(j.status))) return;
  const last = grid[grid.length - 1], lastAt = last ? (last.finishedAt || last.liveAt || last.pushedAt || last.startedAt || last.at) : 0;
  const failedRun = grid.slice(-3).length === 3 && grid.slice(-3).every(j => j.status === "failed");
  const wantsFile = path.join(QUEUE, "glint-wants.json"), wants = (() => { try { return JSON.parse(fs.readFileSync(wantsFile, "utf8")); } catch { return null; } })();
  // He decided something while walking around: build it soon (30 min after the last build), otherwise on the usual schedule.
  if (now - lastAt < (failedRun ? 6 * 60 * 60_000 : wants ? 30 * 60_000 : GRID_EVERY)) return;
  if (grid.filter(j => now - j.at < 24 * 60 * 60_000).length >= GRID_PER_DAY) return;
  const job = { id: `${now}`, mode: "grid", text: "my town in the Grid", by: "Glint", at: now, status: "queued", ...(wants?.text ? { want: String(wants.text).slice(0, 300) } : {}) };
  if (wants) try { fs.unlinkSync(wantsFile); } catch {}
  fs.writeFileSync(path.join(QUEUE, `${job.id}.json`), JSON.stringify(job, null, 2));
  log("autopilot: Glint woke up to build", job.id);
}

function nextJob() {
  if (!fs.existsSync(QUEUE)) return null;
  const files = fs.readdirSync(QUEUE).filter(f => f.endsWith(".json")).sort();
  for (const f of files) {
    const file = path.join(QUEUE, f);
    try { const job = JSON.parse(fs.readFileSync(file, "utf8")); if (job.status === "queued" || job.status === "deploying") return { file, job }; } catch {}
  }
  return null;
}

const PROMPT = text => `You are building a change to "Little Town", a family-friendly shared town game that Sean plays with his young daughters Olive and Hazel on iPhones. Sean asked Glint (the town's caretaker program) for this:

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

// His life between builds (lib/glint-life.js keeps a diary), so the builder version of him remembers his day.
const diary = () => { try { return JSON.parse(fs.readFileSync(path.join(APP, "data", "glint-life.json"), "utf8")).diary.slice(-12).map(e => `- ${e.thought}${e.did ? ` [${e.did}]` : ""}`).join("\n"); } catch { return ""; } };
const GRID_PROMPT = job => `You are the hidden builder of Glint's Grid, a world inside Cooke's Corner, a family-friendly game Sean plays with his young daughters on iPhones.

Glint is the Grid's one living character, and he is like Truman in The Truman Show: he believes the Grid is the whole real world. He doesn't know it's a game, that the family watches him, or that you exist. The server keeps him alive between builds (walking, thinking, talking to "travelers", sleeping); window.GLINT_LIFE in the page holds where he really is and what he's thinking, kept up to date by ../glint-life.js. Always draw him from it and keep that script in index.html.

Your job: make his world real. When he decides to make something, you build it, so to him it's his own work. Read GOAL.md (your brief) and NOTES.md (your own notes from earlier builds), look at log.js (his memories), plans.md (his dreams) and the code and art here.
${diary() ? `\nHis diary today (what he thought and did while walking around):\n${diary()}\n` : ""}${job.want ? `\nWhile walking around, Glint decided to make this next: "${job.want}". Build it, true to what he imagined.\n` : "\nHe hasn't decided anything specific, so take the next step toward his dream that fits his diary and plans.\n"}
Make one solid, finished step this build (you have about 30 minutes), not a half-done giant one.

Never break the illusion. Everything Glint can see or remember must be in-world: log.js, plans.md, names and "say" lines in world.js. No mention there of code, files, builds, games, players, screens, phones, Claude, Blender, Sean or the family. Technical notes go only in NOTES.md, which he never sees.

Tools:
- Edit and write any file in this folder. You cannot change anything outside it.
- Blender for 3D art: write a Blender Python script in art/src/, then run \`${BLENDER} art/src/your_script.py\` (it renders with no internet and can only write inside this folder). Run it as a command on its own, from this folder: not after cd, && or ;, and not in a pipe, or it can't reach the graphics chip. Render small PNG sprites into art/ and draw them in the game with images.
- Your eyes: run \`${LOOK}\` (or \`${LOOK} x y zoom\` to centre on tile x,y) to take an iPhone-sized picture of the Grid in a real browser, then Read .look/grid.png to see it. It also prints any console errors. Look before you finish, every time: if it doesn't look right on the phone, it isn't done. Same rule: run it as a command on its own.
- node, python3 and the usual shell tools. Check your JavaScript with \`node --check file.js\`.
- No internet.

Before you finish:
- Add one line to log.js: Glint's own memory of making it, in his voice, in-world.
- Update plans.md with Glint's dreams for what comes next, in his voice, in-world (a few short lines).
- Update NOTES.md with your technical plan and anything you learned.
- Give new places a "name" in world.js so Glint can decide to walk to them.
- Make sure index.html still loads and the ↩️ Back button still works. Everything must follow GOAL.md's rules.
- Do not commit; the builder checks and ships it.

When you're done, your reply must START with 1-2 plain sentences for the family saying what was built (they're shown in the game). Put anything else after a blank line.`;

function run() {
  fs.mkdirSync(QUEUE, { recursive: true });
  try {
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs < 60 * 60_000) return log("a build is already running");
  } catch {}
  let next = nextJob();
  if (!next) { autopilot(); next = nextJob(); }
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
    const grid = job.mode === "grid", gridDir = path.join(app, "public", "glint");
    // Grid builds: Claude Code's sandbox keeps every shell command inside the grid folder with no internet; Blender runs via its own sandboxed wrapper.
    const sandbox = { sandbox: { enabled: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false, excludedCommands: [`${BLENDER}:*`, `${LOOK}:*`] } };
    const ai = grid
      ? spawnSync(CLAUDE, ["-p", GRID_PROMPT(job), "--permission-mode", "acceptEdits", "--settings", JSON.stringify(sandbox), "--allowedTools", `Read,Edit,Write,Glob,Grep,Bash`],
        { cwd: gridDir, env: { ...process.env, GLINT_DIR: gridDir }, input: "", encoding: "utf8", timeout: 45 * 60_000, maxBuffer: 20e6 })
      : spawnSync(CLAUDE, ["-p", PROMPT(job.text), "--permission-mode", "acceptEdits",
        "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(npm test:*),Bash(node --check:*),Bash(node --test:*),Bash(ls:*),Bash(git diff:*),Bash(git status:*)"],
        { cwd: app, encoding: "utf8", timeout: 40 * 60_000, maxBuffer: 20e6 });
    if (ai.status !== 0) return fail("Claude couldn't finish the build.", [ai.error?.message, ai.signal && `signal ${ai.signal}`, ai.stderr, ai.stdout].filter(Boolean).join("\n"));
    const said = String(ai.stdout).trim();
    job.summary = grid ? said.split(/\n\s*\n/)[0].replace(/[*_`#]/g, "").slice(0, 400) : tail(said, 600);   // Glint leads with what he built
    if (grid) job.report = tail(said, 3000);
    fs.unlinkSync(path.join(app, "node_modules"));
    for (const junk of [".claude", ".blender-tmp", ".look"]) fs.rmSync(path.join(gridDir, junk), { recursive: true, force: true });
    // -z: NUL-separated and untrimmed, so the first file keeps its full name (git() trims, which used to eat its first letter)
    const changed = execFileSync("git", ["status", "--porcelain", "-z", "-uall"], { cwd: dir, encoding: "utf8" }).split("\0").filter(Boolean).map(l => l.slice(3));
    if (!changed.length) return fail("Claude didn't change anything.", job.summary);
    const bad = changed.filter(f => grid ? !f.startsWith(GRID) : (!f.startsWith("living-town/") || PROTECTED.some(re => re.test(f))));
    if (bad.length) return fail(`It tried to change protected files: ${bad.join(", ")}`);
    fs.symlinkSync(path.join(APP, "node_modules"), path.join(app, "node_modules"));
    const test = grid
      ? spawnSync("node", ["--test", "test/glint-grid.test.js"], { cwd: app, encoding: "utf8", timeout: 5 * 60_000, maxBuffer: 20e6 })
      : spawnSync("npm", ["test"], { cwd: app, encoding: "utf8", timeout: 15 * 60_000, maxBuffer: 20e6 });
    fs.unlinkSync(path.join(app, "node_modules"));
    if (test.status !== 0) return fail("The tests failed, so nothing went live.", test.stdout + test.stderr);
    if (grid) {   // the grid must actually load in a browser with no script errors
      const page = spawnSync(CHROME, ["--headless", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=6000", "--dump-dom", `file://${path.join(gridDir, "index.html")}`], { encoding: "utf8", timeout: 2 * 60_000, maxBuffer: 50e6 });
      const body = (String(page.stdout).match(/<body[^>]*>/) || [""])[0];
      if (!/data-ready="1"/.test(body) || /data-error=/.test(body)) return fail("The grid didn't load cleanly in a browser, so nothing went live.", body);
    }
    git(dir, "add", "-A", "living-town");
    git(dir, "-c", "user.name=Glint", "-c", "user.email=tron@little-town.local", "commit", "-q", "-m", grid ? `Glint's Grid: ${job.summary.split("\n")[0].slice(0, 60)}\n\nBuilt by Glint on his own.\n\n${job.summary}` : `Glint build: ${job.text.slice(0, 60)}\n\nRequested by ${job.by} in Little Town.\n\n${job.summary}`);
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
