import { test } from "node:test";
import assert from "node:assert/strict";
import { planBoard, box } from "../js/circuit/board.js";
import { roundedRect } from "../js/circuit/geometry.js";

/* The mockup's own layout, in mockup pixels (u = 1). */
const mockup = {
  u: 1,
  w: 1493,
  h: 772,
  M: box(34, 41, 238, 238),
  Q: box(325, 120, 651, 82),
  P: box(1023, 37, 438, 198),
  F: box(303, 278, 767, 434),
  D: box(1103, 287, 345, 215),
  T: box(1453, 314, 40, 128),
  G: box(1300, 680, 155, 44),
  W: box(40, 698, 190, 22),
  PG: box(1141, 547, 110, 16),
};

const plan = planBoard(mockup);
const everyPath = [
  ...plan.buses.flatMap((b) => b.lines),
  ...Object.values(plan.routes),
  plan.coil,
  plan.glyphs.B,
  plan.glyphs.D,
  ...plan.glyphs.C,
];

test("every path is finite", () => {
  for (const d of everyPath) assert.doesNotMatch(d, /NaN|Infinity|undefined/, d);
});

test("the glyph cluster sits between the matrix and the wordmark", () => {
  const ringTop = Number(plan.glyphs.C[0].match(/^M[\d.]+ ([\d.]+)/)[1]);
  assert.ok(ringTop > mockup.M.b, "ring clears the matrix");
  assert.ok(plan.glyphs.dot.cy < mockup.W.y, "the ! clears the wordmark");
});

test("the diagonal glyph stays in the band above the search bar", () => {
  const [x0, y0, x1, y1] = plan.glyphs.B.match(/[\d.]+/g).map(Number);
  assert.ok(y1 > mockup.P.y && y0 < mockup.Q.y);
  assert.ok(x0 > mockup.Q.x && x1 < mockup.Q.r);
});

test("every route the lights use exists", () => {
  for (const id of ["glyph", "key", "spi", "i2s", "ntf", "data", "tmr"]) assert.ok(plan.routes[id], id);
});

test("buses carry the requested number of traces", () => {
  const counts = Object.fromEntries(plan.buses.map((b) => [b.id, b.lines.length]));
  assert.equal(counts.key, 3);
  assert.equal(counts.data, 4);
  assert.equal(counts.glyphbus, 3);
});

test("rounded rectangles close and stay inside their box", () => {
  const d = roundedRect(0, 0, 100, 60, 20);
  assert.match(d, /^M50 0 .* Z$/);
  for (const n of d.match(/-?\d+(\.\d+)?/g).map(Number)) assert.ok(n >= 0 && n <= 100);
});
