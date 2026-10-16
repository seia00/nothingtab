/* Now Playing panel, driven by Spotify. Polls only while this tab is visible
   (every tab is this page, and hidden ones shouldn't spend the rate limit),
   interpolates the progress bar between polls, and updates optimistically
   when you press a control. */

import { spotify, isConnected, clientId, beginAuth, completeAuth, disconnect, redirectUri, canAuthorize } from "./spotify.js";
import { emit } from "./bus.js";
import { h, ICON, toast, clock, copyText, liquid, $ } from "./ui.js";

const POLL_PLAYING_MS = 5000;
const POLL_IDLE_MS = 12_000;
const AFTER_ACTION_MS = 450;
const SEEK_STEP_MS = 5000;
const ART_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(scdn\.co|spotifycdn\.com)\//;

/** @typedef {{ title: string, artist: string, art: string, url: string, duration: number, progress: number, at: number, playing: boolean }} Track */

export function initPlayer() {
  const root = $("#player");
  const els = {
    img: /** @type {HTMLImageElement} */ ($("#player-img")),
    art: $("#player-art"),
    title: $("#player-title"),
    artist: $("#player-artist"),
    toggle: $("#player-toggle"),
    prev: $("#player-prev"),
    next: $("#player-next"),
    bar: $("#player-bar"),
    fill: $("#player-fill"),
    pos: $("#player-pos"),
    dur: $("#player-dur"),
    connect: $("#player-connect"),
    menuBtn: $("#player-menu"),
    pop: $("#player-pop"),
  };

  liquid(root);

  /** @type {Track | null} */
  let track = null;
  let pollTimer = 0;
  let tickTimer = 0;

  const state = () => {
    if (!isConnected()) return "setup";
    if (!track) return "idle";
    return track.playing ? "playing" : "paused";
  };

  const position = () => {
    if (!track) return 0;
    const live = track.playing ? Date.now() - track.at : 0;
    return Math.min(track.duration, track.progress + live);
  };

  /* ── Rendering ──────────────────────────────────────────────── */

  function render() {
    const st = state();
    root.dataset.state = st;
    const controllable = st === "playing" || st === "paused";
    [els.toggle, els.prev, els.next].forEach((b) => { b.disabled = !controllable; });
    els.toggle.setAttribute("aria-label", st === "playing" ? "Pause" : "Play");

    if (track) {
      els.title.textContent = track.title;
      els.artist.textContent = track.artist;
      els.title.href = track.url;
      els.art.href = track.url;
      if (track.art && els.img.getAttribute("src") !== track.art) els.img.src = track.art;
      els.img.hidden = !track.art;
    } else {
      els.title.textContent = "Nothing playing";
      els.artist.textContent = st === "setup" ? "Spotify" : "Start Spotify on any device";
      els.title.href = els.art.href = "https://open.spotify.com/";
      els.img.hidden = true;
      els.img.removeAttribute("src");
    }
    tick();

    emit("track", {
      state: st,
      title: track?.title || "",
      progress: track?.progress || 0,
      duration: track?.duration || 0,
      at: track?.at || Date.now(),
    });
  }

  function tick() {
    const d = track?.duration || 0;
    const p = position();
    els.fill.style.setProperty("--p", d ? (p / d).toFixed(4) : "0");
    els.pos.textContent = clock(p);
    els.dur.textContent = clock(d);
    els.bar.setAttribute("aria-valuemax", String(Math.round(d / 1000)));
    els.bar.setAttribute("aria-valuenow", String(Math.round(p / 1000)));
    els.bar.setAttribute("aria-valuetext", `${clock(p)} of ${clock(d)}`);
    if (track?.playing && d && p >= d) schedule(300);
  }

  /* ── Polling ────────────────────────────────────────────────── */

  function apply(pb) {
    const item = pb?.item;
    if (!item) {
      track = null;
      return render();
    }
    const images = item.album?.images || item.images || item.show?.images || [];
    const art = (images.find((i) => i.width && i.width <= 320) || images[0])?.url || "";
    track = {
      title: String(item.name || ""),
      artist: (item.artists || []).map((a) => a.name).join(", ") || item.show?.name || "",
      art: ART_HOSTS.test(art) ? art : "",
      url: /^https:\/\/open\.spotify\.com\//.test(item.external_urls?.spotify || "")
        ? item.external_urls.spotify : "https://open.spotify.com/",
      duration: Number(item.duration_ms) || 0,
      progress: Number(pb.progress_ms) || 0,
      at: Date.now(),
      playing: Boolean(pb.is_playing),
    };
    render();
  }

  async function poll() {
    if (!isConnected() || document.hidden) return;
    try {
      apply(await spotify.playback());
    } catch (err) {
      if (err.status === 401) { track = null; render(); toast(err.message); return; }
      // Transient (network, 5xx, 429): keep what's on screen and try later.
    } finally {
      schedule();
    }
  }

  function schedule(ms) {
    clearTimeout(pollTimer);
    if (!isConnected() || document.hidden) return;
    pollTimer = setTimeout(poll, ms ?? (track?.playing ? POLL_PLAYING_MS : POLL_IDLE_MS));
  }

  clearInterval(tickTimer);
  tickTimer = setInterval(() => { if (track?.playing && !document.hidden) tick(); }, 500);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(pollTimer);
    else poll();
  });

  /* ── Controls ───────────────────────────────────────────────── */

  async function act(fn, optimistic) {
    const before = track && { ...track };
    if (optimistic && track) { optimistic(track); render(); }
    try {
      await fn();
    } catch (err) {
      if (before) { track = before; render(); }
      toast(err.message || "Spotify didn't respond");
    }
    schedule(AFTER_ACTION_MS);
  }

  els.toggle.addEventListener("click", () => {
    if (!track) return;
    const playing = track.playing;
    act(playing ? spotify.pause : spotify.play, (t) => {
      t.progress = position();
      t.at = Date.now();
      t.playing = !playing;
    });
  });

  els.next.addEventListener("click", () => act(spotify.next));
  els.prev.addEventListener("click", () => act(spotify.previous));

  const seekTo = (ms) => {
    if (!track?.duration) return;
    const target = Math.min(track.duration, Math.max(0, ms));
    act(() => spotify.seek(target), (t) => { t.progress = target; t.at = Date.now(); });
  };

  els.bar.addEventListener("click", (e) => {
    const r = els.bar.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * (track?.duration || 0));
  });

  els.bar.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    seekTo(position() + (e.key === "ArrowRight" ? SEEK_STEP_MS : -SEEK_STEP_MS));
  });

  /* ── Connection popover ─────────────────────────────────────── */

  function setupView() {
    const uri = redirectUri();
    const field = h("input", {
      class: "field__input", type: "text", placeholder: "Client ID", value: clientId(),
      autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Spotify Client ID",
    });
    const error = h("p", { class: "field__error", role: "alert", hidden: true });
    const connect = async () => {
      try {
        error.hidden = true;
        await beginAuth(field.value);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    };
    field.addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });

    const warn = !canAuthorize()
      ? h("p", { class: "field__error" }, location.hostname === "localhost"
        ? "Spotify won't accept “localhost”. Open this page at 127.0.0.1 instead."
        : "Spotify sign-in needs this page served over https.")
      : null;

    return [
      h("span", { class: "label" }, "Connect Spotify"),
      h("p", {}, "Show what's playing on any of your devices, and control it from here."),
      h("ol", { class: "pop__steps" },
        h("li", {}, h("span", {}, "Create an app in the ",
          h("a", { href: "https://developer.spotify.com/dashboard", target: "_blank", rel: "noopener" }, "Spotify Developer Dashboard"),
          " (tick Web API).")),
        h("li", {}, h("span", {}, "Add this Redirect URI:",
          h("span", { class: "pop__code" }, h("code", {}, uri),
            h("button", {
              class: "icon-btn", type: "button", "aria-label": "Copy Redirect URI", html: ICON.copy,
              onclick: async () => toast((await copyText(uri)) ? "Redirect URI copied" : "Clipboard unavailable"),
            })))),
        h("li", {}, h("span", {}, "Paste the app's Client ID:"))),
      field,
      error,
      warn,
      h("p", { class: "field__label" }, "Play / pause / skip need Spotify Premium"),
      h("div", { class: "pop__row" },
        h("button", { class: "btn btn--ghost", type: "button", onclick: closePop }, "Cancel"),
        h("button", { class: "btn btn--primary", type: "button", onclick: connect }, "Connect")),
    ];
  }

  function connectedView() {
    return [
      h("span", { class: "label" }, "Spotify"),
      h("p", {}, "Connected. This browser keeps the sign-in; nothing goes through any other server."),
      h("div", { class: "pop__row" },
        h("a", { class: "btn btn--ghost", href: "https://open.spotify.com/", target: "_blank", rel: "noopener" }, "Open Spotify"),
        h("button", {
          class: "btn btn--primary", type: "button",
          onclick: () => { disconnect(); track = null; closePop(); render(); toast("Spotify disconnected"); },
        }, "Disconnect")),
    ];
  }

  function openPop() {
    els.pop.replaceChildren(...(isConnected() ? connectedView() : setupView()).filter(Boolean));
    els.pop.hidden = false;
    els.menuBtn.setAttribute("aria-expanded", "true");
    els.pop.querySelector("input, button")?.focus();
  }

  function closePop() {
    els.pop.hidden = true;
    els.menuBtn.setAttribute("aria-expanded", "false");
  }

  els.menuBtn.addEventListener("click", () => (els.pop.hidden ? openPop() : closePop()));
  els.connect.addEventListener("click", openPop);

  document.addEventListener("pointerdown", (e) => {
    if (!els.pop.hidden && !els.pop.contains(e.target) && !els.menuBtn.contains(e.target) && !els.connect.contains(e.target)) closePop();
  });
  els.pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closePop(); els.menuBtn.focus(); }
  });

  /* ── Boot ───────────────────────────────────────────────────── */

  render();
  completeAuth()
    .then((result) => {
      if (result === "connected") toast("Spotify connected");
      if (result === "denied") toast("Spotify connection cancelled");
    })
    .catch((err) => toast(err.message))
    .finally(() => { render(); poll(); });
}
