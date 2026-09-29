/**
 * Fixed-timestep game loop with render interpolation.
 *
 * Why fixed: "crisp" input means the same mouse delta produces the same camera
 * rotation regardless of frame rate. Variable-dt simulation makes the game feel
 * different on a 60 Hz laptop and a 165 Hz monitor. So we simulate at a constant
 * rate and only the *presentation* varies.
 *
 *   simulate(dt)   always called with exactly SIM_DT
 *   render(alpha)  called once per animation frame with the interpolation factor
 *
 * Input is sampled once per frame and the raw mouse delta is *consumed* by the
 * first simulate() of that frame, then zeroed. No accumulation of stale input.
 */

export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;
const MAX_FRAME = 0.25;        // never simulate more than 250ms of catch-up
const MAX_STEPS = 8;           // spiral-of-death guard

export class Loop {
  constructor({ simulate, render }) {
    this.simulate = simulate;
    this.render = render;
    this.running = false;
    this.accumulator = 0;
    this.last = 0;
    this.timeScale = 1;
    this.hitStopUntil = 0;
    this.paused = false;

    // Diagnostics — surfaced in the debug overlay.
    this.stats = { fps: 0, frame: 0, steps: 0, simMs: 0, renderMs: 0, slow: 0 };
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._raf = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  /**
   * Freeze the simulation briefly while real time continues. Used for kill
   * hit-stop. Never used on the player taking damage — that feels like lag.
   */
  hitStop(seconds) {
    const until = performance.now() + seconds * 1000;
    if (until > this.hitStopUntil) this.hitStopUntil = until;
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > MAX_FRAME) frameDt = MAX_FRAME;
    if (frameDt < 0) frameDt = 0;

    this.stats.frame = frameDt;
    this._fpsAccum += frameDt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.25) {
      this.stats.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    // Hit-stop scales the simulation, not real time.
    let scale = this.timeScale;
    if (this.hitStopUntil > now) scale *= 0.06;
    else this.hitStopUntil = 0;

    if (this.paused) scale = 0;

    this.accumulator += frameDt * scale;

    const simStart = performance.now();
    let steps = 0;
    while (this.accumulator >= SIM_DT && steps < MAX_STEPS) {
      this.simulate(SIM_DT);
      this.accumulator -= SIM_DT;
      steps++;
    }
    // If we blew the step budget the sim can't keep up; drop the backlog rather
    // than accumulating debt that would cause a permanent stutter.
    if (steps === MAX_STEPS) this.accumulator = 0;
    this.stats.steps = steps;
    this.stats.simMs = performance.now() - simStart;

    const alpha = this.accumulator / SIM_DT;
    const renderStart = performance.now();
    this.render(alpha, frameDt);
    this.stats.renderMs = performance.now() - renderStart;

    if (frameDt > 0.024) this.stats.slow++;
  }
}
