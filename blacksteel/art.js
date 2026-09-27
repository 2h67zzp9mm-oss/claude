/* The Blacksteel Pirates: painted scenes and animated effects.
 *
 * Each scene has three layers:
 *   bg  - a heavy, static painting (textures, filters). Rasterized once as an <img>.
 *   ov  - a light inline SVG on top: things that change with the story, and the hotspots.
 *   fx  - two canvases animated every frame: N (normal paint) under the overlay,
 *         L (screen blend, i.e. light) over everything.
 */
(function () {
  "use strict";

  // ---------- helpers ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgb = (r, g, b) => `rgb(${Math.round(clamp(r, 0, 255))},${Math.round(clamp(g, 0, 255))},${Math.round(clamp(b, 0, 255))})`;
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return rgb(r, g, b);
  }
  const TAU = Math.PI * 2;

  // ---------- shared paint: filters and gradients ----------
  const DEFS = `<defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.8 0 0 0 -.62"/></filter>
    <filter id="woodH" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".005 .17" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .07  0 0 0 0 .04  0 0 0 0 .02  2.4 0 0 0 -1.02"/></filter>
    <filter id="woodV" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".17 .005" numOctaves="3" seed="8"/><feColorMatrix values="0 0 0 0 .07  0 0 0 0 .04  0 0 0 0 .02  2.4 0 0 0 -1.02"/></filter>
    <filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".014" numOctaves="4" seed="12"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  1.6 0 0 0 -.62"/></filter>
    <filter id="mottleLight" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="4" seed="15"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .88  1.6 0 0 0 -.7"/></filter>
    <filter id="wob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="3.5" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="3"/><feDisplacementMap in="SourceGraphic" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="char" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="31"/><feDisplacementMap in="SourceGraphic" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="cloud" x="-40%" y="-80%" width="180%" height="260%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="21"/><feDisplacementMap in="SourceGraphic" scale="70" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="b2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="b5" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="b12" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="b30" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30"/></filter>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5e421c"/><stop offset=".28" stop-color="#d9b76b"/><stop offset=".5" stop-color="#8f6a32"/><stop offset=".74" stop-color="#ecd28c"/><stop offset="1" stop-color="#6b4c22"/></linearGradient>
    <linearGradient id="brassV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d690"/><stop offset=".35" stop-color="#b08a48"/><stop offset="1" stop-color="#5a3f1a"/></linearGradient>
    <linearGradient id="iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5f66"/><stop offset=".5" stop-color="#2b2e33"/><stop offset="1" stop-color="#15171a"/></linearGradient>
    <linearGradient id="ribG" x1="0" x2="1"><stop offset="0" stop-color="#1e140c"/><stop offset=".45" stop-color="#6d4b2e"/><stop offset=".6" stop-color="#5a3d25"/><stop offset="1" stop-color="#20150c"/></linearGradient>
    <linearGradient id="shadeR" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="shadeDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="parch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe1bd"/><stop offset=".6" stop-color="#dcc79a"/><stop offset="1" stop-color="#c2a877"/></linearGradient>
    <radialGradient id="vig" cx="400" cy="250" r="520" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
    <radialGradient id="vigSoft" cx="400" cy="240" r="560" gradientUnits="userSpaceOnUse"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1606" stop-opacity=".45"/></radialGradient>
  </defs>`;

  const wrap = (inner, extraDefs = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480" preserveAspectRatio="xMidYMid slice">${DEFS}${extraDefs}${inner}</svg>`;
  const grainAll = (o = .3) => `<rect width="800" height="480" filter="url(#grain)" opacity="${o}"/>`;
  const nail = (x, y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="#120b06"/><circle cx="${x - .5}" cy="${y - .6}" r=".7" fill="#b89a74" opacity=".45"/>`;

  // A painted bell with no clapper, as on every Bellgrave threshold.
  function bell(x, y, s, c) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-9 10 C-9 -2 -6 -9 0 -10 C6 -9 9 -2 9 10 Z" fill="${c}"/>
      <path d="M-5 8 C-5 -1 -3 -6 0 -7" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" fill="none"/>
      <rect x="-11" y="9.5" width="22" height="3" rx="1.5" fill="${shade(c, -.25)}"/>
      <circle cx="0" cy="-11" r="1.8" fill="${shade(c, -.25)}"/>
    </g>`;
  }

  // Lily's doll: faded yellow dress, one brown button eye and one blue, three rows of black thread on the left arm.
  function doll(x, y, s, rot = 0) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <ellipse cx="2" cy="44" rx="26" ry="5" fill="#000" opacity=".25" filter="url(#b2)"/>
      <path d="M-16 6 Q0 -2 16 6 L22 40 Q0 48 -22 40 Z" fill="#cdb77a"/>
      <path d="M-16 6 Q0 -2 16 6 L22 40 Q0 48 -22 40 Z" fill="#8a7440" opacity=".25" filter="url(#grain)"/>
      <path d="M-20 38 Q0 46 20 38" stroke="#a8925a" stroke-width="2" fill="none"/>
      <path d="M-6 8 L-9 38 M6 8 L9 38" stroke="#b9a266" stroke-width="1.2"/>
      <path d="M-15 9 Q-24 18 -27 28" stroke="#e7d4b3" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M-18 14 l4 2 M-21 18 l4 2 M-23 22 l4 2" stroke="#111" stroke-width="1.2"/>
      <path d="M15 9 Q23 18 26 28" stroke="#e7d4b3" stroke-width="6" stroke-linecap="round" fill="none"/>
      <circle cx="0" cy="-6" r="12.5" fill="#ead8b8"/>
      <path d="M-12 -9 Q0 -24 12 -9 Q8 -16 0 -17 Q-8 -16 -12 -9z" fill="#8a5a32"/>
      <circle cx="-4.5" cy="-6" r="2.6" fill="#6b4524"/><circle cx="-5" cy="-6.6" r=".8" fill="#fff" opacity=".6"/>
      <circle cx="4.5" cy="-6" r="2.6" fill="#3f6fa0"/><circle cx="4" cy="-6.6" r=".8" fill="#fff" opacity=".6"/>
      <path d="M-3 0 Q0 2 3 0" stroke="#9a5a4a" stroke-width="1.1" fill="none"/>
    </g>`;
  }

  // ===================================================================
  // TITLE: the open sea at night, Sean's little frigate on the horizon
  // ===================================================================
  function titleBG() {
    const r = rng(3);
    let stars = "";
    for (let i = 0; i < 140; i++) {
      const x = r() * 800, y = r() * 230, s = r() * 1.2 + .2;
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="#f4ecd6" opacity="${(.3 + r() * .6).toFixed(2)}"/>`;
    }
    return wrap(`
      <rect width="800" height="480" fill="url(#skyN)"/>
      ${stars}
      <circle cx="590" cy="120" r="80" fill="#f2e8c6" opacity=".25" filter="url(#b30)"/>
      <circle cx="590" cy="120" r="30" fill="#f6efd8"/>
      <circle cx="580" cy="112" r="6" fill="#d9ceb0" opacity=".6"/><circle cx="600" cy="130" r="4" fill="#d9ceb0" opacity=".5"/>
      <g filter="url(#cloud)" opacity=".85">
        <ellipse cx="200" cy="170" rx="220" ry="16" fill="#233246"/>
        <ellipse cx="660" cy="200" rx="200" ry="12" fill="#2a3a50"/>
        <ellipse cx="420" cy="80" rx="160" ry="10" fill="#1b2839"/>
      </g>
      <rect y="262" width="800" height="218" fill="url(#seaN)"/>
      <rect y="262" width="800" height="3" fill="#8fb0c9" opacity=".25"/>
      <rect y="262" width="800" height="218" filter="url(#woodH)" opacity=".5"/>
      <rect width="800" height="480" fill="url(#vig)"/>
      ${grainAll(.25)}
    `, `<linearGradient id="skyN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a14"/><stop offset=".7" stop-color="#132338"/><stop offset="1" stop-color="#27425c"/></linearGradient>
        <linearGradient id="seaN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3550"/><stop offset=".4" stop-color="#0f2033"/><stop offset="1" stop-color="#050b13"/></linearGradient>`);
  }
  function titleFX(t, dt, L, N, env, st) {
    // moon path on the water
    for (let i = 0; i < 70; i++) {
      const y = 268 + i * 3;
      const w = 6 + i * 1.6;
      const x = 590 + Math.sin(t * 1.3 + i * .9) * (4 + i * .5);
      const a = (.5 - i / 160) * (.55 + .45 * Math.sin(t * 2 + i * 1.7));
      if (a <= 0) continue;
      L.fillStyle = `rgba(240,228,190,${a.toFixed(3)})`;
      L.fillRect(x - w / 2, y, w, 1.4);
    }
    // wave lines
    L.lineWidth = 1;
    for (let row = 0; row < 16; row++) {
      const y = 272 + row * row * .8 + row * 6;
      L.strokeStyle = `rgba(120,160,195,${(.05 + row * .006).toFixed(3)})`;
      L.beginPath();
      for (let x = 0; x <= 800; x += 10) {
        const yy = y + Math.sin(x * .03 + t * (0.6 + row * .05) + row) * (1 + row * .25);
        x ? L.lineTo(x, yy) : L.moveTo(x, yy);
      }
      L.stroke();
    }
    // twinkles
    for (const s of st.tw) {
      const a = Math.max(0, Math.sin(t * s.f + s.p)) ** 6;
      L.fillStyle = `rgba(255,248,225,${(a * .9).toFixed(3)})`;
      L.fillRect(s.x - .8, s.y - .8, 1.6, 1.6);
    }
    // the little frigate, rocking
    const rock = Math.sin(t * 1.1) * .06, bob = Math.sin(t * 1.1 + .6) * 2;
    N.save();
    N.translate(250, 262 + bob);
    N.rotate(rock);
    N.fillStyle = "#070b10";
    N.beginPath(); N.moveTo(-34, -6); N.lineTo(36, -6); N.lineTo(28, 5); N.lineTo(-28, 5); N.closePath(); N.fill();
    N.fillRect(-1.5, -62, 3, 58);
    N.beginPath(); N.moveTo(2, -58); N.quadraticCurveTo(26, -34, 3, -10); N.closePath(); N.fill();
    N.beginPath(); N.moveTo(-2, -54); N.quadraticCurveTo(-22, -34, -2, -14); N.closePath(); N.fill();
    N.beginPath(); N.moveTo(0, -62); N.lineTo(34, -8); N.strokeStyle = "#070b10"; N.lineWidth = 1; N.stroke();
    N.fillStyle = `rgba(242,180,90,${(.7 + .3 * Math.sin(t * 7)).toFixed(2)})`;
    N.fillRect(-20, -3, 2.5, 2.5);
    N.restore();
  }

  // ===================================================================
  // FRAME: Shannon's archive at night, rain on the window
  // ===================================================================
  const archiveArch = "M320 250 V110 Q400 20 480 110 V250 Z";
  function frameBG() {
    const r = rng(9);
    let stones = "";
    for (let y = 0; y < 300; y += 26) {
      let x = (y / 26) % 2 ? -30 : 0;
      while (x < 800) {
        const w = 50 + r() * 30, k = .8 + r() * .3;
        stones += `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="24" rx="2" fill="${rgb(46 * k, 44 * k, 42 * k)}"/>`;
        x += w;
      }
    }
    const pal = ["#5b2b25", "#2f4a3f", "#6b5433", "#2c3a52", "#4a2a3f", "#6f4b2a", "#39432a", "#1f2f3a"];
    function shelf(x0, x1) {
      let s = `<rect x="${x0}" y="20" width="${x1 - x0}" height="290" fill="#1a120c"/>`;
      for (const y of [98, 188, 278]) {
        let x = x0 + 8;
        while (x < x1 - 14) {
          const w = 9 + r() * 12, h = 50 + r() * 22, c = pal[(r() * pal.length) | 0];
          if (r() < .1) { x += 6; continue; }
          const lean = r() < .08 ? (r() - .5) * 14 : 0;
          s += `<g transform="rotate(${lean.toFixed(1)} ${x + w / 2} ${y})">
            <rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${c}"/>
            <rect x="${x}" y="${y - h}" width="${w * .35}" height="${h}" fill="#fff" opacity=".07"/>
            <rect x="${x}" y="${y - h + 8}" width="${w}" height="2" fill="#c9a45c" opacity=".7"/>
            <rect x="${x}" y="${y - 12}" width="${w}" height="2" fill="#c9a45c" opacity=".55"/>
          </g>`;
          x += w + .8;
        }
        s += `<rect x="${x0 - 4}" y="${y}" width="${x1 - x0 + 8}" height="10" fill="url(#shelfG)"/>`;
        s += `<rect x="${x0 - 4}" y="${y + 10}" width="${x1 - x0 + 8}" height="10" fill="url(#shadeDown)"/>`;
      }
      s += `<rect x="${x0 - 8}" y="16" width="12" height="300" fill="url(#ribG)"/><rect x="${x1 - 4}" y="16" width="12" height="300" fill="url(#ribG)"/>`;
      return s;
    }
    // scroll cubbies under the right shelf
    let scrolls = "";
    for (let i = 0; i < 9; i++) {
      const cx = 590 + (i % 5) * 36 + (i > 4 ? 18 : 0), cy = 224 + (i > 4 ? 30 : 0);
      scrolls += `<circle cx="${cx}" cy="${cy}" r="11" fill="#d7c49b"/><circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="#9c8558" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="#6b5433"/>`;
    }
    let ledger = "";
    for (let i = 0; i < 9; i++) {
      ledger += `<path d="M${578 + (i % 2) * 2} ${352 + i * 7} h${50 + r() * 22}" stroke="#5a4630" stroke-width="1" opacity=".7"/>`;
      ledger += `<path d="M${664} ${350 + i * 7} h${40 + r() * 26}" stroke="#5a4630" stroke-width="1" opacity=".7"/>`;
    }
    return wrap(`
      <rect width="800" height="480" fill="#1b1a19"/>
      ${stones}
      <rect width="800" height="310" filter="url(#mottle)" opacity=".5"/>
      <!-- arched window -->
      <path d="${archiveArch}" fill="#0c1826"/>
      <path d="M332 250 V114 Q400 34 468 114 V250" fill="url(#winSky)"/>
      <circle cx="430" cy="95" r="16" fill="#cfd9e0" opacity=".25" filter="url(#b12)"/>
      <path d="${archiveArch}" fill="none" stroke="#3a2c20" stroke-width="12"/>
      <path d="M400 38 V250 M326 160 H474" stroke="#3a2c20" stroke-width="6"/>
      <rect x="310" y="248" width="180" height="12" fill="#4a3826"/>
      ${shelf(24, 258)}
      ${shelf(546, 780)}
      <rect x="560" y="200" width="206" height="68" fill="#1a120c"/>
      ${scrolls}
      <!-- ladder -->
      <g transform="rotate(-11 520 300)">
        <rect x="508" y="40" width="6" height="270" fill="#5a3d25"/><rect x="540" y="40" width="6" height="270" fill="#5a3d25"/>
        ${[70, 110, 150, 190, 230, 270].map(y => `<rect x="508" y="${y}" width="38" height="5" fill="#6d4b2e"/>`).join("")}
      </g>
      <!-- desk -->
      <path d="M0 322 H800 V480 H0 Z" fill="url(#deskG)"/>
      <rect y="322" width="800" height="158" filter="url(#woodH)" opacity=".8"/>
      <rect y="318" width="800" height="6" fill="#8a6440"/>
      <!-- book stack -->
      <g>
        <ellipse cx="112" cy="400" rx="100" ry="10" fill="#000" opacity=".45" filter="url(#b5)"/>
        <rect x="28" y="370" width="170" height="28" rx="3" fill="#5b2b25"/><rect x="32" y="373" width="162" height="22" fill="#e6d7b3"/><rect x="28" y="370" width="10" height="28" fill="#4a211c"/>
        <rect x="40" y="342" width="148" height="28" rx="3" fill="#2f4a3f"/><rect x="44" y="345" width="140" height="22" fill="#ddcca6"/><rect x="40" y="342" width="10" height="28" fill="#233a31"/>
        <rect x="52" y="318" width="126" height="24" rx="3" fill="#6b5433"/><rect x="56" y="321" width="118" height="18" fill="#e2d2ae"/><rect x="52" y="318" width="10" height="24" fill="#554227"/>
        <rect x="62" y="326" width="2" height="10" fill="#c9a45c"/><rect x="50" y="350" width="2" height="12" fill="#c9a45c"/>
      </g>
      <!-- oil lamp -->
      <g>
        <ellipse cx="236" cy="404" rx="46" ry="8" fill="#000" opacity=".5" filter="url(#b5)"/>
        <path d="M206 404 Q236 390 266 404 Z" fill="url(#brassV)"/>
        <path d="M222 396 Q236 360 250 396 Z" fill="url(#brass)"/>
        <rect x="224" y="358" width="24" height="8" rx="2" fill="url(#brass)"/>
        <path d="M226 358 Q222 330 230 300 H242 Q250 330 246 358 Z" fill="#f6dca0" opacity=".35"/>
        <path d="M226 358 Q222 330 230 300 H242 Q250 330 246 358 Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>
        <rect x="228" y="296" width="16" height="5" rx="2" fill="url(#brass)"/>
      </g>
      <!-- ledger, inkwell, quill -->
      <g>
        <ellipse cx="660" cy="424" rx="120" ry="10" fill="#000" opacity=".45" filter="url(#b5)"/>
        <path d="M566 344 L656 338 L660 420 L570 424 Z" fill="#e8dcbc"/>
        <path d="M660 338 L752 346 L748 424 L660 420 Z" fill="#dfd1ae"/>
        <path d="M656 338 Q658 380 660 420" stroke="#9c8558" stroke-width="2" fill="none"/>
        ${ledger}
        <path d="M740 350 q30 -40 60 -60" stroke="#e9e1d0" stroke-width="3" fill="none"/>
        <path d="M770 316 q14 -20 32 -30 q-8 16 -26 34z" fill="#e9e1d0" opacity=".8"/>
        <rect x="732" y="356" width="26" height="22" rx="4" fill="#1c2430"/><rect x="738" y="350" width="14" height="8" fill="#2a3444"/>
      </g>
      <!-- magnifier -->
      <g transform="rotate(20 520 430)">
        <circle cx="520" cy="430" r="18" fill="#9fb8c4" opacity=".2" stroke="url(#brass)" stroke-width="4"/>
        <rect x="536" y="428" width="40" height="6" rx="3" fill="#3b2a1c"/>
      </g>
      <!-- the burned map fragment Olive and Hazel found -->
      <g transform="rotate(-3 400 372)">
        <ellipse cx="404" cy="414" rx="130" ry="10" fill="#000" opacity=".5" filter="url(#b5)"/>
        <g filter="url(#char)">
          <path d="M288 332 L520 326 L528 412 L292 418 Z" fill="#241609"/>
          <path d="M294 338 L514 332 L520 406 L298 411 Z" fill="url(#parch)"/>
        </g>
        <path d="M312 390 q20 -12 36 -4 q14 8 30 -2 M456 356 q14 -8 26 2 q6 10 20 6" stroke="#8a6c44" stroke-width="1.4" fill="none" opacity=".8"/>
        <path d="M300 344 L512 340" stroke="#8a6c44" stroke-width=".6" opacity=".4"/>
        <circle cx="486" cy="394" r="9" fill="none" stroke="#8a6c44" stroke-width=".8" opacity=".6"/>
        <path d="M486 382 v24 M474 394 h24" stroke="#8a6c44" stroke-width=".6" opacity=".6"/>
      </g>
      <rect width="800" height="480" fill="url(#vig)"/>
      ${grainAll(.3)}
    `, `<linearGradient id="winSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a2c"/><stop offset="1" stop-color="#1c3148"/></linearGradient>
        <linearGradient id="shelfG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5636"/><stop offset="1" stop-color="#3a2717"/></linearGradient>
        <linearGradient id="deskG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a2d"/><stop offset=".5" stop-color="#4a321e"/><stop offset="1" stop-color="#23170d"/></linearGradient>`);
  }
  function frameOV() {
    return `<g transform="rotate(-3 400 372)">
      <text x="408" y="378" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="17" fill="#3e2a17" textLength="196" lengthAdjust="spacingAndGlyphs">BELLGRAVE WAS NOT THE FIRST</text>
    </g>`;
  }
  function frameFX(t, dt, L, N, env, st) {
    const fl = .82 + .1 * Math.sin(t * 11) + .06 * Math.sin(t * 23 + 1.3) + .04 * Math.sin(t * 37);
    // lamp light
    let g = L.createRadialGradient(236, 320, 6, 236, 320, 520);
    g.addColorStop(0, `rgba(255,190,100,${(.55 * fl).toFixed(3)})`);
    g.addColorStop(.25, `rgba(210,130,50,${(.22 * fl).toFixed(3)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    L.fillStyle = g; L.fillRect(0, 0, 800, 480);
    // flame
    const fh = 16 + 3 * Math.sin(t * 17);
    g = L.createRadialGradient(236, 340, 1, 236, 340, 26);
    g.addColorStop(0, "rgba(255,245,210,.95)"); g.addColorStop(.4, "rgba(255,180,80,.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
    L.fillStyle = g; L.beginPath(); L.ellipse(236, 342 - fh / 2, 7, fh, 0, 0, TAU); L.fill();
    L.fillRect(210, 310, 52, 60);
    // rain on the window
    L.save();
    L.beginPath(); L.moveTo(332, 250); L.lineTo(332, 114); L.quadraticCurveTo(400, 34, 468, 114); L.lineTo(468, 250); L.closePath(); L.clip();
    L.strokeStyle = "rgba(170,200,225,.35)"; L.lineWidth = 1;
    for (const d of st.rain) {
      d.y += d.v * dt; if (d.y > 260) { d.y = 30; d.x = 330 + Math.random() * 140; }
      L.beginPath(); L.moveTo(d.x, d.y); L.lineTo(d.x - 2, d.y + 12); L.stroke();
    }
    for (const b of st.beads) {
      b.y += b.v * dt; if (b.y > 256) { b.y = 40 + Math.random() * 60; b.x = 336 + Math.random() * 128; b.v = 4 + Math.random() * 18; }
      L.fillStyle = "rgba(200,220,240,.35)"; L.beginPath(); L.arc(b.x, b.y, 1.6, 0, TAU); L.fill();
    }
    L.restore();
    // ember glow along the burned edge of the map
    for (const e of st.embers) {
      const a = Math.max(0, Math.sin(t * e.f + e.p)) ** 3 * .8;
      L.fillStyle = `rgba(255,120,40,${a.toFixed(3)})`;
      L.beginPath(); L.arc(e.x, e.y, 1.6, 0, TAU); L.fill();
    }
    motes(L, st.motes, dt, t, 236, 330, 300, .5);
  }

  // Dust drifting through lamplight or sunbeams.
  function makeMotes(r, n, x, y, w, h) {
    return Array.from({ length: n }, () => ({ x: x + r() * w, y: y + r() * h, vx: (r() - .5) * 5, vy: -1 - r() * 3, s: .5 + r() * 1.3, p: r() * TAU, box: [x, y, w, h] }));
  }
  function motes(L, list, dt, t, lx, ly, rad, strength, color = "255,236,200") {
    for (const m of list) {
      m.x += (m.vx + Math.sin(t * .7 + m.p) * 3) * dt;
      m.y += m.vy * dt;
      const [bx, by, bw, bh] = m.box;
      if (m.y < by) m.y = by + bh;
      if (m.x < bx) m.x = bx + bw; if (m.x > bx + bw) m.x = bx;
      const d = lx == null ? 0 : Math.hypot(m.x - lx, m.y - ly) / rad;
      const a = strength * clamp(1 - d, 0, 1) * (.5 + .5 * Math.sin(t * 1.3 + m.p));
      if (a < .01) continue;
      L.fillStyle = `rgba(${color},${a.toFixed(3)})`;
      L.beginPath(); L.arc(m.x, m.y, m.s, 0, TAU); L.fill();
    }
  }

  // ===================================================================
  // LILY'S ROOM: morning sun through patched shutters
  // ===================================================================
  function lilyBG() {
    const r = rng(21);
    const quilt = [];
    const qc = ["#c8594a", "#e3b857", "#6d93b8", "#8fb070", "#e8dcc2", "#b27aa7", "#d9885a"];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
      const x = 300 + i * 32, y = 322 + j * 26;
      quilt.push(`<rect x="${x}" y="${y}" width="32" height="26" fill="${qc[(i * 3 + j * 5 + 1) % qc.length]}"/>`);
    }
    let boards = "";
    for (let xb = -600; xb <= 1400; xb += 60) {
      const x1 = 400 + (xb - 400) * (404 - 150) / (480 - 150);
      boards += `<line x1="${x1.toFixed(1)}" y1="404" x2="${xb}" y2="480" stroke="#6b4a2e" stroke-width="1.6"/>`;
    }
    let flowers = "";
    for (let i = 0; i < 16; i++) {
      const x = 76 + r() * 150, y = 268 + r() * 10;
      flowers += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + r() * 3).toFixed(1)}" fill="${r() < .5 ? "#8b4fa3" : "#a86cc0"}"/>`;
    }
    const leaves = Array.from({ length: 12 }, () => `<ellipse cx="${(80 + r() * 146).toFixed(1)}" cy="${(276 + r() * 6).toFixed(1)}" rx="6" ry="2.6" fill="#5c7f45" transform="rotate(${(r() * 60 - 30).toFixed(0)} ${(80 + r() * 146).toFixed(1)} 278)"/>`).join("");
    return wrap(`
      <rect width="800" height="480" fill="url(#plaster)"/>
      <rect width="800" height="480" filter="url(#mottle)" opacity=".35"/>
      <path d="M520 120 l14 22 l-6 18 l10 26 M610 80 l-8 30 l12 16" stroke="#b08a58" stroke-width="1.2" fill="none" opacity=".6"/>
      <!-- ceiling beam with painted bells -->
      <rect width="800" height="54" fill="url(#beamG)"/>
      <rect width="800" height="54" filter="url(#woodH)"/>
      <rect y="54" width="800" height="16" fill="url(#shadeDown)" opacity=".6"/>
      <path d="M0 40 Q40 30 80 40 T160 40 T240 40 T320 40 T400 40 T480 40 T560 40 T640 40 T720 40 T800 40" stroke="#3f6b3a" stroke-width="2" fill="none" opacity=".8"/>
      ${[60, 150, 240, 330, 420, 510, 600, 690, 770].map((x, i) => bell(x, 24, 1.15, ["#b0413a", "#3f6fa0", "#d19a2e"][i % 3])).join("")}
      <!-- window, the view outside, patched shutters -->
      <rect x="62" y="102" width="176" height="166" fill="#6d4b2e"/>
      <rect x="72" y="112" width="156" height="146" fill="url(#daySky)"/>
      <rect x="72" y="208" width="156" height="50" fill="#6f9fb4"/>
      <path d="M72 208 h156" stroke="#e9f0ea" stroke-width="1.5" opacity=".7"/>
      <path d="M150 208 l20 -18 l30 4 l28 14z" fill="#2a2c33"/>
      <ellipse cx="120" cy="140" rx="30" ry="8" fill="#fff" opacity=".7" filter="url(#b5)"/>
      <path d="M150 112 v146 M72 184 h156" stroke="#6d4b2e" stroke-width="5"/>
      <g>
        <rect x="26" y="108" width="40" height="156" fill="url(#shutter)"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<rect x="30" y="${114 + i * 15}" width="32" height="3" fill="#43614d" opacity=".7"/>`).join("")}
        <rect x="30" y="170" width="30" height="26" fill="#9c7a4c" transform="rotate(-4 45 183)"/>
        ${nail(33, 173)}${nail(56, 172)}${nail(34, 193)}${nail(57, 192)}
        <rect x="234" y="108" width="40" height="156" fill="url(#shutter)"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<rect x="238" y="${114 + i * 15}" width="32" height="3" fill="#43614d" opacity=".7"/>`).join("")}
      </g>
      <rect x="66" y="262" width="168" height="22" fill="#7a5433"/>
      ${leaves}${flowers}
      <!-- wash stand with the chipped blue basin -->
      <g>
        <rect x="628" y="276" width="96" height="128" fill="#8a603b"/>
        <rect x="628" y="276" width="96" height="128" filter="url(#woodV)"/>
        <rect x="620" y="268" width="112" height="10" fill="#9c6e44"/>
        <path d="M642 268 Q676 244 710 268 Z" fill="#4c7fae"/>
        <path d="M646 262 Q676 252 706 262" stroke="#8fb4d6" stroke-width="2" fill="none"/>
        <path d="M700 258 l6 4 l-4 3z" fill="#f2ead8"/>
        <path d="M652 250 q-6 -30 10 -40 h14 q14 10 8 40z" fill="#e8e0cf"/>
        <path d="M684 222 q14 4 8 20" stroke="#e8e0cf" stroke-width="4" fill="none"/>
      </g>
      <!-- floor -->
      <rect y="400" width="800" height="80" fill="url(#floorWarm)"/>
      ${boards}
      <rect y="398" width="800" height="6" fill="#6b4a2e"/>
      <!-- bed -->
      <ellipse cx="450" cy="412" rx="210" ry="14" fill="#3b2410" opacity=".35" filter="url(#b5)"/>
      <rect x="276" y="250" width="22" height="160" rx="4" fill="url(#bedpost)"/>
      <rect x="590" y="300" width="20" height="110" rx="4" fill="url(#bedpost)"/>
      <rect x="290" y="318" width="310" height="86" fill="#6a4a2e"/>
      ${quilt.join("")}
      <path d="M300 322 h288 v78 h-288z" fill="url(#quiltShade)"/>
      <path d="M300 322 h288 M300 348 h288 M300 374 h288" stroke="#fff" stroke-dasharray="3 3" stroke-width=".8" opacity=".5"/>
      <ellipse cx="340" cy="312" rx="42" ry="16" fill="#f1ebdd"/>
      <path d="M360 318 Q440 270 560 316 L588 322 H330 Z" fill="#c8594a"/>
      <path d="M360 318 Q440 270 560 316" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none"/>
      ${doll(318, 330, .95, -12)}
      <rect width="800" height="480" fill="url(#vigSoft)"/>
      ${grainAll(.22)}
    `, `<linearGradient id="plaster" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c98f"/><stop offset="1" stop-color="#d8ad6d"/></linearGradient>
        <linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a21"/><stop offset=".7" stop-color="#8a6038"/><stop offset="1" stop-color="#6a4527"/></linearGradient>
        <linearGradient id="daySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9dc6de"/><stop offset="1" stop-color="#f4e2b4"/></linearGradient>
        <linearGradient id="shutter" x1="0" x2="1"><stop offset="0" stop-color="#557a62"/><stop offset=".5" stop-color="#6f9678"/><stop offset="1" stop-color="#4b6b56"/></linearGradient>
        <linearGradient id="floorWarm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0714a"/><stop offset="1" stop-color="#6e4a2c"/></linearGradient>
        <linearGradient id="bedpost" x1="0" x2="1"><stop offset="0" stop-color="#4a3019"/><stop offset=".5" stop-color="#8a6038"/><stop offset="1" stop-color="#4a3019"/></linearGradient>
        <linearGradient id="quiltShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>`);
  }
  function sunbeams(L, t, beams, strength) {
    for (const b of beams) {
      const a = strength * (.75 + .25 * Math.sin(t * .5 + b.p));
      const g = L.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
      g.addColorStop(0, `rgba(255,236,190,${a.toFixed(3)})`);
      g.addColorStop(1, "rgba(255,236,190,0)");
      L.fillStyle = g;
      L.beginPath(); L.moveTo(b.x0 - b.w0, b.y0); L.lineTo(b.x0 + b.w0, b.y0); L.lineTo(b.x1 + b.w1, b.y1); L.lineTo(b.x1 - b.w1, b.y1); L.closePath(); L.fill();
    }
  }
  function lilyFX(t, dt, L, N, env, st) {
    sunbeams(L, t, st.beams, .22);
    motes(L, st.motes, dt, t, null, null, 1, .55, "255,244,215");
  }

  // ===================================================================
  // VILLAGE: Bellgrave in rings around the hilltop shrine
  // ===================================================================
  function house(x, y, c, s, r) {
    const w = 24 * s, h = 17 * s;
    const side = shade(c, -.32);
    return `<g>
      <path d="M${x + w / 2} ${y - h} l${7 * s} ${-4 * s} v${h} l${-7 * s} ${4 * s}z" fill="${side}"/>
      <rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="${c}"/>
      <path d="M${x - w / 2 - 2 * s} ${y - h} L${x} ${y - h - 11 * s} L${x + w / 2 + 2 * s} ${y - h} Z" fill="#a14c33"/>
      <path d="M${x} ${y - h - 11 * s} L${x + 7 * s} ${y - h - 15 * s} L${x + w / 2 + 9 * s} ${y - h - 4 * s} L${x + w / 2 + 2 * s} ${y - h} Z" fill="#7a3624"/>
      <rect x="${x - 8 * s}" y="${y - h + 4 * s}" width="${6 * s}" height="${5 * s}" fill="#2c2621"/>
      <rect x="${x - 9 * s}" y="${y - h + 9 * s}" width="${8 * s}" height="${2 * s}" fill="${r() < .6 ? "#8b4fa3" : "#b06cc6"}"/>
      <rect x="${x + 3 * s}" y="${y - 8 * s}" width="${5 * s}" height="${8 * s}" fill="${shade(c, -.55)}"/>
      ${s > 1 ? bell(x + 5.5 * s, y - 9.8 * s, .12 * s, "#5a3a24") : ""}
    </g>`;
  }
  function pine(x, y, s, lean) {
    return `<g transform="translate(${x} ${y}) rotate(${lean}) scale(${s})">
      <path d="M-2 0 Q-4 -30 2 -60" stroke="#2a1d14" stroke-width="4" fill="none"/>
      <path d="M-22 -14 L2 -40 L20 -12 Z M-18 -30 L3 -56 L16 -30 Z M-12 -46 L4 -72 L12 -46 Z" fill="#20352a"/>
      <path d="M2 -40 L20 -12 L8 -14 Z M3 -56 L16 -30 L8 -32 Z" fill="#2f4a3a"/>
    </g>`;
  }
  function villageBG() {
    const r = rng(33);
    const cols = ["#d1674a", "#e8c15a", "#5e8fb8", "#8ab06a", "#e39a6b", "#b07ab0", "#f0e2c4", "#6fb0a4"];
    const hs = [];
    let k = 0;
    [[120, 10, .8], [190, 14, 1], [262, 18, 1.2], [330, 20, 1.45]].forEach(([rad, n, s]) => {
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.06 + 0.88 * (i / (n - 1))) + (r() - .5) * .06;
        const x = 400 - Math.cos(a) * rad * 1.28, y = 150 + Math.sin(a) * rad * 0.62 + 8;
        if (y > 392) continue;
        hs.push([y, house(x, y, cols[k++ % cols.length], s, r)]);
      }
    });
    hs.sort((a, b) => a[0] - b[0]);
    const streets = [120, 190, 262].map(rad => `<path d="M${400 - rad * 1.3} ${160 + rad * .1} A${rad * 1.3} ${rad * .66} 0 0 0 ${400 + rad * 1.3} ${160 + rad * .1}" stroke="#d9c49a" stroke-width="${4 + rad / 60}" fill="none" opacity=".7"/>`).join("");
    const clouds = `<g filter="url(#cloud)">
      <ellipse cx="160" cy="70" rx="130" ry="22" fill="#fff6e4" opacity=".9"/>
      <ellipse cx="610" cy="54" rx="150" ry="20" fill="#fff1dc" opacity=".85"/>
      <ellipse cx="420" cy="120" rx="110" ry="12" fill="#fde9cc" opacity=".7"/>
    </g>`;
    let columns = "";
    for (let i = 0; i < 9; i++) columns += `<path d="M${6 + i * 11} 480 V${250 + (i % 3) * 14 + i * 3}" stroke="#2a2d33" stroke-width="1.5"/>`;
    for (let i = 0; i < 9; i++) columns += `<path d="M${700 + i * 11} 480 V${236 + (i % 3) * 12 + (8 - i) * 3}" stroke="#2a2d33" stroke-width="1.5"/>`;
    return wrap(`
      <rect width="800" height="480" fill="url(#dawn)"/>
      <circle cx="660" cy="180" r="90" fill="#fff0c0" opacity=".45" filter="url(#b30)"/>
      <circle cx="660" cy="180" r="22" fill="#fff6d8"/>
      ${clouds}
      <rect y="232" width="800" height="248" fill="url(#seaDay)"/>
      <path d="M0 232 H800" stroke="#fff5da" stroke-width="1.5" opacity=".7"/>
      <path d="M30 232 q40 -10 90 -2 q30 -8 60 2z M600 232 q30 -8 70 0z" fill="#8aa0a6" opacity=".6"/>
      <!-- hill -->
      <path d="M40 420 C160 260 300 150 400 120 C500 150 640 260 760 420 Z" fill="url(#hill)"/>
      <path d="M40 420 C160 260 300 150 400 120 C500 150 640 260 760 420 Z" filter="url(#mottle)" opacity=".35"/>
      ${streets}
      ${hs.map(h => h[1]).join("")}
      <!-- the old hilltop shrine -->
      <g>
        <rect x="376" y="104" width="48" height="36" fill="#ece5d6"/>
        <rect x="376" y="104" width="14" height="36" fill="#d6ceba"/>
        <path d="M366 106 L400 82 L434 106 Z" fill="#7a3b2e"/>
        <path d="M392 140 v-16 q8 -10 16 0 v16z" fill="#3b2a1c"/>
        ${bell(400, 94, .75, "#c9a45c")}
      </g>
      ${pine(84, 330, 1.1, -8)}${pine(118, 300, .9, 6)}${pine(700, 318, 1.15, 10)}${pine(668, 286, .85, -4)}
      <!-- harbor -->
      <rect y="410" width="800" height="70" fill="url(#seaNear)"/>
      <path d="M300 414 H520 L510 428 H310 Z" fill="#6f6254"/>
      <path d="M300 414 H520" stroke="#9b8c78" stroke-width="2"/>
      ${[330, 360, 470].map(x => `<ellipse cx="${x}" cy="410" rx="7" ry="5" fill="#7a5433"/><rect x="${x - 7}" y="404" width="14" height="6" fill="#8a603b"/>`).join("")}
      ${[[250, 440], [560, 446], [610, 432]].map(([x, y]) => `<path d="M${x - 22} ${y} h44 l-8 9 h-28z" fill="#6b3d22"/><path d="M${x} ${y} v-30" stroke="#3b2a1c" stroke-width="2"/><path d="M${x + 2} ${y - 28} q16 12 0 24z" fill="#efe4c8"/>`).join("")}
      <!-- black cliffs framing the view -->
      <path d="M0 480 V240 L40 228 L70 252 L96 300 L120 380 L140 480 Z" fill="#1d2026" filter="url(#rough)"/>
      <path d="M800 480 V226 L760 214 L730 246 L700 296 L676 390 L660 480 Z" fill="#1d2026" filter="url(#rough)"/>
      ${columns}
      <rect width="800" height="480" fill="url(#vigSoft)"/>
      ${grainAll(.2)}
    `, `<linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbbd4"/><stop offset=".55" stop-color="#f1d7a4"/><stop offset="1" stop-color="#f7c37a"/></linearGradient>
        <linearGradient id="seaDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c887"/><stop offset=".4" stop-color="#7fa3b0"/><stop offset="1" stop-color="#3f6878"/></linearGradient>
        <linearGradient id="seaNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f8a98"/><stop offset="1" stop-color="#2d5566"/></linearGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8db06a"/><stop offset="1" stop-color="#4f7240"/></linearGradient>`);
  }
  function sparkles(L, t, list, dt) {
    for (const s of list) {
      const a = Math.max(0, Math.sin(t * s.f + s.p)) ** 8;
      if (a < .02) continue;
      L.fillStyle = `rgba(255,248,220,${(a * s.m).toFixed(3)})`;
      L.fillRect(s.x - s.w / 2, s.y, s.w, 1.3);
    }
  }
  function birds(N, t, dt, list, color = "#2a2622") {
    N.strokeStyle = color; N.lineWidth = 1.6; N.lineCap = "round";
    for (const b of list) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x > 860) { b.x = -40; b.y = b.y0; }
      if (b.x < -60) { b.x = 840; b.y = b.y0; }
      if (b.y < -40) { b.y = b.y0; }
      const f = Math.sin(t * b.f + b.p) * 5 * b.s;
      N.beginPath();
      N.moveTo(b.x - 8 * b.s, b.y - f);
      N.quadraticCurveTo(b.x - 3 * b.s, b.y - 3 * b.s, b.x, b.y);
      N.quadraticCurveTo(b.x + 3 * b.s, b.y - 3 * b.s, b.x + 8 * b.s, b.y - f);
      N.stroke();
    }
  }
  function smoke(N, dt, list, color) {
    for (const p of list) {
      p.age += dt;
      if (p.age > p.life) { p.age = 0; p.x = p.x0; p.y = p.y0; }
      const k = p.age / p.life;
      const x = p.x0 + p.drift * k * 60 + Math.sin(p.age * 1.3) * 3, y = p.y0 - k * p.rise;
      const rad = p.r0 + k * p.grow;
      N.fillStyle = `rgba(${color},${(p.a * Math.sin(Math.PI * k)).toFixed(3)})`;
      N.beginPath(); N.arc(x, y, rad, 0, TAU); N.fill();
    }
  }
  function villageFX(t, dt, L, N, env, st) {
    sparkles(L, t, st.spark, dt);
    smoke(N, dt, st.smoke, "235,228,215");
    birds(N, t, dt, st.gulls, "#3a3530");
  }

  // ===================================================================
  // PORCH: bread with the very reddest jam, and the doll
  // ===================================================================
  function porchBG() {
    let boards = "";
    for (let xb = -800; xb <= 1600; xb += 70) {
      const x1 = 400 + (xb - 400) * (330 - 200) / (480 - 200);
      boards += `<line x1="${x1.toFixed(1)}" y1="330" x2="${xb}" y2="480" stroke="#5e3f25" stroke-width="2"/>`;
    }
    const balusters = Array.from({ length: 16 }, (_, i) => {
      const x = 150 + i * 44;
      return `<rect x="${x}" y="246" width="9" height="84" fill="url(#post)"/>`;
    }).join("");
    return wrap(`
      <rect width="800" height="480" fill="url(#dawn2)"/>
      <circle cx="560" cy="150" r="120" fill="#fff0c0" opacity=".45" filter="url(#b30)"/>
      <g filter="url(#cloud)"><ellipse cx="300" cy="80" rx="160" ry="18" fill="#fff5e2" opacity=".8"/><ellipse cx="660" cy="60" rx="120" ry="14" fill="#fff" opacity=".7"/></g>
      <rect y="200" width="800" height="140" fill="url(#seaDay2)"/>
      <path d="M0 200 H800" stroke="#fff5da" stroke-width="1.5" opacity=".7"/>
      <path d="M560 200 L640 330 L480 330 Z" fill="#fff4d0" opacity=".25" filter="url(#b12)"/>
      <path d="M150 200 L200 184 L240 190 L290 200 Z" fill="#303640" filter="url(#rough)"/>
      <!-- house wall and doorframe with a carved bell -->
      <rect x="0" y="0" width="140" height="480" fill="#dfc393"/>
      <rect x="0" y="0" width="140" height="480" filter="url(#mottle)" opacity=".35"/>
      <rect x="84" y="60" width="56" height="280" fill="#6d4b2e"/>
      <rect x="92" y="70" width="48" height="270" fill="#3b2a1c"/>
      ${bell(112, 44, 1.2, "#7a5a3a")}
      <!-- railing -->
      ${balusters}
      <rect x="140" y="238" width="660" height="12" fill="url(#rail)"/>
      <rect x="140" y="250" width="660" height="6" fill="#000" opacity=".2"/>
      <!-- porch boards -->
      <rect y="330" width="800" height="150" fill="url(#porchG)"/>
      <rect y="330" width="800" height="150" filter="url(#woodV)" opacity=".7"/>
      ${boards}
      <rect x="140" y="326" width="660" height="6" fill="#4a3019"/>
      <!-- plate: bread with the very reddest jam -->
      <g>
        <ellipse cx="330" cy="400" rx="96" ry="20" fill="#3b2410" opacity=".45" filter="url(#b5)"/>
        <ellipse cx="330" cy="392" rx="92" ry="22" fill="url(#plateW)"/>
        <ellipse cx="330" cy="392" rx="80" ry="17" fill="none" stroke="#6d93b8" stroke-width="2.5"/>
        <path d="M272 390 Q282 356 330 354 Q378 356 388 390 Q330 402 272 390 Z" fill="url(#bread)"/>
        <path d="M282 382 Q330 360 378 382 Q330 392 282 382 Z" fill="#b3232f"/>
        <path d="M300 376 Q320 368 342 370" stroke="#ff8f8f" stroke-width="2" fill="none" opacity=".7"/>
        <circle cx="352" cy="376" r="2" fill="#fff" opacity=".7"/>
        <path d="M388 390 q10 6 4 14" stroke="#b3232f" stroke-width="3" fill="none"/>
      </g>
      ${doll(540, 356, 2.1, 4)}
      <rect width="800" height="480" fill="url(#vigSoft)"/>
      ${grainAll(.2)}
    `, `<linearGradient id="dawn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc3d6"/><stop offset="1" stop-color="#f6d6a0"/></linearGradient>
        <linearGradient id="seaDay2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8bf78"/><stop offset=".5" stop-color="#94a9a8"/><stop offset="1" stop-color="#5f8290"/></linearGradient>
        <linearGradient id="post" x1="0" x2="1"><stop offset="0" stop-color="#5a3d25"/><stop offset=".5" stop-color="#9a6e44"/><stop offset="1" stop-color="#5a3d25"/></linearGradient>
        <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b0835a"/><stop offset="1" stop-color="#6d4b2e"/></linearGradient>
        <linearGradient id="porchG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e643f"/><stop offset="1" stop-color="#5e3f25"/></linearGradient>
        <radialGradient id="plateW" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fbf8f0"/><stop offset="1" stop-color="#cfc6b2"/></radialGradient>
        <linearGradient id="bread" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d89a55"/><stop offset="1" stop-color="#a8682f"/></linearGradient>`);
  }
  function porchFX(t, dt, L, N, env, st) {
    sparkles(L, t, st.spark, dt);
    for (const p of st.petals) {
      p.x += p.vx * dt; p.y += (p.vy + Math.sin(t * 2 + p.p) * 6) * dt; p.rot += p.vr * dt;
      if (p.x > 820 || p.y > 490) { p.x = -20; p.y = 60 + Math.random() * 200; }
      N.save(); N.translate(p.x, p.y); N.rotate(p.rot);
      N.fillStyle = p.c; N.beginPath(); N.ellipse(0, 0, 3.4, 1.8, 0, 0, TAU); N.fill();
      N.restore();
    }
  }

  // ===================================================================
  // FOG: shapes offshore, seabirds rising
  // ===================================================================
  function fogBG() {
    const r = rng(44);
    let hammer = "";
    for (let i = 0; i < 520; i++) {
      const y = 250 + Math.pow(r(), 1.4) * 230, x = r() * 800, w = 4 + (y - 250) * .12 * (0.5 + r());
      hammer += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(w / 2).toFixed(1)} -2 ${w.toFixed(1)} 0" stroke="${r() < .5 ? "#fff0c4" : "#8a6a3c"}" stroke-width="${(1 + (y - 250) / 150).toFixed(2)}" fill="none" opacity="${(.3 + r() * .4).toFixed(2)}"/>`;
    }
    const ships = [110, 220, 330, 450, 560, 660].map((x, i) => {
      const y = 246 - (i % 2) * 4, s = .9 + (i % 3) * .1;
      return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${(.45 + (i % 3) * .08).toFixed(2)}">
        <path d="M-40 0 H40 L32 12 H-32 Z" fill="#4a4f55"/>
        <rect x="-16" y="-46" width="3" height="46" fill="#4a4f55"/><rect x="12" y="-40" width="3" height="40" fill="#4a4f55"/>
        <path d="M-12 -44 q14 10 0 22z M16 -38 q12 9 0 18z" fill="#5a6066"/>
        ${[-26, -14, -2, 10, 22].map(px => `<rect x="${px}" y="3" width="4" height="3" fill="#2a2d31"/>`).join("")}
      </g>`;
    }).join("");
    return wrap(`
      <rect width="800" height="480" fill="url(#hazeSky)"/>
      <circle cx="400" cy="150" r="140" fill="#fff4d0" opacity=".5" filter="url(#b30)"/>
      <circle cx="400" cy="150" r="26" fill="#fff8e4" opacity=".85"/>
      <rect y="250" width="800" height="230" fill="url(#goldSea)"/>
      ${hammer}
      ${ships}
      <rect y="180" width="800" height="90" fill="#efe6d2" opacity=".55" filter="url(#b12)"/>
      <!-- Lily's porch rail, where she is watching from -->
      <rect x="0" y="424" width="800" height="12" fill="#6d4b2e"/>
      ${Array.from({ length: 20 }, (_, i) => `<rect x="${10 + i * 42}" y="436" width="9" height="44" fill="#5a3d25"/>`).join("")}
      <rect width="800" height="480" fill="url(#vigSoft)"/>
      ${grainAll(.18)}
    `, `<linearGradient id="hazeSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c9cf"/><stop offset=".8" stop-color="#f1dcaa"/><stop offset="1" stop-color="#f3d49a"/></linearGradient>
        <linearGradient id="goldSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b060"/><stop offset=".5" stop-color="#b58a4a"/><stop offset="1" stop-color="#5e6a6c"/></linearGradient>`);
  }
  function fogFX(t, dt, L, N, env, st) {
    sparkles(L, t, st.spark, dt);
    for (const f of st.fog) {
      f.x += f.v * dt; if (f.x > 900) f.x = -f.w;
      N.globalAlpha = f.a * (.8 + .2 * Math.sin(t * .3 + f.p));
      N.drawImage(st.puff, f.x, f.y, f.w, f.h);
    }
    N.globalAlpha = 1;
    birds(N, t, dt, st.birds, "#2c2824");
  }

  // ===================================================================
  // BELL: the sound from beneath the island
  // ===================================================================
  function bellBG() {
    return wrap(`
      <rect width="800" height="480" fill="#040506"/>
      <ellipse cx="400" cy="520" rx="520" ry="160" fill="#0e1a24" filter="url(#b30)"/>
      <path d="M0 480 L0 440 C200 420 280 400 400 404 C520 400 600 420 800 440 V480 Z" fill="#020304"/>
      ${grainAll(.35)}
    `);
  }
  function bellFX(t, dt, L, N, env, st) {
    for (let i = 0; i < 5; i++) {
      const k = ((t * .45 + i / 5) % 1);
      const rad = 30 + k * 620;
      const a = (1 - k) ** 2 * .45;
      L.strokeStyle = `rgba(170,200,230,${a.toFixed(3)})`;
      L.lineWidth = 2 + (1 - k) * 4;
      L.beginPath(); L.ellipse(400, 470, rad, rad * .42, 0, Math.PI, TAU); L.stroke();
    }
    const g = L.createRadialGradient(400, 480, 0, 400, 480, 260);
    g.addColorStop(0, `rgba(120,160,200,${(.18 + .08 * Math.sin(t * 4)).toFixed(3)})`); g.addColorStop(1, "rgba(0,0,0,0)");
    L.fillStyle = g; L.fillRect(0, 0, 800, 480);
  }

  // ===================================================================
  // BURNING: Bellgrave three nights later, as Sean first sees it
  // ===================================================================
  function burningBG() {
    const ships = [[150, 420, .9], [240, 438, 1], [330, 448, 1.05], [440, 450, 1.08], [540, 444, 1.05], [630, 432, 1], [710, 418, .9]]
      .map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})">
        <path d="M-44 0 H44 L34 14 H-34 Z" fill="#07080a"/>
        <rect x="-18" y="-56" width="4" height="56" fill="#07080a"/><rect x="14" y="-48" width="4" height="48" fill="#07080a"/>
        <path d="M-14 -54 q16 12 0 26z M18 -46 q13 10 0 21z" fill="#0c0e11"/>
        ${[-30, -16, -2, 12, 26].map(px => `<rect x="${px}" y="4" width="5" height="3" fill="#3a2010"/>`).join("")}
      </g>`).join("");
    return wrap(`
      <rect width="800" height="480" fill="url(#fireSky)"/>
      <g filter="url(#cloud)" opacity=".9">
        <ellipse cx="380" cy="120" rx="200" ry="40" fill="#1a0f0c"/>
        <ellipse cx="470" cy="60" rx="220" ry="30" fill="#140b09"/>
        <ellipse cx="300" cy="200" rx="160" ry="26" fill="#241510"/>
      </g>
      <circle cx="420" cy="330" r="200" fill="#ff7a2a" opacity=".35" filter="url(#b30)"/>
      <!-- the island rising from the fog -->
      <path d="M90 380 L130 300 L180 280 L220 220 L270 200 L330 150 L400 128 L470 150 L540 196 L600 214 L650 270 L700 300 L730 380 Z" fill="#0b0808" filter="url(#rough)"/>
      <path d="M396 128 l4 -10 l4 10z" fill="#0b0808"/>
      ${[[180, 280], [230, 222], [610, 222], [660, 272]].map(([x, y]) => pine(x, y, .8, (x % 7) - 3).replace(/#20352a|#2f4a3a|#2a1d14/g, "#070505")).join("")}
      ${Array.from({ length: 26 }, (_, i) => {
        const x = 250 + (i * 37) % 320, y = 250 + ((i * 53) % 110);
        return `<rect x="${x}" y="${y}" width="5" height="4" fill="#ffb05a" opacity="${(.4 + (i % 4) * .15).toFixed(2)}"/>`;
      }).join("")}
      <rect y="360" width="800" height="120" fill="url(#fireSea)"/>
      <rect y="330" width="800" height="70" fill="#3a241c" opacity=".55" filter="url(#b12)"/>
      ${ships}
      <rect width="800" height="480" fill="url(#vig)"/>
      ${grainAll(.3)}
    `, `<linearGradient id="fireSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070506"/><stop offset=".6" stop-color="#2a130c"/><stop offset="1" stop-color="#6a2c12"/></linearGradient>
        <linearGradient id="fireSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a3016"/><stop offset=".4" stop-color="#2a1510"/><stop offset="1" stop-color="#07080a"/></linearGradient>`);
  }
  function burningFX(t, dt, L, N, env, st) {
    const fl = .75 + .15 * Math.sin(t * 6) + .1 * Math.sin(t * 13.7);
    let g = L.createRadialGradient(420, 320, 10, 420, 320, 340);
    g.addColorStop(0, `rgba(255,120,40,${(.4 * fl).toFixed(3)})`); g.addColorStop(1, "rgba(0,0,0,0)");
    L.fillStyle = g; L.fillRect(0, 0, 800, 480);
    smoke(N, dt, st.smoke, "22,14,12");
    for (const e of st.embers) {
      e.y -= e.v * dt; e.x += Math.sin(t * 2 + e.p) * 12 * dt;
      if (e.y < 60) { e.y = 300 + Math.random() * 60; e.x = 260 + Math.random() * 320; }
      const a = .5 + .5 * Math.sin(t * 9 + e.p);
      L.fillStyle = `rgba(255,${(140 + a * 80) | 0},60,${(.8 * a).toFixed(3)})`;
      L.fillRect(e.x, e.y, 1.8, 1.8);
    }
    // cannon flashes from the crescent of warships
    st.next -= dt;
    if (st.next <= 0) { st.flash = { x: [150, 240, 330, 440, 540, 630, 710][(Math.random() * 7) | 0], y: 0, age: 0 }; st.next = .8 + Math.random() * 1.8; }
    if (st.flash) {
      const f = st.flash; f.age += dt;
      const ys = { 150: 420, 240: 438, 330: 448, 440: 450, 540: 444, 630: 432, 710: 418 };
      const a = Math.max(0, 1 - f.age / .35);
      if (a > 0) {
        g = L.createRadialGradient(f.x - 30, ys[f.x] + 2, 0, f.x - 30, ys[f.x] + 2, 60);
        g.addColorStop(0, `rgba(255,230,170,${a.toFixed(3)})`); g.addColorStop(1, "rgba(0,0,0,0)");
        L.fillStyle = g; L.fillRect(f.x - 100, ys[f.x] - 60, 140, 120);
      }
    }
  }

  // ===================================================================
  // CARD: chapter titles
  // ===================================================================
  function cardBG() {
    let rose = "";
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, l = i % 4 === 0 ? 150 : i % 2 ? 70 : 110;
      rose += `<path d="M400 240 L${(400 + Math.cos(a - .06) * 14).toFixed(1)} ${(240 + Math.sin(a - .06) * 14).toFixed(1)} L${(400 + Math.cos(a) * l).toFixed(1)} ${(240 + Math.sin(a) * l).toFixed(1)} L${(400 + Math.cos(a + .06) * 14).toFixed(1)} ${(240 + Math.sin(a + .06) * 14).toFixed(1)} Z" fill="#b38e50" opacity=".07"/>`;
    }
    const corner = (x, y, sx, sy) => `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="M0 40 V0 H40 M8 40 V8 H40 M14 14 q12 2 16 16" stroke="#b38e50" stroke-width="1.6" fill="none" opacity=".8"/>`;
    return wrap(`
      <rect width="800" height="480" fill="url(#cardG)"/>
      <circle cx="400" cy="240" r="170" fill="none" stroke="#b38e50" stroke-opacity=".08" stroke-width="2"/>
      <circle cx="400" cy="240" r="130" fill="none" stroke="#b38e50" stroke-opacity=".06" stroke-width="1"/>
      ${rose}
      <rect x="30" y="30" width="740" height="420" fill="none" stroke="#b38e50" stroke-opacity=".45" stroke-width="1.2"/>
      ${corner(40, 40, 1, 1)}${corner(760, 40, -1, 1)}${corner(40, 440, 1, -1)}${corner(760, 440, -1, -1)}
      <rect width="800" height="480" fill="url(#vig)"/>
      ${grainAll(.3)}
    `, `<radialGradient id="cardG" cx="400" cy="220" r="480" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1b2632"/><stop offset="1" stop-color="#080b0f"/></radialGradient>`);
  }
  function cardOV(S, data) {
    const k = data && data.kicker || "", n = data && data.name || "";
    return `<text x="400" y="206" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="24" fill="#eaa94c" letter-spacing="5">${k}</text>
      <text x="400" y="266" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="58" fill="#ecdfc2">${n}</text>
      <path d="M290 296 H380 M420 296 H510" stroke="#b38e50" stroke-width="1.4"/>
      <path d="M400 288 l6 8 l-6 8 l-6 -8z" fill="#b38e50"/>`;
  }
  function emberFX(t, dt, L, N, env, st) {
    for (const e of st.embers) {
      e.y -= e.v * dt; e.x += Math.sin(t + e.p) * 6 * dt;
      if (e.y < -10) { e.y = 490; e.x = Math.random() * 800; }
      const a = (.35 + .35 * Math.sin(t * 3 + e.p)) * e.m;
      L.fillStyle = `rgba(255,170,80,${a.toFixed(3)})`;
      L.beginPath(); L.arc(e.x, e.y, e.s, 0, TAU); L.fill();
    }
  }

  // ===================================================================
  // CABIN: Sean's cramped stern cabin, three nights before Bellgrave
  // ===================================================================
  function cabinBG() {
    const r = rng(11);
    let planks = "";
    for (let y = 40; y < 404; y += 30) {
      const k = .78 + r() * .38;
      planks += `<rect y="${y}" width="800" height="30" fill="${rgb(82 * k, 56 * k, 36 * k)}"/>`;
      planks += `<rect y="${y + 1}" width="800" height="2" fill="#b08860" opacity=".2"/>`;
      planks += `<rect y="${y + 27}" width="800" height="3" fill="#140c06" opacity=".85"/>`;
      let x = r() * 220;
      while (x < 800) { planks += `<rect x="${x.toFixed(1)}" y="${y}" width="2.5" height="28" fill="#140c06"/>${nail(x + 7, y + 8)}${nail(x + 7, y + 21)}`; x += 170 + r() * 280; }
    }
    let floor = "";
    for (let xb = -700; xb <= 1500; xb += 62) {
      const x1 = 400 + (xb - 400) * (404 - 120) / (480 - 120);
      floor += `<line x1="${x1.toFixed(1)}" y1="404" x2="${xb}" y2="480" stroke="#120b06" stroke-width="2"/>`;
    }
    const rib = x => `<rect x="${x}" y="30" width="24" height="376" fill="url(#ribG)"/><rect x="${x}" y="30" width="24" height="376" filter="url(#woodV)"/><rect x="${x + 24}" y="30" width="12" height="376" fill="url(#shadeR)"/>
      <path d="M${x - 16} 44 L${x} 44 L${x} 70 Z M${x + 24} 44 L${x + 40} 44 L${x + 24} 70 Z" fill="#3a2717"/>`;
    const books = [["#5b2b25", 18], ["#2f4a3f", 22], ["#6b5433", 16], ["#2c3a52", 20]].map(([c, h], i) =>
      `<rect x="${690 + i * 11}" y="${226 - h}" width="10" height="${h}" fill="${c}"/><rect x="${690 + i * 11}" y="${226 - h + 4}" width="10" height="1.5" fill="#c9a45c" opacity=".6"/>`).join("");
    return wrap(`
      <rect width="800" height="480" fill="#2a1c12"/>
      ${planks}
      <rect y="40" width="800" height="364" filter="url(#woodH)"/>
      <rect y="40" width="800" height="364" filter="url(#mottle)" opacity=".25"/>
      ${rib(10)}${rib(770)}
      <!-- ceiling beam -->
      <rect width="800" height="44" fill="url(#ceilG)"/>
      <rect width="800" height="44" filter="url(#woodH)"/>
      <rect y="44" width="800" height="22" fill="url(#shadeDown)"/>
      <rect x="392" y="22" width="16" height="10" rx="2" fill="url(#iron)"/>
      <!-- the leak: a stain where it drips -->
      <ellipse cx="626" cy="50" rx="10" ry="4" fill="#1a2630" opacity=".7"/>
      <path d="M622 44 q4 20 4 40" stroke="#1a2630" stroke-width="3" opacity=".35" fill="none"/>
      <!-- door -->
      <rect x="42" y="102" width="130" height="312" fill="#1d130b"/>
      <g>
        ${[0, 1, 2, 3].map(i => `<rect x="${52 + i * 27.5}" y="112" width="27.5" height="298" fill="${["#4d3624", "#553c28", "#4a3322", "#523a26"][i]}"/>`).join("")}
        <rect x="52" y="112" width="110" height="298" filter="url(#woodV)"/>
        ${[1, 2, 3].map(i => `<rect x="${52 + i * 27.5 - 1}" y="112" width="2" height="298" fill="#1d130b"/>`).join("")}
        <path d="M52 146 H138 q8 0 8 6 q0 6 -8 6 H52 Z M52 356 H138 q8 0 8 6 q0 6 -8 6 H52 Z" fill="url(#iron)"/>
        ${[60, 80, 100, 120].map(x => nail(x, 152) + nail(x, 362)).join("")}
        <rect x="52" y="112" width="110" height="8" fill="#000" opacity=".3"/>
        <circle cx="146" cy="262" r="9" fill="url(#brassV)"/>
        <circle cx="146" cy="274" r="8" fill="none" stroke="url(#brass)" stroke-width="3"/>
      </g>
      <rect x="42" y="406" width="130" height="4" fill="#000"/>
      <!-- porthole surround (the sea is painted live) -->
      <circle cx="620" cy="170" r="68" fill="#24170e"/>
      <circle cx="620" cy="170" r="60" fill="url(#brass)"/>
      <circle cx="620" cy="170" r="51" fill="#3b2a14"/>
      <circle cx="620" cy="170" r="47" fill="#03060a"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4 + .39; const x = 620 + Math.cos(a) * 55, y = 170 + Math.sin(a) * 55; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#5a3f1a"/><circle cx="${(x - .8).toFixed(1)}" cy="${(y - .8).toFixed(1)}" r="1.1" fill="#f0d690" opacity=".7"/>`; }).join("")}
      <!-- moonlight falling from the porthole -->
      <path d="M592 206 L650 214 L610 480 L430 480 Z" fill="#a9c9e8" opacity=".07" filter="url(#b12)"/>
      <ellipse cx="520" cy="452" rx="80" ry="12" fill="#a9c9e8" opacity=".08" filter="url(#b5)"/>
      <!-- shelf above the bunk -->
      <rect x="680" y="226" width="120" height="8" fill="#6d4b2e"/>
      <rect x="680" y="234" width="120" height="10" fill="url(#shadeDown)"/>
      <path d="M690 234 l10 0 l-10 14z M786 234 l-10 0 l10 14z" fill="#4a3321"/>
      ${books}
      <path d="M740 226 v-26 q0 -6 5 -8 v-8 h6 v8 q5 2 5 8 v26 z" fill="#2c4a34" opacity=".9"/>
      <path d="M743 222 v-20" stroke="#9fd0a8" stroke-width="1.5" opacity=".5"/>
      <circle cx="774" cy="216" r="9" fill="url(#brass)"/><circle cx="774" cy="216" r="6.5" fill="#e8dfc6"/>
      <path d="M774 211 l1.6 5 l-1.6 5 l-1.6 -5z" fill="#b0413a"/>
      <rect x="760" y="202" width="30" height="7" rx="3.5" fill="#d7c49b" transform="rotate(-8 775 205)"/>
      <!-- bunk -->
      <rect x="668" y="298" width="140" height="112" fill="url(#bunkG)"/>
      <rect x="668" y="298" width="140" height="112" filter="url(#woodV)"/>
      <rect x="674" y="290" width="134" height="16" rx="5" fill="#7c6a52"/>
      <ellipse cx="770" cy="292" rx="30" ry="10" fill="#ddd3bf"/>
      <path d="M686 304 Q720 280 760 296 Q790 290 808 300 V352 H686 Z" fill="#44533f"/>
      <path d="M700 312 q20 -10 38 4 M742 300 q14 12 30 6" stroke="#2c3829" stroke-width="3" fill="none" opacity=".7"/>
      <rect x="668" y="352" width="140" height="58" fill="#3a281b"/>
      <rect x="668" y="352" width="140" height="4" fill="#5a3f28"/>
      <!-- the bucket under the leak -->
      <ellipse cx="626" cy="410" rx="28" ry="6" fill="#000" opacity=".5" filter="url(#b2)"/>
      <path d="M602 376 H650 L644 410 H608 Z" fill="url(#bucketG)"/>
      <ellipse cx="626" cy="376" rx="24" ry="5" fill="#5a6066"/>
      <ellipse cx="626" cy="377" rx="21" ry="3.8" fill="#18242e"/>
      <path d="M604 380 Q626 350 648 380" stroke="#3a3e44" stroke-width="2" fill="none"/>
      <rect x="602" y="388" width="48" height="2" fill="#2a2e33"/><rect x="604" y="400" width="44" height="2" fill="#2a2e33"/>
      <!-- floor -->
      <rect y="404" width="800" height="76" fill="url(#floorG)"/>
      ${floor}
      <rect y="404" width="800" height="76" filter="url(#woodH)" opacity=".6"/>
      <rect y="398" width="800" height="8" fill="#1a110a"/>
      <rect y="398" width="800" height="1.5" fill="#8a6848" opacity=".35"/>
      <!-- table -->
      <ellipse cx="405" cy="418" rx="200" ry="14" fill="#000" opacity=".6" filter="url(#b5)"/>
      <rect x="256" y="330" width="18" height="84" fill="url(#legG)"/>
      <rect x="536" y="330" width="18" height="84" fill="url(#legG)"/>
      <rect x="254" y="360" width="22" height="5" fill="#3a2616"/><rect x="534" y="360" width="22" height="5" fill="#3a2616"/>
      <path d="M232 306 H578 L584 318 H226 Z" fill="url(#tableTop)"/>
      <path d="M232 306 H578 L584 318 H226 Z" filter="url(#woodH)"/>
      <rect x="226" y="318" width="358" height="14" fill="url(#tableEdge)"/>
      <rect x="226" y="318" width="358" height="1.5" fill="#c29a6a" opacity=".4"/>
      <!-- receipts, tide tables -->
      <path d="M248 316 l32 -4 l3 6 l-32 4z" fill="#e7dcc3"/>
      <path d="M266 314 l30 2 l-1 6 l-30 -2z" fill="#d9ccb0"/>
      <path d="M254 306 l26 -8 l4 8 l-26 8z" fill="#efe6d2"/>
      <path d="M258 306 l18 -5 M260 309 l16 -4" stroke="#7a6a50" stroke-width=".7"/>
      <path d="M414 316 L452 316 L450 304 L416 304 Z" fill="#5f715c"/>
      <path d="M416 304 H450" stroke="#8da187" stroke-width="2"/>
      <path d="M414 316 H452 V318 H414 Z" fill="#e8dfc6"/>
      <!-- communicator body -->
      <ellipse cx="506" cy="319" rx="42" ry="5" fill="#000" opacity=".5" filter="url(#b2)"/>
      <path d="M528 262 l7 -32" stroke="url(#brass)" stroke-width="3"/>
      <path d="M531 252 l6 -2 l-5 -3 l6 -2 l-5 -3 l6 -2" stroke="#d9b76b" stroke-width="1.2" fill="none"/>
      <circle cx="535" cy="229" r="3.5" fill="url(#brassV)"/>
      <rect x="468" y="260" width="74" height="60" rx="5" fill="url(#brass)"/>
      <rect x="470" y="262" width="70" height="3" rx="1.5" fill="#fff4cc" opacity=".45"/>
      <rect x="476" y="268" width="42" height="30" rx="2" fill="url(#iron)"/>
      ${[472, 536].map(x => [264, 316].map(y => `<circle cx="${x}" cy="${y}" r="1.6" fill="#5a3f1a"/>`).join("")).join("")}
      ${[0, 1, 2].map(i => `<rect x="478" y="${303 + i * 5}" width="40" height="2" rx="1" fill="#4a3418"/>`).join("")}
      <circle cx="529" cy="294" r="6" fill="url(#iron)"/><path d="M529 294 l3 -4" stroke="#d9b76b" stroke-width="1.5"/>
      <rect x="524" y="306" width="10" height="5" rx="2" fill="#2b2e33"/>
      <path d="M540 312 q30 6 26 60 q-2 30 -20 38" stroke="#15171a" stroke-width="2.5" fill="none"/>
      <!-- sword pegs and the coat hook -->
      <circle cx="306" cy="104" r="4" fill="#6d4b2e"/><circle cx="446" cy="104" r="4" fill="#6d4b2e"/>
      <circle cx="215" cy="136" r="5" fill="url(#brassV)"/>
      <rect width="800" height="480" fill="url(#vig)"/>
      ${grainAll(.3)}
    `, `<linearGradient id="ceilG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120b07"/><stop offset=".6" stop-color="#3b2a1c"/><stop offset="1" stop-color="#2a1c12"/></linearGradient>
        <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2819"/><stop offset="1" stop-color="#140d07"/></linearGradient>
        <linearGradient id="tableTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a2e"/><stop offset="1" stop-color="#8a6440"/></linearGradient>
        <linearGradient id="tableEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3f28"/><stop offset="1" stop-color="#2e1f12"/></linearGradient>
        <linearGradient id="legG" x1="0" x2="1"><stop offset="0" stop-color="#2a1b10"/><stop offset=".45" stop-color="#6a4a2e"/><stop offset="1" stop-color="#241710"/></linearGradient>
        <linearGradient id="bunkG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3321"/><stop offset="1" stop-color="#2a1c12"/></linearGradient>
        <linearGradient id="bucketG" x1="0" x2="1"><stop offset="0" stop-color="#2b2e33"/><stop offset=".4" stop-color="#6a7078"/><stop offset="1" stop-color="#23262a"/></linearGradient>`);
  }

  function cabinOV(S) {
    const f = S.flags, st = S.stage, has = id => S.inv.includes(id);
    const plateOnTable = !f.plateMoved;
    const chartUnder = !has("chart") && !f.chartSpread;
    const packetOnTable = st >= 3 && !has("packet");
    const live = st > 0 && st < 4;
    return `<defs>
        <linearGradient id="oCoat" x1="0" x2="1"><stop offset="0" stop-color="#141b22"/><stop offset=".35" stop-color="#34414f"/><stop offset=".7" stop-color="#232d38"/><stop offset="1" stop-color="#11161c"/></linearGradient>
        <linearGradient id="oScab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6168"/><stop offset=".45" stop-color="#2e3136"/><stop offset="1" stop-color="#17191c"/></linearGradient>
        <linearGradient id="oBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5e421c"/><stop offset=".3" stop-color="#d9b76b"/><stop offset=".55" stop-color="#8f6a32"/><stop offset=".8" stop-color="#ecd28c"/><stop offset="1" stop-color="#6b4c22"/></linearGradient>
        <radialGradient id="oPlate" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#f4efe4"/><stop offset="1" stop-color="#a9a18f"/></radialGradient>
        <linearGradient id="oParch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe1bd"/><stop offset="1" stop-color="#c9ae7c"/></linearGradient>
        <radialGradient id="oGlass" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff2c8"/><stop offset=".6" stop-color="#f3b95c"/><stop offset="1" stop-color="#b06d22"/></radialGradient>
        <radialGradient id="oScreen" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="${live ? "#3f8078" : "#1b2b2a"}"/><stop offset="1" stop-color="${live ? "#163432" : "#0b1414"}"/></radialGradient>
        <filter id="oBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>

      ${has("coat") ? "" : `<g>
        <path d="M204 150 q18 -12 30 -2 l26 176 q-44 16 -88 0 z" fill="#000" opacity=".45" filter="url(#oBlur)" transform="translate(8 6)"/>
        <path d="M200 146 q15 -14 30 0 l6 12 q12 60 22 164 q-43 16 -86 0 q10 -104 22 -164 z" fill="url(#oCoat)"/>
        <path d="M204 148 l11 56 l11 -56" fill="#10151b"/>
        <path d="M204 148 l11 56 l11 -56" stroke="#3e4c5b" stroke-width="1.2" fill="none"/>
        <path d="M190 200 q-4 60 -8 114 M246 200 q4 60 10 114 M216 210 q2 50 0 108" stroke="#0e1318" stroke-width="3" fill="none" opacity=".7"/>
        <path d="M196 170 q-6 70 -12 146" stroke="#4d5d6e" stroke-width="2" fill="none" opacity=".5"/>
        ${[214, 238, 262, 286].map(y => `<circle cx="222" cy="${y}" r="2.6" fill="url(#oBrass)"/>`).join("")}
        <path d="M184 312 q43 14 86 0" stroke="#0b0f13" stroke-width="3" fill="none"/>
      </g>`}

      ${has("sword") ? "" : `<g>
        <path d="M312 116 Q392 108 474 120" stroke="#000" stroke-width="10" opacity=".4" filter="url(#oBlur)" transform="translate(4 8)" fill="none"/>
        <path d="M312 109 Q392 101 476 113 L478 121 Q392 109 312 118 Z" fill="url(#oScab)"/>
        <path d="M466 112 L480 114 L481 121 L466 119 Z" fill="#8a8e94"/>
        <rect x="316" y="107" width="8" height="12" fill="#8a8e94"/>
        <path d="M314 100 q-6 13 0 26" stroke="#6d7178" stroke-width="4" fill="none"/>
        <rect x="282" y="108" width="32" height="10" rx="3" fill="#2b1d14"/>
        ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${285 + i * 5} 108 l3 10" stroke="#4a3322" stroke-width="1.6"/>`).join("")}
        <path d="M314 104 C302 88 276 94 276 113" stroke="#5d6168" stroke-width="2.6" fill="none"/>
        <circle cx="278" cy="113" r="4.5" fill="#6d7178"/><circle cx="277" cy="112" r="1.5" fill="#c9ccd1" opacity=".6"/>
      </g>`}

      ${chartUnder ? `<path d="M298 316 L422 312 L428 320 L294 322 Z" fill="url(#oParch)"/><path d="M300 318 l40 -1" stroke="#8a6c44" stroke-width=".8"/>` : ""}
      ${f.chartSpread ? `<g>
        <path d="M288 320 L452 314 L462 324 L284 326 Z" fill="#000" opacity=".35" filter="url(#oBlur)"/>
        <path d="M296 288 L448 284 L456 318 L290 322 Z" fill="url(#oParch)"/>
        <path d="M306 300 q12 -8 22 0 q-8 10 -22 0z M430 294 q10 -6 16 2 q-6 8 -16 -2z M318 312 q6 -4 12 0" fill="#9b8a60"/>
        <path d="M296 288 L372 304 M372 304 L456 318 M372 304 L448 284 M372 304 L290 322" stroke="#8a6c44" stroke-width=".5" opacity=".6"/>
        <circle cx="372" cy="304" r="8" fill="none" stroke="#b0413a" stroke-width="2" stroke-dasharray="3 2.5"/>
        <path d="M424 312 l6 -5 l6 5 l-6 5z" fill="#8a6c44" opacity=".7"/>
      </g>` : ""}

      ${plateOnTable ? `<g>
        <ellipse cx="364" cy="316" rx="38" ry="6" fill="#000" opacity=".45" filter="url(#oBlur)"/>
        <ellipse cx="362" cy="311" rx="35" ry="8" fill="url(#oPlate)"/>
        <ellipse cx="362" cy="311" rx="27" ry="5.5" fill="none" stroke="#8c8472" stroke-width=".8"/>
        <path d="M344 309 q12 -7 26 0 q-14 6 -26 0z" fill="#8a6a44"/>
        <path d="M370 309 l7 -4 v8z" fill="#7a5a38"/>
        <path d="M350 308 h14 M352 310 h12" stroke="#d8c9a8" stroke-width=".6"/>
        <circle cx="347" cy="308" r=".9" fill="#111"/>
        <path d="M384 305 l14 6" stroke="#b8bcc2" stroke-width="2" stroke-linecap="round"/>
      </g>` : `<g>
        <ellipse cx="732" cy="302" rx="28" ry="6" fill="url(#oPlate)"/>
        <path d="M718 300 q10 -5 22 0 q-12 4 -22 0z" fill="#8a6a44"/>
      </g>`}

      <!-- communicator screen and light -->
      <rect x="478" y="270" width="38" height="26" rx="1.5" fill="url(#oScreen)"/>
      ${live ? `<path id="wave" d="M480 283 H514" stroke="#bff0e2" stroke-width="1.5" fill="none"/>` : `<path d="M482 280 h6 M494 286 h8 M486 290 h4" stroke="#2c4644" stroke-width="1"/>`}
      <rect x="478" y="270" width="38" height="4" fill="#fff" opacity=".06"/>
      <circle cx="529" cy="277" r="4" fill="${st === 0 ? "#e0623e" : "#6fbf73"}" class="${st === 0 ? "blink" : ""}"/>
      <circle cx="528" cy="276" r="1.4" fill="#fff" opacity=".6"/>

      ${packetOnTable ? `<g>
        <ellipse cx="558" cy="318" rx="14" ry="3" fill="#000" opacity=".4" filter="url(#oBlur)"/>
        <rect x="546" y="300" width="24" height="17" rx="1" fill="#cdb682"/>
        <rect x="548" y="298" width="22" height="16" rx="1" fill="#dcc896"/>
        <path d="M548 306 h22 M559 298 v16" stroke="#7a5433" stroke-width="1.2"/>
        <circle cx="559" cy="306" r="2.6" fill="#9e2a22"/>
        <path d="M551 311 h8" stroke="#3e7a4a" stroke-width="1.4"/>
      </g>` : ""}

      <!-- hanging lantern (swings with the ship) -->
      <g id="lamp">
        ${[0, 1, 2, 3].map(i => `<ellipse cx="400" cy="${36 + i * 8}" rx="2" ry="4" fill="none" stroke="#3a3e44" stroke-width="1.6"/>`).join("")}
        <path d="M390 66 h20 l4 6 h-28 z" fill="url(#oBrass)"/>
        <rect x="388" y="72" width="24" height="26" fill="url(#oGlass)"/>
        <ellipse id="flame" cx="400" cy="86" rx="3.5" ry="7" fill="#fff6d6"/>
        <path d="M388 72 v26 M400 72 v26 M412 72 v26" stroke="#5a3f1a" stroke-width="1.6"/>
        <path d="M386 98 h28 l-4 6 h-20 z" fill="url(#oBrass)"/>
        <path d="M398 62 h4 v4 h-4z" fill="#3a3e44"/>
      </g>

      <!-- glass on the porthole -->
      <path d="M592 146 q16 -22 44 -24" stroke="#fff" stroke-opacity=".18" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="620" cy="170" r="47" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3"/>

      <!-- hotspots (drawn last so they sit on top) -->
      <rect data-hs="door" x="46" y="106" width="122" height="306"/>
      ${has("coat") ? "" : `<rect data-hs="coat" x="176" y="128" width="84" height="200"/>`}
      ${has("sword") ? "" : `<rect data-hs="sword" x="272" y="94" width="210" height="36"/>`}
      <rect data-hs="porthole" x="560" y="110" width="120" height="120"/>
      <rect data-hs="shelf" x="684" y="188" width="116" height="48"/>
      <rect data-hs="bunk" x="664" y="284" width="136" height="126"/>
      <rect data-hs="bucket" x="598" y="354" width="56" height="58"/>
      <rect data-hs="table" x="226" y="318" width="358" height="16"/>
      <rect data-hs="receipts" x="244" y="294" width="48" height="26"/>
      ${chartUnder || f.chartSpread ? `<rect data-hs="chart" x="290" y="${f.chartSpread ? 282 : 306}" width="140" height="${f.chartSpread ? 40 : 16}"/>` : ""}
      ${plateOnTable ? `<rect data-hs="plate" x="324" y="298" width="78" height="22"/>` : ""}
      <rect data-hs="tides" x="410" y="298" width="46" height="22"/>
      <rect data-hs="comm" x="464" y="222" width="80" height="100"/>
      ${packetOnTable ? `<rect data-hs="packet" x="542" y="292" width="34" height="28"/>` : ""}`;
  }

  function cabinFX(t, dt, L, N, env, st) {
    const sway = Math.sin(t * .8) * .9 + Math.sin(t * .37 + 1) * .35;
    env.tilt(sway);
    const la = -sway * 4.2;
    const lamp = env.q("#lamp"), flame = env.q("#flame"), wave = env.q("#wave");
    if (lamp) lamp.setAttribute("transform", `rotate(${la.toFixed(2)} 400 30)`);
    const fl = .84 + .08 * Math.sin(t * 12) + .05 * Math.sin(t * 27 + 1.3) + .03 * Math.sin(t * 41);
    if (flame) flame.setAttribute("ry", (6 + 2 * Math.sin(t * 19)).toFixed(2));
    const a = la * Math.PI / 180;
    const lx = 400 - Math.sin(a) * 56, ly = 30 + Math.cos(a) * 56;

    // lantern light across the cabin
    let g = L.createRadialGradient(lx, ly, 4, lx, ly, 460);
    g.addColorStop(0, `rgba(255,196,110,${(.5 * fl).toFixed(3)})`);
    g.addColorStop(.18, `rgba(230,150,60,${(.24 * fl).toFixed(3)})`);
    g.addColorStop(.55, `rgba(160,90,30,${(.08 * fl).toFixed(3)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    L.fillStyle = g; L.fillRect(0, 0, 800, 480);
    g = L.createRadialGradient(lx, ly, 0, lx, ly, 30);
    g.addColorStop(0, "rgba(255,240,200,.9)"); g.addColorStop(1, "rgba(0,0,0,0)");
    L.fillStyle = g; L.fillRect(lx - 30, ly - 30, 60, 60);
    motes(L, st.motes, dt, t, lx, ly + 120, 320, .55);

    // the sea outside the porthole, level with the world while the cabin tilts
    N.save();
    N.beginPath(); N.arc(620, 170, 47, 0, TAU); N.clip();
    N.translate(620, 170); N.rotate(-sway * Math.PI / 180 * 1.6); N.translate(-620, -170);
    g = N.createLinearGradient(0, 120, 0, 175);
    g.addColorStop(0, "#08111d"); g.addColorStop(1, "#1d3550");
    N.fillStyle = g; N.fillRect(560, 110, 120, 70);
    N.fillStyle = "rgba(242,234,206,.25)"; N.beginPath(); N.arc(642, 146, 16, 0, TAU); N.fill();
    N.fillStyle = "#efe7cc"; N.beginPath(); N.arc(642, 146, 8, 0, TAU); N.fill();
    const hz = 176;
    g = N.createLinearGradient(0, hz, 0, 225);
    g.addColorStop(0, "#1b3450"); g.addColorStop(1, "#050c16");
    N.fillStyle = g; N.fillRect(560, hz, 120, 60);
    for (let i = 0; i < 9; i++) {
      const y = hz + 3 + i * 5 + i * i * .3;
      N.strokeStyle = `rgba(150,185,215,${(.35 - i * .03).toFixed(3)})`; N.lineWidth = 1;
      N.beginPath();
      for (let x = 568; x <= 672; x += 4) {
        const yy = y + Math.sin(x * .09 + t * (1.2 + i * .1) + i) * (1 + i * .3);
        x === 568 ? N.moveTo(x, yy) : N.lineTo(x, yy);
      }
      N.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const y = hz + 2 + i * 4;
      const w = 4 + i * 1.5, x = 642 + Math.sin(t * 1.8 + i * 1.3) * (2 + i);
      N.fillStyle = `rgba(245,236,205,${(.45 - i * .04).toFixed(3)})`;
      N.fillRect(x - w / 2, y, w, 1.2);
    }
    N.restore();

    // the leak, dripping into the bucket
    st.drip -= dt;
    if (st.drip <= 0 && !st.drop) { st.drop = { y: 52, v: 0 }; st.drip = 2.2 + Math.random() * 1.6; }
    if (st.drop) {
      const d = st.drop; d.v += 900 * dt; d.y += d.v * dt;
      if (d.y >= 377) { st.ripple = { age: 0 }; st.drop = null; }
      else { L.fillStyle = "rgba(190,215,235,.85)"; L.beginPath(); L.ellipse(626, d.y, 1.5, 2.8, 0, 0, TAU); L.fill(); }
    }
    if (st.ripple) {
      const r = st.ripple; r.age += dt;
      const k = r.age / .6;
      if (k >= 1) st.ripple = null;
      else { N.strokeStyle = `rgba(160,190,210,${(.6 * (1 - k)).toFixed(3)})`; N.lineWidth = 1; N.beginPath(); N.ellipse(626, 377, 3 + k * 17, 1 + k * 3, 0, 0, TAU); N.stroke(); }
    }

    // Shannon's signal on the communicator screen
    if (wave) {
      let d = "M480 283";
      for (let x = 482; x <= 514; x += 2) d += ` L${x} ${(283 + Math.sin(x * .6 + t * 9) * (3 + 2 * Math.sin(t * 3 + x)) * (.5 + .5 * Math.sin(t * 2.3))).toFixed(1)}`;
      wave.setAttribute("d", d);
      g = L.createRadialGradient(497, 283, 2, 497, 283, 46);
      g.addColorStop(0, "rgba(120,220,200,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
      L.fillStyle = g; L.fillRect(450, 236, 94, 94);
    }
  }

  // ===================================================================
  // registry
  // ===================================================================
  const SCENES = {
    title: {
      img: "art/crew.jpg", bg: titleBG, fx: emberFX,
      init: r => ({ embers: Array.from({ length: 40 }, () => ({ x: r() * 800, y: r() * 480, v: 8 + r() * 20, s: .6 + r() * 1.4, p: r() * TAU, m: .5 + r() * .5 })) })
    },
    frame: {
      bg: frameBG, ov: frameOV, fx: frameFX,
      init: r => ({
        rain: Array.from({ length: 50 }, () => ({ x: 330 + r() * 140, y: 30 + r() * 230, v: 260 + r() * 160 })),
        beads: Array.from({ length: 14 }, () => ({ x: 336 + r() * 128, y: 60 + r() * 190, v: 4 + r() * 18 })),
        embers: Array.from({ length: 22 }, () => { const side = r(); return side < .5 ? { x: 292 + r() * 234, y: side < .25 ? 332 + r() * 6 : 410 + r() * 6, f: 1 + r() * 3, p: r() * TAU } : { x: side < .75 ? 292 + r() * 6 : 520 + r() * 8, y: 330 + r() * 84, f: 1 + r() * 3, p: r() * TAU }; }),
        motes: makeMotes(r, 40, 60, 60, 420, 320)
      })
    },
    lily: {
      bg: lilyBG, fx: lilyFX,
      init: r => ({
        beams: [
          { x0: 110, y0: 150, x1: 380, y1: 480, w0: 22, w1: 70, p: 0 },
          { x0: 190, y0: 150, x1: 520, y1: 480, w0: 16, w1: 55, p: 2 },
          { x0: 150, y0: 230, x1: 430, y1: 480, w0: 10, w1: 34, p: 4 }
        ],
        motes: makeMotes(r, 60, 120, 160, 400, 300)
      })
    },
    village: {
      bg: villageBG, fx: villageFX,
      init: r => ({
        spark: Array.from({ length: 70 }, () => { const y = 236 + r() * 170; return { x: r() * 800, y: y > 400 ? 412 + r() * 60 : (y < 300 || r() < .4 ? y : 236 + r() * 30), w: 2 + r() * 8, f: .6 + r() * 1.6, p: r() * TAU, m: .9 }; }),
        smoke: [[292, 202], [520, 214], [360, 262], [470, 250], [230, 282]].flatMap(([x, y]) => Array.from({ length: 6 }, (_, i) => ({ x0: x, y0: y - 16, age: i * 1.1, life: 6.6, rise: 70, r0: 2, grow: 10, drift: .4, a: .35 }))),
        gulls: Array.from({ length: 6 }, (_, i) => { const y = 60 + r() * 120; return { x: r() * 800, y, y0: y, vx: 18 + r() * 20, vy: 0, s: .7 + r() * .5, f: 5 + r() * 2, p: r() * TAU }; })
      })
    },
    porch: {
      bg: porchBG, fx: porchFX,
      init: r => ({
        spark: Array.from({ length: 50 }, () => ({ x: 150 + r() * 650, y: 204 + r() * 30, w: 2 + r() * 7, f: .6 + r() * 1.6, p: r() * TAU, m: .9 })),
        petals: Array.from({ length: 8 }, () => ({ x: r() * 800, y: 40 + r() * 300, vx: 24 + r() * 20, vy: 10 + r() * 10, rot: r() * 6, vr: 1 + r() * 2, p: r() * TAU, c: r() < .5 ? "#a86cc0" : "#8b4fa3" }))
      })
    },
    fog: {
      bg: fogBG, fx: fogFX,
      init: r => {
        const puff = document.createElement("canvas");
        puff.width = 256; puff.height = 96;
        const c = puff.getContext("2d");
        for (let i = 0; i < 26; i++) {
          const x = 30 + r() * 196, y = 30 + r() * 36, rad = 18 + r() * 26;
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, "rgba(245,238,222,.5)"); g.addColorStop(1, "rgba(245,238,222,0)");
          c.fillStyle = g; c.fillRect(0, 0, 256, 96);
        }
        return {
          puff,
          fog: Array.from({ length: 9 }, () => ({ x: -200 + r() * 1000, y: 160 + r() * 110, w: 300 + r() * 260, h: 90 + r() * 60, v: 6 + r() * 10, a: .5 + r() * .4, p: r() * TAU })),
          spark: Array.from({ length: 80 }, () => ({ x: r() * 800, y: 262 + r() * 150, w: 2 + r() * 9, f: .6 + r() * 1.6, p: r() * TAU, m: .8 })),
          birds: Array.from({ length: 12 }, () => { const y = 300 + r() * 80; return { x: 300 + r() * 220, y, y0: 320 + r() * 60, vx: (r() - .5) * 40, vy: -16 - r() * 18, s: .8 + r() * .5, f: 6 + r() * 3, p: r() * TAU }; })
        };
      }
    },
    bell: { bg: bellBG, fx: bellFX, init: () => ({}), shake: true },
    black: { bg: () => wrap(`<rect width="800" height="480" fill="#000"/>`), fx: () => {}, init: () => ({}) },
    burning: {
      bg: burningBG, fx: burningFX,
      init: r => ({
        smoke: [[330, 250], [420, 230], [500, 260], [380, 300], [460, 290]].flatMap(([x, y]) => Array.from({ length: 7 }, (_, i) => ({ x0: x, y0: y, age: i * 1.2, life: 8.4, rise: 200, r0: 8, grow: 50, drift: -.6, a: .5 }))),
        embers: Array.from({ length: 60 }, () => ({ x: 260 + r() * 320, y: 80 + r() * 280, v: 20 + r() * 40, p: r() * TAU })),
        next: 1, flash: null
      })
    },
    card: {
      bg: cardBG, ov: cardOV, fx: emberFX,
      init: r => ({ embers: Array.from({ length: 30 }, () => ({ x: r() * 800, y: r() * 480, v: 6 + r() * 16, s: .6 + r() * 1.4, p: r() * TAU, m: .6 + r() * .4 })) })
    },
    cabin: {
      bg: cabinBG, ov: cabinOV, fx: cabinFX, sway: true,
      init: r => ({ motes: makeMotes(r, 50, 200, 60, 420, 340), drip: 1.2, drop: null, ripple: null })
    }
  };

  // ===================================================================
  // runtime: layers, the animation loop, and scene changes
  // ===================================================================
  const urls = {};
  function bgURL(key) {
    if (!urls[key]) urls[key] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SCENES[key].bg());
    return urls[key];
  }

  let els = null, cur = null, curKey = null, st = null, t0 = 0, last = 0, raf = 0, tiltDeg = 0, shakeUntil = 0, which = 0, ovData = null;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(stage) {
    stage.insertAdjacentHTML("afterbegin", `<div id="world"><img class="bg" alt=""><img class="bg" alt=""><div id="grade"></div><canvas id="fxN"></canvas><div id="ov"></div><canvas id="chr"></canvas><canvas id="fxL"></canvas></div>`);
    els = {
      stage,
      world: stage.querySelector("#world"),
      imgs: [...stage.querySelectorAll("#world img")],
      N: stage.querySelector("#fxN"),
      L: stage.querySelector("#fxL"),
      C: stage.querySelector("#chr"),
      ov: stage.querySelector("#ov"),
      grade: stage.querySelector("#grade")
    };
    const size = () => {
      const w = els.world.clientWidth, h = els.world.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [els.N, els.L, els.C]) { c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); }
    };
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(els.world); else window.addEventListener("resize", size);
  }

  const env = {
    tilt(deg) { tiltDeg = deg; },
    q(sel) { return els.ov.querySelector(sel); }
  };

  function frame(ts) {
    raf = 0;
    if (!cur) return;
    const t = (ts - t0) / 1000;
    const dt = Math.min(.05, last ? (ts - last) / 1000 : .016);
    last = ts;
    const N = els.N.getContext("2d"), L = els.L.getContext("2d"), C = els.C.getContext("2d");
    // the canvases cover the 800x480 scene exactly (slice-fit like the images)
    const k = Math.max(els.N.width / 800, els.N.height / 480);
    const ox = (els.N.width - 800 * k) / 2, oy = (els.N.height - 480 * k) / 2;
    for (const c of [N, L, C]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, els.N.width, els.N.height); c.setTransform(k, 0, 0, k, ox, oy); }
    tiltDeg = 0;
    cur.fx(t, dt, L, N, env, st);
    if (window.ACTORS) window.ACTORS.draw(C, t, dt);
    let tf = cur.sway && !reduced ? `rotate(${tiltDeg.toFixed(3)}deg) scale(1.06)` : "";
    if (ts < shakeUntil && !reduced) {
      const a = (shakeUntil - ts) / 900 * 6;
      tf += ` translate(${((Math.random() - .5) * a).toFixed(2)}px, ${((Math.random() - .5) * a).toFixed(2)}px)`;
    }
    els.world.style.transform = tf;
    raf = requestAnimationFrame(frame);
  }

  function renderOV(S) {
    const svg = cur.ov ? cur.ov(S, ovData) : "";
    els.ov.innerHTML = `<svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice">${svg}</svg>`;
  }

  function show(key, S, data) {
    const same = key === curKey;
    ovData = data || null;
    if (same) { renderOV(S); return; }
    cur = SCENES[key]; curKey = key;
    if (window.ACTORS) window.ACTORS.setScene(key);
    st = cur.init ? cur.init(rng(key.length * 97 + 5)) : {};
    which = 1 - which;
    const inc = els.imgs[which], out = els.imgs[1 - which];
    inc.style.opacity = "0";
    inc.onload = () => { inc.style.opacity = "1"; out.style.opacity = "0"; };
    inc.src = cur.img || bgURL(key);
    // Scenes drawn in code get a color grade toward the family's painted style.
    els.grade.hidden = !!cur.img;
    inc.classList.toggle("painted", !cur.img);
    if (inc.complete && inc.naturalWidth) inc.onload();
    renderOV(S);
    if (cur.shake) shakeUntil = performance.now() + 900;
    t0 = performance.now(); last = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function refresh(S) { if (cur) renderOV(S); }

  // Warm the image cache so scene changes don't flash.
  function preload() {
    const keys = Object.keys(SCENES);
    let i = 0;
    const next = () => {
      if (i >= keys.length) return;
      const img = new Image();
      img.onload = img.onerror = () => setTimeout(next, 30);
      const sc = SCENES[keys[i++]];
      img.src = sc.img || bgURL(keys[i - 1]);
    };
    next();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && cur && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  });

  window.ART = { mount, show, refresh, preload, scenes: Object.keys(SCENES) };
})();
