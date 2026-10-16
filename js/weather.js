/* Current conditions from Open-Meteo: no key, no account, no tracking.
   Location defaults to the system timezone's city, so nothing ever prompts
   for permission; the display's weather page lets you type another. */

import { read, write } from "./store.js";
import { emit } from "./bus.js";
import { homePlace, prefersFahrenheit } from "./locale.js";

const FRESH_MS = 20 * 60_000;
const POLL_MS = 10 * 60_000;

/* WMO weather codes → sprite + the word the display prints. */
const WMO = [
  [[0], "clear", "Clear"],
  [[1, 2], "partly", "Partly"],
  [[3], "cloud", "Cloudy"],
  [[45, 48], "fog", "Fog"],
  [[51, 53, 55, 56, 57], "drizzle", "Drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "rain", "Rain"],
  [[71, 73, 75, 77, 85, 86], "snow", "Snow"],
  [[95, 96, 99], "storm", "Storm"],
];

/** @param {number} code @returns {{ icon: string, word: string }} */
export function describe(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { icon: hit[1], word: hit[2] } : { icon: "none", word: "—" };
}

let place = read("weather.place", null);
let reading = read("weather.reading", null);
let inflight = null;
let inflightFor = "";

const unit = () => (prefersFahrenheit() ? "F" : "C");

export const currentPlace = () => place || homePlace();

/** True while a reading is on its way. */
export const loading = () => Boolean(inflight);

/** The latest reading for the current place, or null. */
export function current() {
  return reading && reading.name === currentPlace().name && reading.unit === unit() ? reading : null;
}

export function refresh(force = false) {
  const p = currentPlace();
  const r = current();
  if (!force && r && Date.now() - r.at < FRESH_MS) return Promise.resolve(r);
  if (!inflight || inflightFor !== p.name) {
    inflightFor = p.name;
    const mine = load(p).finally(() => { if (inflight === mine) inflight = null; });
    inflight = mine;
  }
  return inflight;
}

async function load(p) {
  const u = unit();
  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${p.lat}&longitude=${p.lon}`
    + "&current=temperature_2m,weather_code"
    + "&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto"
    + (u === "F" ? "&temperature_unit=fahrenheit" : "");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = await res.json();
    const temp = Number(data?.current?.temperature_2m);
    const code = Number(data?.current?.weather_code);
    if (!Number.isFinite(temp) || !Number.isFinite(code)) throw new Error("open-meteo: malformed reply");
    reading = {
      temp,
      code,
      hi: Number(data?.daily?.temperature_2m_max?.[0]),
      lo: Number(data?.daily?.temperature_2m_min?.[0]),
      unit: u,
      name: p.name,
      at: Date.now(),
    };
    write("weather.reading", reading);
    emit("weather", reading);
    return reading;
  } catch (err) {
    // A stale reading beats a blank display; the next poll tries again.
    emit("weather", current());
    throw err;
  }
}

/**
 * Point the weather at a typed city, geocoded through Open-Meteo.
 * @param {string} query
 * @returns {Promise<string | null>} the resolved place name, or null if not found
 */
export async function setCity(query) {
  const q = query.trim().slice(0, 80);
  if (!q) {
    place = null;
    write("weather.place", null);
    await refresh(true).catch(() => {});
    return currentPlace().name;
  }
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${encodeURIComponent((navigator.language || "en").slice(0, 2))}`,
  );
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const hit = (await res.json())?.results?.[0];
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
  place = { name: String(hit.name).slice(0, 40), lat: hit.latitude, lon: hit.longitude };
  write("weather.place", place);
  await refresh(true).catch(() => {});
  return place.name;
}

export function startWeather() {
  // Hidden tabs skip polls — except when there's nothing to show yet (Safari
  // can load a homepage in the background before you ever look at it).
  const tick = () => { if (!document.hidden || !current()) refresh().catch(() => {}); };
  tick();
  setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", tick);
}
