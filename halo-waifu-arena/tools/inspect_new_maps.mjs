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

function checkMap(path, name) {
  const { json, bin } = readGLB(path);
  console.log(`\n=== ${name} ===`);
  console.log('Meshes:', json.meshes?.length, 'Nodes:', json.nodes?.length);
  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  let vcount = 0;
  for (const m of json.meshes || []) {
    for (const p of m.primitives || []) {
      if (p.attributes.POSITION !== undefined) {
        const a = json.accessors[p.attributes.POSITION];
        if (a.min && a.max) {
          for (let k = 0; k < 3; k++) {
            if (a.min[k] < bmin[k]) bmin[k] = a.min[k];
            if (a.max[k] > bmax[k]) bmax[k] = a.max[k];
          }
        }
        vcount += a.count;
      }
    }
  }
  console.log(`Raw bounds: [${bmin.map(v=>v.toFixed(1))}] to [${bmax.map(v=>v.toFixed(1))}]`);
  console.log(`Dimensions: X=${(bmax[0]-bmin[0]).toFixed(1)}, Y=${(bmax[1]-bmin[1]).toFixed(1)}, Z=${(bmax[2]-bmin[2]).toFixed(1)}`);
  console.log('Verts:', vcount);
}

checkMap('../Maps/halo_onlinelockout.glb', 'Halo Online Lockout');
checkMap('../Maps/rust.glb', 'Rust');
