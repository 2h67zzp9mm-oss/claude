(() => {
  "use strict";

  const { places, MAP, PLAYABLE_IDS } = window.LivingTownWorld;
  const $ = selector => document.querySelector(selector);
  const canvas = $("#townCanvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    clock: $("#worldClock"),
    date: $("#worldDate"),
    name: $("#residentName"),
    activity: $("#residentActivity"),
    intent: $("#residentIntent"),
    portrait: $("#residentPortrait"),
    needs: $("#needsPanel"),
    closestFriend: $("#closestFriend"),
    memoryCount: $("#memoryCount"),
    latestMemory: $("#latestMemory"),
    age: $("#residentAge"),
    mood: $("#residentMood"),
    career: $("#residentCareer"),
    goal: $("#residentGoal"),
    goalProgress: $("#goalProgress"),
    summary: $("#profileSummary"),
    family: $("#residentFamily"),
    history: $("#lifeHistory"),
    knowledge: $("#knowledgeList"),
    eventFeed: $("#eventFeed"),
    returnCard: $("#returnCard"),
    returnEvents: $("#returnEvents"),
    connectionStatus: $("#connectionStatus"),
    placeChip: $("#placeChip"),
    sheet: $("#residentSheet")
  };

  // Base character art. A player's chosen look is layered on top.
  const baseLooks = {
    olive: { skin: "#f2c7a5", hair: "#6b3f2a", shirt: "#a98cff", pants: "#3f4d79", shoes: "#f7d56b", style: "pigtails", accessory: "bow" },
    hazel: { skin: "#f2c7a5", hair: "#8b572f", shirt: "#f28482", pants: "#3f6f74", shoes: "#ffe08a", style: "buns", accessory: "headband" },
    dad: { skin: "#d8a47f", hair: "#3e2a22", shirt: "#4fc3a1", pants: "#31455e", shoes: "#c58b55", style: "bald", accessory: "beard" },
    milo: { skin: "#8d5524", hair: "#24160f", shirt: "#ff9966", pants: "#315b70", shoes: "#f1eee4", style: "curls" },
    zara: { skin: "#c68642", hair: "#201713", shirt: "#ff6f91", pants: "#633d78", shoes: "#272038", style: "long", accessory: "star" },
    finn: { skin: "#f1c6a8", hair: "#b55b36", shirt: "#64b5f6", pants: "#38506d", shoes: "#df694f", style: "swoop", accessory: "glasses" },
    nova: { skin: "#6f4125", hair: "#17100d", shirt: "#ffd166", pants: "#4d5584", shoes: "#f08a5d", style: "buns", accessory: "headband" }
  };
  let playerLooks = {};

  function lookFor(r) {
    const base = baseLooks[r.id] || { skin: "#d8a47f", hair: "#38251d", shirt: r.color, pants: "#3f4d5e", shoes: "#eee", style: "short" };
    const chosen = playerLooks[r.id];
    return chosen ? { ...base, style: chosen.hair, accessory: chosen.accessory, shirt: chosen.shirt } : base;
  }

  // --- State ---
  const residents = new Map(); // id -> merged resident (summary + dynamic + detail)
  let events = [];
  let serverNow = Date.now();
  let serverNowAt = performance.now();
  let me = null;
  let mode = "observe";
  let selectedId = "olive";
  let renderedDetailKey = "";
  let shownReturnFor = null;
  let socket = null;
  let reconnectDelay = 1000;
  let reconnectTimer = null;
  const pendingInspections = new Set();
  const details = new Map(); // id -> { revision, lifeHistory, knowledge, experiences, memories }

  const townMap = new Image();
  townMap.src = "assets/town-map.webp";

  function nowMs() { return serverNow + (performance.now() - serverNowAt); }
  function selected() { return residents.get(selectedId); }

  function mergeResident(data) {
    const existing = residents.get(data.id);
    if (existing) Object.assign(existing, data);
    else residents.set(data.id, { ...data, drawX: data.x, drawY: data.y });
    return residents.get(data.id);
  }

  // --- Networking ---
  function connect() {
    clearTimeout(reconnectTimer);
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    socket = ws;
    ws.addEventListener("open", () => { reconnectDelay = 1000; ui.connectionStatus.textContent = "Live · shared world"; });
    ws.addEventListener("close", () => {
      if (socket !== ws) return; // replaced deliberately
      ui.connectionStatus.textContent = "Disconnected — retrying…";
      reconnectTimer = setTimeout(connect, reconnectDelay + Math.random() * 500);
      reconnectDelay = Math.min(30_000, reconnectDelay * 2);
    });
    ws.addEventListener("message", event => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      handleMessage(msg);
    });
  }

  // Sessions are bound to the socket, so reconnect after signing in or out.
  function reconnect() {
    const old = socket;
    socket = null;
    if (old) old.close();
    connect();
  }

  function send(payload) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  function setClock(now) { serverNow = now; serverNowAt = performance.now(); }

  function handleMessage(msg) {
    if (msg.type === "hello") {
      if (!msg.me && me) { me = null; updatePlayerUi(); }
    } else if (msg.type === "state") {
      setClock(msg.now);
      playerLooks = msg.looks || {};
      residents.clear();
      msg.state.residents.forEach(mergeResident);
      events = msg.state.events;
      renderedDetailKey = "";
      maybeShowReturnCard();
      renderFeed();
      renderSelected();
    } else if (msg.type === "tick") {
      setClock(msg.now);
      msg.changed.forEach(mergeResident);
      msg.residents.forEach(mergeResident);
      if (msg.events.length) {
        events = [...msg.events.reverse(), ...events].slice(0, 50);
        maybeShowReturnCard();
        renderFeed();
      }
      renderSelected();
    } else if (msg.type === "resident-detail") {
      const r = msg.resident;
      details.set(r.id, { revision: r.lifeRevision, lifeHistory: r.lifeHistory, knowledge: r.knowledge, experiences: r.experiences, memories: r.memories });
      pendingInspections.delete(r.id);
      if (r.id === selectedId) { renderedDetailKey = ""; renderSelected(); }
    } else if (msg.type === "looks") {
      playerLooks = msg.looks || {};
      renderedDetailKey = "";
      renderSelected();
    } else if (msg.type === "control-rejected") {
      showToast(msg.reason);
    }
  }

  function maybeShowReturnCard() {
    const latest = events.find(event => event.text.startsWith("The server was offline"));
    if (latest && shownReturnFor !== latest.id && Date.now() - latest.at < 10 * 60_000) {
      shownReturnFor = latest.id;
      const related = events.filter(event => Math.abs(event.at - latest.at) < 5000).slice(0, 4);
      ui.returnEvents.innerHTML = related.map(event => `<li>${escapeHtml(event.text)}</li>`).join("");
      ui.returnCard.classList.remove("hidden");
    }
  }

  function requestInspection(r) {
    const detail = details.get(r.id);
    if (detail?.revision === r.lifeRevision || pendingInspections.has(r.id)) return;
    pendingInspections.add(r.id);
    send({ type: "inspect", residentId: r.id });
    setTimeout(() => pendingInspections.delete(r.id), 3000);
  }

  // --- Drawing ---
  let dpr = 1;
  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = MAP.width * dpr;
    canvas.height = MAP.height * dpr;
  }

  let lastFrame = performance.now();
  function frame(time) {
    const dt = Math.min(0.1, (time - lastFrame) / 1000);
    lastFrame = time;
    // Ease drawn positions toward the latest server position so movement is
    // smooth between one-second server updates.
    for (const r of residents.values()) {
      const k = Math.min(1, dt * 4);
      r.drawX += (r.x - r.drawX) * k;
      r.drawY += (r.y - r.drawY) * k;
      if (Math.hypot(r.x - r.drawX, r.y - r.drawY) > 120) { r.drawX = r.x; r.drawY = r.y; }
    }
    drawTown();
    updateClock();
    requestAnimationFrame(frame);
  }

  function drawTown() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MAP.width, MAP.height);
    if (townMap.complete && townMap.naturalWidth) {
      ctx.drawImage(townMap, 0, 0, MAP.width, MAP.height);
    } else {
      ctx.fillStyle = "#7baa68";
      ctx.fillRect(0, 0, MAP.width, MAP.height);
      for (const place of Object.values(places)) {
        ctx.fillStyle = place.color;
        ctx.beginPath(); ctx.arc(place.x, place.y, 46, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1a2940"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
        ctx.fillText(place.name.toUpperCase(), place.x, place.y - 54);
      }
    }
    const list = [...residents.values()].sort((a, b) => a.drawY - b.drawY);
    list.forEach(drawResident);
    const now = nowMs();
    list.forEach(r => { if (r.speech && now >= r.speech.from && now < r.speech.until) drawChatBubble(r, r.speech.text); });
  }

  function drawResident(r) {
    const look = lookFor(r);
    const x = r.drawX, y = r.drawY;
    const walking = Math.hypot(r.targetX - r.x, r.targetY - r.y) > 3;
    const phase = performance.now() / 130 + r.id.charCodeAt(0);
    const bob = walking ? Math.abs(Math.sin(phase)) * 2 : r.asleep ? 0 : Math.sin(phase * 0.12) * 0.5;
    const stride = walking ? Math.sin(phase) * 4 : 0;

    ctx.save();
    ctx.translate(x, y - bob);
    if (r.asleep) ctx.globalAlpha = 0.75;
    if (r.id === selectedId) {
      ctx.strokeStyle = "#fff4b8"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -9, 24, 34, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.beginPath(); ctx.ellipse(0, 17 + bob, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = look.pants; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(-5 - stride * 0.45, 14); ctx.moveTo(4, 5); ctx.lineTo(5 + stride * 0.45, 14); ctx.stroke();
    ctx.strokeStyle = look.shoes; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-7 - stride * 0.45, 15); ctx.lineTo(-2 - stride * 0.45, 15); ctx.moveTo(3 + stride * 0.45, 15); ctx.lineTo(8 + stride * 0.45, 15); ctx.stroke();
    ctx.strokeStyle = look.skin; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-13 + stride * 0.35, 4); ctx.moveTo(10, -5); ctx.lineTo(13 - stride * 0.35, 4); ctx.stroke();
    ctx.fillStyle = look.shirt;
    ctx.beginPath(); ctx.roundRect(-11, -10, 22, 19, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.beginPath(); ctx.roundRect(-7, -7, 5, 12, 3); ctx.fill();
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.arc(-11, -21, 3, 0, Math.PI * 2); ctx.arc(11, -21, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -22, 12, 0, Math.PI * 2); ctx.fill();
    drawHair(look);
    if (r.asleep) {
      ctx.strokeStyle = "#2a2020"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-2, -22); ctx.moveTo(2, -22); ctx.lineTo(6, -22); ctx.stroke();
    } else {
      ctx.fillStyle = "#2a2020";
      ctx.beginPath(); ctx.arc(-4, -22, 1.4, 0, Math.PI * 2); ctx.arc(4, -22, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#8b4f48"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -18, 3.4, 0.15, Math.PI - 0.15); ctx.stroke();
    drawAccessory(look);
    ctx.restore();

    ctx.fillStyle = "rgba(18,28,43,.82)";
    ctx.beginPath(); ctx.roundRect(x - 25, y + 21, 50, 16, 8); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "700 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(r.asleep ? `${r.name} · z` : r.name, x, y + 29);
  }

  function drawChatBubble(r, text) {
    const label = String(text).length > 54 ? `${String(text).slice(0, 51)}…` : String(text);
    ctx.save();
    ctx.font = "700 12px system-ui";
    const width = Math.min(220, Math.max(78, ctx.measureText(label).width + 24));
    const x = Math.max(8, Math.min(MAP.width - width - 8, r.drawX - width / 2));
    const y = Math.max(8, r.drawY - 88);
    ctx.fillStyle = "rgba(255,255,248,.96)";
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(x, y, width, 34, 14); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(r.drawX - 6, y + 32); ctx.lineTo(r.drawX + 5, y + 32); ctx.lineTo(r.drawX, y + 43); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1a2940"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2, y + 17, width - 18);
    ctx.restore();
  }

  function drawHair(look) {
    ctx.fillStyle = look.hair;
    if (look.style === "bald") {
      ctx.beginPath(); ctx.arc(-10, -23, 2.5, Math.PI * .5, Math.PI * 1.5); ctx.arc(10, -23, 2.5, -Math.PI * .5, Math.PI * .5); ctx.fill();
    } else if (look.style === "long") {
      ctx.beginPath(); ctx.arc(0, -22, 13.5, Math.PI, Math.PI * 2); ctx.lineTo(12, -10); ctx.quadraticCurveTo(0, -5, -12, -10); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, -25, 11.5, Math.PI, Math.PI * 2); ctx.lineTo(10, -23); ctx.quadraticCurveTo(2, -28, -10, -22); ctx.closePath(); ctx.fill();
    }
    if (look.style === "pigtails") {
      ctx.beginPath(); ctx.arc(-13, -22, 5, 0, Math.PI * 2); ctx.arc(13, -22, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (look.style === "buns") {
      ctx.beginPath(); ctx.arc(-8, -32, 5, 0, Math.PI * 2); ctx.arc(8, -32, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (look.style === "curls") {
      [[-8,-29],[-3,-32],[3,-32],[8,-29],[-11,-25],[11,-25]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x, y, 4.3, 0, Math.PI * 2); ctx.fill(); });
    }
    if (look.style === "swoop") {
      ctx.beginPath(); ctx.moveTo(-10,-28); ctx.quadraticCurveTo(2,-38,11,-27); ctx.quadraticCurveTo(2,-30,-3,-22); ctx.closePath(); ctx.fill();
    }
  }

  function drawAccessory(look) {
    if (look.accessory === "glasses") {
      ctx.strokeStyle = "#314052"; ctx.lineWidth = 1.2;
      ctx.strokeRect(-8, -25, 7, 6); ctx.strokeRect(1, -25, 7, 6);
      ctx.beginPath(); ctx.moveTo(-1, -22); ctx.lineTo(1, -22); ctx.stroke();
    } else if (look.accessory === "beard") {
      ctx.fillStyle = look.hair;
      ctx.beginPath(); ctx.moveTo(-9,-18); ctx.quadraticCurveTo(-7,-7,0,-6); ctx.quadraticCurveTo(7,-7,9,-18); ctx.quadraticCurveTo(5,-13,0,-12); ctx.quadraticCurveTo(-5,-13,-9,-18); ctx.fill();
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.ellipse(0,-17,3.7,2.4,0,0,Math.PI*2); ctx.fill();
    } else if (look.accessory === "bow") {
      ctx.fillStyle = "#f7d56b";
      ctx.beginPath(); ctx.moveTo(7,-32); ctx.lineTo(14,-36); ctx.lineTo(13,-28); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7,-32); ctx.lineTo(2,-37); ctx.lineTo(2,-28); ctx.closePath(); ctx.fill();
    } else if (look.accessory === "headband") {
      ctx.strokeStyle = "#e76f8a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -25, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    } else if (look.accessory === "star") {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath(); ctx.arc(10, -29, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function portraitSvg(r) {
    const look = lookFor(r);
    const glasses = look.accessory === "glasses" ? '<g fill="none" stroke="#314052" stroke-width="2"><rect x="20" y="31" width="12" height="9" rx="3"/><rect x="36" y="31" width="12" height="9" rx="3"/><path d="M32 35h4"/></g>' : "";
    const hair = look.style === "bald" ? '<path d="M18 29q1-20 16-20t16 20" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>' : `<path d="M18 27c1-14 8-21 17-21 10 0 16 8 16 21-8-5-23-5-33 0Z" fill="${look.hair}"/>`;
    const beard = look.accessory === "beard" ? `<path d="M20 34q2 18 14 20 12-2 14-20-6 9-14 9t-14-9Z" fill="${look.hair}"/><ellipse cx="34" cy="39" rx="5" ry="3" fill="${look.skin}"/>` : "";
    return `<svg viewBox="0 0 68 68" aria-hidden="true"><ellipse cx="34" cy="64" rx="18" ry="4" fill="rgba(0,0,0,.2)"/><path d="M19 68V53c0-10 7-16 15-16s15 6 15 16v15" fill="${look.shirt}"/><circle cx="34" cy="28" r="17" fill="${look.skin}"/>${hair}${beard}<circle cx="28" cy="31" r="2" fill="#2a2020"/><circle cx="40" cy="31" r="2" fill="#2a2020"/><path d="M29 39q5 5 10 0" fill="none" stroke="#8b4f48" stroke-width="2" stroke-linecap="round"/>${glasses}</svg>`;
  }

  // --- Resident sheet ---
  function renderSelected() {
    const r = selected();
    if (!r) return;
    requestInspection(r);
    const detail = details.get(r.id);
    const lookKey = JSON.stringify(playerLooks[r.id] || null);
    const key = `${r.id}:${r.lifeRevision}:${detail?.revision}:${lookKey}`;
    if (key !== renderedDetailKey) { renderedDetailKey = key; renderSelectedDetail(r, detail); }
    renderSelectedDynamic(r);
  }

  // Cheap per-tick updates only; no list rebuilding.
  function renderSelectedDynamic(r) {
    const placeLabel = places[r.place]?.name || "Out and about";
    ui.activity.textContent = `${capitalize(r.activity || "")} · ${placeLabel}`;
    ui.intent.textContent = r.intent ? `Why: ${r.intent}` : "";
    ui.placeChip.textContent = `${r.name} · ${placeLabel}`;
    ui.mood.textContent = capitalize(r.mood?.label || "content");
    for (const [key, value] of Object.entries(r.needs || {})) {
      const row = ui.needs.querySelector(`[data-need="${key}"]`);
      if (!row) continue;
      const fill = row.querySelector(".need-fill");
      fill.style.width = `${Math.round(value)}%`;
      fill.classList.toggle("low", value < 30);
      row.querySelector("b").textContent = String(Math.round(value));
    }
  }

  function renderSelectedDetail(r, detail) {
    ui.name.textContent = r.name;
    ui.portrait.innerHTML = portraitSvg(r);
    ui.portrait.style.background = `linear-gradient(145deg, ${r.color}55, #263d5c)`;
    ui.needs.innerHTML = Object.keys(r.needs || {}).map(key => `<div class="need-row" data-need="${key}"><span>${capitalize(key)}</span><div class="need-track"><div class="need-fill"></div></div><b>0</b></div>`).join("");
    const sorted = Object.entries(r.relationships || {}).sort((a, b) => b[1] - a[1]);
    ui.closestFriend.textContent = residents.get(sorted[0]?.[0])?.name || "Nobody yet";
    ui.age.textContent = String(r.profile?.age ?? "—");
    ui.career.textContent = `${r.career?.title || "Resident"} · ${r.career?.organization || "Living Town"}`;
    const goal = r.goals?.find(item => !item.completed) || r.goals?.[r.goals.length - 1];
    ui.goal.textContent = goal ? capitalize(goal.text) : "Finding a new direction";
    ui.goalProgress.style.width = `${Math.round(goal?.progress || 0)}%`;
    ui.summary.textContent = r.profile?.summary || `${r.name} is still writing their story.`;
    const newest = r.experiences?.[0]?.text || r.memories?.[0]?.text;
    ui.latestMemory.textContent = newest || `${r.name} is still making their first memories.`;
    ui.family.textContent = (r.profile?.family || []).map(link => {
      const person = residents.get(link.id);
      return person ? `${person.name} (${link.type})` : null;
    }).filter(Boolean).join(" · ") || "No family links recorded";
    ui.memoryCount.textContent = `${r.historyCount || 0} background events · ${r.experienceCount || 0} lived experiences`;

    const history = detail?.lifeHistory || [];
    ui.history.innerHTML = [...history].reverse().map(item => `<li><time>${escapeHtml(item.year)} · age ${escapeHtml(item.age)}</time>${escapeHtml(item.text)}</li>`).join("");
    const learned = [...(detail?.knowledge || [])].reverse().slice(0, 20);
    ui.knowledge.innerHTML = learned.length
      ? learned.map(fact => {
        const source = residents.get(fact.learnedFrom);
        return `<li>${escapeHtml(fact.text)}${source ? `<small>Learned from ${escapeHtml(source.name)}</small>` : ""}</li>`;
      }).join("")
      : `<li>${escapeHtml(r.name)} hasn't learned anything from other residents yet.</li>`;
  }

  function renderFeed() {
    ui.eventFeed.innerHTML = events.slice(0, 8).map(event => `<li><time>${formatEventTime(event.at)}</time>${escapeHtml(event.text)}</li>`).join("");
  }

  function updateClock() {
    const d = new Date(nowMs());
    ui.clock.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    ui.date.textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }

  // --- Input ---
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * MAP.width / rect.width, y: (event.clientY - rect.top) * MAP.height / rect.height };
  }

  function select(id, open = true) {
    selectedId = id;
    renderedDetailKey = "";
    renderSelected();
    if (open) ui.sheet.classList.add("open");
  }

  function handleTap(event) {
    if (!residents.size) return;
    const p = canvasPoint(event);
    const playing = mode === "play" && me;
    // While playing, only a tap right on someone selects them; anywhere else moves you.
    const radius = playing ? 18 : 34;
    const hit = [...residents.values()].reverse().find(r => r.id !== (playing ? me.residentId : null) && Math.hypot(r.drawX - p.x, r.drawY - 8 - p.y) < radius);
    if (hit) return select(hit.id);
    if (playing) {
      send({ type: "control", residentId: me.residentId, x: p.x, y: p.y });
      selectedId = me.residentId;
      renderedDetailKey = "";
      renderSelected();
    }
  }

  function setMode(next) {
    if (next === "play" && !me) { showToast("Sign in to play."); return showProfileMenu(); }
    if (next === "play" && !PLAYABLE_IDS.includes(me.residentId)) return showToast("Your player isn't linked to a resident.");
    mode = next;
    document.querySelectorAll(".dock-button[data-mode]").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    if (mode === "play") select(me.residentId, false);
    else send({ type: "release" });
  }

  document.querySelectorAll(".dock-button[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));

  const camera = { x: 0, y: 0, scale: 1 };
  const pointers = new Map();
  let gestureStartDistance = 0, gestureStartScale = 1, gestureMoved = false;
  function applyCamera() {
    camera.scale = Math.max(1, Math.min(2.4, camera.scale));
    const limitX = 240 * camera.scale, limitY = 150 * camera.scale;
    camera.x = Math.max(-limitX, Math.min(limitX, camera.x));
    camera.y = Math.max(-limitY, Math.min(limitY, camera.y));
    canvas.style.transform = `translate(calc(-50% + ${camera.x}px), ${camera.y}px) scale(${camera.scale})`;
  }
  canvas.addEventListener("pointerdown", event => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    gestureMoved = pointers.size > 1;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gestureStartDistance = Math.hypot(a.x - b.x, a.y - b.y);
      gestureStartScale = camera.scale;
    }
  });
  canvas.addEventListener("pointermove", event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) gestureMoved = true;
    if (pointers.size === 1 && gestureMoved) { camera.x += dx; camera.y += dy; applyCamera(); }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      camera.scale = gestureStartScale * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, gestureStartDistance);
      applyCamera();
    }
  });
  canvas.addEventListener("pointerup", event => {
    const had = pointers.delete(event.pointerId);
    if (had && !gestureMoved && pointers.size === 0) handleTap(event);
  });
  canvas.addEventListener("pointercancel", event => pointers.delete(event.pointerId));

  $("#findStory").addEventListener("click", () => {
    // Most interesting: whoever is talking right now, else the best mood swing.
    const now = nowMs();
    const list = [...residents.values()].filter(r => !r.asleep);
    const talking = list.find(r => r.speech && now < r.speech.until);
    const pickResident = talking || list.sort((a, b) => Math.abs(60 - (b.mood?.valence ?? 60)) - Math.abs(60 - (a.mood?.valence ?? 60)))[0];
    if (pickResident) select(pickResident.id);
  });
  $("#dismissReturn").addEventListener("click", () => ui.returnCard.classList.add("hidden"));
  $("#expandSheet").addEventListener("click", () => ui.sheet.classList.toggle("open"));
  $(".sheet-handle").addEventListener("click", () => ui.sheet.classList.toggle("open"));
  $("#peopleButton").addEventListener("click", () => ui.sheet.classList.add("open"));
  $("#storiesButton").addEventListener("click", () => { ui.sheet.classList.add("open"); $('[data-panel="eventsPanel"]').click(); });
  $("#recenterButton").addEventListener("click", () => {
    camera.x = 0; camera.y = 0; camera.scale = 1; applyCamera();
    const r = selected();
    if (r) showToast(`Map reset · watching ${r.name}`);
  });
  document.querySelectorAll(".detail-tab").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".detail-tab").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll(".detail-panel").forEach(panel => panel.classList.toggle("active", panel.id === button.dataset.panel));
  }));

  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2600);
  }

  // --- Accounts ---
  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }

  function residentName(id) { return residents.get(id)?.name || { olive: "Olive", hazel: "Hazel", dad: "Sean" }[id] || id; }

  function updatePlayerUi() {
    $("#profileInitial").textContent = me ? me.name.charAt(0).toUpperCase() : "★";
    if (!me && mode === "play") setMode("observe");
  }

  async function initializePlayers() {
    const status = await api("/api/auth/status");
    if (status.me) return applyPlayer(status.me, false);
    showPlayerGate(status);
  }

  function applyPlayer(profile, freshLogin = true) {
    me = profile;
    updatePlayerUi();
    $("#playerGate")?.remove();
    if (freshLogin) reconnect();
    setMode("play");
    showToast(`Playing as ${profile.name}`);
  }

  function gateShell(content, closable = false) {
    let gate = $("#playerGate");
    if (!gate) {
      gate = document.createElement("section");
      gate.id = "playerGate";
      gate.className = "player-gate";
      $(".app-shell").append(gate);
    }
    gate.innerHTML = `<div class="gate-card"><p class="eyebrow">ONE SHARED WORLD</p><h2>Who’s visiting town?</h2>${content}<p id="gateError" class="gate-error" role="alert"></p>${closable ? '<button id="closeGate" class="text-button">Just watch the town</button>' : ""}</div>`;
    gate.querySelector("#closeGate")?.addEventListener("click", () => gate.remove());
    return gate;
  }

  function onSubmit(gate, selector, handler) {
    gate.querySelector(selector).addEventListener("submit", async event => {
      event.preventDefault();
      try { await handler(new FormData(event.target)); } catch (error) { gate.querySelector("#gateError").textContent = error.message; }
    });
  }

  function showPlayerGate(status) {
    if (!status.initialized) {
      const gate = gateShell(`<p class="gate-copy">Set a 6-digit owner PIN for Sean. The setup code is printed in the server console on Mouse.</p><form id="setupForm"><label>Setup code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><label>Owner PIN (6 digits)<input name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" type="password" autocomplete="new-password" required></label><button class="wide-button">Start town accounts</button></form>`, true);
      onSubmit(gate, "#setupForm", async data => applyPlayer((await api("/api/auth/setup", { method: "POST", body: JSON.stringify({ code: data.get("code"), pin: data.get("pin") }) })).me));
      return;
    }
    const cards = status.profiles.map(profile => `<button class="player-card" data-profile="${escapeHtml(profile.id)}"><span>${escapeHtml(profile.name.charAt(0))}</span><b>${escapeHtml(profile.name)}</b><small>${escapeHtml(profile.role)}</small></button>`).join("");
    const gate = gateShell(`<div class="player-grid">${cards}</div>`, true);
    gate.querySelectorAll(".player-card").forEach(button => button.addEventListener("click", () => showPinEntry(status, button.dataset.profile)));
  }

  function showPinEntry(status, profileId) {
    const profile = status.profiles.find(item => item.id === profileId);
    const gate = gateShell(`<button id="backPlayers" class="back-button">‹ All players</button><div class="login-avatar">${escapeHtml(profile.name.charAt(0))}</div><h3>${escapeHtml(profile.name)}</h3><form id="loginForm"><label>PIN<input name="pin" inputmode="numeric" maxlength="6" type="password" autocomplete="current-password" required autofocus></label><button class="wide-button">Enter town</button></form>`);
    gate.querySelector("#backPlayers").addEventListener("click", () => showPlayerGate(status));
    onSubmit(gate, "#loginForm", async data => applyPlayer((await api("/api/auth/login", { method: "POST", body: JSON.stringify({ profileId, pin: data.get("pin") }) })).me));
  }

  function lookFields(look = {}) {
    const option = (value, current) => `<option${value === current ? " selected" : ""}>${value}</option>`;
    const { HAIR_STYLES, ACCESSORIES } = window.LivingTownWorld;
    return `<label>Hair<select name="hair">${HAIR_STYLES.map(v => option(v, look.hair)).join("")}</select></label><label>Accessory<select name="accessory">${ACCESSORIES.map(v => option(v, look.accessory)).join("")}</select></label><label>Shirt color<input name="shirt" type="color" value="${escapeHtml(look.shirt || "#64b5f6")}"></label>`;
  }

  function lookFrom(data) { return { hair: data.get("hair"), accessory: data.get("accessory"), shirt: data.get("shirt") }; }

  async function showProfileMenu() {
    let status;
    try { status = await api("/api/auth/status"); } catch (error) { return showToast(error.message); }
    if (!status.me) return showPlayerGate(status);
    me = status.me;
    const owner = me.role === "owner";
    const claimed = new Set(status.profiles.map(profile => profile.residentId));
    const canCreate = owner && status.playable.some(id => !claimed.has(id));
    const others = owner ? status.profiles.filter(p => p.id !== me.id).map(p => `<li><b>${escapeHtml(p.name)}</b> · ${escapeHtml(residentName(p.residentId))}<span><button class="text-button" data-reset="${escapeHtml(p.id)}">Reset PIN</button><button class="text-button danger" data-remove="${escapeHtml(p.id)}">Remove</button></span></li>`).join("") : "";
    const gate = gateShell(`<div class="login-avatar">${escapeHtml(me.name.charAt(0))}</div><h3>${escapeHtml(me.name)}</h3><p class="gate-copy">Plays as ${escapeHtml(residentName(me.residentId))}</p><button id="editLook" class="soft-button">Change my look</button>${canCreate ? '<button id="createPlayer" class="wide-button">Create another player</button>' : ""}${others ? `<ul class="player-admin">${others}</ul>` : ""}<button id="backToTown" class="soft-button">Back to town</button><button id="logoutPlayer" class="text-button">Switch player</button>`);
    gate.querySelector("#backToTown").addEventListener("click", () => gate.remove());
    gate.querySelector("#editLook").addEventListener("click", () => showLookEditor(me));
    gate.querySelector("#logoutPlayer").addEventListener("click", async () => {
      await api("/api/auth/logout", { method: "POST" }).catch(() => {});
      me = null;
      updatePlayerUi();
      reconnect();
      showPlayerGate(await api("/api/auth/status"));
    });
    gate.querySelector("#createPlayer")?.addEventListener("click", () => showCreator(status));
    gate.querySelectorAll("[data-reset]").forEach(button => button.addEventListener("click", () => showPinReset(button.dataset.reset)));
    gate.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Remove this player? Their resident keeps living in town.")) return;
      try { await api(`/api/auth/profiles/${encodeURIComponent(button.dataset.remove)}`, { method: "DELETE" }); showToast("Player removed"); showProfileMenu(); }
      catch (error) { gate.querySelector("#gateError").textContent = error.message; }
    }));
  }

  function showPinReset(profileId) {
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Profile</button><h3>Reset PIN</h3><form id="pinForm"><label>New PIN<input name="pin" inputmode="numeric" maxlength="6" type="password" autocomplete="new-password" required></label><button class="wide-button">Save PIN</button></form>`);
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    onSubmit(gate, "#pinForm", async data => {
      await api(`/api/auth/profiles/${encodeURIComponent(profileId)}/pin`, { method: "PUT", body: JSON.stringify({ pin: data.get("pin") }) });
      showToast("PIN updated");
      showProfileMenu();
    });
  }

  function showLookEditor(profile) {
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Profile</button><h3>My look</h3><form id="lookForm" class="creator-form">${lookFields(profile.look)}<button class="wide-button">Save look</button></form>`);
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    onSubmit(gate, "#lookForm", async data => {
      me = (await api(`/api/auth/profiles/${encodeURIComponent(profile.id)}/look`, { method: "PUT", body: JSON.stringify({ look: lookFrom(data) }) })).profile;
      showToast("Look saved");
      gate.remove();
    });
  }

  function showCreator(status) {
    const claimed = new Set(status.profiles.map(profile => profile.residentId));
    const options = status.playable.filter(id => !claimed.has(id)).map(id => `<option value="${id}">${escapeHtml(residentName(id))}</option>`).join("");
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Profile</button><h3>Create player</h3><form id="creatorForm" class="creator-form"><label>Player name<input name="name" maxlength="24" required></label><label>Resident<select name="residentId">${options}</select></label><label>PIN (4–6 digits)<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" type="password" autocomplete="new-password" required></label>${lookFields()}<button class="wide-button">Create player</button></form>`);
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    onSubmit(gate, "#creatorForm", async data => {
      await api("/api/auth/profiles", { method: "POST", body: JSON.stringify({ name: data.get("name"), residentId: data.get("residentId"), pin: data.get("pin"), look: lookFrom(data) }) });
      showToast("Player created");
      showProfileMenu();
    });
  }

  // beforeunload is unreliable on mobile; the server's close handler and
  // ping sweep are the real safety net. This is the fast path.
  window.addEventListener("beforeunload", () => send({ type: "release" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && mode === "play") send({ type: "release" });
  });

  function capitalize(value) { value = String(value || ""); return value.charAt(0).toUpperCase() + value.slice(1); }
  function formatEventTime(at) { return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch])); }

  $("#profileButton").addEventListener("click", showProfileMenu);
  window.addEventListener("resize", sizeCanvas);
  sizeCanvas();
  initializePlayers().catch(error => showToast(error.message));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  connect();
  requestAnimationFrame(frame);
})();
