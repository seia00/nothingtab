/* Every new tab was making a network round trip for the HTML before it could
   render anything — Vercel serves it must-revalidate. This serves the whole page
   from local cache instead, then quietly refreshes it behind your back, so a tab
   opens at disk speed and a deploy still lands within one extra tab.

   Bump VERSION on any change that must reach existing tabs immediately. */
const VERSION = "v3";
const CACHE = `startingpage-${VERSION}`;

const PRECACHE = [
  "/",
  "/styles.css",
  "/app.js",
  "/icons.js",
  "/assets/wallpaper.webp",
  "/assets/wallpaper-lens.webp",
  "/assets/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Weather and favicon lookups are somebody else's origin and shouldn't be
  // frozen in our cache — let them go straight to the network.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Suggestions are per-keystroke and must never be served stale. Caching these
  // would pin whatever you typed first to every later query.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);

      // Serve the cached copy instantly; the refetch settles in the background.
      if (hit) {
        event.waitUntil(fresh.catch(() => {}));
        return hit;
      }
      return fresh;
    })
  );
});
