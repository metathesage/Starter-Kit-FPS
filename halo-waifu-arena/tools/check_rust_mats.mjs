import fs from 'node:fs';

const buf = fs.readFileSync('./assets/map_rust/rust.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('Rust extensions:', gltf.extensionsUsed, gltf.extensionsRequired);
console.log('Rust materials count:', (gltf.materials || []).length);
if (gltf.materials && gltf.materials[0]) {
  console.log('Rust sample material 0:', JSON.stringify(gltf.materials[0], null, 2));
}
