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
  .life-say::before{content:"◈ Glint: ";color:#0a7f9a}.life-hidden{display:none}`;
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
    b.onclick = async () => {
      const text = prompt("Say something to Glint:"); if (!text || !text.trim()) return;
      try { await fetch("../api/glint/say", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); } catch { /* offline */ }
      strip.querySelector("i") && (strip.querySelector("i").textContent = "…listening…");
    };
    if (bar) bar.insertBefore(b, bar.children[bar.children.length - 1] || null); else document.body.append(b);
  }
  async function poll() {
    try {
      const r = await fetch("../api/glint/life", { credentials: "same-origin", cache: "no-store" });
      if (r.ok) {
        Object.assign(L, await r.json(), { ready: true, at: performance.now() });
        const face = L.awake ? (MOOD[L.mood] || "◈") : "😴";
        strip.innerHTML = `${face} <b>Glint</b> is ${esc(L.activity || "around")}${L.thought ? `<i>💭 ${esc(L.thought)}</i>` : ""}`;
        if (L.say && L.say !== lastSay) { bubble.textContent = L.say; bubble.classList.remove("life-hidden"); }
        if (!L.say) bubble.classList.add("life-hidden");
        lastSay = L.say;
        if (L.canTalk) addTalk();
      }
    } catch { /* offline: Glint just strolls on his own */ }
    setTimeout(poll, document.hidden ? 8000 : 1500);
  }
  poll();
})();
