/* Focus timer. The glass tube on the chassis edge sets it (drag, or arrow
   keys) and drains as it runs; the display's timer page starts and pauses it.
   State lives in storage as an end timestamp, so every open tab — they are
   all this page — shows the same countdown and survives a reload. */

import { read, write, onExternalChange } from "./store.js";
import { emit } from "./bus.js";
import { toast } from "./ui.js";

const KEY = "timer";
const MIN = 1;
const MAX = 60;
const DEFAULT_MINUTES = 25;
const DONE_LINGER_MS = 2 * 60_000;

/** @typedef {{ minutes: number, endAt: number | null, left: number | null, doneAt: number | null }} TimerState */

/** @returns {TimerState} */
function sanitize(v) {
  const minutes = Math.min(MAX, Math.max(MIN, Math.round(Number(v?.minutes)) || DEFAULT_MINUTES));
  const num = (x) => (Number.isFinite(x) ? x : null);
  return { minutes, endAt: num(v?.endAt), left: num(v?.left), doneAt: num(v?.doneAt) };
}

let s = sanitize(read(KEY, null));
let doneTimer = 0;
let audio = null;

function commit(next, { silent = false } = {}) {
  s = next;
  write(KEY, s);
  schedule();
  if (!silent) emit("timer", s);
}

function schedule() {
  clearTimeout(doneTimer);
  if (s.endAt) doneTimer = setTimeout(finish, Math.max(0, s.endAt - Date.now()));
  else if (s.doneAt) doneTimer = setTimeout(() => commit({ ...s, doneAt: null }), Math.max(0, s.doneAt + DONE_LINGER_MS - Date.now()));
}

/* Only a timer that just ran out should ring — not one that ended while
   every tab was closed. */
const JUST_NOW_MS = 60_000;

function finish() {
  if (!s.endAt) return;
  const recent = Date.now() - s.endAt < JUST_NOW_MS;
  commit({ ...s, endAt: null, left: null, doneAt: s.endAt });
  if (recent) alarm();
}

function alarm() {
  emit("timer-done");
  chime();
}

export const timer = {
  get minutes() { return s.minutes; },

  /** @returns {"idle" | "running" | "paused" | "done"} */
  status(now = Date.now()) {
    if (s.endAt) return s.endAt > now ? "running" : "done";
    if (s.left) return "paused";
    if (s.doneAt && now - s.doneAt < DONE_LINGER_MS) return "done";
    return "idle";
  },

  remaining(now = Date.now()) {
    const st = this.status(now);
    if (st === "running") return s.endAt - now;
    if (st === "paused") return s.left;
    if (st === "done") return 0;
    return s.minutes * 60_000;
  },

  /** Remaining share of the set length, 0–1. */
  fraction(now = Date.now()) {
    return Math.min(1, this.remaining(now) / (s.minutes * 60_000));
  },

  start() {
    primeAudio();
    commit({ ...s, endAt: Date.now() + s.minutes * 60_000, left: null, doneAt: null });
  },

  pause() {
    if (this.status() !== "running") return;
    commit({ ...s, endAt: null, left: s.endAt - Date.now() });
  },

  resume() {
    if (this.status() !== "paused") return;
    primeAudio();
    commit({ ...s, endAt: Date.now() + s.left, left: null });
  },

  reset() {
    commit({ ...s, endAt: null, left: null, doneAt: null });
  },

  /** Tap on the display: start → pause → resume; dismiss when done. */
  toggle() {
    const st = this.status();
    if (st === "running") this.pause();
    else if (st === "paused") this.resume();
    else if (st === "done") this.reset();
    else this.start();
  },

  /** @param {number} minutes */
  setMinutes(minutes) {
    const m = Math.min(MAX, Math.max(MIN, Math.round(minutes)));
    if (m === s.minutes && this.status() === "idle") return;
    commit({ minutes: m, endAt: null, left: null, doneAt: null });
  },
};

/* Another tab may finish first (background tabs' timeouts drift), so a
   running → done change arriving from storage rings here too. */
onExternalChange(KEY, (v) => {
  const wasRunning = Boolean(s.endAt);
  s = sanitize(v);
  schedule();
  emit("timer", s);
  if (wasRunning && !s.endAt && s.doneAt && Date.now() - s.doneAt < JUST_NOW_MS) alarm();
});

schedule();

/* ── Sound ─────────────────────────────────────────────────────────
   Browsers only allow audio after a gesture in that same tab, and any open
   tab might be the one you're looking at when the timer ends. So every tab
   unlocks a context on its first click or key, then parks it (suspended, no
   CPU) until a chime needs it. Three short square-wave blips — closer to a
   Glyph notification than a kitchen timer. */

const PARK_MS = 400;

function primeAudio() {
  try {
    audio ||= new AudioContext();
    audio.resume();
    // iOS only unlocks a context that actually played something in the gesture.
    const blip = audio.createBufferSource();
    blip.buffer = audio.createBuffer(1, 1, 22050);
    blip.connect(audio.destination);
    blip.start();
    setTimeout(() => { if (!chiming) audio.suspend(); }, PARK_MS);
  } catch {
    audio = null;
  }
}

addEventListener("pointerdown", primeAudio, { once: true, capture: true });
addEventListener("keydown", primeAudio, { once: true, capture: true });

let chiming = false;

async function chime() {
  if (!audio || document.hidden) return;
  chiming = true;
  try {
    await audio.resume();
  } catch {
    chiming = false;
    return;
  }
  const t0 = audio.currentTime + 0.02;
  [0, 0.16, 0.32].forEach((offset, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = i === 2 ? 1320 : 1760;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.11);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.12);
  });
  setTimeout(() => {
    chiming = false;
    audio.suspend();
  }, 900);
}

/* ── Tube + LED ────────────────────────────────────────────────── */

/**
 * @param {HTMLElement} tube
 * @param {HTMLElement} rod
 * @param {HTMLElement} led
 */
export function initTube(tube, rod, led) {
  let tickTimer = 0;
  let dragging = false;

  const render = () => {
    const st = timer.status();
    const level = st === "running" || st === "paused"
      ? (timer.remaining() / 60_000) / MAX
      : st === "done" ? 1 : s.minutes / MAX;
    rod.style.setProperty("--level", Math.max(0.02, level).toFixed(4));
    tube.dataset.state = dragging ? "dragging" : st;
    tube.setAttribute("aria-valuenow", String(s.minutes));
    tube.setAttribute("aria-valuetext", st === "running"
      ? `${Math.ceil(timer.remaining() / 60_000)} of ${s.minutes} minutes left`
      : `${s.minutes} minutes`);
    led.dataset.state = st === "running" ? "pulse" : st === "done" ? "blink" : "";

    clearInterval(tickTimer);
    if (st === "running") tickTimer = setInterval(render, 1000);
  };

  const fromPointer = (e) => {
    const r = tube.getBoundingClientRect();
    const pad = r.height * 0.11;
    const f = 1 - (e.clientY - r.top - pad) / (r.height - pad * 2);
    return MIN + Math.min(1, Math.max(0, f)) * (MAX - MIN);
  };

  const adjust = (minutes) => {
    const st = timer.status();
    if (st === "running" || st === "paused") {
      toast("Reset the timer to change its length");
      return false;
    }
    timer.setMinutes(minutes);
    emit("timer-adjust");
    return true;
  };

  tube.addEventListener("pointerdown", (e) => {
    if (!adjust(fromPointer(e))) return;
    dragging = true;
    tube.setPointerCapture(e.pointerId);
    render();
  });

  tube.addEventListener("pointermove", (e) => {
    if (dragging) timer.setMinutes(fromPointer(e));
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    render();
  };
  tube.addEventListener("pointerup", end);
  tube.addEventListener("pointercancel", end);

  tube.addEventListener("keydown", (e) => {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (step) {
      e.preventDefault();
      adjust(s.minutes + step);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      adjust(e.key === "Home" ? MIN : MAX);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      timer.toggle();
    }
  });

  return render;
}
