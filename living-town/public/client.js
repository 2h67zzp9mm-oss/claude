(() => {
  "use strict";

  const { places, MAP, buildings, homeBuildings, homeOf, walkNodes, snapToWalkable, route, setHomeAssignments, destinations, SKIN_TONES, HAIR_STYLES, ACCESSORIES } = window.LivingTownWorld;
  const $ = selector => document.querySelector(selector);
  // The read-only window for visiting family (see lib/viewer.js).
  const VISITOR = document.documentElement.dataset.viewer === "1";
  // The town may be served under a sub-path (e.g. /little-town/), so server paths are page-relative.
  const BASE = location.pathname.replace(/[^/]*$/, "");
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
  const NEW_LOOK = { skin: "#e0ac86", hair: "#5a3825", style: "short", shirt: "#64b5f6", pants: "#3f4d79", shoes: "#f1eee4", accessory: "none" };
  // Anything customized in the app is stored on the resident and wins.
  function lookFor(r) {
    const base = baseLooks[r.id] || { ...NEW_LOOK, shirt: r.color || NEW_LOOK.shirt };
    return { accessory: "none", ...base, ...(r.look || {}) };
  }

  let town = { mre: null, weather: "clear" };
  let mreBrain = "";

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
  const destinationMaps = new Map((destinations || []).map(destination => { const image = new Image(); image.src = destination.map; return [destination.id, image]; }));
  function activeDestinationId() { return me?.residentId ? residents.get(me.residentId)?.destinationId || "little-town" : "little-town"; }

  function nowMs() { return serverNow + (performance.now() - serverNowAt); }
  function selected() { return residents.get(selectedId); }

  function mergeResident(data) {
    const existing = residents.get(data.id);
    if (existing) Object.assign(existing, data);
    else residents.set(data.id, { ...data, drawX: data.x, drawY: data.y });
    return residents.get(data.id);
  }

  // --- Networking ---
  // Visitor mode is the read-only window for family off the tailnet: the
  // socket lives under the page's secret path, and nothing is ever sent.
  function connect() {
    clearTimeout(reconnectTimer);
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const path = VISITOR ? `${location.pathname.replace(/\/?$/, "/")}ws` : `${BASE}ws`;
    const ws = new WebSocket(`${proto}://${location.host}${path}`);
    socket = ws;
    ws.addEventListener("open", () => { reconnectDelay = 1000; ui.connectionStatus.textContent = VISITOR ? "Live · visiting" : "Live · shared world"; });
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

  // Your own character starts walking on your phone the moment you tap,
  // along the same route and at the same pace the town server uses, instead of
  // waiting for the next update and chasing it.
  const PLAYER_SPEED = 48;
  let predict = null;
  function startPredict(payload) {
    const r = residents.get(payload.residentId);
    if (!r || typeof route !== "function") return;
    predict = { id: r.id, path: route(r.drawX, r.drawY, payload.x, payload.y), tx: payload.x, ty: payload.y, at: performance.now(), doneAt: 0 };
  }
  function stepPredict(dt) {
    if (!predict) return false;
    const r = residents.get(predict.id);
    if (!r || mode !== "play") { predict = null; return false; }
    const t = performance.now();
    // The server went somewhere else (rejected, went indoors, a new target): let it lead.
    if (t - predict.at > 1500 && Math.hypot((r.targetX ?? predict.tx) - predict.tx, (r.targetY ?? predict.ty) - predict.ty) > 12) { predict = null; return false; }
    let budget = PLAYER_SPEED * dt;
    while (budget > 0 && predict.path.length) {
      const n = predict.path[0], gap = Math.hypot(n.x - r.drawX, n.y - r.drawY);
      if (gap <= budget) { r.drawX = n.x; r.drawY = n.y; budget -= gap; predict.path.shift(); }
      else { r.drawX += (n.x - r.drawX) / gap * budget; r.drawY += (n.y - r.drawY) / gap * budget; budget = 0; }
    }
    if (!predict.path.length) {
      if (!predict.doneAt) predict.doneAt = t;
      // Wait here until the server catches up, then hand back.
      if (Math.hypot(r.x - predict.tx, r.y - predict.ty) < 6 || t - predict.doneAt > 3000) predict = null;
    }
    return true;
  }

  function send(payload) {
    if (VISITOR) return;
    if (payload?.type === "control" && me && payload.residentId === me.residentId) startPredict(payload);
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  function setClock(now) { serverNow = now; serverNowAt = performance.now(); }

  function handleMessage(msg) {
    if (msg.type === "hello") {
      if (!msg.me && me) { me = null; updatePlayerUi(); }
    } else if (msg.type === "state") {
      setClock(msg.now);
      if (Array.isArray(msg.social)) socialActions = msg.social;
      setHomeAssignments(msg.homes || {});
      town = msg.town || town;
      mreBrain = msg.mreBrain || mreBrain;
      residents.clear();
      msg.state.residents.forEach(mergeResident);
      events = msg.state.events;
      renderedDetailKey = "";
      maybeShowReturnCard();
      renderFeed();
      renderSelected();
    } else if (msg.type === "tick") {
      setClock(msg.now);
      // The programme only comes when it changes, so keep the last one.
      if (msg.town) { town = { ...msg.town, programme: msg.town.programme || town.programme }; if (msg.town.brain) mreBrain = msg.town.brain; }
      msg.changed.forEach(mergeResident);
      msg.residents.forEach(mergeResident);
      if (msg.events.length) {
        events = [...msg.events.reverse(), ...events].slice(0, 50);
        maybeShowReturnCard();
        renderFeed();
      }
      renderSelected();
    } else if (msg.type === "play-result") {
      showPlayResult(msg);
    } else if (msg.type === "reward") {
      celebrate(msg);
    } else if (msg.type === "social-result") {
      showSocialResult(msg);
    } else if (msg.type === "resident-detail") {
      const r = msg.resident;
      details.set(r.id, { revision: r.lifeRevision, lifeHistory: r.lifeHistory, knowledge: r.knowledge, experiences: r.experiences, memories: r.memories });
      pendingInspections.delete(r.id);
      if (r.id === selectedId) { renderedDetailKey = ""; renderSelected(); }
    } else if (msg.type === "control-rejected") {
      showToast(msg.reason);
    } else if (msg.type === "travel-result") {
      if (msg.error) showToast(msg.error);
      else { $("#travelCard").classList.add("hidden"); const d = (destinations || []).find(x => x.id === msg.destinationId); showToast(!msg.destinationId || msg.destinationId === "little-town" ? "Welcome home to Cooke’s Corner!" : `Welcome to ${d?.name || "a new town"}!`); }
    } else if (msg.type === "toast") { if (typeof msg.text === "string") showToast(msg.text);
    } else if (msg.type === "home-state") { window.LivingTownHome?.onState(msg);
    } else if (msg.type === "tron-chat") { if (msg.error) showToast(msg.error); else renderTron(msg.history || []); const ti = document.querySelector("#tronForm input"); if (ti) ti.disabled = false; }
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

  const LOOK_LABELS = { bunny: "bunny ears", yarn: "yarn hair", jester: "jester hat", rook: "castle crown", king: "king's crown", ribbons: "streamers", robot: "robot head", overalls: "overalls", stitches: "rag-doll stitches", ruff: "jester ruff", partyMask: "party mask", comedyMask: "smiling mask", robe: "royal robe" };

  // --- Pixel-art sprites ---
  // Residents are drawn as small pixel sprites (one sprite pixel = PX map
  // units) with a dark outline, so they sit naturally in the painted town.
  const SPRITE_W = 16, SPRITE_H = 24, PX = 1.35, FEET_ROW = 22, OUTLINE = "#2a1d18";
  const spriteCache = new Map();

  function shade(hex, amount) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    const f = c => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function buildSprite(look, frame) {
    const c = document.createElement("canvas");
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    const g = c.getContext("2d");
    const px = (x, y, color, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    const { skin, hair: H, shirt, pants, shoes, style, accessory: acc } = look;

    const legSets = [
      [{ x: 6, bottom: 20 }, { x: 8, bottom: 20 }],
      [{ x: 5, bottom: 20 }, { x: 9, bottom: 19 }],
      [{ x: 5, bottom: 19 }, { x: 9, bottom: 20 }]
    ];
    legSets[frame].forEach((leg, i) => {
      px(leg.x, 17, i ? shade(pants, -0.08) : pants, 2, leg.bottom - 16);
      px(leg.x, leg.bottom + 1, shoes, 2, 1);
    });
    px(5, 11, shirt, 6, 6);
    px(10, 11, shade(shirt, -0.12), 1, 6);
    px(6, 12, shade(shirt, 0.12), 1, 3);
    const swing = frame === 1 ? [1, 0] : frame === 2 ? [0, 1] : [0, 0];
    [[4, swing[0]], [11, swing[1]]].forEach(([x, d]) => {
      px(x, 11 + d, shade(shirt, -0.05), 1, 2);
      px(x, 13 + d, skin, 1, 2);
    });
    px(7, 10, shade(skin, -0.08), 2, 1);
    px(5, 4, skin, 6, 6);
    px(4, 6, skin, 1, 2);
    px(11, 6, skin, 1, 2);

    if (style === "bald" || style === "robot") px(6, 3, skin, 4, 1);
    else px(5, 3, H, 6, 2);
    if (["short", "pigtails", "buns", "long"].includes(style)) { px(5, 5, H); px(10, 5, H); }
    if (style === "long") { px(4, 4, H, 1, 8); px(11, 4, H, 1, 8); }
    if (style === "pigtails") { px(3, 6, H, 1, 3); px(12, 6, H, 1, 3); }
    if (style === "buns") { px(5, 1, H, 2, 2); px(9, 1, H, 2, 2); }
    if (style === "curls") { px(4, 2, H, 8, 3); px(4, 5, H, 1, 2); px(11, 5, H, 1, 2); [5, 7, 9].forEach(x => px(x, 1, H, 2, 1)); }
    if (style === "swoop") { px(5, 5, H, 3, 1); px(4, 3, H, 1, 2); px(9, 2, H, 2, 1); }
    // Big Top styles.
    if (style === "bunny") { px(5, 0, H, 2, 4); px(9, 0, H, 2, 4); px(6, 1, "#f7b2c4", 1, 3); px(9, 1, "#f7b2c4", 1, 3); }
    if (style === "yarn") { px(4, 2, H, 8, 3); [5, 7, 9].forEach(x => px(x, 1, H)); px(4, 5, H, 1, 5); px(11, 5, H, 1, 5); px(3, 7, H, 1, 4); px(12, 7, H, 1, 4); px(3, 7, "#e63946"); px(12, 7, "#e63946"); }
    if (style === "jester") { px(4, 3, H, 4, 2); px(8, 3, pants, 4, 2); px(3, 1, H, 2, 2); px(2, 0, "#ffd166"); px(11, 1, pants, 2, 2); px(13, 0, "#ffd166"); }
    if (style === "king") { px(5, 2, H, 6, 2); px(5, 1, H); px(10, 1, H); px(7, 0, H, 1, 2); px(6, 1, H, 3, 1); px(6, 3, "#e63946"); px(9, 3, "#4a90d9"); }
    if (style === "rook") { px(4, 1, H, 8, 3); g.clearRect(6, 1, 1, 1); g.clearRect(9, 1, 1, 1); px(4, 3, shade(H, -0.14), 8, 1); }
    if (style === "ribbons") { px(4, 4, H, 1, 9); px(11, 4, shade(H, -0.1), 1, 8); px(3, 7, shade(H, 0.12), 1, 7); px(12, 6, H, 1, 7); px(2, 12, H, 1, 3); px(13, 11, shade(H, 0.12), 1, 3); }
    if (style === "robot") { px(5, 3, shade(skin, -0.15), 6, 1); px(7, 1, "#555a60", 1, 2); px(7, 0, H, 1, 1); px(4, 6, shade(skin, -0.2), 1, 2); px(11, 6, shade(skin, -0.2), 1, 2); }

    px(6, 6, OUTLINE);
    px(9, 6, OUTLINE);
    px(7, 8, "#b0645a", 2, 1);
    if (style === "robot") { px(6, 6, "#6fd6ff"); px(9, 6, "#6fd6ff"); px(6, 8, "#555a60", 4, 1); }
    if (style === "bunny") px(7, 9, "#ffffff", 2, 1);
    // Big wide jester eyes.
    if (style === "jester") { px(6, 5, "#ffffff"); px(9, 5, "#ffffff"); px(6, 6, "#1c2a4a"); px(9, 6, "#1c2a4a"); }
    if (acc === "beard") { px(5, 7, H, 1, 4); px(10, 7, H, 1, 4); px(6, 9, H, 4, 2); px(6, 8, H); px(9, 8, H); }
    if (acc === "glasses") { px(5, 5, "#3a3a4a", 3, 1); px(8, 5, "#3a3a4a", 3, 1); ["#cfe3f0"].forEach(c2 => { px(5, 6, c2); px(7, 6, c2); px(8, 6, c2); px(10, 6, c2); }); }
    if (acc === "bow") { px(10, 2, "#f7d56b", 3, 2); px(11, 2, "#d9a93a", 1, 2); }
    if (acc === "headband") px(5, 4, "#e76f8a", 6, 1);
    if (acc === "star") { px(11, 2, "#ffd166"); px(10, 3, "#ffd166", 3, 1); px(11, 4, "#ffd166"); }
    if (acc === "overalls") { px(6, 11, pants, 4, 4); px(5, 11, pants, 1, 3); px(10, 11, pants, 1, 3); px(6, 12, "#ffd166"); px(9, 12, "#ffd166"); }
    // Rag doll: one button eye, a stitched smile and rosy cheeks.
    if (acc === "stitches") { px(7, 8, skin, 2, 1); px(6, 8, "#8a3b3b"); px(9, 8, "#8a3b3b"); px(7, 9, "#8a3b3b", 2, 1); px(5, 7, "#f28482"); px(10, 7, "#f28482"); px(5, 5, "#1c2a4a", 2, 2); px(5, 5, "#6f93bf"); px(9, 6, "#3a2a20"); }
    if (acc === "ruff") { px(4, 10, "#ffd166", 8, 1); for (let i = 4; i < 12; i += 2) px(i, 11, "#ffd166"); }
    if (acc === "comedyMask") { px(5, 4, "#f4f1ea", 6, 6); px(5, 6, OUTLINE); px(6, 5, OUTLINE); px(9, 5, OUTLINE); px(10, 6, OUTLINE); px(6, 8, OUTLINE); px(7, 9, OUTLINE, 2, 1); px(9, 8, OUTLINE); px(5, 8, "#ff8fab"); px(10, 8, "#ff8fab"); }
    if (acc === "robe") { px(3, 10, "#6c3483", 1, 9); px(12, 10, "#6c3483", 1, 9); px(4, 10, "#f4f1ea", 8, 1); [5, 8, 10].forEach(x => px(x, 10, OUTLINE)); }
    if (acc === "partyMask") { px(5, 5, "#ffd166", 6, 2); px(6, 6, OUTLINE); px(9, 6, OUTLINE); px(4, 4, "#ffd166"); px(11, 4, "#ffd166"); px(8, 5, "#fff6c2"); }

    const data = g.getImageData(0, 0, SPRITE_W, SPRITE_H).data;
    const filled = (x, y) => x >= 0 && y >= 0 && x < SPRITE_W && y < SPRITE_H && data[(y * SPRITE_W + x) * 4 + 3] > 0;
    g.fillStyle = OUTLINE;
    for (let y = 0; y < SPRITE_H; y++) {
      for (let x = 0; x < SPRITE_W; x++) {
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function spriteFor(r, frame) {
    const look = lookFor(r);
    const key = `${frame}|${JSON.stringify(look)}`;
    if (!spriteCache.has(key)) spriteCache.set(key, buildSprite(look, frame));
    return spriteCache.get(key);
  }

  // --- Camera ---
  // The canvas is always the full map (960x640 CSS px) moved and scaled with
  // a transform. Zoom ranges from "whole town fits" to close-up.
  const view = $(".world-card");
  const camera = { x: 0, y: 0, z: 1, userMovedAt: 0 };
  let backing = 0;
  let backingTimer = null;
  let signBoxes = [];
  let tapMarker = null;

  function limits() {
    const w = view.clientWidth, h = view.clientHeight;
    const fit = Math.min(w / MAP.width, h / MAP.height);
    const cover = Math.max(w / MAP.width, h / MAP.height);
    return { w, h, fit, cover, min: fit, max: cover * 2.5 };
  }

  // Default: the map fills the height between the top bar and the bottom
  // sheet (no empty bands); pinch out to see the whole town.
  function defaultZoom() { const l = limits(); return Math.max(l.fit, Math.min(l.cover, (l.h - 200) / MAP.height)); }

  function sizeBacking() {
    const next = Math.min(2, Math.max(1, Math.ceil((window.devicePixelRatio || 1) * camera.z * 4) / 4));
    if (next === backing) return;
    backing = next;
    canvas.width = MAP.width * backing;
    canvas.height = MAP.height * backing;
  }

  function applyCamera() {
    const l = limits();
    const before = camera.z;
    camera.z = Math.max(l.min, Math.min(l.max, camera.z));
    const mw = MAP.width * camera.z, mh = MAP.height * camera.z;
    // Leave room to scroll the edges out from under the top bar and bottom sheet.
    const top = 70, bottom = 150;
    camera.x = mw <= l.w ? (l.w - mw) / 2 : Math.max(l.w - mw, Math.min(0, camera.x));
    camera.y = mh + top + bottom <= l.h ? (l.h - mh) / 2 : Math.max(l.h - mh - bottom, Math.min(top, camera.y));
    canvas.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`;
    if (before !== camera.z || !backing) { clearTimeout(backingTimer); backingTimer = setTimeout(sizeBacking, 150); }
  }

  function zoomAt(z, cx, cy) {
    const l = limits();
    z = Math.max(l.min, Math.min(l.max, z));
    const k = z / camera.z;
    camera.x = cx - (cx - camera.x) * k;
    camera.y = cy - (cy - camera.y) * k;
    camera.z = z;
    applyCamera();
  }

  function centerOn(x, y, z = camera.z) {
    const l = limits();
    camera.z = Math.max(l.min, Math.min(l.max, z));
    camera.x = l.w / 2 - x * camera.z;
    camera.y = l.h * 0.4 - y * camera.z;
    applyCamera();
  }

  // Keep the player's resident comfortably on screen unless the user just panned.
  function followPlayer(dt) {
    if (mode !== "play" || !me || performance.now() - camera.userMovedAt < 4000) return;
    const r = residents.get(me.residentId);
    if (!r) return;
    const l = limits();
    const sx = camera.x + r.drawX * camera.z, sy = camera.y + r.drawY * camera.z;
    if (sx > l.w * 0.2 && sx < l.w * 0.8 && sy > l.h * 0.2 && sy < l.h * 0.6) return;
    const k = Math.min(1, dt * 2.5);
    camera.x += (l.w / 2 - r.drawX * camera.z - camera.x) * k;
    camera.y += (l.h * 0.4 - r.drawY * camera.z - camera.y) * k;
    applyCamera();
  }

  // --- Drawing ---
  let lastFrame = performance.now();
  function frame(time) {
    const dt = Math.min(0.1, (time - lastFrame) / 1000);
    lastFrame = time;
    const predicting = stepPredict(dt) ? predict?.id : null;
    for (const r of residents.values()) {
      if (r.id === predicting) continue;
      // Glide at a steady walking pace between updates rather than lunging
      // and then slowing down every second.
      const gap = Math.hypot(r.x - r.drawX, r.y - r.drawY);
      if (gap > 120) { r.drawX = r.x; r.drawY = r.y; continue; }
      if (gap < 0.05) continue;
      const step = Math.min(gap, Math.max(gap * dt * 1.5, 52 * dt));
      r.drawX += (r.x - r.drawX) / gap * step;
      r.drawY += (r.y - r.drawY) / gap * step;
    }
    followPlayer(dt);
    moveMrE(dt);
    followMyDoor();
    followSocial();
    followPlay();
    if (time - lastBanner > 500) { lastBanner = time; updateBanner(); updateTownName(); }
    try {
      if (interior.id) drawInterior(dt);
      else if (backing) drawTown(dt);
    } catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } }
    updateClock();
    requestAnimationFrame(frame);
  }

  // Sizes given in screen pixels, converted to map units at the current zoom.
  function screenPx(px) { return px / camera.z; }

  function hiddenInside(r) { return isInside(r); }

  // The living map (scenery.js): time of day, lamplight, water, smoke, animals.
  const scenery = window.LivingTownScenery.create({ MAP });

  function drawTown(dt = 0) {
    ctx.setTransform(backing, 0, 0, backing, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, MAP.width, MAP.height);
    const activeMap = destinationMaps.get(activeDestinationId()) || townMap;
    if (activeMap.complete && activeMap.naturalWidth) ctx.drawImage(activeMap, 0, 0, MAP.width, MAP.height);
    else { ctx.fillStyle = "#7baa68"; ctx.fillRect(0, 0, MAP.width, MAP.height); }
    drawTents();
    // Who's up and about indoors, per building, for lit windows and chimney smoke.
    const awake = new Map();
    for (const r of residents.values()) {
      const b = !r.asleep && buildingOf(r);
      if (b) awake.set(b.id, (awake.get(b.id) || 0) + 1);
    }
    const localResidents = [...residents.values()].filter(r => r.destinationId === activeDestinationId());
    const people = localResidents.map(r => ({ name: r.name, x: r.drawX, y: r.drawY, activity: r.activity, visible: !hiddenInside(r) }));
    const sky = scenery.update(dt, nowMs(), { residents: people, awakeInside: id => awake.has(id) });
    scenery.drawBelow(ctx, sky);

    if (tapMarker) {
      const age = (performance.now() - tapMarker.at) / 700;
      if (age >= 1) tapMarker = null;
      else {
        ctx.strokeStyle = `rgba(255,224,102,${1 - age})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(tapMarker.x, tapMarker.y, 4 + age * 10, (4 + age * 10) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    drawFindables();
    const mineNow = myResident();
    favourMarks.ask = new Set((mineNow?.questOffers || []).map(q => q.requesterId));
    favourMarks.give = new Set((mineNow?.quests || []).filter(q => q.kind === "find" && q.found).map(q => q.requesterId));
    const visible = localResidents.filter(r => !hiddenInside(r)).sort((a, b) => a.drawY - b.drawY);
    visible.forEach(drawResident);
    drawBursts();
    scenery.drawLighting(ctx, sky, { lit: id => awake.has(id) });
    drawSigns();
    const now = nowMs();
    // Lower (nearer) people's bubbles first; others make room above them.
    const bubbles = [];
    [...visible].reverse().forEach(r => { if (r.speech && now >= r.speech.from && now < r.speech.until) drawChatBubble(r, r.speech.text, false, bubbles); });
    drawWeather();
    drawMrE(now);
    drawTron();
    scenery.drawAbove(ctx, sky);
  }

  // The Big Top: a striped circus tent drawn onto the painted map, one
  // pixel per map unit so it matches the residents.
  const tentSprites = new Map();
  function tentSprite(t) {
    if (tentSprites.has(t)) return tentSprites.get(t);
    const c = document.createElement("canvas");
    c.width = t.w; c.height = t.h;
    const g = c.getContext("2d");
    const px = (x, y, color, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    const W = t.w, H = t.h, cx = Math.floor(W / 2), eave = Math.round(H * 0.48), top = 9;
    for (let y = eave; y < H; y++) {
      const half = Math.round(W * 0.36 + (y - eave) / (H - eave) * W * 0.11);
      for (let x = -half; x < half; x++) px(cx + x, y, Math.floor((x + half) / 5) % 2 ? "#f4f1ea" : "#d64545");
      px(cx - half - 1, y, OUTLINE); px(cx + half, y, OUTLINE);
    }
    for (let y = top; y < eave; y++) {
      const half = Math.max(1, Math.round((y - top) / (eave - top) * W * 0.46));
      for (let x = -half; x < half; x++) px(cx + x, y, Math.floor((x / half + 1) * 4) % 2 ? "#6c3483" : "#f2c14e");
      px(cx - half - 1, y, OUTLINE); px(cx + half, y, OUTLINE);
    }
    const trim = Math.round(W * 0.46);
    for (let x = -trim; x < trim; x++) {
      px(cx + x, eave, "#f2c14e");
      if ((x + trim) % 6 < 4) px(cx + x, eave + 1, "#f2c14e");
      if ((x + trim) % 6 === 1 || (x + trim) % 6 === 2) px(cx + x, eave + 2, "#e0a458");
    }
    px(cx, 0, "#5b4636", 1, top + 1);
    px(cx + 1, 0, "#e63946", 6, 2); px(cx + 1, 2, "#e63946", 4, 1); px(cx + 1, 3, "#e63946", 2, 1);
    for (let y = H - 16; y < H; y++) {
      const half = Math.round((y - (H - 16)) / 16 * 7) + 1;
      px(cx - half, y, "#2a1d18", half * 2, 1);
      px(cx - half - 1, y, "#f2c14e"); px(cx + half, y, "#f2c14e");
    }
    tentSprites.set(t, c);
    return c;
  }

  function drawTents() {
    for (const b of buildings) {
      if (!b.tent) continue;
      const t = b.tent;
      ctx.fillStyle = "rgba(20,12,8,.3)";
      ctx.beginPath(); ctx.ellipse(t.x, t.y, t.w * 0.52, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tentSprite(t), t.x - t.w / 2, t.y - t.h);
      ctx.imageSmoothingEnabled = true;
    }
  }

  function drawResident(r) {
    const x = r.drawX, y = r.drawY;
    const walking = Math.hypot(r.targetX - r.x, r.targetY - r.y) > 3;
    const step = Math.floor(performance.now() / 170 + r.id.charCodeAt(0)) % 4;
    const frameIndex = walking ? [1, 0, 2, 0][step] : 0;

    ctx.fillStyle = "rgba(20,12,8,.3)";
    ctx.beginPath(); ctx.ellipse(x, y, 7, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    if (r.id === selectedId) {
      ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spriteFor(r, frameIndex), x - (SPRITE_W * PX) / 2, y - FEET_ROW * PX, SPRITE_W * PX, SPRITE_H * PX);
    ctx.imageSmoothingEnabled = true;

    if (r.id === selectedId) {
      const ay = y - FEET_ROW * PX - 3 + Math.sin(performance.now() / 250) * 1.5;
      ctx.fillStyle = "#ffe066";
      ctx.beginPath(); ctx.moveTo(x - 3.5, ay - 5); ctx.lineTo(x + 3.5, ay - 5); ctx.lineTo(x, ay); ctx.closePath(); ctx.fill();
    }

    // Names for the selected resident, or for everyone once zoomed in.
    // A quick reaction: pops up, floats a little, fades (💧 rain, ❗ an event, 👋 a friend...).
    const emote = r.emote && nowMs() < r.emote.until ? r.emote : null;
    if (emote) {
      const left = (r.emote.until - nowMs()) / 3500;
      const pop = Math.min(1, (1 - left) * 6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, left * 3);
      ctx.font = `${screenPx(14) * (0.6 + pop * 0.4)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,.85)";
      const ey = y - FEET_ROW * PX - screenPx(12) - (1 - left) * 4;
      ctx.beginPath(); ctx.arc(x + screenPx(10), ey, screenPx(9), 0, Math.PI * 2); ctx.fill();
      ctx.fillText(emote.emoji, x + screenPx(10), ey + 0.5);
      ctx.restore();
    }
    // A favour to ask you (❗), or their lost thing found (🎁).
    const mark = favourMarks.give.has(r.id) ? "🎁" : favourMarks.ask.has(r.id) ? "❗" : null;
    if (mark) {
      const my = y - FEET_ROW * PX - 7 + Math.sin(performance.now() / 300) * 1.5;
      ctx.font = `${screenPx(15)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(mark, x, my - (r.id === selectedId ? 6 : 0));
    }
    if (r.id !== selectedId && camera.z < 1.1) return;
    const fs = screenPx(10);
    ctx.font = `700 ${fs}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(r.name).width + fs;
    ctx.fillStyle = "rgba(18,28,43,.78)";
    ctx.beginPath(); ctx.roundRect(x - w / 2, y + 2, w, fs * 1.4, fs * 0.7); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(r.name, x, y + 2 + fs * 0.72);
  }

  // --- Mr. E and weather ---
  const MRE_LOOK = { skin: "#2b2140", hair: "#4b2d7a", shirt: "#4b2d7a", pants: "#35205c", shoes: "#1c1330", style: "long", accessory: "none" };
  let mreSpriteCanvas = null;
  function mreSprite() {
    if (mreSpriteCanvas) return mreSpriteCanvas;
    const c = buildSprite(MRE_LOOK, 0);
    const g = c.getContext("2d");
    g.fillStyle = "#4b2d7a";
    g.fillRect(5, 2, 6, 1); g.fillRect(6, 1, 4, 1); // hood
    g.fillRect(4, 16, 8, 5); // long cloak
    g.fillStyle = "#ffd166"; // glowing question-mark face
    [[7, 5], [8, 5], [9, 6], [8, 7], [8, 9]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    g.fillStyle = "#2b2140";
    g.fillRect(6, 6, 1, 1);
    mreSpriteCanvas = c;
    return c;
  }

  // Mr. E is always somewhere in town, strolling and watching. The server
  // owns his position; phones glide him smoothly between ticks.
  let mreHitBox = null;
  const mreDraw = { x: 0, y: 0, placed: false };
  function tappedMrE(p) {
    if (!mreHitBox || !town.mre) return false;
    return [mreHitBox.body, mreHitBox.bubble].some(b => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1);
  }

  function mreSpeaking(now) { return Boolean(town.mre?.text) && now < town.mre.until; }

  function mreTapText(now) {
    if (mreSpeaking(now)) return `✦ Mr. E: "${town.mre.text}"`;
    if (isNightHour()) return `✦ Mr. E is walking his lantern round ${town.mre.watching || "the town"} while everyone sleeps…`;
    return town.mre.walking ? "✦ Mr. E is strolling through town, keeping an eye on things…" : `✦ Mr. E is quietly watching ${town.mre.watching || "the town"}…`;
  }

  function isNightHour() {
    const hour = new Date(nowMs()).getHours();
    return hour < 7 || hour >= 21;
  }

  function moveMrE(dt) {
    if (!town.mre) return;
    if (!mreDraw.placed || Math.hypot(town.mre.x - mreDraw.x, town.mre.y - mreDraw.y) > 150) {
      Object.assign(mreDraw, { x: town.mre.x, y: town.mre.y, placed: true });
      return;
    }
    const k = Math.min(1, dt * 4);
    mreDraw.x += (town.mre.x - mreDraw.x) * k;
    mreDraw.y += (town.mre.y - mreDraw.y) * k;
  }

  function drawMrE(now) {
    if (!town.mre || !mreDraw.placed) { mreHitBox = null; return; }
    const { x, y } = mreDraw;
    const t = performance.now() / 1000;
    const speaking = mreSpeaking(now);
    const night = isNightHour();
    ctx.save();
    if (night) {
      const glow = ctx.createRadialGradient(x + 7, y - 14, 1, x + 7, y - 14, 34);
      glow.addColorStop(0, "rgba(255,214,120,.45)");
      glow.addColorStop(1, "rgba(255,214,120,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x + 7, y - 14, 34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(180,140,255,.25)";
    ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Sparkles: a lively swirl while he's announcing, a faint shimmer otherwise.
    const sparkles = speaking ? 5 : 2;
    for (let i = 0; i < sparkles; i++) {
      const a = t * (speaking ? 1.5 : 0.8) + i * 1.26 * (speaking ? 1 : 2.5);
      ctx.globalAlpha = speaking ? 1 : 0.55;
      ctx.fillStyle = i % 2 ? "#ffd166" : "#d6c3ff";
      ctx.fillRect(x + Math.cos(a) * 14, y - 18 + Math.sin(a * 1.3) * 12, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    const bob = Math.sin(t * 2) * (town.mre.walking ? 0.8 : 1.5);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mreSprite(), x - (SPRITE_W * PX) / 2, y - FEET_ROW * PX + bob, SPRITE_W * PX, SPRITE_H * PX);
    ctx.imageSmoothingEnabled = true;
    if (night) {
      // A small lantern in his hand.
      ctx.fillStyle = "#3b2a18"; ctx.fillRect(x + 6, y - 16 + bob, 3, 1);
      ctx.fillStyle = "#ffd166"; ctx.fillRect(x + 6, y - 15 + bob, 3, 4);
    }
    const fs = screenPx(10);
    ctx.font = `800 ${fs}px system-ui`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = "✦ Mr. E";
    const w = ctx.measureText(label).width + fs;
    ctx.fillStyle = "rgba(60,30,110,.85)";
    ctx.beginPath(); ctx.roundRect(x - w / 2, y + 2, w, fs * 1.4, fs * 0.7); ctx.fill();
    ctx.fillStyle = "#ffe9b8";
    ctx.fillText(label, x, y + 2 + fs * 0.72);
    ctx.restore();
    const bubble = speaking ? drawChatBubble({ drawX: x, drawY: y + bob }, town.mre.text, true) : null;
    // Tap target: his body (generously sized for fingers while he's
    // announcing) plus his speech bubble.
    const reach = screenPx(speaking ? 22 : 12) + (speaking ? 0 : 4);
    mreHitBox = { body: { x0: x - reach, y0: y - FEET_ROW * PX - 4, x1: x + reach, y1: y + screenPx(speaking ? 18 : 14) }, bubble };
  }

  // Glint: Sean's glowing caretaker program. He lives in town, watches how it's
  // running, and you can tap him to ask what's going on.
  const TRON_LOOK = { skin: "#0b1a24", hair: "#0b1a24", shirt: "#0e2230", pants: "#0b1a24", shoes: "#08131b", style: "short", accessory: "none" };
  let tronCanvas = null, tronHit = null;
  const tronDraw = { x: 0, y: 0, placed: false };
  function tronSprite() {
    if (tronCanvas) return tronCanvas;
    const c = buildSprite(TRON_LOOK, 0), g = c.getContext("2d");
    g.fillStyle = "#5ef2ff";
    g.fillRect(6, 6, 4, 1);                          // visor
    g.fillRect(7, 10, 2, 6); g.fillRect(5, 12, 6, 1); // chest circuit
    g.fillRect(5, 17, 1, 4); g.fillRect(10, 17, 1, 4); // leg lines
    tronCanvas = c;
    return c;
  }
  function drawTron() {
    const T = town.tron;
    if (!T) { tronHit = null; return; }
    if (!tronDraw.placed || Math.hypot(T.x - tronDraw.x, T.y - tronDraw.y) > 150) Object.assign(tronDraw, { x: T.x, y: T.y, placed: true });
    tronDraw.x += (T.x - tronDraw.x) * 0.08; tronDraw.y += (T.y - tronDraw.y) * 0.08;
    const { x, y } = tronDraw, t = performance.now() / 1000;
    ctx.save();
    const glow = ctx.createRadialGradient(x, y - 10, 1, x, y - 10, 22);
    glow.addColorStop(0, `rgba(94,242,255,${0.28 + Math.sin(t * 3) * 0.08})`); glow.addColorStop(1, "rgba(94,242,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 10, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(94,242,255,.6)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tronSprite(), x - (SPRITE_W * PX) / 2, y - FEET_ROW * PX, SPRITE_W * PX, SPRITE_H * PX);
    ctx.imageSmoothingEnabled = true;
    const fs = screenPx(10);
    ctx.font = `800 ${fs}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = T.notes ? `◈ Glint · ${T.notes}` : "◈ Glint";
    const w = ctx.measureText(label).width + fs;
    ctx.fillStyle = "rgba(8,30,44,.88)"; ctx.beginPath(); ctx.roundRect(x - w / 2, y + 2, w, fs * 1.4, fs * 0.7); ctx.fill();
    ctx.strokeStyle = "#5ef2ff"; ctx.lineWidth = screenPx(1); ctx.stroke();
    ctx.fillStyle = "#bff9ff"; ctx.fillText(label, x, y + 2 + fs * 0.72);
    ctx.restore();
    const reach = screenPx(18);
    tronHit = { x0: x - reach, y0: y - FEET_ROW * PX - 6, x1: x + reach, y1: y + screenPx(20) };
  }
  function tappedTron(p) { return tronHit && p.x >= tronHit.x0 && p.x <= tronHit.x1 && p.y >= tronHit.y0 && p.y <= tronHit.y1; }

  function drawWeather() {
    if (town.weather === "rain") {
      ctx.fillStyle = "rgba(30,50,85,.18)";
      ctx.fillRect(0, 0, MAP.width, MAP.height);
      ctx.strokeStyle = "rgba(200,220,255,.5)";
      ctx.lineWidth = 1;
      const t = performance.now() / 1000;
      ctx.beginPath();
      for (let i = 0; i < 160; i++) {
        const x = ((i * 73) % MAP.width + t * 40) % MAP.width;
        const y = ((i * 151) % MAP.height + t * 380) % MAP.height;
        ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 8);
      }
      ctx.stroke();
    } else if (town.weather === "sunny") {
      ctx.fillStyle = "rgba(255,214,120,.07)";
      ctx.fillRect(0, 0, MAP.width, MAP.height);
    }
  }

  function drawSigns() {
    signBoxes = [];
    const fs = screenPx(9.5);
    ctx.font = `800 ${fs}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const b of buildings) {
      const home = planFor(b.id) ? occupantsOf(b) : [];
      const label = home.length ? `${b.name} · ${home.length}${home.some(r => r.asleep) ? " z" : ""}` : b.name;
      const w = ctx.measureText(label).width + fs * 1.3, h = fs * 1.7;
      const x0 = b.x - w / 2, y0 = b.y - h / 2;
      ctx.fillStyle = "rgba(59,38,22,.9)";
      ctx.strokeStyle = "#e8c27a";
      ctx.lineWidth = fs * 0.14;
      ctx.beginPath(); ctx.roundRect(x0, y0, w, h, fs * 0.35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffe9b8";
      ctx.fillText(label, b.x, b.y + fs * 0.06);
      signBoxes.push({ b, x0, y0, x1: x0 + w, y1: y0 + h });
    }
  }

  /** Wrap text into lines no wider than `maxWidth` (using the current font). */
  function wrapText(g, text, maxWidth) {
    const lines = [];
    let line = "";
    for (const word of String(text).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  // The whole sentence, never chopped: long lines get a slightly smaller font
  // before anything is cut. `taken` lists bubbles already drawn this frame;
  // a bubble that would cover one moves up above it instead.
  function drawChatBubble(r, text, magic = false, taken = null) {
    let fs = screenPx(11.5);
    ctx.save();
    const maxWidth = screenPx(220);
    let lines;
    for (let step = 0; step < 3; step++) {
      ctx.font = `700 ${fs}px system-ui`;
      lines = wrapText(ctx, text, maxWidth);
      if (lines.length <= 4) break;
      fs *= 0.88;
    }
    if (lines.length > 6) { lines.length = 6; lines[5] = `${lines[5].replace(/\s*\S*$/, "")}…`; }
    const width = Math.max(...lines.map(l => ctx.measureText(l).width)) + fs * 1.8;
    const lineH = fs * 1.25;
    const height = lines.length * lineH + fs * 1.1;
    const headY = r.drawY - FEET_ROW * PX;
    const x = Math.max(4, Math.min(MAP.width - width - 4, r.drawX - width / 2));
    let y = headY - height - fs * 0.9;
    const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (let tries = 0; taken && tries < 6; tries++) {
      const blocker = taken.find(b => overlaps({ x0: x, y0: y, x1: x + width, y1: y + height }, b));
      if (!blocker) break;
      y = blocker.y0 - height - fs * 0.5;
    }
    y = Math.max(4, y);
    ctx.fillStyle = magic ? "rgba(245,236,255,.97)" : "rgba(255,255,248,.96)";
    ctx.shadowColor = magic ? "rgba(120,80,220,.55)" : "rgba(0,0,0,.25)";
    ctx.shadowBlur = magic ? 14 : 8;
    ctx.beginPath(); ctx.roundRect(x, y, width, height, fs * 0.9); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(r.drawX - fs * 0.4, y + height - 1); ctx.lineTo(r.drawX + fs * 0.4, y + height - 1); ctx.lineTo(r.drawX, y + height + fs * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = magic ? "#3b1f73" : "#1a2940"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, x + width / 2, y + fs * 0.55 + lineH * (i + 0.5)));
    ctx.restore();
    const rect = { x0: x, y0: y, x1: x + width, y1: y + height + fs * 0.6 };
    if (taken) taken.push(rect);
    return rect;
  }

  // --- Resident sheet ---
  function renderSelected() {
    const r = selected();
    if (!r) return;
    requestInspection(r);
    const detail = details.get(r.id);
    const lookKey = JSON.stringify(r.look || null);
    const key = `${r.id}:${r.lifeRevision}:${detail?.revision}:${lookKey}`;
    if (key !== renderedDetailKey) { renderedDetailKey = key; renderSelectedDetail(r, detail); }
    renderSelectedDynamic(r);
  }

  // Cheap per-tick updates only; no list rebuilding.
  function renderSelectedDynamic(r) {
    const placeLabel = r.place === "homes" ? homeOf(r.id)?.name || "Home" : places[r.place]?.name || "Out and about";
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
    $("#editResident").classList.toggle("hidden", !(me && (me.role === "owner" || me.residentId === r.id)));
    const portrait = new Image();
    portrait.className = "pixel-portrait";
    portrait.alt = "";
    portrait.src = spriteFor(r, 0).toDataURL();
    ui.portrait.replaceChildren(portrait);
    ui.portrait.style.background = `linear-gradient(145deg, ${r.color}55, #263d5c)`;
    ui.needs.innerHTML = Object.keys(r.needs || {}).map(key => `<div class="need-row" data-need="${key}"><span>${capitalize(key)}</span><div class="need-track"><div class="need-fill"></div></div><b>0</b></div>`).join("");
    const sorted = Object.entries(r.relationships || {}).sort((a, b) => b[1] - a[1]);
    ui.closestFriend.textContent = residents.get(sorted[0]?.[0])?.name || "Nobody yet";
    ui.age.textContent = String(r.profile?.age ?? "—");
    ui.career.textContent = `${r.career?.title || "Resident"} · ${r.career?.organization || "Cooke’s Corner"}`;
    const goal = r.goals?.find(item => !item.completed) || r.goals?.[r.goals.length - 1];
    ui.goal.textContent = goal ? capitalize(goal.text) : "Finding a new direction";
    ui.goalProgress.style.width = `${Math.round(goal?.progress || 0)}%`;
    ui.summary.textContent = r.profile?.summary || `${r.name} is still writing their story.`;
    // Their own wishes, and how they feel and why.
    const chips = (list, empty) => (list?.length ? list : [{ emoji: "", text: empty }]).map(item => `<li>${item.emoji ? `<b>${escapeHtml(item.emoji)}</b> ` : ""}${escapeHtml(item.text)}</li>`).join("");
    const thinking = $("#residentThinking");
    thinking.classList.toggle("hidden", VISITOR || !r.cognition);
    if (r.cognition && !VISITOR) {
      const thought = r.cognition;
      thinking.innerHTML = `<strong>Planning ahead</strong><ol>${thought.plan.map(text => `<li>${escapeHtml(text)}</li>`).join("") || "<li>Taking care of the moment.</li>"}</ol>${thought.reflection ? `<p>${escapeHtml(thought.reflection)}</p>` : ""}<small>${thought.completed} plans completed · ${thought.memoryCount} recent learning moments · ${escapeHtml(thought.source)}</small>`;
    }
    $("#residentWishes").innerHTML = chips(r.wishes, "Thinking about what to do next");
    $("#residentFeelings").innerHTML = chips(r.feelings, "Just fine");
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
    ui.eventFeed.innerHTML = events.slice(0, 8).map(event => `<li${event.by === "mre" ? ' class="mre-event"' : ""}><time>${formatEventTime(event.at)}</time>${escapeHtml(event.text)}</li>`).join("");
  }

  function updateClock() {
    const d = new Date(nowMs());
    ui.clock.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    ui.date.textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }

  // --- House interiors ---
  // Each home has a floor plan (shared/interiors.js) drawn in pixel art
  // (rooms.js). Residents who are home walk between rooms: to the kitchen to
  // eat, to their own bed to sleep. Players walk in through their own front
  // door and can use almost anything in the house.
  const { planFor, placeHousehold, routeInside, frontDoorRect, furniture, locate } = window.LivingTownInteriors;
  const Rooms = window.LivingTownRooms;
  // `floor` is the storey being viewed; two-storey homes switch with the stairs.
  const interior = { id: null, floor: 0, base: null, baseKey: "", lighting: null, lightKey: "", placed: [], walkers: new Map(), fresh: false, closing: false, myFloor: null };
  const floorButton = $("#floorToggle");
  const interiorEl = $("#interior");
  const roomCanvas = $("#roomCanvas");
  const roomCtx = roomCanvas.getContext("2d");
  const RS = 3; // backing pixels per plan pixel
  const INDOOR_SPEED = 34; // plan pixels per second

  // Where someone is: inside exactly one building, or out on the map
  // (shared/interiors.js decides, so nobody is ever in two places).
  function buildingOf(r) { return locate(r, window.LivingTownWorld); }
  function isInside(r) { return Boolean(buildingOf(r)); }

  function householdOrder(b) {
    const order = r => { const i = (b.residents || []).indexOf(r.id); return i < 0 ? 100 : i; };
    return (a, c) => order(a) - order(c) || a.id.localeCompare(c.id);
  }

  function occupantsOf(b) {
    return [...residents.values()].filter(r => isInside(r) && buildingOf(r)?.id === b.id).sort(householdOrder(b));
  }

  // Everyone who lives here, home or not, so beds don't swap around.
  function householdOf(b) {
    if (!b.residents) return [];
    return [...residents.values()].filter(r => homeOf(r.id)?.id === b.id).sort(householdOrder(b)).map(r => r.id);
  }

  function lightNow() {
    const hour = new Date(nowMs()).getHours();
    return hour < 7 || hour >= 20 ? "night" : hour >= 18 ? "evening" : "day";
  }

  function canActInside(b) {
    const mine = me && residents.get(me.residentId);
    return mode === "play" && mine && buildingOf(mine)?.id === b.id && isInside(mine);
  }

  // Players can walk into any building: their own home, public buildings, and
  // other people's homes as a visitor (the Big Top, a friend's house).
  function canEnter(b) { return Boolean(me) && Boolean(planFor(b.id)); }

  function drawSleeper(r, bed, slot) {
    const look = lookFor(r);
    const x = bed.double ? bed.x - 1 + (slot ? bed.w / 2 : 0) : bed.x;
    const y = bed.y + 1;
    roomCtx.drawImage(spriteFor(r, 0), x, y);
    // Closed eyes, then the blanket pulled up.
    roomCtx.fillStyle = shade(look.skin, -0.25);
    roomCtx.fillRect(x + 6, y + 6, 1, 1); roomCtx.fillRect(x + 9, y + 6, 1, 1);
    roomCtx.fillStyle = look.skin;
    roomCtx.fillRect(x + 6, y + 5, 1, 1); roomCtx.fillRect(x + 9, y + 5, 1, 1);
    Rooms.drawBlanket(roomCtx, bed);
  }

  function walkIndoors(w, dt) {
    let budget = INDOOR_SPEED * dt;
    while (budget > 0 && w.path.length) {
      const next = w.path[0];
      // Arriving on another floor: step off the stairs there.
      if ((next.floor || 0) !== w.floor) { w.floor = next.floor || 0; w.x = next.x; w.y = next.y; w.path.shift(); continue; }
      const gap = Math.hypot(next.x - w.x, next.y - w.y);
      if (gap <= budget) { w.x = next.x; w.y = next.y; budget -= gap; w.path.shift(); }
      else { w.x += (next.x - w.x) / gap * budget; w.y += (next.y - w.y) / gap * budget; budget = 0; }
    }
  }

  function drawInterior(dt) {
    const b = buildings.find(x => x.id === interior.id);
    const building = b && planFor(b.id);
    if (!building) return closeInterior(true);
    if (!building.floors[interior.floor]) interior.floor = 0;
    const plan = building.floors[interior.floor];
    const light = lightNow();
    const key = `${b.id}|${interior.floor}|${light}`;
    if (interior.baseKey !== key) { interior.base = Rooms.drawRoom(plan, light); interior.baseKey = key; }
    const people = occupantsOf(b);
    const lampsOn = people.some(r => !r.asleep);
    if (interior.lightKey !== `${key}|${lampsOn}`) { interior.lighting = Rooms.drawLighting(plan, light, lampsOn); interior.lightKey = `${key}|${lampsOn}`; }

    const spots = placeHousehold(building, people.map(r => ({ id: r.id, asleep: r.asleep, activity: r.activity, indoor: r.indoor })), householdOf(b));
    for (const id of [...interior.walkers.keys()]) if (!spots.has(id)) interior.walkers.delete(id);
    const everyone = people.map(r => {
      const spot = { floor: 0, ...spots.get(r.id) };
      let w = interior.walkers.get(r.id);
      if (!w) {
        // People already home when you look in are where they belong;
        // anyone arriving later comes in through the front door.
        const start = interior.fresh ? spot : { x: building.entrance[0], y: building.entrance[1], floor: 0 };
        w = { x: start.x, y: start.y, floor: start.floor || 0, path: [], tx: null, ty: null, tf: null };
        interior.walkers.set(r.id, w);
      }
      if (w.tx !== spot.x || w.ty !== spot.y || w.tf !== spot.floor) { w.path = routeInside(building, w, spot); w.tx = spot.x; w.ty = spot.y; w.tf = spot.floor; }
      walkIndoors(w, dt);
      const walking = w.path.length > 0;
      const object = spot.objectId ? building.floors[spot.floor]?.objects.find(o => o.id === spot.objectId) : null;
      return { r, spot, w, walking, object, lying: Boolean(spot.bed) && !walking, sitting: !walking && Boolean(object && furniture[object.kind]?.sit) };
    });
    interior.fresh = false;
    // Follow your own character up and down the stairs.
    const mine = me && canActInside(b) ? everyone.find(p => p.r.id === me.residentId) : null;
    if (mine && mine.w.floor !== interior.myFloor) { interior.myFloor = mine.w.floor; interior.floor = mine.w.floor; return; }
    interior.placed = everyone.filter(p => p.w.floor === interior.floor).sort((a, c) => a.w.y - c.w.y);

    roomCtx.imageSmoothingEnabled = false;
    roomCtx.clearRect(0, 0, roomCanvas.width, roomCanvas.height);
    roomCtx.save();
    roomCtx.scale(RS, RS);
    roomCtx.drawImage(interior.base, 0, 0);
    const busy = kinds => interior.placed.some(p => !p.walking && p.object && kinds.includes(p.object.kind));
    Rooms.drawAnimated(roomCtx, plan, performance.now() / 1000, { cooking: busy(["stove"]), tvOn: busy(["tv", "console"]) });
    const step = Math.floor(performance.now() / 170) % 4;
    for (const p of interior.placed) {
      if (p.lying) { drawSleeper(p.r, p.spot.bed, p.spot.slot || 0); continue; }
      const x = Math.round(p.w.x), y = Math.round(p.w.y);
      roomCtx.fillStyle = "rgba(20,12,8,.3)";
      roomCtx.fillRect(x - 5, y - 1, 10, 2);
      const sprite = spriteFor(p.r, p.walking ? [1, 0, 2, 0][step] : 0);
      // Sitting: a little lower, with the legs tucked behind the seat.
      if (p.sitting) roomCtx.drawImage(sprite, 0, 0, SPRITE_W, 17, x - 8, y - 19, SPRITE_W, 17);
      else roomCtx.drawImage(sprite, x - 8, y - FEET_ROW);
      if (p.r.id === selectedId) {
        const ay = y - (p.sitting ? 21 : FEET_ROW + 2) + Math.sin(performance.now() / 250);
        roomCtx.fillStyle = "#ffe066";
        roomCtx.beginPath(); roomCtx.moveTo(x - 3, ay - 4); roomCtx.lineTo(x + 3, ay - 4); roomCtx.lineTo(x, ay); roomCtx.closePath(); roomCtx.fill();
      }
    }
    roomCtx.restore();

    // Evening and night light: darkness with pools of lamplight.
    if (interior.lighting) {
      roomCtx.imageSmoothingEnabled = true;
      roomCtx.drawImage(interior.lighting.dark, 0, 0, plan.width * RS, plan.height * RS);
      roomCtx.globalCompositeOperation = "lighter";
      roomCtx.drawImage(interior.lighting.glow, 0, 0, plan.width * RS, plan.height * RS);
      roomCtx.globalCompositeOperation = "source-over";
    }

    // Name tags, sleepy z's and speech, in screen-friendly sizes.
    roomCtx.textAlign = "center";
    roomCtx.textBaseline = "middle";
    for (const p of interior.placed) {
      const bed = p.lying ? p.spot.bed : null;
      const x = (bed ? (bed.double ? bed.x + 7 + (p.spot.slot ? bed.w / 2 : 0) : bed.x + bed.w / 2) : p.w.x) * RS;
      const y = (bed ? bed.y + bed.h + 4 + (p.spot.slot || 0) * 5 : p.w.y + 4) * RS;
      if (bed) {
        const t = performance.now() / 700 + (p.spot.slot || 0) + bed.x;
        roomCtx.fillStyle = "rgba(255,255,255,.85)";
        roomCtx.font = "800 13px system-ui";
        ["z", "z", "Z"].forEach((z, i) => {
          const phase = (t + i * 0.6) % 2;
          roomCtx.globalAlpha = Math.max(0, 1 - phase / 2);
          roomCtx.fillText(z, x + (6 + i * 2) * RS, (bed.y - 1 - phase * 3 - i * 2) * RS);
        });
        roomCtx.globalAlpha = 1;
      }
      roomCtx.font = "700 12px system-ui";
      const w = roomCtx.measureText(p.r.name).width + 10;
      roomCtx.fillStyle = p.r.id === selectedId ? "rgba(255,224,102,.95)" : "rgba(18,28,43,.8)";
      roomCtx.beginPath(); roomCtx.roundRect(x - w / 2, y - 8, w, 16, 8); roomCtx.fill();
      roomCtx.fillStyle = p.r.id === selectedId ? "#1a2940" : "#fff";
      roomCtx.fillText(p.r.name, x, y);
      if (p.r.speech && nowMs() >= p.r.speech.from && nowMs() < p.r.speech.until) {
        roomCtx.font = "700 14px system-ui";
        const lines = wrapText(roomCtx, p.r.speech.text, 250).slice(0, 5);
        const bw = Math.min(roomCanvas.width - 8, Math.max(...lines.map(l => roomCtx.measureText(l).width)) + 20);
        const bh = lines.length * 17 + 8;
        const bx = Math.max(4, Math.min(roomCanvas.width - bw - 4, x - bw / 2));
        const by = Math.max(4, (p.w.y - FEET_ROW - 6) * RS - bh);
        roomCtx.fillStyle = "rgba(255,255,248,.96)";
        roomCtx.beginPath(); roomCtx.roundRect(bx, by, bw, bh, 11); roomCtx.fill();
        roomCtx.fillStyle = "#1a2940";
        lines.forEach((l, i) => roomCtx.fillText(l, bx + bw / 2, by + 12 + i * 17));
      }
    }

    const count = people.length;
    $("#interiorCount").textContent = count ? `${count} inside${people.some(r => r.asleep) ? " · shh, someone's sleeping" : ""}` : "Nobody's home";
    // Upstairs / downstairs switch, with how many are on the other floor.
    if (building.floors.length > 1) {
      const other = interior.floor ? 0 : 1;
      const there = everyone.filter(p => p.w.floor === other).length;
      floorButton.textContent = `${other ? "⬆ Upstairs" : "⬇ Downstairs"}${there ? ` · ${there}` : ""}`;
      floorButton.classList.remove("hidden");
    } else floorButton.classList.add("hidden");
    $("#interiorHint").textContent = canActInside(b)
      ? `Tap anything to use it: beds, chairs, the sink, the fridge, windows… Tap the floor to walk${plan.stairs ? ", the stairs to go " + (plan.stairs.to ? "up" : "down") : ""}${plan.frontDoor ? ", or the front door to go outside" : ""}.`
      : mode === "play" && canEnter(b)
        ? `Tap anywhere to walk to ${homeOf(me.residentId)?.id === b.id ? "your front door" : `the ${b.name} door`} and come inside.`
        : "Tap someone to check on them, or tap things to see what they're for.";
  }

  // Zoom in from (or back out to) the house on the map.
  function interiorOrigin(b) {
    interiorEl.style.setProperty("--ox", `${camera.x + b.x * camera.z}px`);
    interiorEl.style.setProperty("--oy", `${camera.y + b.y * camera.z}px`);
  }

  function openInterior(b) {
    interior.id = b.id;
    interior.floor = 0;
    interior.myFloor = null;
    interior.baseKey = "";
    interior.lightKey = "";
    interior.walkers.clear();
    interior.fresh = true;
    interior.closing = false;
    $("#interiorTitle").textContent = b.name;
    interiorOrigin(b);
    interiorEl.classList.remove("hidden", "leaving");
    interiorEl.classList.add("entering");
    setTimeout(() => interiorEl.classList.remove("entering"), 500);
  }

  function closeInterior(instant = false) {
    const b = buildings.find(x => x.id === interior.id);
    if (instant || !b) {
      interior.id = null;
      interiorEl.classList.add("hidden");
      return;
    }
    if (interior.closing) return;
    interior.closing = true;
    interiorOrigin(b);
    interiorEl.classList.remove("entering");
    interiorEl.classList.add("leaving");
    setTimeout(() => {
      if (!interior.closing) return;
      interior.closing = false;
      interior.id = null;
      interiorEl.classList.add("hidden");
      interiorEl.classList.remove("leaving");
    }, 380);
  }

  // Walking up to a front door takes you inside; leaving takes you out.
  let wasInside = null;
  function followMyDoor() {
    const mine = me && residents.get(me.residentId);
    const here = mine && mode === "play" && isInside(mine) ? buildingOf(mine) : null;
    if (here && here.id !== wasInside && interior.id !== here.id) openInterior(here);
    if (!here && wasInside && interior.id === wasInside) closeInterior();
    wasInside = here?.id || null;
  }

  // The front-most thing under a tap; rugs only if nothing else is there.
  function objectAt(plan, x, y) {
    const hits = plan.objects.filter(o => x >= o.x - 2 && x <= o.x + o.w + 2 && y >= o.y - (o.kind === "bed" ? 5 : 2) && y <= o.y + o.h + 2);
    const floorOnly = o => o.kind === "rug" || o.kind === "ring";
    hits.sort((a, c) => floorOnly(a) - floorOnly(c) || (c.y + c.h) - (a.y + a.h) || a.w * a.h - c.w * c.h);
    return hits[0] || null;
  }

  $("#leaveInterior").addEventListener("click", () => closeInterior());
  floorButton.addEventListener("click", () => { interior.floor = interior.floor ? 0 : 1; });
  roomCanvas.addEventListener("click", event => {
    const b = buildings.find(x => x.id === interior.id);
    const building = b && planFor(b.id);
    if (!building) return;
    const plan = building.floors[interior.floor] || building;
    const rect = roomCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * plan.width;
    const y = (event.clientY - rect.top) / rect.height * plan.height;
    const acting = canActInside(b);
    const hit = [...interior.placed].reverse().find(p => {
      if (acting && p.r.id === me.residentId) return false;
      if (p.lying) { const bed = p.spot.bed; return x >= bed.x && x <= bed.x + bed.w && y >= bed.y && y <= bed.y + bed.h; }
      return Math.abs(p.w.x - x) < 7 && y > p.w.y - FEET_ROW - 2 && y < p.w.y + 3;
    });
    if (hit && acting) { select(hit.r.id, false); return openSocial(hit.r); }
    if (hit) return select(hit.r.id);
    const fd = frontDoorRect(plan);
    const onDoor = Boolean(fd) && x >= fd.x - 3 && x <= fd.x + fd.w + 3 && y >= fd.y - 4;
    const st = plan.stairs;
    const onStairs = Boolean(st) && x >= st.x - 2 && x <= st.x + st.w + 2 && y >= st.y - 2 && y <= st.y + st.h + 2;
    const object = onDoor || onStairs ? null : objectAt(plan, x, y);
    if (acting) {
      if (onDoor) {
        send({ type: "leave-home", residentId: me.residentId });
        showToast("Heading outside…");
        return;
      }
      if (onStairs) {
        // Climb (or go down) to the other floor, and the view follows.
        const [sx, sy] = building.floors[st.to].stairs.spot;
        send({ type: "indoor-move", residentId: me.residentId, x: sx, y: sy, floor: st.to });
        showToast(st.to ? "Going upstairs…" : "Going downstairs…");
        return;
      }
      if (object) {
        send({ type: "use", residentId: me.residentId, objectId: object.id });
        showToast(`${furniture[object.kind].label}: ${furniture[object.kind].activity}`);
      } else send({ type: "indoor-move", residentId: me.residentId, x, y, floor: interior.floor });
      return;
    }
    if (onStairs) { interior.floor = st.to; return; }
    if (mode === "play" && canEnter(b)) {
      const [doorX, doorY] = walkNodes[b.node];
      send({ type: "control", residentId: me.residentId, x: doorX, y: doorY });
      return showToast(homeOf(me.residentId)?.id === b.id ? "Heading home…" : `Heading to ${b.name}…`);
    }
    if (onDoor) return showToast(`The front door of ${b.name}.`);
    if (object) showToast(`${furniture[object.kind].label}: good for ${furniture[object.kind].activity}. Play at home to use it.`);
  });

  // --- Social interactions (Sims-style) ---
  // Tap someone while playing: chat, joke, compliment, high five, hug, beg
  // for a treat, games, "follow me", invitations, teasing, saying sorry.
  // The server decides how they respond (lib/social.js).
  let socialActions = [];
  const socialEl = $("#socialMenu");
  const social = { target: null, pending: null };

  function relationTo(r) {
    const value = Number(r.relationships?.[me?.residentId]) || 0;
    const family = (residents.get(me?.residentId)?.profile?.family || []).some(link => link.id === r.id);
    const [emoji, label] = family && value >= 40 ? ["🏡", "Family"] : value < 0 ? ["😕", "Not getting along"] : value < 20 ? ["🙂", "Acquaintances"]
      : value < 40 ? ["😊", "Friendly"] : value < 65 ? ["😄", "Friends"] : value < 85 ? ["💛", "Good friends"] : ["💖", "Best friends"];
    return { value, family, emoji, label };
  }

  function openSocial(r) {
    if (!me || !socialActions.length) return;
    social.target = r.id;
    const rel = relationTo(r);
    // A favour they'd like to ask, or their lost thing to give back.
    const mine = myResident();
    const offer = (mine?.questOffers || []).find(q => q.requesterId === r.id);
    const giving = (mine?.quests || []).find(q => q.kind === "find" && q.found && q.requesterId === r.id);
    $("#socialFavour").innerHTML = (offer ? `<div class="favour"><p><b>❗ ${escapeHtml(r.name)}:</b> “${escapeHtml(offer.ask)}”</p><div><button data-offer="${escapeHtml(offer.id)}" data-yes="1">I'll help! +${offer.stars}⭐</button><button data-offer="${escapeHtml(offer.id)}">Not now</button></div></div>` : "")
      + (giving ? `<div class="favour"><button data-give="${escapeHtml(r.id)}">🎁 Give back the ${escapeHtml(giving.item.name)}</button></div>` : "");
    $("#socialName").textContent = r.name;
    $("#socialRel").textContent = `${rel.emoji} ${rel.label}`;
    $("#socialActions").innerHTML = socialActions
      .filter(a => a.minRel === null || rel.value >= a.minRel || rel.family)
      .map(a => `<button data-action="${a.id}"><b>${a.emoji}</b><span>${escapeHtml(a.label)}</span></button>`).join("");
    $("#socialPlaces").classList.add("hidden");
    $("#socialActions").classList.remove("hidden");
    socialEl.classList.remove("hidden");
  }

  function closeSocial() { socialEl.classList.add("hidden"); social.target = null; }

  $("#socialFavour").addEventListener("click", event => {
    const offer = event.target.closest("button[data-offer]");
    const give = event.target.closest("button[data-give]");
    const target = residents.get(social.target);
    if (offer) { send({ type: "quest", residentId: me.residentId, offerId: offer.dataset.offer, accept: Boolean(offer.dataset.yes) }); closeSocial(); }
    if (give && target) { closeSocial(); sendNear(target, { type: "give", residentId: me.residentId, targetId: target.id }); }
  });

  $("#socialClose").addEventListener("click", closeSocial);
  $("#socialActions").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = socialActions.find(a => a.id === button.dataset.action);
    if (action?.needsPlace) {
      $("#socialPlaces").innerHTML = Object.entries(places).filter(([key]) => key !== "homes")
        .map(([key, place]) => `<button data-place="${key}"><b>📍</b><span>${escapeHtml(place.name)}</span></button>`).join("");
      $("#socialPlaces").dataset.action = action.id;
      $("#socialActions").classList.add("hidden");
      $("#socialPlaces").classList.remove("hidden");
      return;
    }
    doSocial(button.dataset.action);
  });
  $("#socialPlaces").addEventListener("click", event => {
    const button = event.target.closest("button[data-place]");
    if (button) doSocial($("#socialPlaces").dataset.action, button.dataset.place);
  });

  const SOCIAL_NEAR = 40;
  function doSocial(action, place) {
    const target = residents.get(social.target);
    closeSocial();
    if (!target || !me) return;
    sendNear(target, { type: "social", residentId: me.residentId, targetId: target.id, action, ...(place ? { place } : {}) });
  }

  /** Send a request to someone, walking over first if they're too far away. */
  function sendNear(target, request) {
    const mine = residents.get(me.residentId);
    if (mine && Math.hypot(mine.x - target.x, mine.y - target.y) <= SOCIAL_NEAR && buildingOf(mine)?.id === buildingOf(target)?.id) return send(request);
    // Too far: walk over first, then do it.
    social.pending = { request, since: performance.now(), aimed: 0 };
    showToast(`Walking over to ${target.name}…`);
  }

  // Walk toward whoever we're going to see, and act once close enough.
  function followSocial() {
    const pending = social.pending;
    if (!pending || !me) return;
    const mine = residents.get(me.residentId), target = residents.get(pending.request.targetId);
    if (!mine || !target || performance.now() - pending.since > 40_000 || mode !== "play") { social.pending = null; return; }
    const near = Math.hypot(mine.x - target.x, mine.y - target.y) <= SOCIAL_NEAR && buildingOf(mine)?.id === buildingOf(target)?.id;
    if (near) { send(pending.request); social.pending = null; return; }
    if (performance.now() - pending.aimed > 2500) {
      pending.aimed = performance.now();
      const spot = snapToWalkable(target.x + 10, target.y + 2);
      send({ type: "control", residentId: me.residentId, x: spot.x, y: spot.y });
    }
  }

  function showSocialResult(msg) {
    if (msg.error) return showToast(msg.error);
    const target = residents.get(msg.targetId);
    const action = socialActions.find(a => a.id === msg.action);
    const name = target?.name || "They";
    const d = Math.round((msg.relAfter ?? 0) - (msg.relBefore ?? 0));
    const change = d > 0 ? ` 💗+${d}` : d < 0 ? ` 💔${d}` : "";
    const how = msg.accepted ? `${name} liked that!` : msg.repeats >= 2 ? `${name} wants to do something different.` : msg.action === "wish" ? `${name} hasn't decided yet.` : `${name} wasn't keen this time.`;
    showToast(`${action?.emoji || "💬"} ${how}${change} · ${msg.relationship}`);
  }

  // --- Mr. E's programme, favours and rewards ---
  const banner = $("#eventBanner");
  const todayEl = $("#todayCard");
  const favourMarks = { ask: new Set(), give: new Set() };
  let findables = [];
  let pendingPlay = null;
  let lastBanner = 0;
  const bursts = [];

  function programme() { return town.programme || null; }
  function myResident() { return me ? residents.get(me.residentId) : null; }
  function timeLabel(ms) { return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function currentEvent() { const now = programme()?.now; return now && now.end > nowMs() ? now : null; }
  function riddleForMe() { const e = currentEvent(); const mine = myResident(); return e?.kind === "riddle" && mine && !e.answered.includes(mine.id) ? e : null; }

  function updateBanner() {
    const pg = programme();
    if (!pg) { banner.textContent = "✨ Things to do · Explore Cooke’s Corner"; banner.classList.remove("hidden"); return; }
    const now = nowMs();
    const event = currentEvent();
    const mine = myResident();
    let text;
    if (event) {
      let extra = "";
      if (event.kind === "hunt" && mine) extra = ` · ${event.items.filter(i => i.takenBy.includes(mine.id)).length}/${event.items.length} found`;
      if (event.kind === "gather" && mine && event.joined.includes(mine.id)) extra = " · joined ✓";
      if (event.kind === "riddle" && mine) extra = event.answered.includes(mine.id) ? " · answered ✓" : " · tap to answer";
      text = `${event.emoji} ${event.name} · ${event.placeName} · ${Math.max(1, Math.round((event.end - now) / 60000))} min left${extra}`;
    } else {
      const next = pg.today.find(e => e.start > now);
      text = next ? `Next: ${next.emoji} ${next.name} at ${timeLabel(next.start)}` : "🌙 A quiet evening · Find something to do";
    }
    if (banner.textContent !== text) banner.textContent = text;
    banner.classList.remove("hidden");
  }

  const outings = [
    { place: "park", emoji: "🦆", title: "Visit the ducks", detail: "Fresh air, flowers and a little fun." },
    { place: "cafe", emoji: "☕", title: "Take a cafe break", detail: "Head inside for a snack or the piano." },
    { place: "workshop", emoji: "🎨", title: "Make something", detail: "Explore the workshop and art studio." },
    { place: "market", emoji: "🍎", title: "Browse the market", detail: "Fruit, treats and familiar faces." },
    { place: "square", emoji: "⛲", title: "Meet in the square", detail: "A good place to watch town life." },
    { place: "homes", emoji: "🏡", title: "A moment at home", detail: "Rest, play or spend time with family." }
  ];

  function visitPlace(key) {
    const place = places[key];
    if (!place) return;
    const building = key === "homes" ? homeOf(me?.residentId || selectedId) : buildings.find(b => b.place === key);
    const door = building && walkNodes[building.node];
    const point = door ? { x: door[0], y: door[1] } : snapToWalkable(place.x, place.y);
    closeToday();
    if (!me || VISITOR) {
      centerOn(point.x, point.y, Math.max(camera.z, defaultZoom()));
      showToast(`${building?.name || place.name} · ${VISITOR ? "Enjoy watching the town." : "Sign in to walk here."}`);
      return;
    }
    setMode("play");
    social.pending = null;
    pendingPlay = null;
    send({ type: "control", residentId: me.residentId, x: point.x, y: point.y });
    tapMarker = { ...point, at: performance.now() };
    showToast(`Walking to ${building?.name || place.name}…`);
  }

  let todayFocus = null;
  function revealToday() {
    if (!todayEl.contains(document.activeElement)) todayFocus = document.activeElement;
    todayEl.classList.remove("hidden");
    todayEl.querySelector(".today-close")?.focus();
  }
  function closeToday() {
    todayEl.classList.add("hidden");
    if (todayFocus?.isConnected) todayFocus.focus();
    else banner.focus();
  }

  function openToday() {
    const pg = programme();
    const now = nowMs();
    const mine = myResident();
    const rows = (pg?.today || []).map(e => `<li class="${e.end < now ? "past" : e.start <= now ? "now" : ""}"><time>${timeLabel(e.start)}</time><b>${e.emoji}</b><span>${escapeHtml(e.name)} <small>${escapeHtml(e.place)}</small></span></li>`).join("");
    const quests = (mine?.quests || []).map(q => `<li><b>${q.emoji}</b><span>${escapeHtml(q.text)}${q.kind === "find" && q.found ? " <em>· found! Take it back</em>" : ""} <small>+${q.stars}⭐</small></span></li>`).join("");
    const offers = (mine?.questOffers || []).map(q => `<li><b>❗</b><span>${escapeHtml(q.requesterName)} has a favour to ask.<button class="favour-shortcut" data-resident="${escapeHtml(q.requesterId)}">Find ${escapeHtml(q.requesterName)}</button></span></li>`).join("");
    const live = currentEvent();
    const activities = outings.map(o => `<button class="outing" data-outing="${o.place}"><b>${o.emoji}</b><span><strong>${o.title}</strong><small>${o.detail}</small></span><i aria-hidden="true">→</i></button>`).join("");
    const eventAction = live ? `<div class="today-highlight"><small>HAPPENING NOW</small><h3>${escapeHtml(live.emoji)} ${escapeHtml(live.name)}</h3><p>${escapeHtml(live.placeName)} · ${Math.max(1, Math.ceil((live.end - now) / 60000))} minutes left</p><button data-${live.kind === "riddle" && mine && !live.answered.includes(mine.id) ? 'riddle="1"' : `outing="${escapeHtml(live.place)}"`}>${live.kind === "riddle" && mine && !live.answered.includes(mine.id) ? "Answer the riddle" : me ? "Walk to the event" : "Show on map"}</button></div>` : "";
    const groups = new Map();
    for (const k of (mine?.keepsakes || []).slice().reverse()) {
      const g = groups.get(k.name) || { emoji: k.emoji, name: k.name, n: 0 }; g.n++; groups.set(k.name, g);
    }
    const stickers = [...groups.values()].map(g => `<span class="sticker"><b>${escapeHtml(g.emoji)}</b><small>${escapeHtml(g.name)}</small>${g.n > 1 ? `<i>×${g.n}</i>` : ""}</span>`).join("");
    todayEl.innerHTML = `<div class="today-inner"><button class="today-close" aria-label="Close">✕</button>
      <h2>Things to do</h2><p class="today-intro">${me ? "Pick a little adventure. Your character will walk there." : "Explore the town, or sign in to join in."}</p>
      ${eventAction}<div class="outing-grid">${activities}</div>
      ${mine ? `<h3>Favours</h3><ul class="today-list">${quests + offers || "<li><b>❗</b><span>Look for a ❗ over someone in town. They might need your help!</span></li>"}</ul>
      <h3>⭐ ${mine.stars || 0} Town Stars</h3><p class="today-intro">Spend them on 🎁 gifts for friends (5⭐ each). Tap someone, then “Give a gift”. Friends you don't visit for a day slowly drift apart.</p>
      <h3>Sticker book · ${groups.size} different</h3><div class="sticker-book">${stickers || "<em>Earn stickers from events, favours and new friendships!</em>"}</div>` : ""}<details class="today-schedule"><summary>Today’s event schedule</summary><ol class="today-list">${rows || "<li>The next programme is on its way.</li>"}</ol></details></div>`;
    revealToday();
  }

  function openRiddle() {
    const event = riddleForMe();
    if (!event) return openToday();
    todayEl.innerHTML = `<div class="today-inner"><button class="today-close" aria-label="Close">✕</button><h2>🔮 Mr. E's riddle</h2>
      <p class="riddle-q">${escapeHtml(event.riddle.q)}</p><div class="riddle-options">${event.riddle.options.map((o, i) => `<button data-choice="${i}">${escapeHtml(o)}</button>`).join("")}</div></div>`;
    revealToday();
  }

  banner.addEventListener("click", () => (mode === "play" && riddleForMe() ? openRiddle() : openToday()));
  todayEl.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeToday(); }
    if (event.key !== "Tab") return;
    const controls = [...todayEl.querySelectorAll("button, summary")].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  todayEl.addEventListener("click", event => {
    const person = event.target.closest("button[data-resident]");
    if (person) {
      const resident = residents.get(person.dataset.resident);
      if (!resident) return;
      closeToday();
      select(resident.id, false);
      centerOn(resident.drawX, resident.drawY, Math.max(camera.z, defaultZoom()));
      if (me && !VISITOR) { setMode("play"); select(resident.id, false); openSocial(resident); }
      return;
    }
    const outing = event.target.closest("button[data-outing]");
    if (outing) return visitPlace(outing.dataset.outing);
    if (event.target.closest("button[data-riddle]")) return openRiddle();
    const choice = event.target.closest("button[data-choice]");
    if (choice) { send({ type: "riddle", residentId: me.residentId, choice: Number(choice.dataset.choice) }); closeToday(); return; }
    if (event.target.closest(".today-close") || event.target === todayEl) closeToday();
  });

  // Hunt items (everyone can find every one) and lost things for your favours.
  function drawFindables() {
    const event = currentEvent();
    const mine = myResident();
    findables = [];
    if (event?.kind === "hunt") for (const item of event.items) if (!mine || !item.takenBy.includes(mine.id)) findables.push({ x: item.x, y: item.y, emoji: event.itemEmoji, request: me && { type: "collect", residentId: me.residentId, itemId: item.id } });
    for (const q of mine?.quests || []) if (q.kind === "find" && !q.found) findables.push({ x: q.x, y: q.y, emoji: q.item.emoji, request: { type: "pickup", residentId: me.residentId, questId: q.id } });
    const t = performance.now() / 1000;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${Math.max(10, screenPx(20)).toFixed(1)}px system-ui`;
    for (const it of findables) {
      const bob = Math.sin(t * 3 + it.x) * 1.2;
      ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff6c2";
      ctx.beginPath(); ctx.arc(it.x, it.y - 4 + bob, Math.max(6, screenPx(14)) + Math.sin(t * 4 + it.y), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillText(it.emoji, it.x, it.y - 4 + bob);
    }
    ctx.restore();
  }

  function goAndDo(request, x, y) {
    const mine = myResident();
    if (!request || !mine) return;
    if (Math.hypot(mine.x - x, mine.y - y) <= 24) return send(request);
    pendingPlay = { request, x, y, since: performance.now(), aimed: 0 };
    showToast("Heading over…");
  }

  function followPlay() {
    const mine = myResident();
    if (!pendingPlay || !mine) return;
    if (performance.now() - pendingPlay.since > 40_000 || mode !== "play") { pendingPlay = null; return; }
    if (Math.hypot(mine.x - pendingPlay.x, mine.y - pendingPlay.y) <= 24) { send(pendingPlay.request); pendingPlay = null; return; }
    if (performance.now() - pendingPlay.aimed > 2500) {
      pendingPlay.aimed = performance.now();
      const spot = snapToWalkable(pendingPlay.x, pendingPlay.y);
      send({ type: "control", residentId: me.residentId, x: spot.x, y: spot.y });
    }
  }

  function showPlayResult(msg) {
    if (msg.error) return showToast(msg.error);
    if (msg.kind === "collect") return showToast(`${msg.item.emoji} Found ${msg.found} of ${msg.total}!`);
    if (msg.kind === "riddle") return showToast(msg.right ? "🔮 Correct! Mr. E is impressed." : `🔮 Good guess! The answer was: ${msg.answer}.`);
    if (msg.kind === "quest") return showToast(msg.accepted ? `✅ You're helping: ${msg.accepted}` : "Maybe later, then!");
    if (msg.kind === "pickup") return showToast(`${msg.found.emoji} Found the ${msg.found.name}! Take it back to ${msg.forName}.`);
  }

  // Stars burst from your character when you earn something.
  function celebrate(msg) {
    const mine = myResident();
    if (mine) bursts.push({ x: mine.drawX, y: mine.drawY - 20, at: performance.now(), big: Boolean(msg.keepsake) });
    if (msg.keepsake || msg.stars > 1) showToast(`⭐ +${msg.stars}${msg.keepsake ? ` · ${msg.keepsake.emoji} ${msg.keepsake.name}` : ""} (${msg.why})`);
  }

  function drawBursts() {
    const now = performance.now();
    while (bursts.length && now - bursts[0].at > 1200) bursts.shift();
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const b of bursts) {
      const k = (now - b.at) / 1200;
      ctx.globalAlpha = 1 - k;
      ctx.font = `${b.big ? 9 : 7}px system-ui`;
      for (let i = 0; i < (b.big ? 10 : 5); i++) {
        const a = (i / (b.big ? 10 : 5)) * Math.PI * 2;
        ctx.fillText("⭐", b.x + Math.cos(a) * k * 22, b.y + Math.sin(a) * k * 16 - k * 6);
      }
    }
    ctx.restore();
  }

  // --- Input ---
  function viewPoint(event) {
    const rect = view.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function mapPoint(event) {
    const p = viewPoint(event);
    return { x: (p.x - camera.x) / camera.z, y: (p.y - camera.y) / camera.z };
  }

  function select(id, open = true) {
    selectedId = id;
    renderedDetailKey = "";
    renderSelected();
    if (open) ui.sheet.classList.add("open");
  }

  function showBuilding(b) {
    const inside = [...residents.values()].filter(r => b.residents ? r.place === "homes" && homeOf(r.id)?.id === b.id : r.place === b.place);
    showToast(inside.length ? `${b.name}: ${inside.map(r => r.name + (r.asleep ? " (asleep)" : "")).join(", ")}` : `${b.name}: nobody here right now`);
    if (inside[0]) select(inside[0].id, false);
  }

  function handleTap(event) {
    if (!residents.size) return;
    const who = document.getElementById("whoPicker");
    if (who && !who.classList.contains("hidden")) { who.classList.add("hidden"); return; }
    // A tap outside the social menu just closes it.
    if (!socialEl.classList.contains("hidden")) return closeSocial();
    const p = mapPoint(event);
    const playing = mode === "play" && me;
    // While Mr. E is announcing, his bubble and body come first so residents
    // beside him don't swallow the tap; otherwise residents come first.
    const speaking = mreSpeaking(nowMs());
    if (playing && tappedMrE(p) && riddleForMe()) return openRiddle();
    if (speaking && tappedMrE(p)) return showToast(mreTapText(nowMs()));
    if (tappedTron(p)) return me?.role === "owner" ? showTron() : showToast(`◈ Glint is scanning ${town.tron?.watching || "the town"}… beep boop.`);
    // Hunt items and lost things for favours: tap to collect (walking over if needed).
    // At least 24 screen px around each item, nearest one wins.
    const reach = Math.max(10, screenPx(24));
    const findable = playing && findables
      .map(it => ({ it, d: Math.hypot(it.x - p.x, it.y - 4 - p.y) }))
      .filter(f => f.d < reach).sort((a, b) => a.d - b.d)[0]?.it;
    if (findable) return goAndDo(findable.request, findable.x, findable.y);
    const hits = [...residents.values()]
      .filter(r => !hiddenInside(r) && r.id !== (playing ? me.residentId : null))
      .filter(r => Math.abs(r.drawX - p.x) < screenPx(playing ? 12 : 18) + 6 && p.y > r.drawY - FEET_ROW * PX - 4 && p.y < r.drawY + screenPx(14))
      .sort((a, b) => Math.hypot(a.drawX - p.x, a.drawY - 8 - p.y) - Math.hypot(b.drawX - p.x, b.drawY - 8 - p.y));
    // Two people under one finger: ask who you meant.
    if (hits.length > 1) return showWho(hits.slice(0, 4), playing);
    const hit = hits[0];
    if (hit && playing) { select(hit.id, false); return openSocial(hit); }
    if (hit) return select(hit.id);
    if (!speaking && tappedMrE(p)) return showToast(mreTapText(nowMs()));
    if (scenery.catAt(p)) return showToast(`🐈 Marmalade, the town cat, is ${scenery.catStatus()}.`);
    const pad = screenPx(6);
    const sign = signBoxes.find(s => p.x >= s.x0 - pad && p.x <= s.x1 + pad && p.y >= s.y0 - pad && p.y <= s.y1 + pad);
    if (!playing) {
      if (sign) { if (planFor(sign.b.id)) openInterior(sign.b); else showBuilding(sign.b); }
      return;
    }
    // Tap a sign to walk to that building's door; tap anywhere else to walk
    // to the nearest point on the paths.
    const door = sign ? walkNodes[sign.b.node] : null;
    const target = door ? { x: door[0], y: door[1] } : snapToWalkable(p.x, p.y);
    send({ type: "control", residentId: me.residentId, x: target.x, y: target.y });
    if (sign) showToast(`Walking to ${sign.b.name}`);
    // Places you can enter open when you reach the door; others' homes you can peek into.
    if (sign && planFor(sign.b.id) && !canEnter(sign.b)) openInterior(sign.b);
    tapMarker = { x: target.x, y: target.y, at: performance.now() };
    select(me.residentId, false);
  }

  function showWho(list, playing) {
    let el = document.getElementById("whoPicker");
    if (!el) {
      el = document.createElement("div"); el.id = "whoPicker"; el.className = "who-picker";
      document.querySelector(".world-card").appendChild(el);
      el.addEventListener("click", ev => {
        const b = ev.target.closest("button[data-id]"); el.classList.add("hidden");
        const r = b && residents.get(b.dataset.id); if (!r) return;
        if (el.dataset.play === "1") { select(r.id, false); openSocial(r); } else select(r.id);
      });
    }
    el.dataset.play = playing ? "1" : "";
    el.innerHTML = "<strong>Who?</strong>";
    for (const r of list) {
      const b = document.createElement("button"); b.dataset.id = r.id;
      const img = document.createElement("img"); img.src = spriteFor(r, 0).toDataURL(); img.alt = "";
      const name = document.createElement("span"); name.textContent = r.name;
      b.append(img, name); el.appendChild(b);
    }
    const x = document.createElement("button"); x.textContent = "✕"; x.className = "who-x"; el.appendChild(x);
    el.classList.remove("hidden");
  }

  function setMode(next) {
    if (next === "play" && !me) { showToast("Sign in to play."); return showProfileMenu(); }
    if (next === "play" && residents.get(me.residentId)?.playable === false) return showToast("Your player isn't linked to a resident.");
    mode = next;
    document.querySelectorAll(".dock-button[data-mode]").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    if (mode === "play") {
      select(me.residentId, false);
      const r = residents.get(me.residentId);
      camera.userMovedAt = 0;
      if (r) centerOn(r.drawX, r.drawY, Math.max(camera.z, defaultZoom()));
    }
    else send({ type: "release" });
  }

  document.querySelectorAll(".dock-button[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));

  function showTravelMenu() {
    if (!me) { showToast("Sign in to travel."); return showProfileMenu(); }
    const here = activeDestinationId();
    const card = $("#travelCard");
    card.innerHTML = `<div class="today-inner"><button class="today-close" aria-label="Close">✕</button><p class="eyebrow">TRAVEL</p><h2>Choose a town</h2><p class="today-intro">Your memories, friendships, and needs travel with you. Each place has residents living their own lives.</p><div class="outing-grid">${(destinations || []).map(destination => `<button class="outing" data-destination="${escapeHtml(destination.id)}" ${destination.id === here ? "disabled" : ""}><b>${destination.id === "riverlight" ? "⌇" : destination.id === "patchwork-commons" ? "✦" : destination.id === "copper-clover" ? "♧" : "⌂"}</b><span><strong>${escapeHtml(destination.name)}</strong><small>${escapeHtml(destination.subtitle)}</small>${destination.id === here ? "<i>Here now</i>" : ""}</span></button>`).join("")}</div></div>`;
    card.classList.remove("hidden");
    card.querySelector(".today-close").addEventListener("click", () => card.classList.add("hidden"));
    card.querySelectorAll("[data-destination]").forEach(button => button.addEventListener("click", () => send({ type: "travel", residentId: me.residentId, destinationId: button.dataset.destination })));
  }
  $("#travelButton").addEventListener("click", showTravelMenu);
  function renderTron(history) { const log = $("#tronLog"); if (log) { log.innerHTML = history.map(m => `<p class="tron-message"><b>${escapeHtml(m.who)}</b>${escapeHtml(m.text)}</p>`).join(""); log.scrollTop = log.scrollHeight; } }
  function showTron() { if (!me) return showProfileMenu(); const card = $("#tronCard"); card.innerHTML = `<div class="today-inner"><button class="today-close" aria-label="Close">✕</button><p class="eyebrow">CARETAKER</p><h2>Talk to Glint</h2><p class="today-intro">Glint lives in town, watches how everyone is doing, and tells you what he'd change.</p><div id="tronLog" class="tron-log"><p class="tron-message"><b>Glint</b>Greetings, creator. I'm keeping watch over ${escapeHtml(town.tron?.watching || "the town")}. I have ${town.tron?.notes || 0} notes. Ask me "what's going on?", "anything weird?" or "what should we change?"</p></div><form id="tronForm" class="tron-form"><input maxlength="600" placeholder="Talk to Glint…" aria-label="Message Glint" /><button>Send</button></form></div>`; card.classList.remove("hidden"); card.querySelector(".today-close").onclick = () => card.classList.add("hidden"); card.querySelector("#tronForm").onsubmit = e => { e.preventDefault(); const input = e.currentTarget.querySelector("input"); const text = input.value.trim(); if (text) { const log = card.querySelector("#tronLog"); input.value = ""; input.disabled = true; log.insertAdjacentHTML("beforeend", `<p class="tron-message"><b>You</b>${escapeHtml(text)}</p><p class="tron-message tron-thinking"><b>Glint</b>Thinking…</p>`); log.scrollTop = log.scrollHeight; send({ type: "tron-chat", text }); window.setTimeout(() => { input.disabled = false; }, 60_000); } }; }
  $("#tronButton").addEventListener("click", showTron);

  const pointers = new Map();
  let pinch = null;
  let gestureMoved = false;
  view.addEventListener("pointerdown", event => {
    if (event.target.closest("button, .interior")) return;
    view.setPointerCapture(event.pointerId);
    const p = viewPoint(event);
    pointers.set(event.pointerId, { x: p.x, y: p.y, startX: p.x, startY: p.y });
    gestureMoved = pointers.size > 1;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: camera.z };
    }
  });
  view.addEventListener("pointermove", event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const p = viewPoint(event);
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    pointer.x = p.x; pointer.y = p.y;
    if (Math.hypot(p.x - pointer.startX, p.y - pointer.startY) > 7) gestureMoved = true;
    if (pointers.size === 1 && gestureMoved) {
      camera.x += dx; camera.y += dy;
      camera.userMovedAt = performance.now();
      applyCamera();
    }
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      zoomAt(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      camera.userMovedAt = performance.now();
    }
  });
  const endPointer = event => {
    const had = pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    return had;
  };
  view.addEventListener("pointerup", event => { if (endPointer(event) && !gestureMoved && pointers.size === 0) handleTap(event); });
  view.addEventListener("pointercancel", endPointer);
  view.addEventListener("wheel", event => {
    event.preventDefault();
    const p = viewPoint(event);
    zoomAt(camera.z * Math.exp(-event.deltaY * 0.0015), p.x, p.y);
    camera.userMovedAt = performance.now();
  }, { passive: false });

  $("#findStory").addEventListener("click", () => {
    // Most interesting: whoever is talking right now, else the best mood swing.
    const now = nowMs();
    const list = [...residents.values()].filter(r => !r.asleep);
    const talking = list.find(r => r.speech && now < r.speech.until);
    const pickResident = talking || list.sort((a, b) => Math.abs(60 - (b.mood?.valence ?? 60)) - Math.abs(60 - (a.mood?.valence ?? 60)))[0];
    if (pickResident) select(pickResident.id);
  });
  $("#dismissReturn").addEventListener("click", () => ui.returnCard.classList.add("hidden"));
  $("#editResident").addEventListener("click", () => { const r = selected(); if (r) showCharacterEditor(r); });
  $("#expandSheet").addEventListener("click", () => ui.sheet.classList.toggle("open"));
  $(".sheet-handle").addEventListener("click", () => ui.sheet.classList.toggle("open"));
  $("#peopleButton").addEventListener("click", openPeople);
  $("#todayButton").addEventListener("click", openToday);
  // The home plot: your family's garden, pond and mailbox (public/homestead.js).
  window.LivingTownHome?.init({
    send, toast: showToast, me: () => me?.residentId || null, resident: id => residents.get(id),
    look: id => { const r = residents.get(id); return r ? lookFor(r) : null; },
    editLook: () => { const r = me && residents.get(me.residentId); if (r) showCharacterEditor(r); },
    openHouse: () => { window.LivingTownHome.close(); visitPlace("homes"); }
  });
  $("#homeButton").addEventListener("click", () => window.LivingTownHome?.open());
  // Everyone in town, with a face, where they are, and a ❗ if they need you.
  function openPeople() {
    const asks = new Set((myResident()?.questOffers || []).map(q => q.requesterId));
    const here = activeDestinationId();
    const list = [...residents.values()].filter(r => (!me || r.id !== me.residentId) && (r.destinationId || "little-town") === here)
      .sort((a, b) => (asks.has(b.id) - asks.has(a.id)) || a.name.localeCompare(b.name));
    const rows = list.map(r => `<button class="person-row" data-resident="${escapeHtml(r.id)}"><img src="${spriteFor(r, 0).toDataURL()}" alt=""><span><strong>${asks.has(r.id) ? "❗ " : ""}${escapeHtml(r.name)}</strong><small>${escapeHtml(r.asleep ? "Asleep 💤" : capitalizeFirst(r.activity || ""))}</small></span><i aria-hidden="true">→</i></button>`).join("");
    todayEl.innerHTML = `<div class="today-inner"><button class="today-close" aria-label="Close">✕</button><h2>People</h2><p class="today-intro">Tap someone to go and see them.</p><div class="people-list">${rows}</div></div>`;
    revealToday();
  }
  function updateTownName() {
    const id = activeDestinationId();
    const name = id === "little-town" ? "Cooke’s Corner" : (destinations || []).find(d => d.id === id)?.name || "Cooke’s Corner";
    const el = document.querySelector(".town-title span");
    if (el && el.textContent !== name) el.textContent = name;
  }
  function capitalizeFirst(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; }
  $("#storiesButton").addEventListener("click", () => { ui.sheet.classList.add("open"); $('[data-panel="eventsPanel"]').click(); });
  $("#recenterButton").addEventListener("click", () => {
    const r = selected();
    camera.userMovedAt = 0;
    if (r) { centerOn(r.drawX, r.drawY, Math.max(camera.z, defaultZoom())); showToast(`Watching ${r.name}`); }
    else centerOn(places.square.x, places.square.y, defaultZoom());
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
    const response = await fetch(path.startsWith("/") ? BASE + path.slice(1) : path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
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
    const next = new URLSearchParams(location.search).get("next");
    if (next === "/playable-spine/") {
      location.assign(next);
      return;
    }
    if (freshLogin) reconnect();
    setMode("play");
    showToast(`Playing as ${profile.name}`);
    // The home plot is the start screen; the old town is one tap away (To town). ?town skips it.
    if (!homeStarted && !new URLSearchParams(location.search).has("town")) {
      homeStarted = true;
      const go = (n = 0) => socket?.readyState === 1 ? window.LivingTownHome?.open() : n < 40 && setTimeout(() => go(n + 1), 250);
      go();
    }
  }
  let homeStarted = false;

  function gateShell(content, closable = false, title = "Who’s visiting town?") {
    let gate = $("#playerGate");
    if (!gate) {
      gate = document.createElement("section");
      gate.id = "playerGate";
      gate.className = "player-gate";
      $(".app-shell").append(gate);
    }
    gate.innerHTML = `<div class="gate-card"><p class="eyebrow">ONE SHARED WORLD</p>${title ? `<h2>${title}</h2>` : ""}${content}<p id="gateError" class="gate-error" role="alert"></p>${closable ? '<button id="closeGate" class="text-button">Just watch the town</button>' : ""}</div>`;
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

  async function showProfileMenu() {
    let status;
    try { status = await api("/api/auth/status"); } catch (error) { return showToast(error.message); }
    if (!status.me) return showPlayerGate(status);
    me = status.me;
    const owner = me.role === "owner";
    const claimed = new Set(status.profiles.map(profile => profile.residentId));
    const canCreate = owner && status.playable.some(id => !claimed.has(id));
    const others = owner ? status.profiles.filter(p => p.id !== me.id).map(p => `<li><b>${escapeHtml(p.name)}</b> · ${escapeHtml(residentName(p.residentId))}<span><button class="text-button" data-reset="${escapeHtml(p.id)}">Reset PIN</button><button class="text-button danger" data-remove="${escapeHtml(p.id)}">Remove</button></span></li>`).join("") : "";
    const ownerTools = owner ? `<button id="ownerTravel" class="soft-button">⌁ Travel to another town</button><button id="ownerTron" class="soft-button">◈ Talk to Glint</button><button id="addResident" class="wide-button">Add a new resident</button><button id="askMrE" class="soft-button">✦ Ask Mr. E for a surprise</button><p class="gate-copy small">Mr. E's brain: ${escapeHtml(mreBrain || "starting up")}</p><p class="gate-copy small">NPC planning: ${escapeHtml(town.npcBrain?.mode || "adaptive planner")} · ${town.npcBrain?.accepted || 0} model plans accepted this session</p>` : "";
    const gate = gateShell(`<div class="login-avatar">${escapeHtml(me.name.charAt(0))}</div><h3>${escapeHtml(me.name)}</h3><p class="gate-copy">Plays as ${escapeHtml(residentName(me.residentId))}</p><button id="editLook" class="soft-button">Customize my character</button>${ownerTools}${canCreate ? '<button id="createPlayer" class="soft-button">Create another player</button>' : ""}${others ? `<ul class="player-admin">${others}</ul>` : ""}<button id="backToTown" class="soft-button">Back to town</button><button id="logoutPlayer" class="text-button">Switch player</button>`, false, "");
    gate.querySelector("#backToTown").addEventListener("click", () => gate.remove());
    gate.querySelector("#editLook").addEventListener("click", () => {
      const mine = residents.get(me.residentId);
      if (mine) showCharacterEditor(mine); else showToast("Your character hasn't loaded yet.");
    });
    gate.querySelector("#addResident")?.addEventListener("click", () => showCharacterEditor(null));
    gate.querySelector("#ownerTravel")?.addEventListener("click", () => { gate.remove(); showTravelMenu(); });
    gate.querySelector("#ownerTron")?.addEventListener("click", () => { gate.remove(); showTron(); });
    gate.querySelector("#askMrE")?.addEventListener("click", async () => {
      try {
        showToast("✦ Mr. E is thinking…");
        const result = await api("/api/mre/surprise", { method: "POST" });
        gate.remove();
        if (result.brain) mreBrain = result.brain;
        showToast(`✦ Mr. E: "${result.announcement}"`);
      } catch (error) { gate.querySelector("#gateError").textContent = error.message; }
    });

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
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Profile</button><h3>Reset PIN</h3><form id="pinForm"><label>New PIN<input name="pin" inputmode="numeric" maxlength="6" type="password" autocomplete="new-password" required></label><button class="wide-button">Save PIN</button></form>`, false, "");
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    onSubmit(gate, "#pinForm", async data => {
      await api(`/api/auth/profiles/${encodeURIComponent(profileId)}/pin`, { method: "PUT", body: JSON.stringify({ pin: data.get("pin") }) });
      showToast("PIN updated");
      showProfileMenu();
    });
  }

  // --- Character editor: looks for anyone you may edit; name, age and home
  // for residents created in the app (owner only). ---
  function showCharacterEditor(resident) {
    const isNew = !resident;
    const owner = me?.role === "owner";
    const editDetails = owner && (isNew || resident.custom);
    const look = isNew ? { ...NEW_LOOK } : lookFor(resident);
    const option = (value, current, label = value) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
    const currentHome = isNew ? "roseCottage" : homeOf(resident.id)?.id;
    const details = editDetails ? `<label>Name<input name="name" maxlength="20" required value="${escapeHtml(isNew ? "" : resident.name)}"></label>
      <label>Age<input name="age" type="number" min="3" max="95" required value="${escapeHtml(isNew ? 10 : resident.profile?.age ?? 30)}"></label>
      <label>Home<select name="homeId">${homeBuildings.map(b => option(b.id, currentHome, b.name)).join("")}</select></label>` : "";
    // Thumb-friendly picker: big live 3D preview, then rows of swatches and chips.
    const HAIR_COLORS = ["#1f1510", "#3b2416", "#5a3825", "#8a5a2b", "#c48a3f", "#e8c46a", "#b9452a", "#9a9a9a", "#eeeeee", "#7a4ad8", "#3a8ad8", "#e05a9a"];
    const CLOTHES = ["#e53935", "#fb8c00", "#fdd835", "#7cb342", "#26a69a", "#29b6f6", "#3949ab", "#8e24aa", "#ec407a", "#f1eee4", "#9e9e9e", "#3f4d79", "#212121", "#6d4c41"];
    const kidAge = Number(isNew ? 10 : resident.profile?.age ?? 30) < 13 || (!isNew && (resident.id === "hazel" || resident.id === "olive"));
    const chips = (name, values, current, label = v => LOOK_LABELS[v] || v) => `<input type="hidden" name="${name}" value="${escapeHtml(current)}"><div class="chip-row" data-for="${name}">${values.map(v => `<button type="button" class="chip${v === current ? " active" : ""}" data-v="${escapeHtml(v)}">${escapeHtml(label(v))}</button>`).join("")}</div>`;
    const swatchRow = (name, colors, current) => `<input type="hidden" name="${name}" value="${escapeHtml(current)}"><div class="swatch-row" data-for="${name}">${colors.map(c => `<button type="button" class="swatch${c.toLowerCase() === String(current).toLowerCase() ? " active" : ""}" data-v="${c}" style="background:${c}" aria-label="${name} colour"></button>`).join("")}</div>`;
    const title = isNew ? "New resident" : `Customize ${resident.name}`;
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Back</button><h3>${escapeHtml(title)}</h3>
      <div class="look-stage"><canvas id="lookAvatar" class="look-avatar" width="128" height="160"></canvas><canvas id="lookPreview" class="look-preview" width="16" height="24"></canvas>
        <div class="look-stage-buttons"><button type="button" id="spinLook" class="chip">↻ Turn</button><button type="button" id="worldLook" class="chip">🚀 Sci-fi</button></div></div>
      <form id="characterForm" class="creator-form">${details}
        ${kidAge ? '<input type="hidden" name="body" value="">' : `<p class="look-label">Body</p>${chips("body", ["masc", "fem"], look.body || (/long|pigtails|buns|bunny|ribbons|curls/.test(look.style) ? "fem" : "masc"), v => v === "masc" ? "💪 Man" : "👩 Woman")}`}
        <p class="look-label">Skin</p>${swatchRow("skin", SKIN_TONES, look.skin)}
        <p class="look-label">Hair</p>${chips("style", HAIR_STYLES, look.style)}
        <p class="look-label">Hair colour</p>${swatchRow("hair", HAIR_COLORS, look.hair)}
        <p class="look-label">Shirt</p>${swatchRow("shirt", CLOTHES, look.shirt)}
        <p class="look-label">Pants</p>${swatchRow("pants", CLOTHES, look.pants)}
        <p class="look-label">Shoes</p>${swatchRow("shoes", CLOTHES, look.shoes)}
        <p class="look-label">Extras</p>${chips("accessory", ACCESSORIES, look.accessory)}
        <button class="wide-button">${isNew ? "Welcome them to town" : "Save"}</button>
      </form>${editDetails && !isNew ? '<button id="moveAway" class="text-button danger">Move away from town</button>' : ""}`, false, "");
    const form = gate.querySelector("#characterForm");
    const preview = gate.querySelector("#lookPreview").getContext("2d");
    const avatarCtx = gate.querySelector("#lookAvatar").getContext("2d");
    let facing = 0, lookWorld = "clay";
    const lookFromForm = () => {
      const data = new FormData(form);
      const out = Object.fromEntries(["skin", "hair", "style", "accessory", "shirt", "pants", "shoes"].map(key => [key, data.get(key)]));
      if (data.get("body")) out.body = data.get("body");
      return out;
    };
    const drawAvatar = () => {
      const AV = window.LivingTownAvatar; if (!AV || !gate.isConnected) return;
      const l = lookFromForm(), sh = AV.sheet(lookWorld, kidAge ? "kid" : AV.bodyFor(l, 30), l);
      avatarCtx.clearRect(0, 0, 128, 160);
      if (!sh) return setTimeout(drawAvatar, 120);
      avatarCtx.drawImage(sh.canvas, 4 * sh.cw, facing * sh.ch, sh.cw, sh.ch, 0, 0, 128, 160);
    };
    const redraw = () => { preview.clearRect(0, 0, 16, 24); preview.drawImage(buildSprite(lookFromForm(), 0), 0, 0); drawAvatar(); };
    gate.querySelectorAll(".chip-row, .swatch-row").forEach(row => row.addEventListener("click", e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      form.elements[row.dataset.for].value = b.dataset.v;
      row.querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
      redraw();
    }));
    gate.querySelector("#spinLook").addEventListener("click", () => { facing = (facing + 1) % 8; drawAvatar(); });
    gate.querySelector("#worldLook").addEventListener("click", e => { lookWorld = lookWorld === "clay" ? "scifi" : "clay"; e.target.textContent = lookWorld === "clay" ? "🚀 Sci-fi" : "🤍 Clay"; drawAvatar(); });
    redraw();
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    gate.querySelector("#moveAway")?.addEventListener("click", async () => {
      if (!confirm(`Say goodbye to ${resident.name}? They'll move away from town.`)) return;
      try { await api(`/api/residents/${encodeURIComponent(resident.id)}`, { method: "DELETE" }); gate.remove(); showToast(`${resident.name} moved away`); }
      catch (error) { gate.querySelector("#gateError").textContent = error.message; }
    });
    onSubmit(gate, "#characterForm", async data => {
      const newLook = lookFromForm();
      if (isNew) {
        const created = await api("/api/residents", { method: "POST", body: JSON.stringify({ name: data.get("name"), age: Number(data.get("age")), homeId: data.get("homeId"), look: newLook }) });
        gate.remove();
        showToast(`${created.resident.name} moved in!`);
        setTimeout(() => select(created.resident.id), 300);
        return;
      }
      if (editDetails) {
        await api(`/api/residents/${encodeURIComponent(resident.id)}`, { method: "PUT", body: JSON.stringify({ name: data.get("name"), age: Number(data.get("age")), homeId: data.get("homeId") }) });
      }
      await api(`/api/residents/${encodeURIComponent(resident.id)}/look`, { method: "PUT", body: JSON.stringify({ look: newLook }) });
      gate.remove();
      showToast("Saved");
    });
  }

  function showCreator(status) {
    const claimed = new Set(status.profiles.map(profile => profile.residentId));
    const options = status.playable.filter(id => !claimed.has(id)).map(id => `<option value="${escapeHtml(id)}">${escapeHtml(residentName(id))}</option>`).join("");
    const gate = gateShell(`<button id="backMenu" class="back-button">‹ Profile</button><h3>Create player</h3><form id="creatorForm" class="creator-form"><label>Player name<input name="name" maxlength="24" required></label><label>Plays as<select name="residentId">${options}</select></label><label>PIN (4–6 digits)<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" type="password" autocomplete="new-password" required></label><button class="wide-button">Create player</button></form>`, false, "");
    gate.querySelector("#backMenu").addEventListener("click", showProfileMenu);
    onSubmit(gate, "#creatorForm", async data => {
      await api("/api/auth/profiles", { method: "POST", body: JSON.stringify({ name: data.get("name"), residentId: data.get("residentId"), pin: data.get("pin") }) });
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

  if (!VISITOR) $("#profileButton").addEventListener("click", showProfileMenu);
  else $(".zoom-hint").textContent = "Drag to explore · Pinch to zoom · Tap someone to check in";
  window.addEventListener("resize", applyCamera);
  camera.z = defaultZoom();
  centerOn(places.square.x, places.square.y - 20);
  if (!VISITOR) {
    initializePlayers().catch(error => showToast(error.message));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
  }
  connect();
  requestAnimationFrame(frame);
})();
