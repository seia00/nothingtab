/* The console's dot display: four pages behind the square pager — weather,
   timer, calendar, progress. Tap the display to act on the current page
   (change city, start/pause the timer); swipe or use the arrow keys to page. */

import { DotMatrix } from "./dot/matrix.js";
import { SceneRunner } from "./dot/runner.js";
import { FONT_5x7, FONT_BIG, FONT_3x5, measure } from "./dot/font.js";
import { SPRITES } from "./dot/sprites.js";
import { read, write } from "./store.js";
import { on, emit } from "./bus.js";
import { h, toast } from "./ui.js";
import { timer } from "./timer.js";
import * as weather from "./weather.js";
import { firstDayOfWeek } from "./locale.js";

const COLS = 35;
const ROWS = 19;
const SWIPE_PX = 30;
const pad = (n) => String(n).padStart(2, "0");
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/* ── Pages ──────────────────────────────────────────────────────── */

function drawWeather(m) {
  const w = weather.current();
  if (!w) {
    m.text("--", 1, 2, FONT_BIG, { spacing: 2, v: 0.5 });
    m.sprite(SPRITES.none, 23, 3, { v: 0.5 });
    m.text(weather.loading() ? "LOADING" : "NO DATA", 1, 14, FONT_3x5, { v: 0.5 });
    return;
  }
  const t = String(Math.round(w.temp));
  const end = m.text(t, 1, 2, FONT_BIG, { spacing: 2 });
  m.text("°", end + 2, 2, FONT_5x7);
  // A long reading ("-12°") eats the icon's room; the word still says it.
  if (end + 5 <= 22) m.sprite(SPRITES[weather.describe(w.code).icon], 23, 3);
  m.text(weather.describe(w.code).word.toUpperCase(), 1, 14, FONT_3x5);
}

function drawTimer(m, now) {
  const st = timer.status(now.getTime());
  const left = timer.remaining(now.getTime());
  const secs = Math.ceil(left / 1000);
  const str = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
  const x = Math.floor((COLS - measure(str, FONT_BIG, 1)) / 2);

  if (st === "done") {
    if (Math.floor(performance.now() / 400) % 2) m.text("00:00", x, 2, FONT_BIG, { spacing: 1, red: true });
    m.rect(1, 16, 33, 1, 0.25);
    return;
  }

  m.text(str, x, 2, FONT_BIG, { spacing: 1, v: st === "paused" ? 0.55 : 1 });
  const lit = Math.round(timer.fraction(now.getTime()) * 33);
  m.rect(1, 16, 33, 1, 0.16);
  if (st === "idle") return;
  m.rect(1, 16, lit, 1, 0.9);
  if (lit > 0) m.plot(lit, 16, 1, true);
}

function drawCalendar(m, now) {
  const day = String(now.getDate());
  m.text(day, 1, 1, FONT_BIG);
  m.text(MONTH.format(now).toUpperCase(), 1, 14, FONT_3x5);
  const year = String(now.getFullYear());
  m.text(year, COLS - 1 - measure(year, FONT_3x5), 14, FONT_3x5, { v: 0.5 });

  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay(); // 0 = Sun
  const offset = (first - (firstDayOfWeek() % 7) + 7) % 7;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const i = offset + d - 1;
    const x = 21 + (i % 7) * 2;
    const y = 1 + Math.floor(i / 7) * 2;
    if (d === now.getDate()) m.plot(x, y, 1, true);
    else m.plot(x, y, d < now.getDate() ? 0.9 : 0.22);
  }
}

function spans(now) {
  const y = now.getFullYear();
  const startDay = new Date(y, now.getMonth(), now.getDate());
  const startMonth = new Date(y, now.getMonth(), 1);
  const startYear = new Date(y, 0, 1);
  const frac = (from, to) => (now - from) / (to - from);
  return [
    ["D", frac(startDay, new Date(y, now.getMonth(), now.getDate() + 1))],
    ["M", frac(startMonth, new Date(y, now.getMonth() + 1, 1))],
    ["Y", frac(startYear, new Date(y + 1, 0, 1))],
  ];
}

function drawProgress(m, now) {
  spans(now).forEach(([label, f], row) => {
    const y = row * 7;
    m.text(label, 1, y, FONT_3x5, { v: 0.6 });
    const lit = Math.floor(f * 20);
    for (let i = 0; i < 20; i++) {
      const x = 6 + i;
      const v = i < lit ? 0.9 : 0.14;
      m.rect(x, y + 1, 1, 3, v, i === lit - 1);
    }
    const pct = String(Math.min(99, Math.floor(f * 100)));
    m.text(pct, COLS - 1 - measure(pct, FONT_3x5), y, FONT_3x5);
  });
}

const PAGES = [
  {
    id: "weather",
    name: "Weather",
    every: 60_000,
    draw: drawWeather,
    hint() {
      const w = weather.current();
      const place = weather.currentPlace().name;
      const range = w && Number.isFinite(w.hi) ? ` ${Math.round(w.hi)}°/${Math.round(w.lo)}°` : "";
      return `${place}${range}`;
    },
  },
  {
    id: "timer",
    name: "Timer",
    every: 1000,
    fps: 5,
    animated: () => timer.status() === "done",
    draw: drawTimer,
    hint() {
      return {
        idle: `${timer.minutes} min · tap to start`,
        running: "Tap to pause · double-tap to reset",
        paused: "Paused · tap to resume · double-tap to reset",
        done: "Done · tap to clear",
      }[timer.status()];
    },
  },
  {
    id: "calendar",
    name: "Calendar",
    every: 60_000,
    draw: drawCalendar,
    hint: () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
  },
  {
    id: "progress",
    name: "Progress",
    every: 60_000,
    draw: drawProgress,
    hint() {
      const [[, d], , [, y]] = spans(new Date());
      return `Day ${Math.floor(d * 100)}% · Year ${Math.floor(y * 100)}%`;
    },
  },
];

/* ── Wiring ─────────────────────────────────────────────────────── */

/**
 * @param {{ canvas: HTMLCanvasElement, face: HTMLElement, pager: HTMLElement,
 *   status: HTMLElement, cityForm: HTMLFormElement, cityInput: HTMLInputElement }} els
 */
export function initDisplay({ canvas, face, pager, status, cityForm, cityInput }) {
  const matrix = new DotMatrix(canvas, { cols: COLS, rows: ROWS, dot: 0.6, fade: 60 });
  const runner = new SceneRunner(matrix);
  const saved = PAGES.findIndex((p) => p.id === read("display.page", "weather"));
  let index = saved < 0 ? 0 : saved;

  const dots = PAGES.map((p, i) =>
    h("button", {
      class: "pager__dot",
      type: "button",
      "aria-label": p.name,
      onclick: () => go(i),
    }));
  pager.replaceChildren(...dots);

  const label = () => {
    const p = PAGES[index];
    status.replaceChildren(h("b", {}, `${pad(index + 1)} ${p.name}`), h("span", {}, p.hint()));
    face.setAttribute("aria-label", `${p.name} display. ${p.hint()}`);
  };

  function go(i, { dissolve = 380 } = {}) {
    index = (i + PAGES.length) % PAGES.length;
    write("display.page", PAGES[index].id);
    dots.forEach((d, j) => d.setAttribute("aria-current", String(j === index)));
    closeCity();
    runner.show(PAGES[index], { dissolve });
    label();
    emit("display-page", PAGES[index].id);
  }

  const refresh = () => {
    runner.refresh();
    label();
  };

  /* Tap: act on the page. Swipe: change page. */
  let down = null;
  let swiped = false;
  face.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; swiped = false; });
  face.addEventListener("pointerup", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    down = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      go(index + (dx < 0 ? 1 : -1));
    }
  });

  face.addEventListener("click", () => {
    if (swiped) { swiped = false; return; }
    const id = PAGES[index].id;
    if (id === "timer") timer.toggle();
    else if (id === "weather") openCity();
  });

  face.addEventListener("dblclick", () => {
    if (PAGES[index].id === "timer" && timer.status() !== "idle") timer.reset();
  });

  face.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1));
    }
  });

  /* City entry, laid over the weather page. */
  function openCity() {
    cityForm.hidden = false;
    cityInput.value = "";
    cityInput.placeholder = weather.currentPlace().name;
    cityInput.focus();
  }

  function closeCity() {
    cityForm.hidden = true;
  }

  cityForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = cityInput.value;
    closeCity();
    face.focus({ preventScroll: true });
    try {
      const name = await weather.setCity(q);
      if (name === null) toast(`Couldn't find “${q.trim()}”`);
    } catch {
      toast("Weather service unreachable");
    }
  });

  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeCity();
      face.focus({ preventScroll: true });
    }
  });
  cityInput.addEventListener("blur", () => setTimeout(closeCity, 150));

  on("theme", () => matrix.repaint());
  on("weather", () => { if (PAGES[index].id === "weather") refresh(); });
  on("timer", () => { if (PAGES[index].id === "timer") refresh(); });
  on("timer-adjust", () => (PAGES[index].id === "timer" ? refresh() : go(1, { dissolve: 200 })));
  on("timer-done", () => (PAGES[index].id === "timer" ? refresh() : go(1, { dissolve: 0 })));

  go(index, { dissolve: 260 });
}
