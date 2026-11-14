/* Paints 3D characters in any look. art/blender/walker_layers.py renders each body once in plain
 * white with a colour-region map (red skin, green shirt, blue pants, yellow shoes, magenta keep),
 * plus every hairstyle and extra on its own layer. Here we tint and stack them into one walk sheet
 * per look: 8 rows (S, SW, W, NW, N, NE, E, SE) x 5 columns (4 walk frames + standing). */
(function () {
  "use strict";
  const ROOT = "homestead/avatar/";
  const index = {}, images = {}, sheets = new Map();

  // The town's hairstyles drawn with the nearest 3D hairstyle.
  const HAIR = { short: "buzz", long: "long", pigtails: "pigtails", buns: "buns", curls: "curls", swoop: "short", bald: null,
    bunny: "ponytail", yarn: "curls", jester: "buzz", rook: "buzz", king: "buzz", ribbons: "long", robot: "buzz" };
  const DEFAULTS = { skin: "#f2c7a5", hair: "#4a2e1a", shirt: "#64b5f6", pants: "#3d4a66", shoes: "#3a2a1e", style: "short", accessory: "none" };

  function getIndex(world) {
    return index[world] ||= fetch(`${ROOT}${world}.json`, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  }
  function getImage(src) {
    return images[src] ||= new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  const HEXRE = /^#?[0-9a-f]{6}$/i;
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); const n = m ? parseInt(m[1], 16) : 0xcccccc; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

  /** Which body to use: kids get the child body; grown-ups pick man or woman (look.body). */
  function bodyFor(look, age) {
    if (Number(age) > 0 && Number(age) < 13) return "kid";
    if (look?.body === "fem") return "woman";
    if (look?.body === "masc") return "man";
    return /long|pigtails|buns|bunny|ribbons|curls/.test(look?.style || "") ? "woman" : "man";
  }

  /** A canvas walk sheet for this look, or null while it's still loading (then try again next frame). */
  function sheet(world, body, rawLook) {
    const look = { ...DEFAULTS, ...(rawLook || {}) };
    const key = [world, body, look.skin, look.hair, look.shirt, look.pants, look.shoes, look.style, look.accessory, look.outfit, look.outfitColor, look.wings, look.crown].join("|");
    const have = sheets.get(key);
    if (have !== undefined) return have;
    sheets.set(key, null);
    build(world, body, look).then(s => sheets.set(key, s)).catch(err => { console.error(err); sheets.delete(key); });
    return null;
  }

  async function build(world, body, look) {
    const idx = await getIndex(world); const b = idx?.bodies?.[body];
    if (!b) throw new Error(`no avatar for ${world}/${body}`);
    const dir = `${ROOT}${world}/${body}/`, v = `?v=${idx.version}`;
    const [base, mask] = await Promise.all([getImage(dir + "base.webp" + v), getImage(dir + "mask.png" + v)]);
    const W = base.width, H = base.height;
    const out = document.createElement("canvas"); out.width = W; out.height = H; const g = out.getContext("2d", { willReadFrequently: true });
    g.drawImage(base, 0, 0); const px = g.getImageData(0, 0, W, H);
    const mc = document.createElement("canvas"); mc.width = W; mc.height = H; const mg = mc.getContext("2d", { willReadFrequently: true });
    mg.drawImage(mask, 0, 0); const mp = mg.getImageData(0, 0, W, H).data;
    // under a gown or robe everything is the outfit's colour (long sleeves, nothing peeks through); armour is steel all over
    const oc = look.outfitColor || look.shirt;
    const shirt = look.outfit === "dress" || look.outfit === "witch" ? oc : look.outfit === "knight" ? "#b8bcc6" : look.shirt;
    const pants = look.outfit === "dress" || look.outfit === "witch" ? oc : look.outfit === "knight" ? "#9aa0ab" : look.pants;
    const col = { skin: hex(look.skin), shirt: hex(shirt), pants: hex(pants), shoes: hex(look.shoes) };
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = mp[i], gg = mp[i + 1], bb = mp[i + 2];
      let c = null;
      if (r > 127 && gg > 127 && bb < 128) c = col.shoes;
      else if (r > 127 && bb > 127) c = null;           // keep (eyes, visor, suit…)
      else if (r > 127) c = col.skin;
      else if (gg > 127) c = col.shirt;
      else if (bb > 127) c = col.pants;
      if (c) { d[i] = d[i] * c[0] / 225; d[i + 1] = d[i + 1] * c[1] / 225; d[i + 2] = d[i + 2] * c[2] / 225; }
    }
    g.putImageData(px, 0, 0);
    // hair, outfits and extras on top, each tinted. Wings go behind everything when you face us, on top when you face away.
    const layers = [];
    const hair = look.style === "bald" || look.outfit === "knight" ? null : (HAIR[look.style] || "buzz");
    if (hair) layers.push(["hair_" + hair, look.hair]);
    if (look.accessory === "glasses" && look.outfit !== "knight") layers.push(["acc_glasses", null]);
    if (look.accessory === "beard" && look.outfit !== "knight") layers.push(["acc_beard", look.hair]);
    if (!look.outfit && (["bow", "headband", "star"].includes(look.accessory) || look.style === "ribbons")) layers.push(["acc_bow", look.accessory === "star" ? "#ffd84a" : look.shirt]);
    if (look.outfit) layers.push(["out_" + look.outfit, look.outfit === "knight" ? null : (look.outfitColor || look.shirt)]);
    if (look.outfit === "dress") layers.push(["out_dresstrim", null]);   // white lace and gold sash
    if (look.crown && !["knight", "witch"].includes(look.outfit)) layers.push(["acc_tiara", null]);
    const paint = async (name, tint) => {
      if (!b.layers.includes(name)) return null;
      const img = await getImage(dir + name + ".webp" + v);
      if (!tint) return img;
      const t = document.createElement("canvas"); t.width = W; t.height = H; const tg = t.getContext("2d");
      tg.drawImage(img, 0, 0); tg.globalCompositeOperation = "multiply"; tg.fillStyle = tint; tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = "destination-in"; tg.drawImage(img, 0, 0);
      return t;
    };
    const wings = HEXRE.test(look.wings || "") ? await paint("out_wings", look.wings) : null;
    const rows = (img, keep) => { const rh = H / 8; for (let r = 0; r < 8; r++) if (keep(r)) g.drawImage(img, 0, r * rh, W, rh, 0, r * rh, W, rh); };
    const away = r => r >= 3 && r <= 5;   // NW, N, NE
    if (wings) rows(wings, r => !away(r));
    for (const [name, tint] of layers) { const img = await paint(name, tint); if (img) g.drawImage(img, 0, 0); }
    if (wings) rows(wings, away);
    return { canvas: out, cw: idx.cw, ch: idx.ch, ax: b.ax, ay: b.ay };
  }

  // --- Pirate Cove ink look ---
  // The pirate world is a moonlit night drawn with dark ink lines, so people and pets get redrawn to match while they're there.
  // Hazel picks the look. Switch it here (or try one on a phone with ?pirateLook=A):
  //   "A" ink outline only   "B" ink outline + inside lines + moonlight   "C" like B, plus a pirate hat
  const PIRATE_LOOK = "B";
  const INK = [16, 16, 34];   // the world's ink colour
  const inked = new WeakMap();
  function pirateLook() { try { const q = new URLSearchParams(location.search).get("pirateLook"); if (/^[ABC]$/.test(q || "")) return q; } catch { /* no URL */ } return PIRATE_LOOK; }
  /** The same walk sheet redrawn in the pirate ink style. Made once per sheet and kept. hat: false for pets. */
  function ink(sh, style = pirateLook(), hat = true) {
    if (!sh) return null;
    let m = inked.get(sh); if (!m) inked.set(sh, m = {});
    const key = style + (hat ? "h" : "");
    return m[key] ||= restyle(sh, style, hat && style === "C");
  }
  function restyle(sh, style, hat) {
    const W = sh.canvas.width, H = sh.canvas.height, cw = sh.cw, ch = sh.ch;
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const g = out.getContext("2d", { willReadFrequently: true }); g.drawImage(sh.canvas, 0, 0);
    let px = g.getImageData(0, 0, W, H), d = px.data;
    if (style !== "A") {
      // moonlight: cooler, a touch darker, shadows lean blue-violet like the world; then thin ink lines where colours meet
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2], dark = 1 - (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        d[i] = Math.min(255, r * 0.84 + 4 - dark * 14);
        d[i + 1] = Math.min(255, gg * 0.86 + 6 - dark * 10);
        d[i + 2] = Math.min(255, b * 0.88 + 26 + dark * 4);
      }
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
        const i = (y * W + x) * 4; if (src[i + 3] < 200) continue;
        for (const j of [i + 4, i + W * 4]) {
          if (src[j + 3] < 200) continue;
          const diff = Math.abs(src[i] - src[j]) + Math.abs(src[i + 1] - src[j + 1]) + Math.abs(src[i + 2] - src[j + 2]);
          if (diff > 150) {
            const k = (src[i] + src[i + 1] + src[i + 2]) <= (src[j] + src[j + 1] + src[j + 2]) ? i : j, a = Math.min(0.65, (diff - 150) / 120 + 0.3);
            d[k] = d[k] * (1 - a) + INK[0] * a; d[k + 1] = d[k + 1] * (1 - a) + INK[1] * a; d[k + 2] = d[k + 2] * (1 - a) + INK[2] * a;
          }
        }
      }
      g.putImageData(px, 0, 0);
    }
    if (hat) { for (let r = 0; r < H / ch; r++) for (let c = 0; c < W / cw; c++) tricorn(g, d, W, c * cw, r * ch, cw, ch); px = g.getImageData(0, 0, W, H); d = px.data; }
    // the ink outline all the way round, kept inside each frame
    const a0 = new Uint8ClampedArray(W * H); for (let i = 0; i < a0.length; i++) a0[i] = d[i * 4 + 3];
    const R = 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, sa = a0[p]; if (sa >= 250) continue;
      const fx = x - x % cw, fy = y - y % ch; let m = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy; if (yy < fy || yy >= fy + ch) continue;
        for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx < fx || xx >= fx + cw || dx * dx + dy * dy > R * R + 1) continue; const v = a0[yy * W + xx]; if (v > m) m = v; }
      }
      if (m <= sa) continue;
      const s = sa / 255, k = m / 255 * (1 - s), oa = s + k, i = p * 4;
      d[i] = (d[i] * s + INK[0] * k) / oa; d[i + 1] = (d[i + 1] * s + INK[1] * k) / oa; d[i + 2] = (d[i + 2] * s + INK[2] * k) / oa; d[i + 3] = oa * 255;
    }
    g.putImageData(px, 0, 0);
    return { ...sh, canvas: out };
  }
  // A little cartoon tricorn hat on top of the head in every frame (found by looking for the top of the sprite).
  function tricorn(g, d, W, x0, y0, cw, ch) {
    let top = -1;
    for (let y = y0; y < y0 + ch && top < 0; y++) for (let x = x0; x < x0 + cw; x++) if (d[(y * W + x) * 4 + 3] > 128) { top = y; break; }
    if (top < 0) return;
    const row = top + 10; let lo = x0 + cw, hi = x0;
    for (let x = x0; x < x0 + cw; x++) if (d[(row * W + x) * 4 + 3] > 128) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    if (hi <= lo) return;
    const cx = (lo + hi) / 2, hw = Math.max(7, Math.min(16, (hi - lo) / 2)) * 1.3, by = top + hw * 0.5;
    g.save(); g.lineJoin = "round";
    g.fillStyle = "#3a2f4a";   // crown
    g.beginPath(); g.moveTo(cx - hw * 0.62, by); g.quadraticCurveTo(cx - hw * 0.6, top - hw * 0.3, cx, top - hw * 0.3); g.quadraticCurveTo(cx + hw * 0.6, top - hw * 0.3, cx + hw * 0.62, by); g.closePath(); g.fill();
    g.fillStyle = "#2a2238";   // brim, turned up at both sides with a point in front
    g.beginPath(); g.moveTo(cx - hw * 1.1, by - hw * 0.55); g.quadraticCurveTo(cx - hw * 0.7, by + hw * 0.1, cx, by + hw * 0.22);
    g.quadraticCurveTo(cx + hw * 0.7, by + hw * 0.1, cx + hw * 1.1, by - hw * 0.55); g.quadraticCurveTo(cx + hw * 0.6, by - hw * 0.05, cx, by - hw * 0.12);
    g.quadraticCurveTo(cx - hw * 0.6, by - hw * 0.05, cx - hw * 1.1, by - hw * 0.55); g.closePath(); g.fill();
    g.strokeStyle = "#e0b64a"; g.lineWidth = 1.5;   // gold trim
    g.beginPath(); g.moveTo(cx - hw * 1.0, by - hw * 0.45); g.quadraticCurveTo(cx - hw * 0.6, by + hw * 0.05, cx, by + hw * 0.14); g.quadraticCurveTo(cx + hw * 0.6, by + hw * 0.05, cx + hw * 1.0, by - hw * 0.45); g.stroke();
    g.restore();
  }

  window.LivingTownAvatar = { sheet, bodyFor, getIndex, DEFAULTS, ink, PIRATE_LOOK };
})();
