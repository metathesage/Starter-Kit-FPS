import fs from 'node:fs';
import { Collision } from '../src/world/collision.js';

const buf = fs.readFileSync('./assets/map/collision.bin');
const col = new Collision(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const havenMeta = JSON.parse(fs.readFileSync('./assets/map/map.json'));
console.log('Testing Haven Spawns against collision.bin:');
havenMeta.spawns.slice(0, 10).forEach((s, idx) => {
  const gy = col.groundHeight(s[0], s[2], s[1] + 5, 10);
  console.log(`Spawn ${idx} at [${s[0]}, ${s[1]}, ${s[2]}]: groundHeight = ${gy !== null ? gy.toFixed(3) : 'MISS'}`);
});
