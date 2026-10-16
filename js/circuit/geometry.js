/* Path geometry for the circuit layer. Pure functions, tested in
   tests/geometry.test.mjs. Angles are clock angles: 0° at twelve, clockwise. */

const r1 = (n) => Math.round(n * 10) / 10 + 0; // +0 turns -0 into 0
const pt = ([x, y]) => `${r1(x)} ${r1(y)}`;

/**
 * Polyline → SVG path with 45° chamfered corners, the way PCB traces bend.
 * @param {Array<[number, number]>} points
 * @param {number} cut chamfer length
 */
export function chamfered(points, cut) {
  if (points.length < 2) return "";
  let d = `M${pt(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    if (!inLen || !outLen) continue;
    const k = Math.min(cut, inLen / 2, outLen / 2);
    d += ` L${pt([x - ((x - px) / inLen) * k, y - ((y - py) / inLen) * k])}`;
    d += ` L${pt([x + ((nx - x) / outLen) * k, y + ((ny - y) / outLen) * k])}`;
  }
  return `${d} L${pt(points[points.length - 1])}`;
}

function leftNormal([ax, ay], [bx, by]) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  return [(by - ay) / len, -(bx - ax) / len];
}

/**
 * A copy of the polyline shifted sideways by `o` (miter joins), so a bus of
 * traces keeps its spacing through every corner.
 * @param {Array<[number, number]>} points
 * @param {number} o positive = left of the direction of travel
 */
export function offsetPolyline(points, o) {
  return points.map((p, i) => {
    const n1 = i > 0 ? leftNormal(points[i - 1], p) : null;
    const n2 = i < points.length - 1 ? leftNormal(p, points[i + 1]) : null;
    if (!n1) return [r1(p[0] + n2[0] * o), r1(p[1] + n2[1] * o)];
    if (!n2) return [r1(p[0] + n1[0] * o), r1(p[1] + n1[1] * o)];
    const s = 1 + n1[0] * n2[0] + n1[1] * n2[1] || 1;
    return [r1(p[0] + ((n1[0] + n2[0]) / s) * o), r1(p[1] + ((n1[1] + n2[1]) / s) * o)];
  });
}

const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

/** Archimedean spiral from r0 to r1 — a wireless-charging coil. */
export function spiral(cx, cy, r0, r1Outer, turns, steps = 28) {
  const total = Math.round(turns * steps);
  const out = [];
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    out.push(pt(polar(cx, cy, r0 + (r1Outer - r0) * t, t * turns * 360)));
  }
  return `M${out[0]} L${out.slice(1).join(" L")}`;
}

/** Circular arc between two clock angles, drawn clockwise. */
export function arc(cx, cy, r, from, to) {
  const sweep = (((to - from) % 360) + 360) % 360 || 360;
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, from + Math.min(sweep, 359.99));
  return `M${pt([x0, y0])} A${r1(r)} ${r1(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${pt([x1, y1])}`;
}

/**
 * Where a horizontal ({y}) or vertical ({x}) line meets a circle, on the
 * named side. Null when it misses.
 * @param {{cx: number, cy: number, r: number}} c
 * @param {{x?: number, y?: number}} line
 * @param {"left"|"right"|"top"|"bottom"} side
 */
export function edgeOfCircle({ cx, cy, r }, line, side) {
  if (line.y !== undefined) {
    const dy = line.y - cy;
    if (Math.abs(dy) > r) return null;
    const dx = Math.sqrt(r * r - dy * dy);
    return [r1(side === "left" ? cx - dx : cx + dx), r1(line.y)];
  }
  const dx = line.x - cx;
  if (Math.abs(dx) > r) return null;
  const dy = Math.sqrt(r * r - dx * dx);
  return [r1(line.x), r1(side === "top" ? cy - dy : cy + dy)];
}

/** Rounded rectangle, starting at top-centre and running clockwise. */
export function roundedRect(x, y, w, h, radius) {
  const k = Math.min(radius, w / 2, h / 2);
  const a = (to) => `A${r1(k)} ${r1(k)} 0 0 1 ${pt(to)}`;
  return [
    `M${pt([x + w / 2, y])}`,
    `L${pt([x + w - k, y])}`, a([x + w, y + k]),
    `L${pt([x + w, y + h - k])}`, a([x + w - k, y + h]),
    `L${pt([x + k, y + h])}`, a([x, y + h - k]),
    `L${pt([x, y + k])}`, a([x + k, y]),
    "Z",
  ].join(" ");
}
