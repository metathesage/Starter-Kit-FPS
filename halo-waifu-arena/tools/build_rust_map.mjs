import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, '../Maps/rust.glb');
const OUT = resolve(ROOT, 'assets/map_rust');

const COMP = {
  5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
  5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4],
};
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGLB(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a GLB`);
  const total = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  return { json, bin };
}

function accessor(json, bin, idx) {
  const a = json.accessors[idx];
  const [Ctor, sz] = COMP[a.componentType];
  const n = NCOMP[a.type];
  const bv = json.bufferViews[a.bufferView];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = bv.byteStride ?? sz * n;
  if (stride === sz * n) return new Ctor(bin.buffer, bin.byteOffset + off, a.count * n);
  const out = new Ctor(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const rd = { 5120: (o) => dv.getInt8(o), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true), 5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = rd(off + i * stride + k * sz);
  return out;
}

function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation ?? [0, 0, 0], r = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1];
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
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const apply = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

// Rust map dimensions: X=227, Y=240, Z=130. Unit scale 0.25 -> 56m x 60m x 32m
const UNIT = 0.25;
mkdirSync(OUT, { recursive: true });

console.log(`[bake-rust] Reading ${SRC}...`);
const { json, bin } = readGLB(SRC);
const world = new Array(json.nodes.length);
const visit = (i, p) => {
  world[i] = p ? mul(p, nodeMatrix(json.nodes[i])) : nodeMatrix(json.nodes[i]);
  for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
};
for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

const positions = [];
const indices = [];
let vcount = 0;
const bmin = [Infinity, Infinity, Infinity];
const bmax = [-Infinity, -Infinity, -Infinity];

json.nodes.forEach((node, ni) => {
  if (node.mesh === undefined) return;
  const M = world[ni];
  const mesh = json.meshes[node.mesh];
  for (const prim of mesh.primitives) {
    if (prim.mode !== undefined && prim.mode !== 4) continue;
    const pos = accessor(json, bin, prim.attributes.POSITION);
    const idx = prim.indices !== undefined ? accessor(json, bin, prim.indices) : null;
    const nT = Math.floor((idx ? idx.length : pos.length / 3) / 3);
    const base = vcount;
    for (let i = 0; i < pos.length; i += 3) {
      const p = apply(M, pos[i], pos[i + 1], pos[i + 2]);
      positions.push(p[0] * UNIT, p[1] * UNIT, p[2] * UNIT);
      for (let k = 0; k < 3; k++) {
        const v = positions[positions.length - 3 + k];
        if (v < bmin[k]) bmin[k] = v;
        if (v > bmax[k]) bmax[k] = v;
      }
      vcount++;
    }
    for (let t = 0; t < nT; t++) {
      const a = idx ? idx[t * 3] : t * 3;
      const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      indices.push(base + a, base + b, base + c);
    }
  }
});

const cx = (bmin[0] + bmax[0]) / 2, cz = (bmin[2] + bmax[2]) / 2;
for (let i = 0; i < positions.length; i += 3) {
  positions[i] -= cx;
  positions[i + 2] -= cz;
}
bmin[0] -= cx; bmax[0] -= cx;
bmin[2] -= cz; bmax[2] -= cz;

const nTri = indices.length / 3;
console.log(`[bake-rust] ${vcount} verts, ${nTri} tris`);
console.log(`[bake-rust] Bounds: X[${bmin[0].toFixed(1)}, ${bmax[0].toFixed(1)}] Y[${bmin[1].toFixed(1)}, ${bmax[1].toFixed(1)}] Z[${bmin[2].toFixed(1)}, ${bmax[2].toFixed(1)}]`);

// Build BVH
const centroids = new Float32Array(nTri * 3);
for (let t = 0; t < nTri; t++) {
  const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
  for (let k = 0; k < 3; k++) {
    centroids[t * 3 + k] = (positions[a * 3 + k] + positions[b * 3 + k] + positions[c * 3 + k]) / 3;
  }
}

const triOrder = new Uint32Array(nTri);
for (let t = 0; t < nTri; t++) triOrder[t] = t;

const nodes = [];
const stack = [{ start: 0, count: nTri, depth: 0 }];
const LEAF = 8;
const DEPTH_LIMIT = 40;

function triBounds(t, out) {
  const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
  for (let k = 0; k < 3; k++) {
    const v0 = positions[a + k], v1 = positions[b + k], v2 = positions[c + k];
    out[k] = Math.min(v0, v1, v2);
    out[k + 3] = Math.max(v0, v1, v2);
  }
  return out;
}

const scratch = new Float32Array(6);

while (stack.length > 0) {
  const task = stack.pop();
  const { start, count, depth } = task;
  const nodeBmin = [Infinity, Infinity, Infinity];
  const nodeBmax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const t = triOrder[start + i];
    triBounds(t, scratch);
    for (let k = 0; k < 3; k++) {
      if (scratch[k] < nodeBmin[k]) nodeBmin[k] = scratch[k];
      if (scratch[k + 3] > nodeBmax[k + 3]) nodeBmax[k] = scratch[k + 3];
    }
  }

  if (count <= LEAF || depth >= DEPTH_LIMIT) {
    nodes.push({ bmin: nodeBmin, bmax: nodeBmax, start, count, axis: -1, childL: -1, childR: -1 });
    continue;
  }

  let bestAxis = 0, bestSpan = -1;
  for (let k = 0; k < 3; k++) {
    const span = nodeBmax[k] - nodeBmin[k];
    if (span > bestSpan) { bestSpan = span; bestAxis = k; }
  }

  const mid = start + Math.floor(count / 2);
  const arr = Array.from(triOrder.subarray(start, start + count));
  arr.sort((t1, t2) => centroids[t1 * 3 + bestAxis] - centroids[t2 * 3 + bestAxis]);
  for (let i = 0; i < count; i++) triOrder[start + i] = arr[i];

  const node = { bmin: nodeBmin, bmax: nodeBmax, start, count, axis: bestAxis, childL: -1, childR: -1 };
  nodes.push(node);

  const leftCount = mid - start;
  const rightCount = count - leftCount;

  node.childR = nodes.length + (leftCount <= LEAF ? 1 : 0);
  stack.push({ start: mid, count: rightCount, depth: depth + 1 });
  stack.push({ start, count: leftCount, depth: depth + 1 });
}

for (let i = 0; i < nodes.length; i++) {
  if (nodes[i].count > LEAF && nodes[i].childL === -1) {
    nodes[i].childL = i + 1;
  }
}

// Write collision.bin
const reorderedIdx = new Uint32Array(nTri * 3);
for (let t = 0; t < nTri; t++) {
  const origT = triOrder[t];
  reorderedIdx[t * 3] = indices[origT * 3];
  reorderedIdx[t * 3 + 1] = indices[origT * 3 + 1];
  reorderedIdx[t * 3 + 2] = indices[origT * 3 + 2];
}

const posBytes = new Float32Array(positions);
const nodeBytes = new Float32Array(nodes.length * 10);
for (let i = 0; i < nodes.length; i++) {
  const n = nodes[i];
  const off = i * 10;
  nodeBytes[off] = n.bmin[0]; nodeBytes[off + 1] = n.bmin[1]; nodeBytes[off + 2] = n.bmin[2];
  nodeBytes[off + 3] = n.bmax[0]; nodeBytes[off + 4] = n.bmax[1]; nodeBytes[off + 5] = n.bmax[2];
  nodeBytes[off + 6] = n.start;
  nodeBytes[off + 7] = n.count;
  nodeBytes[off + 8] = n.childL;
  nodeBytes[off + 9] = n.childR;
}

const header = new Uint32Array([
  0x42564831,
  positions.length / 3,
  nTri,
  nodes.length,
  0
]);

const outCol = Buffer.concat([
  Buffer.from(header.buffer),
  Buffer.from(posBytes.buffer),
  Buffer.from(reorderedIdx.buffer),
  Buffer.from(nodeBytes.buffer)
]);
writeFileSync(resolve(OUT, 'collision.bin'), outCol);
copyFileSync(SRC, resolve(OUT, 'rust.glb'));

const spawns = [
  [-12.0, 1.0, -10.0],
  [12.0, 1.0, 10.0],
  [-10.0, 1.0, 12.0],
  [10.0, 1.0, -12.0],
  [0.0, 1.0, -15.0]
];

const mapMeta = {
  name: 'Call of Duty Rust',
  mode: 'halo',
  unit: UNIT,
  scale: UNIT,
  cx, cz,
  bounds: { min: bmin, max: bmax },
  koth: { x: 0, y: 1.0, z: 0, radius: 4.5 },
  spawns,
  ctSpawns: spawns.slice(0, 3),
  tSpawns: spawns.slice(3)
};

writeFileSync(resolve(OUT, 'map.json'), JSON.stringify(mapMeta, null, 2));
console.log(`[bake-rust] Complete!`);
