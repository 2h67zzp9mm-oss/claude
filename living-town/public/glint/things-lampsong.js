// Kindle's Grid: the Lamp Song (kind "lampsong"). A little crystal bell on a gold arm, hung from the Humming Lamp by the
// fountain (th.x/y = that lamp's tile). The Humming Lamp lets a small note drift up now and then on its own. When the
// bell rings (tap the bell or the Humming Lamp; also once a minute by itself) the hum travels outward: every lamp in
// town (lamp, waitlamp, cornerlamp, roadlamps/hedgelamps points) blooms and lets a note float up, in order of distance
// from the bell, then all of them glow together for one soft chord. On a tap it also plays the tune quietly (Web Audio,
// pentatonic sines; the audio context is unlocked on pointerup so iOS lets it play). Lamp head offsets per kind are
// approximations of each kind's geometry. `?pose=hum` holds the song mid-way. Stub `lampsong() {}` in things.js.
(() => {
  const TAU = Math.PI * 2;
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const POSE = new URLSearchParams(location.search).get("pose");
  const T = window.GLINT_THINGS = window.GLINT_THINGS || {};
  const O = window.GLINT_OVER = window.GLINT_OVER || {};
  const COLS = ["255,214,120", "120,225,255", "255,140,210", "190,150,255"];
  const STEP = 0.2, CHORD = 1.2, AUTO = 60;          // seconds per tile of distance, chord gap after the last lamp, auto period

  // where every lamp head is, in world units (approximate, per kind)
  function heads() {
    const out = [], W = window.GLINT_WORLD; if (!W) return out;
    for (const th of W.things) {
      if (th.kind === "lamp") out.push([th.x + 0.5, th.y - 0.39]);
      else if (th.kind === "waitlamp") out.push([th.x - 0.41, th.y - 1.3]);
      else if (th.kind === "tealamp") out.push([th.x - 0.26, th.y + 0.31, "110,245,225"]);
      else if (th.kind === "wishlamp") out.push([th.x + 0.08, th.y - 0.37, "160,150,255"]);
      else if (th.kind === "meadowlamp") out.push([th.x + 0.5, th.y]);
      else if (th.kind === "cornerlamp") out.push([th.x + 0.5, th.y - 0.4]);
      else if (th.kind === "hedgelamps") for (const [lx, ly] of th.lamps || []) out.push([lx + 0.18, ly - 0.58]);
      else if (th.kind === "roadlamps") (th.lamps || []).forEach(([lx, ly], i, a) => out.push([lx + (th.west ? -0.32 : 0.32), ly - (i === a.length - 1 ? 1.42 : 1.25)]));
    }
    return out;
  }

  // the tune (only after a tap, so the sound is always asked for)
  let ac = null;
  addEventListener("pointerup", () => {
    try { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { ac = null; }
  });
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
  function note(f, at, len, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
    o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + len + 0.05);
  }
  function playSong(list) {
    if (!ac || ac.state !== "running") return;
    const now = ac.currentTime + 0.05;
    list.forEach((l, i) => note(SCALE[i % SCALE.length], now + l.d, 0.9, 0.035));
    const end = now + (list.length ? list[list.length - 1].d : 0) + CHORD;
    [523.25, 659.25, 783.99, 1046.5].forEach(f => note(f, end, 2.6, 0.03));
  }

  function songOf(th, t, list) {   // seconds since the current song began (or a big number)
    const total = (list.length ? list[list.length - 1].d : 0) + CHORD + 2.5;
    if (POSE === "hum") return total * 0.45;
    const tapK = window.GLINT_WORLD.things.find(o => o.kind === "lamp" && o.name === "Humming Lamp");
    const last = Math.max(th.tapped ?? -99, tapK?.tapped ?? -99);
    if (last !== th._heard && last > -99) { th._heard = last; playSong(list); }
    if (t - last < total) return t - last;
    const a = t % AUTO; return a < total ? a : 99;
  }

  T.lampsong = function lampsong(ctx, x, y, s, t, th = {}) {   // the bell on its gold arm
    const b = y + s * 0.3, top = b - s * 1.05;
    const ring = th._ringK || 0;
    const ax = x + s * 0.03, ay = top + s * 0.32, hx = x + s * 0.36, hy = top + s * 0.22;
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = Math.max(1, s * 0.03); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(x + s * 0.2, top + s * 0.12, hx, hy); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, s * 0.012); ctx.beginPath(); ctx.moveTo(ax, ay + s * 0.06); ctx.quadraticCurveTo(x + s * 0.14, top + s * 0.3, x + s * 0.2, hy + s * 0.01); ctx.stroke();
    const sw = Math.sin(t * 9) * 0.35 * ring + Math.sin(t * 1.3) * 0.05;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(sw);
    const bw = s * 0.15, bh = s * 0.25;
    glow(ctx, 0, bh * 0.6, s * (0.25 + 0.3 * ring), "150,235,255", 0.25 + 0.5 * ring);
    ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(0, s * 0.012, s * 0.022, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-bw * 0.35, s * 0.03); ctx.quadraticCurveTo(-bw * 0.45, bh * 0.6, -bw, bh); ctx.lineTo(bw, bh); ctx.quadraticCurveTo(bw * 0.45, bh * 0.6, bw * 0.35, s * 0.03); ctx.closePath();
    ctx.fillStyle = "rgba(120,225,255,0.75)"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-bw * 0.1, s * 0.035); ctx.quadraticCurveTo(-bw * 0.2, bh * 0.6, -bw * 0.6, bh * 0.95); ctx.lineTo(-bw * 0.25, bh * 0.95); ctx.quadraticCurveTo(-bw * 0.05, bh * 0.6, bw * 0.08, s * 0.035); ctx.closePath();
    ctx.fillStyle = "rgba(230,250,255,0.85)"; ctx.fill();
    ctx.fillStyle = "#ffd166"; ctx.fillRect(-bw * 1.05, bh - s * 0.012, bw * 2.1, s * 0.025);
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(Math.sin(t * 9 + 1) * bw * 0.5 * ring, bh + s * 0.03, s * 0.022, 0, TAU); ctx.fill();
    ctx.restore();
  };

  function noteShape(ctx, nx, ny, r, rgb, a, two) {
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    glow(ctx, nx, ny, r * 3, rgb, 0.5 * a);
    ctx.fillStyle = `rgb(${rgb})`; ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = Math.max(1, r * 0.35);
    const heads = two ? [-r * 1.3, r * 1.3] : [0];
    for (const dx of heads) { ctx.beginPath(); ctx.ellipse(nx + dx, ny, r, r * 0.72, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(nx + dx + r * 0.85, ny); ctx.lineTo(nx + dx + r * 0.85, ny - r * 3.2); ctx.stroke(); }
    ctx.beginPath();
    if (two) { ctx.moveTo(nx - r * 0.45, ny - r * 3.2); ctx.lineTo(nx + r * 2.15, ny - r * 3.2); }
    else { ctx.moveTo(nx + r * 0.85, ny - r * 3.2); ctx.quadraticCurveTo(nx + r * 2.2, ny - r * 2.4, nx + r * 1.8, ny - r * 1.4); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  O.lampsong = function lampsongOver(ctx, X, Y, s, t, th) {
    const at = (wx, wy) => [X + (wx - th.x - 0.5) * s, Y + (wy - th.y - 0.5) * s];
    const bx = th.x + 0.5, by = th.y - 0.39;
    if (!th._list || th._n !== window.GLINT_WORLD.things.length) {
      th._n = window.GLINT_WORLD.things.length;
      th._list = heads().map(([hx, hy, rgb]) => ({ hx, hy, rgb, d: Math.hypot(hx - bx, hy - by) * STEP })).sort((a, b) => a.d - b.d);
    }
    const list = th._list, since = songOf(th, t, list), last = list.length ? list[list.length - 1].d : 0;
    window.GLINT_SONG = { since, bx, by, step: STEP };   // lamps that answer the song themselves (tealamp) read this
    th._ringK = since < 1.6 ? 1 - since / 1.6 : since > last + CHORD && since < last + CHORD + 1.2 ? 0.7 : 0;

    // the Humming Lamp hums on its own: a small note every few seconds
    { const p = (t % 4.5) / 4.5, [nx, ny] = at(bx - 0.1 + Math.sin(t * 2) * 0.08, by - 0.35 - p * 0.9);
      noteShape(ctx, nx, ny, s * 0.06, COLS[Math.floor(t / 4.5) % 4], Math.sin(p * Math.PI), false); }

    if (since > 90) return;
    const chord = since - last - CHORD;
    list.forEach((l, i) => {
      const [hx, hy] = at(l.hx, l.hy), rgb = l.rgb || COLS[i % 4], u = since - l.d;
      if (u > 0 && u < 2.2) {                 // this lamp's own note
        const k = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 1.95;
        glow(ctx, hx, hy, s * (0.5 + 0.35 * k), rgb, 0.55 * k);
        ctx.strokeStyle = `rgba(${rgb},${0.6 * (1 - u / 2.2)})`; ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.beginPath(); ctx.arc(hx, hy, s * (0.12 + u * 0.35), 0, TAU); ctx.stroke();
        noteShape(ctx, hx + Math.sin(u * 3 + i) * s * 0.12, hy - s * (0.25 + u * 0.45), s * 0.075, rgb, Math.min(1, k * 1.6), i % 3 === 1);
      }
      if (chord > 0 && chord < 2.5) {         // all together
        const k = Math.sin(Math.min(1, chord / 2.5) * Math.PI);
        glow(ctx, hx, hy, s * (0.7 + 0.2 * Math.sin(chord * 6)), "255,226,150", 0.45 * k);
      }
    });
    if (chord > 0 && chord < 2.5) {           // a ring of gold notes rises from the bell
      const k = Math.sin(Math.min(1, chord / 2.5) * Math.PI);
      for (let j = 0; j < 5; j++) { const a = j * TAU / 5 + chord * 0.6, [nx, ny] = at(bx + Math.cos(a) * (0.3 + chord * 0.25), by - 0.3 - chord * 0.35 + Math.sin(a) * 0.15);
        noteShape(ctx, nx, ny, s * 0.06, COLS[j % 4], k, j % 2 === 0); }
    }
  };
})();
