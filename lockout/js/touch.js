// On-screen controls for phones/tablets: floating stick (left), look drag (right), action buttons.
import { Input } from './input.js';

const I = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const ICON = {
  fire: 'M12 3v5M12 16v5M3 12h5M16 12h5M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  jump: 'M12 19V6M6 11l6-6 6 6',
  crouch: 'M12 5v14M6 13l6 6 6-6',
  melee: 'M7 11V7h3v3h2V6h3v4h2V8h2v7c0 3-2 5-5 5h-3c-3 0-4-2-4-5z',
  grenade: 'M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM10 4h4v4h-4z',
  reload: 'M5 12a7 7 0 1 1 2.2 5.1M5 18v-5h5',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M11 8v6M8 11h6',
  pause: 'M8 5v14M16 5v14',
  score: 'M4 6h16M4 12h16M4 18h10',
  blink: 'M3 7l5 5-5 5M10 7l5 5-5 5M18 5v14',
  nova: 'M12 2l2.200 6.600L21 12l-6.800 3.400L12 22l-2.200-6.600L3 12l6.800-3.400z',
};

export function initTouch() {
  const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || new URLSearchParams(location.search).has('touch');
  if (!coarse) return false;
  document.body.classList.add('touch-on');
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `
    <div class="tz tz-move"></div><div class="tz tz-look"></div>
    <div class="stick" hidden><i></i></div>
    <button class="tb t-fire" data-a="fire" aria-label="Fire">${I(ICON.fire)}</button>
    <button class="tb t-jump" data-a="jump" aria-label="Jump">${I(ICON.jump)}</button>
    <button class="tb t-melee" data-a="melee" aria-label="Melee">${I(ICON.melee)}</button>
    <button class="tb t-gren" data-a="grenade" aria-label="Grenade">${I(ICON.grenade)}</button>
    <button class="tb t-reload" data-a="use reload" aria-label="Reload or pick up">${I(ICON.reload)}</button>
    <button class="tb t-swap" data-a="swap" aria-label="Swap weapon">${I(ICON.swap)}</button>
    <button class="tb t-zoom" data-a="zoom" aria-label="Zoom">${I(ICON.zoom)}</button>
    <button class="tb t-blink" data-a="blink" aria-label="Blink">${I(ICON.blink)}</button>
    <button class="tb t-nova" data-a="nova" aria-label="Nova bomb">${I(ICON.nova)}</button>
    <button class="tb t-crouch" data-a="crouch" aria-label="Crouch">${I(ICON.crouch)}</button>
    <button class="tb t-pause" data-a="pause" aria-label="Pause">${I(ICON.pause)}</button>
    <button class="tb t-score" data-a="score" aria-label="Scoreboard">${I(ICON.score)}</button>`;
  document.body.appendChild(root);
  const T = Input.touch; T.enabled = true;
  const stick = root.querySelector('.stick'), knob = stick.querySelector('i');
  let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0;
  const R = 56;
  const zoneMove = root.querySelector('.tz-move'), zoneLook = root.querySelector('.tz-look');

  zoneMove.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId; sx = e.clientX; sy = e.clientY; zoneMove.setPointerCapture(e.pointerId);
    stick.hidden = false; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; knob.style.transform = 'translate(0,0)'; Input.last = 'touch';
  });
  zoneMove.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - sx, dy = e.clientY - sy; const m = Math.hypot(dx, dy);
    if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const k = Math.min(1, m / R), dead = 0.12, mag = k < dead ? 0 : (k - dead) / (1 - dead);
    T.move.x = m > 0 ? (dx / Math.max(m, 1e-6)) * mag * (m > R ? 1 : 1) : 0; T.move.y = m > 0 ? (dy / Math.max(m, 1e-6)) * mag : 0;
    T.move.x = (dx / R) * (mag / Math.max(k, 1e-6)); T.move.y = (dy / R) * (mag / Math.max(k, 1e-6));
  });
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; stick.hidden = true; T.move.x = 0; T.move.y = 0; };
  zoneMove.addEventListener('pointerup', endStick); zoneMove.addEventListener('pointercancel', endStick);

  zoneLook.addEventListener('pointerdown', (e) => { if (lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; zoneLook.setPointerCapture(e.pointerId); Input.last = 'touch'; });
  zoneLook.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    T.look.x += (e.clientX - lx) * 0.0058; T.look.y += (e.clientY - ly) * 0.0058; lx = e.clientX; ly = e.clientY;
  });
  const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
  zoneLook.addEventListener('pointerup', endLook); zoneLook.addEventListener('pointercancel', endLook);

  root.querySelectorAll('.tb').forEach((b) => {
    const acts = b.dataset.a.split(' ');
    const down = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); acts.forEach((a) => (T.held[a] = true)); Input.last = 'touch'; };
    const up = (e) => { b.classList.remove('on'); acts.forEach((a) => (T.held[a] = false)); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  return true;
}
