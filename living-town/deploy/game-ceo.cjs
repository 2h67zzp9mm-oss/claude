#!/usr/bin/env node
/**
 * The Game CEO: once a night, takes the top item from ROADMAP.md, builds it with Claude in a throwaway worktree,
 * checks it (npm test, plus the UI bot when screens changed), and pushes it. The live updater then puts it live
 * after its own tests. A short report goes to data/ceo/reports/ and to Earl Grey's Inbox.
 *
 * Rules for the CEO are in deploy/game-ceo.md. Turn it off: create data/ceo/STOP. Run once by hand: node deploy/game-ceo.cjs --now
 */
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const APP = path.resolve(__dirname, "..");
const REPO = path.resolve(APP, "..");
const BRANCH = process.env.LIVING_TOWN_BRANCH || "claude/code-review-4vrxjs";
const CLAUDE = process.env.CLAUDE_BIN || "/opt/homebrew/bin/claude";
const HOME = path.join(APP, "data", "ceo"), STOP = path.join(HOME, "STOP"), LAST = path.join(HOME, "last.json"), LOCK = path.join(HOME, ".lock");
const BUILDS = path.join(APP, "data", "tron-builds");
const INBOX = path.join(os.homedir(), "Earl Grey", "Inbox");
const PROTECTED = [/^living-town\/lib\/auth\.js$/, /^living-town\/deploy\//, /^living-town\/data\//, /^living-town\/package-lock\.json$/, /^living-town\/package\.json$/,
  /^living-town\/public\/glint\//, /^living-town\/lib\/glint-/, /^living-town\/public\/glint-life\.js$/, /^\.git/, /^living-town\/viewer-token/];

const log = (...a) => console.log(new Date().toISOString(), ...a);
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const today = () => new Date().toLocaleDateString("en-CA");

function report(text) {
  const day = today();
  fs.mkdirSync(path.join(HOME, "reports"), { recursive: true });
  fs.writeFileSync(path.join(HOME, "reports", `${day}.md`), `# Game CEO, ${day}\n\n${text}\n`);
  try { fs.mkdirSync(INBOX, { recursive: true }); fs.writeFileSync(path.join(INBOX, `game-ceo-${day}.md`), `# Game CEO report (Cooke's Corner), ${day}\n\n${text}\n`); } catch { /* no Earl Grey */ }
  log("report:", text.split("\n")[0]);
}

function main() {
  fs.mkdirSync(HOME, { recursive: true });
  if (fs.existsSync(STOP)) return log("STOP file there; resting");
  const now = process.argv.includes("--now");
  let last = {}; try { last = JSON.parse(fs.readFileSync(LAST, "utf8")); } catch { /* first night */ }
  if (!now && last.day === today()) return log("already worked today");
  if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 3 * 3600_000) return log("another run is going");
  // stay out of Glint's way: no run while one of his builds is going
  try { for (const f of fs.readdirSync(BUILDS).filter(f => /^\d+\.json$/.test(f))) if (JSON.parse(fs.readFileSync(path.join(BUILDS, f), "utf8")).status === "building") return log("a Glint build is going; trying later"); } catch { /* no builds */ }
  fs.writeFileSync(LOCK, String(process.pid));
  fs.writeFileSync(LAST, JSON.stringify({ day: today(), at: Date.now() }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "game-ceo-"));
  try {
    git(REPO, "fetch", "-q", "origin", BRANCH);
    git(REPO, "worktree", "add", "-q", "--detach", dir, `origin/${BRANCH}`);
    const app = path.join(dir, "living-town"), nm = path.join(app, "node_modules");
    fs.symlinkSync(path.join(APP, "node_modules"), nm);
    const rules = fs.readFileSync(path.join(APP, "deploy", "game-ceo.md"), "utf8");
    log("working");
    const ai = spawnSync(CLAUDE, ["-p", `${rules}\n\nToday is ${today()}. Start now.`, "--permission-mode", "acceptEdits",
      "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(npm test:*),Bash(npm run ui:*),Bash(node --check:*),Bash(node --test:*),Bash(node scripts/:*),Bash(ls:*),Bash(git diff:*),Bash(git status:*)"],
      { cwd: app, input: "", encoding: "utf8", timeout: 80 * 60_000, maxBuffer: 30e6 });
    const said = String(ai.stdout || "").trim();
    if (ai.status !== 0) return report(`Couldn't finish tonight.\n\n${(ai.stderr || ai.error?.message || said).slice(-800)}`);
    for (const junk of [".claude"]) fs.rmSync(path.join(app, junk), { recursive: true, force: true });
    fs.unlinkSync(nm);
    const changed = execFileSync("git", ["status", "--porcelain", "-z", "-uall"], { cwd: dir, encoding: "utf8" }).split("\0").filter(Boolean).map(l => l.slice(3));
    if (!changed.length) return report(`Nothing changed tonight.\n\n${said.slice(-1500)}`);
    const bad = changed.filter(f => !f.startsWith("living-town/") || PROTECTED.some(re => re.test(f)));
    if (bad.length) return report(`Stopped: it tried to change files it mustn't (${bad.join(", ")}). Nothing went live.\n\n${said.slice(-1200)}`);
    fs.symlinkSync(path.join(APP, "node_modules"), nm);
    const test = spawnSync("npm", ["test"], { cwd: app, encoding: "utf8", timeout: 20 * 60_000, maxBuffer: 30e6 });
    if (test.status !== 0) return report(`The tests failed, so nothing went live.\n\n${said.slice(-1200)}\n\n${String(test.stdout).slice(-1200)}`);
    if (changed.some(f => /^living-town\/(public|scripts)\//.test(f))) {
      const ui = spawnSync("npm", ["run", "ui"], { cwd: app, encoding: "utf8", timeout: 20 * 60_000, maxBuffer: 30e6 });
      if (ui.status !== 0 || !/ 0 problems/.test(ui.stdout)) return report(`The screen check found problems, so nothing went live.\n\n${said.slice(-1200)}\n\n${String(ui.stdout).slice(-1200)}`);
    }
    fs.unlinkSync(nm);
    const headline = (said.split("\n").map(l => l.replace(/[*_`#]/g, "").trim()).find(l => l.length > 12) || "Game CEO update").slice(0, 70);   // the report leads with a headline
    git(dir, "add", "-A", "living-town");
    git(dir, "-c", "user.name=Game CEO", "-c", "user.email=ceo@little-town.local", "commit", "-q", "-m", `Game CEO: ${headline}\n\n${said.slice(-1500)}`);
    git(dir, "fetch", "-q", "origin", BRANCH); git(dir, "rebase", "-q", `origin/${BRANCH}`);   // Glint may have pushed meanwhile
    git(dir, "push", "-q", "origin", `HEAD:${BRANCH}`);
    report(`${said.slice(-2500)}\n\nShipped: ${git(dir, "rev-parse", "--short", "HEAD")} (the updater puts it live after its own tests).`);
  } catch (err) {
    report(`Something went wrong: ${(err.stderr?.toString() || err.message).slice(-800)}`);
  } finally {
    try { git(REPO, "worktree", "remove", "--force", dir); } catch { fs.rmSync(dir, { recursive: true, force: true }); try { git(REPO, "worktree", "prune"); } catch { /* ok */ } }
    try { fs.unlinkSync(LOCK); } catch { /* ok */ }
  }
}
main();
