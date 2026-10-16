/* Six favorites slots. Hovering a tile shows its edit and remove buttons
   (and ⌫ removes the focused one); removing can be undone from the toast.
   EDIT keeps those buttons out for touch, and lets you drag one tile onto
   another to swap them. Empty slots are always tappable. */

import { read, write, onExternalChange } from "./store.js";
import { emit } from "./bus.js";
import { h, ICON, toast } from "./ui.js";
import { brandFor, brandSvg, simpleIconSlug } from "./brands.js";
import { createEditor } from "./fav-editor.js";

export const SLOTS = 6;
const KEY = "favorites";
const DRAG_PX = 6;
const UNDO_MS = 6000;

const DEFAULTS = [
  { name: "Google", url: "https://www.google.com/" },
  { name: "YouTube", url: "https://www.youtube.com/" },
  { name: "Notion", url: "https://www.notion.so/" },
  { name: "GitHub", url: "https://github.com/" },
  { name: "X", url: "https://x.com/" },
  { name: "Spotify", url: "https://open.spotify.com/" },
];

/* Stored data is re-validated on every load: only http(s) URLs ever reach an
   href, whatever ended up in localStorage. */
function sanitize(entry) {
  if (!entry || typeof entry.url !== "string") return null;
  try {
    const u = new URL(entry.url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const name = String(entry.name || u.hostname).trim().slice(0, 24) || u.hostname;
    return { name, url: u.href };
  } catch {
    return null;
  }
}

function load() {
  const raw = read(KEY, null);
  if (!Array.isArray(raw)) return DEFAULTS.map((d) => ({ ...d }));
  return Array.from({ length: SLOTS }, (_, i) => sanitize(raw[i]));
}

let slots = load();

/** @returns {ReadonlyArray<{name: string, url: string} | null>} */
export const favorites = () => slots;

/* Simple Icons probe results for this session, so re-renders don't flicker. */
const probes = new Map();

function mark(fav) {
  const brand = brandFor(fav.url);
  if (brand) return h("span", { class: "tile__mark", html: brandSvg(brand) });

  const box = h("span", { class: "tile__mark" },
    h("span", { class: "tile__mono" }, fav.name.charAt(0).toUpperCase()));
  const slug = simpleIconSlug(fav.url);
  if (!slug) return box;

  const src = `https://cdn.simpleicons.org/${slug}`;
  const useIcon = () => box.replaceChildren(h("span", { class: "si", style: { "--src": `url("${src}")` } }));
  if (probes.get(slug) === true) {
    useIcon();
  } else if (!probes.has(slug)) {
    const img = new Image();
    img.onload = () => { probes.set(slug, true); useIcon(); };
    img.onerror = () => probes.set(slug, false);
    img.src = src;
  }
  return box;
}

/**
 * @param {{ grid: HTMLElement, editButton: HTMLButtonElement }} els
 */
export function initFavorites({ grid, editButton }) {
  let editing = false;
  let suppressClick = false;

  const save = (next) => {
    slots = next;
    write(KEY, slots);
    render();
  };

  const focusSlot = (i) => grid.querySelector(`[data-slot="${i}"]`)?.focus();

  /* Back where it was — or, if that slot has been filled since, the first
     free one. */
  function restore(i, fav) {
    const at = slots[i] ? slots.indexOf(null) : i;
    if (at < 0) {
      toast("No free slot to put it back in");
      return;
    }
    save(slots.map((s, j) => (j === at ? fav : s)));
    focusSlot(at);
  }

  function removeSlot(i) {
    const fav = slots[i];
    if (!fav) return;
    save(slots.map((s, j) => (j === i ? null : s)));
    focusSlot(i);
    toast(`Removed ${fav.name}`, UNDO_MS, { label: "Undo", run: () => restore(i, fav) });
  }

  const openEditor = createEditor({
    onSave: (i, fav) => save(slots.map((s, j) => (j === i ? fav : s))),
    onClear: removeSlot,
  });

  /* Edit and remove sit beside the link rather than inside it — a button
     can't live in an <a> — and show on hover, focus, or in edit mode. */
  const actions = (fav, i) => h("div", { class: "tile__actions" },
    h("button", {
      class: "tile__act frost",
      type: "button",
      title: "Edit",
      "aria-label": `Edit ${fav.name}`,
      html: ICON.pencil,
      onclick: () => openEditor(i, fav),
    }),
    h("button", {
      class: "tile__act tile__act--remove frost",
      type: "button",
      title: "Remove",
      "aria-label": `Remove ${fav.name}`,
      html: ICON.close,
      onclick: () => removeSlot(i),
    }));

  function tile(fav, i) {
    if (!fav) {
      return h("button", {
        class: "tile tile--empty",
        type: "button",
        "data-slot": i,
        "aria-label": `Add a favorite to slot ${i + 1}`,
        onclick: () => { if (!suppressClick) openEditor(i, null); },
      },
      h("span", { class: "tile__mark", html: ICON.plus }),
      h("span", { class: "tile__name" }, "Add"));
    }

    const link = h("a", {
      class: "tile glass",
      href: fav.url,
      "data-slot": i,
      title: fav.name,
      draggable: "false",
      onclick: (e) => {
        if (suppressClick || editing) {
          e.preventDefault();
          if (!suppressClick) openEditor(i, fav);
          return;
        }
        emit("visit", { url: fav.url, title: fav.name });
      },
    },
    h("span", { class: "tile__key", "aria-hidden": "true" }, String(i + 1)),
    h("span", { class: "tile__corner", "aria-hidden": "true", html: ICON.corner }),
    mark(fav),
    h("span", { class: "tile__name" }, fav.name));
    return [link, actions(fav, i)];
  }

  function render() {
    grid.replaceChildren(...slots.map((fav, i) => h("li", {}, tile(fav, i))));
  }

  function setEditing(on) {
    editing = on;
    editButton.setAttribute("aria-pressed", String(on));
    editButton.textContent = on ? "Done" : "Edit";
    grid.toggleAttribute("data-editing", on);
    render();
  }

  editButton.addEventListener("click", () => setEditing(!editing));

  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const link = e.target.closest("a[data-slot]");
    if (!link) return;
    e.preventDefault();
    removeSlot(Number(link.dataset.slot));
  });

  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editing && !document.querySelector("dialog[open]")) setEditing(false);
  });

  /* Drag to swap, edit mode only. Pointer events rather than HTML5 drag and
     drop so it works the same with a finger on iPad. */
  let drag = null;

  grid.addEventListener("pointerdown", (e) => {
    if (!editing || e.button !== 0) return;
    const el = e.target.closest("[data-slot]");
    if (!el) return;
    drag = { el, from: Number(el.dataset.slot), x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  });

  grid.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      try {
        drag.el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone — the grid still receives the moves */
      }
      drag.el.classList.add("is-dragging");
    }
    e.preventDefault();
    drag.el.style.setProperty("--dx", `${dx}px`);
    drag.el.style.setProperty("--dy", `${dy}px`);
    const over = slotAt(e.clientX, e.clientY);
    grid.querySelectorAll(".is-target").forEach((t) => t.classList.remove("is-target"));
    if (over !== null && over !== drag.from) grid.querySelector(`[data-slot="${over}"]`)?.classList.add("is-target");
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { from, moved } = drag;
    drag = null;
    if (!moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const to = e.type === "pointerup" ? slotAt(e.clientX, e.clientY) : null;
    if (to === null || to === from) { render(); return; }
    const next = [...slots];
    [next[from], next[to]] = [next[to], next[from]];
    save(next);
  };

  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);

  function slotAt(x, y) {
    const items = [...grid.children];
    const i = items.findIndex((li) => {
      const r = li.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    return i < 0 ? null : i;
  }

  onExternalChange(KEY, () => {
    slots = load();
    render();
  });

  render();
}

/** Open slot `i` (0-based) if it holds a link. @returns {boolean} */
export function openSlot(i, { newTab = false } = {}) {
  const fav = slots[i];
  if (!fav) return false;
  emit("visit", { url: fav.url, title: fav.name });
  if (newTab) window.open(fav.url, "_blank", "noopener");
  else location.assign(fav.url);
  return true;
}
