/* Local preview: static files plus the /api/suggest edge function, so search
   suggestions work exactly as they do on Vercel. Binds to 127.0.0.1 because
   Spotify only accepts loopback redirect URIs written as an IP.

     node dev-server.mjs                      source, http://127.0.0.1:8123/
     node dev-server.mjs --dir dist           the production build
     node dev-server.mjs --latency 70         add 70 ms per request, roughly
                                              a round trip to a CDN edge */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import suggest from "./api/suggest.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const PROJECT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const ROOT = resolve(PROJECT, arg("dir", "."));
const PORT = Number(arg("port", process.env.PORT)) || 8123;
const HOST = process.env.HOST || "127.0.0.1";
const LATENCY_MS = Number(arg("latency", 0)) || 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The same security headers Vercel sends (vercel.json), so a CSP mistake shows
   up here first. Cache headers are skipped — locally everything is no-store. */
const VERCEL = JSON.parse(await readFile(join(PROJECT, "vercel.json"), "utf8"));
const HEADER_RULES = (VERCEL.headers || []).map((rule) => ({
  test: new RegExp(`^${rule.source}$`),
  headers: rule.headers.filter((h) => h.key.toLowerCase() !== "cache-control"),
}));

const securityHeaders = (pathname) => Object.fromEntries(
  HEADER_RULES.filter((r) => r.test.test(pathname)).flatMap((r) => r.headers.map((h) => [h.key, h.value])),
);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

async function serveStatic(pathname, res) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const file = resolve(ROOT, rel || "index.html");
  // Never serve anything outside the project, or its dotfiles.
  if (!file.startsWith(ROOT + sep) && file !== ROOT) return send(res, 403, "Forbidden");
  if (file.slice(ROOT.length).split(sep).some((part) => part.startsWith("."))) return send(res, 404, "Not found");

  try {
    const info = await stat(file);
    const target = info.isDirectory() ? join(file, "index.html") : file;
    const body = await readFile(target);
    res.writeHead(200, {
      ...securityHeaders(pathname),
      "content-type": TYPES[extname(target)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    send(res, 404, "Not found");
  }
}

async function serveSuggest(req, res) {
  const request = new Request(`http://${HOST}:${PORT}${req.url}`, { headers: req.headers });
  const response = await suggest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function send(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

createServer(async (req, res) => {
  try {
    if (LATENCY_MS) await sleep(LATENCY_MS);
    const { pathname } = new URL(req.url, `http://${HOST}`);
    if (pathname === "/api/suggest") return await serveSuggest(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return await serveStatic(pathname, res);
  } catch (err) {
    console.error(err);
    return send(res, 500, "Server error");
  }
}).listen(PORT, HOST, () => {
  console.log(`nothingtab → http://${HOST}:${PORT}/  (${ROOT}${LATENCY_MS ? `, +${LATENCY_MS} ms` : ""})`);
});
