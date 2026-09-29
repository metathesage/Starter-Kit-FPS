import fs from 'node:fs';

const path = '../Maps/halo_4multiplayerdefaulthaven.glb';
const buf = fs.readFileSync(path);
console.log('Haven size:', (buf.length / 1048576).toFixed(2), 'MB');
