"use strict";
/**
 * Durable storage: single-writer lock, atomic writes, rolling backups,
 * hourly snapshots, and recovery that falls back through all of them.
 */

const fs = require("fs");
const path = require("path");

const LOCK_STALE_MS = 20_000;
const LOCK_HEARTBEAT_MS = 5_000;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Atomic write: temp file in the same directory, fsync, rename, fsync dir.
function atomicWrite(targetPath, contents) {
  const tmpPath = `${targetPath}.tmp-${process.pid}`;
  const fd = fs.openSync(tmpPath, "w");
  try {
    fs.writeFileSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, targetPath);
  try {
    const dirFd = fs.openSync(path.dirname(targetPath), "r");
    fs.fsyncSync(dirFd);
    fs.closeSync(dirFd);
  } catch {}
}

function listJson(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.startsWith(prefix) && file.endsWith(".json"))
    .sort()
    .reverse()
    .map(file => path.join(dir, file));
}

function createStore({ dataDir, backupIntervalMs = 60_000, maxBackups = 30, snapshotIntervalMs = 3_600_000, maxSnapshots = 168, log = console }) {
  const saveFile = path.join(dataDir, "town-state.json");
  const backupDir = path.join(dataDir, "backups");
  const snapshotDir = path.join(dataDir, "snapshots");
  const lockFile = path.join(dataDir, "server.lock");
  const lockToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let heartbeat = null;
  let lastBackupAt = 0;
  let lastSnapshotAt = 0;

  function ownsLock() {
    try { return JSON.parse(fs.readFileSync(lockFile, "utf8")).token === lockToken; } catch { return false; }
  }

  function acquireLock(onLost) {
    fs.mkdirSync(dataDir, { recursive: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const fd = fs.openSync(lockFile, "wx");
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: lockToken, startedAt: Date.now() }));
        fs.closeSync(fd);
        // Two processes can both judge the same lock stale and race to replace
        // it. Pause briefly and confirm we still own it before touching data.
        sleepSync(250);
        if (!ownsLock()) throw Object.assign(new Error("lost lock race"), { code: "EEXIST" });
        break;
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        let age;
        try { age = Date.now() - fs.statSync(lockFile).mtimeMs; } catch { continue; }
        if (age < LOCK_STALE_MS) {
          log.error(`Refusing to start: another Living Town server looks like it's already running (lock is ${Math.round(age / 1000)}s old).`);
          process.exit(1);
        }
        log.warn("Found a stale lock file (server likely crashed) — recovering it.");
        try { fs.unlinkSync(lockFile); } catch (unlinkError) { if (unlinkError.code !== "ENOENT") throw unlinkError; }
      }
      if (attempt === 4) { log.error("Could not acquire the server lock."); process.exit(1); }
    }
    heartbeat = setInterval(() => {
      if (!ownsLock()) {
        log.error("Lost the server lock to another process; exiting without saving.");
        onLost();
        return;
      }
      try { fs.utimesSync(lockFile, new Date(), new Date()); } catch {}
    }, LOCK_HEARTBEAT_MS);
  }

  function releaseLock() {
    clearInterval(heartbeat);
    if (ownsLock()) try { fs.unlinkSync(lockFile); } catch {}
  }

  function isUsable(parsed, supportedVersions) {
    if (!parsed || typeof parsed !== "object") return "not an object";
    if (!supportedVersions.includes(parsed.version)) return `unsupported schema version ${parsed.version}`;
    if (!Array.isArray(parsed.residents) || parsed.residents.length === 0) return "missing/empty residents array";
    for (const resident of parsed.residents) {
      if (!resident || typeof resident.id !== "string" || !resident.id) return "resident without an id";
      if (resident.x !== undefined && !Number.isFinite(Number(resident.x))) return `resident ${resident.id} has a bad position`;
    }
    if (parsed.events !== undefined && !Array.isArray(parsed.events)) return "events is not an array";
    return null;
  }

  // Primary save, then rapid backups, then hourly snapshots, newest first.
  function load(supportedVersions) {
    const candidates = [saveFile, ...listJson(backupDir, "town-state."), ...listJson(snapshotDir, "town-state.")];
    for (const file of candidates) {
      try {
        if (!fs.existsSync(file)) continue;
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        const problem = isUsable(parsed, supportedVersions);
        if (problem) { log.warn(`${file}: ${problem}, skipping.`); continue; }
        if (file !== saveFile) log.warn(`Recovered from backup: ${file} (primary save was missing or unreadable).`);
        return parsed;
      } catch (err) {
        log.warn(`${file}: failed to load (${err.message}), trying next candidate.`);
      }
    }
    return null;
  }

  function prune(dir, max) {
    for (const file of listJson(dir, "town-state.").slice(max)) try { fs.unlinkSync(file); } catch {}
  }

  function save(state, now = Date.now()) {
    if (!ownsLock()) throw new Error("refusing to save: this process no longer owns the server lock");
    fs.mkdirSync(dataDir, { recursive: true });
    const json = JSON.stringify(state);
    atomicWrite(saveFile, json);
    const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
    if (now - lastBackupAt >= backupIntervalMs) {
      fs.mkdirSync(backupDir, { recursive: true });
      atomicWrite(path.join(backupDir, `town-state.${stamp}.json`), json);
      prune(backupDir, maxBackups);
      lastBackupAt = now;
    }
    if (now - lastSnapshotAt >= snapshotIntervalMs) {
      fs.mkdirSync(snapshotDir, { recursive: true });
      atomicWrite(path.join(snapshotDir, `town-state.${stamp}.json`), json);
      prune(snapshotDir, maxSnapshots);
      lastSnapshotAt = now;
    }
  }

  // Crash dumps never replace the primary save or backups.
  function writeCrashDump(state) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const file = path.join(dataDir, `crash-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      fs.writeFileSync(file, JSON.stringify(state));
      return file;
    } catch { return null; }
  }

  return { acquireLock, releaseLock, load, save, writeCrashDump, ownsLock, paths: { saveFile, backupDir, snapshotDir, lockFile } };
}

module.exports = { createStore, atomicWrite };
