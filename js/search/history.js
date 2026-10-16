/* What you've searched and opened from this bar — the stand-in for Safari's
   own history, which a page can't read. Every function is pure (list in, new
   list out) so ranking is tested without a browser; persistence lives in
   search.js. Nothing here leaves the device. */

export const MAX_ENTRIES = 400;
const DAY = 86_400_000;

/** @typedef {{ t: "q" | "u", v: string, n: number, at: number, title?: string }} Entry */

const normal = (t, v) => (t === "q" ? v.trim().replace(/\s+/g, " ") : v.trim());
const keyOf = (t, v) => `${t}\u0000${t === "q" ? v.toLowerCase() : v}`;

/* Recency-weighted visit count, the same shape Firefox calls frecency. */
export function frecency(e, now) {
  const age = (now - e.at) / DAY;
  const weight = age < 4 ? 1 : age < 14 ? 0.7 : age < 31 ? 0.5 : age < 90 ? 0.3 : 0.1;
  return e.n * weight;
}

const byRank = (now) => (a, b) => frecency(b, now) - frecency(a, now) || b.at - a.at;

/**
 * @param {Entry[]} list
 * @param {{ t: "q" | "u", v: string, title?: string }} item
 * @param {number} now
 * @returns {Entry[]}
 */
export function record(list, { t, v, title }, now) {
  const value = normal(t, String(v ?? ""));
  if (!value) return list;
  const key = keyOf(t, value);
  const prev = list.find((e) => keyOf(e.t, e.v) === key);
  const named = title ? { title: String(title).slice(0, 120) } : {};
  const entry = prev
    ? { ...prev, ...named, n: prev.n + 1, at: now }
    : { t, v: value, n: 1, at: now, ...named };
  const rest = list.filter((e) => e !== prev);
  if (rest.length < MAX_ENTRIES) return [entry, ...rest];
  return [entry, ...[...rest].sort(byRank(now)).slice(0, MAX_ENTRIES - 1)];
}

/** @param {Entry[]} list @param {"q"|"u"} t @param {string} v */
export function forget(list, t, v) {
  const key = keyOf(t, normal(t, v));
  return list.filter((e) => keyOf(e.t, e.v) !== key);
}

/** Past searches that extend `prefix`. @returns {string[]} */
export function matchQueries(list, prefix, now, limit = 4) {
  const p = normal("q", String(prefix ?? "")).toLowerCase();
  if (!p) return [];
  return list
    .filter((e) => e.t === "q" && e.v.toLowerCase().startsWith(p) && e.v.toLowerCase() !== p)
    .sort(byRank(now))
    .slice(0, limit)
    .map((e) => e.v);
}

const bare = (url) => url.replace(/^[a-z]+:\/\/(www\.)?/i, "");

/** Opened pages whose address or title contains `text`. @returns {Entry[]} */
export function matchUrls(list, text, now, limit = 3) {
  const p = String(text ?? "").trim().toLowerCase();
  if (!p) return [];
  return list
    .filter((e) => e.t === "u" && `${bare(e.v)} ${e.title || ""}`.toLowerCase().includes(p))
    .sort(byRank(now))
    .slice(0, limit);
}

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Safari-style inline completion: "you" → "youtube.com". Typing past the host
 * ("github.com/ver") completes into a specific page instead.
 * @returns {{ text: string, url: string } | null}
 */
export function completeHost(list, prefix, now) {
  const p = String(prefix ?? "").toLowerCase();
  if (!p || /\s/.test(p)) return null;
  const deep = p.includes("/");
  const scores = new Map();

  for (const e of list) {
    if (e.t !== "u") continue;
    const u = parse(e.v);
    if (!u || !/^https?:$/.test(u.protocol)) continue;
    const host = u.host.replace(/^www\./, "");
    const text = deep ? bare(e.v).replace(/\/$/, "") : host;
    if (!text.toLowerCase().startsWith(p)) continue;
    const url = deep ? e.v : `${u.protocol}//${u.host}/`;
    const prev = scores.get(text);
    const score = (prev?.score || 0) + frecency(e, now);
    scores.set(text, { text, url, score });
  }

  let best = null;
  for (const s of scores.values()) if (!best || s.score > best.score) best = s;
  return best ? { text: best.text, url: best.url } : null;
}

/** Newest searches first, for the empty-focus dropdown. @returns {string[]} */
export function recentQueries(list, limit = 6) {
  return list
    .filter((e) => e.t === "q")
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((e) => e.v);
}
