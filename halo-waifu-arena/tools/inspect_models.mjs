import fs from 'node:fs';

// Quick inspect of GLTF JSON chunk
function inspectGlb(path) {
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
  const gltf = JSON.parse(jsonStr);
  const anims = (gltf.animations || []).map(a => a.name);
  const posAcc = gltf.accessors.filter(a => a.min && a.max && a.type === 'VEC3');
  let overallMin = [Infinity, Infinity, Infinity];
  let overallMax = [-Infinity, -Infinity, -Infinity];
  posAcc.forEach(a => {
    for (let i = 0; i < 3; i++) {
      overallMin[i] = Math.min(overallMin[i], a.min[i]);
      overallMax[i] = Math.max(overallMax[i], a.max[i]);
    }
  });
  const height = overallMax[1] - overallMin[1];
  console.log(`=== ${path} ===`);
  console.log('Height:', height.toFixed(3), 'Min Y:', overallMin[1].toFixed(3), 'Max Y:', overallMax[1].toFixed(3));
  console.log('Overall Min:', overallMin.map(x => x.toFixed(2)), 'Max:', overallMax.map(x => x.toFixed(2)));
}

inspectGlb('./assets/chars/mai_maid_combat_ready.glb');
inspectGlb('./assets/chars/maid.glb');
inspectGlb('./assets/chars/main_heroine_miyazawa_combat_ready.glb');
