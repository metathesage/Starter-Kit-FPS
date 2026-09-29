import * as THREE from '../vendor/three/build/three.module.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';

// Check in Three
const loader = new GLTFLoader();
const buf1 = fs.readFileSync('./assets/chars/mai_maid_combat_ready.glb');
const buf2 = fs.readFileSync('./assets/chars/maid.glb');

loader.parse(buf1.buffer.slice(buf1.byteOffset, buf1.byteOffset + buf1.byteLength), '', gltf1 => {
  const box1 = new THREE.Box3().setFromObject(gltf1.scene);
  const size1 = box1.getSize(new THREE.Vector3());
  console.log('mai_maid_combat_ready raw size:', size1);

  loader.parse(buf2.buffer.slice(buf2.byteOffset, buf2.byteOffset + buf2.byteLength), '', gltf2 => {
    const box2 = new THREE.Box3().setFromObject(gltf2.scene);
    const size2 = box2.getSize(new THREE.Vector3());
    console.log('maid.glb raw size:', size2);
  });
});
