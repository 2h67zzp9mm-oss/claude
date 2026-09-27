"use strict";
/**
 * Player accounts, PIN hashing, sessions, and login rate limiting.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { atomicWrite } = require("./persistence");
const { PLAYABLE_IDS, HAIR_STYLES, ACCESSORIES } = require("../shared/world");

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 30 * 24 * 3_600_000;
// Wrong PINs allowed before a lockout: per profile, and a looser limit per
// device so one child's guesses don't lock the whole household out.
const MAX_FAILURES_FREE = { profile: 5, ip: 15, setup: 5 };
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;
const COOKIE = "living_town_session";

class AuthError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

function hashToken(token) { return crypto.createHash("sha256").update(String(token)).digest("hex"); }

async function pinDigest(pin, salt) { return (await scrypt(String(pin), salt, 32)).toString("hex"); }

function sanitizeLook(look = {}) {
  return {
    hair: HAIR_STYLES.includes(look?.hair) ? look.hair : "short",
    accessory: ACCESSORIES.includes(look?.accessory) ? look.accessory : "none",
    shirt: /^#[0-9a-f]{6}$/i.test(look?.shirt || "") ? look.shirt : "#64b5f6"
  };
}

function safeProfile(profile) {
  const { pinHash, pinSalt, ...safe } = profile;
  return safe;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    try { out[key] = decodeURIComponent(part.slice(index + 1).trim()); } catch {}
  }
  return out;
}

function readJsonStrict(file) {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function createAuth({ dataDir, log = console, now = () => Date.now(), playableIds = () => PLAYABLE_IDS }) {
  const accountFile = path.join(dataDir, "player-accounts.json");
  const backupFile = `${accountFile}.bak`;
  const sessionFile = path.join(dataDir, "sessions.json");
  const failures = new Map();
  const revokeListeners = new Set();

  // A damaged accounts file must never look like "no accounts yet": that
  // would let anybody on the network run first-time setup and become owner.
  function loadAccounts() {
    for (const file of [accountFile, backupFile]) {
      try {
        const parsed = readJsonStrict(file);
        if (parsed === undefined) continue;
        if (!Array.isArray(parsed.profiles)) throw new Error("profiles is not an array");
        if (file === backupFile) log.warn("Player accounts restored from backup copy.");
        return parsed;
      } catch (err) {
        log.error(`${file}: unreadable (${err.message}).`);
      }
    }
    if (fs.existsSync(accountFile) || fs.existsSync(backupFile)) {
      throw new Error(`Player accounts in ${dataDir} are damaged. Restore player-accounts.json (or delete it to deliberately reset accounts) before starting.`);
    }
    return { version: 1, profiles: [] };
  }

  const accounts = loadAccounts();
  const sessions = new Map();
  try {
    const saved = readJsonStrict(sessionFile);
    for (const [hash, session] of Object.entries(saved?.sessions || {})) {
      if (session.expiresAt > now() && accounts.profiles.some(p => p.id === session.profileId)) sessions.set(hash, session);
    }
  } catch { log.warn("sessions.json unreadable; everyone will need to sign in again."); }

  let setupCode = null;
  if (!accounts.profiles.length) {
    setupCode = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    log.log(`First-time setup code: ${setupCode} (enter it in the app to create the owner account).`);
  }

  function persistAccounts() {
    fs.mkdirSync(dataDir, { recursive: true });
    const json = JSON.stringify(accounts, null, 2);
    atomicWrite(accountFile, json);
    atomicWrite(backupFile, json);
  }

  function persistSessions() {
    fs.mkdirSync(dataDir, { recursive: true });
    atomicWrite(sessionFile, JSON.stringify({ sessions: Object.fromEntries(sessions) }));
  }

  function pruneSessions() {
    let changed = false;
    for (const [hash, session] of sessions) if (session.expiresAt <= now()) { sessions.delete(hash); changed = true; }
    if (changed) persistSessions();
  }

  function newSession(profile) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(hashToken(token), { profileId: profile.id, createdAt: now(), expiresAt: now() + SESSION_MS });
    persistSessions();
    return token;
  }

  function cookieFor(token) {
    return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`;
  }
  const clearCookie = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;

  function tokenFromRequest(req) { return parseCookies(req.headers.cookie)[COOKIE] || null; }

  function sessionFor(token) {
    if (!token) return null;
    const session = sessions.get(hashToken(token));
    if (!session) return null;
    if (session.expiresAt <= now()) { sessions.delete(hashToken(token)); return null; }
    return session;
  }

  function profileForToken(token) {
    const session = sessionFor(token);
    return session ? accounts.profiles.find(p => p.id === session.profileId) || null : null;
  }

  function revoke(predicate) {
    let changed = false;
    for (const [hash, session] of sessions) {
      if (predicate(hash, session)) { sessions.delete(hash); changed = true; revokeListeners.forEach(fn => fn(hash, session)); }
    }
    if (changed) persistSessions();
  }

  function checkLockout(keys) {
    for (const key of keys) {
      const entry = failures.get(key);
      if (entry?.lockedUntil > now()) {
        throw new AuthError(429, "Too many wrong PINs. Try again in a little while.", { retryAfter: Math.ceil((entry.lockedUntil - now()) / 1000) });
      }
    }
  }

  function recordFailure(keys) {
    for (const key of keys) {
      const entry = failures.get(key) || { count: 0, lockedUntil: 0 };
      entry.count += 1;
      const free = MAX_FAILURES_FREE[key.split(":")[0]] || 5;
      if (entry.count >= free) {
        entry.lockedUntil = now() + Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * 2 ** (entry.count - free));
      }
      failures.set(key, entry);
    }
  }

  async function verifyPin(profile, pin) {
    const actual = Buffer.from(await pinDigest(pin, profile.pinSalt), "hex");
    const expected = Buffer.from(profile.pinHash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  async function makePinFields(pin) {
    const salt = crypto.randomBytes(16).toString("hex");
    return { pinSalt: salt, pinHash: await pinDigest(pin, salt) };
  }

  function requireOwner(token) {
    const owner = profileForToken(token);
    if (!owner || owner.role !== "owner") throw new AuthError(403, "Owner access required.");
    return owner;
  }

  return {
    COOKIE,
    AuthError,
    cookieFor,
    clearCookie,
    tokenFromRequest,
    hashToken,
    profileForToken,
    safeProfile,
    onRevoke(fn) { revokeListeners.add(fn); },
    pruneSessions,

    isInitialized() { return accounts.profiles.length > 0; },
    profiles() { return accounts.profiles.map(safeProfile); },
    looks() { return Object.fromEntries(accounts.profiles.map(p => [p.residentId, p.look])); },

    status(token) {
      const me = profileForToken(token);
      return { initialized: accounts.profiles.length > 0, profiles: accounts.profiles.map(safeProfile), me: me ? safeProfile(me) : null, playable: playableIds() };
    },

    async setup({ pin, code }, ip) {
      if (accounts.profiles.length) throw new AuthError(409, "Town accounts are already configured.");
      checkLockout([`setup:${ip}`]);
      if (String(code || "") !== setupCode) { recordFailure([`setup:${ip}`]); throw new AuthError(403, "That setup code is not right. It is printed in the server console."); }
      if (!/^\d{6}$/.test(String(pin || ""))) throw new AuthError(400, "The owner PIN must be 6 digits.");
      const owner = { id: "sean", name: "Sean", residentId: "dad", role: "owner", ...(await makePinFields(pin)), look: sanitizeLook({ hair: "bald", shirt: "#4fc3a1", accessory: "beard" }) };
      if (accounts.profiles.length) throw new AuthError(409, "Town accounts are already configured.");
      accounts.profiles.push(owner);
      persistAccounts();
      setupCode = null;
      return { profile: safeProfile(owner), token: newSession(owner) };
    },

    async login({ profileId, pin }, ip) {
      const keys = [`profile:${profileId}`, `ip:${ip}`];
      checkLockout(keys);
      const profile = accounts.profiles.find(item => item.id === profileId);
      if (!profile || !(await verifyPin(profile, String(pin || "")))) {
        recordFailure(keys);
        throw new AuthError(401, "Wrong PIN.");
      }
      failures.delete(`profile:${profileId}`);
      failures.delete(`ip:${ip}`);
      return { profile: safeProfile(profile), token: newSession(profile) };
    },

    logout(token) {
      if (!token) return;
      const hash = hashToken(token);
      revoke(candidate => candidate === hash);
    },

    async createProfile(token, body) {
      requireOwner(token);
      const name = String(body?.name || "").trim().slice(0, 24);
      const residentId = String(body?.residentId || "");
      const pin = String(body?.pin || "");
      if (!name || !playableIds().includes(residentId) || !/^\d{4,6}$/.test(pin)) throw new AuthError(400, "Name, a playable resident, and a 4–6 digit PIN are required.");
      if (accounts.profiles.some(profile => profile.residentId === residentId)) throw new AuthError(409, "That resident already has a player.");
      const profile = { id: `${residentId}-${crypto.randomBytes(3).toString("hex")}`, name, residentId, role: "player", ...(await makePinFields(pin)), look: sanitizeLook(body?.look) };
      accounts.profiles.push(profile);
      persistAccounts();
      return safeProfile(profile);
    },

    async resetPin(token, profileId, pin) {
      const owner = requireOwner(token);
      const profile = accounts.profiles.find(item => item.id === profileId);
      if (!profile) throw new AuthError(404, "No such player.");
      const pattern = profile.role === "owner" ? /^\d{6}$/ : /^\d{4,6}$/;
      if (!pattern.test(String(pin || ""))) throw new AuthError(400, profile.role === "owner" ? "The owner PIN must be 6 digits." : "Use a 4–6 digit PIN.");
      Object.assign(profile, await makePinFields(pin));
      persistAccounts();
      failures.delete(`profile:${profileId}`);
      // Sign the player out everywhere except the owner's current session.
      const keep = hashToken(token);
      revoke((hash, session) => session.profileId === profileId && !(profile.id === owner.id && hash === keep));
    },

    updateLook(token, profileId, look) {
      const me = profileForToken(token);
      if (!me || (me.id !== profileId && me.role !== "owner")) throw new AuthError(403, "You can only change your own look.");
      const profile = accounts.profiles.find(item => item.id === profileId);
      if (!profile) throw new AuthError(404, "No such player.");
      profile.look = sanitizeLook(look);
      persistAccounts();
      return safeProfile(profile);
    },

    deleteProfile(token, profileId) {
      const owner = requireOwner(token);
      if (owner.id === profileId) throw new AuthError(400, "The owner account cannot be removed.");
      const index = accounts.profiles.findIndex(item => item.id === profileId);
      if (index < 0) throw new AuthError(404, "No such player.");
      accounts.profiles.splice(index, 1);
      persistAccounts();
      revoke((hash, session) => session.profileId === profileId);
    },

    // Test hook: the current one-time setup code.
    get setupCode() { return setupCode; }
  };
}

module.exports = { createAuth, parseCookies, sanitizeLook };
