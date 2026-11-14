// Glint's life in the Grid page: keeps window.GLINT_LIFE up to date from the server (where Glint really is, what he's
// doing and thinking), shows his thoughts at the top, and lets the owner talk to him. Lives outside public/glint/ so
// Glint's own builds can't break it; his engine draws him from window.GLINT_LIFE.
(() => {
  const L = window.GLINT_LIFE = { ready: false, x: 12, y: 12, next: null, activity: "", thought: "", say: "", mood: "", awake: true, diary: [] };
  const MOOD = { happy: "😊", curious: "🤔", excited: "🤩", proud: "😌", calm: "😌", sleepy: "😴", thoughtful: "💭", playful: "😄", determined: "💪", inspired: "✨", content: "🙂" };
  const css = document.createElement("style");
  css.textContent = `.life-strip{position:fixed;z-index:3;left:12px;right:12px;top:calc(36px + env(safe-area-inset-top));pointer-events:none;font:500 .8rem/1.3 system-ui;color:#dff8ff;text-shadow:0 1px 4px #000}
  .life-strip b{color:#57e1ff;font-weight:700}.life-strip i{display:block;opacity:.85;font-style:normal;max-height:2.6em;overflow:hidden}
  .life-say{position:fixed;z-index:4;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));max-width:calc(100% - 32px);padding:7px 12px;border-radius:14px;background:#e9fbff;color:#06231a;font:600 .9rem/1.3 system-ui;text-align:center;box-shadow:0 4px 16px #0008}
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
  let talkAdded = false, lastSay = "";
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
        if (L.say && L.say !== lastSay && !chat) { bubble.innerHTML = `<b>◈ ${esc(L.name || "Glint")}:</b> ${esc(L.say)}`; bubble.classList.remove("life-hidden"); }
        if (!L.say) bubble.classList.add("life-hidden");
        lastSay = L.say;
        if (L.canTalk) { addTalk(); addBrain(); }
      }
    } catch { /* offline: Glint just strolls on his own */ }
    setTimeout(poll, document.hidden ? 8000 : 1500);
  }
  poll();
})();
