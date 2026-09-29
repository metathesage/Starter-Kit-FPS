import fs from 'node:fs';

function convertGlb(srcPath) {
  const buf = fs.readFileSync(srcPath);

  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const totalLength = buf.readUInt32LE(8);

  const jsonLen = buf.readUInt32LE(12);
  const jsonType = buf.readUInt32LE(16);

  const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
  const gltf = JSON.parse(jsonStr);

  const binChunkOffset = 20 + jsonLen;
  const binChunk = buf.subarray(binChunkOffset);

  console.log(`Processing ${srcPath}...`);
  console.log('Original JSON length:', jsonLen, 'Bin chunk length:', binChunk.length);

  // Remove KHR_materials_pbrSpecularGlossiness from extensions
  if (gltf.extensionsUsed) {
    gltf.extensionsUsed = gltf.extensionsUsed.filter(e => e !== 'KHR_materials_pbrSpecularGlossiness');
    if (gltf.extensionsUsed.length === 0) delete gltf.extensionsUsed;
  }
  if (gltf.extensionsRequired) {
    gltf.extensionsRequired = gltf.extensionsRequired.filter(e => e !== 'KHR_materials_pbrSpecularGlossiness');
    if (gltf.extensionsRequired.length === 0) delete gltf.extensionsRequired;
  }

  // Convert materials
  let convertedCount = 0;
  (gltf.materials || []).forEach(mat => {
    const ext = mat.extensions && mat.extensions.KHR_materials_pbrSpecularGlossiness;
    if (ext) {
      mat.pbrMetallicRoughness = mat.pbrMetallicRoughness || {};
      if (ext.diffuseFactor) {
        mat.pbrMetallicRoughness.baseColorFactor = ext.diffuseFactor;
      } else {
        mat.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
      }
      if (ext.diffuseTexture) {
        mat.pbrMetallicRoughness.baseColorTexture = ext.diffuseTexture;
      }
      mat.pbrMetallicRoughness.metallicFactor = 0.20;
      mat.pbrMetallicRoughness.roughnessFactor = 0.55;

      delete mat.extensions.KHR_materials_pbrSpecularGlossiness;
      if (mat.extensions && Object.keys(mat.extensions).length === 0) {
        delete mat.extensions;
      }
      convertedCount++;
    }
  });

  console.log(`Converted ${convertedCount} materials to standard pbrMetallicRoughness in ${srcPath}`);

  let newJsonStr = JSON.stringify(gltf);
  const padLen = (4 - (Buffer.byteLength(newJsonStr) % 4)) % 4;
  newJsonStr += ' '.repeat(padLen);
  const newJsonBuf = Buffer.from(newJsonStr, 'utf8');

  const newHeader = Buffer.alloc(12);
  const newTotalLength = 12 + 8 + newJsonBuf.length + binChunk.length;
  newHeader.writeUInt32LE(0x46546C67, 0);
  newHeader.writeUInt32LE(2, 4);
  newHeader.writeUInt32LE(newTotalLength, 8);

  const newJsonHeader = Buffer.alloc(8);
  newJsonHeader.writeUInt32LE(newJsonBuf.length, 0);
  newJsonHeader.writeUInt32LE(0x4E4F534A, 4);

  fs.copyFileSync(srcPath, srcPath + '.orig');

  const outFd = fs.openSync(srcPath, 'w');
  fs.writeSync(outFd, newHeader);
  fs.writeSync(outFd, newJsonHeader);
  fs.writeSync(outFd, newJsonBuf);
  fs.writeSync(outFd, binChunk);
  fs.closeSync(outFd);

  console.log(`Successfully rewrote ${srcPath}: ${newTotalLength} bytes.`);
}

convertGlb('./assets/map_lockout/lockout.glb');
