import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

const csp = vercel.headers
  .flatMap((r) => r.headers)
  .find((h) => h.key === "Content-Security-Policy")?.value || "";

test("every inline script is allowed by its hash in the CSP", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const body of scripts) {
    const hash = `sha256-${createHash("sha256").update(body).digest("base64")}`;
    assert.ok(csp.includes(`'${hash}'`), `CSP is missing ${hash} — re-hash after editing the inline script`);
  }
});

test("the production build keeps every inline script allowed too", { skip: !existsSync(new URL("../dist/index.html", import.meta.url)) && "run npm run build first" }, () => {
  const built = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const scripts = [...built.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const body of scripts) {
    const hash = `sha256-${createHash("sha256").update(body).digest("base64")}`;
    assert.ok(csp.includes(`'${hash}'`), `dist inline script ${hash} not in CSP`);
  }
  assert.match(csp, /font-src 'self' data:/, "inlined fonts need data: in font-src");
});

test("the CSP never allows inline or eval'd script wholesale", () => {
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) || "";
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
  assert.ok(!scriptSrc.includes("'unsafe-eval'"));
  assert.match(csp, /frame-ancestors 'none'/);
});
