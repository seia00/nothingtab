/* Boot. Each part starts independently, so one failing (say, storage blocked
   or a network-dependent widget) never takes the search bar down with it. */

import { $ } from "./ui.js";
import { on } from "./bus.js";
import { initTheme } from "./theme.js";
import { initSearch } from "./search/search.js";
import { initFavorites, favorites, openSlot, SLOTS } from "./favorites.js";
import { initPlayer } from "./player.js";
import { initGlyph } from "./glyph.js";
import { initDisplay } from "./display.js";
import { initTube } from "./timer.js";
import { startWeather } from "./weather.js";
import { initGlyphInterface } from "./glyph-interface.js";

function safely(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[nothingtab] ${name} failed to start`, err);
    return null;
  }
}

safely("theme", () => initTheme($("#theme-switch"), $("#swatches")));
const search = safely("search", () => initSearch({ favorites }));
safely("favorites", () => initFavorites({ grid: $("#fav-grid"), editButton: $("#fav-edit") }));
safely("player", initPlayer);

const glyph = safely("glyph", () => initGlyph({
  canvas: $("#glyph-canvas"),
  face: $("#glyph-face"),
  button: $("#glyph-button"),
  status: $("#glyph-status"),
}));

safely("display", () => initDisplay({
  canvas: $("#display-canvas"),
  face: $("#display-face"),
  pager: $("#pager"),
  status: $("#display-status"),
  cityForm: $("#city-form"),
  cityInput: $("#city-input"),
}));

safely("timer", () => {
  const renderTube = initTube($("#tube"), $("#tube-rod"), $("#led"));
  renderTube();
  on("timer", renderTube);
});

safely("weather", startWeather);

safely("glyph interface", () => initGlyphInterface({
  shell: $(".shell"),
  chassis: $(".chassis"),
  board: $("#circuit"),
  lens: $("#glyph-a"),
}));

search?.focus();

/* ── Keyboard ──────────────────────────────────────────────────────
   1–6 open a favorite (⌥1–6 even while typing; add ⇧ for a new tab).
   Holding ⌥ shows the numbers. / or ⌘K focuses search, G steps the Glyph. */

addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  const typing = Boolean(e.target.closest?.("input, textarea, [contenteditable]"));

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    search?.focus();
    return;
  }

  if (e.altKey) document.body.classList.add("show-keys");

  // Match the physical key: macOS turns ⌥1 into "¡".
  const digit = (e.code || "").match(/^Digit([1-9])$/);
  if (digit && !e.metaKey && !e.ctrlKey && (e.altKey || !typing)) {
    const n = Number(digit[1]);
    if (n <= SLOTS && openSlot(n - 1, { newTab: e.shiftKey })) e.preventDefault();
    return;
  }

  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/") {
    e.preventDefault();
    search?.focus();
  } else if (e.key === "g" || e.key === "G") {
    glyph?.next();
  }
});

addEventListener("keyup", (e) => { if (!e.altKey) document.body.classList.remove("show-keys"); });
addEventListener("blur", () => document.body.classList.remove("show-keys"));

/* ── Offline cache ─────────────────────────────────────────────────
   The service worker makes repeat tabs open from disk. It is skipped on
   loopback hosts, where a cache-first worker would hide every edit. */

if ("serviceWorker" in navigator) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (local) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => { /* nothing registered */ });
  } else {
    addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.error("[nothingtab] service worker", err));
    });
  }
}
