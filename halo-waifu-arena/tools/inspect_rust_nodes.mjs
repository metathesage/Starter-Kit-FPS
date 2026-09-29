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

const { json } = readGLB('../Maps/rust.glb');
console.log('Rust Nodes:');
json.nodes.forEach((n, idx) => {
  console.log(`[${idx}] ${n.name}: mesh=${n.mesh}, rot=${JSON.stringify(n.rotation)}, scale=${JSON.stringify(n.scale)}, trans=${JSON.stringify(n.translation)}`);
});
