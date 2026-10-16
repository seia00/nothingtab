/* Suggestion proxy.

   Every general-purpose suggest endpoint refuses cross-origin browser requests —
   Google, DuckDuckGo, Brave and Qwant all fail CORS from the page. Only a server
   can call them, so this relays the query and hands back plain JSON.

   Runs on the edge, so it's a short hop from the browser rather than a round trip
   to a single region. */

export const config = { runtime: "edge" };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const UPSTREAM_TIMEOUT_MS = 2500;

async function ask(url, pick) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json,text/javascript,*/*" },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const picked = pick(await res.json());
  return Array.isArray(picked) ? picked.filter((s) => typeof s === "string") : [];
}

// Google for Google-like engines, DuckDuckGo for the privacy-minded ones; each
// covers for the other when it fails.
const google = (q, hl, gl) =>
  ask(
    "https://suggestqueries.google.com/complete/search" +
      `?client=firefox&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}` +
      (hl ? `&hl=${hl}` : "") +
      (gl ? `&gl=${gl}` : ""),
    (d) => d?.[1]
  );

// Google localises on the caller's IP, and from here that's whichever edge node
// took the request — which returned Chinese suggestions for a Japanese query.
// The client sends its own locale instead, in the query string so it stays part
// of the cache key.
const tag = (v, max) => {
  const s = (v || "").trim().toLowerCase();
  return /^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(s) ? s.slice(0, max) : "";
};

const duck = (q) =>
  ask(`https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(q)}`, (d) => d?.[1]);

function json(body, { cache = true } = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Identical prefixes get typed constantly; let the edge absorb them —
      // but never pin a failed lookup, or one timeout empties that query for ages.
      "cache-control": cache ? "public, s-maxage=600, stale-while-revalidate=3600" : "no-store",
    },
  });
}

export default async function handler(request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || "").trim();
  if (!q || q.length > 200) return json({ q, suggestions: [] });

  const hl = tag(params.get("hl"), 5);
  const gl = tag(params.get("gl") || request.headers.get("x-vercel-ip-country"), 2);

  // Suggestions come from the engine Return will search, where there is one:
  // DuckDuckGo-family engines ask DuckDuckGo first, everything else Google.
  const order = params.get("src") === "duck" ? [() => duck(q), () => google(q, hl, gl)]
    : [() => google(q, hl, gl), () => duck(q)];

  let suggestions = null;
  for (const source of order) {
    try {
      suggestions = await source();
      break;
    } catch {
      // try the next source
    }
  }
  // Both refused — an empty list just means no dropdown, never a broken page.
  if (!suggestions) return json({ q, suggestions: [], degraded: true }, { cache: false });

  return json({ q, suggestions: suggestions.slice(0, 8) });
}
