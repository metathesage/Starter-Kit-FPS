/**
 * Input. The single most latency-sensitive system in the game.
 *
 * Rules, in order of importance:
 *  1. Mouse look uses raw movementX/Y accumulated between frames. No smoothing,
 *     no acceleration, no per-event clamping. Whatever the OS reports is applied.
 *  2. The delta is CONSUMED by the first simulate() tick of the frame and then
 *     zeroed, so a long frame does not replay stale look input.
 *  3. Analogue stick is frame-rate independent (scaled by real dt, not sim dt).
 *  4. Buttons are edge-detected here, not in consumers.
 */

const STICK_DEAD = 0.18;
const TRIGGER_DEAD = 0.15;

function radialDead(v, dead = STICK_DEAD) {
  const m = Math.hypot(v.x, v.y);
  if (m < dead) return { x: 0, y: 0 };
  const s = (m - dead) / (1 - dead);
  const inv = 1 / m;
  return { x: v.x * inv * s, y: v.y * inv * s };
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.locked = false;

    // Raw, unconsumed mouse delta for this frame.
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;

    this.buttons = [false, false, false];
    this._prevButtons = [false, false, false];

    this.usingGamepad = false;
    this.gamepadIndex = -1;

    // Edge-triggered actions, recomputed once per frame.
    this.pressed = Object.create(null);
    this.released = Object.create(null);
    this._prevActions = Object.create(null);

    this.sensitivity = 0.0022;
    this.padSensitivity = 2.6;
    this.invertY = false;

    this._bind();
  }

  _bind() {
    const kd = (e) => {
      // Don't swallow devtools / reload shortcuts.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      this.keys.add(e.code);
      if (['Space', 'Tab', 'KeyR', 'F1', 'F5'].includes(e.code) || e.code.startsWith('Digit')) {
        if (this.locked) e.preventDefault();
      }
    };
    const ku = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', kd, { passive: false });
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', () => { this.keys.clear(); this.buttons = [false, false, false]; });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    }, { passive: true });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button < 3) this.buttons[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) this.buttons[e.button] = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.buttons = [false, false, false];
        this.mouseDX = this.mouseDY = 0;
      }
      this.onLockChange?.(this.locked);
    });

    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = -1; this.usingGamepad = false; });
  }

  requestLock() {
    if (this.locked) return;
    const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
    // Chrome returns a promise for unadjustedMovement; fall back if unsupported.
    if (p && typeof p.catch === 'function') {
      p.catch(() => { try { this.canvas.requestPointerLock(); } catch { /* ignore */ } });
    }
  }

  exitLock() { if (this.locked) document.exitPointerLock?.(); }

  down(code) { return this.keys.has(code); }
  anyDown(...codes) { return codes.some((c) => this.keys.has(c)); }

  /* ------------------------------------------------------------ per-frame */

  /**
   * Poll hardware and rebuild the edge-triggered action set.
   * Call exactly once per animation frame, BEFORE the sim steps run.
   */
  poll(frameDt) {
    const pad = this._readGamepad();
    this.pad = pad;

    const A = this.pressed;
    for (const k in this._prevActions) delete A[k];
    this.released = Object.create(null);

    const edge = (name, now) => {
      if (now && !this._prevActions[name]) this.pressed[name] = true;
      if (!now && this._prevActions[name]) this.released[name] = true;
      this._prevActions[name] = now;
    };

    const k = this.keys;
    edge('fire', this.buttons[0] || pad.trigger > TRIGGER_DEAD);
    edge('aim', this.buttons[2] || pad.leftTrigger > TRIGGER_DEAD);
    edge('jump', k.has('Space') || pad.a);
    edge('crouch', k.has('ControlLeft') || k.has('KeyC') || pad.b);
    edge('sprint', k.has('ShiftLeft') || k.has('ShiftRight') || pad.leftStickClick);
    edge('reload', k.has('KeyR') || pad.x);
    edge('melee', k.has('KeyV') || pad.y);
    edge('scoreboard', k.has('Tab') || pad.select);
    edge('pause', k.has('Escape') || pad.start);
    edge('nextWeapon', k.has('KeyE') || pad.rightBumper);
    edge('prevWeapon', k.has('KeyQ') || pad.leftBumper);
    for (let i = 1; i <= 6; i++) edge(`slot${i}`, k.has(`Digit${i}`) || k.has(`Numpad${i}`));
    if (pad.dpadUp) edge('slot1', true);
    if (pad.dpadRight) edge('slot3', true);
    if (pad.dpadLeft) edge('prevWeapon', true);
    if (pad.dpadDown) edge('nextWeapon', true);

    this._prevButtons = this.buttons.slice();
  }

  _readGamepad() {
    const empty = {
      move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, trigger: 0, leftTrigger: 0,
      a: false, b: false, x: false, y: false, start: false, select: false,
      leftBumper: false, rightBumper: false, leftStickClick: false,
      dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
      connected: false,
    };
    if (typeof navigator.getGamepads !== 'function') return empty;
    const pads = navigator.getGamepads();
    let gp = null;
    for (const p of pads) { if (p && p.connected) { gp = p; break; } }
    if (!gp) { this.usingGamepad = false; return empty; }

    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const av = (i) => (gp.axes[i] ?? 0);
    const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);

    const g = {
      ...empty,
      connected: true,
      move: radialDead({ x: dead(av(0)), y: -dead(av(1)) }),
      look: radialDead({ x: dead(av(2)), y: -dead(av(3)) }),
      trigger: gp.buttons[7]?.value ?? 0,
      leftTrigger: gp.buttons[6]?.value ?? 0,
      a: b(0), b: b(1), x: b(2), y: b(3),
      leftBumper: b(4), rightBumper: b(5),
      select: b(8), start: b(9),
      leftStickClick: b(10),
      dpadUp: b(12), dpadDown: b(13), dpadLeft: b(14), dpadRight: b(15),
    };
    return g;
  }

  /* --------------------------------------------------------- consumption */

  /**
   * Movement wish direction in local space: x = strafe, y = forward.
   * Keyboard wins when both are present, matching console shooters.
   */
  moveAxis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    let m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    const p = this.pad;
    if (p?.connected && Math.hypot(p.move.x, p.move.y) > 0) { x = p.move.x; y = p.move.y; }
    return { x, y };
  }

  /** Raw look delta in radians for this frame. Consumes the buffer. */
  look(frameDt) {
    let yaw = this.mouseDX * this.sensitivity;
    let pitch = this.mouseDY * this.sensitivity * (this.invertY ? -1 : 1);
    this.mouseDX = 0;
    this.mouseDY = 0;

    // Any real mouse movement means the player is on mouse; drop stick aim.
    if (Math.abs(yaw) > 1e-6 || Math.abs(pitch) > 1e-6) this.usingGamepad = false;

    const p = this.pad;
    if (p?.connected) {
      const mag = Math.hypot(p.look.x, p.look.y);
      if (mag > 0.02) {
        this.usingGamepad = true;
        // Cubic response curve: fine control near centre, full speed at the edge.
        const c = Math.sign(p.look.x) * Math.pow(Math.abs(p.look.x), 2) * this.padSensitivity * frameDt;
        const d = Math.sign(p.look.y) * Math.pow(Math.abs(p.look.y), 2) * this.padSensitivity * frameDt * (this.invertY ? -1 : 1);
        yaw += c;
        pitch += d;
      }
    }
    return { yaw, pitch };
  }

  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
}
