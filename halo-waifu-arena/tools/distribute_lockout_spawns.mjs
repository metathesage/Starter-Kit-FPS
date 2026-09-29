import fs from 'node:fs';
import { Collision } from '../src/world/collision.js';

const buf = fs.readFileSync('./assets/map_lockout/collision.bin');
const col = new Collision(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const candidates = [];
for (let x = -10; x <= 10; x += 1.5) {
  for (let z = -8; z <= 8; z += 1.5) {
    const gy = col.groundHeight(x, z, 15, 25);
    if (gy !== null && !isNaN(gy) && gy > -10 && gy < 20) {
      // Check ceiling clearance (at least 2.2m above head)
      const ceil = col.raycast({ x, y: gy + 0.2, z }, { x: 0, y: 1, z: 0 }, 2.5, 0.05);
      if (!ceil) {
        candidates.push([+x.toFixed(2), +(gy + 0.15).toFixed(2), +z.toFixed(2)]);
      }
    }
  }
}

// Select 10 well-distributed spawns
const selected = [];
for (const cand of candidates) {
  if (selected.length >= 10) break;
  const isFar = selected.every(s => Math.hypot(s[0] - cand[0], s[2] - cand[2]) > 3.0);
  if (isFar) selected.push(cand);
}

console.log('Selected 10 clean spawns for Lockout:');
console.log(JSON.stringify(selected, null, 2));
