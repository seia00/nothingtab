import { ICONS, WX } from "./icons.js";

/* ── Config ─────────────────────────────────────────────────── */

const CONFIG = {
  search: true,        // search / jump bar above the grid
  suggestions: true,   // live autocomplete — see the privacy note in README
  suggestLang: null,   // null = navigator.language, e.g. "en"
  suggestRegion: null, // null = derived from system timezone, e.g. "jp"
  weather: true,
  quickCreate: true,
  hour12: null,        // null = follow system locale
  magnification: 1.45, // strength of the refracted rim lens

  /* Framing. The wallpaper's empty band is only ~27% of its width, which isn't
     quite enough room for the column, so the image is pushed past `cover` and
     anchored left — that walks the planet rightward and clears the type.
     zoom 1 = plain cover; alignX 0 = anchor left, 0.5 = centre. */
  zoom: 1.16,
  alignX: 0,
};

/* `tint` is the logo's own colour, bled back into that tile's glass so the marks
   look lit by the scene instead of dropped on top of it. */
const DEFAULT_LINKS = [
  { name: "Gmail",   url: "https://mail.google.com/",             icon: "gmail",   tint: "234 67 53" },
  { name: "Docs",    url: "https://docs.google.com/document/",     icon: "docs",    tint: "66 133 244" },
  { name: "Slides",  url: "https://docs.google.com/presentation/", icon: "slides",  tint: "244 180 0" },
  { name: "Sheets",  url: "https://docs.google.com/spreadsheets/", icon: "sheets",  tint: "15 157 88" },
  { name: "GitHub",  url: "https://github.com/",                   icon: "github",  tint: "200 214 235" },
  { name: "Vercel",  url: "https://vercel.com/dashboard",          icon: "vercel",  tint: "200 214 235" },
  { name: "Spotify", url: "https://open.spotify.com/",             icon: "spotify", tint: "29 185 84" },
];

const QUICK = [
  { name: "Doc",     url: "https://docs.new",    icon: "docs" },
  { name: "Sheet",   url: "https://sheets.new",  icon: "sheets" },
  { name: "Slide",   url: "https://slides.new",  icon: "slides" },
  { name: "Compose", url: "https://mail.google.com/mail/u/0/#inbox?compose=new", icon: "gmail" },
  { name: "Repo",    url: "https://github.com/new", icon: "github" },
];

const ENGINES = [
  { key: "gh", label: "GitHub",  url: (q) => `https://github.com/search?q=${q}` },
  { key: "yt", label: "YouTube", url: (q) => `https://www.youtube.com/results?search_query=${q}` },
  { key: "np", label: "npm",     url: (q) => `https://www.npmjs.com/search?q=${q}` },
  { key: "mdn", label: "MDN",    url: (q) => `https://developer.mozilla.org/en-US/search?q=${q}` },
];
const DEFAULT_ENGINE = (q) => `https://www.google.com/search?q=${q}`;

const IMG_W = 3840, IMG_H = 2486;
const STORE = "startingpage.v1";

/* ── State ──────────────────────────────────────────────────── */

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; }
  catch { return {}; }
};
const save = () => {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* file:// / private mode */ }
};

/* Links saved before a field existed would otherwise shadow the defaults
   forever — anything keyed to a built-in icon gets the newer values backfilled,
   so new styling reaches an existing install without needing a Reset. */
const BUILTIN = Object.fromEntries(DEFAULT_LINKS.map((l) => [l.icon, l]));
const hydrate = (links) =>
  links.map((l) => (l.icon && BUILTIN[l.icon] ? { tint: BUILTIN[l.icon].tint, ...l } : l));

const persisted = load();
const state = {
  links: Array.isArray(persisted.links) && persisted.links.length
    ? hydrate(persisted.links)
    : DEFAULT_LINKS,
  place: persisted.place || null,
  weather: persisted.weather || null,
};

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");

/* ── Tiles ──────────────────────────────────────────────────── */

function markup(link) {
  if (link.icon && ICONS[link.icon]) return ICONS[link.icon];
  const host = safeHost(link.url);
  return host
    ? `<img src="https://icons.duckduckgo.com/ip3/${host}.ico" alt="" loading="lazy"
        onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:this.dataset.fb}).firstElementChild)"
        data-fb="${ICONS.globe.replace(/"/g, "&quot;").replace(/\n/g, "")}">`
    : ICONS.globe;
}

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

function renderGrid() {
  grid.textContent = "";

  state.links.forEach((link, i) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.setProperty("--i", i);          // staggers the entrance

    const a = document.createElement("a");
    a.className = "tile glass";
    a.href = link.url;
    a.title = link.name;
    if (link.tint) a.style.setProperty("--brand", link.tint);
    a.innerHTML = `
      <div class="lens"></div>
      <span class="key">${i < 9 ? i + 1 : ""}</span>
      <span class="mark">${markup(link)}</span>`;

    const kill = document.createElement("button");
    kill.className = "remove";
    kill.type = "button";
    kill.textContent = "×";
    kill.setAttribute("aria-label", `Remove ${link.name}`);
    kill.addEventListener("click", (e) => {
      e.preventDefault();
      state.links.splice(i, 1);
      save();
      renderGrid();
    });

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = link.name;

    cell.append(a, kill, label);
    wireDrag(cell, i);
    grid.append(cell);
  });

  // Ghost slot: always present, so the grid reads as deliberate rather than short.
  const addCell = document.createElement("div");
  addCell.className = "cell";
  addCell.style.setProperty("--i", state.links.length);
  addCell.innerHTML = `
    <button class="tile add glass" type="button" aria-label="Add a link">
      <span class="lens"></span>
      <span class="mark">${ICONS.plus}</span>
    </button>
    <span class="label">Add</span>`;
  addCell.querySelector("button").addEventListener("click", openAddForm);
  grid.append(addCell);

  layoutLenses();
}

/* ── Drag to reorder ────────────────────────────────────────── */

let dragFrom = null;

function wireDrag(cell, index) {
  cell.draggable = true;
  cell.addEventListener("dragstart", (e) => {
    if (!document.body.classList.contains("editing")) { e.preventDefault(); return; }
    dragFrom = index;
    cell.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  });
  cell.addEventListener("dragover", (e) => {
    if (dragFrom !== null) e.preventDefault();
  });
  cell.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dragFrom === null || dragFrom === index) return;
    const [moved] = state.links.splice(dragFrom, 1);
    state.links.splice(index, 0, moved);
    dragFrom = null;
    save();
    renderGrid();
  });
  cell.addEventListener("dragend", () => {
    dragFrom = null;
    cell.classList.remove("dragging");
  });
}

/* ── Add-link form ──────────────────────────────────────────── */

const addForm = $("#addform");
const urlField = $("#addurl");
const nameField = $("#addname");

function openAddForm() {
  addForm.classList.add("open");
  layoutLenses();
  urlField.focus();
}

function closeAddForm() {
  addForm.classList.remove("open");
  urlField.value = "";
  nameField.value = "";
}

urlField.addEventListener("input", () => {
  const host = safeHost(normaliseUrl(urlField.value));
  if (host && !nameField.dataset.touched) {
    const base = host.replace(/^www\./, "").split(".")[0];
    nameField.value = base.charAt(0).toUpperCase() + base.slice(1);
  }
});
nameField.addEventListener("input", () => { nameField.dataset.touched = "1"; });

function normaliseUrl(raw) {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function submitAdd() {
  const url = normaliseUrl(urlField.value);
  if (!safeHost(url)) { urlField.focus(); return; }
  state.links.push({ name: nameField.value.trim() || safeHost(url), url });
  delete nameField.dataset.touched;
  save();
  closeAddForm();
  renderGrid();
}

$("#addgo").addEventListener("click", submitAdd);
addForm.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAdd();
  if (e.key === "Escape") closeAddForm();
});

/* ── Refracted rim geometry ─────────────────────────────────── */

/* Where the wallpaper actually sits, in viewport pixels. Both the page
   background and every lens read from this, so they can never drift apart. */
function frame() {
  const vw = innerWidth, vh = innerHeight;
  const s = Math.max(vw / IMG_W, vh / IMG_H) * CONFIG.zoom;
  const bw = IMG_W * s, bh = IMG_H * s;
  return { bw, bh, ox: (vw - bw) * CONFIG.alignX, oy: (vh - bh) / 2 };
}

/* Each .lens paints the same wallpaper the page does, but magnified about its
   own centre — so the glyphs under the glass edge line up with the ones beside
   it and then bow outward, the way they would through a real bevel. */
function layoutLenses() {
  const { bw, bh, ox, oy } = frame();
  const root = document.documentElement.style;
  root.setProperty("--bg-size", `${bw}px ${bh}px`);
  root.setProperty("--bg-pos", `${ox}px ${oy}px`);

  document.querySelectorAll(".lens").forEach((lens) => {
    const host = lens.parentElement;
    const m = parseFloat(getComputedStyle(host).getPropertyValue("--mag")) || CONFIG.magnification;
    const r = host.getBoundingClientRect();
    if (!r.width) return;
    const px = r.width / 2 - m * (r.left + r.width / 2 - ox);
    const py = r.height / 2 - m * (r.top + r.height / 2 - oy);
    lens.style.setProperty("--lens-size", `${bw * m}px ${bh * m}px`);
    lens.style.setProperty("--lens-pos", `${px}px ${py}px`);
  });
}

addEventListener("resize", layoutLenses);

/* ── Clock ──────────────────────────────────────────────────── */

const clockEl = $("#clock");
const dateEl = $("#date");

function tick() {
  const now = new Date();
  const opts = { hour: "2-digit", minute: "2-digit" };
  if (CONFIG.hour12 !== null) opts.hour12 = CONFIG.hour12;

  // Split am/pm off so it can sit small beside the numerals instead of shouting.
  const parts = new Intl.DateTimeFormat(undefined, opts).formatToParts(now);
  const time = parts
    .filter((p) => p.type === "hour" || p.type === "minute" || p.value === ":")
    .map((p) => p.value)
    .join("");
  const period = parts.find((p) => p.type === "dayPeriod");

  clockEl.innerHTML = period
    ? `${time}<span class="period"> ${period.value.toLowerCase()}</span>`
    : time;

  dateEl.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short", month: "short", day: "numeric",
  }).format(now).toUpperCase();

  // Re-align to the next minute boundary rather than drifting on an interval.
  setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
}

/* ── Weather ────────────────────────────────────────────────── */

/* Open-Meteo: no key, no account, no tracking. Location comes from the system
   timezone so nothing ever prompts for permission; click the chip to override. */
const TZ_PLACES = {
  "Asia/Tokyo": { name: "Tokyo", lat: 35.6895, lon: 139.6917, cc: "jp" },
  "Asia/Seoul": { name: "Seoul", lat: 37.5665, lon: 126.978, cc: "kr" },
  "Asia/Singapore": { name: "Singapore", lat: 1.3521, lon: 103.8198, cc: "sg" },
  "Asia/Hong_Kong": { name: "Hong Kong", lat: 22.3193, lon: 114.1694, cc: "hk" },
  "Europe/London": { name: "London", lat: 51.5072, lon: -0.1276, cc: "gb" },
  "Europe/Paris": { name: "Paris", lat: 48.8566, lon: 2.3522, cc: "fr" },
  "Europe/Berlin": { name: "Berlin", lat: 52.52, lon: 13.405, cc: "de" },
  "America/New_York": { name: "New York", lat: 40.7128, lon: -74.006, cc: "us" },
  "America/Chicago": { name: "Chicago", lat: 41.8781, lon: -87.6298, cc: "us" },
  "America/Denver": { name: "Denver", lat: 39.7392, lon: -104.9903, cc: "us" },
  "America/Los_Angeles": { name: "San Francisco", lat: 37.7749, lon: -122.4194, cc: "us" },
  "Australia/Sydney": { name: "Sydney", lat: -33.8688, lon: 151.2093, cc: "au" },
};

/* Suggestion locale. Language comes from the browser, country from the system
   timezone — you can be an English speaker in Tokyo and want both to be true. */
const suggestLocale = () => ({
  hl: CONFIG.suggestLang || (navigator.language || "en").slice(0, 5).toLowerCase(),
  gl: CONFIG.suggestRegion
    || TZ_PLACES[Intl.DateTimeFormat().resolvedOptions().timeZone]?.cc
    || "",
});

const WMO = [
  [[0], "clear", "Clear"],
  [[1, 2], "partly", "Partly cloudy"],
  [[3], "cloud", "Overcast"],
  [[45, 48], "fog", "Fog"],
  [[51, 53, 55, 56, 57], "rain", "Drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "rain", "Rain"],
  [[71, 73, 75, 77, 85, 86], "snow", "Snow"],
  [[95, 96, 99], "storm", "Storm"],
];

const decode = (code) => WMO.find(([codes]) => codes.includes(code)) || [[], "none", "—"];

const weatherEl = $("#weather");
const cityInput = $("#city");

function place() {
  if (state.place) return state.place;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TZ_PLACES[tz] || TZ_PLACES["Asia/Tokyo"];
}

function paintWeather(w) {
  if (!w) return;
  const [, sym, word] = decode(w.code);
  weatherEl.innerHTML =
    `<span class="sym">${WX[sym]}</span><span>${Math.round(w.temp)}° ${word}</span>`;
  weatherEl.hidden = false;
}

async function fetchWeather() {
  const p = place();
  const fresh = state.weather && Date.now() - state.weather.at < 20 * 60 * 1000
    && state.weather.name === p.name;
  if (state.weather) paintWeather(state.weather);
  if (fresh) return;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
      `&current=temperature_2m,weather_code&timezone=auto`
    );
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.weather = {
      temp: data.current.temperature_2m,
      code: data.current.weather_code,
      name: p.name,
      at: Date.now(),
    };
    save();
    paintWeather(state.weather);
  } catch {
    if (!state.weather) weatherEl.hidden = true;
  }
}

// Click the chip to type a different city; geocoded through Open-Meteo.
weatherEl.addEventListener("click", () => {
  cityInput.hidden = false;
  weatherEl.hidden = true;
  cityInput.value = place().name;
  cityInput.select();
});

cityInput.addEventListener("keydown", async (e) => {
  if (e.key === "Escape") { cityInput.hidden = true; weatherEl.hidden = false; return; }
  if (e.key !== "Enter") return;
  const q = cityInput.value.trim();
  cityInput.hidden = true;
  weatherEl.hidden = false;
  if (!q) return;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`
    );
    const hit = (await res.json()).results?.[0];
    if (!hit) return;
    state.place = { name: hit.name, lat: hit.latitude, lon: hit.longitude };
    state.weather = null;
    save();
    fetchWeather();
  } catch { /* leave the previous reading up */ }
});

/* ── Quick create ───────────────────────────────────────────── */

function renderQuick() {
  const bar = $("#quick");
  if (!CONFIG.quickCreate) { bar.hidden = true; return; }
  // One "NEW" marker for the strip instead of a logo on every item — those five
  // marks already appear, larger, in the grid directly above.
  bar.insertAdjacentHTML("beforeend",
    `<span class="lead">New</span>` +
    QUICK.map((q) => `
      <a class="item" href="${q.url}" title="New ${q.name}">
        <span class="txt">${q.name}</span>
      </a>`).join(""));
}

/* ── Search ─────────────────────────────────────────────────── */

function initSearch() {
  const wrap = $("#searchwrap");
  if (!CONFIG.search) { wrap.hidden = true; return; }
  wrap.hidden = false;

  const input = $("#q");
  const scope = $("#scope");
  const panel = $("#suggest");

  // "gh react" → scoped search. The prefix only counts when something follows.
  const scoped = (raw) => {
    const m = raw.match(/^(\w+)\s+(.+)$/);
    if (!m) return null;
    const engine = ENGINES.find((e) => e.key === m[1].toLowerCase());
    return engine ? { engine, rest: m[2] } : null;
  };

  // A tile only claims the query when it's the single thing that could be meant
  // — otherwise "s" would silently open Spotify instead of searching for it.
  const jump = (raw) => {
    if (raw.length < 2 || raw.includes(" ")) return null;
    const hits = state.links.filter((l) =>
      l.name.toLowerCase().startsWith(raw.toLowerCase()));
    return hits.length === 1 ? hits[0] : null;
  };

  const isUrl = (v) =>
    /^https?:\/\//i.test(v) || (!v.includes(" ") && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v));

  /* Every branch reports the label it will act on, so the chip on the right
     always says where Enter is about to take you before you commit to it. */
  const resolve = (raw) => {
    const s = scoped(raw);
    if (s) return { label: s.engine.label, go: () => s.engine.url(encodeURIComponent(s.rest)) };

    const tile = jump(raw);
    if (tile) return { label: `→ ${tile.name}`, go: () => tile.url };

    if (isUrl(raw)) {
      return { label: "Open", go: () => (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) };
    }
    return { label: "", go: () => DEFAULT_ENGINE(encodeURIComponent(raw)) };
  };

  const setChip = () => {
    const raw = input.value.trim();
    const label = raw ? resolve(raw).label : "";
    scope.textContent = label;
    scope.hidden = !label;
  };

  /* ── suggestion state ──
     `typed` is what you actually typed; arrowing through rows overwrites the
     input, and this is what we restore when you arrow back off the top. */
  let rows = [];
  let active = -1;
  let typed = "";
  let seq = 0;
  let inFlight = null;
  let debounce = null;

  const close = () => {
    panel.hidden = true;
    panel.textContent = "";
    input.setAttribute("aria-expanded", "false");
    rows = [];
    active = -1;
  };

  /* Suggestion text comes from a third party, so it is only ever written as
     textContent — never interpolated into innerHTML. */
  const rowEl = (row, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "srow" + (i === active ? " on" : "");
    el.setAttribute("role", "option");
    el.setAttribute("aria-selected", String(i === active));

    const icon = document.createElement("span");
    icon.className = "ricon";
    icon.innerHTML = row.icon;

    const text = document.createElement("span");
    text.className = "rtext";
    const lead = row.label.toLowerCase().startsWith(typed.toLowerCase()) ? typed.length : 0;
    if (lead) {
      const dim = document.createElement("span");
      dim.className = "typed";
      dim.textContent = row.label.slice(0, lead);
      text.append(dim, document.createTextNode(row.label.slice(lead)));
    } else {
      text.textContent = row.label;
    }

    el.append(icon, text);
    if (row.hint) {
      const hint = document.createElement("span");
      hint.className = "rhint";
      hint.textContent = row.hint;
      el.append(hint);
    }

    el.addEventListener("click", () => { location.href = row.go(); });
    return el;
  };

  const render = () => {
    if (!rows.length) { close(); return; }
    panel.textContent = "";
    rows.forEach((r, i) => panel.append(rowEl(r, i)));
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const build = (raw, web) => {
    const out = [];
    const s = scoped(raw);

    if (!s && isUrl(raw)) {
      out.push({
        label: raw, value: raw, icon: ICONS.arrow, hint: "Open",
        go: () => (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`),
      });
    }

    // Your own tiles rank above the web — they're the thing you meant.
    if (!s && !raw.includes(" ")) {
      state.links
        .filter((l) => l.name.toLowerCase().startsWith(raw.toLowerCase()))
        .slice(0, 3)
        .forEach((l) => out.push({
          label: l.name, value: l.name, icon: markup(l), hint: "Jump", go: () => l.url,
        }));
    }

    web.slice(0, Math.max(3, 7 - out.length)).forEach((t) => out.push({
      label: t,
      value: s ? `${s.engine.key} ${t}` : t,
      icon: ICONS.query,
      hint: s ? s.engine.label : "",
      go: () => (s ? s.engine.url(encodeURIComponent(t)) : DEFAULT_ENGINE(encodeURIComponent(t))),
    }));

    return out.slice(0, 7);
  };

  const ask = async (raw) => {
    const s = scoped(raw);
    const term = s ? s.rest : raw;

    // No point asking the web to complete a URL you've already finished typing.
    if (!CONFIG.suggestions || !term || (!s && isUrl(raw))) return [];

    const mine = ++seq;
    inFlight?.abort();
    inFlight = new AbortController();
    try {
      const { hl, gl } = suggestLocale();
      const res = await fetch(
        `/api/suggest?q=${encodeURIComponent(term)}` +
          `&hl=${encodeURIComponent(hl)}${gl ? `&gl=${encodeURIComponent(gl)}` : ""}`,
        { signal: inFlight.signal });
      if (!res.ok) return [];
      const data = await res.json();
      // A slower earlier request must never overwrite a newer one.
      if (mine !== seq) return null;
      return Array.isArray(data.suggestions) ? data.suggestions : [];
    } catch {
      return null;
    }
  };

  input.addEventListener("input", () => {
    typed = input.value;
    setChip();
    active = -1;

    const raw = input.value.trim();
    if (!raw) { close(); return; }

    // Redraw immediately off local tiles, then fold the web in when it lands —
    // the dropdown never waits on the network to become useful.
    rows = build(raw, []);
    render();

    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const web = await ask(raw);
      if (web === null || input.value.trim() !== raw) return;
      rows = build(raw, web);
      active = -1;
      render();
    }, 110);
  });

  input.addEventListener("keydown", (e) => {
    const open = !panel.hidden && rows.length;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open) return;
      e.preventDefault();
      const last = rows.length - 1;
      active = e.key === "ArrowDown"
        ? (active >= last ? -1 : active + 1)
        : (active <= -1 ? last : active - 1);
      input.value = active === -1 ? typed : rows[active].value;
      setChip();
      render();
      return;
    }

    if (e.key === "Tab" && open) {
      e.preventDefault();
      const pick = rows[active === -1 ? 0 : active];
      input.value = pick.value;
      typed = pick.value;
      setChip();
      input.dispatchEvent(new Event("input"));
      return;
    }

    if (e.key === "Escape") {
      if (open) { close(); return; }        // first Escape closes, second clears
      input.value = "";
      typed = "";
      scope.hidden = true;
      input.blur();
      return;
    }

    if (e.key === "Enter") {
      if (active >= 0) { location.href = rows[active].go(); return; }
      const raw = input.value.trim();
      if (raw) location.href = resolve(raw).go();
    }
  });

  // mousedown would blur the input before click landed, closing the panel first.
  panel.addEventListener("mousedown", (e) => e.preventDefault());
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) close();
  });

  input.focus();
}

/* ── Edit mode + keyboard ───────────────────────────────────── */

$("#edit").addEventListener("click", () => {
  document.body.classList.toggle("editing");
  if (!document.body.classList.contains("editing")) closeAddForm();
});

$("#reset").addEventListener("click", () => {
  state.links = DEFAULT_LINKS.map((l) => ({ ...l }));
  save();
  renderGrid();
});

addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (e.altKey) document.body.classList.add("hint");

  /* Tile shortcuts have to survive the search field owning the caret, so ⌥ +
     number stays live while typing. macOS turns ⌥1 into "¡", so match the
     physical key rather than the character it produced. */
  const digit = (e.code || "").match(/^Digit([1-9])$/);
  if (digit && (e.altKey || !typing)) {
    const link = state.links[Number(digit[1]) - 1];
    if (link) { e.preventDefault(); location.href = link.url; }
    return;
  }

  if (typing) return;
  if (e.key === "/") { e.preventDefault(); $("#q")?.focus(); return; }
  if (e.key === "e") document.body.classList.toggle("editing");
  if (e.key === "Escape") { document.body.classList.remove("editing"); closeAddForm(); }
});

addEventListener("keyup", (e) => {
  if (!e.altKey) document.body.classList.remove("hint");
});
addEventListener("blur", () => document.body.classList.remove("hint"));

/* ── Boot ───────────────────────────────────────────────────── */

renderGrid();
renderQuick();
initSearch();
tick();
if (CONFIG.weather) fetchWeather(); else weatherEl.hidden = true;
requestAnimationFrame(layoutLenses);
