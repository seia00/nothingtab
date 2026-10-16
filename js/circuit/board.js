/* Plans the circuit board under the chassis: buses of traces that wire the
   modules together, a few parts (an IC, passives, test points, a charging
   coil), and the Phone (1) Glyph Interface zones that sit in the free space.

   measureBoard() reads the live layout; planBoard() is pure, so the plan is
   tested with plain rectangles (tests/board.test.mjs). Everything is in the
   shell's own pixels; `u` is one mockup pixel at the current scale. */

import { chamfered, offsetPolyline, spiral, arc, edgeOfCircle } from "./geometry.js";

/** @typedef {{ x: number, y: number, w: number, h: number, r: number, b: number, cx: number, cy: number }} Box */

const SELECTORS = {
  M: ".glyph__face",
  Q: "#search",
  P: "#player",
  F: ".favorites",
  D: ".display",
  T: "#tube",
  G: "#glyph-button",
  W: ".wordmark",
  PG: ".pager__dots",
};

/** @param {HTMLElement} shell @returns {Record<string, any> | null} */
export function measureBoard(shell) {
  const S = shell.getBoundingClientRect();
  const k = S.width / shell.offsetWidth || 1; // undo any transform on an ancestor
  const out = {
    w: shell.offsetWidth,
    h: shell.offsetHeight,
    u: parseFloat(getComputedStyle(shell).getPropertyValue("--u")) || 1,
  };
  for (const [key, sel] of Object.entries(SELECTORS)) {
    const el = shell.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    out[key] = box((r.left - S.left) / k, (r.top - S.top) / k, r.width / k, r.height / k);
  }
  return out;
}

/** @returns {Box} */
export const box = (x, y, w, h) => ({ x, y, w, h, r: x + w, b: y + h, cx: x + w / 2, cy: y + h / 2 });

/* One bus: `n` parallel traces following a centre line. */
function bus(id, center, n, pitch, cut, extra = {}) {
  const lines = [];
  const ends = [];
  for (let i = 0; i < n; i++) {
    const pts = offsetPolyline(center, (i - (n - 1) / 2) * pitch);
    lines.push(chamfered(pts, cut));
    ends.push(pts[0], pts[pts.length - 1]);
  }
  return { id, lines, ends, route: chamfered(center, cut), ...extra };
}

/**
 * @param {{ u: number, w: number, h: number, M: Box, Q: Box, P: Box, F: Box,
 *   D: Box, T: Box, G: Box, W: Box, PG: Box }} m
 */
export function planBoard(m) {
  const { u, M, Q, P, F, D, T, G, W, PG } = m;
  const pitch = 5.5 * u;
  const cut = 7 * u;
  const matrix = { cx: M.cx, cy: M.cy, r: M.w / 2 };

  /* ── Glyph cluster under the matrix: Phone (1)'s ring and "!" ── */
  const gw = 5 * u;
  const cx = M.cx;
  const room = W.y - M.b;
  const ringR = Math.max(36 * u, Math.min(70 * u, (room - 230 * u) / 2));
  const ringCy = M.b + 34 * u + ringR;
  const stripTop = ringCy + ringR + 28 * u;
  const stripBottom = stripTop + 92 * u;
  const dotY = stripBottom + 17 * u;
  const GAP = 12;
  const ring = [0, 1, 2, 3].map((k) => arc(cx, ringCy, ringR, k * 90 + GAP / 2, (k + 1) * 90 - GAP / 2));

  /* Diagonal glyph: top band above the search bar, at its right end. */
  const bLen = Math.min(50 * u, Q.y - P.y - 24 * u);
  const B = { x1: Q.r - 14 * u, y1: Q.y - 12 * u - bLen, x0: Q.r - 14 * u - bLen, y0: Q.y - 12 * u };

  /* ── Parts ─────────────────────────────────────────────────── */
  const chipSize = 30 * u;
  const chip = box(Q.x + Q.w * 0.6, (P.y + Q.y) / 2 - chipSize / 2, chipSize, chipSize);
  const pins = [];
  for (let i = 0; i < 4; i++) {
    const t = chip.y + (i + 0.5) * (chipSize / 4);
    const l = chip.x + (i + 0.5) * (chipSize / 4);
    pins.push(box(chip.x - 3 * u, t - u, 3 * u, 2 * u), box(chip.r, t - u, 3 * u, 2 * u));
    pins.push(box(l - u, chip.y - 3 * u, 2 * u, 3 * u), box(l - u, chip.b, 2 * u, 3 * u));
  }

  /* ── Buses ─────────────────────────────────────────────────── */
  const buses = [];

  const keyEnd = edgeOfCircle(matrix, { y: Q.cy }, "right");
  if (keyEnd) {
    buses.push(bus("key", [[Q.x - u, Q.cy], [keyEnd[0] + 2 * u, Q.cy]], 3, pitch, cut,
      { label: { text: "KEY", x: (Q.x + keyEnd[0]) / 2, y: Q.cy - 2 * pitch - 3 * u } }));
  }

  const x1 = Q.x + 96 * u;
  const x2 = Q.x + 64 * u;
  const yA = Q.b + 14 * u;
  buses.push(bus("data", [[x1, Q.b + u], [x1, yA], [x2, yA + (x1 - x2)], [x2, F.y - u]], 4, pitch, cut,
    { label: { text: "USB", x: x1 + 3 * pitch, y: Q.b + 14 * u, anchor: "start" } }));

  buses.push(bus("spi", [[F.r + u, D.cy], [D.x - u, D.cy]], 3, pitch, cut,
    { label: { text: "SPI", x: (F.r + D.x) / 2, y: D.cy - 2 * pitch - 3 * u } }));

  /* Audio runs under the Now Playing glass — in from the left gap, across
     beneath the header, down behind the controls and out to the display —
     so there is copper for the liquid glass to show and bend. */
  const yH = P.y + 44 * u;
  const xi = P.r - 72 * u;
  buses.push(bus("i2s", [[Q.r + 8 * u, yH], [xi, yH], [xi, D.y - u]], 3, pitch, cut,
    { strong: true, label: { text: "I2S", x: xi + 2 * pitch, y: (P.b + D.y) / 2 + 3 * u, anchor: "start" } }));

  buses.push(bus("pg", [[PG.x + 22 * u, D.b + u], [PG.x + 22 * u, PG.y - 3 * u]], 3, pitch * 0.8, cut));

  buses.push(bus("tmr", [[T.cx, T.b + u], [T.cx, G.cy], [G.r + u, G.cy]], 2, pitch, cut,
    { label: { text: "TMR", x: T.cx - 2 * pitch, y: (T.b + G.cy) / 2, anchor: "end" } }));

  const chipToSearch = bus("io", [[chip.cx, chip.b + 3 * u], [chip.cx, Q.y - u]], 3, pitch, cut);
  buses.push(chipToSearch);

  const mtxEnd = edgeOfCircle(matrix, { y: chip.cy }, "right");
  if (mtxEnd) {
    buses.push(bus("mtx", [[chip.x - 3 * u, chip.cy], [mtxEnd[0] + 2 * u, chip.cy]], 2, pitch, cut,
      { label: { text: "MTX", x: M.r + 24 * u, y: chip.cy - pitch - 4 * u, anchor: "start" } }));
  }

  const xn = B.x0 - 14 * u;
  buses.push(bus("ntf", [[chip.r + 3 * u, chip.cy], [xn, chip.cy], [xn, B.y0], [B.x0 - 3 * u, B.y0]], 2, pitch, cut));

  /* The glyph bus: from the Glyph button, under the favorites, up the
     column gap to the "!" — and a branch up to the matrix itself. */
  const yBottom = F.b + 12 * u;
  const xGap = F.x - 20 * u;
  const yTurn = dotY + 34 * u;
  const xEnd = cx + 14 * u;
  const xUp = cx + ringR + 18 * u;
  const busPath = [[G.x - u, G.cy], [G.x - 14 * u, G.cy], [G.x - 14 * u, yBottom], [xGap, yBottom], [xGap, yTurn], [xEnd, yTurn]];
  buses.push(bus("glyphbus", busPath, 3, pitch, cut,
    { label: { text: "GLYPH BUS", x: F.x + 40 * u, y: yBottom + 2 * pitch + 6 * u, anchor: "start" } }));
  const upEnd = edgeOfCircle(matrix, { x: xUp }, "bottom");
  const routes = {};
  if (upEnd) {
    buses.push(bus("uplink", [[xUp, yTurn - pitch], [xUp, upEnd[1] + 2 * u]], 2, pitch, cut));
    routes.glyph = chamfered([...busPath.slice(0, 5), [xUp, yTurn], [xUp, upEnd[1] + 2 * u]], cut);
  }

  const qiTop = edgeOfCircle(matrix, { x: cx }, "bottom");
  buses.push(bus("qi", [[cx, (qiTop ? qiTop[1] : M.b) + u], [cx, ringCy - ringR * 0.22]], 2, pitch * 0.8, cut));

  for (const b of buses) if (!routes[b.id]) routes[b.id] = b.route;

  return {
    w: m.w,
    h: m.h,
    u,
    buses,
    routes,
    coil: spiral(cx, ringCy, ringR * 0.22, ringR * 0.74, 6),
    chip: { ...chip, pins, label: "NT-01" },
    parts: [
      box(Q.r - 104 * u, Q.b + 34 * u, 10 * u, 4.5 * u),
      box(Q.r - 74 * u, Q.b + 34 * u, 10 * u, 4.5 * u),
    ].map((b, i) => ({ ...b, label: ["R7", "C4"][i] })),
    testpoints: [
      { x: Q.x + 26 * u, y: Q.b + 34 * u, label: "TP1" },
      { x: D.x + 24 * u, y: P.b + (D.y - P.b) / 2, label: "TP2" },
    ],
    labels: [
      { text: "QI", x: cx, y: ringCy + ringR * 0.88, anchor: "middle" },
      { text: "U1", x: chip.x, y: chip.y - 6 * u, anchor: "start" },
    ],
    glyphs: {
      w: gw,
      B: `M${B.x0} ${B.y0} L${B.x1} ${B.y1}`,
      C: ring,
      D: `M${cx} ${stripBottom} L${cx} ${stripTop}`,
      dot: { cx, cy: dotY, r: 3.4 * u },
    },
  };
}
