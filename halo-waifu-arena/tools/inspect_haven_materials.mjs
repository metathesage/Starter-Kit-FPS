import fs from 'node:fs';

const buf = fs.readFileSync('./assets/map/haven.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('Haven materials count:', (gltf.materials || []).length);
console.log('Sample materials:', (gltf.materials || []).slice(0, 5));
console.log('Meshes count:', (gltf.meshes || []).length);
console.log('Textures count:', (gltf.textures || []).length);
console.log('Images count:', (gltf.images || []).length);
