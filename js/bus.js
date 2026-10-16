/* A tiny event bus so modules can react to each other (track changes reach the
   Glyph Matrix, the timer reaches the LED) without importing each other. */

const bus = new EventTarget();

/** @param {string} type @param {unknown} [detail] */
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

/** @param {string} type @param {(detail: any) => void} fn */
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(/** @type {CustomEvent} */ (e).detail));
