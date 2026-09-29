export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// forward vector for yaw/pitch (camera looks down -Z at yaw 0)
export function forward(yaw, pitch, out = { x: 0, y: 0, z: 0 }) {
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * cp;
  return out;
}

export class Bus {
  constructor() { this.h = {}; }
  on(e, f) { (this.h[e] ||= []).push(f); return () => this.off(e, f); }
  off(e, f) { this.h[e] = (this.h[e] || []).filter((x) => x !== f); }
  emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export function store(key, fallback) {
  try { const v = localStorage.getItem('lockout.' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function save(key, val) {
  try { localStorage.setItem('lockout.' + key, JSON.stringify(val)); } catch { /* storage blocked */ }
}
