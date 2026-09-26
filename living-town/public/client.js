(() => {
  "use strict";

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
    age: document.querySelector("#residentAge"),
    mood: document.querySelector("#residentMood"),
    career: document.querySelector("#residentCareer"),
    goal: document.querySelector("#residentGoal"),
    goalProgress: document.querySelector("#goalProgress"),
    summary: document.querySelector("#profileSummary"),
    family: document.querySelector("#residentFamily"),
    history: document.querySelector("#lifeHistory"),
    knowledge: document.querySelector("#knowledgeList"),
    eventFeed: document.querySelector("#eventFeed"),
    returnCard: document.querySelector("#returnCard"),
    returnEvents: document.querySelector("#returnEvents"),
    saveStatus: document.querySelector("#saveStatus"),
    connectionStatus: document.querySelector("#connectionStatus")
  };

  const places = {
    square: { name: "Town Square", x: 480, y: 320, color: "#d9caa2" },
    cafe: { name: "Moonbeam Cafe", x: 735, y: 160, color: "#d47f65" },
    park: { name: "Juniper Park", x: 215, y: 190, color: "#70a964" },
    market: { name: "Corner Market", x: 730, y: 475, color: "#d2a24c" },
    workshop: { name: "Workshop", x: 225, y: 480, color: "#688eb0" },
    homes: { name: "Maple Apartments", x: 470, y: 520, color: "#a878b5" }
  };

  // Lightweight, code-drawn character art keeps the town fast on phones while
  // giving every resident a recognizable body, face, hair and outfit.
  const characterLooks = {
    olive: { skin: "#f2c7a5", hair: "#6b3f2a", shirt: "#a98cff", pants: "#3f4d79", shoes: "#f7d56b", style: "pigtails", accessory: "bow" },
    hazel: { skin: "#f2c7a5", hair: "#8b572f", shirt: "#f28482", pants: "#3f6f74", shoes: "#ffe08a", style: "buns", accessory: "headband" },
    dad:   { skin: "#d8a47f", hair: "#3e2a22", shirt: "#4fc3a1", pants: "#31455e", shoes: "#c58b55", style: "bald", accessory: "beard" },
    milo:  { skin: "#8d5524", hair: "#24160f", shirt: "#ff9966", pants: "#315b70", shoes: "#f1eee4", style: "curls" },
    zara:  { skin: "#c68642", hair: "#201713", shirt: "#ff6f91", pants: "#633d78", shoes: "#272038", style: "long", accessory: "star" },
    finn:  { skin: "#f1c6a8", hair: "#b55b36", shirt: "#64b5f6", pants: "#38506d", shoes: "#df694f", style: "swoop" },
    nova:  { skin: "#6f4125", hair: "#17100d", shirt: "#ffd166", pants: "#4d5584", shoes: "#f08a5d", style: "buns", accessory: "headband" }
  };

  let world = null; // latest state from server
  let simNowMs = Date.now();
  let mode = "observe";
  let selectedId = "olive";
  let shownReturnFor = null;
  let socket;
  const townMap = new Image();
  townMap.src = "assets/town-map.png";
  const residentDetails = new Map();
  const pendingInspections = new Set();

  function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${proto}://${location.host}/ws`);
    socket.addEventListener("open", () => { ui.connectionStatus.textContent = "Live · shared world"; });
    socket.addEventListener("close", () => { ui.connectionStatus.textContent = "Disconnected — retrying…"; setTimeout(connect, 1500); });
    socket.addEventListener("error", () => socket.close());
    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "state") {
        world = msg.state;
        world.residents = world.residents.map(resident => mergeResidentDetail(resident));
        simNowMs = msg.simNow;
        maybeShowReturnCard();
        renderFeed();
        renderSelected();
      }
      if (msg.type === "resident-detail") {
        residentDetails.set(msg.resident.id, msg.resident);
        pendingInspections.delete(msg.resident.id);
        if (world) {
          const index = world.residents.findIndex(resident => resident.id === msg.resident.id);
          if (index >= 0) world.residents[index] = mergeResidentDetail(world.residents[index]);
        }
        if (selectedId === msg.resident.id) renderSelected();
      }
    });
  }

  function maybeShowReturnCard() {
    const latest = world.events[0];
    if (latest && latest.text.startsWith("The server was offline") && shownReturnFor !== latest.id) {
      shownReturnFor = latest.id;
      ui.returnEvents.innerHTML = `<li>${escapeHtml(latest.text)}</li>`;
      ui.returnCard.classList.remove("hidden");
    }
  }

  function send(payload) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  function mergeResidentDetail(summary) {
    const detail = residentDetails.get(summary.id);
    if (!detail) return summary;
    return { ...detail, ...summary, lifeHistory: detail.lifeHistory, knowledge: detail.knowledge };
  }

  function requestInspection(resident) {
    const detail = residentDetails.get(resident.id);
    if (detail?.lifeRevision === resident.lifeRevision || pendingInspections.has(resident.id)) return;
    pendingInspections.add(resident.id);
    send({ type: "inspect", residentId: resident.id });
  }

  function drawTown() {
    if (!world) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (townMap.complete && townMap.naturalWidth) {
      ctx.drawImage(townMap, 0, 0, w, h);
      ctx.fillStyle = "rgba(16,31,49,.035)";
      ctx.fillRect(0, 0, w, h);
      [...world.residents].sort((a, b) => a.y - b.y).forEach(drawResident);
      return;
    }
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

    [...world.residents].sort((a, b) => a.y - b.y).forEach(drawResident);
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
    const look = characterLooks[r.id] || { skin: "#d8a47f", hair: "#38251d", shirt: r.color, pants: "#3f4d5e", shoes: "#eee", style: "short" };
    const selected = r.id === selectedId;
    const walking = Math.hypot(r.targetX - r.x, r.targetY - r.y) > 3;
    const phase = (simNowMs / 130) + r.id.charCodeAt(0);
    const bob = walking ? Math.abs(Math.sin(phase)) * 2 : Math.sin(phase * 0.12) * 0.5;
    const stride = walking ? Math.sin(phase) * 4 : 0;

    ctx.save();
    ctx.translate(r.x, r.y - bob);

    if (selected) {
      ctx.strokeStyle = "#fff4b8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -9, 24, 34, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow, legs, shoes and arms.
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.beginPath(); ctx.ellipse(0, 17 + bob, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = look.pants; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(-5 - stride * 0.45, 14); ctx.moveTo(4, 5); ctx.lineTo(5 + stride * 0.45, 14); ctx.stroke();
    ctx.strokeStyle = look.shoes; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-7 - stride * 0.45, 15); ctx.lineTo(-2 - stride * 0.45, 15); ctx.moveTo(3 + stride * 0.45, 15); ctx.lineTo(8 + stride * 0.45, 15); ctx.stroke();
    ctx.strokeStyle = look.skin; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-13 + stride * 0.35, 4); ctx.moveTo(10, -5); ctx.lineTo(13 - stride * 0.35, 4); ctx.stroke();

    // Torso.
    ctx.fillStyle = look.shirt;
    ctx.beginPath(); ctx.roundRect(-11, -10, 22, 19, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.beginPath(); ctx.roundRect(-7, -7, 5, 12, 3); ctx.fill();

    // Head and ears.
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.arc(-11, -21, 3, 0, Math.PI * 2); ctx.arc(11, -21, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -22, 12, 0, Math.PI * 2); ctx.fill();
    drawHair(look);

    // Face.
    ctx.fillStyle = "#2a2020";
    ctx.beginPath(); ctx.arc(-4, -22, 1.4, 0, Math.PI * 2); ctx.arc(4, -22, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8b4f48"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -18, 3.4, 0.15, Math.PI - 0.15); ctx.stroke();
    drawAccessory(look);
    ctx.restore();

    ctx.fillStyle = "rgba(18,28,43,.82)";
    ctx.beginPath(); ctx.roundRect(r.x - 25, r.y + 21, 50, 16, 8); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(r.name, r.x, r.y + 29);

    const freshConversation = r.memories?.find(memory => memory.type === "conversation" && simNowMs - memory.at < 180000);
    if (freshConversation) drawChatBubble(r, freshConversation.text);
  }

  function drawChatBubble(r, text) {
    const words = String(text).replace(/^.*? told me:\s*/i, "").split(/\s+/).slice(0, 9).join(" ");
    const label = words.length > 52 ? `${words.slice(0, 49)}…` : words;
    ctx.save();
    ctx.font = "700 12px system-ui";
    const width = Math.min(190, Math.max(78, ctx.measureText(label).width + 24));
    const x = Math.max(8, Math.min(canvas.width - width - 8, r.x - width / 2));
    const y = Math.max(8, r.y - 88);
    ctx.fillStyle = "rgba(255,255,248,.96)";
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(x, y, width, 34, 14); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(r.x - 6, y + 32); ctx.lineTo(r.x + 5, y + 32); ctx.lineTo(r.x, y + 43); ctx.closePath(); ctx.fill();
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
    const look = characterLooks[r.id] || characterLooks.dad;
    const glasses = look.accessory === "glasses" ? '<g fill="none" stroke="#314052" stroke-width="2"><rect x="20" y="31" width="12" height="9" rx="3"/><rect x="36" y="31" width="12" height="9" rx="3"/><path d="M32 35h4"/></g>' : "";
    const hair = look.style === "bald" ? '<path d="M18 29q1-20 16-20t16 20" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>' : `<path d="M18 27c1-14 8-21 17-21 10 0 16 8 16 21-8-5-23-5-33 0Z" fill="${look.hair}"/>`;
    const beard = look.accessory === "beard" ? `<path d="M20 34q2 18 14 20 12-2 14-20-6 9-14 9t-14-9Z" fill="${look.hair}"/><ellipse cx="34" cy="39" rx="5" ry="3" fill="${look.skin}"/>` : "";
    return `<svg viewBox="0 0 68 68" aria-hidden="true"><ellipse cx="34" cy="64" rx="18" ry="4" fill="rgba(0,0,0,.2)"/><path d="M19 68V53c0-10 7-16 15-16s15 6 15 16v15" fill="${look.shirt}"/><circle cx="34" cy="28" r="17" fill="${look.skin}"/>${hair}${beard}<circle cx="28" cy="31" r="2" fill="#2a2020"/><circle cx="40" cy="31" r="2" fill="#2a2020"/><path d="M29 39q5 5 10 0" fill="none" stroke="#8b4f48" stroke-width="2" stroke-linecap="round"/>${glasses}</svg>`;
  }

  function renderSelected() {
    if (!world) return;
    const r = world.residents.find(x => x.id === selectedId);
    if (!r) return;
    requestInspection(r);
    ui.name.textContent = r.name;
    ui.activity.textContent = `${capitalize(r.activity)} · ${places[r.place]?.name || "Town"}`;
    ui.portrait.innerHTML = portraitSvg(r);
    ui.portrait.style.background = `linear-gradient(145deg, ${r.color}55, #263d5c)`;
    ui.needs.innerHTML = Object.entries(r.needs).map(([key, value]) => `
      <div class="need-row"><span>${capitalize(key)}</span><div class="need-track"><div class="need-fill ${value < 30 ? "low" : ""}" style="width:${Math.round(value)}%"></div></div><b>${Math.round(value)}</b></div>`).join("");
    const sorted = Object.entries(r.relationships).sort((a, b) => b[1] - a[1]);
    const friend = world.residents.find(x => x.id === sorted[0]?.[0]);
    ui.closestFriend.textContent = friend ? friend.name : "Nobody yet";
    ui.age.textContent = String(r.profile?.age ?? "—");
    ui.mood.textContent = capitalize(r.mood?.label || "content");
    ui.career.textContent = `${r.career?.title || "Resident"} · ${r.career?.organization || "Living Town"}`;
    const goal = r.goals?.find(item => !item.completed) || r.goals?.[0];
    ui.goal.textContent = goal ? capitalize(goal.text) : "Finding a new direction";
    ui.goalProgress.style.width = `${Math.round(goal?.progress || 0)}%`;
    ui.summary.textContent = r.profile?.summary || `${r.name} is still writing their story.`;
    ui.memoryCount.textContent = String((r.lifeHistory?.length || 0) + (r.experiences?.length || 0));
    const newest = r.experiences?.[0]?.text || r.memories?.[0]?.text;
    ui.latestMemory.textContent = newest || `${r.name} is still making their first memories.`;
    ui.family.textContent = (r.profile?.family || []).map(link => {
      const person = world.residents.find(other => other.id === link.id);
      return person ? `${person.name} (${link.type})` : null;
    }).filter(Boolean).join(" · ") || "No family links recorded";
    ui.history.innerHTML = [...(r.lifeHistory || [])].reverse().map(item => `<li><time>${item.year}${item.age === null ? " · family history" : ` · age ${item.age}`}</time>${escapeHtml(item.text)}</li>`).join("");
    const learned = [...(r.knowledge || [])].reverse().filter(fact => fact.learnedFrom !== "self").slice(0, 16);
    const facts = learned.length ? learned : [...(r.knowledge || [])].reverse().slice(0, 10);
    ui.knowledge.innerHTML = facts.map(fact => {
      const source = world.residents.find(other => other.id === fact.learnedFrom);
      return `<li>${escapeHtml(fact.text)}${source ? `<small>Learned from ${escapeHtml(source.name)}</small>` : ""}</li>`;
    }).join("");
  }

  function renderFeed() {
    if (!world) return;
    ui.eventFeed.innerHTML = world.events.slice(0, 8).map(event => `<li><time>${formatEventTime(event.at)}</time>${escapeHtml(event.text)}</li>`).join("");
  }

  function updateClock() {
    const d = new Date(simNowMs);
    ui.clock.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    ui.date.textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }

  function frame() {
    simNowMs += 16; // smooth the clock display between server ticks
    drawTown();
    updateClock();
    requestAnimationFrame(frame);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event;
    return { x: (touch.clientX - rect.left) * canvas.width / rect.width, y: (touch.clientY - rect.top) * canvas.height / rect.height };
  }

  function handleCanvas(event) {
    event.preventDefault();
    if (!world) return;
    const p = canvasPoint(event);
    const hit = [...world.residents].reverse().find(r => Math.hypot(r.x - p.x, r.y - p.y) < 34);
    if (hit) { selectedId = hit.id; renderSelected(); document.querySelector("#residentSheet").classList.add("open"); return; }
    if (mode === "olive" || mode === "hazel" || mode === "dad") {
      send({ type: "control", residentId: mode, x: p.x, y: p.y });
      selectedId = mode;
    }
  }

  document.querySelectorAll(".dock-button[data-mode]").forEach(button => button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".dock-button").forEach(b => b.classList.toggle("active", b === button));
    if (mode !== "observe") selectedId = mode; else send({ type: "release" });
    renderSelected();
  }));

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
    canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY }); gestureMoved = false;
    if (pointers.size === 2) { const [a,b] = [...pointers.values()]; gestureStartDistance = Math.hypot(a.x-b.x,a.y-b.y); gestureStartScale = camera.scale; }
  });
  canvas.addEventListener("pointermove", event => {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer.x = event.clientX; pointer.y = event.clientY;
    if (Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY) > 7) gestureMoved = true;
    if (pointers.size === 1 && gestureMoved) { camera.x += dx; camera.y += dy; applyCamera(); }
    if (pointers.size === 2) { const [a,b] = [...pointers.values()]; camera.scale = gestureStartScale * Math.hypot(a.x-b.x,a.y-b.y) / Math.max(1,gestureStartDistance); gestureMoved = true; applyCamera(); }
  });
  canvas.addEventListener("pointerup", event => { const pointer = pointers.get(event.pointerId); pointers.delete(event.pointerId); if (pointer && !gestureMoved) handleCanvas(event); });
  canvas.addEventListener("pointercancel", event => pointers.delete(event.pointerId));
  document.querySelector("#findStory").addEventListener("click", () => {
    if (!world) return;
    const social = world.residents.slice().sort((a, b) => b.needs.social - a.needs.social)[0];
    selectedId = social.id;
    renderSelected();
  });
  document.querySelector("#dismissReturn").addEventListener("click", () => ui.returnCard.classList.add("hidden"));
  document.querySelector("#expandSheet").addEventListener("click", () => document.querySelector("#residentSheet").classList.toggle("open"));
  document.querySelector(".sheet-handle").addEventListener("click", () => document.querySelector("#residentSheet").classList.toggle("open"));
  document.querySelector("#peopleButton").addEventListener("click", () => document.querySelector("#residentSheet").classList.add("open"));
  document.querySelector("#storiesButton").addEventListener("click", () => {
    document.querySelector("#residentSheet").classList.add("open");
    document.querySelector('[data-panel="eventsPanel"]').click();
  });
  document.querySelector("#recenterButton").addEventListener("click", () => {
    const resident = world?.residents.find(item => item.id === selectedId);
    camera.x = 0; camera.y = 0; camera.scale = 1; applyCamera();
    if (resident) showToast(`Map reset · watching ${resident.name}`);
  });
  document.querySelectorAll(".detail-tab").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".detail-tab").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll(".detail-panel").forEach(panel => panel.classList.toggle("active", panel.id === button.dataset.panel));
  }));

  let toastTimer;
  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message; toast.classList.remove("hidden");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  }

  async function initializePlayers() {
    const status = await api("/api/auth/status");
    if (status.me) return applyPlayer(status.me);
    showPlayerGate(status);
  }

  function applyPlayer(profile) {
    window.currentPlayer = profile; mode = profile.residentId; selectedId = profile.residentId;
    document.querySelector("#profileInitial").textContent = profile.name.charAt(0).toUpperCase();
    document.querySelector("#playButton").dataset.mode = profile.residentId;
    document.querySelector("#playerGate")?.remove();
    showToast(`Playing as ${profile.name}`);
  }

  function gateShell(content) {
    let gate = document.querySelector("#playerGate");
    if (!gate) { gate = document.createElement("section"); gate.id = "playerGate"; gate.className = "player-gate"; document.querySelector(".app-shell").append(gate); }
    gate.innerHTML = `<div class="gate-card"><p class="eyebrow">ONE SHARED WORLD</p><h2>Who’s visiting town?</h2>${content}<p id="gateError" class="gate-error"></p></div>`;
    return gate;
  }

  function showPlayerGate(status) {
    if (!status.initialized) {
      const gate = gateShell(`<p class="gate-copy">Set the owner PIN for Sean. You’ll add Olive and Hazel next.</p><form id="setupForm"><label>Owner PIN<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" type="password" required></label><button class="wide-button">Start town accounts</button></form>`);
      gate.querySelector("#setupForm").addEventListener("submit", async event => { event.preventDefault(); try { applyPlayer((await api("/api/auth/setup", { method: "POST", body: JSON.stringify({ pin: new FormData(event.target).get("pin") }) })).me); } catch (error) { gate.querySelector("#gateError").textContent = error.message; } });
      return;
    }
    const cards = status.profiles.map(profile => `<button class="player-card" data-profile="${escapeHtml(profile.id)}"><span>${escapeHtml(profile.name.charAt(0))}</span><b>${escapeHtml(profile.name)}</b><small>${escapeHtml(profile.role)}</small></button>`).join("");
    const gate = gateShell(`<div class="player-grid">${cards}</div>`);
    gate.querySelectorAll(".player-card").forEach(button => button.addEventListener("click", () => showPinEntry(status, button.dataset.profile)));
  }

  function showPinEntry(status, profileId) {
    const profile = status.profiles.find(item => item.id === profileId);
    const gate = gateShell(`<button id="backPlayers" class="back-button">‹ All players</button><div class="login-avatar">${escapeHtml(profile.name.charAt(0))}</div><h3>${escapeHtml(profile.name)}</h3><form id="loginForm"><label>PIN<input name="pin" inputmode="numeric" maxlength="6" type="password" required autofocus></label><button class="wide-button">Enter town</button></form>`);
    gate.querySelector("#backPlayers").addEventListener("click", () => showPlayerGate(status));
    gate.querySelector("#loginForm").addEventListener("submit", async event => { event.preventDefault(); try { applyPlayer((await api("/api/auth/login", { method: "POST", body: JSON.stringify({ profileId, pin: new FormData(event.target).get("pin") }) })).me); } catch (error) { gate.querySelector("#gateError").textContent = error.message; } });
  }

  async function showProfileMenu() {
    const status = await api("/api/auth/status"); if (!status.me) return showPlayerGate(status);
    const canCreate = status.me.role === "owner" && status.profiles.length < 3;
    const gate = gateShell(`<div class="login-avatar">${escapeHtml(status.me.name.charAt(0))}</div><h3>${escapeHtml(status.me.name)}</h3><p class="gate-copy">Linked to ${escapeHtml(status.me.residentId)}</p>${canCreate ? '<button id="createPlayer" class="wide-button">Create another player</button>' : ""}<button id="closeGate" class="soft-button">Back to town</button><button id="logoutPlayer" class="text-button">Switch player</button>`);
    gate.querySelector("#closeGate").addEventListener("click", () => gate.remove());
    gate.querySelector("#logoutPlayer").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); window.currentPlayer = null; showPlayerGate(await api("/api/auth/status")); });
    gate.querySelector("#createPlayer")?.addEventListener("click", () => showCreator(status));
  }

  function showCreator(status) {
    const claimed = new Set(status.profiles.map(profile => profile.residentId));
    const options = [{ id: "olive", name: "Olive" }, { id: "hazel", name: "Hazel" }, { id: "dad", name: "Sean" }].filter(item => !claimed.has(item.id)).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Profile</button><h3>Create player</h3><form id="creatorForm" class="creator-form"><label>Player name<input name="name" maxlength="24" required></label><label>Resident<select name="residentId">${options}</select></label><label>PIN<input name="pin" inputmode="numeric" maxlength="6" type="password" required></label><label>Hair<select name="hair"><option>short</option><option>long</option><option>pigtails</option><option>buns</option><option>curls</option><option>swoop</option><option>bald</option></select></label><label>Accessory<select name="accessory"><option>none</option><option>bow</option><option>headband</option><option>star</option><option>glasses</option><option>beard</option></select></label><label>Shirt color<input name="shirt" type="color" value="#64b5f6"></label><button class="wide-button">Create player</button></form>`);
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    gate.querySelector("#creatorForm").addEventListener("submit", async event => { event.preventDefault(); const data = new FormData(event.target); try { await api("/api/auth/profiles", { method: "POST", body: JSON.stringify({ name: data.get("name"), residentId: data.get("residentId"), pin: data.get("pin"), look: { hair: data.get("hair"), accessory: data.get("accessory"), shirt: data.get("shirt") } }) }); showToast("Player created"); showProfileMenu(); } catch (error) { gate.querySelector("#gateError").textContent = error.message; } });
  }

  // beforeunload doesn't reliably fire on mobile (locking the screen,
  // swiping the app away, losing signal) — the server's close-event
  // handler and WebSocket health checks are the real safety net for those cases.
  // This is just the fast path for an ordinary desktop tab close.
  window.addEventListener("beforeunload", () => send({ type: "release" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && (mode === "olive" || mode === "hazel" || mode === "dad")) {
      send({ type: "release" });
    }
  });

  function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
  function formatEventTime(at) { return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch])); }

  document.querySelector("#profileButton").onclick = showProfileMenu;
  initializePlayers().catch(error => showToast(error.message));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  connect();
  requestAnimationFrame(frame);
})();
