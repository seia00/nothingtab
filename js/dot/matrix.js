/* Canvas LED renderer shared by the Glyph Matrix and the console display.

   Scenes draw into a `target` brightness buffer; each frame eases what is
   shown toward it, so digits cross-fade like real LEDs instead of snapping.
   A dissolve gives every dot its own random start delay — the Nothing
   "sparkle" between toys. Unlit dots are painted once into a cached base
   layer, so a frame only costs the lit ones. */

const SETTLE = 0.004;

export class DotMatrix {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ cols: number, rows: number, round?: boolean, dot?: number, fade?: number,
   *   pixel?: "round" | "square" }} opts
   *   dot: lit size as a fraction of pitch; fade: easing time constant (ms);
   *   pixel: round LEDs, or square pixels like a screen
   */
  constructor(canvas, { cols, rows, round = false, dot = 0.62, fade = 70, pixel = "round" }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cols = cols;
    this.rows = rows;
    this.dotSize = dot;
    this.fade = fade;
    this.square = pixel === "square";

    const n = cols * rows;
    this.target = new Float32Array(n);
    this.shown = new Float32Array(n);
    this.red = new Uint8Array(n);
    this.startAt = new Float64Array(n);
    this.mask = makeMask(cols, rows, round);

    this.raf = 0;
    this.last = 0;
    this.pitch = 0;
    this.base = null;
    this.litDot = null;
    this.redDot = null;

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /* ── Drawing into the target buffer ─────────────────────────── */

  clear() {
    this.target.fill(0);
    this.red.fill(0);
  }

  /** @param {number} x @param {number} y @param {number} [v] @param {boolean} [red] */
  plot(x, y, v = 1, red = false) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    if (!this.mask[i]) return;
    if (v >= this.target[i]) {
      this.target[i] = v;
      this.red[i] = red ? 1 : 0;
    }
  }

  /** @param {string[]} rows '#' = lit, 'R' = lit red */
  sprite(rows, x, y, { v = 1, red = false } = {}) {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const c = row[dx];
        if (c === "#") this.plot(x + dx, y + dy, v, red);
        else if (c === "R") this.plot(x + dx, y + dy, v, true);
      }
    });
  }

  /**
   * @param {string} str
   * @param {number} x
   * @param {number} y top of the cap height
   * @param {import("./font.js").Font} font
   * @returns {number} x after the last glyph
   */
  text(str, x, y, font, { v = 1, red = false, spacing = font.spacing } = {}) {
    let cx = x;
    for (const ch of str) {
      const rows = font.get(ch);
      if (!rows) continue;
      this.sprite(rows, cx, y, { v, red });
      cx += rows[0].length + spacing;
    }
    return cx - spacing;
  }

  rect(x, y, w, h, v = 1, red = false) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.plot(x + dx, y + dy, v, red);
  }

  /* ── Presenting ──────────────────────────────────────────────── */

  /** Start easing toward the target. @param {{ dissolve?: number }} [opts] ms spread */
  present({ dissolve = 0 } = {}) {
    const now = performance.now();
    if (dissolve > 0) {
      for (let i = 0; i < this.startAt.length; i++) this.startAt[i] = now + Math.random() * dissolve;
    }
    this.kick();
  }

  /** Jump straight to the target — for theme swaps captured mid-transition. */
  snap() {
    this.shown.set(this.target);
    this.startAt.fill(0);
    this.draw();
  }

  kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  frame = (now) => {
    this.raf = 0;
    const dt = Math.min(64, now - this.last);
    this.last = now;
    const k = 1 - Math.exp(-dt / this.fade);
    let busy = false;

    for (let i = 0; i < this.shown.length; i++) {
      if (!this.mask[i]) continue;
      if (now < this.startAt[i]) { busy = true; continue; }
      const d = this.target[i] - this.shown[i];
      if (d > SETTLE || d < -SETTLE) {
        this.shown[i] += d * k;
        busy = true;
      } else {
        this.shown[i] = this.target[i];
      }
    }

    this.draw();
    if (busy) this.raf = requestAnimationFrame(this.frame);
  };

  draw() {
    const { ctx, canvas, pitch } = this;
    if (!pitch || !this.base) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.base, 0, 0);

    const half = this.litDot.width / 2;
    for (let i = 0; i < this.shown.length; i++) {
      const v = this.shown[i];
      if (v < 0.01) continue;
      const x = (i % this.cols + 0.5) * pitch;
      const y = (Math.floor(i / this.cols) + 0.5) * pitch;
      ctx.globalAlpha = Math.min(1, v);
      ctx.drawImage(this.red[i] ? this.redDot : this.litDot, x - half, y - half);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Size + palette ──────────────────────────────────────────── */

  resize() {
    const w = this.canvas.clientWidth;
    if (!w) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const pitch = (w * dpr) / this.cols;
    this.canvas.width = Math.round(pitch * this.cols);
    this.canvas.height = Math.round(pitch * this.rows);
    this.pitch = pitch;
    this.repaint();
  }

  /** Re-read the LED colours from CSS (call after a theme change). */
  repaint() {
    if (!this.pitch) return;
    const css = getComputedStyle(this.canvas);
    const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const on = color("--dot-on", "#fff");
    const off = color("--dot-off", "rgba(255,255,255,.08)");
    const red = color("--dot-red", "#ff2b2b");
    const glow = parseFloat(color("--dot-glow", ".5")) || 0;

    const r = (this.pitch * this.dotSize) / 2;
    this.litDot = makeDot(this.pitch, r, on, glow, this.square);
    this.redDot = makeDot(this.pitch, r, red, Math.max(glow, 0.45), this.square);
    this.base = this.makeBase(r * 0.92, off);
    this.draw();
  }

  makeBase(r, color) {
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext("2d");
    g.fillStyle = color;
    for (let i = 0; i < this.mask.length; i++) {
      if (!this.mask[i]) continue;
      g.beginPath();
      pixelPath(g, (i % this.cols + 0.5) * this.pitch, (Math.floor(i / this.cols) + 0.5) * this.pitch, r, this.square);
      g.fill();
    }
    return c;
  }
}

/* A round LED, or a square pixel with just-softened corners. */
function pixelPath(g, x, y, r, square) {
  if (square) g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.28);
  else g.arc(x, y, r, 0, Math.PI * 2);
}

/* One lit LED: a soft halo plus a crisp core. */
function makeDot(pitch, r, color, glow, square = false) {
  const size = Math.ceil(pitch * 2.4);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const m = size / 2;

  if (glow > 0) {
    const halo = g.createRadialGradient(m, m, r * 0.6, m, m, size / 2);
    halo.addColorStop(0, withAlpha(color, 0.38 * glow));
    halo.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, size, size);
  }

  g.fillStyle = color;
  g.beginPath();
  pixelPath(g, m, m, r, square);
  g.fill();
  return c;
}

/* Canvas gradients need an explicit alpha; CSS colour strings come in several
   shapes, so let the browser normalise them first. */
function withAlpha(color, alpha) {
  const probe = document.createElement("canvas").getContext("2d");
  probe.fillStyle = color;
  const v = probe.fillStyle;
  if (v.startsWith("#")) {
    const n = parseInt(v.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return v.replace(/rgba?\(([^)]+)\)/, (_, body) => {
    const [r, g, b] = body.split(",").map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  });
}

function makeMask(cols, rows, round) {
  const mask = new Uint8Array(cols * rows);
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const R = Math.min(cols, rows) / 2 - 0.15;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      mask[y * cols + x] = !round || (x - cx) ** 2 + (y - cy) ** 2 <= R * R ? 1 : 0;
    }
  }
  return mask;
}
