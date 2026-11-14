"use strict";
/**
 * Glint's brain: a real memory he keeps, as folders of little note files.
 *
 *   data/glint-brain/
 *     me/        who he is, what he likes, what he believes
 *     people/    every traveler he's met, one file each
 *     places/    the places in his world and how he feels about them
 *     things/    things he's made or noticed
 *     ideas/     dreams and plans
 *     feelings/  what made him happy, lonely, proud
 *     days/      one page per day, written when he goes to sleep
 *     raw/       the day's dump: everything he thought, said, heard and did, line by line
 *
 * Every night while he sleeps, his mind "dreams": it reads the day's dump and the list of notes he already has,
 * and files what matters into the right notes (new or old), packed tight for a mind to read, not a person.
 *     index.json keywords, links and strength for every note (the "neurons")
 *
 * Each note is Markdown: a title, keywords, then dated lines. Notes link to each other with [[Title]].
 * Remembering adds a line (or a new note). Recalling scores notes by matching keywords with what's
 * happening now, plus how strong and how recent they are, then follows links one step, like one thought
 * leading to another. Notes that get recalled get stronger; notes nobody thinks about slowly fade
 * (they're never deleted, just harder to find).
 *
 * Everything in here is Glint's own, in-world memory (he's Truman): never write game or builder talk into it.
 */
const fs = require("fs");
const path = require("path");

const FOLDERS = ["me", "people", "places", "things", "ideas", "feelings", "days"];
const RAW_MAX = 400;   // lines kept in one day's dump
const STOP = new Set("a an and are as at be been but by can could did do does for from had has have he her here him his how i if in into is it its just like me more my no not now of off on one or our out over so some than that the their them then there these they this to too up us very was we were what when where which while who why will with would you your about after again all also am any back because before being both each even ever get got going gone into let lot made make many much must myself new only other own really same see seem should since still such take tell thing things think thought through today want way well went yet".split(" "));
const words = s => String(s || "").toLowerCase().replace(/[^a-z0-9' -]/g, " ").split(/[\s-]+/).map(w => w.replace(/'s$|'/g, "")).filter(w => w.length > 2 && !STOP.has(w));
const slug = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "note";
const DAY = 86_400_000;

function createGlintBrain({ dir, now = () => Date.now() }) {
  const indexFile = path.join(dir, "index.json");
  let index = {};
  try { index = JSON.parse(fs.readFileSync(indexFile, "utf8")); } catch { index = {}; }
  for (const f of FOLDERS) { try { fs.mkdirSync(path.join(dir, f), { recursive: true }); } catch { /* ok */ } }
  const saveIndex = () => { try { fs.writeFileSync(indexFile, JSON.stringify(index)); } catch { /* next time */ } };
  const stamp = t => new Date(t).toISOString().slice(0, 16).replace("T", " ");
  const fileOf = rel => path.join(dir, rel);
  const byTitle = title => Object.keys(index).find(k => k !== "_filed" && index[k].title.toLowerCase() === String(title).toLowerCase());

  // Write something down. Same title in the same folder adds to that note.
  function remember({ folder = "things", title, text, keywords = [] } = {}) {
    folder = FOLDERS.includes(folder) ? folder : "things";
    title = String(title || "").replace(/\s+/g, " ").trim().slice(0, 60); text = String(text || "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (!title || !text) return null;
    const rel = byTitle(title) || `${folder}/${slug(title)}.md`, f = fileOf(rel);
    const kw = [...new Set([...(index[rel]?.keywords || []), ...[].concat(keywords).flatMap(k => words(k)), ...words(title)])].slice(0, 24);
    let body = ""; try { body = fs.readFileSync(f, "utf8"); } catch { /* new note */ }
    const lines = body.split("\n").filter(l => l.startsWith("- "));
    if (lines.some(l => l.endsWith(text))) return rel;          // already know that
    lines.push(`- ${stamp(now())} ${text}`);
    const keep = lines.slice(-40);                              // a note holds its last 40 lines
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `# ${title}\nkeywords: ${kw.join(", ")}\n\n${keep.join("\n")}\n`); } catch { return null; }
    const links = [...new Set([...(index[rel]?.links || []), ...[...text.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].slice(0, 60))])].slice(0, 20);
    index[rel] = { title, folder: rel.split("/")[0], keywords: kw, links, strength: Math.min(10, (index[rel]?.strength || 1) + 0.5), updated: now(), lines: keep.length };
    saveIndex();
    return rel;
  }

  // The day's dump: one line per moment, filed at night.
  const rawFile = (t = now()) => path.join(dir, "raw", new Date(t).toISOString().slice(0, 10) + ".log");
  function log(kind, text) {
    const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, 300); if (!t) return;
    try { fs.mkdirSync(path.join(dir, "raw"), { recursive: true }); fs.appendFileSync(rawFile(), `${new Date(now()).toISOString().slice(11, 16)} ${kind}: ${t}\n`); } catch { /* skip */ }
  }
  // Dreaming: hand the unfiled dumps to `dreamer` (his mind at night) and file what comes back.
  async function dream(dreamer) {
    let files = []; try { files = fs.readdirSync(path.join(dir, "raw")).filter(f => f.endsWith(".log")).sort(); } catch { return 0; }
    const filed = new Set(index._filed || []), todo = files.filter(f => !filed.has(f));
    let n = 0;
    for (const f of todo) {
      const raw = fs.readFileSync(path.join(dir, "raw", f), "utf8").split("\n").filter(Boolean).slice(-RAW_MAX).join("\n");
      if (!raw) continue;
      const notes = Object.entries(index).filter(([k]) => k !== "_filed").map(([, e]) => `${e.folder}/${e.title} [${e.keywords.slice(0, 6).join(",")}]`);
      const out = await dreamer({ day: f.slice(0, 10), dump: raw, notes });
      for (const m of (Array.isArray(out?.file) ? out.file : []).slice(0, 25)) if (m && remember({ folder: String(m.folder || "").toLowerCase(), title: m.title, text: m.note || m.text, keywords: Array.isArray(m.keywords) ? m.keywords.map(String).slice(0, 8) : [] })) n++;
      if (out?.self) remember({ folder: "me", title: "Who I am", text: out.self, keywords: ["glint", "me"] });
      index._filed = [...(index._filed || []), f].slice(-60); saveIndex();
    }
    return n;
  }
  const entries = () => Object.entries(index).filter(([k]) => k !== "_filed");

  function read(rel, last = 6) {
    try { return fs.readFileSync(fileOf(rel), "utf8").split("\n").filter(l => l.startsWith("- ")).slice(-last).map(l => l.slice(2)); } catch { return []; }
  }

  // Find what comes to mind for these cues (words, names, places). One thought leads to another via links.
  function recall(cues, n = 5) {
    const cw = new Set(words([].concat(cues).join(" "))), t = now();
    if (!cw.size) return [];
    const score = (rel, e) => {
      let hit = 0;
      for (const k of e.keywords) if (cw.has(k)) hit += 1;
      for (const w of words(e.title)) if (cw.has(w)) hit += 1.5;
      if (!hit) return 0;
      const fade = Math.exp(-(t - (e.used || e.updated)) / (14 * DAY));   // older, unused memories fade
      return hit * (1 + Math.log1p(e.strength)) * (0.4 + 0.6 * fade);
    };
    const ranked = entries().map(([rel, e]) => [rel, score(rel, e)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
    const picked = ranked.slice(0, n).map(([rel]) => rel);
    for (const rel of picked.slice(0, 2)) for (const l of index[rel].links) { const r = byTitle(l); if (r && !picked.includes(r) && picked.length < n + 2) picked.push(r); }
    for (const rel of picked) { index[rel].strength = Math.min(10, index[rel].strength + 0.2); index[rel].used = t; }
    if (picked.length) saveIndex();
    return picked.map(rel => ({ note: index[rel].title, kind: index[rel].folder, lines: read(rel, 4) }));
  }

  // At bedtime: a page for the day from his diary, and the day's people and places get a line each.
  function sleepOn(diary, day = now()) {
    const d = new Date(day), title = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const today = (diary || []).filter(e => now() - e.at < DAY);
    if (!today.length) return null;
    const rel = `days/${d.toISOString().slice(0, 10)}.md`;
    const lines = today.map(e => `- ${new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${e.thought}${e.did ? ` (${e.did})` : ""}`);
    const kw = [...new Set(today.flatMap(e => words(e.thought + " " + e.did)))].slice(0, 30);
    try { fs.writeFileSync(fileOf(rel), `# ${title}\nkeywords: ${kw.join(", ")}\n\n${lines.join("\n")}\n`); } catch { return null; }
    index[rel] = { title, folder: "days", keywords: kw, links: [], strength: 1, updated: now(), lines: lines.length };
    // Memories nobody thought about today get a little weaker.
    for (const [, e] of entries()) if (now() - (e.used || e.updated) > DAY) e.strength = Math.max(0.2, e.strength * 0.97);
    saveIndex();
    return rel;
  }

  // What the brain looks like: folders, notes, sizes (for the owner's peek, and for Glint's sense of self).
  function map() {
    const out = {};
    for (const f of FOLDERS) out[f] = [];
    for (const [rel, e] of entries()) (out[e.folder] || (out[e.folder] = [])).push({ path: rel, title: e.title, strength: Math.round(e.strength * 10) / 10, lines: e.lines || 0, updated: e.updated, keywords: e.keywords.slice(0, 8) });
    for (const f of Object.keys(out)) out[f].sort((a, b) => b.updated - a.updated);
    return out;
  }
  const page = rel => (rel !== "_filed" && index[rel] ? { title: index[rel].title, folder: index[rel].folder, lines: read(rel, 40) } : null);
  const count = () => entries().length;

  return { remember, recall, sleepOn, log, dream, map, page, count, FOLDERS };
}

module.exports = { createGlintBrain, words };
