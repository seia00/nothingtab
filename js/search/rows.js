/* Builds the suggestion list for whatever is typed — the same order Safari
   uses: an answer, the top hit, engine suggestions, then your own history and
   favorites. Each row knows where Return on it goes. */

import { resolve, parseAddress, bangLabel, searchUrl } from "./resolve.js";
import { answer } from "./calc.js";
import { matchQueries, matchUrls, recentQueries } from "./history.js";
import { engineFor } from "./engines.js";
import { ICON } from "../ui.js";
import { brandFor, brandSvg } from "../brands.js";

const MAX_ROWS = 10;
const MAX_WEB = 6;

/**
 * @typedef {object} Row
 * @property {string} kind
 * @property {string} section
 * @property {string} icon       trusted markup
 * @property {string} label
 * @property {string} [sub]
 * @property {string} [hint]
 * @property {string} [fill]     text put in the bar while the row is highlighted
 * @property {{ url: string, record: { t: "q" | "u", v: string, title?: string } } | null} [target]
 * @property {number} [typedLen] leading characters that echo what was typed
 * @property {"copy"} [action]
 * @property {{ t: "q" | "u", v: string }} [removable]
 */

const host = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const iconFor = (url) => brandSvg(brandFor(url)) || ICON.globe;
const searchTarget = (q, ctx) => ({ url: searchUrl(q, ctx), record: { t: "q", v: q } });

/**
 * @param {object} p
 * @param {string} p.typed           text the user typed (no inline completion)
 * @param {{ text: string, url: string, name?: string } | null} p.completion
 * @param {string[]} p.web
 * @param {import("./history.js").Entry[]} p.history
 * @param {ReadonlyArray<{ name: string, url: string } | null>} p.favorites
 * @param {{ engine: string, lang: string, region: string }} p.ctx
 * @param {number} p.now
 * @returns {Row[]}
 */
export function buildRows({ typed, completion, web, history, favorites, ctx, now }) {
  const raw = typed.trim();
  if (!raw) {
    return recentQueries(history, 6).map((q) => ({
      kind: "recent", section: "Recent", icon: ICON.history, label: q, fill: q,
      target: searchTarget(q, ctx), removable: { t: "q", v: q },
    }));
  }

  const rows = [];
  const seen = new Set();
  const add = (row) => {
    const key = row.target?.url || row.label;
    if (seen.has(key) || rows.length >= MAX_ROWS) return;
    seen.add(key);
    rows.push(row);
  };

  const ans = answer(raw);
  if (ans) {
    add({ kind: "answer", section: ans.kind === "convert" ? "Conversion" : "Calculator",
      icon: ICON.equals, label: ans.text, hint: "Copy", action: "copy", fill: raw });
  }

  const bang = bangLabel(raw);
  if (bang) {
    const r = resolve(raw, ctx);
    add({ kind: "bang", section: "Top hit", icon: ICON.bolt, label: raw, hint: bang, fill: raw,
      target: { url: r.url, record: { t: "q", v: raw } } });
  } else if (completion) {
    add({ kind: "top", section: "Top hit", icon: iconFor(completion.url), label: completion.text,
      sub: completion.name, fill: completion.text, typedLen: typed.length,
      target: { url: completion.url, record: { t: "u", v: completion.url, title: completion.name } } });
  } else {
    const addr = parseAddress(raw);
    if (addr) {
      add({ kind: "url", section: "Top hit", icon: iconFor(addr), label: raw, hint: "Open", fill: raw,
        target: { url: addr, record: { t: "u", v: addr } } });
    }
  }

  const lower = raw.toLowerCase();
  const local = [
    ...matchQueries(history, raw, now, 3).map((q) => ({
      kind: "history", section: "History", icon: ICON.history, label: q, fill: q,
      typedLen: raw.length, target: searchTarget(q, ctx), removable: { t: "q", v: q } })),
    ...favorites
      .filter((f) => f && (f.name.toLowerCase().startsWith(lower) || host(f.url).startsWith(lower)))
      .slice(0, 2)
      .map((f) => ({ kind: "favorite", section: "Favorites", icon: iconFor(f.url), label: f.name,
        sub: host(f.url), fill: host(f.url), target: { url: f.url, record: { t: "u", v: f.url, title: f.name } } })),
    ...matchUrls(history, raw, now, 3).map((e) => ({
      kind: "page", section: "History", icon: iconFor(e.v), label: e.title || host(e.v),
      sub: e.title ? host(e.v) : undefined, fill: host(e.v),
      target: { url: e.v, record: { t: "u", v: e.v, title: e.title } }, removable: { t: "u", v: e.v } })),
  ];

  // Engine suggestions get whatever room your own matches leave, never under three.
  const webRoom = Math.max(3, Math.min(MAX_WEB, MAX_ROWS - rows.length - local.length));
  const engineName = engineFor(ctx.engine).name;
  web
    .filter((q) => q.toLowerCase() !== lower)
    .slice(0, webRoom)
    .forEach((q) => add({ kind: "suggest", section: `${engineName} Search`, icon: ICON.search, label: q,
      fill: q, typedLen: raw.length, target: searchTarget(q, ctx) }));

  local.forEach(add);

  return groupBySection(rows);
}

/* Rows were added in priority order; keep each section together so headings
   don't repeat, in the order sections first appeared. */
function groupBySection(rows) {
  const order = [];
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.section)) { groups.set(r.section, []); order.push(r.section); }
    groups.get(r.section).push(r);
  }
  return order.flatMap((s) => groups.get(s));
}
