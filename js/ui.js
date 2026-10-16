/* DOM helpers, UI icons and the toast. */

import { emit } from "./bus.js";

const svg = (body, cls = "") =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ""}>${body}</svg>`;

/* Static, trusted markup only — never anything typed or fetched. */
export const ICON = {
  search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.1 5.1"/>'),
  corner: svg('<path d="M7.5 16.5 16.5 7.5M9 7.5h7.5V15"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  pencil: svg('<path d="M15.2 5.3a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5l-4 1 1-4z"/><path d="m13.5 7 3.5 3.5"/>'),
  history: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3h3M12 8v4.2l2.8 1.8"/>'),
  globe: svg('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.2 2.3 3.3 5 3.3 8s-1.1 5.7-3.3 8c-2.2-2.3-3.3-5-3.3-8S9.8 6.3 12 4Z"/>'),
  equals: svg('<path d="M6 9.5h12M6 14.5h12"/>'),
  bolt: svg('<path d="M13 3.5 6 13h5.5L10.5 20.5 18 10.5h-5.5z"/>'),
  arrow: svg('<path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
};

/**
 * Build an element. String children become text nodes, so nothing passed as a
 * child is ever parsed as HTML; `html` is reserved for ICON markup.
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...(Node | string | null | false | undefined | Array<any>)} children
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "style") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Let a liquid-glass surface's glint follow the pointer.
 * @param {HTMLElement} el
 */
export function liquid(el) {
  if (!el || prefersReducedMotion()) return;
  let frame = 0;
  el.addEventListener("pointermove", (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
  el.addEventListener("pointerleave", () => {
    cancelAnimationFrame(frame);
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
  });
}

let toastTimer = 0;

/**
 * @param {string} message
 * @param {number} [ms]
 * @param {{ label: string, run: () => void }} [action] a button in the toast, like Undo
 */
export function toast(message, ms = 2800, action = undefined) {
  const el = $("#toast");
  if (!el) return;
  el.replaceChildren(message);
  if (action) {
    el.append(h("button", {
      class: "toast__action",
      type: "button",
      onclick: () => {
        clearTimeout(toastTimer);
        el.hidden = true;
        action.run();
      },
    }, action.label));
  }
  el.hidden = false;
  // Restart the entrance animation when one toast replaces another.
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  emit("notify", message); // the diagonal Glyph flashes with it
}

/** @param {number} ms @returns {string} m:ss */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Copy text; resolves false when the clipboard is unavailable. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
