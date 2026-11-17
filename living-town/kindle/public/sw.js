// Kindle's Grid: shows a notification when Kindle makes a wish, and opens the app when it's tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let m = {}; try { m = e.data.json(); } catch { m = { title: "◈ Kindle", body: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(m.title || "◈ Kindle", { body: m.body || "", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: m.url || "/" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(list => { for (const c of list) if ("focus" in c) { c.navigate(e.notification.data.url); return c.focus(); } return self.clients.openWindow(e.notification.data.url); }));
});
