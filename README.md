# nothingtab1

A Safari start page built as a Nothing device: matte body, screws, smoked
acrylic, clear and frosted glass, chrome, a bezel-less Glyph Matrix screen and one red
LED. Dark and light themes, both drawn as real materials rather than inverted colours,
in seven finishes.

## Point Safari at it

1. **Safari → Settings → General**
2. **Homepage**: paste the deployed URL
3. **New windows open with**: Homepage
4. **New tabs open with**: Homepage

On iPad: **Settings → Apps → Safari → New Tab** has no homepage option, so add
the page to your Favorites bar or Home Screen instead.

## The hardware

| part | what it does |
| --- | --- |
| **Glyph Matrix** (top left) | A bezel-less round screen, 41 square pixels across. Toys: clock, date, music, wordmark. Tap it — or the chrome **Glyph button** (bottom right), or press `G` — for the next toy. The outermost ring of pixels lights red as the toy's second channel: a seconds sweep, day progress, track progress. |
| **Search** | Frosted glass. See below. The magnifier picks the engine. |
| **Now playing** | Spotify — what's playing on any of your devices, with play/pause, skip, seek. |
| **Favorites** | Six slots. Hover a tile for its edit (pencil) and remove (×) buttons, or focus it and press `⌫`; a removal can be undone from the toast. **Edit** keeps those buttons out (that's how to reach them on iPad) and lets you drag one tile onto another to swap. Empty slots are tappable any time. |
| **Display** (right) | Four pages behind the square pager: weather, timer, calendar, progress (day / month / year). Swipe or `←`/`→` to page. Tap the weather page to change city; tap the timer page to start/pause, double-tap to reset. |
| **Glass tube** (right edge) | Timer length. Drag it, or focus it and use the arrow keys (1–60 min). It drains while the timer runs. |
| **Switch** | Dark / light. Follows the system until you use it. |
| **Swatches** (beside the switch) | The finish, after Nothing's and CMF's colourways: classic black/white, red, green, pink, blue, grey, yellow. Light mode is the bright moulded plastic; dark mode is the same hue, deep. Arrow keys move between them. |
| **LED** (left) | Pulses while the timer runs, blinks when it ends. |

### The Glyph Interface

The original Nothing Phone (1)'s five lights, each doing the job it did on the
phone:

| zone | where | lights up for |
| --- | --- | --- |
| **Camera ring** | around the Now Playing album art | breathes while music plays, dim when paused |
| **Diagonal** | above the search bar's right end | flashes for every notification |
| **Ring** (with its charging coil) | under the Glyph Matrix | the timer — lit while it runs, draining clockwise |
| **"!" strip** | under the ring | fills through the day, like the Phone (1)'s charge meter |
| **"!" dot** | under the strip | always on, the full stop |

They wake in sequence when the page opens, and play together when the timer
ends.

### The circuit

Under the surface, a PCB wires the modules together: hairline traces with 45°
bends, vias, a single IC, a few passives and test points, silkscreen labels on
each bus. It's laid out from the real positions of the parts, so it reflows
with the window. Activity runs along it as small pulses: typing (KEY), the
Glyph button down the GLYPH BUS to the matrix, music (I2S), the timer's
heartbeat (TMR), notifications from the IC to the diagonal glyph. The board
shows on the full-width layout; on narrower windows only the camera ring
remains.

When the timer ends the whole device reacts: the Glyph Matrix's ring flashes red, the matrix
flashes, the display blinks, and a short chime plays in the visible tab. It's
stored as an end time, so every open tab shows the same countdown and it
survives a reload.

## Search

Behaves like Safari's address bar:

| you type | Return does |
| --- | --- |
| `how to center a div` | searches your engine |
| `react.dev/learn`, `localhost:3000`, `192.168.1.1`, `nas:5000` | opens it (https for public sites, http for local ones) |
| `node.js`, `3.14` | searches — `.js` isn't a real domain |
| `you` | inline-completes to `you`**`tube.com`** from your favorites and history; Return opens it, `⌫` removes the completion |
| `!gh react`, `react !gh`, `gh react` | GitHub search — see bangs below |
| `2^10 / 4`, `10 km to mi`, `100 f to c` | shows the answer on top; Return still searches, Enter on the row copies |

- `↓`/`↑` walk the suggestions (the bar fills as you go; `Esc` puts back what you typed)
- `⌘↩` opens in a new tab, `Tab` accepts a completion, `⇧⌫` on a history row forgets it
- Clicking the empty bar shows recent searches
- Japanese / Chinese / Korean input is never interrupted: no completion or submit mid-composition
- Dangerous schemes (`javascript:`, `data:`, `file:`) are searched for, never opened

**Bangs.** Prefix (`!w paris`), suffix (`paris !w`), or for the longer keys as
the first word (`yt lofi`). Single-letter keys need the `!` so ordinary words
aren't hijacked. `!gh` alone opens the site.

`g` Google · `ddg` DuckDuckGo · `gh` GitHub · `yt` YouTube · `w` Wikipedia (in
your language) · `m` Maps · `np` npm · `mdn` MDN · `r` Reddit · `x` X · `a`
Amazon (your country's) · `sp` Spotify · `i` Images · `tr` Translate · `p`
Perplexity · `gpt` ChatGPT · `claude` Claude. Add more in
[`js/search/engines.js`](js/search/engines.js).

**Engines**: Google, DuckDuckGo, Bing, Brave, Ecosia, Kagi, Perplexity.

**Privacy.** Live suggestions send what you type to Google (or DuckDuckGo for
the DuckDuckGo-family engines) through [`api/suggest.js`](api/suggest.js) on
your own deployment — engines refuse direct browser requests. Turn them off in
the engine menu (**Live suggestions**); then nothing leaves the page until you
press Return. History is local to this browser.

## Connect Spotify

The page talks to Spotify directly from your browser (OAuth PKCE — no secret,
no server in between). You need your own Spotify app:

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and create an app; tick **Web API**.
2. Add the **Redirect URI** shown in the page's Spotify panel (the `⋮⋮` button).
   It's the page's own address, e.g. `https://your-deploy.vercel.app/`. Locally
   it must be `http://127.0.0.1:8123/` — Spotify rejects `localhost`.
3. Paste the app's **Client ID** into the panel and press **Connect**.

Showing what's playing works on any account. Play/pause/skip/seek are Premium
features on Spotify's side, and since February 2026 a development-mode app
also needs its owner to have Premium. Only visible tabs poll, so a stack of
open new tabs doesn't burn through the rate limit.

## Keyboard

| key | does |
| --- | --- |
| `1`–`6` | open a favorite (`⌥1`–`6` works even while typing; add `⇧` for a new tab) |
| `⌥` (hold) | show the numbers |
| `/` or `⌘K` | focus search |
| `G` | next Glyph toy |
| `Esc` | leave favorites edit mode |

## Weather

Open-Meteo: no key, no account. The city comes from your system timezone so
nothing asks for location permission; tap the weather page to type another.
Fahrenheit in the US, Celsius elsewhere.

## Speed

A new tab paints from two files: the HTML (every stylesheet and both fonts
inlined) and one hashed JavaScript bundle. Measured cold, with 70 ms added per
request to stand in for a CDN round trip:

| | unbundled source | build |
| --- | --- | --- |
| requests | 42, in 7 waves | 2, in 2 waves |
| first paint | ~310 ms | ~155 ms |
| clock on screen | ~1,355 ms | ~178 ms |

After the first visit the service worker serves both from disk, so a tab
doesn't wait on the network at all; it refreshes them in the background, and a
deploy reaches you on the next tab.

To keep Safari instant:

- Set the homepage to the exact final URL, with `https://` and the trailing
  slash (`https://your-deploy.vercel.app/`). Every redirect is a round trip
  before anything can paint.
- Use the production domain, not a preview URL — Vercel's deployment protection
  puts a login redirect in front of previews.
- Safari clears a site's storage, service worker included, if you go seven days
  of browsing without opening it. As a daily homepage that never happens; if it
  does, the next load is just the two-file network load above.

## Run it on your Mac

For a Mac, the page can be served from the Mac itself — no DNS, no TLS, no trip
to a server. The clock is on screen about 40 ms after a new tab opens.

```bash
npm install
npm run install-local
```

That builds the page, copies it to `~/Library/Application Support/nothingtab`
(macOS keeps background programs out of Desktop, Documents and Downloads), and
registers a login item that serves it at **`http://127.0.0.1:8124/`** — started
at login, restarted if it ever stops. Then:

1. **Safari → Settings → General → Homepage**: `http://127.0.0.1:8124/`
2. **Spotify**: add `http://127.0.0.1:8124/` as a second Redirect URI in your
   app, and connect once from the local page.

It's a separate site from the Vercel one as far as the browser is concerned, so
favorites, history and the Spotify sign-in are set up once more there. Your
iPad keeps using the Vercel address.

Run `npm run install-local` again after any change to update it (the new copy
is swapped in whole; no restart needed). `npm run uninstall-local` stops it and
removes everything it added. Its log is `~/Library/Logs/nothingtab.log`.

## Local development

```bash
npm install
npm run dev
```

Serves the unbundled source and the suggestion relay at
`http://127.0.0.1:8123/`. The service worker is skipped on loopback so edits
always show.

```bash
npm run preview
```

Builds and serves `dist/` at `http://127.0.0.1:8126/` — what Vercel will serve.
Add `--latency 70` to `dev-server.mjs` to feel a remote host.

```bash
npm test
```

Unit tests for address detection, bangs, the calculator, history ranking, the
fonts, favorites validation, the CSP hash and the circuit layout (Node's
built-in runner, no dependencies).

## Deploying

Vercel runs `npm run build` and serves `dist/` (see `vercel.json`); the
`api/` relay deploys as an edge function as before. The bundle's file name is
its content hash and it is cached for a year; the service worker's cache name
follows the same hash, so nothing needs bumping by hand.

## Layout of the code

| path | what |
| --- | --- |
| `styles/tokens.css` | every colour and material, for both themes and every colourway; sizes in `--u` (one mockup pixel, scaled to the chassis) |
| `styles/materials.css` | screws, smoked plates, glass, frosted glass (search), liquid glass (Now Playing), the favorites plateau, the display well, chrome |
| `js/dot/` | the LED renderer, bitmap fonts and pictograms shared by both displays |
| `js/glyph.js`, `js/display.js` | the Glyph Matrix toys and the display pages |
| `js/search/` | resolver, bangs, calculator, history, suggestion rows, the bar itself |
| `js/spotify.js`, `js/player.js` | Spotify auth/API and the Now Playing panel |
| `js/glyph-interface.js`, `js/circuit/` | the Phone (1) Glyph lights, the PCB layer and its pulses |

The previous glass-and-wallpaper version is kept in `.legacy-glass/` (not
deployed; its wallpaper images stay out of the repository).
