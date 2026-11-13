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

  window.LivingTownAvatar = { sheet, bodyFor, getIndex, DEFAULTS };
})();
