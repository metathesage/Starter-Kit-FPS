import fs from 'node:fs';

const buf = fs.readFileSync('./assets/map_lockout/lockout.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('Lockout extensions:', gltf.extensionsUsed, gltf.extensionsRequired);
console.log('Lockout materials count:', (gltf.materials || []).length);
console.log('Sample material 0:', JSON.stringify(gltf.materials[0], null, 2));
