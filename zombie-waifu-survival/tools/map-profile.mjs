#!/usr/bin/env node
// Fine top-down height/occupancy profile of a Z-up GLB, plus candidate flat "sites" (KOTH zones).
import { readGLB } from './probe.mjs';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function acc(json, bin, idx) {
  const a = json.accessors[idx], Ctor = COMP[a.componentType];
  const sz = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5121 || a.componentType === 5120 ? 1 : 2;
  const n = NCOMP[a.type], bv = json.bufferViews[a.bufferView];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = bv.byteStride ?? sz * n;
  if (stride === sz * n) return new Ctor(bin.buffer, bin.byteOffset + off, a.count * n);
  const out = new Ctor(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++)
    out[i * n + k] = new Ctor(bin.buffer, bin.byteOffset + off + i * stride + k * sz, 1)[0];
  return out;
}
function nm(n) {
  if (n.matrix) return n.matrix;
  const t = n.translation ?? [0, 0, 0], r = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1];
  const [x, y, z, w] = r, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function xf(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

const path = process.argv[2];
const RES = +(process.argv[3] ?? 12);
const { json, bin } = readGLB(path);
const world = new Array(json.nodes.length);
const visit = (i, p) => { world[i] = p ? mul(p, nm(json.nodes[i])) : nm(json.nodes[i]); for (const c of json.nodes[i].children ?? []) visit(c, world[i]); };
for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

// Collect only near-horizontal (floor-facing) triangles: normal.z > 0.7
const floors = [];
let vmin = [Infinity, Infinity, Infinity], vmax = [-Infinity, -Infinity, -Infinity];
json.nodes.forEach((node, ni) => {
  if (node.mesh === undefined) return;
  const W = world[ni];
  for (const prim of json.meshes[node.mesh].primitives) {
    const pos = acc(json, bin, prim.attributes.POSITION);
    const idxAcc = prim.indices !== undefined ? json.accessors[prim.indices] : null;
    const idx = idxAcc ? acc(json, bin, prim.indices) : null;
    const nT = Math.floor((idx ? idx.length : pos.length / 3) / 3);
    for (let t = 0; t < nT; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const a = xf(W, pos[i0 * 3], pos[i0 * 3 + 1], pos[i0 * 3 + 2]);
      const b = xf(W, pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
      const c = xf(W, pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
      for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { if (p[k] < vmin[k]) vmin[k] = p[k]; if (p[k] > vmax[k]) vmax[k] = p[k]; }
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const L = Math.hypot(...nrm); if (L < 1e-9) continue;
      if (nrm[2] / L > 0.7) floors.push([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, a[2], L / 2]);
    }
  }
});

const size = [0, 1, 2].map((k) => +(vmax[k] - vmin[k]).toFixed(1));
const gw = Math.max(1, Math.ceil(size[0] / RES)), gd = Math.max(1, Math.ceil(size[1] / RES));
const area = new Float32Array(gw * gd);
const topZ = new Float32Array(gw * gd).fill(-Infinity);
for (const [x, y, z, a] of floors) {
  const gx = Math.min(gw - 1, Math.max(0, Math.floor((x - vmin[0]) / RES)));
  const gy = Math.min(gd - 1, Math.max(0, Math.floor((y - vmin[1]) / RES)));
  const c = gy * gw + gx;
  area[c] += a; if (z > topZ[c]) topZ[c] = z;
}
const cellArea = RES * RES;
let maxA = 0; for (const a of area) if (a > maxA) maxA = a;

console.log(`# ${path.split(/[\\/]/).pop()}  bounds X[${vmin[0].toFixed(0)},${vmax[0].toFixed(0)}] Y[${vmin[1].toFixed(0)},${vmax[1].toFixed(0)}] Z[${vmin[2].toFixed(0)},${vmax[2].toFixed(0)}]  size ${size.join(' x ')}`);
console.log(`# floor-coverage grid ${gw}x${gd} @ ${RES}u   (rows = +Y downward; digits = Z height decile)\n`);
const zmin = vmin[2], zmax = vmax[2];
for (let gy = 0; gy < gd; gy++) {
  let cov = '', hgt = '';
  for (let gx = 0; gx < gw; gx++) {
    const c = gy * gw + gx, covFrac = area[c] / cellArea;
    cov += covFrac < 0.02 ? ' ' : covFrac < 0.3 ? '.' : covFrac < 0.7 ? ':' : covFrac < 0.95 ? '+' : '#';
    hgt += covFrac < 0.02 ? ' ' : '0123456789'[Math.min(9, Math.max(0, Math.floor((topZ[c] - zmin) / (zmax - zmin || 1) * 9.99)))];
  }
  console.log(`${String(gy).padStart(3)} |${cov}| ${hgt}`);
}
console.log(`    X ${vmin[0].toFixed(0)} -> ${vmax[0].toFixed(0)}   (Z-up: height = Z, ${zmin.toFixed(0)}..${zmax.toFixed(0)})`);

// Largest contiguous walkable plates -> candidate KOTH sites.
console.log('\n# candidate KOTH sites (largest open floor plates, by cell count)');
const plates = [];
const seen = new Uint8Array(gw * gd);
const q = [];
for (let s = 0; s < gw * gd; s++) {
  if (seen[s] || area[s] / cellArea < 0.6) continue;
  q.length = 0; q.push(s); seen[s] = 1; let n = 0, sx = 0, sy = 0, sz = 0;
  while (q.length) {
    const c = q.pop(); n++;
    const cx = c % gw, cy = (c / gw) | 0;
    sx += cx; sy += cy; sz += topZ[c];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gd) continue;
      const nn = ny * gw + nx;
      if (seen[nn] || area[nn] / cellArea < 0.6) continue;
      seen[nn] = 1; q.push(nn);
    }
  }
  const r = Math.sqrt(n) * RES;
  plates.push({ cells: n, radius: Math.round(r), x: Math.round(sx / n * RES + vmin[0]), y: Math.round(sy / n * RES + vmin[1]), z: +(sz / n).toFixed(1) });
}
plates.sort((a, b) => b.cells - a.cells);
console.log(JSON.stringify(plates.slice(0, 12)));
