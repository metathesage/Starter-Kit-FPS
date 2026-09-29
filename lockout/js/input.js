// One action map. Game code reads actions, never raw keys/buttons.
import { clamp } from './util.js';

const KEY = {
  fire: [], zoom: [],
  jump: ['Space'], crouch: ['KeyC', 'ControlLeft', 'ShiftLeft'], reload: ['KeyR'], use: ['KeyE'],
  swap: ['KeyQ'], grenade: ['KeyG'], gswitch: ['KeyT'], melee: ['KeyF'], score: ['Tab'],
  cam: ['KeyV'], confirm: ['Enter', 'Space'], back: ['Backspace'], pause: ['Escape', 'KeyP'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
};
// Xbox standard mapping
const PAD = {
  jump: [0], confirm: [0], melee: [1], back: [1], reload: [2], use: [2], swap: [3], gswitch: [4],
  score: [8], pause: [9], crouch: [10], zoom: [11],
  up: [12], down: [13], left: [14], right: [15],
};
const ACTIONS = Object.keys(KEY);
const DEAD = 0.18;

const keys = new Set(), tap = new Set(), mtap = [false, false, false];
let mdx = 0, mdy = 0;
const mouse = [false, false, false];
let padPrev = [], padBtn = [], padAxes = [0, 0, 0, 0], padTrig = [0, 0];
let navT = { up: 0, down: 0, left: 0, right: 0 };

export const Input = {
  last: 'kbm',
  locked: false, fallback: false,
  sens: 1, padSens: 1, invertY: false,
  padConnected: false,
  held: {}, prev: {}, pressed: {}, released: {}, nav: {},
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  padLookActive: false,
  touch: { enabled: false, move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: {} },
  gp: null,
  el: null,
  onLockChange: null,

  init(el) {
    this.el = el;
    ACTIONS.forEach((a) => { this.held[a] = false; this.prev[a] = false; this.pressed[a] = false; this.released[a] = false; });
    ['up', 'down', 'left', 'right'].forEach((a) => (this.nav[a] = false));
    addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      keys.add(e.code); tap.add(e.code); this.last = 'kbm';
    });
    addEventListener('keyup', (e) => keys.delete(e.code));
    addEventListener('blur', () => { keys.clear(); mouse.fill(false); });
    addEventListener('mousemove', (e) => {
      if (this.locked || this.fallback) { mdx += e.movementX; mdy += e.movementY; }
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) this.last = 'kbm';
    });
    addEventListener('mousedown', (e) => { mouse[e.button] = true; mtap[e.button] = true; this.last = 'kbm'; });
    addEventListener('mouseup', (e) => { mouse[e.button] = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('gamepadconnected', () => (this.padConnected = true));
    addEventListener('gamepaddisconnected', () => { this.padConnected = false; this.onPadLost && this.onPadLost(); });
    document.addEventListener('pointerlockerror', () => { this.fallback = true; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      this.onLockChange && this.onLockChange(this.locked);
    });
  },

  lock() { try { const p = this.el.requestPointerLock && this.el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* denied */ } },
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); },

  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    const g = this.gp;
    if (!g || !g.vibrationActuator || this.last !== 'pad') return;
    try { g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch { /* unsupported */ }
  },

  update(dt) {
    // gamepad
    const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean);
    this.gp = gp || null;
    padPrev = padBtn;
    if (gp) {
      this.padConnected = true;
      padBtn = gp.buttons.map((b) => b.pressed);
      padTrig = [gp.buttons[6] ? gp.buttons[6].value : 0, gp.buttons[7] ? gp.buttons[7].value : 0];
      padAxes = gp.axes.slice(0, 4);
      // radial deadzone
      for (let s = 0; s < 2; s++) {
        const x = padAxes[s * 2] || 0, y = padAxes[s * 2 + 1] || 0;
        const m = Math.hypot(x, y);
        if (m < DEAD) { padAxes[s * 2] = 0; padAxes[s * 2 + 1] = 0; }
        else { const k = (Math.min(m, 1) - DEAD) / (1 - DEAD) / m; padAxes[s * 2] = x * k; padAxes[s * 2 + 1] = y * k; }
      }
      const any = padBtn.some(Boolean) || padAxes.some((a) => Math.abs(a) > 0.05) || padTrig[0] > 0.1 || padTrig[1] > 0.1;
      if (any) this.last = 'pad';
    } else { padBtn = []; padAxes = [0, 0, 0, 0]; padTrig = [0, 0]; }

    for (const a of ACTIONS) {
      let h = KEY[a].some((k) => keys.has(k) || tap.has(k)) || (PAD[a] || []).some((i) => padBtn[i]) || !!this.touch.held[a];
      if (a === 'fire') h = mouse[0] || mtap[0] || padTrig[1] > 0.35 || padBtn[7] || !!this.touch.held.fire;
      if (a === 'zoom') h = mouse[2] || mtap[2] || padBtn[11] || !!this.touch.held.zoom;
      if (a === 'grenade') h = h || padTrig[0] > 0.35 || padBtn[6] || !!this.touch.held.grenade;
      this.prev[a] = this.held[a];
      this.held[a] = !!h;
      this.pressed[a] = this.held[a] && !this.prev[a];
      this.released[a] = !this.held[a] && this.prev[a];
    }

    tap.clear(); mtap.fill(false);
    // movement (keyboard digital + left stick analog)
    let mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let my = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    if (padAxes[0] || padAxes[1]) { mx += padAxes[0]; my += padAxes[1]; }
    mx += this.touch.move.x; my += this.touch.move.y;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    this.move.x = mx; this.move.y = my;

    // look
    const ms = 0.0022 * this.sens;
    let lx = mdx * ms + this.touch.look.x * this.sens, ly = mdy * ms + this.touch.look.y * this.sens;
    mdx = 0; mdy = 0; this.touch.look.x = 0; this.touch.look.y = 0;
    const rx = padAxes[2], ry = padAxes[3];
    this.padLookActive = Math.abs(rx) + Math.abs(ry) > 0;
    if (this.padLookActive) {
      const mag = Math.hypot(rx, ry);
      const curve = Math.pow(mag, 1.7) / (mag || 1);
      lx += rx * curve * 3.6 * this.padSens * dt;
      ly += ry * curve * 2.7 * this.padSens * dt;
    }
    if (this.invertY) ly = -ly;
    this.look.x = lx; this.look.y = ly;

    // menu navigation with repeat
    for (const d of ['up', 'down', 'left', 'right']) {
      let on = this.held[d];
      if (d === 'up' && padAxes[1] < -0.6) on = true;
      if (d === 'down' && padAxes[1] > 0.6) on = true;
      if (d === 'left' && padAxes[0] < -0.6) on = true;
      if (d === 'right' && padAxes[0] > 0.6) on = true;
      this.nav[d] = false;
      if (on) {
        if (navT[d] === 0) { this.nav[d] = true; navT[d] = 0.35; }
        else { navT[d] -= dt; if (navT[d] <= 0) { this.nav[d] = true; navT[d] = 0.09; } }
        if (navT[d] === 0) navT[d] = 0.001;
      } else navT[d] = 0;
    }
  },

  // any input at all (for splash skip)
  any() { return keys.size > 0 || mouse.some(Boolean) || padBtn.some(Boolean); },

  glyph(action) {
    if (this.last === 'pad') {
      return ({ fire: 'RT', zoom: 'RS', jump: 'A', crouch: 'LS', reload: 'X', use: 'X', swap: 'Y', grenade: 'LT', gswitch: 'LB', melee: 'B', score: 'VIEW', pause: 'MENU', confirm: 'A', back: 'B', cam: 'RS', up: 'D-PAD', down: 'D-PAD', left: 'D-PAD', right: 'D-PAD' })[action] || '?';
    }
    if (this.last === 'touch') return 'TAP';
    return ({ fire: 'LMB', zoom: 'RMB', jump: 'SPACE', crouch: 'C', reload: 'R', use: 'E', swap: 'Q', grenade: 'G', gswitch: 'T', melee: 'F', score: 'TAB', pause: 'ESC', confirm: 'ENTER', back: 'ESC', cam: 'V', up: '↑', down: '↓', left: '←', right: '→' })[action] || '?';
  },
};

export const padAim = () => ({ x: padAxes[2] || 0, y: padAxes[3] || 0 });
export { clamp };
