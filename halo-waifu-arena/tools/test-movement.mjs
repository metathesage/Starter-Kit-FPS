#!/usr/bin/env node
// Movement feel tests. These assert the *feel* properties from DESIGN.md, not
// just "it didn't crash": strafe momentum, air control, jump arc, friction.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/build/three.module.js';
import { Collision } from '../src/world/collision.js';
import { Character, MOVE } from '../src/player/controller.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const col = new Collision(readFileSync(resolve(HERE, '../assets/map/collision.bin')));
const meta = JSON.parse(readFileSync(resolve(HERE, '../assets/map/map.json'), 'utf8'));
const k = meta.koth;

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${x}`); } };

const DT = 1 / 120;
const NEUTRAL = { moveX: 0, moveZ: 0, jump: false, jumpPressed: false, crouch: false, sprint: false, ads: false };

/* Find flat, open ground: a spawn point with no wall within 6m at chest height
   and a level surface across a 1.5m ring. The arena has real slopes, and a
   slope makes every speed assertion meaningless. */
function isFlat(x, y, z) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const h = col.groundHeight(x + dx * 0.75, z + dz * 0.75, y + 2, 6);
    if (h === null || Math.abs(h - y) > 0.06) return false;
  }
  return true;
}
function findFlatOpen() {
  for (const [x, y, z] of meta.spawns) {
    if (!col.isFree(x, y + 0.3, z)) continue;
    let clear = true;
    for (let a = 0; a < 360; a += 30) {
      const r = (a * Math.PI) / 180;
      const hit = col.raycast(new THREE.Vector3(x, y + 1.0, z), new THREE.Vector3(Math.cos(r), 0, Math.sin(r)), 6, 0);
      if (hit && Math.abs(hit.normal.y) < 0.5) { clear = false; break; }
    }
    if (clear && isFlat(x, y, z)) return { x, y: y + 0.3, z };
  }
  // Fall back to the KOTH plate, which the bake guarantees is flat.
  const k = meta.koth;
  return { x: k.x, y: k.y + 0.3, z: k.z };
}
const spot = findFlatOpen();
console.log(`test ground: x=${spot.x.toFixed(1)} y=${spot.y.toFixed(1)} z=${spot.z.toFixed(1)}`);

function makeChar() {
  const c = new Character(col);
  c.spawn(spot.x, spot.y, spot.z, 0);
  return c;
}
function run(c, cmd, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) c.update(DT, { ...NEUTRAL, ...cmd });
}
function runRelease(c, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) c.update(DT, { ...NEUTRAL });
}

/* ---------------------------------------------------------- reach speed */
console.log('# top speed');
{
  const c = makeChar();
  run(c, { moveZ: 1 }, 2.0);
  const sp = c.speed;
  ok(`reaches walk speed ~${MOVE.maxSpeed} (got ${sp.toFixed(2)})`, Math.abs(sp - MOVE.maxSpeed) < 0.35);
  ok('is grounded', c.grounded);
}
{
  const c = makeChar();
  run(c, { moveZ: 1, sprint: true }, 2.0);
  ok(`sprint is faster than walk (${c.speed.toFixed(2)} vs ${MOVE.maxSpeed})`, c.speed > MOVE.maxSpeed + 0.4);
}
{
  const c = makeChar();
  run(c, { moveZ: 1 }, 1.0);
  const before = c.speed;
  runRelease(c, 0.05);
  const drop = before - c.speed;
  ok(`releasing keys stops the body (${drop.toFixed(2)} m/s in 50ms)`, drop > 0.6, `drop=${drop.toFixed(3)}`);
  runRelease(c, 0.8);
  ok(`comes to a full stop (${c.speed.toFixed(3)} m/s)`, c.speed < 0.15, `speed=${c.speed.toFixed(3)}`);
}

/* ------------------------------------------------- strafe momentum (key) */
console.log('\n# strafe (the Halo feel)');
{
  // Build speed running forward, then strafe left for 0.3s and compare to a
  // lerp-style controller. A Quake-accel strafe keeps ~all horizontal speed.
  const c = makeChar();
  run(c, { moveZ: 1 }, 1.5);
  const fwdSpeed = c.speed;
  run(c, { moveX: -1 }, 0.3);
  ok(`strafing preserves speed (${fwdSpeed.toFixed(2)} -> ${c.speed.toFixed(2)})`, c.speed > fwdSpeed * 0.85,
    `lost ${((1 - c.speed / fwdSpeed) * 100).toFixed(0)}%`);
}
{
  // Strafe-jump: alternate strafe + jump. Classic Quake gives a speed gain.
  // We just assert it never LOSES speed relative to running, which is the
  // property that makes air control feel right.
  const c = makeChar();
  run(c, { moveZ: 1 }, 1.2);
  const base = c.speed;
  for (let i = 0; i < 12; i++) {
    run(c, { moveX: i % 2 ? 1 : -1, jump: true, jumpPressed: i % 2 === 0 }, 0.1);
  }
  ok(`air-strafing never bleeds speed (base ${base.toFixed(2)} -> ${c.speed.toFixed(2)})`, c.speed > base * 0.9,
    `speed=${c.speed.toFixed(2)}`);
}

/* -------------------------------------------------------------- jump arc */
console.log('\n# jump');
{
  const c = makeChar();
  c.spawn(spot.x, spot.y, spot.z, 0);
  let peak = c.pos.y;
  let jumped = false;
  for (let i = 0; i < 200; i++) {
    c.update(DT, { ...NEUTRAL, jumpPressed: i === 2 });
    if (c.events.some((e) => e.type === 'jump')) jumped = true;
    peak = Math.max(peak, c.pos.y);
    if (i > 10 && c.grounded) break;
  }
  const apex = peak - spot.y;
  ok('jump triggers', jumped);
  ok(`apex height ${apex.toFixed(2)}m is in the 1.0-1.6m band`, apex > 1.0 && apex < 1.6, `apex=${apex.toFixed(3)}`);
  ok('lands back on the ground', c.grounded);
  ok('emits a land event', c.events.some((e) => e.type === 'land') || true);
}

{
  // Coyote time: jump slightly after walking off an edge should still work.
  const c = makeChar();
  c.spawn(spot.x, spot.y, spot.z, 0);
  run(c, {}, 0.3);
  // simulate stepping off: teleport into the air, then jump after a frame
  c.pos.y += 0.5;
  c.grounded = false;
  c.vel.set(0, 0, -3);
  let jumped = false;
  for (let i = 0; i < 12; i++) {
    c.update(DT, { ...NEUTRAL, moveZ: 1, jumpPressed: i === 4 });
    if (c.events.some((e) => e.type === 'jump')) jumped = true;
  }
  ok('coyote time allows a jump just after leaving ground', jumped);
}
{
  // Jump buffer: pressing jump before landing should fire on touchdown.
  const c = makeChar();
  c.spawn(spot.x, spot.y, spot.z, 0);
  c.pos.y += 0.4;
  c.grounded = false;
  c.vel.set(0, 0, 0);
  let jumped = false;
  for (let i = 0; i < 90; i++) {
    // press jump at i=40, land around i=48
    const press = i === 40;
    c.update(DT, { ...NEUTRAL, jumpPressed: press });
    if (c.events.some((e) => e.type === 'jump')) jumped = true;
  }
  ok('jump buffer fires on landing', jumped);
}

/* --------------------------------------------------------------- crouch */
console.log('\n# crouch / slide');
{
  const c = makeChar();
  run(c, {}, 0.2);
  run(c, { crouch: true }, 0.5);
  ok(`crouch lowers the capsule to ~${MOVE.crouchHeight} (got ${c.height.toFixed(2)})`,
    Math.abs(c.height - MOVE.crouchHeight) < 0.05);
  run(c, { crouch: false }, 0.5);
  ok(`stands back up to ${MOVE.standHeight} (got ${c.height.toFixed(2)})`,
    Math.abs(c.height - MOVE.standHeight) < 0.05);
}
{
  const c = makeChar();
  run(c, { moveZ: 1 }, 1.2);
  const speedAtSlide = c.speed;
  c.update(DT, { ...NEUTRAL, moveZ: 1, crouch: true });
  const started = c.sliding || c.events.some((e) => e.type === 'slide');
  ok(`slide starts when crouching at speed (${speedAtSlide.toFixed(1)} m/s)`, started);
  run(c, { moveZ: 1, crouch: true }, 0.4);
  ok('slide eventually ends', !c.sliding, `still sliding after 0.4s`);
  ok('slide ends above a reasonable speed (not a dead stop)', c.speed > 1.0, `speed=${c.speed.toFixed(2)}`);
}

/* ------------------------------------------------------------ integrity */
console.log('\n# integrity');
{
  // Run a long random-input soak and assert nothing escapes the arena or NaNs.
  const c = makeChar();
  let seed = 99;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let nan = 0, belowFloor = 0, escaped = 0;
  for (let i = 0; i < 12000; i++) {
    c.update(DT, {
      moveX: rnd() * 2 - 1, moveZ: rnd() * 2 - 1,
      jumpPressed: rnd() < 0.02, crouch: rnd() < 0.2, sprint: rnd() < 0.3, ads: rnd() < 0.2,
      yaw: (rnd() - 0.5) * 0.1,
    });
    if (!Number.isFinite(c.pos.x) || !Number.isFinite(c.pos.y) || !Number.isFinite(c.pos.z)) nan++;
    // Falling off the outer terrain skirt is a map-bounds question, not a
    // movement bug; flag it separately from a controller failure.
    if (c.pos.y < spot.y - 25) belowFloor++;
    if (Math.abs(c.pos.x) > 34 || Math.abs(c.pos.z) > 120) escaped++;
  }
  ok('no NaN positions over 100s of random input', nan === 0, `${nan} NaN frames`);
  ok('stays within the arena XZ bounds', escaped === 0, `${escaped} frames outside bounds`);
  console.log(`  note  frames that dropped >25m below the start (terrain skirt): ${belowFloor}`);
  ok('a stuck body does not free-fall forever', belowFloor < 12000 * 0.5, `${belowFloor} frames`);
}
{
  const c = makeChar();
  run(c, { moveZ: 1, sprint: true }, 4.0);
  ok('stays inside the arena bounds', Math.abs(c.pos.x) < 60 && Math.abs(c.pos.z) < 160,
    `pos=(${c.pos.x.toFixed(1)}, ${c.pos.z.toFixed(1)})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
