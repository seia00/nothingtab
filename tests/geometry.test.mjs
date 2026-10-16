import { test } from "node:test";
import assert from "node:assert/strict";
import { chamfered, offsetPolyline, spiral, arc, edgeOfCircle } from "../js/circuit/geometry.js";

const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);

test("a straight trace is a single segment", () => {
  assert.equal(chamfered([[0, 0], [10, 0]], 3), "M0 0 L10 0");
});

test("right-angle corners are cut at 45°, PCB style", () => {
  const d = chamfered([[0, 0], [10, 0], [10, 10]], 3);
  assert.equal(d, "M0 0 L7 0 L10 3 L10 10");
});

test("chamfers never eat more than half of a short segment", () => {
  const d = chamfered([[0, 0], [4, 0], [4, 4]], 10);
  assert.equal(d, "M0 0 L2 0 L4 2 L4 4");
});

test("offset traces stay parallel through a corner", () => {
  const line = [[0, 0], [10, 0], [10, 10]];
  const out = offsetPolyline(line, 2);
  // Heading east then south: "left" is up (−y), then east (+x).
  assert.deepEqual(out[0], [0, -2]);
  assert.deepEqual(out[1], [12, -2]);
  assert.deepEqual(out[2], [12, 10]);
});

test("a spiral starts at its inner radius and ends at its outer one", () => {
  const n = nums(spiral(50, 50, 10, 30, 3));
  assert.deepEqual(n.slice(0, 2), [50, 40]);
  const [x, y] = n.slice(-2);
  assert.ok(Math.abs(Math.hypot(x - 50, y - 50) - 30) < 0.2);
});

test("arcs use clock angles: 0° at twelve, clockwise", () => {
  assert.equal(arc(0, 0, 10, 0, 90), "M0 -10 A10 10 0 0 1 10 0");
  assert.match(arc(0, 0, 10, 0, 270), / 1 1 /);
});

test("edgeOfCircle finds where a horizontal or vertical line meets a circle", () => {
  assert.deepEqual(edgeOfCircle({ cx: 0, cy: 0, r: 10 }, { y: 0 }, "right"), [10, 0]);
  assert.deepEqual(edgeOfCircle({ cx: 0, cy: 0, r: 10 }, { x: 6 }, "bottom"), [6, 8]);
  assert.equal(edgeOfCircle({ cx: 0, cy: 0, r: 10 }, { x: 20 }, "bottom"), null);
});
