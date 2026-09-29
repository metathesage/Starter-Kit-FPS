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
  const rd = { 5126: (o) => dv.getFloat32(o, true), 5125: (o) => dv.getUint32(o, true), 5123: (o) => dv.getUint16(o, true) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = rd(off + i * stride + k * sz);
  return out;
}

const { json, bin } = readGLB('../Maps/halo_onlinelockout.glb');

// Look for walkable floor heights
const floorY = [];
for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    const pos = accessor(json, bin, prim.attributes.POSITION);
    const idx = accessor(json, bin, prim.indices);
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
      const ax = pos[i1] - pos[i0], ay = pos[i1 + 1] - pos[i0 + 1], az = pos[i1 + 2] - pos[i0 + 2];
      const bx = pos[i2] - pos[i0], by = pos[i2 + 1] - pos[i0 + 1], bz = pos[i2 + 2] - pos[i0 + 2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-6 && ny / len > 0.95) {
        floorY.push((pos[i0 + 1] + pos[i1 + 1] + pos[i2 + 1]) / 3);
      }
    }
  }
}

floorY.sort((a, b) => a - b);
const clusters = [];
let cur = [floorY[0]];
for (let i = 1; i < floorY.length; i++) {
  if (floorY[i] - cur[cur.length - 1] < 0.25) {
    cur.push(floorY[i]);
  } else {
    if (cur.length > 50) clusters.push({ y: cur.reduce((a, b) => a + b, 0) / cur.length, count: cur.length });
    cur = [floorY[i]];
  }
}
if (cur.length > 50) clusters.push({ y: cur.reduce((a, b) => a + b, 0) / cur.length, count: cur.length });

console.log('Main Floor Levels (raw units):');
clusters.sort((a, b) => b.count - a.count).slice(0, 10).sort((a,b)=>a.y-b.y).forEach(c => {
  console.log(`  y = ${c.y.toFixed(2)} (${c.count} tris)`);
});
