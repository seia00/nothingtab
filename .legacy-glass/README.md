# startingpage

A Safari start page built to sit inside one specific wallpaper — the ASCII-glyph
Saturn in `assets/`. Palette, framing and glass are all derived from that image,
so swapping the wallpaper means re-tuning a few numbers (see below).

## Point Safari at it

1. **Safari → Settings → General**
2. **Homepage**: paste the deployed URL
3. **New windows open with**: Homepage
4. **New tabs open with**: Homepage

## Keyboard

| key | does |
| --- | --- |
| `⌥`+`1`–`9` | open the nth tile — works even while typing in the search bar |
| `1`–`9` | same, when the search bar isn't focused |
| `⌥` (hold) | show the number on each tile |
| `/` | focus the search bar |
| `e` | toggle edit mode |
| `esc` | clear the search bar / leave edit mode / close the add form |

The search bar takes focus on load, so it owns bare keystrokes. `⌥` matches the
physical key rather than the character, because macOS turns `⌥1` into `¡`.

## Search

Focused on load, so a new tab is type-then-Enter. The chip on the right always
names where Enter is about to go before you commit:

| you type | chip | Enter does |
| --- | --- | --- |
| `how to center a div` | — | Google |
| `gh react` | GITHUB | searches GitHub (also `yt`, `np`, `mdn`) |
| `sp` | → Spotify | opens the Spotify tile |
| `s` | — | Google — ambiguous across Sheets/Slides/Spotify, so no tile claims it |
| `linear.app` | OPEN | navigates straight there |

A tile only wins when the typed text points at exactly one of them and is at
least two characters. Anything ambiguous falls through to a web search rather
than guessing — otherwise `s` would silently open Spotify instead of searching
for it. Add engines in `ENGINES` in [`app.js`](app.js).

### Autocomplete

Live suggestions, with your own tiles ranked above the web. `↓`/`↑` to walk the
list (the input fills in as you go, and arrowing back off the top restores what
you actually typed), `Tab` to complete without navigating, `Enter` to go,
`Escape` to close. Nothing is selected by default, so `Enter` always does what
you typed unless you deliberately picked a row.

Local tiles render instantly and the web results fold in when they arrive, so
the dropdown is never waiting on the network to be useful.

**This sends what you type to Google**, via [`api/suggest.js`](api/suggest.js) on
your own deployment — queries will appear in your Vercel request logs, and the
prefix is relayed onward. Set `suggestions: false` in `CONFIG` to turn it off;
the search bar keeps working, just without the dropdown.

Why a proxy at all: Google, DuckDuckGo, Brave and Qwant all refuse CORS, so the
browser cannot call any of them directly. Only Wikipedia allows it, and it only
returns article titles. A server relay is the only way to get real suggestions.

`hl`/`gl` are sent explicitly because Google localises on the *caller's* IP —
which, from an edge function, is the edge node. Left alone it returned traditional
Chinese for a Japanese query. Language comes from `navigator.language` and country
from your timezone; override either with `suggestLang` / `suggestRegion`.

## Editing links

Hit **Edit** (or `e`): tiles get a remove badge and become drag-to-reorder. The
quiet `+` slot adds a link — type a bare domain and the name fills itself in.
**Reset** restores the seven defaults. Everything lives in `localStorage`, which
is why this is served over http(s) rather than opened as a `file://` — Safari
blocks storage on `file://` origins and nothing would persist.

Custom links pull their icon from DuckDuckGo's favicon service, so adding one
sends that domain to `icons.duckduckgo.com`. The seven built-in marks are inlined
and make no network request.

## Config

Top of [`app.js`](app.js):

| key | default | does |
| --- | --- | --- |
| `search` | `true` | search / jump bar above the grid |
| `suggestions` | `true` | live autocomplete dropdown (sends keystrokes to Google) |
| `suggestLang` | `null` | `null` uses `navigator.language`; e.g. `"en"` |
| `suggestRegion` | `null` | `null` derives from timezone; e.g. `"jp"` |
| `weather` | `true` | current conditions via Open-Meteo |
| `quickCreate` | `true` | the `.new` shortcut row |
| `hour12` | `null` | `null` follows system locale; `true`/`false` to force |
| `magnification` | `1.45` | how hard the glass rim bends the glyphs behind it |
| `zoom` | `1.16` | wallpaper scale past `cover` |
| `alignX` | `0` | `0` anchors the wallpaper left, `0.5` centres it |

`zoom` and `alignX` exist because the wallpaper's empty band is only ~31% of its
width — just short of what the column needs. Pushing past `cover` and anchoring
left walks the planet rightward until the type has clear space. If you swap the
wallpaper, retune those two, update `IMG_W`/`IMG_H` in `app.js`, and resample the
palette at the top of `styles.css`.

## Design system

Everything is a token in `:root` — no per-element guesses. Changing a token
changes every place it is used, which is the point.

- **Type** — `--fs-badge` 9 · `--fs-label` 10.5 · `--fs-meta` 12 · `--fs-body`
  13.5 · `--fs-input` 15 · `--fs-display`. Mono is the system's voice (labels,
  badges, metadata); sans is anything you or the web wrote. That split is the
  rule, not a preference.
- **Space** — 4px base: `--s1` … `--s5`.
- **Radius** — `--r-panel` 26 · `--r-tile` 22 · `--r-inner` 19 · `--r-chip` 8.
  **Nested corners must equal outer − padding.** Every panel uses 7px padding,
  so its children are 26 − 7 = 19. Get this wrong and the gap between the two
  curves visibly tapers; it's the kind of thing you feel before you see it.
- **Elevation** — `--e1` / `--e2` / `--e3`, rather than a bespoke shadow per
  element.

Two deliberate choices worth keeping:

**Tiles are tinted by their own logo.** Each carries a `tint` (its brand colour)
that bleeds into its glass. The wallpaper is a single blue hue, so full-colour
logos otherwise read as stickers dropped onto the scene rather than objects lit
by it. Custom links fall back to the cyan accent.

**The create row is type-only.** It used to carry a brand mark per item, which
repeated all five logos from the grid directly above at half size — the noisiest
thing in the layout. The words alone are unambiguous.

Blocks rise in sequence on load rather than snapping in together. That stagger is
most of the difference between "a page loaded" and "a thing was designed", and it
costs nothing.

## How the glass works

Safari won't run an SVG filter through `backdrop-filter`, so the refracted rim
can't be a backdrop effect. Instead every panel holds a `.lens` child painting
its own copy of the wallpaper, aligned to the page behind it and magnified about
the panel's centre, then masked down to the edge band. The glyphs therefore line up with the ones outside the panel and bow
outward across the bevel — real refraction rather than a painted gradient.
`layoutLenses()` recomputes that alignment on load and resize; it and the page
background read the same `frame()`, so they cannot drift apart.

## Speed

A repeat tab makes **zero network requests** — [`sw.js`](sw.js) precaches the
page and serves it from local storage, then refreshes in the background. Measured
on the deploy, warm: TTFB 61 → 8ms, `domComplete` 279 → 26ms, bytes over the
wire 0.

Two things had to change for that to matter:

- **Ten `feTurbulence` filters, gone.** Each lens ran its own turbulence pass,
  which is per-pixel and by far the most expensive primitive in SVG filters. The
  magnification is what actually sells the refraction; the wobble on top of it
  was invisible. See the note on `.lens` in [`styles.css`](styles.css) to restore it.
- **Lens rims use a quarter-resolution wallpaper** (`wallpaper-lens.webp`, 1920px
  / 221 KB vs 3840px / 509 KB). Ten lenses were each resampling 9.5 MP to paint a
  12px band that's magnified and blurred anyway. The page background still uses
  the full-resolution copy, so nothing on screen is softer.

Backdrop blur also dropped 26px → 18px; blur cost scales with radius.

### Deploying changes

The worker serves cache-first, so a deploy reaches an open install on the *next*
tab, not the current one. Bump `VERSION` in [`sw.js`](sw.js) when a change has to
land immediately — that drops the old cache on activate.

## Local development

```bash
python3 -m http.server 8123
```
