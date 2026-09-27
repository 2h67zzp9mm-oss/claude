"use strict";
/**
 * Speech bubbles that take turns.
 *
 * Each line stays up long enough to read (longer lines, longer time), and a
 * resident's lines queue up behind whatever they're already saying instead
 * of cutting it off. Conversations are scripts of turns: one person speaks,
 * then the other answers once they've finished.
 *
 * `r.speech` is the bubble showing now; `r.speechQueue` holds what's next.
 * The server tick calls `tick` to move the next line up when its time comes.
 */

const GAP_MS = 350;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/** How long a line stays up: long enough to read it comfortably. */
function readingMs(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return clamp(1800 + words * 380, 2800, 11_000);
}

/** When this resident will be free to speak again. */
function freeAt(r, now) {
  const queued = (r.speechQueue || []).reduce((end, line) => Math.max(end, line.until), 0);
  const current = r.speech && r.speech.until > now ? r.speech.until : 0;
  return Math.max(now, queued + GAP_MS, current + GAP_MS);
}

/**
 * Say a line no earlier than `at`, after anything already being said.
 * `now` is the real current time (a line only shows once its turn has come).
 * Returns when the line ends.
 */
function say(r, text, at = Date.now(), now = at) {
  const from = Math.max(at, freeAt(r, now));
  const line = { text: String(text), from, until: from + readingMs(text) };
  r.speechQueue = [...(r.speechQueue || []), line].slice(-6);
  promote(r, now);
  return line.until;
}

/**
 * A conversation: [[speaker, text], ...] in order, each turn starting when
 * the previous one ends (and when that speaker is free). Returns the end time.
 */
function conversation(turns, at = Date.now()) {
  let t = at;
  for (const [speaker, text] of turns) {
    if (!text) continue;
    t = say(speaker, text, t, at) + GAP_MS;
  }
  return t;
}

function promote(r, now) {
  const queue = r.speechQueue || [];
  while (queue.length && queue[0].from <= now) {
    const next = queue.shift();
    if (next.until > now) r.speech = next;
  }
  r.speechQueue = queue;
}

/** Move queued lines up as their time comes; clear finished ones. */
function tick(state, now) {
  for (const r of state.residents) {
    if (r.speechQueue?.length) promote(r, now);
    if (r.speech && r.speech.until <= now) r.speech = null;
  }
}

/** Forget anything queued (someone fell asleep or moved away). */
function hush(r) { r.speechQueue = []; }

module.exports = { say, conversation, tick, readingMs, freeAt, hush };
