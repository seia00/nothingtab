/* Spotify Web API over OAuth PKCE — entirely in the browser, no client
   secret, no server. You register your own (free) Spotify app and paste its
   Client ID; tokens stay in this browser's storage.

   Playback state works on any account. Play/pause/skip/seek are Premium-only
   on Spotify's side, and since February 2026 a development-mode app also
   needs its owner to have Premium. */

import { read, write, remove } from "./store.js";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing";
const CLIENT_ID = /^[0-9a-f]{32}$/i;
const EXPIRY_MARGIN_S = 60;

export class SpotifyError extends Error {
  /** @param {number} status @param {string} reason @param {string} message */
  constructor(status, reason, message) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

/* Spotify matches redirect URIs exactly and rejects "localhost" (loopback
   must be written 127.0.0.1), so this is what the user registers. */
export const redirectUri = () => `${location.origin}${location.pathname}`;
export const clientId = () => read("spotify.client", "");
export const isConnected = () => Boolean(read("spotify.token", null)?.refresh);
export const canAuthorize = () => Boolean(window.isSecureContext && crypto?.subtle) && location.hostname !== "localhost";

export function disconnect() {
  remove("spotify.token");
}

/* ── Auth ───────────────────────────────────────────────────────── */

const randomString = (bytes) => {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(a);
};

function base64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Send the browser to Spotify's consent screen. @param {string} id */
export async function beginAuth(id) {
  const cid = id.trim();
  if (!CLIENT_ID.test(cid)) throw new Error("A Client ID is 32 letters and numbers — copy it from your app's settings.");
  if (!canAuthorize()) throw new Error("Spotify sign-in needs https, or http://127.0.0.1 locally.");
  const verifier = randomString(48);
  const state = randomString(16);
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  write("spotify.client", cid);
  write("spotify.pkce", { verifier, state, at: Date.now() });
  const params = new URLSearchParams({
    client_id: cid,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  location.assign(`${AUTH_URL}?${params}`);
}

/**
 * Finish the redirect back from Spotify, if this load is one.
 * @returns {Promise<"connected" | "denied" | null>}
 */
export async function completeAuth() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (!code && !error) return null;

  const pkce = read("spotify.pkce", null);
  if (!pkce || params.get("state") !== pkce.state) return null; // not our redirect
  remove("spotify.pkce");
  history.replaceState(null, "", `${location.pathname}${location.hash}`);
  if (error) return "denied";

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: clientId(),
      code_verifier: pkce.verifier,
    }),
  });
  if (!res.ok) throw new SpotifyError(res.status, "token", "Spotify didn't accept the sign-in. Check the Redirect URI matches exactly.");
  saveToken(await res.json());
  return "connected";
}

function saveToken(t, previousRefresh) {
  write("spotify.token", {
    access: t.access_token,
    refresh: t.refresh_token || previousRefresh,
    expires: Date.now() + (Number(t.expires_in || 3600) - EXPIRY_MARGIN_S) * 1000,
  });
}

let refreshing = null;

async function accessToken() {
  const t = read("spotify.token", null);
  if (!t?.refresh) throw new SpotifyError(401, "auth", "Not connected to Spotify");
  if (t.access && Date.now() < t.expires) return t.access;
  refreshing ||= refresh().finally(() => { refreshing = null; });
  return refreshing;
}

async function refresh() {
  // Re-read: another tab may have refreshed (and rotated the token) already.
  const t = read("spotify.token", null);
  if (!t?.refresh) throw new SpotifyError(401, "auth", "Not connected to Spotify");
  if (t.access && Date.now() < t.expires) return t.access;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh, client_id: clientId() }),
  });

  if (!res.ok) {
    // Two tabs refreshing at once: Spotify rotates the token, so the loser
    // gets a 400 — but the winner already stored a good one. Use that.
    const now = read("spotify.token", null);
    if (now?.refresh && now.refresh !== t.refresh && now.access && Date.now() < now.expires) return now.access;
    if (res.status === 400 || res.status === 401) {
      disconnect();
      throw new SpotifyError(401, "auth", "Spotify sign-in expired — connect again");
    }
    // 429 / 5xx: the sign-in is fine, Spotify just didn't answer this time.
    throw new SpotifyError(res.status, "refresh", explain(res.status, ""));
  }
  saveToken(await res.json(), t.refresh);
  return read("spotify.token", null).access;
}

function expireToken() {
  const t = read("spotify.token", null);
  if (t) write("spotify.token", { ...t, expires: 0 });
}

/* ── API ────────────────────────────────────────────────────────── */

function explain(status, reason) {
  if (status === 401) return "Spotify sign-in expired — connect again";
  if (status === 403) return "Playback control needs Spotify Premium";
  if (status === 404 || reason === "NO_ACTIVE_DEVICE") return "Start Spotify on a device first";
  if (status === 429) return "Spotify is rate-limiting — try again in a moment";
  return `Spotify error ${status}`;
}

async function call(path, { method = "GET", query } = {}, retried = false) {
  const token = await accessToken();
  const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401 && !retried) {
    expireToken();
    return call(path, { method, query }, true);
  }
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) {
    let reason = "";
    try {
      reason = (await res.json())?.error?.reason || "";
    } catch {
      /* body wasn't JSON */
    }
    throw new SpotifyError(res.status, reason, explain(res.status, reason));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const spotify = {
  playback: () => call("/me/player", { query: { additional_types: "track,episode" } }),
  play: () => call("/me/player/play", { method: "PUT" }),
  pause: () => call("/me/player/pause", { method: "PUT" }),
  next: () => call("/me/player/next", { method: "POST" }),
  previous: () => call("/me/player/previous", { method: "POST" }),
  /** @param {number} ms */
  seek: (ms) => call("/me/player/seek", { method: "PUT", query: { position_ms: String(Math.max(0, Math.round(ms))) } }),
};
