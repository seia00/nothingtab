import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddress, resolve } from "../js/search/resolve.js";

const ctx = { engine: "google", lang: "en", region: "US" };

test("bare domains become https URLs", () => {
  assert.equal(parseAddress("github.com"), "https://github.com/");
  assert.equal(parseAddress("react.dev/learn"), "https://react.dev/learn");
  assert.equal(parseAddress("www.example.co.uk/a?b=c#d"), "https://www.example.co.uk/a?b=c#d");
  assert.equal(parseAddress("Example.COM"), "https://example.com/");
  assert.equal(parseAddress("google.com."), "https://google.com./");
});

test("internationalised domains are punycoded", () => {
  assert.match(parseAddress("例え.jp"), /^https:\/\/xn--[a-z0-9-]+\.jp\/$/);
});

test("development hosts stay on http", () => {
  assert.equal(parseAddress("localhost"), "http://localhost/");
  assert.equal(parseAddress("localhost:3000"), "http://localhost:3000/");
  assert.equal(parseAddress("localhost:3000/api?x=1"), "http://localhost:3000/api?x=1");
  assert.equal(parseAddress("app.localhost"), "http://app.localhost/");
  assert.equal(parseAddress("127.0.0.1:8123/x"), "http://127.0.0.1:8123/x");
  assert.equal(parseAddress("192.168.1.1"), "http://192.168.1.1/");
  assert.equal(parseAddress("[::1]:8080"), "http://[::1]:8080/");
  assert.equal(parseAddress("nas:5000"), "http://nas:5000/");
  assert.equal(parseAddress("intranet/"), "http://intranet/");
  assert.equal(parseAddress("site.test"), "http://site.test/");
});

test("explicit schemes pass through", () => {
  assert.equal(parseAddress("https://example.com"), "https://example.com/");
  assert.equal(parseAddress("http://foo.bar"), "http://foo.bar/");
  assert.equal(parseAddress("mailto:a@b.com"), "mailto:a@b.com");
  assert.equal(parseAddress("spotify:track:123"), "spotify:track:123");
});

test("dangerous schemes are never treated as addresses", () => {
  for (const s of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,hi",
    "vbscript:x",
    "file:///etc/passwd",
    "blob:https://x.com/1",
  ]) {
    assert.equal(parseAddress(s), null, s);
  }
});

test("ordinary queries stay queries", () => {
  for (const s of [
    "how to center a div",
    "node.js",
    "next.js",
    "3.14",
    "hello",
    "a@b.com",
    "google.com is down",
    "foo.bar",
    "999.1.1.1",
    "1.2.3",
    "c++",
    "todo:buy milk",
    "e.g.",
    "-flag.com",
    "",
    "   ",
  ]) {
    assert.equal(parseAddress(s), null, JSON.stringify(s));
  }
});

test("addresses resolve to a URL with no chip", () => {
  const r = resolve("github.com/vercel", ctx);
  assert.equal(r.kind, "url");
  assert.equal(r.url, "https://github.com/vercel");
});

test("plain text searches the chosen engine, fully encoded", () => {
  assert.equal(resolve("a b&c", ctx).url, "https://www.google.com/search?q=a%20b%26c");
  assert.equal(resolve("x", { ...ctx, engine: "duckduckgo" }).url, "https://duckduckgo.com/?q=x");
  assert.equal(resolve("q", { ...ctx, engine: "nope" }).url, "https://www.google.com/search?q=q");
  assert.equal(resolve("node.js", ctx).kind, "search");
});

test("bangs work as prefix, suffix and bare-prefix forms", () => {
  const gh = "https://github.com/search?q=react";
  assert.equal(resolve("!gh react", ctx).url, gh);
  assert.equal(resolve("react !gh", ctx).url, gh);
  assert.equal(resolve("gh react", ctx).url, gh);
  assert.equal(resolve("GH react", ctx).url, gh);
  assert.equal(resolve("!gh react", ctx).label, "GitHub");
});

test("short bang keys need the ! so ordinary words are not hijacked", () => {
  assert.equal(resolve("w paris", ctx).kind, "search");
  assert.equal(resolve("a cat", ctx).kind, "search");
  assert.equal(resolve("!w paris", ctx).kind, "bang");
  assert.equal(resolve("!w paris", { ...ctx, lang: "ja" }).url,
    "https://ja.wikipedia.org/w/index.php?search=paris");
});

test("a bare bang opens that site's home page", () => {
  assert.equal(resolve("!gh", ctx).url, "https://github.com/");
  assert.equal(resolve("!yt", ctx).url, "https://www.youtube.com/");
});

test("unknown bangs fall through to an ordinary search", () => {
  const r = resolve("!nope thing", ctx);
  assert.equal(r.kind, "search");
  assert.equal(r.url, "https://www.google.com/search?q=!nope%20thing");
});
