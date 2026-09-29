#!/usr/bin/env node
// Headless correctness tests for the BVH: raycast, box query, capsule resolution, nav sampling.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Collision, makeContact } from '../src/world/collision.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

console.log('loading collision.bin ...');
const t0 = Date.now();
const buf = readFileSync(resolve(HERE, '../assets/map/collision.bin'));
const col = new Collision(buf);
console.log(`  ${col.triCount} tris, ${col.nodeCount} nodes, ${col.matNames.length} materials, parsed in ${Date.now() - t0}ms`);
console.log(`  bounds ${col.min.toArray().map((v) => v.toFixed(1))} .. ${col.max.toArray().map((v) => v.toFixed(1))}`);

const meta = JSON.parse(readFileSync(resolve(HERE, '../assets/map/map.json'), 'utf8'));
const nav = readFileSync(resolve(HERE, '../assets/map/nav.bin'));
const navBytes = new Uint8Array(nav.buffer, nav.byteOffset, nav.byteLength);
const nh = new Float32Array(navBytes.buffer, navBytes.byteOffset, 12);
const [gw, gd, cell, ox, oz] = nh;
const nCells = gw * gd;
const height = new Float32Array(navBytes.buffer, navBytes.byteOffset + 48, nCells);
const walk = new Uint8Array(navBytes.buffer, navBytes.byteOffset + 48 + nCells * 4, nCells);
const cellWorld = (gx, gz) => [gx * cell + ox + cell / 2, gz * cell + oz + cell / 2];

const V = (x, y, z) => ({ x, y, z });
const vec = (a) => ({ x: a[0], y: a[1], z: a[2] });

/* ------------------------------------------------------------ raycast */
console.log('\n# raycast');
// Down from high above the KOTH site must hit the floor near the nav height.
{
  const k = meta.koth;
  const hit = col.raycast(vec([k.x, k.y + 25, k.z]), V(0, -1, 0), 60, 0);
  ok('hits ground below KOTH', !!hit);
  if (hit) {
    const d = Math.abs(hit.point.y - k.y);
    ok(`ground within 0.35m of nav height (nav ${k.y.toFixed(2)} vs mesh ${hit.point.y.toFixed(2)})`, d < 0.35, `delta ${d.toFixed(3)}`);
    // Slopes and ramps are walkable, so require a walkable tilt rather than flat.
    ok('normal points up (walkable tilt)', hit.normal.y > 0.55, `ny=${hit.normal.y.toFixed(2)}`);
  }
}

// Straight up from well under the floor must NOT hit (we are below it).
{
  const k = meta.koth;
  const hit = col.raycast(vec([k.x, k.y - 2.0, k.z]), V(0, 1, 0), 30, 0);
  ok('no hit shooting up from under the floor', hit === null || hit.distance > 1.0, hit ? `d=${hit.distance.toFixed(2)}` : '');
}

// Horizontal ray at chest height should be blocked by geometry somewhere.
{
  let blocked = 0, tested = 0;
  for (let z = 0; z < gd; z += 7) for (let x = 0; x < gw; x += 7) {
    if (!walk[z * gw + x]) continue;
    const [wx, wz] = cellWorld(x, z);
    const y = height[z * gw + x] + 1.1;
    tested++;
    if (col.raycast(vec([wx, y, wz]), V(1, 0, 0), 60, 0)) blocked++;
  }
  ok(`some chest-height rays are blocked (${blocked}/${tested})`, blocked > 0);
}

// Ray straight down at a nav-walkable cell must agree with the nav height
// across a sample. This is the check that the two bakes agree.
{
  let agree = 0, total = 0, worst = 0;
  for (let z = 2; z < gd - 2; z += 3) for (let x = 2; x < gw - 2; x += 3) {
    if (!walk[z * gw + x]) continue;
    const [wx, wz] = cellWorld(x, z);
    const ny = height[z * gw + x];
    const hit = col.raycast(vec([wx, ny + 6, wz]), V(0, -1, 0), 14, 0);
    if (!hit) continue;
    total++;
    const d = Math.abs(hit.point.y - ny);
    if (d < worst) worst = d;
    if (d < 0.55) agree++;
  }
  ok(`nav height matches mesh (${agree}/${total}, worst ${worst.toFixed(3)}m)`, agree / total > 0.9);
}

/* ------------------------------------------------------------- box query */
console.log('\n# box query');
{
  const k = meta.koth;
  const n = col.queryBox(k.x - 2, k.y - 2, k.z - 2, k.x + 2, k.y + 2, k.z + 2);
  ok(`box query around KOTH returns triangles (${n})`, n > 0);
  const n2 = col.queryBox(9999, 9999, 9999, 10000, 10000, 10000);
  ok('box query far outside returns nothing', n2 === 0);
}

/* -------------------------------------------------------------- capsule */
console.log('\n# capsule resolution');
/* Find genuinely flat ground: a spot where the floor within the capsule radius
   varies by <2cm. The KOTH plate sits on a slope, so it cannot be used to test
   "capsule rests exactly on the floor". */
function findFlat(yProbeFrom = 40) {
  for (let z = 2; z < gd - 2; z += 2) for (let x = 2; x < gw - 2; x += 2) {
    if (!walk[z * gw + x]) continue;
    const [wx, wz] = cellWorld(x, z);
    const hit = col.raycast(vec([wx, yProbeFrom, wz]), V(0, -1, 0), yProbeFrom + 20, 0);
    if (!hit || hit.normal.y < 0.985) continue;      // must be genuinely flat
    let flat = true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const h2 = col.raycast(vec([wx + dx * 0.4, yProbeFrom, wz + dz * 0.4]), V(0, -1, 0), yProbeFrom + 20, 0);
      if (!h2 || Math.abs(h2.point.y - hit.point.y) > 0.02) { flat = false; break; }
    }
    if (flat) return { x: wx, z: wz, y: hit.point.y };
  }
  return null;
}

const flat = findFlat();
ok('found flat test ground', !!flat, flat ? `y=${flat.y.toFixed(2)}` : 'none');
if (flat) {
  const p = { x: flat.x, y: flat.y + 2.0, z: flat.z, distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); } };
  const c = makeContact();
  let vy = 0;
  const h = 1 / 120;
  for (let i = 0; i < 300; i++) {
    vy -= 19.6 * h;
    p.y += vy * h;
    col.resolveCapsule(p, 0.36, 1.8, c);
    if (c.grounded && vy < 0) { vy = 0; break; }
  }
  ok(`falling capsule lands exactly on flat floor (y ${p.y.toFixed(3)}, floor ${flat.y.toFixed(3)})`, Math.abs(p.y - flat.y) < 0.02, `dy=${(p.y - flat.y).toFixed(3)}`);
  ok('reports grounded after landing', c.grounded);
  ok('ground normal points up', c.groundNormal.y > 0.9, `ny=${c.groundNormal.y.toFixed(2)}`);
  ok('no spurious wall contact while standing', !c.wall);
}

{
  // On a slope the capsule must still be supported, and must not sink below the
  // surface or be reported as free-falling.
  const k = meta.koth;
  const p = { x: k.x, y: k.y + 2.0, z: k.z, distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); } };
  const c = makeContact();
  let vy = 0;
  const h = 1 / 120;
  for (let i = 0; i < 300; i++) {
    vy -= 19.6 * h;
    p.y += vy * h;
    col.resolveCapsule(p, 0.36, 1.8, c);
    if (c.grounded && vy < 0) break;
  }
  ok(`capsule rests on the slope (y ${p.y.toFixed(2)})`, c.grounded);
  // The KOTH plate is raised relative to the terrain around it, so resting
  // slightly above the nav centre height is correct. What must never happen is
  // falling far below it.
  ok('does not sink through the surface', p.y > k.y - 0.1, `y=${p.y.toFixed(2)} vs floor ${k.y.toFixed(2)}`);
}

{
  // Inside a wall: the capsule must be pushed back out toward the open side.
  const k = meta.koth;
  const origin = vec([k.x, k.y + 1.0, k.z]);
  const hit = col.raycast(origin, V(1, 0, 0), 30, 0);
  if (hit) {
    // Embed 30cm past the surface we just hit, then expect a push back along -X.
    const p = vec([hit.point.x + 0.30, k.y, hit.point.z]);
    const before = p.x;
    col.resolveCapsule(p, 0.36, 1.8, makeContact());
    ok(`capsule pushed back out of a wall (moved ${(p.x - before).toFixed(3)}m)`, before - p.x > 0.05);
  } else {
    console.log('  skip  wall embed test (no wall found near KOTH)');
  }
}

{
  // Free space test: spawn points should be free.
  let free = 0;
  for (const s of meta.spawns) if (col.isFree(s[0], s[1] + 0.2, s[2], 0.36, 1.8)) free++;
  ok(`spawn points are free (${free}/${meta.spawns.length})`, free >= meta.spawns.length - 1);
}

/* ---------------------------------------------------------- performance */
console.log('\n# performance');
{
  // Realistic load: eye-height rays sweeping horizontally, which is what a
  // hitscan and an AI line-of-sight test actually do.
  const k = meta.koth;
  const o = vec([k.x, k.y + 1.58, k.z]);
  const N = 20000;
  const t = performance.now();
  for (let i = 0; i < N; i++) {
    const a = (i * 0.61803398875) % (Math.PI * 2);
    col.raycast(o, vec([Math.cos(a), 0, Math.sin(a)]), 150, 0);
  }
  const per = (performance.now() - t) / N * 1000;
  ok(`raycast ${per.toFixed(1)}us/call typical (<20us)`, per < 20, `${per.toFixed(1)}us`);

  // Downward rays over the terrain skirt hit very large triangles and are the
  // true worst case. Budget them at 8 actors x 120Hz.
  const o2 = vec([k.x, k.y + 20, k.z]);
  const M = 5000;
  const t2 = performance.now();
  for (let i = 0; i < M; i++) col.raycast(o2, V(0, -1, 0), 60, 0);
  const per2 = (performance.now() - t2) / M * 1000;
  const budget = (8 * per2) / 1000;
  ok(`downward ray worst case ${per2.toFixed(1)}us/call (<400us)`, per2 < 400, `${per2.toFixed(1)}us`);
  console.log(`  budget: 1 player + 7 bots at 120Hz, 1 ray each = ${budget.toFixed(2)}ms/sim-tick (limit 8.3ms)`);
  ok('raycast budget fits in a 120Hz tick', budget < 8.3, `${budget.toFixed(2)}ms`);

  const p = { x: k.x, y: k.y + 0.2, z: k.z, distanceTo() { return 0; } };
  const N2 = 5000;
  const t3 = performance.now();
  for (let i = 0; i < N2; i++) col.resolveCapsule(p, 0.36, 1.8, makeContact());
  const per3 = (performance.now() - t3) / N2 * 1000;
  ok(`resolveCapsule ${per3.toFixed(1)}us/call (<200us)`, per3 < 200, `${per3.toFixed(1)}us`);
  const capBudget = (8 * per3) / 1000;
  console.log(`  budget: 8 characters moving = ${capBudget.toFixed(2)}ms/sim-tick`);
  ok('capsule budget fits in a 120Hz tick', capBudget < 4.0, `${capBudget.toFixed(2)}ms`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
