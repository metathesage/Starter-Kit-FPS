import fs from 'node:fs';

const buf = fs.readFileSync('./assets/map/haven.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('Materials (first 3):');
console.log(JSON.stringify(gltf.materials.slice(0, 3), null, 2));

console.log('Images (first 3):');
console.log(JSON.stringify(gltf.images.slice(0, 3), null, 2));
