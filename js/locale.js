/* Where the user probably is, without asking for location permission: the
   system timezone gives a city (for weather) and a country (for suggestions
   and regional sites). You can be an English speaker in Tokyo — language
   comes from the browser, country from the clock. */

export const TZ_PLACES = {
  "Asia/Tokyo": { name: "Tokyo", lat: 35.6895, lon: 139.6917, cc: "JP" },
  "Asia/Seoul": { name: "Seoul", lat: 37.5665, lon: 126.978, cc: "KR" },
  "Asia/Shanghai": { name: "Shanghai", lat: 31.2304, lon: 121.4737, cc: "CN" },
  "Asia/Taipei": { name: "Taipei", lat: 25.033, lon: 121.5654, cc: "TW" },
  "Asia/Singapore": { name: "Singapore", lat: 1.3521, lon: 103.8198, cc: "SG" },
  "Asia/Hong_Kong": { name: "Hong Kong", lat: 22.3193, lon: 114.1694, cc: "HK" },
  "Asia/Kolkata": { name: "Mumbai", lat: 19.076, lon: 72.8777, cc: "IN" },
  "Europe/London": { name: "London", lat: 51.5072, lon: -0.1276, cc: "GB" },
  "Europe/Paris": { name: "Paris", lat: 48.8566, lon: 2.3522, cc: "FR" },
  "Europe/Berlin": { name: "Berlin", lat: 52.52, lon: 13.405, cc: "DE" },
  "Europe/Madrid": { name: "Madrid", lat: 40.4168, lon: -3.7038, cc: "ES" },
  "Europe/Rome": { name: "Rome", lat: 41.9028, lon: 12.4964, cc: "IT" },
  "Europe/Amsterdam": { name: "Amsterdam", lat: 52.3676, lon: 4.9041, cc: "NL" },
  "America/New_York": { name: "New York", lat: 40.7128, lon: -74.006, cc: "US" },
  "America/Chicago": { name: "Chicago", lat: 41.8781, lon: -87.6298, cc: "US" },
  "America/Denver": { name: "Denver", lat: 39.7392, lon: -104.9903, cc: "US" },
  "America/Los_Angeles": { name: "San Francisco", lat: 37.7749, lon: -122.4194, cc: "US" },
  "America/Toronto": { name: "Toronto", lat: 43.6532, lon: -79.3832, cc: "CA" },
  "America/Sao_Paulo": { name: "São Paulo", lat: -23.5505, lon: -46.6333, cc: "BR" },
  "Australia/Sydney": { name: "Sydney", lat: -33.8688, lon: 151.2093, cc: "AU" },
};

const DEFAULT_TZ = "Asia/Tokyo";

export const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
};

export const homePlace = () => TZ_PLACES[timezone()] || TZ_PLACES[DEFAULT_TZ];

/** Two-letter language, e.g. "en". */
export const language = () => (navigator.language || "en").slice(0, 2).toLowerCase();

/** Upper-case country code: the timezone's, else the browser locale's. */
export function region() {
  const tz = TZ_PLACES[timezone()];
  if (tz) return tz.cc;
  try {
    return new Intl.Locale(navigator.language).maximize().region || "US";
  } catch {
    return "US";
  }
}

/** The handful of places that still read temperatures in Fahrenheit. */
export const prefersFahrenheit = () => ["US", "LR", "MM"].includes(region())
  && !/^en-(GB|AU|NZ|IE)/.test(navigator.language || "");

/** 1 = Monday … 7 = Sunday, per the browser's locale. */
export function firstDayOfWeek() {
  try {
    const loc = new Intl.Locale(navigator.language);
    const info = typeof loc.getWeekInfo === "function" ? loc.getWeekInfo() : loc.weekInfo;
    return info?.firstDay || 7;
  } catch {
    return 7;
  }
}

/** Whether the locale writes the time with am/pm. */
export function uses12Hour() {
  const o = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions();
  return o.hour12 ?? (o.hourCycle === "h11" || o.hourCycle === "h12");
}
