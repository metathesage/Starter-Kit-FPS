import fs from 'node:fs';

function inspectSocket(path) {
  const buf = fs.readFileSync(path);
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
  const nodes = json.nodes.filter(n => n.name && n.name.toLowerCase().includes('weapon_socket_r'));
  console.log(`=== ${path} ===`);
  console.log(nodes);
}

inspectSocket('./assets/chars/mai_maid_combat_ready.glb');
inspectSocket('./assets/chars/main_heroine_miyazawa_combat_ready.glb');
