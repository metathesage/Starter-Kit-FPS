import fs from 'node:fs';

const rust = JSON.parse(fs.readFileSync('./assets/map_rust/map.json'));
console.log('Rust bounds:', rust.bounds);
console.log('Rust spawns (first 8):', rust.spawns.slice(0, 8));

const lockout = JSON.parse(fs.readFileSync('./assets/map_lockout/map.json'));
console.log('Lockout bounds:', lockout.bounds);
console.log('Lockout spawns (first 8):', lockout.spawns.slice(0, 8));
