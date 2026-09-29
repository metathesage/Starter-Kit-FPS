import fs from 'node:fs';

const buf = fs.readFileSync('./assets/map/haven.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('Extensions used:', gltf.extensionsUsed);
console.log('Extensions required:', gltf.extensionsRequired);

for (let i = 0; i < 5; i++) {
  const mat = gltf.materials[i];
  console.log(`Material ${mat.name}:`, JSON.stringify(mat.extensions, null, 2));
}
