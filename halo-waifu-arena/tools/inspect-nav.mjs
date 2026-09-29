#!/usr/bin/env node
// Visualise the baked nav grid: walkable coverage per row/column + open-plate scores.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(resolve(HERE, '../assets/map/nav.bin'));
const head = new Float32Array(buf.buffer, buf.byteOffset, 12);
const [gw, gd, cell, ox, oz] = head;
const n = gw * gd;
const height = new Float32Array(buf.buffer, buf.byteOffset + 48, n);
const walk = new Uint8Array(buf.buffer, buf.byteOffset + 48 + n * 4, n);

const k = (x, z) => z * gw + x;
let nWalk = 0;
for (let i = 0; i < n; i++) if (walk[i]) nWalk++;
console.log(`grid ${gw}x${gd} cell=${cell} origin=(${ox},${oz})  walkable=${nWalk}`);

// world bounds of walkable
let wx0 = 1e9, wx1 = -1e9, wz0 = 1e9, wz1 = -1e9;
for (let z = 0; z < gd; z++) for (let x = 0; x < gw; x++) if (walk[k(x, z)]) {
  const wxp = x * cell + ox, wzp = z * cell + oz;
  if (wxp < wx0) wx0 = wxp; if (wxp > wx1) wx1 = wxp;
  if (wzp < wz0) wz0 = wzp; if (wzp > wz1) wz1 = wzp;
}
console.log(`walkable world bounds x[${wx0.toFixed(1)},${wx1.toFixed(1)}] z[${wz0.toFixed(1)},${wz1.toFixed(1)}]`);
console.log(`walkable centroid: x=${(() => { let s = 0, c = 0; for (let z = 0; z < gd; z++) for (let x = 0; x < gw; x++) if (walk[k(x, z)]) { s += x * cell + ox; c++; } return (s / c).toFixed(1); })()} z=${(() => { let s = 0, c = 0; for (let z = 0; z < gd; z++) for (let x = 0; x < gw; x++) if (walk[k(x, z)]) { s += z * cell + oz; c++; } return (s / c).toFixed(1); })()}\n`);

console.log('# walkable map. left = coverage, right = surface height. rows along +Z, columns along +X');
const ramp = ' .:-=+*#%@';
let maxRow = 0; const rowCount = new Int32Array(gd);
for (let z = 0; z < gd; z++) { let c = 0; for (let x = 0; x < gw; x++) if (walk[k(x, z)]) c++; rowCount[z] = c; if (c > maxRow) maxRow = c; }
for (let z = 0; z < gd; z++) {
  let cov = '', hgt = '';
  for (let x = 0; x < gw; x++) {
    if (walk[k(x, z)]) {
      cov += ramp[Math.min(9, 1 + Math.floor((rowCount[z] / (maxRow || 1)) * 8))];
      const h = height[k(x, z)];
      hgt += '0123456789'[Math.max(0, Math.min(9, Math.round((h + 12) / 1.4)))];
    } else { cov += ' '; hgt += ' '; }
  }
  console.log(`${String((z * cell + oz).toFixed(0)).padStart(5)}|${cov}|${hgt}|`);
}
console.log(`      ${'X'.padStart(5)}  ${(-28).toFixed(0)} -> ${29} m`);

// open-plate scoring at several radii
console.log('\n# top open plates (disc coverage) at R=7m, with world pos');
function score(gx, gz, R) {
  let n = 0;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz > R * R) continue;
    const x = gx + dx, z = gz + dz;
    if (x < 0 || z < 0 || x >= gw || z >= gd) continue;
    if (walk[k(x, z)]) n++;
  }
  return n;
}
for (const R of [8, 14, 20]) {
  const cands = [];
  for (let z = 0; z < gd; z++) for (let x = 0; x < gw; x++) {
    if (!walk[k(x, z)]) continue;
    const s = score(x, z, R);
    if (s > 0) cands.push({ s, x: x * cell + ox, z: z * cell + oz, y: height[k(x, z)] });
  }
  cands.sort((a, b) => b.s - a.s);
  console.log(`R=${(R * cell).toFixed(1)}m  best=${cands[0]?.s}  top5: ` + cands.slice(0, 5).map((c) => `(${c.x.toFixed(0)},${c.z.toFixed(0)},y${c.y.toFixed(1)},${c.s})`).join(' '));
}
