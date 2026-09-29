import fs from 'node:fs';
import { Collision } from '../src/world/collision.js';

const buf = fs.readFileSync('./assets/map/collision.bin');
const col = new Collision(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

console.log('Testing Haven grid around spawn 0:');
for (let dx = -2.0; dx <= 2.0; dx += 0.5) {
  for (let dz = -2.0; dz <= 2.0; dz += 0.5) {
    const x = +(6.32 + dx).toFixed(2);
    const z = +(-69.67 + dz).toFixed(2);
    const gy = col.groundHeight(x, z, 5, 20);
    console.log(`x=${x}, z=${z} -> gy=${gy}`);
  }
}
