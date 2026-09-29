import fs from 'node:fs';

// 1. Rust map.json
const rustSpawns = [
  [-12, 3.75, -4],
  [12, 3.75, 4],
  [-15, 3.75, 6],
  [15, 3.75, -6],
  [-10, 3.75, 10],
  [10, 3.75, -10],
  [-18, 3.75, 0],
  [18, 3.75, 0],
  [-6, 3.75, -14],
  [6, 3.75, 14],
  [-14, 3.75, -10],
  [14, 3.75, 10],
  [-8, 3.75, 8],
  [8, 3.75, -8]
];

const rust = JSON.parse(fs.readFileSync('./assets/map_rust/map.json'));
rust.spawns = rustSpawns;
rust.koth = { x: 0.06, y: 3.73, z: 0.15, radius: 5.5 };
fs.writeFileSync('./assets/map_rust/map.json', JSON.stringify(rust, null, 2));
console.log('Updated map_rust/map.json with 14 perimeter spawns');

// 2. Lockout map.json
const lockoutSpawns = [
  [-1, 6.49, 2.5],     // Center library bridge
  [-5.5, 1.19, 2.5],   // Lower battle ramp
  [-2.5, 1.40, -6.5],  // Low courtyard
  [0.5, 3.59, -8.0],   // Snipe tower approach
  [-8.5, -0.88, 1.0],  // Bottom lift entrance
  [-10, 13.08, -6.5],  // Upper sniper perch
  [-5.5, 10.99, -2.0], // Top tower bridge
  [-2.5, 11.53, -0.5], // Top ramp ledge
  [0.5, 14.78, -3.5],  // High gantry
  [-10, -0.70, -2.0]   // Lower hallway
];

const lockout = JSON.parse(fs.readFileSync('./assets/map_lockout/map.json'));
lockout.spawns = lockoutSpawns;
lockout.koth = { x: -1.0, y: 6.5, z: 2.5, radius: 5.0 };
fs.writeFileSync('./assets/map_lockout/map.json', JSON.stringify(lockout, null, 2));
console.log('Updated map_lockout/map.json with 10 multi-level spawns');
