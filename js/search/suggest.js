/* Live suggestions through the /api/suggest relay (search engines refuse CORS,
   so only a server can ask them). Results are cached per prefix, so deleting
   back through a word is instant and costs no requests. */

const CACHE_MAX = 120;
const cache = new Map();
let controller = null;

/**
 * @param {string} q
 * @param {{ src: string, hl: string, gl: string }} locale
 * @returns {Promise<string[] | null>} null when superseded by a newer request
 */
export async function fetchSuggestions(q, { src, hl, gl }) {
  const key = `${src}|${hl}|${gl}|${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  controller?.abort();
  const mine = new AbortController();
  controller = mine;

  const params = new URLSearchParams({ q, hl, src });
  if (gl) params.set("gl", gl.toLowerCase());

  try {
    const res = await fetch(`/api/suggest?${params}`, { signal: mine.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.suggestions)
      ? data.suggestions.filter((s) => typeof s === "string" && s.length < 200).slice(0, 8)
      : [];
    if (!data?.degraded) {
      cache.set(key, list);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    return list;
  } catch (err) {
    if (err?.name === "AbortError") return null;
    return [];
  }
}

/** Synchronous cache peek, for painting before the network answers. */
export function cachedSuggestions(q, { src, hl, gl }) {
  return cache.get(`${src}|${hl}|${gl}|${q.toLowerCase()}`) || null;
}
