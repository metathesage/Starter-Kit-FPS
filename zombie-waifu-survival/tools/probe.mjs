#!/usr/bin/env node
// Read-only GLB deep inspector: transformed world bounds, height profile, joint names, clips.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readGLB(path) {
  const buf = readFileSync(path);
  const total = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  return { json, bin };
}

function accessorArray(json, bin, idx) {
  const a = json.accessors[idx];
  const [Ctor, sz] = COMP[a.componentType];
  const n = NCOMP[a.type];
  const bv = json.bufferViews[a.bufferView];
  const byteOff = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = bv.byteStride ?? sz * n;
  if (stride === sz * n) {
    return new Ctor(bin.buffer, bin.byteOffset + byteOff, a.count * n);
  }
  const out = new Ctor(a.count * n);
  for (let i = 0; i < a.count; i++) {
    const src = byteOff + i * stride;
    for (let k = 0; k < n; k++) {
      out[i * n + k] = new Ctor(bin.buffer, bin.byteOffset + src + k * sz, 1)[0];
    }
  }
  return out;
}

function mat4MulVec(m, x, y, z, w = 1) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const t = node.translation ?? [0, 0, 0];
  const r = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}

function nodeWorldMatrices(json) {
  const world = new Array(json.nodes.length);
  const visit = (i, parent) => {
    const m = nodeMatrix(json.nodes[i]);
    world[i] = parent ? mul(parent, m) : m;
    for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
  };
  for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);
  return world;
}

function transformGeometry(path, { sample = 1 } = {}) {
  const { json, bin } = readGLB(path);
  const world = nodeWorldMatrices(json);
  const gmin = [Infinity, Infinity, Infinity];
  const gmax = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  const perMesh = [];

  json.nodes.forEach((node, ni) => {
    if (node.mesh === undefined) return;
    const W = world[ni];
    const mesh = json.meshes[node.mesh];
    let mTris = 0;
    for (const prim of mesh.primitives) {
      const pos = accessorArray(json, bin, prim.attributes.POSITION);
      const idxAcc = prim.indices !== undefined ? json.accessors[prim.indices] : null;
      mTris += Math.floor((idxAcc ? idxAcc.count : pos.length / 3) / 3);
      if (sample > 0) {
        for (let i = 0; i < pos.length; i += 3) {
          const p = mat4MulVec(W, pos[i], pos[i + 1], pos[i + 2]);
          for (let k = 0; k < 3; k++) { gmin[k] = Math.min(gmin[k], p[k]); gmax[k] = Math.max(gmax[k], p[k]); }
        }
      }
    }
    tris += mTris;
    perMesh.push({ node: node.name, mesh: mesh.name, tris: mTris });
  });

  return { json, bin, world, gmin, gmax, tris, perMesh };
}

function cmdMap(path) {
  const g = transformGeometry(path);
  const { gmin, gmax, tris } = g;
  // Sample a coarse height histogram on the dominant horizontal plane.
  const size = [gmax[0] - gmin[0], gmax[1] - gmin[1], gmax[2] - gmin[2]].map((v) => +v.toFixed(1));
  // dominant horizontal axis = the one NOT vertical (0/2)
  const hs = { x: size[0], z: size[2] };
  const s = size[0] + size[1] + size[2] || 1;
  const dominant = size[0] >= size[2] ? 'x' : 'z';
  return {
    file: basename(path),
    worldBounds: { min: gmin.map((v) => +v.toFixed(2)), max: gmax.map((v) => +v.toFixed(2)) },
    size,
    verticalExtent: size[1] / s > 0.55 ? 'Y (Y is dominant - likely Z-up source)' : 'Y',
    dominantPlanarAxis: dominant,
    tris,
    topMeshes: g.perMesh.sort((a, b) => b.tris - a.tris).slice(0, 5),
  };
}

function cmdRig(path) {
  const { json } = readGLB(path);
  const sk = json.skins?.[0];
  return {
    file: basename(path),
    mb: +(readFileSync(path).length / 1048576).toFixed(2),
    meshes: json.meshes?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    materials: json.materials?.length ?? 0,
    animations: json.animations?.length ?? 0,
    animNames: (json.animations ?? []).map((a) => a.name),
    joints: sk?.joints?.length ?? 0,
    jointNames: sk ? sk.joints.map((j) => json.nodes[j].name) : [],
  };
}

function cmdClips(path) {
  const { json } = readGLB(path);
  return { file: basename(path), mb: +(readFileSync(path).length / 1048576).toFixed(2), clips: (json.animations ?? []).map((a) => a.name) };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) {
  const [cmd, ...files] = process.argv.slice(2);
  let out;
  if (cmd === 'map') out = files.map(cmdMap);
  else if (cmd === 'rig') out = files.map(cmdRig);
  else if (cmd === 'clips') out = files.map(cmdClips);
  else { console.error('usage: probe.mjs map|rig|clips <files...>'); process.exit(1); }
  console.log(JSON.stringify(out, null, 1));
}
