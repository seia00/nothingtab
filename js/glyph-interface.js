/* The Phone (1) Glyph Interface, on the page — each light doing the job it
   did on the phone, wired by PCB traces to the module that drives it:

     A  camera ring  around the Now Playing sleeve — breathes while music plays
     B  diagonal     above the search bar — flashes for notifications
     C  ring + coil  under the matrix — the timer's progress, draining clockwise
     D  "!" strip    under the ring — fills through the day like a charge meter
     E  "!" dot      the full stop under D

   Activity runs along the traces as pulses: typing, the Glyph button, music,
   the timer's heartbeat. When the timer ends, the whole interface plays. */

import { measureBoard, planBoard } from "./circuit/board.js";
import { renderBoard, renderLens, sendPulse } from "./circuit/render.js";
import { on } from "./bus.js";
import { timer } from "./timer.js";
import { prefersReducedMotion } from "./ui.js";

const WIDE_MIN = 960; // below this the chassis reflows and there is no board
const KEY_GAP_MS = 160;
const MUSIC_PULSE_MS = 1800;
const TIMER_PULSE_S = 5;
const SHOW_ROUNDS = 3;

const dayShare = () => {
  const n = new Date();
  return (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400;
};

/**
 * @param {{ shell: HTMLElement, chassis: HTMLElement, board: SVGSVGElement, lens: SVGSVGElement }} els
 */
export function initGlyphInterface({ shell, chassis, board: svg, lens }) {
  let board = null;
  let camera = null;
  let music = "setup";
  let title = "";
  let timerState = timer.status();
  let lastKey = 0;
  let musicPulse = 0;
  let booted = false;

  const pulse = (id, opts) => {
    if (!board || prefersReducedMotion() || document.hidden) return;
    const d = board.routes[id];
    if (d) sendPulse(board.pulses, d, opts);
  };

  /* Steady state, from the things the lights report on. */
  function apply() {
    if (camera) {
      const playing = music === "playing";
      camera.breathe(playing && !prefersReducedMotion());
      camera.level(playing ? 1 : music === "paused" ? 0.22 : 0);
    }
    if (!board) return;
    const { B, C, D, E } = board.zones;
    const st = timer.status();
    C.fill(st === "running" || st === "paused" ? timer.fraction() : 1);
    C.level(st === "running" ? 1 : st === "paused" ? 0.4 : st === "done" ? 1 : 0);
    D.fill(dayShare());
    D.level(0.85);
    E.level(0.9);
    B.level(0);
  }

  const zonesInOrder = () =>
    [camera, board?.zones.B, board?.zones.C, board?.zones.D, board?.zones.E].filter(Boolean);

  /* Waking up: each zone in turn, once — the Phone (1) boot sweep. */
  function wake() {
    if (prefersReducedMotion()) return;
    zonesInOrder().forEach((z, i) => z.flash({ times: 1, delay: 150 + i * 110, duration: 460 }));
  }

  /* A Glyph composition for the end of the timer. */
  function show() {
    const zones = zonesInOrder();
    if (prefersReducedMotion()) {
      zones.forEach((z) => z.flash({ times: 1, duration: 700 }));
      return;
    }
    for (let round = 0; round < SHOW_ROUNDS; round++) {
      zones.forEach((z, i) => z.flash({ times: 1, delay: round * 900 + i * 90, duration: 380 }));
    }
    pulse("glyph", { duration: 1200 });
    pulse("tmr", { duration: 800 });
  }

  function notify() {
    board?.zones.B.flash({ times: 2, duration: 260 });
    pulse("ntf", { duration: 650 });
  }

  function layout() {
    camera = renderLens(lens);
    if (chassis.clientWidth < WIDE_MIN) {
      svg.replaceChildren();
      board = null;
    } else {
      const m = measureBoard(shell);
      board = m ? renderBoard(svg, planBoard(m)) : null;
    }
    apply();
    if (!booted && (board || camera)) {
      booted = true;
      wake();
    }
  }

  let frame = 0;
  const relayout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layout);
  };
  new ResizeObserver(relayout).observe(shell);
  document.fonts?.ready.then(relayout);

  /* ── What drives the lights ───────────────────────────────────── */

  on("track", (t) => {
    const changed = Boolean(t.title && title && t.title !== title);
    music = t.state;
    if (t.title) title = t.title;
    apply();
    if (changed) notify();
    clearInterval(musicPulse);
    if (music === "playing") musicPulse = setInterval(() => pulse("i2s", { duration: 700 }), MUSIC_PULSE_MS);
  });

  on("timer", () => {
    const st = timer.status();
    if (st === "running" && timerState !== "running") pulse("tmr", { duration: 700 });
    timerState = st;
    apply();
  });

  on("timer-done", show);
  on("notify", notify);
  on("glyph-next", () => pulse("glyph", { duration: 1100 }));
  on("display-page", () => pulse("pg", { duration: 500 }));
  on("weather", () => pulse("spi", { duration: 700 }));
  on("keys", () => {
    const now = performance.now();
    if (now - lastKey < KEY_GAP_MS) return;
    lastKey = now;
    pulse("key", { duration: 520 });
  });

  setInterval(() => {
    if (document.hidden) return;
    apply();
    if (timer.status() === "running" && new Date().getSeconds() % TIMER_PULSE_S === 0) pulse("tmr", { duration: 900 });
  }, 1000);

  relayout();
}
