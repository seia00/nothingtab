/* The search bar. Behaves like Safari's: Return goes to an address or
   searches, a known site completes inline as you type ("you" → youtube.com,
   the rest selected), ↓/↑ walk the suggestions, ⌘↩ opens a new tab, Esc
   backs out one step at a time. IME composition (Japanese, Chinese, Korean)
   is never interrupted — no completion and no submit mid-composition. */

import { resolve } from "./resolve.js";
import { ENGINES, DEFAULT_ENGINE, engineFor } from "./engines.js";
import * as hist from "./history.js";
import { buildRows } from "./rows.js";
import { fetchSuggestions, cachedSuggestions } from "./suggest.js";
import { read, write, onExternalChange } from "../store.js";
import { on, emit } from "../bus.js";
import { h, ICON, toast, copyText, $ } from "../ui.js";
import { language, region } from "../locale.js";

const DEBOUNCE_MS = 70;
const MAX_QUERY = 200;

/** @param {{ favorites: () => ReadonlyArray<{name: string, url: string} | null> }} deps */
export function initSearch({ favorites }) {
  const form = $("#search");
  const input = /** @type {HTMLInputElement} */ ($("#q"));
  const panel = $("#suggest");
  const chip = $("#chip");
  const engineBtn = $("#engine-btn");
  const menu = $("#engine-menu");

  let engine = ENGINES[read("engine", DEFAULT_ENGINE)] ? read("engine", DEFAULT_ENGINE) : DEFAULT_ENGINE;
  let suggestOn = read("suggest", true) !== false;
  let history = Array.isArray(read("history", [])) ? read("history", []) : [];

  let typed = "";
  let completion = null; // { text, url, name } shown inline right now
  let rows = [];
  let active = -1;
  let web = [];
  let composing = false;
  let debounce = 0;

  const ctx = () => ({ engine, lang: language(), region: region() });
  const locale = () => ({ src: engineFor(engine).suggest, hl: (navigator.language || "en").toLowerCase(), gl: region() });

  /* ── History ──────────────────────────────────────────────────── */

  const remember = (record) => {
    if (!record) return;
    history = hist.record(history, record, Date.now());
    write("history", history);
  };

  onExternalChange("history", (v) => { history = Array.isArray(v) ? v : []; });
  on("visit", ({ url, title }) => remember({ t: "u", v: url, title }));

  /* ── Inline completion ────────────────────────────────────────── */

  const hostOf = (url) => new URL(url).host.replace(/^www\./, "");

  function completionFor(t) {
    const p = t.toLowerCase();
    if (!p || /\s/.test(p)) return null;
    for (const fav of favorites()) {
      if (!fav) continue;
      const host = hostOf(fav.url);
      const domain = host.split(".").slice(-2).join(".");
      const text = host.startsWith(p) ? host : domain.startsWith(p) ? domain : null;
      if (text) return { text, url: fav.url, name: fav.name };
    }
    return hist.completeHost(history, t, Date.now());
  }

  function tryComplete() {
    const c = completionFor(typed);
    if (!c || c.text.length <= typed.length || !c.text.toLowerCase().startsWith(typed.toLowerCase())) return;
    input.value = typed + c.text.slice(typed.length);
    input.setSelectionRange(typed.length, input.value.length, "forward");
    completion = { text: input.value, url: c.url, name: c.name };
  }

  /* ── Rendering ────────────────────────────────────────────────── */

  const open = () => !panel.hidden && rows.length > 0;

  function close() {
    panel.hidden = true;
    panel.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    rows = [];
    active = -1;
  }

  function rebuild() {
    rows = buildRows({ typed, completion, web, history, favorites: favorites(), ctx: ctx(), now: Date.now() });
    if (active >= rows.length) active = -1;
    paint();
  }

  function paint() {
    if (!rows.length || document.activeElement !== input) { close(); return; }
    const out = [];
    let section = "";
    rows.forEach((row, i) => {
      if (row.section !== section) {
        section = row.section;
        out.push(h("div", { class: "suggest__section", role: "presentation" },
          h("span", {}, section),
          row.kind === "recent"
            ? h("button", { class: "suggest__clear", type: "button", onclick: clearRecent }, "Clear")
            : null));
      }
      out.push(rowEl(row, i));
    });
    panel.replaceChildren(...out);
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) input.setAttribute("aria-activedescendant", `srow-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }

  /* Suggestion text comes from a third party: it is only ever set as text. */
  function rowEl(row, i) {
    const text = h("span", { class: "srow__text" });
    const n = row.typedLen || 0;
    if (n && row.label.toLowerCase().startsWith(typed.trim().toLowerCase())) {
      text.append(h("span", { class: "typed" }, row.label.slice(0, n)), row.label.slice(n));
    } else {
      text.append(row.label);
    }
    if (row.sub) text.append(h("span", { class: "srow__sub" }, row.sub));

    return h("div", {
      class: `srow srow--${row.kind}`,
      id: `srow-${i}`,
      role: "option",
      "aria-selected": String(i === active),
      onclick: (e) => choose(row, { newTab: e.metaKey || e.ctrlKey }),
    },
    h("span", { class: "srow__icon", html: row.icon }),
    text,
    h("span", { class: "srow__end" },
      row.removable
        ? h("button", {
          class: "srow__remove", type: "button", "aria-label": `Remove ${row.label} from history`,
          html: ICON.close,
          onclick: (e) => { e.stopPropagation(); forget(row); },
        })
        : null,
      row.hint ? h("span", { class: "srow__hint" }, row.hint) : null));
  }

  function updateChip() {
    const r = resolve(input.value, ctx());
    const label = r?.kind === "bang" ? r.label : null;
    chip.textContent = label || "";
    chip.hidden = !label;
  }

  /* ── Web suggestions ──────────────────────────────────────────── */

  function requestWeb() {
    clearTimeout(debounce);
    const q = typed.trim();
    const r = resolve(q, ctx());
    if (!suggestOn || !q || q.length > MAX_QUERY || r?.kind === "url" || r?.kind === "bang") {
      web = [];
      return;
    }
    const cached = cachedSuggestions(q, locale());
    if (cached) { web = cached; return; }
    debounce = setTimeout(async () => {
      const list = await fetchSuggestions(q, locale());
      if (list === null || typed.trim() !== q) return;
      web = list;
      if (active === -1) rebuild();
    }, DEBOUNCE_MS);
  }

  /* ── Input ────────────────────────────────────────────────────── */

  function onInput(allowComplete) {
    emit("keys");
    typed = input.value;
    completion = null;
    active = -1;
    const caretAtEnd = input.selectionStart === input.value.length;
    if (allowComplete && caretAtEnd) tryComplete();
    updateChip();
    requestWeb();
    rebuild();
  }

  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => {
    composing = false;
    onInput(false);
  });

  input.addEventListener("input", (e) => {
    if (composing || e.isComposing) {
      typed = input.value;
      completion = null;
      return;
    }
    onInput(!/^delete/.test(e.inputType || ""));
  });

  input.addEventListener("keydown", (e) => {
    if (e.isComposing || composing || e.keyCode === 229) return;

    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!open()) {
          if (e.key === "ArrowDown") { e.preventDefault(); rebuild(); }
          return;
        }
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      case "Enter":
        e.preventDefault();
        submit({ newTab: e.metaKey || e.ctrlKey });
        return;
      case "Tab":
        if (e.shiftKey) return;
        if (completion && input.selectionEnd !== input.selectionStart) {
          e.preventDefault();
          input.setSelectionRange(input.value.length, input.value.length);
          typed = input.value;
        } else if (open() && active >= 0) {
          e.preventDefault();
          input.value = rows[active].fill ?? rows[active].label;
          onInput(false);
        }
        return;
      case "Escape":
        e.preventDefault();
        if (open()) {
          if (active >= 0) { input.value = typed; active = -1; }
          close();
        } else if (input.value) {
          input.value = "";
          onInput(false);
        } else {
          input.blur();
        }
        return;
      case "Backspace":
      case "Delete":
        if (e.shiftKey && open() && active >= 0 && rows[active].removable) {
          e.preventDefault();
          forget(rows[active]);
        }
        return;
      default:
    }
  });

  function move(dir) {
    const last = rows.length - 1;
    if (dir > 0) active = active >= last ? -1 : active + 1;
    else active = active <= -1 ? last : active - 1;
    if (active === -1) {
      input.value = completion ? completion.text : typed;
      if (completion) input.setSelectionRange(typed.length, input.value.length);
    } else {
      input.value = rows[active].fill ?? rows[active].label;
    }
    updateChip();
    paint();
    panel.querySelector(`#srow-${active}`)?.scrollIntoView({ block: "nearest" });
  }

  /* ── Going somewhere ──────────────────────────────────────────── */

  function submit({ newTab = false } = {}) {
    if (active >= 0) { choose(rows[active], { newTab }); return; }
    if (completion && input.value === completion.text) {
      go({ url: completion.url, record: { t: "u", v: completion.url, title: completion.name } }, newTab);
      return;
    }
    const raw = input.value.trim();
    const r = resolve(raw, ctx());
    if (!r) return;
    go({ url: r.url, record: r.kind === "url" ? { t: "u", v: r.url } : { t: "q", v: raw } }, newTab);
  }

  async function choose(row, { newTab = false } = {}) {
    if (row.action === "copy") {
      const ok = await copyText(row.label.replace(/,/g, ""));
      toast(ok ? `Copied ${row.label}` : "Clipboard unavailable");
      return;
    }
    if (row.target) go(row.target, newTab);
  }

  function go(target, newTab) {
    remember(target.record);
    close();
    if (newTab) {
      window.open(target.url, "_blank", "noopener");
      return;
    }
    location.assign(target.url);
  }

  function forget(row) {
    history = hist.forget(history, row.removable.t, row.removable.v);
    write("history", history);
    if (active >= 0) {
      input.value = typed;
      active = -1;
    }
    rebuild();
  }

  function clearRecent() {
    history = history.filter((e) => e.t !== "q");
    write("history", history);
    toast("Search history cleared");
    rebuild();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });

  // Keep focus in the bar when a row is pressed; close on any outside press.
  panel.addEventListener("mousedown", (e) => e.preventDefault());
  input.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== input) close(); }, 0));
  input.addEventListener("click", () => { if (!open()) rebuild(); });

  /* ── Engine menu ──────────────────────────────────────────────── */

  const placeholder = () => {
    input.placeholder = engine === DEFAULT_ENGINE ? "Search" : `Search ${engineFor(engine).name}`;
    engineBtn.setAttribute("aria-label", `Search engine: ${engineFor(engine).name}`);
    form.action = engineFor(engine).search("").replace(/\?.*$/, "");
  };

  function buildMenu() {
    const items = Object.entries(ENGINES).map(([key, e]) =>
      h("button", {
        class: "menu__item", type: "button", role: "menuitemradio",
        "aria-checked": String(key === engine),
        onclick: () => { engine = key; write("engine", key); placeholder(); closeMenu(); input.focus(); },
      }, e.name));
    const toggle = h("button", {
      class: "menu__item", type: "button", role: "menuitemcheckbox",
      "aria-checked": String(suggestOn),
      onclick: () => {
        suggestOn = !suggestOn;
        write("suggest", suggestOn);
        web = [];
        toast(suggestOn ? "Live suggestions on" : "Live suggestions off — nothing you type leaves this page until you press Return", 3600);
        closeMenu();
        input.focus();
      },
    }, "Live suggestions");
    menu.replaceChildren(
      h("div", { class: "suggest__section", role: "presentation" }, h("span", {}, "Search with")),
      ...items,
      h("div", { class: "suggest__section", role: "presentation" }, h("span", {}, "Privacy")),
      toggle,
    );
  }

  function openMenu() {
    close();
    buildMenu();
    menu.hidden = false;
    engineBtn.setAttribute("aria-expanded", "true");
    menu.querySelector('[aria-checked="true"]')?.focus();
  }

  function closeMenu() {
    menu.hidden = true;
    engineBtn.setAttribute("aria-expanded", "false");
  }

  engineBtn.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));

  menu.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll(".menu__item")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      engineBtn.focus();
    }
  });

  document.addEventListener("pointerdown", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !engineBtn.contains(e.target)) closeMenu();
  });

  placeholder();

  return {
    focus() {
      input.focus({ preventScroll: true });
      input.select();
    },
  };
}
