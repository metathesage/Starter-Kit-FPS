// One action map. Game code reads actions, never raw keys/buttons.
import { clamp } from './util.js';

// ---- default bindings ---------------------------------------------------------------------------
// Keyboard / mouse: codes are KeyboardEvent.code, or Mouse0..Mouse4 for buttons.
export const DEFAULT_KEYS = {
  fire: ['Mouse0'], zoom: ['Mouse2'], melee: ['KeyF'], jump: ['Space'], crouch: ['KeyC', 'ControlLeft'], sprint: ['ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'], use: ['KeyE'], swap: ['KeyQ'], grenade: ['KeyG'], gswitch: ['KeyT'], blink: ['KeyX'], nova: ['KeyZ'],
  score: ['Tab'], cam: ['KeyV'], chat: ['KeyY'], talk: ['KeyB'],
  mvF: ['KeyW'], mvB: ['KeyS'], mvL: ['KeyA'], mvR: ['KeyD'],
};
// menu keys never move: confirm/back/pause and the four nav directions
const MENU_KEY = { confirm: ['Enter', 'Space'], back: ['Backspace'], pause: ['Escape', 'KeyP'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] };
const MENU_PAD = { confirm: [0], back: [1], pause: [9], up: [12], down: [13], left: [14], right: [15] };
// Gamepad layouts. Buttons: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 LS, 11 RS, 12-15 D-pad
export const PAD_PRESETS = {
  classic: { fire: [7], grenade: [6], zoom: [11], jump: [0], melee: [1], reload: [2], use: [2], swap: [3], gswitch: [4], blink: [4], nova: [5], score: [8], sprint: [10], crouch: [13], talk: [15], cam: [], chat: [] },
  halo: { fire: [7], zoom: [6], grenade: [5], melee: [11], jump: [0], crouch: [1], reload: [2], use: [2], swap: [3], sprint: [10], blink: [4], nova: [12], gswitch: [14], score: [8], talk: [15], cam: [], chat: [] },
  destiny: { fire: [7], zoom: [6], grenade: [4], melee: [5], jump: [0], crouch: [1], reload: [2], use: [2], swap: [3], sprint: [10], blink: [14], nova: [12], gswitch: [13], score: [8], talk: [15], cam: [], chat: [] },
  apex: { fire: [7], zoom: [6], grenade: [5], melee: [11], jump: [0], crouch: [1], reload: [2], use: [2], swap: [3], sprint: [10], blink: [4], nova: [12], gswitch: [14], score: [8], talk: [15], cam: [], chat: [] },
};
export const ACTION_LABELS = [
  ['fire', 'Fire'], ['zoom', 'Zoom / scope'], ['jump', 'Jump'], ['crouch', 'Crouch / slide'], ['sprint', 'Sprint'], ['reload', 'Reload'], ['use', 'Pick up'], ['swap', 'Swap weapon'],
  ['melee', 'Melee'], ['grenade', 'Grenade'], ['gswitch', 'Grenade type'], ['blink', 'Ability 1: blink / dash'], ['nova', 'Ability 2: super / armor'],
  ['mvF', 'Move forward'], ['mvB', 'Move back'], ['mvL', 'Move left'], ['mvR', 'Move right'], ['score', 'Scoreboard'], ['cam', 'Camera'], ['chat', 'Text chat'], ['talk', 'Push to talk'],
];
const BTN_NAME = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT'];
export const keyLabel = (c) => c.startsWith('Mouse') ? ['LMB', 'MMB', 'RMB', 'M4', 'M5'][+c.slice(5)] || c : c.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', 'L ').replace('Right', 'R ').replace('Arrow', '').replace('Control', 'CTRL').replace('Shift', 'SHIFT').replace('Space', 'SPACE').toUpperCase();
export const padLabel = (i) => BTN_NAME[i] || 'B' + i;
const ACTIONS = [...new Set([...Object.keys(DEFAULT_KEYS), ...Object.keys(MENU_KEY)])];
const binds = { kbm: { ...DEFAULT_KEYS }, pad: { ...PAD_PRESETS.classic } };
const DEAD = 0.18;

const keys = new Set(), tap = new Set(), mtap = [false, false, false, false, false];
let mdx = 0, mdy = 0;
const mouse = [false, false, false, false, false];
let padPrev = [], padBtn = [], padAxes = [0, 0, 0, 0], padTrig = [0, 0];
let navT = { up: 0, down: 0, left: 0, right: 0 };

export const Input = {
  last: 'kbm',
  locked: false, fallback: false,
  sens: 1, padSens: 1, invertY: false, ads: false,
  // stick/look tuning (Controls screen): inner deadzone, response curve exponent, per-axis speed, ADS multiplier, look acceleration, rumble strength
  cfg: { dead: 0.18, curve: 1.7, xSens: 1, ySens: 1, adsMul: 0.7, accel: false, vib: 1 },
  capturing: null, holdT: 0,
  binds,
  applyBinds(saved) {
    const sv = saved || {};
    binds.kbm = { ...DEFAULT_KEYS, ...(sv.kbm || {}) };
    binds.pad = { ...(PAD_PRESETS[sv.preset] || PAD_PRESETS.classic), ...(sv.pad || {}) };
  },
  // one-shot capture of the next key, mouse button or gamepad button (for rebinding); cb(null) on Escape
  capture(cb) { this.capturing = cb; },
  keysFor(a) { return binds.kbm[a] || MENU_KEY[a] || []; },
  padFor(a) { return binds.pad[a] || MENU_PAD[a] || []; },
  matches(a, code) { return (binds.kbm[a] || []).includes(code); },
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
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (this.capturing) { e.preventDefault(); const cb = this.capturing; this.capturing = null; cb(e.code === 'Escape' ? null : { dev: 'kbm', code: e.code }); return; }
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
    addEventListener('mousedown', (e) => { if (this.capturing && e.target && e.target.closest && e.target.closest('#binds') && e.button > 0) { e.preventDefault(); const cb = this.capturing; this.capturing = null; cb({ dev: 'kbm', code: 'Mouse' + e.button }); return; } mouse[e.button] = true; mtap[e.button] = true; this.last = 'kbm'; });
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
    try { g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong * this.cfg.vib, weakMagnitude: weak * this.cfg.vib }); } catch { /* unsupported */ }
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
        const dz = this.cfg.dead;
        if (m < dz) { padAxes[s * 2] = 0; padAxes[s * 2 + 1] = 0; }
        else { const k = (Math.min(m, 1) - dz) / (1 - dz) / m; padAxes[s * 2] = x * k; padAxes[s * 2 + 1] = y * k; }
      }
      if (this.capturing) { for (let i = 0; i < 16; i++) if (padBtn[i] && !padPrev[i]) { const cb = this.capturing; this.capturing = null; cb({ dev: 'pad', btn: i }); break; } if (this.capturing && padTrig[0] > 0.6) { const cb = this.capturing; this.capturing = null; cb({ dev: 'pad', btn: 6 }); } if (this.capturing && padTrig[1] > 0.6) { const cb = this.capturing; this.capturing = null; cb({ dev: 'pad', btn: 7 }); } }
      const any = padBtn.some(Boolean) || padAxes.some((a) => Math.abs(a) > 0.05) || padTrig[0] > 0.1 || padTrig[1] > 0.1;
      if (any) this.last = 'pad';
    } else { padBtn = []; padAxes = [0, 0, 0, 0]; padTrig = [0, 0]; }

    const pb = (i) => padBtn[i] || (i === 6 && padTrig[0] > 0.35) || (i === 7 && padTrig[1] > 0.35);
    const kb = (c) => (c.startsWith('Mouse') ? mouse[+c.slice(5)] || mtap[+c.slice(5)] : keys.has(c) || tap.has(c));
    for (const a of ACTIONS) {
      const h = this.keysFor(a).some(kb) || this.padFor(a).some(pb) || !!this.touch.held[a];
      this.prev[a] = this.held[a];
      this.held[a] = !!h;
      this.pressed[a] = this.held[a] && !this.prev[a];
      this.released[a] = !this.held[a] && this.prev[a];
    }
    tap.clear(); mtap.fill(false);
    // movement (keyboard digital + left stick analog)
    const kh = (a) => this.keysFor(a).some(kb);
    let mx = (kh('mvR') ? 1 : 0) - (kh('mvL') ? 1 : 0);
    let my = (kh('mvB') ? 1 : 0) - (kh('mvF') ? 1 : 0);
    if (padAxes[0] || padAxes[1]) { mx += padAxes[0]; my += padAxes[1]; }
    mx += this.touch.move.x; my += this.touch.move.y;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    this.move.x = mx; this.move.y = my;

    // look
    const ads = this.ads ? this.cfg.adsMul : 1, ms = 0.0022 * this.sens * ads, C = this.cfg;
    let lx = mdx * ms * C.xSens + this.touch.look.x * this.sens * C.xSens, ly = mdy * ms * C.ySens + this.touch.look.y * this.sens * C.ySens;
    mdx = 0; mdy = 0; this.touch.look.x = 0; this.touch.look.y = 0;
    const rx = padAxes[2], ry = padAxes[3];
    this.padLookActive = Math.abs(rx) + Math.abs(ry) > 0;
    if (this.padLookActive) {
      const mag = Math.hypot(rx, ry);
      const curve = Math.pow(mag, C.curve) / (mag || 1);
      // optional look acceleration: holding the stick near its rim ramps the turn rate up to 1.6x
      this.holdT = mag > 0.88 ? Math.min(0.5, this.holdT + dt) : Math.max(0, this.holdT - dt * 3);
      const acc = C.accel ? 1 + (this.holdT / 0.5) * 0.6 : 1;
      lx += rx * curve * 3.6 * this.padSens * dt * C.xSens * ads * acc;
      ly += ry * curve * 2.7 * this.padSens * dt * C.ySens * ads;
    } else this.holdT = 0;
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
    if (this.last === 'pad') { const b = this.padFor(action); return b.length ? b.map(padLabel).join('/') : (action === 'up' || action === 'down' || action === 'left' || action === 'right' ? 'D-PAD' : '-'); }
    if (this.last === 'touch') return 'TAP';
    const k = this.keysFor(action); if (action === 'up') return '↑'; if (action === 'down') return '↓'; if (action === 'left') return '←'; if (action === 'right') return '→';
    return k.length ? keyLabel(k[0]) : '-';
  },
};

export const padAim = () => ({ x: padAxes[2] || 0, y: padAxes[3] || 0 });
export { clamp };
