import { readFileSync } from 'node:fs';
import { Collision } from '../src/world/collision.js';

const buf = readFileSync('./assets/map/collision.bin');
const col = new Collision(buf);
const meta = JSON.parse(readFileSync('./assets/map/map.json', 'utf8'));

console.log('Testing Haven spawns on Collision BVH:');
meta.spawns.forEach((sp, idx) => {
  const gy = col.groundHeight(sp[0], sp[2], sp[1] + 5, 15);
  console.log(`Spawn [${idx}]: (${sp[0]}, ${sp[1]}, ${sp[2]}) -> Ground Y = ${gy?.toFixed(2)} (diff: ${(gy - sp[1]).toFixed(2)}m)`);
});

const k = meta.koth;
const ky = col.groundHeight(k.x, k.z, k.y + 5, 15);
console.log(`KOTH: (${k.x}, ${k.y}, ${k.z}) -> Ground Y = ${ky?.toFixed(2)} (diff: ${(ky - k.y).toFixed(2)}m)`);
