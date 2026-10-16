/* Drives a DotMatrix through a "scene": redraws on a clock boundary for static
   scenes (the clock only needs a frame per minute) or every animation frame
   for animated ones, and stops entirely while the tab is hidden. */

import { prefersReducedMotion } from "../ui.js";

/**
 * @typedef {object} Scene
 * @property {(m: import("./matrix.js").DotMatrix, now: Date) => void} draw
 * @property {number} [every]        redraw period in ms, aligned to wall-clock boundaries
 * @property {() => boolean} [animated]  true → redraw continuously
 * @property {number} [fps]
 */

export class SceneRunner {
  /** @param {import("./matrix.js").DotMatrix} matrix */
  constructor(matrix) {
    this.m = matrix;
    this.scene = null;
    this.timer = 0;
    this.anim = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else this.refresh();
    });
  }

  /** @param {Scene} scene @param {{ dissolve?: number }} [opts] */
  show(scene, { dissolve = 450 } = {}) {
    this.scene = scene;
    this.paint(prefersReducedMotion() ? 0 : dissolve);
    this.schedule();
  }

  /** Data behind the current scene changed. */
  refresh() {
    if (!this.scene) return;
    this.paint(0);
    this.schedule();
  }

  paint(dissolve = 0) {
    this.m.clear();
    this.scene.draw(this.m, new Date());
    this.m.present({ dissolve });
  }

  stop() {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.anim);
    this.timer = 0;
    this.anim = 0;
  }

  schedule() {
    this.stop();
    const scene = this.scene;
    if (!scene || document.hidden) return;

    if (scene.animated?.() && !prefersReducedMotion()) {
      const frameMs = 1000 / (scene.fps || 24);
      let last = 0;
      const loop = (t) => {
        if (t - last >= frameMs) {
          last = t;
          this.paint(0);
        }
        this.anim = requestAnimationFrame(loop);
      };
      this.anim = requestAnimationFrame(loop);
      return;
    }

    const every = scene.every || 60_000;
    const wait = every - (Date.now() % every) + 15;
    this.timer = setTimeout(() => {
      this.paint(0);
      this.schedule();
    }, wait);
  }
}
