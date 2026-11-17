// Glint's life in the Grid page: keeps window.GLINT_LIFE up to date from the server (where Glint really is, what he's
// doing and thinking), shows his thoughts at the top, and lets the owner talk to him. Lives outside public/glint/ so
// Glint's own builds can't break it; his engine draws him from window.GLINT_LIFE.
(() => {
  const L = window.GLINT_LIFE = { ready: false, x: 12, y: 12, next: null, activity: "", thought: "", say: "", mood: "", awake: true, diary: [] };
  const MOOD = { happy: "😊", curious: "🤔", excited: "🤩", proud: "😌", calm: "😌", sleepy: "😴", thoughtful: "💭", playful: "😄", determined: "💪", inspired: "✨", content: "🙂" };
  const css = document.createElement("style");
  css.textContent = `.life-strip{position:fixed;z-index:3;left:12px;right:12px;top:calc(36px + env(safe-area-inset-top));pointer-events:none;font:500 .8rem/1.3 system-ui;color:#dff8ff;text-shadow:0 1px 4px #000}
  .life-strip b{color:#57e1ff;font-weight:700}.life-strip i{display:block;opacity:.85;font-style:normal;max-height:2.6em;overflow:hidden}
  .life-say{position:fixed;z-index:4;left:50%;transform:translateX(-50%);top:calc(100px + env(safe-area-inset-top));pointer-events:none;max-width:calc(100% - 32px);padding:7px 12px;border-radius:14px;background:#e9fbff;color:#06231a;font:600 .9rem/1.3 system-ui;text-align:center;box-shadow:0 4px 16px #0008}
  .life-say b{color:#0a7f9a}.life-hidden{display:none}
  .life-brain{position:fixed;z-index:6;left:0;right:0;bottom:0;max-height:62vh;display:flex;flex-direction:column;background:#071a22f2;border-top:1px solid #57e1ff66;color:#dff8ff;font:500 .85rem/1.35 system-ui;padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
  .life-brain h3{margin:0 0 6px;font-size:.95rem;color:#57e1ff}.life-brain .bs{overflow:auto;flex:1}.life-brain h4{margin:8px 0 2px;font-size:.8rem;opacity:.7;text-transform:uppercase}
  .life-brain button{min-height:44px;border-radius:10px;border:1px solid #57e1ff55;background:#0d2c38;color:#dff8ff;font:600 .85rem system-ui;padding:0 12px;margin:3px 4px 3px 0}
  .life-brain p{margin:3px 0;opacity:.9}.life-brain .bf{display:flex;justify-content:flex-end;padding-top:6px}
  .life-chat .cl p{margin:5px 0;padding:6px 10px;border-radius:12px;max-width:85%;width:fit-content}.life-chat .cl .g{background:#e9fbff;color:#06231a}.life-chat .cl .u{background:#1d4656;margin-left:auto}
  .life-chat .cl .w{opacity:.7;font-style:italic;background:none}.life-chat form{display:flex;gap:6px;padding-top:6px}
  .life-chat input{flex:1;min-width:0;min-height:44px;border-radius:10px;border:1px solid #57e1ff55;background:#04141a;color:#dff8ff;font:500 1rem system-ui;padding:0 10px}
  .life-chat form button{margin:0}`;
  document.head.append(css);
  const strip = document.createElement("div"), bubble = document.createElement("div");
  strip.className = "life-strip"; bubble.className = "life-say life-hidden";
  document.body.append(strip, bubble);
  const esc = v => String(v || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let talkAdded = false, lastSay = "", bubbleTimer = 0;
  function addTalk() {
    if (talkAdded) return; talkAdded = true;
    const bar = document.querySelector(".bar"), b = document.createElement(bar ? "button" : "button");
    b.className = bar ? "btn" : "btn life-talk"; b.textContent = "💬 Talk";
    if (!bar) Object.assign(b.style, { position: "fixed", right: "12px", bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 5, minHeight: "44px", padding: "0 14px" });
    b.onclick = () => openChat();
    if (bar) bar.insertBefore(b, bar.children[bar.children.length - 1] || null); else document.body.append(b);
  }
  // Talking with Glint: the whole conversation, a box to type in, low by your thumbs.
  let chat = null, waiting = false;
  function openChat() {
    document.querySelector(".life-brain")?.remove();
    chat = document.createElement("div"); chat.className = "life-brain life-chat";
    chat.innerHTML = `<h3>💬 Talking with ${esc(L.name || "Glint")}</h3><div class="bs cl"></div><form><input maxlength="200" placeholder="Say something…" enterkeyhint="send"><button>Send</button><button type="button" data-d>Done</button></form>`;
    document.body.append(chat); bubble.classList.add("life-hidden");
    const input = chat.querySelector("input");
    chat.querySelector("form").onsubmit = async e => {
      e.preventDefault(); const text = input.value.trim(); if (!text) return;
      input.value = ""; waiting = true; (L.talk ||= []).push({ who: "You", text }); drawChat();
      try { await fetch("../api/glint/say", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); } catch { /* offline */ }
    };
    chat.querySelector("[data-d]").onclick = () => { chat.remove(); chat = null; };
    drawChat(); input.focus();
  }
  function drawChat() {
    if (!chat) return;
    const cl = chat.querySelector(".cl"), lines = L.talk || [];
    const html = (lines.map(m => `<p class="${m.who === "Glint" ? "g" : "u"}">${m.who === "Glint" ? "◈ " : ""}${esc(m.text)}</p>`).join("") || `<p class="w">Say hello!</p>`) +
      (L.replying || (waiting && lines[lines.length - 1]?.who !== "Glint") ? `<p class="w">◈ ${esc(L.name || "Glint")} is thinking…</p>` : "");
    if (html === cl.dataset.h) return; cl.dataset.h = html; cl.innerHTML = html;   // only when something changed
    cl.scrollTop = cl.scrollHeight;
  }

  // ===== Travelers walk in the Grid with their own bodies =====
  // You appear at the edge of his town and walk where you tap. Other family members who are walking show up too.
  // How a traveler looks is Kindle's to make (THINGS.traveler in his things.js); until he does, a plain little figure of light.
  const me = { x: 0, y: 0, path: [], walker: null, sentAt: 0, sent: "" }, others = new Map();
  let attached = false;
  function walkable(x, y) {
    const W = window.GLINT_WORLD; if (!W) return false;
    if (!W._blocked) W._blocked = new Set((W.things || []).filter(t => !t.flat).map(t => t.x + "," + t.y));
    return "pof".includes((W.tiles[y] || "")[x] || ".") && !W._blocked.has(x + "," + y);
  }
  function routeTo(sx, sy, gx, gy) {
    const W = window.GLINT_WORLD, key = (x, y) => x + "," + y, goals = new Set((walkable(gx, gy) ? [[0, 0]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([a, b]) => [gx + a, gy + b]).filter(([x, y]) => walkable(x, y)).map(([x, y]) => key(x, y)));
    if (!goals.size || !W) return [];
    const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (goals.has(key(x, y))) { const out = []; let k = key(x, y); while (k && k !== key(sx, sy)) { out.unshift(k.split(",").map(Number)); k = prev.get(k); } return out; }
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b; if (nx >= 0 && ny >= 0 && nx < W.size && ny < W.size && !prev.has(key(nx, ny)) && walkable(nx, ny)) { prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]); } }
    }
    return [];
  }
  function spawnSpot() {   // the edge of his town: by the welcome sign if there is one, else the nearest path to the start
    const W = window.GLINT_WORLD, h = (W.things || []).find(t => t.kind === "home") || { x: W.size / 2, y: W.size / 2 }, sign = (W.things || []).filter(t => t.kind === "sign").sort((a, b) => Math.hypot(b.x - h.x, b.y - h.y) - Math.hypot(a.x - h.x, a.y - h.y))[0], from = sign || W.start || { x: W.size / 2, y: W.size / 2 };
    let best = null;
    for (let y = 0; y < W.size; y++) for (let x = 0; x < W.size; x++) if (walkable(x, y)) { const d = Math.hypot(x - from.x, y - from.y); if (!best || d < best.d) best = { x, y, d }; }
    return best || { x: Math.round(from.x), y: Math.round(from.y) };
  }
  function newWalker(name) { return { kind: "traveler", traveler: true, name, x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, px: 0, py: 0, wait: 1e9, dx: 0, dy: 1, moving: false, say: "A traveler, walking in the Grid." }; }
  function attach() {
    const G = window.GLINT_GRID, W = window.GLINT_WORLD, T = window.GLINT_THINGS;
    if (attached || !G?.walkers || !W || !T || !L.ready || !L.me) return;
    attached = true;
    if (!T.traveler) T.traveler = function (ctx, x, y, s, t, th) {   // a plain little figure of light, until Kindle makes travelers their bodies
      const bob = th.moving ? Math.sin(t * 10) * s * 0.03 : 0, by = y + s * 0.3;
      ctx.fillStyle = "#0008"; ctx.beginPath(); ctx.ellipse(x, by, s * 0.22, s * 0.07, 0, 0, 7); ctx.fill();
      ctx.shadowColor = "#fff6d0"; ctx.shadowBlur = s * 0.3; ctx.fillStyle = "#fff3cf";
      ctx.beginPath(); ctx.roundRect(x - s * 0.15, by - s * 0.62 + bob, s * 0.3, s * 0.5, s * 0.12); ctx.fill();
      ctx.beginPath(); ctx.arc(x, by - s * 0.76 + bob, s * 0.15, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#2a2a40"; ctx.beginPath(); ctx.arc(x - s * 0.05 + th.dx * s * 0.03, by - s * 0.78 + bob, s * 0.022, 0, 7); ctx.arc(x + s * 0.05 + th.dx * s * 0.03, by - s * 0.78 + bob, s * 0.022, 0, 7); ctx.fill();
      ctx.font = `600 ${Math.max(9, s * 0.28)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#dff8ff"; ctx.fillText(th.name, x, by - s * 1.02 + bob);
    };
    const at = spawnSpot(); Object.assign(me, { x: at.x, y: at.y, path: [] });
    me.walker = newWalker(L.me); Object.assign(me.walker, { fx: at.x, fy: at.y, x: at.x, y: at.y, mine: true, say: "That's you! Tap the ground to walk." });
    G.walkers.push(me.walker);
    sendWhere(true);
    // tap the ground (or a thing) to walk there; drags and pinches still move the camera
    const cv = document.getElementById("grid"); let down = null;
    cv.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, n: (down?.n || 0) + 1 }; });
    cv.addEventListener("pointerup", e => {
      const d = down; down = null; if (!d || d.n > 1 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
      const c = G.cam, wx = Math.floor(c.x + (e.clientX - innerWidth / 2) / c.s), wy = Math.floor(c.y + (e.clientY - innerHeight / 2) / c.s);
      const p = routeTo(Math.round(me.x), Math.round(me.y), wx, wy); if (p.length) me.path = p;
    });
    cv.addEventListener("pointercancel", () => { down = null; });
    requestAnimationFrame(stepMe);
  }
  let lastStep = 0;
  function stepMe(ms) {
    const dt = Math.min(0.1, (ms - lastStep) / 1000 || 0); lastStep = ms;
    const w = me.walker;
    if (me.path.length) {
      const [tx, ty] = me.path[0], dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy), go = dt * 2;
      if (d <= go) { me.x = tx; me.y = ty; me.path.shift(); if (!me.path.length) sendWhere(true); } else { me.x += dx / d * go; me.y += dy / d * go; w.dx = Math.sign(Math.round(dx)); w.dy = Math.sign(Math.round(dy)); }
    }
    w.fx = me.x; w.fy = me.y; w.moving = me.path.length > 0; w.wait = 1e9;
    for (const o of others.values()) { const dx = o.gx - o.w.fx, dy = o.gy - o.w.fy, d = Math.hypot(dx, dy); if (d > 4) { o.w.fx = o.gx; o.w.fy = o.gy; } else if (d > 0.02) { const go = Math.min(d, dt * 2); o.w.fx += dx / d * go; o.w.fy += dy / d * go; o.w.dx = Math.sign(Math.round(dx)); o.w.dy = Math.sign(Math.round(dy)); } o.w.moving = d > 0.05; o.w.wait = 1e9; }
    if (performance.now() - me.sentAt > (me.path.length ? 1000 : 10000)) sendWhere();
    requestAnimationFrame(stepMe);
  }
  function sendWhere(force) {
    const k = `${me.x.toFixed(1)},${me.y.toFixed(1)}`; if (!force && k === me.sent && performance.now() - me.sentAt < 10000) return;
    me.sentAt = performance.now(); me.sent = k;
    fetch("../api/glint/walk", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: me.x, y: me.y }) }).catch(() => {});
  }
  function syncOthers() {
    const G = window.GLINT_GRID; if (!attached || !G) return;
    const seen = new Set();
    for (const t of L.travelers || []) {
      if (t.name === L.me) continue; seen.add(t.name);
      let o = others.get(t.name); if (!o) { o = { w: Object.assign(newWalker(t.name), { fx: t.x, fy: t.y, x: t.x, y: t.y }) }; others.set(t.name, o); G.walkers.push(o.w); }
      o.gx = t.x; o.gy = t.y;
    }
    for (const [n, o] of others) if (!n.startsWith("folk:") && !seen.has(n)) { const i = G.walkers.indexOf(o.w); if (i >= 0) G.walkers.splice(i, 1); others.delete(n); }
    // Kindle's neighbours: they walk on their own; asleep at home, their house glows.
    const T = window.GLINT_THINGS, W = window.GLINT_WORLD;
    if (T && !T.neighbour) T.neighbour = function (ctx, x, y, s, t, th) {
      if (th.inside) {   // home for the night: a warm light in their window
        const g = ctx.createRadialGradient(x, y - s * 0.5, 0, x, y - s * 0.5, s * 0.9); g.addColorStop(0, "#ffd98a99"); g.addColorStop(1, "#ffd98a00");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.9, 0, 7); ctx.fill(); return;
      }
      const c = th.color || "#ffb36b", bob = th.moving ? Math.sin(t * 9) * s * 0.03 : Math.sin(t * 2) * s * 0.015, by = y + s * 0.3;
      ctx.fillStyle = "#0008"; ctx.beginPath(); ctx.ellipse(x, by, s * 0.2, s * 0.06, 0, 0, 7); ctx.fill();
      ctx.shadowColor = c; ctx.shadowBlur = s * 0.35; ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect(x - s * 0.14, by - s * 0.5 + bob, s * 0.28, s * 0.42, s * 0.13); ctx.fill();
      ctx.beginPath(); ctx.arc(x, by - s * 0.64 + bob, s * 0.14, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#1b1b2e"; ctx.beginPath(); ctx.arc(x - s * 0.045 + th.dx * s * 0.03, by - s * 0.66 + bob, s * 0.02, 0, 7); ctx.arc(x + s * 0.045 + th.dx * s * 0.03, by - s * 0.66 + bob, s * 0.02, 0, 7); ctx.fill();
      ctx.font = `600 ${Math.max(9, s * 0.26)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#ffe9c9"; ctx.fillText(th.name, x, by - s * 0.9 + bob);
    };
    const live = new Set();
    for (const f of L.folk || []) {
      live.add(f.name);
      let o = folkWalkers.get(f.name); if (!o) { o = { w: Object.assign(newWalker(f.name), { kind: "neighbour", traveler: false, fx: f.x, fy: f.y, x: f.x, y: f.y }) }; folkWalkers.set(f.name, o); G.walkers.push(o.w); others.set("folk:" + f.name, o); }
      const home = f.homeLit && (W?.things || []).find(t => t.name === f.home);
      Object.assign(o.w, { color: f.color, inside: !!home, say: f.say || `${f.name} is ${f.activity}.` });
      [o.gx, o.gy] = home ? [home.x, home.y + 0.02] : f.moving && f.next ? f.next : [f.x, f.y];
    }
    for (const [n, o] of folkWalkers) if (!live.has(n)) { const i = G.walkers.indexOf(o.w); if (i >= 0) G.walkers.splice(i, 1); folkWalkers.delete(n); others.delete("folk:" + n); }
  }
  const folkWalkers = new Map();
  window.GLINT_ME = me;   // for the test bot
  let brainAdded = false;
  function addBrain() {
    if (brainAdded) return; brainAdded = true;
    const bar = document.querySelector(".bar"); if (!bar) return;
    const b = document.createElement("button"); b.className = "btn"; b.textContent = "🧠 Brain";
    b.onclick = () => openBrain();
    bar.insertBefore(b, bar.children[bar.children.length - 1] || null);
  }
  const ICON = { me: "✨ Me", people: "🧑 People", places: "📍 Places", things: "🔧 Things", ideas: "💡 Ideas", feelings: "💗 Feelings", days: "📅 Days" };
  async function openBrain(note) {
    document.querySelector(".life-brain")?.remove();
    const p = document.createElement("div"); p.className = "life-brain"; document.body.append(p);
    const get = async q => { try { const r = await fetch("../api/glint/brain" + q, { credentials: "same-origin", cache: "no-store" }); return r.ok ? r.json() : {}; } catch { return {}; } };
    if (note) {
      const n = await get("?note=" + encodeURIComponent(note));
      p.innerHTML = `<h3>${esc(n.title || "Note")}</h3><div class="bs">${(n.lines || []).map(l => `<p>${esc(l)}</p>`).join("") || "<p>Empty.</p>"}</div><div class="bf"><button data-b>Back</button></div>`;
      p.querySelector("[data-b]").onclick = () => openBrain();
      return;
    }
    const m = await get("");
    const f = m.folders || {};
    p.innerHTML = `<h3>🧠 ${esc(L.name || "Glint")}'s brain · ${m.count || 0} notes</h3><div class="bs">${Object.keys(ICON).filter(k => (f[k] || []).length).map(k => `<h4>${ICON[k]}</h4>${f[k].map(n => `<button data-n="${esc(n.path)}">${esc(n.title)}</button>`).join("")}`).join("") || "<p>Nothing yet. He's only just started remembering.</p>"}</div><div class="bf"><button data-d>Done</button></div>`;
    p.querySelectorAll("[data-n]").forEach(x => x.onclick = () => openBrain(x.dataset.n));
    p.querySelector("[data-d]").onclick = () => p.remove();
  }
  async function poll() {
    try {
      const r = await fetch("../api/glint/life", { credentials: "same-origin", cache: "no-store" });
      if (r.ok) {
        Object.assign(L, await r.json(), { ready: true, at: performance.now() });
        const face = L.awake ? (MOOD[L.mood] || "◈") : "😴";
        strip.innerHTML = `${face} <b>${esc(L.name || "Glint")}</b> is ${esc(L.activity || "around")}${L.thought ? `<i>💭 ${esc(L.thought)}</i>` : ""}`;
        if (L.talk?.[L.talk.length - 1]?.who === "Glint") waiting = false;
        if (chat) drawChat();
        if (L.say && L.say !== lastSay && !chat) { bubble.innerHTML = `<b>◈ ${esc(L.name || "Glint")}:</b> ${esc(L.say)}`; bubble.classList.remove("life-hidden");
          // up just long enough to read: average reading is about 4 words a second, plus 2 seconds
          clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.add("life-hidden"), (L.say.split(/\s+/).length / 4 + 2) * 1000); }
        if (!L.say) bubble.classList.add("life-hidden");
        lastSay = L.say;
        if (L.canTalk) { addTalk(); addBrain(); }
        attach(); syncOthers();
      }
    } catch { /* offline: Glint just strolls on his own */ }
    setTimeout(poll, document.hidden ? 8000 : 1500);
  }
  poll();
})();
