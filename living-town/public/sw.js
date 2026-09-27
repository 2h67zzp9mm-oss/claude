"use strict";
// The server replaces __ASSET_VERSION__ with a hash of the client files, so
// any change to the app automatically retires old caches.
const CACHE = "living-town-__ASSET_VERSION__";
const PRECACHE = ["/", "/styles.css", "/map.css", "/accounts.css", "/client.js", "/shared/world.js", "/shared/interiors.js", "/rooms.js", "/scenery.js", "/manifest.webmanifest", "/assets/town-map.webp", "/icon.svg"];
const CACHE_FIRST = /\.(webp|png|svg)$/;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function store(request, response) {
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/ws" || url.pathname === "/sw.js") return;

  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => store(event.request, response))));
    return;
  }
  // Network first for HTML, JS and CSS so updates show up immediately.
  event.respondWith(fetch(event.request).then(response => store(event.request, response)).catch(() => caches.match(event.request)));
});
