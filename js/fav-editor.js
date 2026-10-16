/* The sheet for editing one favorites slot. */

import { $ } from "./ui.js";
import { parseAddress } from "./search/resolve.js";

const NAME_MAX = 24;

/** "notion.so" → "Notion" */
export function nameFromUrl(url) {
  try {
    const base = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "";
  }
}

/** A typed address → an http(s) URL, or null. Never javascript: and friends. */
export function toWebUrl(raw) {
  const href = parseAddress(raw);
  return href && /^https?:\/\//i.test(href) ? href : null;
}

/**
 * @param {{ onSave: (slot: number, fav: {name: string, url: string}) => void,
 *           onClear: (slot: number) => void }} handlers
 */
export function createEditor({ onSave, onClear }) {
  const dialog = /** @type {HTMLDialogElement} */ ($("#fav-dialog"));
  const form = $("#fav-form");
  const url = /** @type {HTMLInputElement} */ ($("#fav-url"));
  const name = /** @type {HTMLInputElement} */ ($("#fav-name"));
  const error = $("#fav-error");
  const title = $("#fav-dialog-title");
  const clear = $("#fav-clear");

  let slot = 0;
  let nameTouched = false;

  const fail = (msg) => {
    error.textContent = msg;
    error.hidden = false;
  };

  url.addEventListener("input", () => {
    error.hidden = true;
    if (nameTouched) return;
    const href = toWebUrl(url.value);
    name.placeholder = href ? nameFromUrl(href) : "Name";
  });

  name.addEventListener("input", () => { nameTouched = name.value.trim() !== ""; });

  // Close/Cancel are type="button", so Return in a field submits Save.
  [$("#fav-close"), $("#fav-cancel")].forEach((b) => b.addEventListener("click", () => dialog.close("cancel")));

  clear.addEventListener("click", () => {
    onClear(slot);
    dialog.close("clear");
  });

  form.addEventListener("submit", (e) => {
    const submitter = /** @type {HTMLButtonElement | null} */ (e.submitter);
    if (submitter && submitter.value !== "save") return;
    const href = toWebUrl(url.value);
    if (!href) {
      e.preventDefault();
      fail("Enter a web address, like notion.so or https://example.com");
      url.focus();
      return;
    }
    const label = (name.value.trim() || nameFromUrl(href) || "Link").slice(0, NAME_MAX);
    onSave(slot, { name: label, url: href });
  });

  /** @param {number} index @param {{name: string, url: string} | null} current */
  return function open(index, current) {
    slot = index;
    nameTouched = Boolean(current);
    title.textContent = `Slot ${String(index + 1).padStart(2, "0")}`;
    url.value = current?.url || "";
    name.value = current?.name || "";
    name.placeholder = current ? "" : "Name";
    clear.hidden = !current;
    error.hidden = true;
    dialog.showModal();
    url.focus();
    url.select();
  };
}
