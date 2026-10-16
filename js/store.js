/* localStorage with a namespace, JSON, and no throwing. Safari blocks storage
   in some private and file:// contexts — the page keeps working, it just
   forgets on reload. */

const PREFIX = "nothingtab.";

/** @template T @param {string} key @param {T} fallback @returns {T} */
export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** @param {string} key @param {unknown} value @returns {boolean} saved */
export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} key */
export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* nothing stored, nothing to remove */
  }
}

/**
 * Fires when another tab changes `key` — new tabs are this page too, so the
 * timer, theme and favorites stay in step across all of them.
 * @param {string} key @param {(value: unknown) => void} fn
 */
export function onExternalChange(key, fn) {
  addEventListener("storage", (e) => {
    if (e.key !== PREFIX + key) return;
    try {
      fn(e.newValue === null ? null : JSON.parse(e.newValue));
    } catch {
      fn(null);
    }
  });
}
