/* What pressing Return does with whatever is in the bar — the same three-way
   call Safari makes: a bang, an address, or a search. Pure, so it is tested
   directly (tests/resolve.test.mjs). */

import { isKnownTld, isLocalTld } from "./tlds.js";
import { engineFor, bangFor } from "./engines.js";

/* Schemes that hand off to an app or the browser. Anything not listed —
   javascript:, data:, file:, blob: included — is searched for, never opened. */
const PASS_SCHEMES = new Set([
  "mailto", "tel", "sms", "facetime", "facetime-audio", "maps", "webcal", "magnet",
  "spotify", "music", "notion", "slack", "discord", "figma", "vscode", "obsidian",
  "zoommtg", "steam", "itms-apps", "shortcuts", "about",
]);

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const HOST_PORT = /^[^\s/?#:@]+:\d{1,5}(?:[/?#]|$)/; // "localhost:3000", "nas:5000/x"
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const LABEL = /^(?!-)[\p{L}\p{N}-]{1,63}$/u;
const isLabel = (l) => LABEL.test(l) && !l.endsWith("-");

/**
 * The URL `raw` means if it is an address, otherwise null.
 * @param {string} raw
 * @returns {string | null}
 */
export function parseAddress(raw) {
  const s = String(raw ?? "").trim();
  if (!s || /\s/.test(s)) return null;
  const scheme = s.match(SCHEME);
  if (scheme && !HOST_PORT.test(s)) return parseSchemed(s, scheme[1].toLowerCase());
  return parseBare(s);
}

function parseSchemed(s, scheme) {
  if (scheme === "http" || scheme === "https" || scheme === "ftp") {
    if (!/^[a-z]+:\/\/[^/?#\s]/i.test(s)) return null;
    return toHref(s);
  }
  if (!PASS_SCHEMES.has(scheme)) return null;
  return s.length > scheme.length + 1 ? s : null;
}

function parseBare(s) {
  if (s.includes("@")) return null; // an email address is something you look up
  const hostPart = s.split(/[/?#]/)[0];
  const m = hostPart.match(/^(\[[0-9a-f:.]+\]|[^:]+)(?::(\d{1,5}))?$/i);
  if (!m) return null;
  const hinted = Boolean(m[2]) || s.length > hostPart.length;
  const kind = classifyHost(m[1].toLowerCase(), hinted);
  if (!kind) return null;
  return toHref(`${kind === "public" ? "https" : "http"}://${s}`);
}

/* "public" → https, "local" → http, null → not a host at all. `hinted` is true
   when a port or path makes a bare single word unambiguous ("nas:5000"). */
function classifyHost(host, hinted) {
  if (host.startsWith("[")) return "local";
  if (host === "localhost" || host.endsWith(".localhost")) return "local";
  const ip = host.match(IPV4);
  if (ip) return ip.slice(1).every((o) => Number(o) <= 255) ? "local" : null;
  if (/^[\d.]+$/.test(host)) return null; // "3.14", "1.2.3"

  const labels = host.replace(/\.$/, "").split(".");
  if (!labels.every(isLabel)) return null;
  if (labels.length === 1) return hinted ? "local" : null;
  const tld = labels[labels.length - 1];
  if (isLocalTld(tld)) return "local";
  return isKnownTld(tld) ? "public" : null;
}

function toHref(s) {
  try {
    return new URL(s).href;
  } catch {
    return null;
  }
}

/**
 * Bang syntax: "!gh react", "react !gh", or "gh react" for bare-capable keys.
 * @param {string} q trimmed input
 */
function parseBang(q) {
  const pick = (key, rest) => {
    const bang = bangFor(key);
    return bang ? { bang, rest: rest.trim() } : null;
  };
  let m = q.match(/^!(\S+)(?:\s+([\s\S]*))?$/);
  if (m) return pick(m[1], m[2] || "");
  m = q.match(/^([\s\S]*\S)\s+!(\S+)$/);
  if (m) return pick(m[2], m[1]);
  m = q.match(/^(\S+)\s+([\s\S]+)$/);
  if (m && bangFor(m[1])?.bare) return pick(m[1], m[2]);
  return null;
}

/** @param {string} q @param {{engine?: string}} ctx */
export const searchUrl = (q, ctx = {}) => engineFor(ctx.engine).search(encodeURIComponent(q));

/**
 * @typedef {{ kind: "bang" | "url" | "search", url: string, label: string | null }} Resolution
 * @param {string} raw
 * @param {{ engine?: string, lang?: string, region?: string }} ctx
 * @returns {Resolution | null}
 */
export function resolve(raw, ctx = {}) {
  const q = String(raw ?? "").trim();
  if (!q) return null;

  const hit = parseBang(q);
  if (hit) {
    const url = hit.rest
      ? hit.bang.search(encodeURIComponent(hit.rest), ctx)
      : hit.bang.home(ctx);
    return { kind: "bang", url, label: hit.bang.name };
  }

  const address = parseAddress(q);
  if (address) return { kind: "url", url: address, label: null };

  return { kind: "search", url: searchUrl(q, ctx), label: null };
}

/** Bang name for the chip while typing, or null. @param {string} raw */
export function bangLabel(raw) {
  const hit = parseBang(String(raw ?? "").trim());
  return hit ? hit.bang.name : null;
}
