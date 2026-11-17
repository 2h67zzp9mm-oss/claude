"use strict";
// Web Push (lib/webpush.js): the phone can read what we encrypt, and the VAPID signature checks out.
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createWebPush, decrypt } = require("../lib/webpush");
const b64u = b => Buffer.from(b).toString("base64url");

test("web push: encrypted for the phone, signed with VAPID, dead subscriptions dropped", async () => {
  const phone = crypto.createECDH("prime256v1"); phone.generateKeys();
  const auth = crypto.randomBytes(16), sub = { endpoint: "https://push.example/abc", keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(auth) } };
  const sent = [];
  const push = createWebPush({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wp-")), "push.json"), fetchImpl: async (url, opts) => { sent.push({ url, opts }); return { ok: true, status: 201 }; } });
  assert.ok(push.add(sub, "Sean")); assert.ok(!push.add({ endpoint: "http://nope" }));
  assert.strictEqual(await push.notify({ title: "◈ Kindle", body: "I wish someone lived next door." }), 1);
  const { opts } = sent[0];
  assert.deepStrictEqual(JSON.parse(decrypt(opts.body, phone, auth)), { title: "◈ Kindle", body: "I wish someone lived next door." });
  const [, jwt, k] = opts.headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/), [h, c, sig] = jwt.split(".");
  assert.strictEqual(JSON.parse(Buffer.from(c, "base64url")).aud, "https://push.example");
  const pub = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(Buffer.from(k, "base64url").subarray(1, 33)), y: b64u(Buffer.from(k, "base64url").subarray(33)) }, format: "jwk" });
  assert.ok(crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url")), "VAPID signature verifies");
  const gone = createWebPush({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wp-")), "push.json"), fetchImpl: async () => ({ ok: false, status: 410 }) });
  gone.add(sub); await gone.notify({ title: "x" }); assert.strictEqual(gone.count(), 0);
});
