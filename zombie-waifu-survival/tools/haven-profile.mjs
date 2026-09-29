#!/usr/bin/env node
// Offline Haven map analysis: rotate Z-up->Y-up, then report an occupancy + height profile.
import { readGLB } from './probe.mjs';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function accessorArray(json, bin, idx) {
  const a = json.accessors[idx];
  const Ctor = COMP[a.componentType];
  const sz = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5121 || a.componentType === 5120 ? 1 : 2;
  const n = NCOMP[a.type];
  const bv = json.bufferViews[a.bufferView];
  const byteOff = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = bv.byteStride ?? sz * n;
  if (stride === sz * n) return new Ctor(bin.buffer, bin.byteOffset + byteOff, a.count * n);
  const out = new Ctor(a.count * n);
  for (let i = 0; i < a.count; i++) {
    const src = byteOff + i * stride;
    for (let k = 0; k < n; k++) out[i * n + k] = new Ctor(bin.buffer, bin.byteOffset + src + k * sz, 1)[0];
  }
  return out;
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const t = node.translation ?? [0, 0, 0], r = node.rotation ?? [0, 0, 0, 1], s = node.scale ?? [1, 1, 1];
  const [x, y, z, w] = r, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function worldMatrices(json) {
  const world = new Array(json.nodes.length);
  const visit = (i, parent) => {
    const m = nodeMatrix(json.nodes[i]);
    world[i] = parent ? mul(parent, m) : m;
    for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
  };
  for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);
  return world;
}

const path = process.argv[2];
const { json, bin } = readGLB(path);
const world = worldMatrices(json);

// Source is Z-up. Build rotation: (x,y,z)_zup -> (x, z, -y) i.e. rotate -90 about X.
const R = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];

const pts = [];
json.nodes.forEach((node, ni) => {
  if (node.mesh === undefined) return;
  const W = world[ni];
  const M = mul(W, R);
  for (const prim of json.meshes[node.mesh].primitives) {
    const pos = accessorArray(json, bin, prim.attributes.POSITION);
    for (let i = 0; i < pos.length; i += 3) {
      const x = M[0] * pos[i] + M[4] * pos[i + 1] + M[8] * pos[i + 2] + M[12];
      const y = M[1] * pos[i] + M[5] * pos[i + 1] + M[9] * pos[i + 2] + M[13];
      const z = M[2] * pos[i] + M[6] * pos[i + 1] + M[10] * pos[i + 2] + M[14];
      pts.push(x, y, z);
    }
  }
});

const n = pts.length / 3;
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
  const v = pts[i * 3 + k];
  if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
}
const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

console.log(JSON.stringify({
  file: path.split(/[\\/]/).pop(),
  vertexCount: n,
  min: min.map((v) => +v.toFixed(2)),
  max: max.map((v) => +v.toFixed(2)),
  size: size.map((v) => +v.toFixed(2)),
}, null, 1));

// Occupancy grid on XZ: for each cell, record the count of vertices and the min/max Y.
const RES = 48;
const gw = Math.max(1, Math.round(size[0] / RES));
const gd = Math.max(1, Math.round(size[2] / RES));
const count = new Uint32Array(gw * gd);
const ymin = new Float32Array(gw * gd).fill(Infinity);
const ymax = new Float32Array(gw * gd).fill(-Infinity);
for (let i = 0; i < n; i++) {
  const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
  const gx = Math.min(gw - 1, Math.max(0, Math.floor((x - min[0]) / RES)));
  const gz = Math.min(gd - 1, Math.max(0, Math.floor((z - min[2]) / RES)));
  const c = gz * gw + gx;
  count[c]++;
  if (y < ymin[c]) ymin[c] = y;
  if (y > ymax[c]) ymax[c] = y;
}

const ramp = ' .:-=+*#%@';
console.log(`\n# top-down occupancy, ${gw}x${gd} cells of ${RES} units. '#'=dense, ' '=empty. rows = Z from ${min[2].toFixed(0)} to ${max[2].toFixed(0)}\n`);
let maxC = 0; for (const c of count) if (c > maxC) maxC = c;
for (let gz = 0; gz < gd; gz++) {
  let row = '';
  for (let gx = 0; gx < gw; gx++) {
    const c = count[gz * gw + gx];
    row += c === 0 ? ' ' : ramp[Math.min(9, 1 + Math.floor((c / maxC) * 8))];
  }
  console.log(`${String(gz).padStart(3)} |${row}|`);
}
console.log(`     X ${min[0].toFixed(0)} -> ${max[0].toFixed(0)}`);

// Height profile: the topmost surface per column, sampled sparsely.
console.log('\n# top-surface height (Y) per cell, blank = empty, digits = deciles of height range\n');
const hSpan = [min[1], max[1]];
for (let gz = 0; gz < gd; gz++) {
  let row = '';
  for (let gx = 0; gx < gw; gx++) {
    const c = gz * gw + gx;
    if (count[c] === 0) { row += ' '; continue; }
    const t = (ymax[c] - hSpan[0]) / (hSpan[1] - hSpan[0] || 1);
    row += '0123456789'[Math.min(9, Math.max(0, Math.floor(t * 9.99)))];
  }
  console.log(`${String(gz).padStart(3)} |${row}|`);
}
console.log(`\nY range: ${hSpan[0].toFixed(1)} .. ${hSpan[1].toFixed(1)}`);
