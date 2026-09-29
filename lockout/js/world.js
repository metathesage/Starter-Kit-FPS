// Maps: data, collision, raycasts, nav graph and visuals. Two symmetric maps, selectable at runtime.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { mergeStatic } from './merge.js';

export const STEP = 0.42;
export const solids = [];
export let BOUNDS = { x: 30, z: 27 };
export let KILL_Y = -12;
export let SPAWNS = { red: [], blue: [] };
export let PICKUPS = [];
export let MAP = null;
export const MAP_LIST = [
  { id: 'lockout', name: 'LOCKOUT', tag: 'Cold storage. Glass deck, drum towers, elbow bridge, void below.' },
  { id: 'cryostat', name: 'CRYOSTAT', tag: 'Night snow station. Twin snipe towers, reactor core, power-ups everywhere.' },
  { id: 'halcyon', name: 'HALCYON', tag: 'Dusk ruins under a wounded moon. A bridge over the lane, high balconies, a broken arch at each base. Built for blink and nova.' },
  { id: 'mesa', name: 'MESA', tag: 'Sunset canyon. A central plateau, two sniper spires, sandstone bases and long sightlines.' },
];

const add = (o) => { solids.push(o); return o; };
const box = (x0, x1, z0, z1, y0, y1, mat = 'wall', extra = {}) => add({ x0, x1, z0, z1, y0, y1, ramp: null, mat, ...extra });
const ramp = (x0, x1, z0, z1, y0, axis, a, b, ya, yb, extra = {}) =>
  add({ x0, x1, z0, z1, y0, y1: Math.max(ya, yb), ramp: { axis, a, b, ya, yb }, mat: 'ramp', ...extra });
const pBox = (x0, x1, z0, z1, y0, y1, mat, extra = {}) => {
  box(x0, x1, z0, z1, y0, y1, mat, { side: 1, ...extra });
  box(-x1, -x0, -z1, -z0, y0, y1, mat, { side: -1, ...extra });
};
const pRamp = (x0, x1, z0, z1, y0, axis, a, b, ya, yb, mat = 'ramp') => {
  ramp(x0, x1, z0, z1, y0, axis, a, b, ya, yb, { side: 1, mat });
  ramp(-x1, -x0, -z1, -z0, y0, axis, -a, -b, ya, yb, { side: -1, mat });
};
const T = 0.6;
const mirrorPickups = (half, extra = []) => [...half, ...half.map((p) => ({ ...p, x: -p.x, z: -p.z })), ...extra];
const spawnsFrom = (red, y) => ({
  red: red.map(([x, z]) => ({ x, y, z, yaw: -Math.PI / 2 })),
  blue: red.map(([x, z]) => ({ x: -x, y, z: -z, yaw: Math.PI / 2 })),
});

// ================= LOCKOUT: a Forerunner outpost hanging over a snowy void =================
// Rotationally symmetric. Blue +X, Red -X. NO floor: fall and you die.
// L0 bottom deck y=0 | L1 mid corridor + bases y=4 | L2 top-mid deck + tower decks y=8 | L3 sniper ledges y=12
function defineLockout() {
  BOUNDS = { x: 30, z: 27 }; KILL_Y = -12;
  box(-29, 29, -7, 7, -T, 0, 'deck');
  box(-8, 8, -5.5, 5.5, 4 - T, 4, 'deck');
  pBox(8, 16, -2, 5.5, 4 - T, 4, 'deck');
  pBox(16, 29, -5.5, 5.5, 4 - T, 4, 'deck');
  pBox(19, 29, -6.4, 6.4, 4 - T, 4, 'base');
  pBox(28.4, 29, -6.4, 6.4, 4, 8.5, 'wall');
  pBox(19, 22.4, 6, 6.4, 4, 6.4, 'wall'); pBox(25.6, 29, 6, 6.4, 4, 6.4, 'wall');
  pBox(19, 25.6, -6.4, -6, 4, 6.4, 'wall');                                   // north wall, open at x 25.6..29 for the tower ramp
  pBox(20, 21.6, -5.6, -4.4, 4, 5.2, 'post'); pBox(20, 21.6, 4.4, 5.6, 4, 5.2, 'post');
  pRamp(8, 16, -5.5, -2, -T, 'x', 8, 16, 0, 4);                               // bottom -> mid
  pRamp(12, 20, -2, 2, 4, 'x', 20, 12, 4, 8);                                 // mid -> top-mid
  // top-mid deck, crenellated posts, glass-frame walls
  box(-12, 12, -6.5, 6.5, 8 - T, 8, 'deck');
  for (const x of [-9, -4.5, 0, 4.5, 9]) { box(x - 0.45, x + 0.45, -6.4, -5.6, 8, 9.5, 'post'); box(x - 0.45, x + 0.45, 5.6, 6.4, 8, 9.5, 'post'); }
  pBox(-3.2, 3.2, -2.5, -2.1, 8, 8.9, 'rail');
  // tower bridge + tower: north strip, west deck, base->deck ramp on the east side, snipe ramp, sniper ledge
  pBox(12, 21, -10, -4.5, 8 - T, 8, 'deck');
  pBox(21, 29, -17, -14, 0, 8, 'tower'); pBox(21, 25.6, -14, -7, 0, 8, 'tower');
  pRamp(25.6, 29, -14, -6.4, 4, 'z', -6.4, -14, 4, 8);                        // base slab -> tower deck
  pBox(21.2, 21.9, -16.6, -15.9, 8, 9.4, 'post'); pBox(27, 28.6, -16.6, -15.4, 8, 9.2, 'crate');
  pRamp(22, 25, -16, -8, 8, 'z', -8, -16, 8, 12, 'ramp');                     // tower deck -> sniper ledge
  pBox(22, 29, -21, -16, 12 - T, 12, 'deck');
  pBox(29, 29.6, -21, -16, 12, 14.4, 'wall');
  pBox(22, 22.6, -20.9, -20.3, 12, 15, 'post'); pBox(28.4, 29, -20.9, -20.3, 12, 15, 'post'); pBox(22, 22.6, -16.4, -15.8, 12, 15, 'post'); pBox(28.4, 29, -16.4, -15.8, 12, 15, 'post');
  pBox(26.4, 27.8, -19.2, -17.8, 12, 13.1, 'crate');
  // elbow: railed ramp down to the bottom, L-shaped landing back to the bottom deck
  pRamp(22.4, 25.6, 6.4, 15, -T, 'z', 6.4, 15, 4, 0);
  pRamp(22.4, 22.8, 6.4, 15, -T, 'z', 6.4, 15, 5, 1, 'rail'); pRamp(25.2, 25.6, 6.4, 15, -T, 'z', 6.4, 15, 5, 1, 'rail');
  pBox(12, 26, 15, 19, -T, 0, 'deck'); pBox(12, 15, 7, 15, -T, 0, 'deck');
  pBox(12, 26, 18.6, 19, 0, 0.9, 'rail'); pBox(25.6, 26, 15, 19, 0, 0.9, 'rail'); pBox(12, 22.4, 15, 15.4, 0, 0.9, 'rail'); pBox(12, 12.4, 7.4, 15, 0, 0.9, 'rail'); pBox(14.6, 15, 7.4, 15, 0, 0.9, 'rail');
  // ---- cover everywhere ----
  pBox(10, 11.6, 3, 4.6, 0, 1.1, 'crate'); pBox(-3, -1.4, -4.6, -3, 0, 1.1, 'crate'); pBox(4, 8, 5.6, 6.2, 0, 1.3, 'rail'); pBox(4, 5.3, -1.6, 1.6, 0, 1.4, 'crate');   // bottom mid
  pBox(23, 25, 1.5, 2.4, 0, 1.2, 'crate'); pBox(23, 25, -2.4, -1.5, 0, 1.2, 'crate'); pBox(20.5, 21.3, -5, -2.5, 0, 1.6, 'rail');                                       // bottom room
  pBox(2, 2.7, -5.4, -4.7, 4, 7.4, 'post'); pBox(6, 6.7, -5.4, -4.7, 4, 7.4, 'post'); pBox(2, 2.7, 4.7, 5.4, 4, 7.4, 'post'); pBox(6, 6.7, 4.7, 5.4, 4, 7.4, 'post');   // mid corridor columns
  pBox(-1.5, 1.5, -3.6, -3.2, 4, 5.1, 'rail'); pBox(9.5, 11, 0, 1.2, 4, 5.1, 'crate');                                                                                  // under-glass + mid cover
  pBox(21.5, 23, -2.5, -1, 4, 5.2, 'crate'); pBox(21.5, 23, 1, 2.5, 4, 5.2, 'crate'); pBox(27, 28.2, -1, 1, 4, 5.6, 'crate');                                            // base cover
  SPAWNS = spawnsFrom([[-27, -4], [-25.6, 0.2], [-27, 4], [-24.5, -2.5], [-24.5, 2.5], [-21, -3.5], [-21, 3.5], [-25, 5.3]], 4);
  PICKUPS = mirrorPickups([
    { id: 'br', x: 26, y: 4, z: 4.6, t: 25 }, { id: 'br', x: 26, y: 4, z: -4.6, t: 25 },
    { id: 'magnum', x: 25, y: 0, z: 0, t: 30 }, { id: 'smg', x: 6, y: 4, z: 3, t: 30 },
    { id: 'shotgun', x: 8, y: 8, z: -3, t: 55 }, { id: 'sniper', x: 25.5, y: 12, z: -18.5, t: 70 },
    { id: 'rocket', x: 19, y: 0, z: 17, t: 90 }, { id: 'carbine', x: 23.5, y: 8, z: -7.6, t: 45 },
    { id: 'needler', x: 7, y: 8, z: 4.4, t: 45 }, { id: 'plasmarifle', x: 14, y: 0, z: 4.6, t: 40 },
  ], [{ id: 'sword', x: 0, y: 8, z: 0, t: 90 }, { id: 'overshield', x: 0, y: 4, z: 0, t: 120 }, { id: 'hammer', x: 0, y: 0, z: 0, t: 100 }, { id: 'camo', x: 0, y: 8, z: 4.2, t: 120 }]);
  MAP = { id: 'lockout', nav: { x0: -30, x1: 30, z0: -26, z1: 26 }, obj: { flags: { blue: [26.4, 4, 0], red: [-26.4, 4, 0] }, ball: [0, 8, -4] } };
}

// ================= CRYOSTAT: night snow research station on a frozen plateau =================
// Rotationally symmetric. Ground floor with a perimeter wall (no void), a reactor core with four ramps,
// two sniper towers, raised bases, mid pods, side ramps, and plenty of cover.
function defineCryostat() {
  BOUNDS = { x: 36, z: 26 }; KILL_Y = -60;
  box(-37, 37, -27, 27, -T, 0, 'snow');
  box(-37, 37, 26, 27, 0, 8, 'wall'); box(-37, 37, -27, -26, 0, 8, 'wall'); box(36, 37, -27, 27, 0, 8, 'wall'); box(-37, -36, -27, 27, 0, 8, 'wall');
  // reactor core: deck y=6, four ramps, glowing pillar, corner cover
  box(-7, 7, -7, 7, 0, 6, 'tower');
  pRamp(7, 19, -2, 2, 0, 'x', 19, 7, 0, 6);
  pRamp(-2, 2, 7, 19, 0, 'z', 19, 7, 0, 6);
  box(-1.6, 1.6, -1.6, 1.6, 6, 13, 'pillar');
  pBox(4, 7, 4, 7, 6, 7.2, 'post'); pBox(4, 7, -7, -4, 6, 7.2, 'post');
  pBox(-5.6, -4.6, 2, 3.2, 6, 7.2, 'crate');
  // sniper towers (top y=7): ground ramp, skybridge from the core, parapets, cover
  pBox(24, 32, -16, -8, 0, 7, 'tower');
  pRamp(10, 24, -15.5, -12.5, 0, 'x', 10, 24, 0, 7);
  pRamp(7, 24, -10, -5, 5.4, 'x', 7, 24, 6, 7);
  pBox(24, 32, -16.4, -16, 7, 7.9, 'rail'); pBox(31.6, 32, -16, -8, 7, 7.9, 'rail'); pBox(24, 32, -8, -7.6, 7, 7.9, 'rail');
  pBox(25.5, 27, -15.6, -14.4, 7, 8.2, 'crate'); pBox(29, 30.5, -9.6, -8.4, 7, 8.2, 'crate'); pBox(30.6, 31.4, -13, -11, 7, 8.4, 'post');
  // bases: raised pad y=3 with two ramps
  pBox(24, 35, -3, 9, 0, 3, 'base');
  pRamp(16, 24, 3.5, 7.5, 0, 'x', 16, 24, 0, 3);
  pRamp(27, 31, 9, 17, 0, 'z', 17, 9, 0, 3);
  pBox(24, 35, -3, -2.6, 3, 3.9, 'rail'); pBox(24, 27, 8.6, 9, 3, 3.9, 'rail'); pBox(31, 35, 8.6, 9, 3, 3.9, 'rail');
  pBox(24, 24.4, -3, 3.5, 3, 3.9, 'rail'); pBox(24, 24.4, 7.5, 9, 3, 3.9, 'rail');
  pBox(27, 28.4, 0, 2, 3, 4.2, 'crate'); pBox(31, 33, -2, -0.8, 3, 4.2, 'crate'); pBox(29.5, 30.7, 5.5, 7, 3, 4.6, 'post');
  // mid pods (top y=3.5): two ramps each
  pBox(13, 19, 8, 14, 0, 3.5, 'base');
  pRamp(7, 13, 9.5, 12.5, 0, 'x', 7, 13, 0, 3.5);
  pRamp(14.5, 17.5, 14, 22, 0, 'z', 22, 14, 0, 3.5);
  pBox(13, 19, 8, 8.4, 3.5, 4.4, 'rail'); pBox(18.6, 19, 8, 14, 3.5, 4.4, 'rail'); pBox(14.2, 15.8, 11.2, 12.6, 3.5, 4.7, 'crate');
  // ground cover
  pBox(11, 11.8, -9, -3, 0, 2.4, 'ice'); pBox(20, 21, -7.5, -4.5, 0, 2.2, 'ice');
  pBox(12, 14, 3.5, 5.5, 0, 1.1, 'crate'); pBox(-1, 1, -12.5, -10.5, 0, 1.1, 'crate'); pBox(2, 3.6, 15.5, 17, 0, 1.2, 'crate'); pBox(26, 28, -22, -20, 0, 1.2, 'crate');
  pBox(4, 5.4, 10, 11.4, 0, 3.2, 'pillar'); pBox(9, 10.4, -5, -3.6, 0, 3.2, 'pillar'); pBox(21, 22.4, 12, 13.4, 0, 3.2, 'pillar'); pBox(33, 34.4, -13, -11.6, 0, 3.2, 'pillar');
  pBox(20, 26, -24.5, -22.5, 0, 1.0, 'snow'); pBox(5, 11, 20, 22, 0, 1.0, 'snow'); pBox(28, 33, 19, 21, 0, 1.0, 'snow'); pBox(-9, -4, 8.6, 10, 0, 1.0, 'snow');
  pBox(15, 16, -22, -17.5, 0, 2.2, 'ice'); pBox(-12, -10, 16, 16.8, 0, 1.6, 'ice');
  SPAWNS = { red: [], blue: [] };
  const bluePad = [[26, -1.5], [26, 3.5], [26, 7], [29, 3.5], [32.5, 7], [32.5, 3.5], [30, -1.2], [34, 2]];
  SPAWNS.blue = bluePad.map(([x, z]) => ({ x, y: 3, z, yaw: Math.PI / 2 }));
  SPAWNS.red = bluePad.map(([x, z]) => ({ x: -x, y: 3, z: -z, yaw: -Math.PI / 2 }));
  PICKUPS = mirrorPickups([
    { id: 'br', x: 27.8, y: 3, z: 6.6, t: 25 }, { id: 'br', x: 27.5, y: 3, z: -1.8, t: 25 },
    { id: 'magnum', x: 33, y: 3, z: 3, t: 30 },
    { id: 'smg', x: 14, y: 0, z: -4.6, t: 30 }, { id: 'smg', x: 22, y: 0, z: -9.8, t: 30 },
    { id: 'carbine', x: 16.5, y: 3.5, z: 9.4, t: 45 }, { id: 'plasmarifle', x: 22, y: 0, z: 9.6, t: 40 },
    { id: 'needler', x: 3.4, y: 6, z: 5.6, t: 45 }, { id: 'shotgun', x: 9, y: 0, z: -8, t: 55 },
    { id: 'rocket', x: 20, y: 0, z: -18, t: 90 }, { id: 'sniper', x: 28, y: 7, z: -12, t: 70 },
    { id: 'sword', x: 4.6, y: 6, z: 0, t: 90 }, { id: 'hammer', x: 0, y: 0, z: 21, t: 100 },
    { id: 'overshield', x: 34, y: 3, z: -1.6, t: 120 }, { id: 'camo', x: 17.6, y: 3.5, z: 13, t: 120 },
    { id: 'boost', x: 7, y: 0, z: -22.5, t: 120 },
  ]);
  MAP = { id: 'cryostat', nav: { x0: -34, x1: 34, z0: -24, z1: 24 }, obj: { flags: { blue: [28.5, 3, 5], red: [-28.5, 3, -5] }, ball: [0, 6, -4.5] } };
}

// ================= MESA: sunset canyon arena =================
// Rotationally symmetric. Ground floor inside canyon walls, a central plateau (y4) with four ramps,
// a sniper spire per side (y8) reached by a long ramp, sandstone bases (y3) and side pods.
function defineMesa() {
  BOUNDS = { x: 36, z: 26 }; KILL_Y = -60;
  box(-37, 37, -27, 27, -T, 0, 'sand');
  box(-37, 37, 26, 27, 0, 10, 'rock'); box(-37, 37, -27, -26, 0, 10, 'rock'); box(36, 37, -27, 27, 0, 10, 'rock'); box(-37, -36, -27, 27, 0, 10, 'rock');
  // central plateau
  box(-8, 8, -8, 8, 0, 4, 'tower');
  pRamp(8, 16, -2, 2, 0, 'x', 16, 8, 0, 4);
  pRamp(-2, 2, 8, 16, 0, 'z', 16, 8, 0, 4);
  box(-1.4, 1.4, -1.4, 1.4, 4, 11, 'pillar');
  pBox(4, 7.4, 4, 7.4, 4, 5.1, 'post'); pBox(4, 7.4, -7.4, -4, 4, 5.1, 'post');
  // sniper spires
  pBox(20, 28, -16, -10, 0, 8, 'tower');
  pRamp(6, 20, -15.5, -12.5, 0, 'x', 6, 20, 0, 8);
  pBox(20, 28, -16.4, -16, 8, 8.9, 'rail'); pBox(27.6, 28, -16, -10, 8, 8.9, 'rail'); pBox(20, 28, -10, -9.6, 8, 8.9, 'rail');
  pBox(23, 24.6, -15.4, -14, 8, 9.2, 'crate'); pBox(25.6, 26.8, -11.6, -10.4, 8, 9.2, 'crate');
  // bases
  pBox(24, 35, -6, 6, 0, 3, 'base');
  pRamp(16, 24, 2, 5.5, 0, 'x', 16, 24, 0, 3);
  pRamp(27, 31, 6, 14, 0, 'z', 14, 6, 0, 3);
  pBox(24, 35, -6, -5.6, 3, 3.9, 'rail'); pBox(24, 27, 5.6, 6, 3, 3.9, 'rail'); pBox(31, 35, 5.6, 6, 3, 3.9, 'rail'); pBox(34.6, 35, -6, 6, 3, 3.9, 'rail'); pBox(24, 24.4, -6, 2, 3, 3.9, 'rail');
  pBox(27, 28.4, -2.4, -0.8, 3, 4.2, 'crate'); pBox(31, 33, 1.2, 2.6, 3, 4.2, 'crate');
  // side pods
  pBox(12, 18, 10, 16, 0, 3, 'base');
  pRamp(6, 12, 11.5, 14.5, 0, 'x', 6, 12, 0, 3);
  pRamp(13.5, 16.5, 16, 22, 0, 'z', 22, 16, 0, 3);
  pBox(12, 18, 10, 10.4, 3, 3.9, 'rail'); pBox(17.6, 18, 10, 16, 3, 3.9, 'rail'); pBox(14.2, 15.8, 12.4, 13.6, 3, 4.5, 'crate');
  // ground cover
  pBox(11, 12, -9, -3, 0, 2.4, 'rock'); pBox(20, 21, -6, -3, 0, 2.2, 'rock'); pBox(12, 14, 3.5, 5.5, 0, 1.1, 'crate'); pBox(2, 3.6, -20, -18.4, 0, 1.2, 'crate'); pBox(26, 28, -22, -20, 0, 1.2, 'crate');
  pBox(4, 5.4, 17.4, 18.8, 0, 3.2, 'pillar'); pBox(9, 10.4, -6, -4.6, 0, 3.2, 'pillar'); pBox(21, 22.4, 10, 11.4, 0, 3.2, 'pillar'); pBox(33, 34.4, -13, -11.6, 0, 3.2, 'pillar');
  pBox(6, 10, 19, 21, 0, 1, 'rock'); pBox(30, 34, -20, -18, 0, 1, 'rock'); pBox(15, 17, -22, -20.5, 0, 1.6, 'rock');
  const pad = [[26, -3.5], [26, 0], [26, 3.5], [29, -4], [29, 4], [31, 0], [33, -3.4], [33, 3.4]];
  SPAWNS = { red: pad.map(([x, z]) => ({ x: -x, y: 3, z: -z, yaw: -Math.PI / 2 })), blue: pad.map(([x, z]) => ({ x, y: 3, z, yaw: Math.PI / 2 })) };
  PICKUPS = mirrorPickups([
    { id: 'br', x: 28.4, y: 3, z: 4.4, t: 25 }, { id: 'br', x: 28.4, y: 3, z: -4.4, t: 25 }, { id: 'magnum', x: 33.4, y: 3, z: 0, t: 30 },
    { id: 'smg', x: 14, y: 0, z: -6, t: 30 }, { id: 'carbine', x: 14, y: 3, z: 15.2, t: 45 }, { id: 'plasmarifle', x: 22, y: 0, z: 7, t: 40 },
    { id: 'needler', x: 0, y: 4, z: -5, t: 45 }, { id: 'shotgun', x: 9, y: 0, z: 9, t: 55 }, { id: 'rocket', x: 22, y: 0, z: -19, t: 90 },
    { id: 'sniper', x: 24, y: 8, z: -13, t: 70 }, { id: 'camo', x: 15, y: 0, z: -9.6, t: 120 }, { id: 'overshield', x: 33.6, y: 3, z: -4.6, t: 120 },
  ], [{ id: 'sword', x: 0, y: 4, z: 3.2, t: 90 }, { id: 'hammer', x: 0, y: 0, z: 20, t: 100 }, { id: 'boost', x: 0, y: 0, z: -20, t: 120 }]);
  MAP = { id: 'mesa', nav: { x0: -34, x1: 34, z0: -24, z1: 24 }, obj: { flags: { blue: [30.4, 3, 2.4], red: [-30.4, 3, -2.4] }, ball: [0, 4, -2] } };
}

// ================= HALCYON: dusk ruins under a wounded moon =================
// Rotationally symmetric. Blue +X, Red -X. A bridge spans the centre lane, balconies flank it, spires hold the power weapons.
function defineHalcyon() {
  BOUNDS = { x: 36, z: 26 }; KILL_Y = -60;
  box(-37, 37, -27, 27, -T, 0, 'floor');
  box(-37, 37, 26, 27, 0, 11, 'wall'); box(-37, 37, -27, -26, 0, 11, 'wall'); box(36, 37, -27, 27, 0, 11, 'wall'); box(-37, -36, -27, 27, 0, 11, 'wall');
  // base plinth, ramps, broken arch
  pBox(26, 36, -9, 9, 0, 2.6, 'plinth');
  pRamp(21, 26, -3.5, 3.5, 0, 'x', 21, 26, 0, 2.6);
  pRamp(28, 32, 9, 15, 0, 'z', 15, 9, 0, 2.6);
  pBox(34.4, 36, -10, -8, 2.6, 11, 'column'); pBox(34.4, 36, 8, 10, 2.6, 11, 'column'); pBox(34.4, 36, -10, -1, 10, 11.2, 'ruin');
  pBox(26, 27.2, -7.2, -5.6, 2.6, 3.9, 'rubble'); pBox(26, 27.2, 5.6, 7.2, 2.6, 3.9, 'rubble');
  // balcony over the side lane
  pBox(11, 20, 12, 20, 0, 3.6, 'ruin');
  pRamp(4, 11, 14, 18, 0, 'x', 4, 11, 0, 3.6);
  pRamp(20, 27, 13.5, 17, 0, 'x', 27, 20, 0, 3.6);
  pBox(11, 20, 19.6, 20, 3.6, 4.8, 'rubble'); pBox(19.6, 20, 12, 20, 3.6, 4.8, 'rubble'); pBox(14, 15.4, 15, 16.4, 3.6, 9.5, 'column');
  // the bridge and its ramps
  box(-12, 12, -2.5, 2.5, 4.2, 5, 'bridge');
  pRamp(12, 21, -2.5, 2.5, 0, 'x', 21, 12, 0, 5);
  box(-1.2, 1.2, -1.2, 1.2, 0, 4.2, 'column');
  box(-12, 12, -2.5, -2.1, 5, 5.9, 'rubble'); box(-12, 12, 2.1, 2.5, 5, 5.9, 'rubble');
  // sniper spires
  pBox(22, 28, -22, -16, 0, 9, 'spire');
  pRamp(6, 22, -21, -17.5, 0, 'x', 6, 22, 0, 9);
  pBox(22, 28, -22.4, -22, 9, 9.9, 'rubble'); pBox(27.6, 28, -22, -16, 9, 9.9, 'rubble'); pBox(22, 28, -16.4, -16, 9, 9.9, 'rubble');
  // floating shard platforms
  pBox(-4, 4, 11, 15, 2.4, 3, 'shard');
  pRamp(4, 9.5, 11.5, 14.5, 0, 'x', 9.5, 4, 0, 3);
  // ground cover
  pBox(12, 14, -10, -6, 0, 1.4, 'rubble'); pBox(16, 17.4, -10, -8.6, 0, 4, 'column'); pBox(8, 9.4, 4, 5.4, 0, 3.2, 'column'); pBox(14, 17, 5, 7, 0, 1.2, 'rubble');
  pBox(30, 32, -16, -14, 0, 1.2, 'rubble'); pBox(4, 6, -12, -10.5, 0, 2, 'rubble');
  const pad = [[28, -4], [28, 0], [28, 4], [31, -6], [31, 6], [33, -3], [33, 3], [30, 0]];
  SPAWNS = { red: pad.map(([x, z]) => ({ x: -x, y: 2.6, z: -z, yaw: -Math.PI / 2 })), blue: pad.map(([x, z]) => ({ x, y: 2.6, z, yaw: Math.PI / 2 })) };
  PICKUPS = mirrorPickups([
    { id: 'br', x: 28.4, y: 2.6, z: 5.6, t: 25 }, { id: 'br', x: 28.4, y: 2.6, z: -5.6, t: 25 }, { id: 'magnum', x: 33.4, y: 2.6, z: 0, t: 30 },
    { id: 'smg', x: 15, y: 0, z: -4, t: 30 }, { id: 'carbine', x: 17, y: 3.6, z: 14, t: 45 }, { id: 'plasmarifle', x: 24, y: 0, z: 6, t: 40 },
    { id: 'needler', x: 0, y: 3, z: 13, t: 45 }, { id: 'shotgun', x: 8, y: 0, z: 9.5, t: 55 }, { id: 'rocket', x: 26, y: 0, z: -12, t: 90 },
    { id: 'sniper', x: 25, y: 9, z: -19, t: 70 }, { id: 'camo', x: 12, y: 0, z: -13, t: 120 }, { id: 'overshield', x: 33.6, y: 2.6, z: -6, t: 120 },
  ], [{ id: 'sword', x: 0, y: 5, z: 1.6, t: 90 }, { id: 'hammer', x: 0, y: 0, z: 21, t: 100 }, { id: 'boost', x: 0, y: 0, z: -21, t: 120 }]);
  MAP = { id: 'halcyon', nav: { x0: -34, x1: 34, z0: -24, z1: 24 }, obj: { flags: { blue: [33, 2.6, 0], red: [-33, 2.6, 0] }, ball: [0, 5, -0.8] } };
}

export function defineMap(id) {
  solids.length = 0; nav.nodes.length = 0; nav.built = false;
  if (id === 'cryostat') defineCryostat(); else if (id === 'mesa') defineMesa(); else if (id === 'halcyon') defineHalcyon(); else defineLockout();
}

// ---- collision --------------------------------------------------------------
export function topAt(s, x, z) {
  const r = s.ramp;
  if (!r) return s.y1;
  const c = r.axis === 'x' ? x : z;
  return r.ya + (r.yb - r.ya) * clamp((c - r.a) / (r.b - r.a), 0, 1);
}

export function groundAt(x, z, refY) {
  let best = -Infinity;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const t = topAt(s, x, z);
    if (t <= refY + STEP && t > best) best = t;
  }
  return best;
}

export function blocked(x, z, y, r, h) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (s.y0 >= y + h) continue;
    const cx = x < s.x0 ? s.x0 : x > s.x1 ? s.x1 : x;
    const cz = z < s.z0 ? s.z0 : z > s.z1 ? s.z1 : z;
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz >= r * r) continue;
    if (topAt(s, cx, cz) > y + STEP) return true;
  }
  return false;
}

// lowest overhead underside between yFrom and yTo above (x,z)
export function ceilingBetween(x, z, yFrom, yTo) {
  let best = Infinity;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x0 - 0.3 || x > s.x1 + 0.3 || z < s.z0 - 0.3 || z > s.z1 + 0.3) continue;
    if (s.y0 >= yFrom - 0.02 && s.y0 <= yTo && s.y0 < best) best = s.y0;
  }
  return best;
}

export function pointSolid(x, y, z) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1 || y < s.y0) continue;
    if (y <= topAt(s, x, z)) return true;
  }
  return false;
}

// distance along ray to first solid hit, or Infinity
export function rayWorld(ox, oy, oz, dx, dy, dz, max = 120) {
  const step = 0.2;
  let t = 0, prev = 0;
  while (t < max) {
    if (pointSolid(ox + dx * t, oy + dy * t, oz + dz * t)) {
      let lo = prev, hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) * 0.5;
        if (pointSolid(ox + dx * m, oy + dy * m, oz + dz * m)) hi = m; else lo = m;
      }
      return hi;
    }
    prev = t; t += step + t * 0.004;
  }
  return Infinity;
}

export function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  return rayWorld(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3) === Infinity;
}

// ---- nav graph ---------------------------------------------------------------
export const nav = { nodes: [], built: false };

export function buildNav() {
  const N = nav.nodes; N.length = 0;
  const G = 2;
  const nb = MAP.nav;
  for (let x = nb.x0; x <= nb.x1; x += G) {
    for (let z = nb.z0; z <= nb.z1; z += G) {
      const ys = new Set();
      for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) ys.add(Math.round(topAt(s, x, z) * 100) / 100);
      for (const y of ys) {
        if (y > 12.5 || y < -0.5) continue;
        if (blocked(x, z, y, 0.5, 1.75)) continue;
        if (Math.abs(groundAt(x, z, y) - y) > 0.06) continue;
        // headroom
        let head = false;
        for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y0 > y + 0.05 && s.y0 < y + 1.8) head = true;
        if (head) continue;
        N.push({ id: N.length, x, y, z, nb: [] });
      }
    }
  }
  const walk = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.25);
    let cy = a.y;
    for (let i = 1; i <= n; i++) {
      const px = a.x + (dx * i) / n, pz = a.z + (dz * i) / n;
      if (blocked(px, pz, cy, 0.42, 1.75)) return false;
      const g = groundAt(px, pz, cy);
      if (Math.abs(g - cy) > 0.3) return false;
      cy = g;
    }
    return Math.abs(cy - b.y) < 0.25;
  };
  for (let i = 0; i < N.length; i++) {
    const a = N[i];
    for (let j = 0; j < N.length; j++) {
      if (i === j) continue;
      const b = N[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx * dx + dz * dz > 8.5 || Math.abs(b.y - a.y) > 1.3) continue;
      if (walk(a, b)) a.nb.push({ n: j, c: Math.hypot(dx, dz, (b.y - a.y) * 1.5) });
    }
  }
  nav.built = true;
  return N.length;
}

export function nearestNode(x, y, z) {
  let best = -1, bd = Infinity;
  for (const n of nav.nodes) {
    const dy = Math.abs(n.y - y);
    if (dy > 2.2) continue;
    const d = (n.x - x) ** 2 + (n.z - z) ** 2 + dy * dy * 4;
    if (d < bd) { bd = d; best = n.id; }
  }
  return best;
}

export function findPath(from, to) {
  const N = nav.nodes;
  if (from < 0 || to < 0) return [];
  if (from === to) return [to];
  const g = new Map([[from, 0]]), prev = new Map(), closed = new Set();
  const open = [[0, from]];
  const h = (i) => Math.hypot(N[i].x - N[to].x, N[i].z - N[to].z, (N[i].y - N[to].y) * 1.5);
  const push = (it) => { open.push(it); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { let l = i * 2 + 1, r = l + 1, m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
  while (open.length) {
    const [, cur] = pop();
    if (cur === to) {
      const path = [cur]; let c = cur;
      while (prev.has(c)) { c = prev.get(c); path.push(c); }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    for (const e of N[cur].nb) {
      const ng = g.get(cur) + e.c;
      if (ng < (g.get(e.n) ?? Infinity)) { g.set(e.n, ng); prev.set(e.n, cur); push([ng + h(e.n), e.n]); }
    }
  }
  return [];
}


// ---- rendering -----------------------------------------------------------------
function canvasTex(size, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(rep, rep);
  return t;
}
const speck = (g, s, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * a})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3); } };

function makeTextures() {
  const weather = (g, s, base, seam, tint) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s); speck(g, s, 700, 0.1);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${tint},${0.04 + Math.random() * 0.06})`; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 40, 6 + Math.random() * 22, Math.random() * 3, 0, TAUC); g.fill(); }
    g.strokeStyle = seam; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);
  };
  const deck = canvasTex(256, (g, s) => { weather(g, s, '#8f9db3', 'rgba(20,30,48,.55)', '40,50,70'); g.strokeStyle = 'rgba(20,30,48,.28)'; g.lineWidth = 2; g.strokeRect(20, 20, s - 40, s - 40); g.beginPath(); g.moveTo(s / 2, 20); g.lineTo(s / 2, s - 20); g.stroke(); });
  const wall = canvasTex(256, (g, s) => { weather(g, s, '#7d8aa0', 'rgba(15,22,38,.6)', '25,35,55'); g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 24; y < s; y += 48) g.fillRect(0, y, s, 4); g.fillStyle = 'rgba(140,210,240,.28)'; g.fillRect(s / 2 - 2, 30, 4, s - 60); });
  const tower = canvasTex(256, (g, s) => { weather(g, s, '#6c7990', 'rgba(10,16,30,.65)', '20,28,46'); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 32; x < s; x += 64) g.fillRect(x, 0, 6, s); });
  const base = canvasTex(256, (g, s) => { weather(g, s, '#8898b0', 'rgba(14,22,40,.6)', '30,40,60'); g.fillStyle = 'rgba(14,22,40,.25)'; g.fillRect(s / 2 - 1, 0, 2, s); g.fillRect(0, s / 2 - 1, s, 2); });
  const post = canvasTex(128, (g, s) => { weather(g, s, '#98a5ba', 'rgba(14,22,40,.6)', '30,40,60'); });
  const rampT = canvasTex(256, (g, s) => {
    weather(g, s, '#9cadc4', 'rgba(14,22,40,.5)', '30,40,60'); g.fillStyle = 'rgba(30,50,70,.16)';
    for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - s, s); g.lineTo(i - s, s); g.fill(); }
  });
  return { deck, wall, tower, base, post, ramp: rampT };
}
const TAUC = Math.PI * 2;

function boxGeo(s, tile) {
  const w = s.x1 - s.x0, h = s.y1 - s.y0, d = s.z1 - s.z0;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
  }
  return g;
}

function prismGeo(s, tile) {
  const cs = [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]];
  const T = cs.map(([x, z]) => [x, topAt(s, x, z), z]);
  const B = cs.map(([x, z]) => [x, s.y0, z]);
  const tris = [[T[0], T[2], T[1]], [T[0], T[3], T[2]], [B[0], B[1], B[2]], [B[0], B[2], B[3]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; tris.push([B[i], B[j], T[j]], [B[i], T[j], T[i]]); }
  const pos = [], uvs = [];
  for (const t of tris) for (const p of t) { pos.push(...p); uvs.push((p[0] + p[2]) / tile, p[1] / tile + (p[2] - p[0]) * 0.02); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}


async function buildLockoutVisuals(scene, renderer, onProgress) {
  const root = new THREE.Group(); scene.add(root);
  const tex = makeTextures();
  await onProgress(0.1, 'Forging surfaces');
  const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0.04, ...o });
  const mats = {
    deck: M(tex.deck), base: M(tex.base), wall: M(tex.wall), tower: M(tex.tower), post: M(tex.post),
    ramp: M(tex.ramp, { side: THREE.DoubleSide }), rail: M(tex.wall, { color: 0xb4bfd2 }),
  };
  const world = new THREE.Group(); root.add(world);
  for (const s of solids) {
    const m = new THREE.Mesh(s.ramp ? prismGeo(s, 5) : boxGeo(s, 5), mats[s.mat] || mats.wall);
    if (!s.ramp) m.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    world.add(m);
  }
  await onProgress(0.3, 'Raising the outpost');

  // emissive trim
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const cy = glow(0x7fe6ff, 2.0), red = glow(0xff3b4a, 2.8), blue = glow(0x3b7dff, 2.8), warm = glow(0xffd9a0, 2.6);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  for (const sg of [1, -1]) {
    const tm = sg === 1 ? blue : red;
    strip(tm, sg * 28.35, 6.2, 0, 0.1, 1.6, 8);                       // base back-wall light bar
    strip(tm, sg * 28.35, 4.2, 0, 0.1, 0.12, 12.4);
    strip(tm, sg * 19.05, 5.4, 6.2, 0.1, 1.0, 0.16);                   // door frames
    strip(cy, sg * 16, 8.03, -6.45, 24, 0.04, 0.1);                    // deck edge lines
    strip(cy, sg * 16, 8.03, -4.55, 9, 0.04, 0.08);
    strip(tm, sg * 25.5, 12.03, sg * -20.9, 6.6, 0.05, 0.1);           // sniper ledge edge
    strip(cy, sg * 25.5, 8.03, sg * -7.05, 7.6, 0.04, 0.08);
  }
  strip(cy, 0, 8.03, -6.45, 24, 0.04, 0.1); strip(cy, 0, 8.03, 6.45, 24, 0.04, 0.1);
  strip(warm, 0, 7.36, 0, 5, 0.05, 3.6);                               // warm panel lighting the under-glass room
  strip(warm, -4.5, 7.36, 0, 0.1, 0.05, 6); strip(warm, 4.5, 7.36, 0, 0.1, 0.05, 6);
  // ramp side lines
  for (const s of solids) if (s.ramp && s.mat === 'ramp') {
    const rr = s.ramp, len = Math.hypot(rr.b - rr.a, rr.yb - rr.ya);
    for (const off of rr.axis === 'x' ? [s.z0, s.z1] : [s.x0, s.x1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rr.axis === 'x' ? len : 0.1, 0.05, rr.axis === 'x' ? 0.1 : len), cy);
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, cyy = (rr.ya + rr.yb) / 2 + 0.03;
      const ang = Math.atan2(rr.yb - rr.ya, Math.abs(rr.b - rr.a)) * Math.sign(rr.b - rr.a);
      if (rr.axis === 'x') { b.position.set(cx, cyy, off); b.rotation.z = ang; } else { b.position.set(off, cyy, cz); b.rotation.x = -ang; }
      world.add(b);
    }
  }
  mergeStatic(world);
  await onProgress(0.5, 'Wiring the trim');

  // the glass panel in the top-mid deck + drum canopies over each sniper ledge + cables
  const glass = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 3.6), new THREE.MeshStandardMaterial({ color: 0xa8e8ff, transparent: true, opacity: 0.5, emissive: 0x3aa8d8, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2 }));
  glass.position.set(0, 8.04, 0); root.add(glass);
  const drumMat = new THREE.MeshStandardMaterial({ map: tex.tower, color: 0xb9c4d6, roughness: 0.8, flatShading: true });
  for (const sg of [1, -1]) {
    const cx = sg * 25.5, cz = sg * -18.5;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 3.4, 12), drumMat); drum.position.set(cx, 16.5, cz); drum.castShadow = true; root.add(drum);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.3, 0.7, 12), drumMat); cap.position.set(cx, 18.5, cz); root.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.07, 4, 24), sg === 1 ? blue : red); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 15.2, cz); root.add(ring);
    const pts = [new THREE.Vector3(cx, 18.6, cz), new THREE.Vector3(cx * 0.55, 13, cz * 0.4), new THREE.Vector3(sg * 4, 10.5, sg * -5)];
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0x1b222e, roughness: 0.6 }));
    root.add(cable);
  }
  await onProgress(0.62, 'Hanging cables');

  // cave rock, snow mist below, pale light
  const mistCol = 0xcfdcec;
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a586e, flatShading: true, roughness: 1 });
  const rocks = new THREE.Group();
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = 42 + rnd() * 50, top = rnd() < 0.4;
    const g = new THREE.IcosahedronGeometry(1, 1); const sc = 9 + rnd() * 20;
    const m = new THREE.Mesh(g, rockMat); m.scale.set(sc, sc * (0.7 + rnd() * 0.9), sc); m.rotation.y = rnd() * 3;
    m.position.set(Math.cos(a) * r * 1.15, top ? 26 + rnd() * 18 : -22 + rnd() * 46, Math.sin(a) * r);
    rocks.add(m);
  }
  for (let i = 0; i < 14; i++) { // ceiling slab so the top of the cave reads as rock
    const a = (i / 14) * Math.PI * 2, m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockMat);
    m.scale.set(22, 9, 22); m.position.set(Math.cos(a) * 28, 40 + rnd() * 6, Math.sin(a) * 22); rocks.add(m);
  }
  root.add(mergeStatic(rocks));
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: mistCol, fog: false }));
  mist.position.y = -26; root.add(mist);
  const skyGeo = new THREE.SphereGeometry(300, 16, 12);
  const col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x56667e), mid = new THREE.Color(0xa9bbd2), low = new THREE.Color(0xe8f0fa);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 300; c.copy(y > 0 ? mid.clone().lerp(top, clamp(y * 1.6, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; root.add(sky);
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.03).texture;
    scene.environmentIntensity = 1.25;
    pm.dispose();
  }
  scene.fog = new THREE.Fog(mistCol, 28, 150);
  scene.background = new THREE.Color(mistCol);
  const hemi = new THREE.HemisphereLight(0xdbe8ff, 0x8a97ac, 1.2); root.add(hemi);
  const dir = new THREE.DirectionalLight(0xe6efff, 2.3);
  dir.position.set(-26, 60, 26); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -42, right: 42, top: 36, bottom: -36, near: 10, far: 150 });
  dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; root.add(dir);
  await onProgress(0.85, 'Letting it snow');

  // snowfall: a drifting point field that follows the camera
  const N = 900, sp = new Float32Array(N * 3), sv = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - 0.5) * 60; sp[i * 3 + 1] = Math.random() * 30; sp[i * 3 + 2] = (Math.random() - 0.5) * 60; sv[i] = 0.6 + Math.random() * 1.2; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false, fog: true }));
  snowPts.frustumCulled = false; root.add(snowPts);
  const snow = {
    update(dt, cam, t) {
      const p = sg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3] += Math.sin(t * 0.7 + i) * 0.25 * dt + 0.5 * dt; p[i * 3 + 1] -= sv[i] * dt;
        if (p[i * 3 + 1] < -2) p[i * 3 + 1] = 28;
      }
      sg.attributes.position.needsUpdate = true;
      snowPts.position.set(Math.round(cam.x / 30) * 30, cam.y - 12, Math.round(cam.z / 30) * 30);
    },
  };
  await onProgress(1, 'Ready');
  return { root, sky, dir, hemi, mats, glow, snow };
}

function makeNightTextures() {
  const snow = canvasTex(256, (g, s) => {
    g.fillStyle = '#d4e2f2'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '150,180,220'},${Math.random() * 0.35})`; g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 2 + Math.random() * 3); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });
  const plate = canvasTex(256, (g, s) => {
    g.fillStyle = '#58647c'; g.fillRect(0, 0, s, s); speck(g, s, 600, 0.09);
    g.strokeStyle = 'rgba(8,14,28,.7)'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4);
    g.strokeStyle = 'rgba(8,14,28,.35)'; g.lineWidth = 2; g.strokeRect(22, 22, s - 44, s - 44);
    g.fillStyle = 'rgba(127,230,255,.5)'; g.fillRect(s / 2 - 2, 30, 4, s - 60); g.fillRect(18, s / 2 - 1, 12, 2);
  });
  const crate = canvasTex(128, (g, s) => {
    g.fillStyle = '#6e7890'; g.fillRect(0, 0, s, s); speck(g, s, 200, 0.1);
    g.strokeStyle = 'rgba(10,16,30,.75)'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6); g.lineWidth = 4; g.beginPath(); g.moveTo(6, 6); g.lineTo(s - 6, s - 6); g.moveTo(s - 6, 6); g.lineTo(6, s - 6); g.stroke();
  });
  const rampT = canvasTex(256, (g, s) => {
    g.fillStyle = '#8a99b4'; g.fillRect(0, 0, s, s); speck(g, s, 400, 0.08); g.fillStyle = 'rgba(20,32,56,.22)';
    for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - s, s); g.lineTo(i - s, s); g.fill(); }
  });
  return { snow, plate, crate, ramp: rampT };
}

function haloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeSnow(root, N, spread, height, size, color = 0xffffff) {
  const sp = new Float32Array(N * 3), sv = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - 0.5) * spread; sp[i * 3 + 1] = Math.random() * height; sp[i * 3 + 2] = (Math.random() - 0.5) * spread; sv[i] = 0.6 + Math.random() * 1.4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.frustumCulled = false; root.add(pts);
  return {
    pts, extra: null,
    update(dt, cam, t) {
      const p = g.attributes.position.array;
      for (let i = 0; i < N; i++) { p[i * 3] += Math.sin(t * 0.7 + i) * 0.25 * dt + 0.5 * dt; p[i * 3 + 1] -= sv[i] * dt; if (p[i * 3 + 1] < -2) p[i * 3 + 1] = height - 2; }
      g.attributes.position.needsUpdate = true;
      pts.position.set(Math.round(cam.x / (spread / 2)) * (spread / 2), cam.y - height * 0.4, Math.round(cam.z / (spread / 2)) * (spread / 2));
      if (this.extra) this.extra(dt, t);
    },
  };
}

async function buildCryostatVisuals(scene, renderer, onProgress) {
  const root = new THREE.Group(); scene.add(root);
  const tex = makeNightTextures();
  await onProgress(0.1, 'Freezing the ground');
  const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0.08, ...o });
  const mats = {
    snow: M(tex.snow, { roughness: 0.95, metalness: 0 }), deck: M(tex.plate, { color: 0xa8b6ce }), base: M(tex.plate, { color: 0x8f9db8 }), wall: M(tex.plate, { color: 0x7784a0 }),
    tower: M(tex.plate, { color: 0x8896b2 }), post: M(tex.plate, { color: 0xa0aec6 }), pillar: M(tex.plate, { color: 0x66728c }), rail: M(tex.plate, { color: 0xb6c2d8 }),
    ramp: M(tex.ramp, { side: THREE.DoubleSide }), crate: M(tex.crate),
    ice: new THREE.MeshStandardMaterial({ color: 0xa6dcff, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.8 }),
  };
  const world = new THREE.Group(); root.add(world);
  for (const s of solids) {
    const m = new THREE.Mesh(s.ramp ? prismGeo(s, 5) : boxGeo(s, s.mat === 'snow' ? 8 : 5), mats[s.mat] || mats.wall);
    if (!s.ramp) m.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    m.castShadow = true; m.receiveShadow = true; world.add(m);
  }
  await onProgress(0.3, 'Raising the station');
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const cy = glow(0x7fe6ff, 2.2), red = glow(0xff3b4a, 2.8), blue = glow(0x3b8dff, 2.8), amber = glow(0xffc27a, 2.4);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  for (const sg of [1, -1]) {
    const tm = sg === 1 ? blue : red;
    strip(tm, sg * 29.5, 3.96, sg * -2.8, 11, 0.05, 0.1); strip(tm, sg * 24.2, 3.96, sg * 3, 0.1, 0.05, 8); strip(tm, sg * 29.5, 3.96, sg * 8.8, 8, 0.05, 0.1);   // base pad edges
    strip(tm, sg * 35.9, 4.5, sg * 3, 0.1, 1.5, 9);
    strip(cy, sg * 28, 7.92, sg * -16.2, 8, 0.05, 0.1); strip(cy, sg * 31.8, 7.92, sg * -12, 0.1, 0.05, 8);                                                        // tower parapets
    strip(tm, sg * 28, 4.5, sg * -7.9, 8, 0.1, 0.1);
    strip(amber, sg * 16, 4.44, sg * 8.1, 6, 0.05, 0.08);                                                                                                          // pod edge
  }
  for (const [x, z, w, d] of [[0, 7.05, 14, 0.1], [0, -7.05, 14, 0.1], [7.05, 0, 0.1, 14], [-7.05, 0, 0.1, 14]]) strip(cy, x, 6.03, z, w, 0.05, d);                // core deck edge
  strip(cy, 0, 8.6, 36, 74, 0.2, 0.2); strip(cy, 0, 8.6, -36, 74, 0.2, 0.2);
  for (const s of solids) if (s.ramp && s.mat === 'ramp') {
    const rr = s.ramp, len = Math.hypot(rr.b - rr.a, rr.yb - rr.ya);
    for (const off of rr.axis === 'x' ? [s.z0, s.z1] : [s.x0, s.x1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rr.axis === 'x' ? len : 0.1, 0.05, rr.axis === 'x' ? 0.1 : len), cy);
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, cyy = (rr.ya + rr.yb) / 2 + 0.03;
      const ang = Math.atan2(rr.yb - rr.ya, Math.abs(rr.b - rr.a)) * Math.sign(rr.b - rr.a);
      if (rr.axis === 'x') { b.position.set(cx, cyy, off); b.rotation.z = ang; } else { b.position.set(off, cyy, cz); b.rotation.x = -ang; }
      world.add(b);
    }
  }
  mergeStatic(world);
  await onProgress(0.5, 'Igniting the reactor');
  // reactor: glowing shell + rings above the core deck
  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 7.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  reactor.position.set(0, 9.6, 0); root.add(reactor);
  const rings = [];
  for (const y of [7.5, 9.6, 11.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(2, 0.09, 5, 20), cy); r.rotation.x = Math.PI / 2; r.position.set(0, y, 0); root.add(r); rings.push(r); }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xbff4ff, fog: false })); core.position.set(0, 9.6, 0); root.add(core);
  // lamps: pole + bulb + halo sprite (no dynamic lights)
  const halo = haloTex(), poleM = new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 0.6 });
  const lamp = (x, y, z, col = 0xbfe4ff, h = 4.2) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 5), poleM); pole.position.set(x, y + h / 2, z); root.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: col, fog: false })); bulb.position.set(x, y + h + 0.1, z); root.add(bulb);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(3.4); sp.position.copy(bulb.position); root.add(sp);
  };
  for (const [x, y, z] of [[12, 0, -7], [20, 0, -20], [22, 0, 6], [10, 0, 16], [31, 0, 22], [7, 0, -22], [26, 3, 0.5], [34, 3, 8], [4, 0, 2.4]]) { lamp(x, y, z); lamp(-x, y, -z); }
  await onProgress(0.65, 'Lighting the lamps');
  // sky: night gradient, moon, stars, aurora
  const skyGeo = new THREE.SphereGeometry(320, 18, 12), col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x02040c), mid = new THREE.Color(0x0d1a36), low = new THREE.Color(0x24406a);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 320; c.copy(y > 0 ? low.clone().lerp(mid, clamp(y * 2.4, 0, 1)).lerp(top, clamp((y - 0.3) * 1.6, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; root.add(sky);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), new THREE.MeshBasicMaterial({ color: 0xeaf0ff, fog: false })); moon.position.set(-170, 120, -190); root.add(moon);
  const mh = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0x9db8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); mh.scale.setScalar(150); mh.position.copy(moon.position); root.add(mh);
  const sN = 800, sPos = new Float32Array(sN * 3);
  for (let i = 0; i < sN; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); const y = Math.abs(u) * 0.9 + 0.1; sPos[i * 3] = Math.cos(a) * r * 300; sPos[i * 3 + 1] = y * 300; sPos[i * 3 + 2] = Math.sin(a) * r * 300; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false })));
  const auroras = [];
  for (const [ax, az, ry, hue] of [[0, -230, 0, 0x36ffb0], [-160, -120, 0.7, 0x5b8cff], [150, -150, -0.6, 0xb45bff]]) {
    const g = new THREE.PlaneGeometry(240, 70, 30, 1), pa = g.attributes.position, cc = [];
    for (let i = 0; i < pa.count; i++) { pa.setZ(i, Math.sin(pa.getX(i) * 0.04) * 14); const top_ = pa.getY(i) > 0, k = new THREE.Color(hue); if (top_) k.multiplyScalar(0.02); cc.push(k.r, k.g, k.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(ax, 110, az); m.rotation.y = ry; root.add(m); auroras.push(m);
  }
  await onProgress(0.8, 'Painting the aurora');
  // pines + distant peaks + outer snowfield
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa9bbd6, roughness: 1 })); outer.position.y = -0.7; outer.receiveShadow = true; root.add(outer);
  const treeM = new THREE.MeshStandardMaterial({ color: 0x142a3d, flatShading: true, roughness: 1 }), capM = new THREE.MeshStandardMaterial({ color: 0xc8d8ee, flatShading: true, roughness: 1 });
  const trees = new THREE.Group(); let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    let x, z; do { x = (rnd() - 0.5) * 210; z = (rnd() - 0.5) * 170; } while (Math.abs(x) < 42 && Math.abs(z) < 32);
    const h = 5 + rnd() * 7;
    for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(2.6 - k * 0.55, h * (0.5 - k * 0.1), 6), k === 2 ? capM : treeM); cn.position.set(x, h * 0.28 + k * h * 0.22, z); trees.add(cn); }
  }
  root.add(mergeStatic(trees));
  const peakM = new THREE.MeshStandardMaterial({ color: 0x0f1c30, flatShading: true, roughness: 1 });
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = 150 + rnd() * 90, h = 30 + rnd() * 60, cn = new THREE.Mesh(new THREE.ConeGeometry(26 + rnd() * 30, h, 5), peakM); cn.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r); root.add(cn); }
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.03).texture; scene.environmentIntensity = 1.1; pm.dispose();
  }
  scene.fog = new THREE.Fog(0x14264a, 26, 160); scene.background = new THREE.Color(0x0a1530);
  const hemi = new THREE.HemisphereLight(0x8fa8de, 0x2a3650, 2.1); root.add(hemi);
  const dir = new THREE.DirectionalLight(0xc4d8ff, 2.6); dir.position.set(-30, 60, -26); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -46, right: 46, top: 34, bottom: -34, near: 10, far: 150 }); dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; root.add(dir);
  const snow = makeSnow(root, 1800, 70, 30, 0.16);
  snow.extra = (dt, t) => { auroras.forEach((m, i) => { m.material.opacity = 0.42 + Math.sin(t * 0.4 + i * 2) * 0.16; m.position.x += Math.sin(t * 0.1 + i) * 0.01; }); reactor.material.opacity = 0.3 + Math.sin(t * 2) * 0.08; core.scale.setScalar(1 + Math.sin(t * 3) * 0.08); rings.forEach((r, i) => { r.rotation.z = t * (0.4 + i * 0.15); }); };
  await onProgress(1, 'Ready');
  return { root, sky, dir, hemi, mats, glow, snow };
}

// ---------- MESA visuals: low sun, warm haze, sandstone ----------
function makeDayTextures() {
  const sand = canvasTex(256, (g, s) => {
    g.fillStyle = '#d9b483'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,236,200' : '140,96,52'},${Math.random() * 0.28})`; g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 1 + Math.random() * 2); }
    g.strokeStyle = 'rgba(120,80,40,.10)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, Math.random() * s); g.bezierCurveTo(s * 0.3, Math.random() * s, s * 0.7, Math.random() * s, s, Math.random() * s); g.stroke(); }
  });
  const rock = canvasTex(256, (g, s) => {
    g.fillStyle = '#b9683f'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 22 + ((y / 22) % 3) * 6) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,40,20' : '240,170,110'},${0.12 + Math.random() * 0.14})`; g.fillRect(0, y, s, 5 + Math.random() * 9); }
    speck(g, s, 500, 0.12);
  });
  const stone = canvasTex(256, (g, s) => {
    g.fillStyle = '#cdb28c'; g.fillRect(0, 0, s, s); speck(g, s, 500, 0.1);
    g.strokeStyle = 'rgba(70,46,24,.65)'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4); g.strokeStyle = 'rgba(70,46,24,.3)'; g.lineWidth = 2; g.strokeRect(24, 24, s - 48, s - 48);
    g.fillStyle = 'rgba(255,150,60,.55)'; g.fillRect(s / 2 - 3, 30, 6, s - 60);
  });
  const crate = canvasTex(128, (g, s) => {
    g.fillStyle = '#4b5261'; g.fillRect(0, 0, s, s); speck(g, s, 200, 0.12);
    g.fillStyle = '#ff8a3a'; g.fillRect(0, s * 0.42, s, s * 0.16); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
  });
  const rampT = canvasTex(256, (g, s) => {
    g.fillStyle = '#a9835a'; g.fillRect(0, 0, s, s); speck(g, s, 400, 0.1); g.fillStyle = 'rgba(60,36,16,.25)';
    for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - s, s); g.lineTo(i - s, s); g.fill(); }
  });
  return { sand, rock, stone, crate, ramp: rampT };
}

async function buildMesaVisuals(scene, renderer, onProgress) {
  const root = new THREE.Group(); scene.add(root);
  const tex = makeDayTextures();
  await onProgress(0.15, 'Baking the sand');
  const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.04, ...o });
  const mats = {
    sand: M(tex.sand, { roughness: 1, metalness: 0 }), rock: M(tex.rock), tower: M(tex.stone, { color: 0xe8d6bc }), base: M(tex.stone), wall: M(tex.rock),
    post: M(tex.stone, { color: 0xf3e2c8 }), pillar: M(tex.stone, { color: 0xb59a76 }), rail: M(tex.crate, { color: 0xc8ccd6 }), ramp: M(tex.ramp, { side: THREE.DoubleSide }), crate: M(tex.crate),
  };
  const world = new THREE.Group(); root.add(world);
  for (const s of solids) {
    const m = new THREE.Mesh(s.ramp ? prismGeo(s, 5) : boxGeo(s, s.mat === 'sand' ? 8 : 5), mats[s.mat] || mats.wall);
    if (!s.ramp) m.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    m.castShadow = true; m.receiveShadow = true; world.add(m);
  }
  await onProgress(0.4, 'Raising the spires');
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const red = glow(0xff3b4a, 2.8), blue = glow(0x3b8dff, 2.8), amber = glow(0xffa24a, 2.6);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  for (const sg of [1, -1]) {
    const tm = sg === 1 ? blue : red;
    strip(tm, sg * 29.5, 3.02, sg * -5.9, 11, 0.05, 0.12); strip(tm, sg * 24.1, 3.02, sg * -2, 0.12, 0.05, 8); strip(tm, sg * 34.9, 3.5, 0, 0.12, 1.2, 12);
    strip(amber, sg * 24, 8.04, sg * -13, 8, 0.05, 0.1); strip(amber, sg * 15, 3.02, sg * 10.2, 6, 0.05, 0.1);
  }
  for (const [x, z, w, d] of [[0, 8.05, 16, 0.1], [0, -8.05, 16, 0.1], [8.05, 0, 0.1, 16], [-8.05, 0, 0.1, 16]]) strip(amber, x, 4.03, z, w, 0.05, d);
  mergeStatic(world);
  // obelisk glow on the plateau
  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 7, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  obelisk.position.set(0, 7.5, 0); obelisk.rotation.y = Math.PI / 4; root.add(obelisk);
  const halo = haloTex(); const glowTex = halo;
  // sky: warm gradient + low sun with a big halo
  const skyGeo = new THREE.SphereGeometry(320, 18, 12), col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x27336e), mid = new THREE.Color(0xc4626c), low = new THREE.Color(0xffb46a);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 320; c.copy(y > 0 ? low.clone().lerp(mid, clamp(y * 3, 0, 1)).lerp(top, clamp((y - 0.18) * 2.2, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; root.add(sky);
  const sunPos = new THREE.Vector3(-150, 42, -200);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(11, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff0cc, fog: false })); sun.position.copy(sunPos); root.add(sun);
  const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa860, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sh.scale.setScalar(240); sh.position.copy(sunPos); root.add(sh);
  await onProgress(0.7, 'Setting the sun');
  // outer desert, distant buttes, boulders
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc99a68, roughness: 1 })); outer.position.y = -0.7; outer.receiveShadow = true; root.add(outer);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const butteM = new THREE.MeshStandardMaterial({ color: 0x8e4a34, flatShading: true, roughness: 1 }), capM = new THREE.MeshStandardMaterial({ color: 0xc78257, flatShading: true, roughness: 1 });
  const buttes = new THREE.Group();
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = 120 + rnd() * 110, h = 22 + rnd() * 46, rad = 10 + rnd() * 16; const b = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.8, rad, h, 7), butteM); b.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r); buttes.add(b); const cp = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.85, rad * 0.8, 3, 7), capM); cp.position.set(b.position.x, h - 2, b.position.z); buttes.add(cp); }
  for (let i = 0; i < 70; i++) { let x, z; do { x = (rnd() - 0.5) * 220; z = (rnd() - 0.5) * 170; } while (Math.abs(x) < 42 && Math.abs(z) < 32); const s = 1 + rnd() * 3.4; const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), butteM); b.position.set(x, s * 0.5, z); b.rotation.set(rnd() * 3, rnd() * 3, 0); buttes.add(b); }
  root.add(mergeStatic(buttes));
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.03).texture; scene.environmentIntensity = 1.0; pm.dispose();
  }
  scene.fog = new THREE.Fog(0xe0a274, 30, 170); scene.background = new THREE.Color(0xf0a86a);
  const hemi = new THREE.HemisphereLight(0xffd7ae, 0x7a5638, 2.0); root.add(hemi);
  const dir = new THREE.DirectionalLight(0xffc98a, 3.4); dir.position.set(-34, 40, -46); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -46, right: 46, top: 34, bottom: -34, near: 10, far: 160 }); dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; root.add(dir);
  const snow = makeSnow(root, 1100, 70, 22, 0.13, 0xffdcae);
  snow.extra = (dt, t) => { obelisk.material.opacity = 0.26 + Math.sin(t * 1.6) * 0.08; };
  await onProgress(1, 'Ready');
  return { root, sky, dir, hemi, mats, glow, snow };
}

// ---------- HALCYON visuals: violet dusk, a wounded moon, pale ruin marble with gold inlay ----------
function makeRuinTextures() {
  const veins = (g, s, n) => { g.strokeStyle = 'rgba(90,80,120,.16)'; g.lineWidth = 1.5; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(Math.random() * s, 0); g.bezierCurveTo(Math.random() * s, s * 0.3, Math.random() * s, s * 0.7, Math.random() * s, s); g.stroke(); } };
  const marble = canvasTex(256, (g, s) => { g.fillStyle = '#d7d0e2'; g.fillRect(0, 0, s, s); speck(g, s, 600, 0.08); veins(g, s, 8); g.strokeStyle = 'rgba(60,44,90,.55)'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4); g.fillStyle = 'rgba(232,190,110,.7)'; g.fillRect(0, s * 0.46, s, 5); });
  const plinth = canvasTex(256, (g, s) => { g.fillStyle = '#bdb4d0'; g.fillRect(0, s / 2 - 0, s, s); g.fillStyle = '#c6bfd8'; g.fillRect(0, 0, s, s); speck(g, s, 500, 0.1); veins(g, s, 5); g.strokeStyle = 'rgba(60,44,90,.6)'; g.lineWidth = 3; g.strokeRect(2, 2, s - 4, s - 4); g.strokeStyle = 'rgba(232,190,110,.85)'; g.lineWidth = 3; g.strokeRect(30, 30, s - 60, s - 60); g.beginPath(); g.moveTo(30, 30); g.lineTo(s - 30, s - 30); g.moveTo(s - 30, 30); g.lineTo(30, s - 30); g.stroke(); });
  const column = canvasTex(128, (g, s) => { g.fillStyle = '#a99fc0'; g.fillRect(0, 0, s, s); speck(g, s, 300, 0.12); g.fillStyle = 'rgba(40,28,64,.3)'; for (let x = 8; x < s; x += 22) g.fillRect(x, 0, 5, s); g.fillStyle = 'rgba(232,190,110,.8)'; g.fillRect(0, s * 0.1, s, 4); g.fillRect(0, s * 0.86, s, 4); });
  const floor = canvasTex(256, (g, s) => { g.fillStyle = '#7d7391'; g.fillRect(0, 0, s, s); speck(g, s, 900, 0.1); g.strokeStyle = 'rgba(20,14,36,.55)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3); g.strokeStyle = 'rgba(20,14,36,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke(); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(50,90,60,.12)'; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 18 + Math.random() * 30, 8 + Math.random() * 16, Math.random() * 3, 0, TAUC); g.fill(); } });
  const rubble = canvasTex(128, (g, s) => { g.fillStyle = '#6e6479'; g.fillRect(0, 0, s, s); speck(g, s, 400, 0.18); g.strokeStyle = 'rgba(15,10,28,.6)'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(Math.random() * s, Math.random() * s); g.lineTo(Math.random() * s, Math.random() * s); g.stroke(); } });
  const bridge = canvasTex(256, (g, s) => { g.fillStyle = '#3a3448'; g.fillRect(0, 0, s, s); speck(g, s, 500, 0.1); g.fillStyle = 'rgba(232,190,110,.75)'; g.fillRect(0, 0, s, 8); g.fillRect(0, s - 8, s, 8); g.fillStyle = 'rgba(160,130,255,.5)'; g.fillRect(s / 2 - 2, 20, 4, s - 40); });
  const rampT = canvasTex(256, (g, s) => { g.fillStyle = '#9188a6'; g.fillRect(0, 0, s, s); speck(g, s, 400, 0.1); g.fillStyle = 'rgba(40,28,64,.22)'; for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - s, s); g.lineTo(i - s, s); g.fill(); } });
  return { marble, plinth, column, floor, rubble, bridge, ramp: rampT };
}

async function buildHalcyonVisuals(scene, renderer, onProgress) {
  const root = new THREE.Group(); scene.add(root);
  const tex = makeRuinTextures();
  await onProgress(0.15, 'Laying the marble');
  const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0.06, ...o });
  const mats = {
    floor: M(tex.floor, { roughness: 0.95 }), wall: M(tex.rubble), ruin: M(tex.marble), plinth: M(tex.plinth), column: M(tex.column), spire: M(tex.marble, { color: 0xe6dcf2 }),
    rubble: M(tex.rubble), bridge: M(tex.bridge, { metalness: 0.3, roughness: 0.55 }), shard: M(tex.column, { color: 0xc9b8ff }), ramp: M(tex.ramp, { side: THREE.DoubleSide }),
  };
  const world = new THREE.Group(); root.add(world);
  for (const so of solids) {
    const m = new THREE.Mesh(so.ramp ? prismGeo(so, 5) : boxGeo(so, so.mat === 'floor' ? 8 : 5), mats[so.mat] || mats.wall);
    if (!so.ramp) m.position.set((so.x0 + so.x1) / 2, (so.y0 + so.y1) / 2, (so.z0 + so.z1) / 2);
    m.castShadow = true; m.receiveShadow = true; world.add(m);
  }
  await onProgress(0.4, 'Lighting the inlay');
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const red = glow(0xff3b6a, 2.8), blue = glow(0x4a8dff, 2.8), gold = glow(0xffc46a, 2.6), violet = glow(0xa070ff, 3);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  for (const sg of [1, -1]) {
    const tm = sg === 1 ? blue : red;
    strip(tm, sg * 30.5, 2.62, 0, 10, 0.05, 0.12); strip(tm, sg * 35.8, 4, sg * -4.5, 0.12, 5, 0.12); strip(tm, sg * 35.8, 4, sg * 4.5, 0.12, 5, 0.12);
    strip(gold, sg * 25, 9.02, sg * -19, 6, 0.05, 0.1); strip(gold, sg * 15.5, 3.62, sg * 12.05, 9, 0.05, 0.1); strip(violet, 0, 3.02, sg * 13, 8, 0.05, 0.1);
  }
  strip(violet, 0, 4.22, 2.52, 24, 0.05, 0.1); strip(violet, 0, 4.22, -2.52, 24, 0.05, 0.1);
  mergeStatic(world);
  // the ring that hangs over the bridge
  const rift = new THREE.Group(); rift.position.set(0, 15, 0); root.add(rift);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xb08cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.07, 6, 64), ringM), r2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.05, 6, 64), ringM); r2.rotation.x = 1.1; rift.add(r1, r2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 15, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xa070ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); beam.position.y = -7.5; rift.add(beam);
  const glowTex = haloTex();
  // sky: violet to amber, a huge cracked moon with a halo ring, stars
  const skyGeo = new THREE.SphereGeometry(320, 18, 12), col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x2a1a62), mid = new THREE.Color(0x9a4a94), low = new THREE.Color(0xffa060);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 320; c.copy(y > 0 ? low.clone().lerp(mid, clamp(y * 3.2, 0, 1)).lerp(top, clamp((y - 0.16) * 2.1, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; root.add(sky);
  const stars = []; for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, e = 0.18 + Math.random() * 1.2, r = 300; stars.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false })));
  const moonPos = new THREE.Vector3(-120, 95, -230);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(58, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf1ecff, fog: false })); moon.position.copy(moonPos); root.add(moon);
  for (const [rot, rad, op, w] of [[0.5, 84, 0.5, 1.5], [1.15, 96, 0.3, 1]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, w, 6, 90, 5.2), new THREE.MeshBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    ring.position.copy(moonPos); ring.rotation.set(rot, 0.4, 0.2); root.add(ring);
  }
  const mh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xb8a4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); mh.scale.setScalar(360); mh.position.copy(moonPos); root.add(mh);
  const sunPos = new THREE.Vector3(160, 22, 210);
  const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a5a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sh.scale.setScalar(300); sh.position.copy(sunPos); root.add(sh);
  await onProgress(0.7, 'Raising the skyline');
  // outer ground, fallen skyline, drifting debris
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a3f5e, roughness: 1 })); outer.position.y = -0.7; outer.receiveShadow = true; root.add(outer);
  let seed = 23; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const towerM = new THREE.MeshStandardMaterial({ color: 0x3a2f4d, flatShading: true, roughness: 1 }), capM = new THREE.MeshStandardMaterial({ color: 0x8a76a8, flatShading: true, roughness: 1 });
  const city = new THREE.Group();
  for (let i = 0; i < 44; i++) {
    const a = rnd() * 6.283, r = 95 + rnd() * 130, h = 16 + rnd() * 62, w = 6 + rnd() * 12;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (0.6 + rnd() * 0.8)), towerM); b.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r); b.rotation.y = rnd() * 3; b.rotation.z = (rnd() - 0.5) * 0.12; city.add(b);
    if (rnd() < 0.5) { const cp = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 1.6, w * 1.1), capM); cp.position.set(b.position.x, h - 2.2, b.position.z); cp.rotation.copy(b.rotation); city.add(cp); }
  }
  for (let i = 0; i < 46; i++) { let x, z; do { x = (rnd() - 0.5) * 240; z = (rnd() - 0.5) * 180; } while (Math.abs(x) < 42 && Math.abs(z) < 32); const s2 = 1 + rnd() * 3.6; const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s2, 0), towerM); b.position.set(x, s2 * 0.5, z); b.rotation.set(rnd() * 3, rnd() * 3, 0); city.add(b); }
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = 50 + rnd() * 70, s2 = 1.5 + rnd() * 5; const b = new THREE.Mesh(new THREE.OctahedronGeometry(s2, 0), capM); b.position.set(Math.cos(a) * r, 18 + rnd() * 38, Math.sin(a) * r); b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); city.add(b); }
  root.add(mergeStatic(city));
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.03).texture; scene.environmentIntensity = 0.9; pm.dispose();
  }
  scene.fog = new THREE.Fog(0x8f5f96, 34, 180); scene.background = new THREE.Color(0xc07a7a);
  const hemi = new THREE.HemisphereLight(0xc4b4ff, 0x6a4a5e, 1.9); root.add(hemi);
  const dir = new THREE.DirectionalLight(0xffb480, 3.1); dir.position.set(40, 34, 48); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -46, right: 46, top: 34, bottom: -34, near: 10, far: 160 }); dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; root.add(dir);
  const rim = new THREE.DirectionalLight(0x9cb0ff, 1.1); rim.position.set(-40, 30, -50); root.add(rim);
  const snow = makeSnow(root, 900, 70, 22, 0.1, 0xffe0b8);
  snow.extra = (dt, t) => { r1.rotation.z += dt * 0.6; r2.rotation.y += dt * 0.9; r2.rotation.z -= dt * 0.4; rift.position.y = 15 + Math.sin(t * 0.8) * 0.4; beam.material.opacity = 0.2 + Math.sin(t * 2.2) * 0.06; };
  await onProgress(1, 'Ready');
  return { root, sky, dir, hemi, mats, glow, snow };
}

let current = null;
export function disposeMap(scene) {
  if (!current) return;
  scene.remove(current.root);
  current.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
  current = null;
}

// Load (or reload) a map: data, nav graph, then meshes/lights/sky. Returns the visual handle used by the game loop.
export async function loadMap(scene, renderer, id, onProgress = () => {}) {
  disposeMap(scene);
  defineMap(id); buildNav();
  current = id === 'cryostat' ? await buildCryostatVisuals(scene, renderer, onProgress) : id === 'mesa' ? await buildMesaVisuals(scene, renderer, onProgress) : id === 'halcyon' ? await buildHalcyonVisuals(scene, renderer, onProgress) : await buildLockoutVisuals(scene, renderer, onProgress);
  return current;
}
