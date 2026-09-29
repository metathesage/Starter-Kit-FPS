import fs from 'node:fs';
import path from 'node:path';

// Load Three and GLTFLoader in node environment
const THREE = await import('../vendor/three/build/three.module.js');
const { GLTFLoader } = await import('../vendor/three/examples/jsm/loaders/GLTFLoader.js');

const glbPath = './assets/chars/main_heroine_miyazawa_combat_ready.glb';
const buf = fs.readFileSync(glbPath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const model = gltf.scene;
  console.log('Parsed successfully. Children count:', model.children.length);
  const box = new THREE.Box3().setFromObject(model);
  console.log('Unscaled Box Min:', box.min.x.toFixed(3), box.min.y.toFixed(3), box.min.z.toFixed(3));
  console.log('Unscaled Box Max:', box.max.x.toFixed(3), box.max.y.toFixed(3), box.max.z.toFixed(3));
  console.log('Unscaled Size:', (box.max.x - box.min.x).toFixed(3), (box.max.y - box.min.y).toFixed(3), (box.max.z - box.min.z).toFixed(3));
  
  let meshCount = 0;
  model.traverse(c => {
    if (c.isMesh) {
      meshCount++;
      const mb = new THREE.Box3().setFromObject(c);
      console.log(`Mesh ${meshCount} (${c.name}): box=[${mb.min.y.toFixed(3)}, ${mb.max.y.toFixed(3)}], mat=${c.material ? c.material.name : 'none'}, vis=${c.visible}`);
    }
  });
  console.log('Total meshes:', meshCount);
}, (err) => {
  console.error('Error parsing GLB:', err);
});
