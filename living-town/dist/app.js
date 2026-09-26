(() => {
  "use strict";

  const SAVE_KEY = "living-town-prototype-v1";
  const VERSION = 1;
  const canvas = document.querySelector("#townCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    clock: document.querySelector("#worldClock"),
    date: document.querySelector("#worldDate"),
    name: document.querySelector("#residentName"),
    activity: document.querySelector("#residentActivity"),
    portrait: document.querySelector("#residentPortrait"),
    needs: document.querySelector("#needsPanel"),
    closestFriend: document.querySelector("#closestFriend"),
    memoryCount: document.querySelector("#memoryCount"),
    latestMemory: document.querySelector("#latestMemory"),
    eventFeed: document.querySelector("#eventFeed"),
    returnCard: document.querySelector("#returnCard"),
    returnEvents: document.querySelector("#returnEvents"),
    saveStatus: document.querySelector("#saveStatus"),
    speed: document.querySelector("#speedSelect")
  };

  const places = {
    square: { name: "Town Square", x: 480, y: 320, color: "#d9caa2" },
    cafe: { name: "Moonbeam Cafe", x: 735, y: 160, color: "#d47f65" },
    park: { name: "Juniper Park", x: 215, y: 190, color: "#70a964" },
    market: { name: "Corner Market", x: 730, y: 475, color: "#d2a24c" },
    workshop: { name: "Workshop", x: 225, y: 480, color: "#688eb0" },
    homes: { name: "Maple Apartments", x: 470, y: 520, color: "#a878b5" }
  };

  const residentSeeds = [
    ["olive", "Olive", "O", "#a98cff", "curious", 430, 500],
    ["dad", "Sean", "S", "#4fc3a1", "helpful", 505, 505],
    ["milo", "Milo", "M", "#ff9966", "social", 720, 190],
    ["zara", "Zara", "Z", "#ff6f91", "creative", 205, 210],
    ["finn", "Finn", "F", "#64b5f6", "quiet", 245, 455],
    ["nova", "Nova", "N", "#ffd166", "playful", 500, 300]
  ];

  const schedules = {
    olive: [[0, "homes"], [7, "square"], [9, "park"], [12, "cafe"], [14, "workshop"], [18, "square"], [21, "homes"]],
    dad: [[0, "homes"], [6, "cafe"], [8, "workshop"], [12, "market"], [15, "workshop"], [18, "square"], [22, "homes"]],
    milo: [[0, "homes"], [8, "cafe"], [11, "square"], [14, "market"], [17, "park"], [22, "homes"]],
    zara: [[0, "homes"], [7, "park"], [10, "workshop"], [13, "cafe"], [16, "square"], [21, "homes"]],
    finn: [[0, "homes"], [7, "workshop"], [12, "park"], [15, "market"], [19, "square"], [21, "homes"]],
    nova: [[0, "homes"], [8, "square"], [10, "park"], [13, "cafe"], [16, "square"], [20, "homes"]]
  };

  let state = loadState();
  let mode = "observe";
  let selectedId = "olive";
  let simNow = new Date(state.simTime || Date.now());
  let lastFrame = performance.now();
  let lastSave = performance.now();
  let lastSocialCheck = 0;

  function freshState() {
    const relationships = {};
    residentSeeds.forEach(([id]) => {
      relationships[id] = {};
      residentSeeds.forEach(([other]) => { if (id !== other) relationships[id][other] = 15 + Math.floor(Math.random() * 16); });
    });
    return {
      version: VERSION,
      lastRealTime: Date.now(),
      simTime: Date.now(),
      eventId: 1,
      events: [{ id: 0, at: Date.now(), text: "The town opened its doors for the first time." }],
      residents: residentSeeds.map(([id, name, initial, color, trait, x, y]) => ({
        id, name, initial, color, trait, x, y, targetX: x, targetY: y,
        place: "homes", activity: "settling in", needs: { energy: 82, hunger: 78, social: 72, fun: 75 },
        memories: [], relationships: relationships[id], lastTalk: 0
      }))
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      return parsed.version === VERSION ? parsed : freshState();
    } catch { return freshState(); }
  }

  function saveState() {
    state.lastRealTime = Date.now();
    state.simTime = simNow.getTime();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    ui.saveStatus.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function addEvent(text, at = simNow.getTime()) {
    state.events.unshift({ id: state.eventId++, at, text });
    state.events = state.events.slice(0, 40);
    renderFeed();
  }

  function catchUp() {
    const elapsedMs = Math.max(0, Date.now() - Number(state.lastRealTime || Date.now()));
    const elapsedHours = Math.min(168, elapsedMs / 3_600_000);
    if (elapsedHours < 0.08) return;

    state.residents.forEach((r, index) => {
      r.needs.energy = clamp(r.needs.energy - elapsedHours * 0.8 + 8, 30, 100);
      r.needs.hunger = clamp(r.needs.hunger - elapsedHours * 1.1 + 10, 25, 100);
      r.needs.social = clamp(r.needs.social - elapsedHours * 0.55 + 6, 25, 100);
      r.needs.fun = clamp(r.needs.fun - elapsedHours * 0.45 + 5, 25, 100);
      const placeKey = scheduledPlace(r.id, new Date());
      const p = places[placeKey];
      r.x = p.x + (index % 3 - 1) * 22;
      r.y = p.y + (Math.floor(index / 3) - 0.5) * 24;
      r.targetX = r.x;
      r.targetY = r.y;
      r.place = placeKey;
    });

    const reports = [];
    const wholeHours = Math.floor(elapsedHours);
    if (wholeHours >= 1) reports.push(`${wholeHours} hour${wholeHours === 1 ? "" : "s"} passed in town.`);
    if (elapsedHours >= 4) reports.push("Residents followed their routines while you were away.");
    if (elapsedHours >= 10) {
      const a = state.residents[Math.floor(Math.random() * state.residents.length)];
      const b = state.residents.filter(r => r.id !== a.id)[Math.floor(Math.random() * (state.residents.length - 1))];
      recordConversation(a, b, true);
      reports.push(`${a.name} and ${b.name} spent some time catching up.`);
    }
    if (elapsedHours >= 24) reports.push("The town noticed it had been a while since anyone checked in.");

    if (reports.length) {
      ui.returnEvents.innerHTML = reports.map(text => `<li>${escapeHtml(text)}</li>`).join("");
      ui.returnCard.classList.remove("hidden");
    }
  }

  function scheduledPlace(id, date) {
    const hour = date.getHours() + date.getMinutes() / 60;
    let place = "homes";
    for (const [start, key] of schedules[id]) if (hour >= start) place = key;
    return place;
  }

  function updateResident(r, dtHours, elapsedRealSeconds, multiplier) {
    r.needs.hunger = clamp(r.needs.hunger - dtHours * 3.5, 0, 100);
    r.needs.energy = clamp(r.needs.energy - dtHours * 2.1, 0, 100);
    r.needs.social = clamp(r.needs.social - dtHours * 1.7, 0, 100);
    r.needs.fun = clamp(r.needs.fun - dtHours * 1.3, 0, 100);

    const controlled = mode === r.id;
    let destination = r.place;
    if (!controlled) {
      destination = scheduledPlace(r.id, simNow);
      if (r.needs.hunger < 28) destination = "cafe";
      else if (r.needs.energy < 25) destination = "homes";
      else if (r.needs.fun < 25) destination = "park";
      else if (r.needs.social < 25) destination = "square";
      if (destination !== r.place) setDestination(r, destination);
    }

    const dx = r.targetX - r.x;
    const dy = r.targetY - r.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const speed = Math.min(dist, 44 * elapsedRealSeconds * Math.max(1, Math.sqrt(multiplier)));
      r.x += dx / dist * speed;
      r.y += dy / dist * speed;
      r.activity = `walking to ${places[r.place]?.name || "somewhere"}`;
    } else {
      applyPlaceBenefit(r, dtHours);
    }
  }

  function setDestination(r, placeKey) {
    const p = places[placeKey];
    r.place = placeKey;
    r.targetX = p.x + (Math.random() - 0.5) * 78;
    r.targetY = p.y + (Math.random() - 0.5) * 64;
  }

  function applyPlaceBenefit(r, dtHours) {
    const gain = dtHours * 9;
    if (r.place === "homes") { r.needs.energy = clamp(r.needs.energy + gain * 1.8, 0, 100); r.activity = "resting at home"; }
    if (r.place === "cafe") { r.needs.hunger = clamp(r.needs.hunger + gain * 2.2, 0, 100); r.activity = "having something to eat"; }
    if (r.place === "park") { r.needs.fun = clamp(r.needs.fun + gain * 1.5, 0, 100); r.activity = "enjoying the park"; }
    if (r.place === "square") { r.needs.social = clamp(r.needs.social + gain, 0, 100); r.activity = "seeing who is around"; }
    if (r.place === "market") { r.needs.hunger = clamp(r.needs.hunger + gain * 0.7, 0, 100); r.activity = "shopping at the market"; }
    if (r.place === "workshop") { r.needs.fun = clamp(r.needs.fun + gain * 0.8, 0, 100); r.activity = "working on a small project"; }
  }

  function checkSocialEvents() {
    const now = simNow.getTime();
    for (let i = 0; i < state.residents.length; i++) {
      for (let j = i + 1; j < state.residents.length; j++) {
        const a = state.residents[i], b = state.residents[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 55 && now - a.lastTalk > 25 * 60_000 && Math.random() < 0.12) {
          recordConversation(a, b, false);
        }
      }
    }
  }

  function recordConversation(a, b, quiet) {
    const facts = [
      `${b.name} likes spending time at ${places[b.place].name}.`,
      `${b.name} tends to be ${b.trait}.`,
      `${b.name} was feeling ${lowestNeedLabel(b)} today.`
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    a.memories.unshift({ at: simNow.getTime(), about: b.id, text: fact });
    a.memories = a.memories.slice(0, 20);
    b.memories.unshift({ at: simNow.getTime(), about: a.id, text: `${a.name} stopped to talk with me.` });
    b.memories = b.memories.slice(0, 20);
    a.relationships[b.id] = clamp((a.relationships[b.id] || 0) + 2, -100, 100);
    b.relationships[a.id] = clamp((b.relationships[a.id] || 0) + 2, -100, 100);
    a.needs.social = clamp(a.needs.social + 12, 0, 100);
    b.needs.social = clamp(b.needs.social + 12, 0, 100);
    a.lastTalk = b.lastTalk = simNow.getTime();
    if (!quiet) addEvent(`${a.name} talked with ${b.name} at ${places[a.place].name}. ${a.name} learned that ${fact.charAt(0).toLowerCase()}${fact.slice(1)}`);
  }

  function lowestNeedLabel(r) {
    return Object.entries(r.needs).sort((a, b) => a[1] - b[1])[0][0];
  }

  function drawTown() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#7baa68"; ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#c9b991";
    ctx.fillRect(0, 285, w, 70);
    ctx.fillRect(445, 0, 70, h);
    ctx.fillStyle = "rgba(255,255,255,.16)";
    for (let x = 15; x < w; x += 52) ctx.fillRect(x, 318, 26, 4);
    for (let y = 15; y < h; y += 52) ctx.fillRect(478, y, 4, 26);

    drawPark();
    drawBuilding(places.cafe, 148, 100, "CAFE", "#ffd6c9");
    drawBuilding(places.market, 160, 106, "MARKET", "#fff0b0");
    drawBuilding(places.workshop, 164, 108, "WORKSHOP", "#c9e1f3");
    drawBuilding(places.homes, 220, 105, "MAPLE APARTMENTS", "#e3c9ed");
    drawSquare();
    drawTrees();

    state.residents.forEach(drawResident);
  }

  function drawBuilding(place, width, height, label, wall) {
    const x = place.x - width / 2, y = place.y - height / 2;
    ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fillRect(x + 8, y + 9, width, height);
    ctx.fillStyle = wall; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = place.color;
    ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.lineTo(place.x, y - 34); ctx.lineTo(x + width + 10, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#2d3e55"; ctx.fillRect(place.x - 13, y + height - 35, 26, 35);
    ctx.fillStyle = "#5ca7c9"; ctx.fillRect(x + 20, y + 34, 27, 24); ctx.fillRect(x + width - 47, y + 34, 27, 24);
    ctx.fillStyle = "#27384b"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(label, place.x, y + 24);
  }

  function drawPark() {
    ctx.fillStyle = "#6ea95f"; ctx.beginPath(); ctx.roundRect(85, 70, 270, 205, 38); ctx.fill();
    ctx.fillStyle = "#c8bb91"; ctx.beginPath(); ctx.roundRect(112, 158, 215, 22, 10); ctx.fill();
    ctx.fillStyle = "#e7d7a2"; ctx.beginPath(); ctx.arc(215, 170, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#73bde0"; ctx.beginPath(); ctx.arc(215, 170, 25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f3f4e8"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.fillText("JUNIPER PARK", 215, 102);
  }

  function drawSquare() {
    ctx.fillStyle = "#d8c99f"; ctx.beginPath(); ctx.roundRect(400, 250, 160, 140, 24); ctx.fill();
    ctx.fillStyle = "#88cae8"; ctx.beginPath(); ctx.arc(480, 320, 31, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f6ead0"; ctx.beginPath(); ctx.arc(480, 320, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#26394e"; ctx.font = "bold 12px system-ui"; ctx.fillText("TOWN SQUARE", 480, 375);
  }

  function drawTrees() {
    const points = [[45,50],[380,65],[585,80],[900,55],[70,410],[365,565],[600,585],[900,590],[875,270],[85,350]];
    points.forEach(([x,y]) => {
      ctx.fillStyle = "#5f7544"; ctx.fillRect(x - 5, y + 12, 10, 22);
      ctx.fillStyle = "#356a45"; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4f8b57"; ctx.beginPath(); ctx.arc(x - 8, y - 5, 14, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawResident(r) {
    const selected = r.id === selectedId;
    if (selected) { ctx.strokeStyle = "#fff4b8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.x, r.y, 21, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(r.x, r.y + 15, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(r.x, r.y, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#172033"; ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(r.initial, r.x, r.y + 1);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 11px system-ui"; ctx.textBaseline = "alphabetic"; ctx.fillText(r.name, r.x, r.y + 35);
  }

  function renderSelected() {
    const r = state.residents.find(x => x.id === selectedId);
    if (!r) return;
    ui.name.textContent = r.name;
    ui.activity.textContent = `${capitalize(r.activity)} · ${places[r.place]?.name || "Town"}`;
    ui.portrait.textContent = r.initial;
    ui.portrait.style.background = r.color;
    ui.portrait.style.color = "#172033";
    ui.needs.innerHTML = Object.entries(r.needs).map(([key, value]) => `
      <div class="need-row"><span>${capitalize(key)}</span><div class="need-track"><div class="need-fill ${value < 30 ? "low" : ""}" style="width:${Math.round(value)}%"></div></div><b>${Math.round(value)}</b></div>`).join("");
    const sorted = Object.entries(r.relationships).sort((a, b) => b[1] - a[1]);
    const friend = state.residents.find(x => x.id === sorted[0]?.[0]);
    ui.closestFriend.textContent = friend ? friend.name : "Nobody yet";
    ui.memoryCount.textContent = String(r.memories.length);
    ui.latestMemory.textContent = r.memories[0]?.text || `${r.name} is still making their first memories.`;
  }

  function renderFeed() {
    ui.eventFeed.innerHTML = state.events.slice(0, 8).map(event => `<li><time>${formatEventTime(event.at)}</time>${escapeHtml(event.text)}</li>`).join("");
  }

  function updateClock() {
    ui.clock.textContent = simNow.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    ui.date.textContent = simNow.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }

  function loop(now) {
    const elapsedRealSeconds = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    const multiplier = Number(ui.speed.value);
    simNow = new Date(simNow.getTime() + elapsedRealSeconds * 1000 * multiplier);
    const dtHours = elapsedRealSeconds * multiplier / 3600;
    state.residents.forEach(r => updateResident(r, dtHours, elapsedRealSeconds, multiplier));
    if (simNow.getTime() - lastSocialCheck > 15_000 * Math.max(1, multiplier / 60)) { checkSocialEvents(); lastSocialCheck = simNow.getTime(); }
    drawTown();
    renderSelected();
    updateClock();
    if (now - lastSave > 10_000) { saveState(); lastSave = now; }
    requestAnimationFrame(loop);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event;
    return { x: (touch.clientX - rect.left) * canvas.width / rect.width, y: (touch.clientY - rect.top) * canvas.height / rect.height };
  }

  function handleCanvas(event) {
    event.preventDefault();
    const p = canvasPoint(event);
    const hit = [...state.residents].reverse().find(r => Math.hypot(r.x - p.x, r.y - p.y) < 28);
    if (hit) { selectedId = hit.id; return; }
    if (mode === "olive" || mode === "dad") {
      const r = state.residents.find(x => x.id === mode);
      r.targetX = clamp(p.x, 20, canvas.width - 20);
      r.targetY = clamp(p.y, 20, canvas.height - 20);
      r.activity = "going where you pointed";
      selectedId = r.id;
    }
  }

  document.querySelectorAll(".mode-button").forEach(button => button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".mode-button").forEach(b => b.classList.toggle("active", b === button));
    if (mode !== "observe") selectedId = mode;
  }));

  canvas.addEventListener("pointerdown", handleCanvas);
  document.querySelector("#findStory").addEventListener("click", () => {
    const social = state.residents.slice().sort((a,b) => b.needs.social - a.needs.social)[0];
    selectedId = social.id;
    addEvent(`Observer focused on ${social.name}, who is ${social.activity}.`);
  });
  document.querySelector("#dismissReturn").addEventListener("click", () => ui.returnCard.classList.add("hidden"));
  document.querySelector("#resetTown").addEventListener("click", () => {
    if (!confirm("Reset the entire prototype town? This removes its local memories.")) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });
  window.addEventListener("beforeunload", saveState);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
  function formatEventTime(at) { return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch])); }

  catchUp();
  renderFeed();
  renderSelected();
  requestAnimationFrame(loop);
})();
