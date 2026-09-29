import { readFileSync } from 'node:fs';

const COMP = {
  5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
  5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4],
};
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGLB(path) {
  const buf = readFileSync(path);
  let off = 12, json = null, bin = null;
  const total = buf.readUInt32LE(8);
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
  const rd = { 5126: (o) => dv.getFloat32(o, true) }[a.componentType];
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

const { json, bin } = readGLB('./assets/map/haven.glb');
const world = new Array(json.nodes.length);
const visit = (i, p) => {
  world[i] = p ? mul(p, nodeMatrix(json.nodes[i])) : nodeMatrix(json.nodes[i]);
  for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
};
for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

const R = new Float64Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);
const bmin = [Infinity, Infinity, Infinity];
const bmax = [-Infinity, -Infinity, -Infinity];

json.nodes.forEach((node, ni) => {
  if (node.mesh === undefined) return;
  const M = mul(world[ni], R);
  const mesh = json.meshes[node.mesh];
  for (const prim of mesh.primitives) {
    if (prim.mode !== undefined && prim.mode !== 4) continue;
    const pos = accessor(json, bin, prim.attributes.POSITION);
    for (let i = 0; i < pos.length; i += 3) {
      const p = apply(M, pos[i], pos[i + 1], pos[i + 2]);
      for (let k = 0; k < 3; k++) {
        const v = p[k] * 0.1;
        if (v < bmin[k]) bmin[k] = v;
        if (v > bmax[k]) bmax[k] = v;
      }
    }
  }
});

const cx = (bmin[0] + bmax[0]) / 2, cz = (bmin[2] + bmax[2]) / 2;
console.log('Haven original bounds before centering:');
console.log('X:', bmin[0], 'to', bmax[0], 'center cx =', cx);
console.log('Y:', bmin[1], 'to', bmax[1]);
console.log('Z:', bmin[2], 'to', bmax[2], 'center cz =', cz);
