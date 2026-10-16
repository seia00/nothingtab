/* Draws a planned board into an SVG, and gives back handles for the glyph
   zones (to light them) and the routes (to send pulses along them). */

import { roundedRect } from "./geometry.js";

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  node.append(...kids);
  return node;
}

const path = (d, cls, attrs = {}) => el("path", { d, class: cls, ...attrs });

/* ── Glyph strips ─────────────────────────────────────────────────
   Four layers, like the real thing: an outer casing, a milky diffuser, the
   row of tiny LEDs visible through it when unlit, and the light itself. */

/**
 * @param {Element} parent
 * @param {string} d
 * @param {number} w strip width
 * @param {number} u
 */
function strip(parent, d, w, u) {
  const g = el("g", { class: "gstrip" });
  g.append(
    path(d, "gstrip__case", { "stroke-width": w + 2.4 * u }),
    path(d, "gstrip__base", { "stroke-width": w }),
    path(d, "gstrip__dots", { "stroke-width": w * 0.42, "stroke-dasharray": `0 ${2.7 * u}` }),
  );
  const lit = path(d, "gstrip__lit", { "stroke-width": w, pathLength: 1, filter: "url(#glyph-glow)" });
  g.append(lit);
  parent.append(g);
  return zone([g], [lit]);
}

function dotStrip(parent, { cx, cy, r }, u) {
  const g = el("g", { class: "gstrip" });
  g.append(
    el("circle", { cx, cy, r: r + 1.2 * u, class: "gstrip__case-fill" }),
    el("circle", { cx, cy, r, class: "gstrip__base-fill" }),
  );
  const lit = el("circle", { cx, cy, r, class: "gstrip__lit-fill", filter: "url(#glyph-glow)" });
  g.append(lit);
  parent.append(g);
  return zone([g], [lit]);
}

/**
 * A light zone: one or more strips lit together. `fill` lights a share of
 * the zone along its length (strips are drawn with pathLength 1).
 */
function zone(groups, lits) {
  return {
    groups,
    lits,
    level(v) {
      for (const l of lits) l.style.opacity = String(v);
    },
    fill(share) {
      const n = lits.length;
      lits.forEach((l, i) => {
        const part = Math.min(1, Math.max(0, share * n - i));
        l.style.strokeDasharray = part >= 1 ? "none" : `${part} 1`;
      });
    },
    breathe(on) {
      for (const g of groups) g.classList.toggle("is-breathing", on);
    },
    flash({ times = 2, delay = 0, duration = 240 } = {}) {
      for (const l of lits) {
        l.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }],
          { duration, delay, iterations: times, easing: "ease-out" });
      }
    },
  };
}

/** Merge several zones (the ring's four arcs) into one. */
const group = (zones) => zone(zones.flatMap((z) => z.groups), zones.flatMap((z) => z.lits));

/* ── Board ─────────────────────────────────────────────────────── */

/**
 * @param {SVGSVGElement} svg
 * @param {ReturnType<import("./board.js").planBoard>} plan
 */
export function renderBoard(svg, plan) {
  const { u } = plan;
  svg.setAttribute("viewBox", `0 0 ${plan.w} ${plan.h}`);

  const traces = el("g", { class: "pcb-traces", "stroke-width": Math.max(0.8, 1.15 * u) });
  const parts = el("g", { class: "pcb-parts" });
  const vias = el("g", { class: "pcb-vias" });
  const silk = el("g", { class: "pcb-silk", "font-size": Math.max(6.5, 7.5 * u) });
  const glyphs = el("g", { class: "glyphs" });
  const pulses = el("g", { class: "pcb-pulses", "stroke-width": Math.max(1.4, 2 * u) });

  const via = ([x, y], big = false) => {
    const r = (big ? 2.8 : 2.1) * u;
    vias.append(el("circle", { cx: x, cy: y, r, class: "via" }), el("circle", { cx: x, cy: y, r: r * 0.42, class: "via-hole" }));
  };
  const label = ({ text, x, y, anchor = "middle" }) => silk.append(el("text", { x, y, "text-anchor": anchor }, text));

  for (const b of plan.buses) {
    // Buses that run under glass are drawn heavier, so they read through it.
    const look = b.strong ? { "stroke-width": Math.max(1.2, 1.8 * u) } : {};
    for (const d of b.lines) traces.append(path(d, b.strong ? "trace trace--strong" : "trace", look));
    b.ends.forEach((p) => via(p));
    if (b.label) label(b.label);
  }
  traces.append(path(plan.coil, "trace trace--coil"));

  const { chip } = plan;
  parts.append(el("rect", { x: chip.x, y: chip.y, width: chip.w, height: chip.h, rx: 1.5 * u, class: "chip" }));
  parts.append(el("circle", { cx: chip.x + 4 * u, cy: chip.y + 4 * u, r: 1.2 * u, class: "chip-dot" }));
  for (const p of chip.pins) parts.append(el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, class: "pad" }));
  label({ text: chip.label, x: chip.cx, y: chip.b + 12 * u });

  for (const p of plan.parts) {
    const padW = p.w * 0.32;
    parts.append(
      el("rect", { x: p.x, y: p.y, width: padW, height: p.h, class: "pad" }),
      el("rect", { x: p.r - padW, y: p.y, width: padW, height: p.h, class: "pad" }),
      el("rect", { x: p.x + padW, y: p.y + p.h * 0.2, width: p.w - padW * 2, height: p.h * 0.6, class: "part-body" }),
    );
    label({ text: p.label, x: p.cx, y: p.y - 3 * u });
  }

  for (const tp of plan.testpoints) {
    parts.append(el("circle", { cx: tp.x, cy: tp.y, r: 3.4 * u, class: "tp" }));
    label({ text: tp.label, x: tp.x + 6 * u, y: tp.y + 2.5 * u, anchor: "start" });
  }
  plan.labels.forEach(label);

  const { w } = plan.glyphs;
  const zones = {
    B: strip(glyphs, plan.glyphs.B, w, u),
    C: group(plan.glyphs.C.map((d) => strip(glyphs, d, w, u))),
    D: strip(glyphs, plan.glyphs.D, w, u),
    E: dotStrip(glyphs, plan.glyphs.dot, u),
  };

  svg.replaceChildren(traces, parts, vias, silk, glyphs, pulses);
  return { zones, routes: plan.routes, pulses };
}

/**
 * Glyph A, the camera ring, drawn around the Now Playing sleeve in its own
 * small SVG (so it sits above the panel's glass, not under it).
 * @param {SVGSVGElement} svg
 */
export function renderLens(svg) {
  const width = svg.clientWidth;
  const height = svg.clientHeight;
  if (!width) return null;
  const u = parseFloat(getComputedStyle(svg).getPropertyValue("--u")) || 1;
  const w = 4.2 * u;
  const inset = w / 2 + 1.6 * u;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  return strip(svg, roundedRect(inset, inset, width - inset * 2, height - inset * 2, 22 * u), w, u);
}

/**
 * A short bright dash travelling along a route.
 * @param {SVGGElement} layer
 * @param {string} d
 */
export function sendPulse(layer, d, { duration = 900, delay = 0 } = {}) {
  const head = 0.07;
  const p = path(d, "pulse", { pathLength: 1, "stroke-dasharray": `${head} 2`, "stroke-dashoffset": head });
  layer.append(p);
  const run = p.animate([{ strokeDashoffset: head }, { strokeDashoffset: -1 }],
    { duration, delay, easing: "cubic-bezier(.45, 0, .2, 1)", fill: "both" });
  run.onfinish = () => p.remove();
  run.oncancel = () => p.remove();
}
