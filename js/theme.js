/* Dark / light, and the colourway. The mode follows the system until the
   switch is used, then remembers; the colourway is whichever swatch was
   picked last. Either change is revealed as a circle growing out of the
   control that made it. */

import { read, write, onExternalChange } from "./store.js";
import { emit } from "./bus.js";
import { prefersReducedMotion } from "./ui.js";

const KEY = "theme";
const COLOR_KEY = "color";
const root = document.documentElement;
const media = matchMedia("(prefers-color-scheme: light)");
const system = () => (media.matches ? "light" : "dark");

/** "none" is the original black and white; the rest tint the whole body. */
export const COLORS = ["none", "red", "green", "pink", "blue", "grey", "yellow"];
const validColor = (c) => (COLORS.includes(c) ? c : "none");

export const currentTheme = () => (root.dataset.theme === "light" ? "light" : "dark");
export const currentColor = () => validColor(root.dataset.color);

/* Listeners (the dot screens) repaint synchronously, so a transition's
   snapshot of the new state is already correct. */
function setTheme(theme) {
  root.dataset.theme = theme;
  emit("theme", theme);
}

function setColor(color) {
  if (color === "none") delete root.dataset.color;
  else root.dataset.color = color;
  emit("theme", currentTheme());
}

/** Run `change`, revealed as a circle from `origin` when there is one. */
function reveal(change, origin) {
  if (!origin || !document.startViewTransition || prefersReducedMotion()) {
    change();
    return;
  }
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = document.startViewTransition(change);
  t.ready
    .then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 620, easing: "cubic-bezier(.16, 1, .3, 1)", pseudoElement: "::view-transition-new(root)" },
    ))
    .catch(() => { /* transition skipped — the change is already applied */ });
}

const centre = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function applyTheme(theme, origin) {
  if (theme !== currentTheme()) reveal(() => setTheme(theme), origin);
}

function applyColor(color, origin) {
  if (color !== currentColor()) reveal(() => setColor(color), origin);
}

/** @param {HTMLButtonElement} sw */
function initSwitch(sw) {
  // Takes the theme explicitly: during a view transition the DOM still has
  // the old one for a frame, but the switch should move immediately.
  const sync = (theme = currentTheme()) => {
    const dark = theme === "dark";
    sw.setAttribute("aria-checked", String(dark));
    sw.title = dark ? "Switch to light" : "Switch to dark";
  };
  sync();

  sw.addEventListener("click", () => {
    const next = sw.getAttribute("aria-checked") === "true" ? "light" : "dark";
    write(KEY, next);
    applyTheme(next, centre(sw));
    sync(next);
  });

  media.addEventListener("change", () => {
    if (read(KEY, null)) return;
    applyTheme(system());
    sync(system());
  });

  onExternalChange(KEY, (v) => {
    const theme = v === "light" || v === "dark" ? v : system();
    applyTheme(theme);
    sync(theme);
  });
}

/** A radio group of swatches, one per colourway. @param {HTMLElement} group */
function initSwatches(group) {
  const swatches = /** @type {HTMLButtonElement[]} */ ([...group.querySelectorAll("[data-color]")]);

  // Roving focus: Tab lands on the chosen swatch, arrows move between them.
  const sync = (color = currentColor()) => {
    for (const s of swatches) {
      const on = s.dataset.color === color;
      s.setAttribute("aria-checked", String(on));
      s.tabIndex = on ? 0 : -1;
    }
  };
  sync();

  const pick = (swatch) => {
    const color = validColor(swatch.dataset.color);
    write(COLOR_KEY, color);
    applyColor(color, centre(swatch));
    sync(color);
  };

  group.addEventListener("click", (e) => {
    const swatch = e.target.closest("[data-color]");
    if (swatch) pick(swatch);
  });

  group.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const at = Math.max(0, swatches.indexOf(/** @type {any} */ (document.activeElement)));
    const next = swatches[(at + step + swatches.length) % swatches.length];
    next.focus();
    pick(next);
  });

  onExternalChange(COLOR_KEY, (v) => {
    const color = validColor(v);
    applyColor(color);
    sync(color);
  });
}

/** @param {HTMLButtonElement} sw @param {HTMLElement | null} swatches */
export function initTheme(sw, swatches) {
  initSwitch(sw);
  if (swatches) initSwatches(swatches);
}
