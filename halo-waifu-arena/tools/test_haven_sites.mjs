import fs from 'node:fs';
import { Collision } from '../src/world/collision.js';

const buf = fs.readFileSync('./assets/map/collision.bin');
const col = new Collision(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const testSites = [
  { name: 'Center Hill (KOTH)', x: -9.68, z: 18.83 },
  { name: 'Origin', x: 0, z: 0 },
  { name: 'Red Base Center', x: 0, z: -40 },
  { name: 'Blue Base Center', x: 0, z: 40 },
  { name: 'Courtyard Mid', x: 0, z: 10 },
  { name: 'Walkway Mid Safe', x: 8.5, z: -55 },
  { name: 'Top Lift', x: 12.0, z: 25 },
  { name: 'Bottom Hall', x: -12.0, z: -25 }
];

console.log('Testing Haven safe arena sites:');
testSites.forEach(s => {
  const gy = col.groundHeight(s.x, s.z, 5, 20);
  console.log(`${s.name} (${s.x}, ${s.z}) -> gy = ${gy}`);
});
