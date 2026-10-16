import { test } from "node:test";
import assert from "node:assert/strict";
import { brandFor, simpleIconSlug } from "../js/brands.js";
import { toWebUrl, nameFromUrl } from "../js/fav-editor.js";

test("favorites only ever store http(s) addresses", () => {
  assert.equal(toWebUrl("notion.so"), "https://notion.so/");
  assert.equal(toWebUrl("http://localhost:3000"), "http://localhost:3000/");
  assert.equal(toWebUrl("javascript:alert(1)"), null);
  assert.equal(toWebUrl("mailto:a@b.com"), null);
  assert.equal(toWebUrl("data:text/html,x"), null);
  assert.equal(toWebUrl("just words"), null);
});

test("a name is suggested from the host", () => {
  assert.equal(nameFromUrl("https://www.linear.app/"), "Linear");
  assert.equal(nameFromUrl("not a url"), "");
});

test("built-in marks match their brands' hosts", () => {
  assert.equal(brandFor("https://www.google.co.jp/"), "google");
  assert.equal(brandFor("https://music.youtube.com/"), "youtube");
  assert.equal(brandFor("https://twitter.com/x"), "x");
  assert.equal(brandFor("https://open.spotify.com/"), "spotify");
  assert.equal(brandFor("https://notgithub.com/"), null);
  assert.equal(brandFor("garbage"), null);
});

test("Simple Icons slugs come from the second-level domain", () => {
  assert.equal(simpleIconSlug("https://linear.app/"), "linear");
  assert.equal(simpleIconSlug("https://www.bbc.co.uk/news"), "bbc");
  assert.equal(simpleIconSlug("https://docs.figma.com/"), "figma");
  assert.equal(simpleIconSlug("http://localhost:3000/"), null);
  assert.equal(simpleIconSlug("https://xn--r8jz45g.jp/"), null);
});
