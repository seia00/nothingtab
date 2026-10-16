/* The Glyph Matrix: a bezel-less round screen, 41 pixels across. Like the
   Phone (3), it runs "toys" — clock, date, music, wordmark — and the Glyph
   button (the chrome slab) or a tap on the screen steps through them.

   The outermost ring of pixels is each toy's second channel, lit red: a
   seconds sweep for the clock, progress for date and music, the resting
   segment for the wordmark, the whole ring flashing for an alert. */

import { DotMatrix } from "./dot/matrix.js";
import { SceneRunner } from "./dot/runner.js";
import { FONT_5x7, FONT_BIG, FONT_3x5, measure } from "./dot/font.js";
import { SPRITES } from "./dot/sprites.js";
import { read, write } from "./store.js";
import { on, emit } from "./bus.js";
import { prefersReducedMotion } from "./ui.js";
import { uses12Hour } from "./locale.js";

const N = 41;
const MID = (N - 1) / 2;
const ALERT_MS = 30_000;
const EDGE_DEPTH = 1.15; // pixels this close to the rim form the ring
const TAIL_DEG = 54; // length of the seconds comet
const FIRST_DISSOLVE_MS = 260;
const REST = [36, 80]; // the wordmark's resting segment, in degrees — clear of the text

const cx = (str, font, spacing = font.spacing) => Math.floor((N - measure(str, font, spacing)) / 2);
const pad = (n) => String(n).padStart(2, "0");

const H12 = uses12Hour();
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/* Fed by the player through the bus. */
let music = { state: "setup", progress: 0, duration: 0, at: 0 };

const musicPosition = () => {
  if (!music.duration) return 0;
  const live = music.state === "playing" ? Date.now() - music.at : 0;
  return Math.min(1, (music.progress + live) / music.duration);
};

const dayFraction = (d) =>
  (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;

/* ── Toys ───────────────────────────────────────────────────────── */

const TOYS = [
  {
    id: "clock",
    name: "Clock",
    every: 1000,
    arc: () => (prefersReducedMotion() ? { mode: "off" } : { mode: "seconds" }),
    draw(m, now) {
      const h = H12 ? String(now.getHours() % 12 || 12) : pad(now.getHours());
      const mm = pad(now.getMinutes());
      m.text(h, cx(h, FONT_BIG), 8, FONT_BIG);
      m.text(mm, cx(mm, FONT_BIG), 22, FONT_BIG);
    },
  },
  {
    id: "date",
    name: "Date",
    every: 60_000,
    arc: (now) => ({ mode: "fill", value: dayFraction(now) }),
    draw(m, now) {
      const wd = WEEKDAY.format(now).toUpperCase();
      const day = String(now.getDate());
      const mon = MONTH.format(now).toUpperCase();
      m.text(wd, cx(wd, FONT_5x7), 6, FONT_5x7);
      m.text(day, cx(day, FONT_BIG), 15, FONT_BIG);
      m.text(mon, cx(mon, FONT_3x5), 29, FONT_3x5, { v: 0.5 });
    },
  },
  {
    id: "music",
    name: "Music",
    every: 1000,
    fps: 20,
    animated: () => music.state === "playing",
    arc: () => (music.duration && music.state !== "idle" && music.state !== "setup"
      ? { mode: "fill", value: musicPosition() }
      : { mode: "off" }),
    draw(m) {
      if (music.state === "playing") return drawBars(m, performance.now() / 1000);
      if (music.state === "paused") return m.sprite(SPRITES.pause, 16, 16);
      m.sprite(SPRITES.note, 16, music.state === "setup" ? 12 : 16, { v: 0.55 });
      if (music.state === "setup") m.text("SPOTIFY", cx("SPOTIFY", FONT_3x5), 25, FONT_3x5, { v: 0.4 });
    },
  },
  {
    id: "logo",
    name: "Glyph Matrix",
    every: 3_600_000,
    arc: () => ({ mode: "static" }),
    draw(m) {
      m.text("glyph", cx("glyph", FONT_5x7), 11, FONT_5x7);
      m.text("matrix", cx("matrix", FONT_5x7), 22, FONT_5x7);
    },
  },
];

/* Nine bars that breathe like a level meter. Not driven by the audio itself —
   Spotify doesn't expose that to the web — but by layered sines so it never
   visibly loops, peaking toward the middle. */
function drawBars(m, t) {
  for (let i = 0; i < 9; i++) {
    const a = Math.sin(t * (2.3 + i * 0.41) + i * 1.7) * Math.sin(t * (1.1 + i * 0.27) + i * 0.6);
    const envelope = 1 - Math.abs(i - 4) / 6;
    const h = Math.max(1, Math.round((0.18 + 0.82 * Math.abs(a)) * 25 * envelope));
    const top = Math.round(MID - h / 2);
    m.rect(3 + i * 4, top, 3, h);
  }
}

const alertScene = {
  animated: () => true,
  fps: 6,
  draw(m, now) {
    if (Math.floor(performance.now() / 450) % 2) return;
    m.sprite(SPRITES.bell, 16, 9);
    m.text("TIME", cx("TIME", FONT_5x7), 23, FONT_5x7, { red: true });
    drawRing(m, { mode: "alert" }, now);
  },
};

/* ── The ring ───────────────────────────────────────────────────── */

/* Rim pixels with their clock angle (0° at twelve, clockwise). */
let rim = null;

function rimPixels(m) {
  if (rim) return rim;
  const R = N / 2 - 0.15;
  rim = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!m.mask[y * N + x] || Math.hypot(x - MID, y - MID) <= R - EDGE_DEPTH) continue;
      const deg = (Math.atan2(x - MID, MID - y) * 180 / Math.PI + 360) % 360;
      rim.push({ x, y, deg });
    }
  }
  return rim;
}

/** @param {{ mode: string, value?: number }} arc */
function drawRing(m, arc, now) {
  if (!arc || arc.mode === "off") return;
  const head = (now.getSeconds() + now.getMilliseconds() / 1000) * 6;
  for (const p of rimPixels(m)) {
    let v = 0;
    if (arc.mode === "seconds") {
      const behind = (head - p.deg + 360) % 360;
      if (behind <= TAIL_DEG) v = 1 - (behind / TAIL_DEG) * 0.85;
    } else if (arc.mode === "fill") {
      v = p.deg <= (arc.value || 0) * 360 ? 0.9 : 0;
    } else if (arc.mode === "static") {
      v = p.deg >= REST[0] && p.deg <= REST[1] ? 1 : 0;
    } else if (arc.mode === "alert") {
      v = 1;
    }
    if (v > 0) m.plot(p.x, p.y, v, true);
  }
}

/* A toy's scene: its picture plus its ring. */
const sceneFor = (toy) => ({
  ...toy,
  draw(m, now) {
    toy.draw(m, now);
    drawRing(m, toy.arc(now), now);
  },
});

/* ── Wiring ─────────────────────────────────────────────────────── */

/**
 * @param {{ canvas: HTMLCanvasElement, face: HTMLElement, button: HTMLElement,
 *   status: HTMLElement }} els
 */
export function initGlyph({ canvas, face, button, status }) {
  const matrix = new DotMatrix(canvas, { cols: N, rows: N, round: true, dot: 0.8, fade: 80, pixel: "square" });
  const runner = new SceneRunner(matrix);

  const saved = TOYS.findIndex((t) => t.id === read("glyph.toy", "clock"));
  let index = saved < 0 ? 0 : saved;
  let alertUntil = 0;
  let alertTimer = 0;

  const toy = () => TOYS[index];

  const announce = () => {
    status.textContent = `Glyph Matrix: ${toy().name}`;
    face.setAttribute("aria-label", `Glyph Matrix — ${toy().name}. Activate for the next toy.`);
  };

  const showToy = (dissolve = 450) => {
    runner.show(sceneFor(toy()), { dissolve });
    announce();
    if (!performance.getEntriesByName("glyph-ready").length) performance.mark("glyph-ready");
  };

  const next = () => {
    if (Date.now() < alertUntil) return dismissAlert();
    index = (index + 1) % TOYS.length;
    write("glyph.toy", toy().id);
    emit("glyph-next");
    showToy();
  };

  const dismissAlert = () => {
    alertUntil = 0;
    clearTimeout(alertTimer);
    showToy(250);
  };

  face.addEventListener("click", next);
  button.addEventListener("click", next);

  on("theme", () => matrix.repaint());

  on("track", (t) => {
    const was = music.state;
    music = t;
    if (toy().id !== "music" || Date.now() < alertUntil) return;
    if (was !== t.state) runner.show(sceneFor(toy()), { dissolve: 200 });
    else runner.refresh();
  });

  on("timer-done", () => {
    alertUntil = Date.now() + ALERT_MS;
    runner.show(alertScene, { dissolve: 0 });
    status.textContent = "Timer finished";
    clearTimeout(alertTimer);
    alertTimer = setTimeout(dismissAlert, ALERT_MS);
  });

  on("timer", (st) => {
    if (Date.now() < alertUntil && !st.doneAt) dismissAlert();
  });

  // Content on the first frame; the pixels just sparkle in around it.
  showToy(FIRST_DISSOLVE_MS);

  return { next };
}
