/* The Blacksteel Pirates: animated characters.
 *
 * Characters are jointed rigs drawn in code: hips, knees, ankles, shoulders and elbows
 * driven by a walk cycle, with a coat that swings and trails. Feet plant on the floor
 * because the walk cycle advances with the distance walked, not with time.
 *
 * The look of each character (LOOKS) follows the family's paintings.
 */
(function () {
  "use strict";
  const D = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- character looks ----------
  const LOOKS = {
    sean: {
      skin: ["#6e4a31", "#b98a64", "#d8a982"],
      beard: "#17110d", beardHi: "#3d3029",
      glasses: true,
      coat: ["#07090c", "#1c2128", "#2e343d"],
      trim: "#b8914f",
      shirt: "#121418",
      sash: ["#2c1838", "#6a4585"],
      pants: ["#0a0c0f", "#23272d"],
      boots: ["#060607", "#26221f"],
      cuff: "#171a1e",
      sword: true,
      broad: 1.14
    }
  };

  // Rig proportions for a 240-unit-tall figure, feet at y = 0, facing +x.
  const G = { hip: -118, shoulder: -194, thigh: 56, shin: 52, upper: 44, fore: 40, foot: 25 };

  // ---------- drawing helpers ----------
  function limb(c, x1, y1, x2, y2, w1, w2, cols) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const g = c.createLinearGradient(x1 + nx * w1, y1 + ny * w1, x1 - nx * w1, y1 - ny * w1);
    g.addColorStop(0, cols[0]); g.addColorStop(.38, cols[1]); g.addColorStop(1, cols[0]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x1 + nx * w1, y1 + ny * w1);
    c.lineTo(x2 + nx * w2, y2 + ny * w2);
    c.arc(x2, y2, w2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI);
    c.lineTo(x1 - nx * w1, y1 - ny * w1);
    c.arc(x1, y1, w1, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI);
    c.closePath();
    c.fill();
  }
  const dir = a => [Math.sin(a * D), Math.cos(a * D)];

  function darker(cols, k) {
    return cols.map(h => {
      const n = parseInt(h.slice(1), 16);
      const r = (n >> 16) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k;
      return `rgb(${r | 0},${g | 0},${b | 0})`;
    });
  }

  // ---------- the walk cycle ----------
  // ph: phase of this leg. amp: 0 standing .. 1 full stride.
  function legPose(ph, amp, idleOffset) {
    const th = amp * 24 * Math.sin(ph) + (1 - amp) * idleOffset;
    const swing = Math.max(0, Math.cos(ph + .5));
    const kn = 5 + amp * 46 * swing * swing;
    const toeDown = amp * 24 * Math.pow(Math.max(0, Math.cos(ph + .7)), 2);
    const heel = amp * 9 * Math.pow(Math.max(0, Math.sin(ph)), 8);
    return { th, kn, foot: heel - toeDown };
  }

  function solveLeg(hx, hy, p) {
    const [tx, ty] = dir(p.th);
    const kx = hx + tx * G.thigh, ky = hy + ty * G.thigh;
    const [sx, sy] = dir(p.th - p.kn);
    const ax = kx + sx * G.shin, ay = ky + sy * G.shin;
    const f = p.foot * D;
    const hx2 = ax - 5, hy2 = ay + 7;
    const toeX = hx2 + Math.cos(f) * G.foot, toeY = hy2 - Math.sin(f) * G.foot;
    return { kx, ky, ax, ay, heelX: hx2, heelY: hy2, toeX, toeY, f };
  }

  function drawLeg(c, hx, hy, leg, look, far) {
    const pants = far ? darker(look.pants, .6) : look.pants;
    const boots = far ? darker(look.boots, .6) : look.boots;
    limb(c, hx, hy, leg.kx, leg.ky, 11, 9, pants);
    // boot shaft up the shin, with a turned-down cuff
    limb(c, leg.kx, leg.ky, leg.ax, leg.ay, 9, 7.5, pants);
    const mx = leg.kx + (leg.ax - leg.kx) * .45, my = leg.ky + (leg.ay - leg.ky) * .45;
    limb(c, mx, my, leg.ax, leg.ay, 9.5, 8, boots);
    c.fillStyle = far ? "#0d0e10" : look.cuff;
    c.save(); c.translate(mx, my); c.rotate(Math.atan2(leg.ay - leg.ky, leg.ax - leg.kx) - Math.PI / 2);
    c.fillRect(-10.5, -3, 21, 6); c.restore();
    // boot foot
    c.save();
    c.translate(leg.heelX, leg.heelY);
    c.rotate(-leg.f);
    const g = c.createLinearGradient(0, -12, 0, 0);
    g.addColorStop(0, boots[1]); g.addColorStop(1, boots[0]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-2, 0); c.lineTo(-2, -12); c.quadraticCurveTo(10, -16, 18, -9);
    c.quadraticCurveTo(G.foot + 3, -6, G.foot + 2, 0); c.closePath(); c.fill();
    c.fillStyle = "#050505"; c.fillRect(-3, -2, G.foot + 6, 3);
    c.restore();
  }

  function drawArm(c, sx, sy, a1, a2, look, far, reach) {
    const coat = far ? darker(look.coat, .55) : look.coat;
    const [ux, uy] = dir(a1);
    const ex = sx + ux * G.upper, ey = sy + uy * G.upper;
    const [fx, fy] = dir(a2);
    const wx = ex + fx * G.fore, wy = ey + fy * G.fore;
    limb(c, sx, sy, ex, ey, 10, 8.5, coat.slice(0, 2));
    limb(c, ex, ey, wx, wy, 8.5, 7.5, coat.slice(0, 2));
    // brass-trimmed cuff
    const cx = ex + (wx - ex) * .8, cy = ey + (wy - ey) * .8;
    limb(c, cx, cy, wx, wy, 8.8, 8, far ? ["#1b150c", "#5a4424"] : ["#3a2c14", look.trim]);
    // hand
    const sk = far ? darker(look.skin, .6) : look.skin;
    const [hx, hy] = dir(a2 + (reach ? -10 : 8));
    const g = c.createRadialGradient(wx + hx * 5, wy + hy * 5, 1, wx + hx * 5, wy + hy * 5, 8);
    g.addColorStop(0, sk[2]); g.addColorStop(1, sk[0]);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(wx + hx * 6, wy + hy * 6, 6.2, 7.5, -(a2 * D), 0, Math.PI * 2); c.fill();
    return { wx, wy };
  }

  function drawHead(c, x, y, look, t) {
    const sk = look.skin;
    // neck
    limb(c, x - 3, y + 24, x - 1, y + 10, 7.5, 7, [sk[0], sk[1]]);
    // skull
    let g = c.createRadialGradient(x + 2, y - 8, 2, x, y, 20);
    g.addColorStop(0, sk[2]); g.addColorStop(.55, sk[1]); g.addColorStop(1, sk[0]);
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y - 1, 14.5, 16.5, .05, 0, Math.PI * 2); c.fill();
    // lantern shine on the bald head
    c.fillStyle = "rgba(255,225,180,.35)";
    c.beginPath(); c.ellipse(x - 2, y - 12, 7, 3.2, -.3, 0, Math.PI * 2); c.fill();
    // nose
    c.fillStyle = sk[1];
    c.beginPath(); c.moveTo(x + 12, y - 5); c.quadraticCurveTo(x + 20, y + 2, x + 17.5, y + 5); c.lineTo(x + 12, y + 5); c.fill();
    // ear
    c.fillStyle = sk[0];
    c.beginPath(); c.ellipse(x - 5, y + 1, 3.4, 5.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk[1];
    c.beginPath(); c.ellipse(x - 4.4, y + 1, 1.8, 3.4, 0, 0, Math.PI * 2); c.fill();
    // beard: full and trimmed, from the ear down around the jaw
    g = c.createLinearGradient(x - 6, y, x + 16, y + 20);
    g.addColorStop(0, look.beard); g.addColorStop(1, look.beardHi);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 3, y - 2);
    c.quadraticCurveTo(x - 4, y + 14, x + 4, y + 21);
    c.quadraticCurveTo(x + 12, y + 25, x + 17, y + 17);
    c.quadraticCurveTo(x + 19, y + 12, x + 17, y + 8);
    c.lineTo(x + 11, y + 8);
    c.quadraticCurveTo(x + 6, y + 6, x + 5, y + 1);
    c.quadraticCurveTo(x + 1, y - 1, x - 3, y - 2);
    c.fill();
    // moustache and mouth
    c.beginPath(); c.moveTo(x + 10, y + 7); c.quadraticCurveTo(x + 16, y + 5, x + 18.5, y + 8.5); c.quadraticCurveTo(x + 14, y + 9, x + 10, y + 9); c.fill();
    c.strokeStyle = "#5a2f22"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x + 13, y + 11); c.lineTo(x + 17, y + 11); c.stroke();
    c.strokeStyle = "rgba(120,110,100,.35)"; c.lineWidth = .7;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(x + i * 2.5 - 1, y + 8 + (i % 3)); c.lineTo(x + i * 2.5, y + 15 + (i % 2) * 3); c.stroke(); }
    // brow and eye (blinks now and then)
    c.strokeStyle = look.beard; c.lineWidth = 2.6; c.lineCap = "round";
    c.beginPath(); c.moveTo(x + 6, y - 7); c.lineTo(x + 15, y - 6.5); c.stroke();
    const blink = (t % 4.2) < .12;
    c.fillStyle = "#1a120e";
    if (blink) c.fillRect(x + 10, y - 2.5, 5, 1.2);
    else { c.beginPath(); c.ellipse(x + 12.5, y - 2, 2, 2.4, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(x + 12.8, y - 3.3, 1, 1); }
    // glasses: thin frame, lens, arm back to the ear
    if (look.glasses) {
      c.strokeStyle = "#8f877c"; c.lineWidth = 1.3;
      c.beginPath(); c.roundRect ? c.roundRect(x + 8, y - 5.5, 9, 7, 2) : c.rect(x + 8, y - 5.5, 9, 7); c.stroke();
      c.beginPath(); c.moveTo(x + 8, y - 3); c.lineTo(x - 4, y - 2); c.stroke();
      c.fillStyle = "rgba(200,220,235,.12)"; c.fillRect(x + 8.5, y - 5, 8, 6);
      c.strokeStyle = "rgba(255,245,220,.8)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 14.5, y - 4.5); c.lineTo(x + 16, y - 3); c.stroke();
    }
  }

  // ---------- the full figure ----------
  // Draws a character with feet at (x, y), height h. face: 1 right, -1 left.
  function drawRig(c, look, x, y, h, face, st, t) {
    const amp = st.amp, ph = st.phase;
    const near = legPose(ph, amp, 4), far = legPose(ph + Math.PI, amp, -5);
    // solve both legs from a hip at the origin, then drop the body so the lowest foot touches the floor
    let L1 = solveLeg(0, 0, near), L2 = solveLeg(4, 0, far);
    const low = Math.max(L1.heelY, L1.toeY, L2.heelY, L2.toeY);
    const hipY = -low;
    L1 = solveLeg(0, hipY, near); L2 = solveLeg(4, hipY, far);
    const breathe = Math.sin(t * 1.6) * .8 * (1 - amp);
    const lean = amp * 3;
    const shX = 3 + lean * 1.2, shY = hipY + (G.shoulder - G.hip) + breathe;

    c.save();
    c.translate(x, y);
    c.scale(face * h / 240 * (look.broad || 1), h / 240);

    // arms swing opposite the legs; a reach gesture lifts the near arm
    const r = st.reach || 0;
    const nearA1 = (-amp * 22 * Math.sin(ph + Math.PI)) * (1 - r) + 74 * r;
    const nearA2 = nearA1 + (12 + amp * 26 * Math.max(0, Math.sin(ph))) * (1 - r) + 8 * r;
    const farA1 = -amp * 22 * Math.sin(ph) - 3 * (1 - amp);
    const farA2 = farA1 + 12 + amp * 26 * Math.max(0, -Math.sin(ph));

    // behind the body: far arm, sword, far leg
    drawArm(c, shX - 2, shY + 2, farA1, farA2, look, true, false);
    if (look.sword) {
      c.save(); c.translate(6, hipY - 6); c.rotate((122 + amp * 5 * Math.sin(ph * 2)) * D);
      const g = c.createLinearGradient(0, -3, 0, 4);
      g.addColorStop(0, "#5c6067"); g.addColorStop(1, "#16181b");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(40, -5, 78, 2); c.lineTo(78, 6); c.quadraticCurveTo(40, 2, 0, 4); c.closePath(); c.fill();
      c.fillStyle = "#7c8087"; c.fillRect(74, 0, 6, 6); c.fillRect(0, -4, 5, 9);
      c.restore();
    }
    drawLeg(c, 4, hipY, L2, look, true);
    drawLeg(c, 0, hipY, L1, look, false);

    // coat: open at the front, hem at the knees, back hem trailing when walking
    const trail = amp * (10 + 5 * Math.sin(ph * 2)) + Math.sin(t * 1.3) * 1.2;
    const hemY = hipY + 64;
    const frontHem = Math.max(L1.kx, L2.kx) + 9;
    let g = c.createLinearGradient(-26, 0, 20, 0);
    g.addColorStop(0, look.coat[0]); g.addColorStop(.55, look.coat[1]); g.addColorStop(.85, look.coat[2]); g.addColorStop(1, look.coat[1]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(shX - 10, shY - 12);
    c.lineTo(shX - 17, shY + 2);
    c.quadraticCurveTo(-19, hipY - 30, -19, hipY);
    c.quadraticCurveTo(-24 - trail * .6, hipY + 34, -30 - trail, hemY + 2);
    c.quadraticCurveTo((frontHem - 30) / 2, hemY + 10, frontHem, hemY - 2);
    c.quadraticCurveTo(frontHem - 6, hipY + 20, 13, hipY - 2);
    c.lineTo(shX + 14, shY + 12);
    c.lineTo(shX + 9, shY - 12);
    c.closePath();
    c.fill();
    // coat seam and back vent
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-14, hipY + 8); c.quadraticCurveTo(-20 - trail * .5, hipY + 40, -24 - trail * .8, hemY); c.stroke();
    // brass trim down the front and along the hem
    c.strokeStyle = look.trim; c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(shX + 9, shY - 12); c.lineTo(shX + 14, shY + 12); c.lineTo(13, hipY - 2);
    c.quadraticCurveTo(frontHem - 6, hipY + 20, frontHem, hemY - 2);
    c.quadraticCurveTo((frontHem - 30) / 2, hemY + 10, -30 - trail, hemY + 2);
    c.stroke();
    // open front: shirt, a glimpse of chest, purple sash
    c.fillStyle = look.shirt;
    c.beginPath(); c.moveTo(shX + 9, shY - 10); c.lineTo(shX + 17, shY + 12); c.lineTo(16, hipY - 4); c.lineTo(12, hipY - 4); c.lineTo(shX + 12, shY + 10); c.closePath(); c.fill();
    c.fillStyle = look.skin[0];
    c.beginPath(); c.moveTo(shX + 10, shY - 10); c.lineTo(shX + 15, shY + 4); c.lineTo(shX + 12, shY + 3); c.closePath(); c.fill();
    g = c.createLinearGradient(0, hipY - 16, 0, hipY);
    g.addColorStop(0, look.sash[1]); g.addColorStop(1, look.sash[0]);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-18, hipY - 16); c.lineTo(19, hipY - 18); c.lineTo(20, hipY - 3); c.lineTo(-18, hipY - 1); c.closePath(); c.fill();
    const sw = amp * 8 * Math.sin(ph * 2 + 1) + Math.sin(t * 1.1) * 1.5;
    c.beginPath(); c.moveTo(14, hipY - 6); c.quadraticCurveTo(22 + sw * .3, hipY + 12, 18 + sw, hipY + 28); c.lineTo(12 + sw, hipY + 27); c.quadraticCurveTo(14, hipY + 10, 9, hipY - 4); c.fill();
    // Nightforge's hilt, forward of the hip: plain and gray
    if (look.sword) {
      c.save(); c.translate(8, hipY - 8); c.rotate(-58 * D);
      c.fillStyle = "#2b1d14"; c.fillRect(0, -3, 17, 6);
      c.strokeStyle = "#6d7178"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(9, -12, 18, -4); c.stroke();
      c.fillStyle = "#6d7178"; c.beginPath(); c.arc(18, 0, 3, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    // buttons
    c.fillStyle = look.trim;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(shX + 15 - i * .8, shY + 18 + i * 12, 1.6, 0, Math.PI * 2); c.fill(); }
    // shoulder with a brass epaulette edge, and a stand collar
    c.fillStyle = look.coat[2];
    c.beginPath(); c.ellipse(shX - 1, shY + 2, 14, 8, 0, Math.PI, Math.PI * 2); c.fill();
    c.strokeStyle = look.trim; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(shX - 1, shY + 2, 14, 8, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.fillStyle = look.coat[1];
    c.beginPath(); c.moveTo(shX - 12, shY - 10); c.lineTo(shX - 10, shY - 24); c.lineTo(shX + 3, shY - 16); c.lineTo(shX + 8, shY - 8); c.closePath(); c.fill();

    drawHead(c, shX + 1, shY - 30, look, t);
    const hand = drawArm(c, shX + 1, shY + 2, nearA1, nearA2, look, false, r > .3);

    // rim light from the lantern along the back edge
    c.strokeStyle = "rgba(255,190,110,.28)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(shX - 17, shY + 2); c.quadraticCurveTo(-19, hipY - 30, -19, hipY); c.stroke();
    c.restore();
    return hand;
  }

  // ---------- walkers ----------
  const FLOORS = {
    cabin: { x0: 70, x1: 740, y0: 420, y1: 472, hBack: 236, hFront: 266 }
  };

  function Walker(name) {
    this.name = name;
    this.look = LOOKS[name];
    this.x = 330; this.y = 446;
    this.face = 1;
    this.target = null;
    this.phase = 0;
    this.amp = 0;
    this.reach = 0;
    this.reachT = -1;
    this.done = null;
    this.speed = 120;
  }
  Walker.prototype.place = function (x, y, face) {
    this.x = x; this.y = y; if (face) this.face = face;
    this.target = null; this.amp = 0; this.finish();
  };
  Walker.prototype.walkTo = function (x, y, face) {
    const f = FLOORS[ACTORS.scene];
    if (!f) return Promise.resolve();
    x = clamp(x, f.x0, f.x1);
    y = clamp(y, f.y0, f.y1);
    this.finish();
    if (Math.hypot(x - this.x, y - this.y) < 3) { if (face) this.face = face; return Promise.resolve(); }
    this.target = { x, y, face };
    return new Promise(res => { this.done = res; });
  };
  Walker.prototype.faceTo = function (x) { if (Math.abs(x - this.x) > 8) this.face = x > this.x ? 1 : -1; };
  // Reach toward something: the near arm lifts, holds, and comes back down.
  Walker.prototype.gesture = function () {
    this.reachT = 0;
    return new Promise(res => setTimeout(res, 520));
  };
  Walker.prototype.finish = function () {
    if (this.done) { const d = this.done; this.done = null; d(); }
  };
  Walker.prototype.height = function () {
    const f = FLOORS[ACTORS.scene];
    return f ? f.hBack + (f.hFront - f.hBack) * (this.y - f.y0) / (f.y1 - f.y0) : 240;
  };
  Walker.prototype.update = function (dt) {
    const h = this.height(), k = h / 240;
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * k * dt * (.35 + .65 * this.amp);
      if (Math.abs(dx) > 1) this.face = dx > 0 ? 1 : -1;
      if (d <= step) {
        this.x = this.target.x; this.y = this.target.y;
        if (this.target.face) this.face = this.target.face;
        this.target = null;
        this.finish();
      } else {
        this.x += dx / d * step; this.y += dy / d * step;
        // one full cycle (two steps) covers about 176 rig units: the feet stay planted
        this.phase += step / (176 * k) * Math.PI * 2;
      }
      this.amp = Math.min(1, this.amp + dt * 5);
    } else {
      this.amp = Math.max(0, this.amp - dt * 4);
      // settle into a standing pose
      if (this.amp === 0) this.phase = 0;
    }
    if (this.reachT >= 0) {
      this.reachT += dt;
      const u = this.reachT / .55;
      this.reach = u < .35 ? u / .35 : u < .7 ? 1 : Math.max(0, 1 - (u - .7) / .3);
      if (u >= 1) { this.reachT = -1; this.reach = 0; }
    }
  };
  Walker.prototype.draw = function (c, t) {
    const h = this.height();
    const g = c.createRadialGradient(this.x, this.y, 2, this.x, this.y, h * .2);
    g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.beginPath(); c.ellipse(this.x, this.y, h * .2, h * .04, 0, 0, Math.PI * 2); c.fill();
    drawRig(c, this.look, this.x, this.y, h, this.face, this, t);
  };

  const ACTORS = {
    scene: null,
    sean: new Walker("sean"),
    setScene(key) { this.scene = FLOORS[key] ? key : null; },
    floor(key) { return FLOORS[key || this.scene] || null; },
    draw(c, t, dt) {
      if (!this.scene) return;
      this.sean.update(dt);
      this.sean.draw(c, t);
    },
    // for previews and tests
    drawRig: (c, name, x, y, h, face, pose, t) => drawRig(c, LOOKS[name], x, y, h, face, pose, t || 0),
    LOOKS
  };
  window.ACTORS = ACTORS;
})();
