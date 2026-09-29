import fs from 'node:fs';
import * as THREE from '../vendor/three/build/three.module.js';

// We can test ground heights using Collision class
const buf = fs.readFileSync('./assets/map_rust/collision.bin');
const b = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

// Header: [0..11]
const nTri = b[10] | 0;
console.log('Rust triangles:', nTri);

// Test ground height by raycasting down from y=20
// Let's create an instance of Collision
import { Collision } from '../src/world/collision.js';

const col = new Collision(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const testPoints = [
  [-12, -4], [12, 4], [-15, 6], [15, -6], [-10, 10], [10, -10],
  [-18, 0], [18, 0], [-6, -14], [6, 14], [-14, -10], [14, 10],
  [0, -8], [0, 8], [-8, 8], [8, -8]
];

console.log('Testing Rust perimeter spawn points:');
const validSpawns = [];
testPoints.forEach(([x, z]) => {
  const gy = col.groundHeight(x, z, 10, 15);
  if (gy !== null && gy > 3.0 && gy < 4.2) {
    validSpawns.push([x, +(gy + 0.12).toFixed(2), z]);
  }
});

console.log('Valid perimeter spawns for Rust count:', validSpawns.length);
console.log(JSON.stringify(validSpawns, null, 2));
