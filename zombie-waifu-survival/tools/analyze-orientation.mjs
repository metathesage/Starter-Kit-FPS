#!/usr/bin/env node
// Determine the true up-axis, scale, and walkable floors of a Z-up/Z/Y GLB.
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
const { json, bin } = readGLB(path);
const world = new Array(json.nodes.length);
const visit = (i, p) => { world[i] = p ? mul(p, nm(json.nodes[i])) : nm(json.nodes[i]); for (const c of json.nodes[i].children ?? []) visit(c, world[i]); };
for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

// Gather triangle centroids + normals in raw source space.
const normHist = new Map();          // quantized normal -> triangle count
let tris = 0, area = 0;
const vmin = [Infinity, Infinity, Infinity], vmax = [-Infinity, -Infinity, -Infinity];
const flatLevels = new Map();        // axis -> Map(height -> area)  (axis-aligned big flats)

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
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const L = Math.hypot(...nrm);
      if (L < 1e-12) continue;
      const A = L / 2; area += A; tris++;
      const u = [nrm[0] / L, nrm[1] / L, nrm[2] / L];
      const key = `${Math.round(u[0] * 10)},${Math.round(u[1] * 10)},${Math.round(u[2] * 10)}`;
      normHist.set(key, (normHist.get(key) ?? 0) + A);
      for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { if (p[k] < vmin[k]) vmin[k] = p[k]; if (p[k] > vmax[k]) vmax[k] = p[k]; }
      // big axis-aligned flat detection
      const ax = [Math.abs(u[0]), Math.abs(u[1]), Math.abs(u[2])];
      const dom = ax.indexOf(Math.max(...ax));
      if (Math.max(...ax) > 0.98 && A > 4) {
        const h = Math.round((a[dom] + b[dom] + c[dom]) / 3);
        const key2 = `${dom}:${h}`;
        flatLevels.set(key2, (flatLevels.get(key2) ?? 0) + A);
      }
    }
  }
});

const top = [...normHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .map(([k, v]) => ({ normal: k.split(',').map((n) => n / 10), area: Math.round(v) }));
const flats = [...flatLevels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  .map(([k, v]) => ({ plane: k.split(':')[0], height: +k.split(':')[1], area: Math.round(v) }));

console.log(JSON.stringify({
  file: path.split(/[\\/]/).pop(),
  tris, totalArea: Math.round(area),
  bounds: { min: vmin.map((v) => +v.toFixed(2)), max: vmax.map((v) => +v.toFixed(2)) },
  size: [0, 1, 2].map((k) => +(vmax[k] - vmin[k]).toFixed(2)),
  dominantNormalsByArea: top,
  largestAxisAlignedFlats: flats,
}, null, 1));
