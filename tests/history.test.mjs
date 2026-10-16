import { test } from "node:test";
import assert from "node:assert/strict";
import {
  record, forget, matchQueries, matchUrls, completeHost, recentQueries, MAX_ENTRIES,
} from "../js/search/history.js";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 15);

test("record is immutable and counts repeats", () => {
  const empty = [];
  const one = record(empty, { t: "q", v: "hello" }, now);
  assert.equal(empty.length, 0);
  assert.deepEqual(one, [{ t: "q", v: "hello", n: 1, at: now }]);
  const two = record(one, { t: "q", v: "Hello " }, now + 5);
  assert.equal(two.length, 1);
  assert.equal(two[0].n, 2);
  assert.equal(two[0].at, now + 5);
  assert.equal(one[0].n, 1);
});

test("history is capped, dropping the weakest entries", () => {
  let list = [];
  for (let i = 0; i < MAX_ENTRIES + 25; i++) list = record(list, { t: "q", v: `q${i}` }, now + i);
  assert.equal(list.length, MAX_ENTRIES);
  assert.ok(list.some((e) => e.v === `q${MAX_ENTRIES + 24}`));
});

test("forget removes one entry", () => {
  const list = record(record([], { t: "q", v: "a" }, now), { t: "q", v: "b" }, now);
  assert.deepEqual(forget(list, "q", "a").map((e) => e.v), ["b"]);
});

test("queries match by prefix, ranked by frecency", () => {
  let list = [];
  list = record(list, { t: "q", v: "react hooks" }, now - 60 * DAY);
  list = record(list, { t: "q", v: "react hooks" }, now - 60 * DAY);
  list = record(list, { t: "q", v: "react router" }, now - DAY);
  list = record(list, { t: "q", v: "vue" }, now);
  assert.deepEqual(matchQueries(list, "rea", now), ["react router", "react hooks"]);
  assert.deepEqual(matchQueries(list, "react hooks", now), []);
});

test("urls match on host, path or title", () => {
  const list = record([], { t: "u", v: "https://github.com/vercel/next.js", title: "Next.js repo" }, now);
  assert.equal(matchUrls(list, "vercel", now).length, 1);
  assert.equal(matchUrls(list, "next.js repo", now).length, 1);
  assert.equal(matchUrls(list, "gitlab", now).length, 0);
});

test("host completion prefers the most-used site and ignores www", () => {
  let list = [];
  list = record(list, { t: "u", v: "https://www.youtube.com/watch?v=1" }, now);
  list = record(list, { t: "u", v: "https://www.youtube.com/" }, now);
  list = record(list, { t: "u", v: "https://yourname.dev/" }, now);
  const hit = completeHost(list, "you", now);
  assert.equal(hit.text, "youtube.com");
  assert.equal(hit.url, "https://www.youtube.com/");
  assert.equal(completeHost(list, "zzz", now), null);
  assert.equal(completeHost(list, "", now), null);
  assert.equal(completeHost(list, "you tube", now), null);
});

test("recent queries are newest first", () => {
  let list = [];
  list = record(list, { t: "q", v: "old" }, now - 10);
  list = record(list, { t: "u", v: "https://x.com/" }, now - 5);
  list = record(list, { t: "q", v: "new" }, now);
  assert.deepEqual(recentQueries(list, 5), ["new", "old"]);
});
