import fs from 'node:fs';
import { Collision } from '../src/world/collision.js';

const buf = fs.readFileSync('./assets/map_lockout/collision.bin');
const col = new Collision(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const testPoints = [
  [0, 0], [4.14, 1.74], [2.13, -3.96], [-2.32, -5.08], [6.5, -2.25],
  [-7.2, 0.5], [7.2, -0.5], [-3.5, 4.0], [5.0, 4.0], [-1.0, -8.0],
  [-5.0, -2.0], [3.0, -6.0], [0.5, 7.0], [-6.0, 5.0]
];

console.log('Testing Lockout spawn points:');
const validSpawns = [];
testPoints.forEach(([x, z]) => {
  const gy = col.groundHeight(x, z, 15, 25);
  if (gy !== null && !isNaN(gy)) {
    console.log(`Pos (${x}, ${z}): Ground Y = ${gy.toFixed(2)}`);
    validSpawns.push([x, +(gy + 0.15).toFixed(2), z]);
  } else {
    console.log(`Pos (${x}, ${z}): Miss`);
  }
});

console.log('Valid spawns for Lockout count:', validSpawns.length);
console.log(JSON.stringify(validSpawns, null, 2));
