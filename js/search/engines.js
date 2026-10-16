/* Search engines (the default the bar searches with) and bangs (one-off
   redirects: "!gh react", "react !gh", or "gh react" for the longer keys).

   Every `search` receives an already-encoded query. */

export const ENGINES = {
  google:     { name: "Google",     suggest: "google", search: (q) => `https://www.google.com/search?q=${q}` },
  duckduckgo: { name: "DuckDuckGo", suggest: "duck",   search: (q) => `https://duckduckgo.com/?q=${q}` },
  bing:       { name: "Bing",       suggest: "google", search: (q) => `https://www.bing.com/search?q=${q}` },
  brave:      { name: "Brave",      suggest: "duck",   search: (q) => `https://search.brave.com/search?q=${q}` },
  ecosia:     { name: "Ecosia",     suggest: "google", search: (q) => `https://www.ecosia.org/search?q=${q}` },
  kagi:       { name: "Kagi",       suggest: "duck",   search: (q) => `https://kagi.com/search?q=${q}` },
  perplexity: { name: "Perplexity", suggest: "google", search: (q) => `https://www.perplexity.ai/search?q=${q}` },
};

export const DEFAULT_ENGINE = "google";

export const engineFor = (key) => ENGINES[key] || ENGINES[DEFAULT_ENGINE];

const AMAZON = { JP: "amazon.co.jp", GB: "amazon.co.uk", DE: "amazon.de", FR: "amazon.fr",
  IT: "amazon.it", ES: "amazon.es", CA: "amazon.ca", IN: "amazon.in", AU: "amazon.com.au" };

const wikiLang = (ctx) => (/^[a-z]{2,3}$/.test(ctx.lang || "") ? ctx.lang : "en");
const amazon = (ctx) => AMAZON[ctx.region] || "amazon.com";

/* `bare: true` lets the key work without "!" as the first word. Only keys that
   are not everyday words get that — otherwise "a cat" would open Amazon. */
export const BANGS = [
  { keys: ["g"], name: "Google", home: () => "https://www.google.com/",
    search: (q) => ENGINES.google.search(q) },
  { keys: ["ddg"], name: "DuckDuckGo", bare: true, home: () => "https://duckduckgo.com/",
    search: (q) => ENGINES.duckduckgo.search(q) },
  { keys: ["gh"], name: "GitHub", bare: true, home: () => "https://github.com/",
    search: (q) => `https://github.com/search?q=${q}` },
  { keys: ["yt"], name: "YouTube", bare: true, home: () => "https://www.youtube.com/",
    search: (q) => `https://www.youtube.com/results?search_query=${q}` },
  { keys: ["w", "wiki"], name: "Wikipedia", home: (c) => `https://${wikiLang(c)}.wikipedia.org/`,
    search: (q, c) => `https://${wikiLang(c)}.wikipedia.org/w/index.php?search=${q}` },
  { keys: ["m", "maps"], name: "Maps", home: () => "https://www.google.com/maps",
    search: (q) => `https://www.google.com/maps/search/${q}` },
  { keys: ["np", "npm"], name: "npm", bare: true, home: () => "https://www.npmjs.com/",
    search: (q) => `https://www.npmjs.com/search?q=${q}` },
  { keys: ["mdn"], name: "MDN", bare: true, home: () => "https://developer.mozilla.org/",
    search: (q) => `https://developer.mozilla.org/search?q=${q}` },
  { keys: ["r", "reddit"], name: "Reddit", home: () => "https://www.reddit.com/",
    search: (q) => `https://www.reddit.com/search/?q=${q}` },
  { keys: ["x"], name: "X", home: () => "https://x.com/",
    search: (q) => `https://x.com/search?q=${q}` },
  { keys: ["a", "amz"], name: "Amazon", home: (c) => `https://www.${amazon(c)}/`,
    search: (q, c) => `https://www.${amazon(c)}/s?k=${q}` },
  { keys: ["sp"], name: "Spotify", home: () => "https://open.spotify.com/",
    search: (q) => `https://open.spotify.com/search/${q}` },
  { keys: ["i", "img"], name: "Images", home: () => "https://images.google.com/",
    search: (q) => `https://www.google.com/search?tbm=isch&q=${q}` },
  { keys: ["tr"], name: "Translate", home: () => "https://translate.google.com/",
    search: (q) => `https://translate.google.com/?sl=auto&text=${q}` },
  { keys: ["p", "pplx"], name: "Perplexity", home: () => "https://www.perplexity.ai/",
    search: (q) => ENGINES.perplexity.search(q) },
  { keys: ["gpt"], name: "ChatGPT", home: () => "https://chatgpt.com/",
    search: (q) => `https://chatgpt.com/?q=${q}` },
  { keys: ["claude"], name: "Claude", home: () => "https://claude.ai/new",
    search: (q) => `https://claude.ai/new?q=${q}` },
];

const BY_KEY = new Map(BANGS.flatMap((b) => b.keys.map((k) => [k, b])));

/** @param {string} key */
export const bangFor = (key) => BY_KEY.get(key.toLowerCase()) || null;
