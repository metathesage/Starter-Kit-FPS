import { readFileSync } from 'node:fs';

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

const { json } = readGLB('../Maps/halo_onlinelockout.glb');
console.log('Nodes:');
json.nodes.forEach((n, idx) => {
  console.log(`[${idx}] ${n.name}: mesh=${n.mesh}, rot=${JSON.stringify(n.rotation)}, scale=${JSON.stringify(n.scale)}, trans=${JSON.stringify(n.translation)}`);
});
