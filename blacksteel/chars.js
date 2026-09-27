/* The Blacksteel Pirates: walking characters.
 *
 * Sean walks where you tap, turns, and gets larger as he comes toward the front.
 * He is drawn as a stand-in silhouette until real artwork is added to SPRITES below.
 *
 * To use real artwork, add a sprite sheet (PNG with a transparent background):
 *   one row per direction, frames left to right, the feet at the bottom center of each frame.
 *   SPRITES.sean = { src: "art/sean.png", fw: 160, fh: 320, walk: 8, rows: { right: 0, left: 1 }, idleFrame: 0 };
 */
(function () {
  "use strict";

  const SPRITES = {
    sean: null
  };

  // Where people can walk in each scene (scene coordinates, 800x480), and how big they are there.
  const FLOORS = {
    cabin: { x0: 70, x1: 740, y0: 420, y1: 472, hBack: 214, hFront: 246 }
  };

  const images = {};
  function sheet(name) {
    const sp = SPRITES[name];
    if (!sp) return null;
    if (!images[name]) { images[name] = new Image(); images[name].src = sp.src; }
    return images[name].complete && images[name].naturalWidth ? images[name] : null;
  }

  function Walker(name) {
    this.name = name;
    this.x = 330; this.y = 446;
    this.face = 1;          // 1 = right, -1 = left
    this.target = null;
    this.phase = 0;
    this.done = null;
    this.speed = 150;
  }
  Walker.prototype.place = function (x, y, face) {
    this.x = x; this.y = y; if (face) this.face = face;
    this.target = null; this.finish();
  };
  Walker.prototype.walkTo = function (x, y, face) {
    const f = FLOORS[ACTORS.scene];
    if (!f) return Promise.resolve();
    x = Math.max(f.x0, Math.min(f.x1, x));
    y = Math.max(f.y0, Math.min(f.y1, y));
    this.finish();
    if (Math.hypot(x - this.x, y - this.y) < 3) { if (face) this.face = face; return Promise.resolve(); }
    this.target = { x, y, face };
    return new Promise(res => { this.done = res; });
  };
  Walker.prototype.finish = function () {
    if (this.done) { const d = this.done; this.done = null; d(); }
  };
  Walker.prototype.update = function (dt) {
    if (!this.target) { this.phase *= .85; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * this.scale() * dt;
    if (Math.abs(dx) > 1) this.face = dx > 0 ? 1 : -1;
    if (d <= step) {
      this.x = this.target.x; this.y = this.target.y;
      if (this.target.face) this.face = this.target.face;
      this.target = null;
      this.finish();
    } else {
      this.x += dx / d * step; this.y += dy / d * step * 1.2;
      this.phase += dt * 7.5;
    }
  };
  Walker.prototype.scale = function () {
    const f = FLOORS[ACTORS.scene];
    return f ? (f.hBack + (f.hFront - f.hBack) * (this.y - f.y0) / (f.y1 - f.y0)) / f.hFront : 1;
  };
  Walker.prototype.height = function () {
    const f = FLOORS[ACTORS.scene];
    return f ? f.hBack + (f.hFront - f.hBack) * (this.y - f.y0) / (f.y1 - f.y0) : 240;
  };

  Walker.prototype.draw = function (c, t) {
    const h = this.height();
    const img = sheet(this.name);
    // contact shadow
    c.fillStyle = "rgba(0,0,0,.45)";
    c.beginPath(); c.ellipse(this.x, this.y, h * .16, h * .03, 0, 0, Math.PI * 2); c.fill();
    if (img) return this.drawSheet(c, img, h);
    this.drawStandIn(c, t, h);
  };

  Walker.prototype.drawSheet = function (c, img, h) {
    const sp = SPRITES[this.name];
    const row = this.face > 0 ? sp.rows.right : sp.rows.left;
    const moving = !!this.target;
    const fr = moving ? Math.floor(this.phase * sp.walk / (Math.PI * 2)) % sp.walk : (sp.idleFrame || 0);
    const w = h * sp.fw / sp.fh;
    c.drawImage(img, fr * sp.fw, row * sp.fh, sp.fw, sp.fh, this.x - w / 2, this.y - h, w, h);
  };

  // A shadowed figure in a long coat, lit from behind by the lantern. No face on purpose:
  // his look comes from the family's own artwork.
  Walker.prototype.drawStandIn = function (c, t, h) {
    const s = h / 240;
    const sw = Math.sin(this.phase);
    const walking = !!this.target || Math.abs(sw) > .05;
    const bob = walking ? Math.abs(Math.cos(this.phase)) * 3 * s : Math.sin(t * 1.6) * .8 * s;
    c.save();
    c.translate(this.x, this.y);
    c.scale(this.face * s, s);
    c.translate(0, -bob);
    const leg = (a, shadeCol) => {
      c.save(); c.translate(0, -112); c.rotate(a);
      c.fillStyle = shadeCol; c.fillRect(-7, 0, 14, 104);
      c.fillStyle = "#120e0b"; c.beginPath(); c.moveTo(-8, 98); c.lineTo(20, 104); c.lineTo(20, 112); c.lineTo(-8, 112); c.fill();
      c.restore();
    };
    leg(-sw * .42, "#1d1916");
    // coat
    const tail = walking ? sw * 6 : Math.sin(t * 1.2) * 1.5;
    const g = c.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, "#151b22"); g.addColorStop(.6, "#2a3542"); g.addColorStop(1, "#1a212a");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-18, -196); c.lineTo(20, -196);
    c.quadraticCurveTo(30, -150, 28 + tail, -70);
    c.lineTo(-30 + tail * .6, -66);
    c.quadraticCurveTo(-26, -150, -18, -196);
    c.fill();
    leg(sw * .42, "#26211d");
    // belt and the sword at his hip
    c.fillStyle = "#2b1d14"; c.fillRect(-20, -128, 42, 7);
    c.save(); c.translate(-4, -122); c.rotate(.9 + sw * .05);
    c.fillStyle = "#3b3e44"; c.fillRect(0, -3, 70, 5);
    c.fillStyle = "#2b1d14"; c.fillRect(-18, -3, 18, 5);
    c.restore();
    // arm swinging
    c.save(); c.translate(6, -190); c.rotate(sw * .35);
    c.fillStyle = "#1c242d"; c.fillRect(-7, 0, 14, 70);
    c.fillStyle = "#3a2b22"; c.beginPath(); c.arc(0, 74, 6, 0, Math.PI * 2); c.fill();
    c.restore();
    // collar, head, hair
    c.fillStyle = "#10151b"; c.beginPath(); c.moveTo(-16, -196); c.lineTo(0, -178); c.lineTo(18, -196); c.lineTo(10, -206); c.lineTo(-10, -206); c.fill();
    c.fillStyle = "#2d2019"; c.beginPath(); c.ellipse(2, -218, 13, 16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#16100c"; c.beginPath(); c.ellipse(-2, -226, 14, 10, -.2, 0, Math.PI * 2); c.fill();
    // rim light from the lantern
    c.strokeStyle = "rgba(255,190,110,.55)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(14, -232); c.quadraticCurveTo(18, -214, 12, -204); c.stroke();
    c.beginPath(); c.moveTo(20, -194); c.quadraticCurveTo(30, -150, 28 + tail, -72); c.stroke();
    c.restore();
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
    SPRITES
  };
  window.ACTORS = ACTORS;
})();
