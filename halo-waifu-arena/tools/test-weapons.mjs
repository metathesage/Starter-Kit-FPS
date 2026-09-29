#!/usr/bin/env node
// Weapon tests: fire rate, deterministic recoil, hitbox zones, spread, reload.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three/build/three.module.js';
import { Collision } from '../src/world/collision.js';
import { WeaponSystem, WEAPONS, WEAPON_ORDER, HITBOX } from '../src/player/weapons.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const col = new Collision(readFileSync(resolve(HERE, '../assets/map/collision.bin')));
const meta = JSON.parse(readFileSync(resolve(HERE, '../assets/map/map.json'), 'utf8'));
const k = meta.koth;

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${x}`); } };

const DT = 1 / 120;

function makeTarget(x, y, z, name = 'bot') {
  return {
    pos: new THREE.Vector3(x, y, z),
    alive: true,
    hp: 100,
    def: WEAPONS.rifle,
    hits: [],
    name,
    takeDamage(amount, zone, dir, point, from) {
      this.hp -= amount;
      this.hits.push({ amount, zone, point: point.clone(), from });
      if (this.hp <= 0) this.alive = false;
    },
  };
}

// Open ground so the world never blocks the shot.
const shooterEye = new THREE.Vector3(k.x, k.y + 1.58, k.z - 4);
const owner = { pos: shooterEye.clone(), vel: new THREE.Vector3(), grounded: true, isCrouching: false, speed: 0 };

function mk(weaponKey = null) {
  const w = new WeaponSystem(col);
  w.owner = owner;
  if (weaponKey) {
    const i = WEAPON_ORDER.indexOf(weaponKey);
    w.current = i;
    w.slot.shotIndex = 0;
  }
  return w;
}
const idle = { fire: false, firePressed: false, aim: false, reloadPressed: false, time: 0 };

/* ------------------------------------------------------------ fire rate */
console.log('# fire rate');
for (const key of WEAPON_ORDER) {
  const d = WEAPONS[key];
  const w = mk(key);
  let t = 0, fired = 0;
  const target = makeTarget(shooterEye.x, k.y, shooterEye.z + 20);
  for (let i = 0; i < 240; i++) {
    t += DT;
    const ev = w.update(DT, { ...idle, time: t, fire: d.auto, firePressed: !d.auto }, owner, [target], shooterEye, 0, 0);
    for (const e of ev) if (e.type === 'fire') fired++;
    if (w.ammo === 0) break;
  }
  const expected = d.auto ? Math.floor((t * d.rpm) / 60) : 1;
  if (d.auto) {
    ok(`${key} auto fires at ~${d.rpm} rpm (${fired} in ${t.toFixed(2)}s)`, Math.abs(fired - expected) <= 2,
      `got ${fired}, expected ~${expected}`);
  } else {
    // A semi-auto gun held down must fire ONCE, not once per rate interval.
    // (firePressed stays true for every tick here, which is a "player is
    // holding the trigger" edge case the weapon must swallow after one shot.)
    ok(`${key} semi fires once even when the trigger is held (fired ${fired})`, fired === 1, `got ${fired}`);
  }
}

/* ------------------------------------------------- deterministic recoil */
console.log('\n# deterministic recoil pattern');
{
  const runBurst = () => {
    const w = mk('rifle');
    const target = makeTarget(1e6, k.y, 1e6);   // never hit
    let t = 0;
    const pitches = [];
    for (let i = 0; i < 400; i++) {
      t += DT;
      const ev = w.update(DT, { ...idle, time: t, fire: true }, owner, [target], shooterEye, 0, 0);
      for (const e of ev) if (e.type === 'fire') pitches.push(w.camPitch);
      if (w.ammo === 0) break;
    }
    return pitches;
  };
  const a = runBurst();
  const b = runBurst();
  ok(`two identical bursts produce identical recoil (${a.length} shots)`, a.length === b.length && a.length > 5 && a.every((v, i) => Math.abs(v - b[i]) < 1e-9));
  ok('recoil climbs through the burst', a[0] < a[Math.floor(a.length / 2)], `${a[0].toFixed(2)} -> ${a[Math.floor(a.length / 2)].toFixed(2)}`);
  const unique = new Set(a.map((v) => v.toFixed(6)));
  ok('pattern is not a constant (it is a real pattern)', unique.size > 3, `${unique.size} distinct values`);
}
{
  // Recoil must recover toward zero when the player stops shooting.
  const w = mk('rifle');
  const target = makeTarget(1e6, k.y, 1e6);
  let t = 0;
  for (let i = 0; i < 40; i++) { t += DT; w.update(DT, { ...idle, time: t, fire: true }, owner, [target], shooterEye, 0, 0); }
  const peak = w.camPitch;
  for (let i = 0; i < 300; i++) { t += DT; w.update(DT, { ...idle, time: t }, owner, [target], shooterEye, 0, 0); }
  ok(`recoil recovers after release (${peak.toFixed(2)} -> ${w.camPitch.toFixed(3)})`, w.camPitch < peak * 0.25,
    `peak=${peak.toFixed(2)} now=${w.camPitch.toFixed(3)}`);
}

/* ------------------------------------------------------------- hitboxes */
console.log('\n# hitbox zones');
{
  // Use the pistol (semi-auto) so `firePressed` is the correct trigger.
  const test = (aimY, label, wantZone) => {
    const w = mk('pistol');
    w.spread = 0;                      // remove randomness for a clean test
    const eye = new THREE.Vector3(k.x, aimY, k.z - 5);
    const target = makeTarget(k.x, k.y, k.z);
    let t = 0, got = null;
    for (let i = 0; i < 5; i++) {
      t += DT;
      const ev = w.update(DT, { ...idle, time: t, firePressed: true }, owner, [target], eye, Math.PI, 0);
      for (const e of ev) if (e.type === 'fire') {
        for (const tr of e.traces) if (tr.type === 'character') got = tr.zone;
      }
    }
    ok(`aiming at ${label} hits the ${wantZone} zone (got ${got})`, got === wantZone);
  };
  test(k.y + HITBOX.head.y, 'head height', 'head');
  test(k.y + HITBOX.torso.y, 'chest height', 'torso');
  test(k.y + HITBOX.legs.y, 'leg height', 'legs');
}
{
  // Headshots must do more damage than body shots.
  const dmg = (aimY) => {
    const w = mk('pistol');
    w.spread = 0;
    const eye = new THREE.Vector3(k.x, aimY, k.z - 5);
    const target = makeTarget(k.x, k.y, k.z);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t += DT;
      w.update(DT, { ...idle, time: t, firePressed: true }, owner, [target], eye, Math.PI, 0);
    }
    return target.hits.length ? target.hits[0].amount : 0;
  };
  const body = dmg(k.y + HITBOX.torso.y);
  const head = dmg(k.y + HITBOX.head.y);
  ok(`headshot damage > body damage (${head.toFixed(0)} > ${body.toFixed(0)})`, head > body * 1.5);
  ok('body damage equals the weapon base', Math.abs(body - WEAPONS.pistol.damage) < 0.01, `body=${body}`);
}
{
  // A full auto mag into the torso should kill a 100hp target.
  const w = mk('rifle');
  w.spread = 0;
  const eye = new THREE.Vector3(k.x, k.y + HITBOX.torso.y, k.z - 5);
  const target = makeTarget(k.x, k.y, k.z);
  let t = 0;
  for (let i = 0; i < 300 && target.alive; i++) {
    t += DT;
    w.update(DT, { ...idle, time: t, fire: true }, owner, [target], eye, Math.PI, 0);
  }
  ok(`a mag dump kills (${WEAPONS.rifle.damage} dmg x ${WEAPONS.rifle.magSize} vs 100hp)`, !target.alive, `hp left ${target.hp}`);
}

/* --------------------------------------------------------------- spread */
console.log('\n# spread');
{
  const w = mk('smg');
  const target = makeTarget(1e6, k.y, 1e6);
  let t = 0;
  let maxSpread = 0;
  for (let i = 0; i < 200; i++) {
    t += DT;
    w.update(DT, { ...idle, time: t, fire: true }, owner, [target], shooterEye, 0, 0);
    maxSpread = Math.max(maxSpread, w.spread);
  }
  ok(`sustained fire blooms the cone (${maxSpread.toFixed(2)} deg)`, maxSpread > 0.5);
  for (let i = 0; i < 300; i++) { t += DT; w.update(DT, { ...idle, time: t }, owner, [target], shooterEye, 0, 0); }
  ok('cone recovers when not firing', w.spread < maxSpread * 0.35, `now ${w.spread.toFixed(3)}`);
}
{
  // ADS must tighten the cone.
  const measure = (aim) => {
    const w = mk('rifle');
    w.spread = 0;
    const target = makeTarget(1e6, k.y, 1e6);
    let t = 0;
    for (let i = 0; i < 120; i++) { t += DT; w.update(DT, { ...idle, time: t, aim }, owner, [target], shooterEye, 0, 0); }
    let sum = 0, n = 0;
    for (let i = 0; i < 200; i++) {
      t += DT;
      const ev = w.update(DT, { ...idle, time: t, fire: true, aim }, owner, [target], shooterEye, 0, 0);
      for (const e of ev) if (e.type === 'fire') { sum += e.spread; n++; }
    }
    return { ads: w.ads, mean: n ? sum / n : 0 };
  };
  const hip = measure(false);
  const aimed = measure(true);
  ok(`ADS fully engages (${aimed.ads.toFixed(2)})`, aimed.ads > 0.95);
  ok(`ADS tightens the cone (hip ${hip.mean.toFixed(2)} deg -> ADS ${aimed.mean.toFixed(2)} deg)`,
    aimed.mean < hip.mean * 0.6, `hip=${hip.mean.toFixed(3)} ads=${aimed.mean.toFixed(3)}`);
}

/* --------------------------------------------------------------- reload */
console.log('\n# reload');
{
  const w = mk('rifle');
  const target = makeTarget(1e6, k.y, 1e6);
  let t = 0;
  for (let i = 0; i < 400; i++) { t += DT; w.update(DT, { ...idle, time: t, fire: true }, owner, [target], shooterEye, 0, 0); if (w.ammo === 0) break; }
  ok('mag empties', w.ammo === 0, `ammo=${w.ammo}`);
  w.update(DT, { ...idle, time: t, reloadPressed: true }, owner, [target], shooterEye, 0, 0);
  ok('reload starts on an empty mag', w._reloading > 0);
  const mag = WEAPONS.rifle.magSize;
  const steps = Math.ceil(WEAPONS.rifle.reloadTime / DT);
  for (let i = 0; i < steps + 4; i++) { t += DT; w.update(DT, { ...idle, time: t }, owner, [target], shooterEye, 0, 0); }
  ok(`reload refills the mag to ${mag} (got ${w.ammo})`, w.ammo === mag);
  ok('reload draws from reserve', w.slot.reserve < WEAPONS.rifle.reserve);
}
{
  // Firing during a reload must be blocked.
  const w = mk('rifle');
  w.ammo = 5;
  const target = makeTarget(1e6, k.y, 1e6);
  let t = 0;
  w.update(DT, { ...idle, time: t, reloadPressed: true }, owner, [target], shooterEye, 0, 0);
  const ammoAtStart = w.ammo;
  let fired = 0;
  for (let i = 0; i < 30; i++) {
    t += DT;
    const ev = w.update(DT, { ...idle, time: t, fire: true }, owner, [target], shooterEye, 0, 0);
    for (const e of ev) if (e.type === 'fire') fired++;
  }
  ok('cannot fire during a reload', fired === 0 && w.ammo === ammoAtStart, `fired=${fired}`);
}

/* ------------------------------------------------------------ wall block */
console.log('\n# world occlusion');
{
  const w = mk('pistol');
  w.spread = 0;
  const eye = new THREE.Vector3(k.x, k.y + 1.2, k.z);
  let best = null;
  const dir = new THREE.Vector3(1, 0, 0);
  const wall = col.raycast(eye, dir, 40, 0);
  if (wall && Math.abs(wall.normal.y) < 0.5) {
    const target = makeTarget(k.x + wall.distance + 2, k.y, k.z);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t += DT;
      // yaw = -PI/2 faces +X in the weapon's basis.
      const ev = w.update(DT, { ...idle, time: t, firePressed: true }, owner, [target], eye, -Math.PI / 2, 0);
      for (const e of ev) if (e.type === 'fire') best = e.traces[0];
    }
    ok('a target behind a wall is protected', best && best.type === 'world', best ? best.type : 'none');
  } else {
    console.log('  skip  no wall within 40m to the east of the KOTH');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
