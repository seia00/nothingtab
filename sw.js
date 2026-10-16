/* Every new tab was making a network round trip for the HTML before it could
   render anything — Vercel serves it must-revalidate. This serves the whole page
   from local cache instead, then quietly refreshes it behind your back, so a tab
   opens at disk speed and a deploy still lands within one extra tab.

   npm run build rewrites VERSION (the bundle hash) and PRECACHE (the page and
   its one bundle) in dist/sw.js. The values below only apply to the unbundled
   source, which is never served with this worker locally. */
const VERSION = "v5-glyphs";
const CACHE = `startingpage-${VERSION}`;

const PRECACHE = [
  "/",
  "/styles/tokens.css",
  "/styles/base.css",
  "/styles/materials.css",
  "/styles/glyph.css",
  "/styles/console.css",
  "/styles/search.css",
  "/styles/panels.css",
  "/styles/circuit.css",
  "/js/main.js",
  "/js/ui.js",
  "/js/bus.js",
  "/js/store.js",
  "/js/locale.js",
  "/js/theme.js",
  "/js/brands.js",
  "/js/favorites.js",
  "/js/fav-editor.js",
  "/js/player.js",
  "/js/spotify.js",
  "/js/glyph.js",
  "/js/display.js",
  "/js/timer.js",
  "/js/weather.js",
  "/js/glyph-interface.js",
  "/js/circuit/geometry.js",
  "/js/circuit/board.js",
  "/js/circuit/render.js",
  "/js/dot/matrix.js",
  "/js/dot/runner.js",
  "/js/dot/font.js",
  "/js/dot/sprites.js",
  "/js/search/search.js",
  "/js/search/rows.js",
  "/js/search/resolve.js",
  "/js/search/engines.js",
  "/js/search/tlds.js",
  "/js/search/calc.js",
  "/js/search/history.js",
  "/js/search/suggest.js",
  "/assets/icon.svg",
  "/assets/fonts/doto.woff2",
  "/assets/fonts/space-mono-400.woff2",
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

  // Weather, Spotify and icon lookups are somebody else's origin and shouldn't
  // be frozen in our cache — let them go straight to the network.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Suggestions are per-keystroke and must never be served stale. Caching these
  // would pin whatever you typed first to every later query.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    // ignoreSearch: the Spotify sign-in returns to "/?code=…", which is still "/".
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok && !url.search) {
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
