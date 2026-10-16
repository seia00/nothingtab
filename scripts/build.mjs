/* Production build → dist/
     dist/index.html        the page, with every stylesheet and both fonts inlined
     dist/app-<hash>.js     all modules, bundled and minified
     dist/sw.js             precaches exactly those, versioned by the bundle hash
     dist/assets/icon.svg

   Two requests instead of forty-two: the source loads ES modules one import
   level at a time, so each level is another round trip to the server. Inlining
   the CSS and fonts also means nothing blocks the first paint but the HTML.

   Development keeps using the unbundled source (npm run dev). */

import { build } from "esbuild";
import { readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");
const TARGETS = ["safari16.4", "chrome120", "firefox121"];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replace exactly one occurrence, or fail the build — never ship a half-built
 * page. `find` is a literal string or a RegExp; the replacement is inserted
 * verbatim (a function, so "$" in CSS or JS is never read as a pattern).
 */
function swap(text, find, replacement, what) {
  const re = new RegExp(find instanceof RegExp ? find.source : escape(find), "g");
  const hits = text.match(re);
  if (!hits || hits.length !== 1) throw new Error(`build: expected one ${what}, found ${hits ? hits.length : 0}`);
  return text.replace(re, () => replacement);
}

async function bundleCss(html) {
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  if (!hrefs.length) throw new Error("build: no stylesheets found in index.html");
  const result = await build({
    stdin: {
      contents: hrefs.map((h) => `@import "./${h}";`).join("\n"),
      resolveDir: ROOT,
      sourcefile: "styles.css",
      loader: "css",
    },
    bundle: true,
    minify: true,
    write: false,
    target: TARGETS,
    loader: { ".woff2": "dataurl", ".svg": "dataurl" },
    logLevel: "warning",
  });
  return { hrefs, css: result.outputFiles[0].text };
}

async function bundleJs() {
  const result = await build({
    entryPoints: [join(ROOT, "js/main.js")],
    bundle: true,
    format: "esm",
    minify: true,
    write: false,
    target: TARGETS,
    outdir: OUT,
    entryNames: "app-[hash]",
    legalComments: "none",
    logLevel: "warning",
  });
  const file = result.outputFiles.find((f) => f.path.endsWith(".js"));
  return { name: file.path.slice(OUT.length + 1), code: file.text };
}

function assembleHtml(source, { hrefs, css }, app) {
  let html = source;
  // Fonts travel inside the CSS now, so their preloads would be wasted requests.
  html = html.replace(/\s*<link rel="preload" href="[^"]+" as="font"[^>]*>/g, "");
  // All stylesheets → one <style> where the first one was.
  hrefs.forEach((href, i) => {
    html = swap(html, `<link rel="stylesheet" href="${href}">`, i === 0 ? `<style>${css}</style>` : "", `stylesheet ${href}`);
  });
  html = html.replace(/\n\s*\n(\s*<link rel="modulepreload")/, "\n$1");
  html = swap(html, '<link rel="modulepreload" href="js/main.js">', `<link rel="modulepreload" href="/${app}">`, "modulepreload");
  html = swap(html, '<script type="module" src="js/main.js"></script>', `<script type="module" src="/${app}"></script>`, "module script");
  return html;
}

function assembleWorker(source, app, version) {
  let sw = swap(source, /const VERSION = "[^"]*";/, `const VERSION = "${version}";`, "VERSION");
  sw = swap(sw, /const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ["/", "/${app}", "/assets/icon.svg"];`, "PRECACHE");
  return sw;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const report = (name, text) => console.log(`  ${name.padEnd(22)} ${kb(text.length).padStart(9)}   gzip ${kb(gzipSync(text).length).padStart(8)}`);

async function main() {
  const source = await readFile(join(ROOT, "index.html"), "utf8");
  const [styles, js] = await Promise.all([bundleCss(source), bundleJs()]);
  const version = js.name.replace(/^app-|\.js$/g, "");
  const html = assembleHtml(source, styles, js.name);
  const sw = assembleWorker(await readFile(join(ROOT, "sw.js"), "utf8"), js.name, version);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, "assets"), { recursive: true });
  await Promise.all([
    writeFile(join(OUT, "index.html"), html),
    writeFile(join(OUT, js.name), js.code),
    writeFile(join(OUT, "sw.js"), sw),
    copyFile(join(ROOT, "assets/icon.svg"), join(OUT, "assets/icon.svg")),
  ]);

  console.log(`built dist/ (${version})`);
  report("index.html", html);
  report(js.name, js.code);
  report("sw.js", sw);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
