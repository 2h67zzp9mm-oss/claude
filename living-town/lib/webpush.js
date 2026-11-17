"use strict";
/**
 * Web Push with nothing but Node's crypto: VAPID (RFC 8292) and aes128gcm message encryption (RFC 8291).
 * Used by Kindle's app to buzz the owner's phone when Kindle makes a wish.
 *
 *   const push = createWebPush({ file: "data/kindle-push.json", subject: "mailto:kindle@localhost" });
 *   push.publicKey            // give this to the browser's pushManager.subscribe
 *   push.add(subscription)    // keep a phone's subscription
 *   await push.notify({ title, body, url })
 */
const crypto = require("crypto");
const fs = require("fs");

const b64u = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

function hkdf(salt, ikm, info, len) { return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len)); }

/** Encrypt a payload for one subscription (aes128gcm). Returns the request body. */
function encrypt(payload, sub, { salt = crypto.randomBytes(16) } = {}) {
  const local = crypto.createECDH("prime256v1"); local.generateKeys();   // a fresh key for every message
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const asPublic = local.getPublicKey(), shared = local.computeSecret(uaPublic);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

/** Decrypt (the browser's side); only used by tests to prove the encryption is right. */
function decrypt(body, uaECDH, authSecret) {
  const salt = body.subarray(0, 16), idlen = body.readUInt8(20), asPublic = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const uaPublic = uaECDH.getPublicKey(), shared = uaECDH.computeSecret(asPublic);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16), nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return out.subarray(0, out.lastIndexOf(2)).toString();
}

function createWebPush({ file, subject = "mailto:kindle@localhost", fetchImpl = (...a) => fetch(...a) }) {
  let st = null;
  try { st = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first run */ }
  if (!st?.privateKey) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    st = { privateKey: privateKey.export({ type: "pkcs8", format: "pem" }), publicKey: b64u(publicKey.export({ type: "spki", format: "der" }).subarray(-65)), subs: [] };
  }
  const save = () => { try { fs.writeFileSync(file, JSON.stringify(st), { mode: 0o600 }); } catch { /* next time */ } };
  save();
  function vapid(endpoint) {
    const aud = new URL(endpoint).origin, head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
    const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
    const sig = crypto.sign("sha256", Buffer.from(`${head}.${claims}`), { key: st.privateKey, dsaEncoding: "ieee-p1363" });
    return `vapid t=${head}.${claims}.${b64u(sig)}, k=${st.publicKey}`;
  }
  function add(sub, who = "") {
    if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return false;
    st.subs = st.subs.filter(s => s.endpoint !== sub.endpoint); st.subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, who, at: Date.now() });
    save(); return true;
  }
  async function notify(msg) {
    let sent = 0;
    for (const sub of [...st.subs]) {
      try {
        const r = await fetchImpl(sub.endpoint, { method: "POST", headers: { TTL: "86400", Urgency: "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: vapid(sub.endpoint) }, body: encrypt(JSON.stringify(msg), sub) });
        if (r.status === 404 || r.status === 410) { st.subs = st.subs.filter(s => s !== sub); save(); } else if (r.ok) sent++;
      } catch { /* try next time */ }
    }
    return sent;
  }
  return { publicKey: st.publicKey, add, notify, count: () => st.subs.length };
}

module.exports = { createWebPush, encrypt, decrypt };
