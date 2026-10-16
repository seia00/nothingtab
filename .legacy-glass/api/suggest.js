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

// Google matches where Enter actually sends you, so its suggestions never point
// somewhere the results page won't. DuckDuckGo covers the case where it fails.
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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Identical prefixes get typed constantly; let the edge absorb them.
      "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}

export default async function handler(request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || "").trim();
  if (!q || q.length > 200) return json({ q, suggestions: [] });

  const hl = tag(params.get("hl"), 5);
  const gl = tag(params.get("gl") || request.headers.get("x-vercel-ip-country"), 2);

  let suggestions = [];
  try {
    suggestions = await google(q, hl, gl);
  } catch {
    try {
      suggestions = await duck(q);
    } catch {
      // Both refused — an empty list just means no dropdown, never a broken page.
      return json({ q, suggestions: [], degraded: true });
    }
  }

  return json({ q, suggestions: suggestions.slice(0, 8) });
}
