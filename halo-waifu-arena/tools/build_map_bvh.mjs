#!/usr/bin/env node
/**
 * Universal Map Baker: Builds compliant collision.bin (NF=13 BVH), nav.bin, and map.json
 * compatible with src/world/collision.js.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const COMP = {
  5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2],
  5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4],
};
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGLB(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a GLB`);
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
  if (!json || !bin) throw new Error(`${path} missing json/bin chunk`);
  return { json, bin };
}

function accessor(json, bin, idx) {
  const a = json.accessors[idx];
  const [Ctor, sz] = COMP[a.componentType];
  const n = NCOMP[a.type];
  const bv = json.bufferViews[a.bufferView];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = bv.byteStride ?? sz * n;
  if (stride === sz * n) return new Ctor(bin.buffer, bin.byteOffset + off, a.count * n);
  const out = new Ctor(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const rd = { 5120: (o) => dv.getInt8(o), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true), 5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = rd(off + i * stride + k * sz);
  return out;
}

function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation ?? [0, 0, 0], r = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1];
  const [x, y, z, w] = r, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

const apply = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

export function buildMap({ srcPath, outDir, unit, glbTargetName, mapName, mapMode }) {
  console.log(`\n========================================`);
  console.log(`[BAKE] Building ${mapName} from ${srcPath}`);
  console.log(`[BAKE] Output: ${outDir}, Unit Scale: ${unit}`);
  mkdirSync(outDir, { recursive: true });

  const { json, bin } = readGLB(srcPath);
  const world = new Array(json.nodes.length);
  const visit = (i, p) => {
    world[i] = p ? mul(p, nodeMatrix(json.nodes[i])) : nodeMatrix(json.nodes[i]);
    for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
  };
  for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

  const positions = [];
  const indices = [];
  const matOfTri = [];
  let vcount = 0;
  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];

  json.nodes.forEach((node, ni) => {
    if (node.mesh === undefined) return;
    const M = world[ni];
    const mesh = json.meshes[node.mesh];
    for (const prim of mesh.primitives) {
      if (prim.mode !== undefined && prim.mode !== 4) continue;
      const pos = accessor(json, bin, prim.attributes.POSITION);
      const idx = prim.indices !== undefined ? accessor(json, bin, prim.indices) : null;
      const nT = Math.floor((idx ? idx.length : pos.length / 3) / 3);
      const base = vcount;
      for (let i = 0; i < pos.length; i += 3) {
        const p = apply(M, pos[i], pos[i + 1], pos[i + 2]);
        positions.push(p[0] * unit, p[1] * unit, p[2] * unit);
        for (let k = 0; k < 3; k++) {
          const v = positions[positions.length - 3 + k];
          if (v < bmin[k]) bmin[k] = v;
          if (v > bmax[k]) bmax[k] = v;
        }
        vcount++;
      }
      const matName = json.materials?.[prim.material ?? 0]?.name ?? 'default';
      for (let t = 0; t < nT; t++) {
        const a = idx ? idx[t * 3] : t * 3;
        const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
        const c = idx ? idx[t * 3 + 2] : t * 3 + 2;
        indices.push(base + a, base + b, base + c);
        matOfTri.push(matName);
      }
    }
  });

  const cx = (bmin[0] + bmax[0]) / 2;
  const cz = (bmin[2] + bmax[2]) / 2;
  console.log(`[BAKE] Center offset: cx=${cx.toFixed(3)}, cz=${cz.toFixed(3)}`);

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] -= cx;
    positions[i + 2] -= cz;
  }
  bmin[0] -= cx; bmax[0] -= cx;
  bmin[2] -= cz; bmax[2] -= cz;

  const nTri = indices.length / 3;
  console.log(`[BAKE] ${vcount} verts, ${nTri} tris`);
  console.log(`[BAKE] Bounds (m): X[${bmin[0].toFixed(1)}, ${bmax[0].toFixed(1)}] Y[${bmin[1].toFixed(1)}, ${bmax[1].toFixed(1)}] Z[${bmin[2].toFixed(1)}, ${bmax[2].toFixed(1)}]`);

  // Build Centroids
  const centroids = new Float32Array(nTri * 3);
  for (let t = 0; t < nTri; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    for (let k = 0; k < 3; k++) {
      centroids[t * 3 + k] = (positions[a + k] + positions[b + k] + positions[c + k]) / 3;
    }
  }

  const triOrder = new Uint32Array(nTri);
  for (let t = 0; t < nTri; t++) triOrder[t] = t;

  const scratch = new Float32Array(6);
  function triBounds(t, out) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    for (let k = 0; k < 3; k++) {
      const va = positions[a + k], vb = positions[b + k], vc = positions[c + k];
      out[k] = Math.min(va, vb, vc);
      out[k + 3] = Math.max(va, vb, vc);
    }
  }

  // BVH Construction (NF = 13 floats per node, compatible with src/world/collision.js)
  const LEAF = 8;
  const DEPTH_LIMIT = 24;
  const nodes = [];
  let nLeaves = 0, maxDepth = 0;

  function buildNode(start, count, depth) {
    const nmin = [Infinity, Infinity, Infinity], nmax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) {
      triBounds(triOrder[start + i], scratch);
      for (let k = 0; k < 3; k++) {
        if (scratch[k] < nmin[k]) nmin[k] = scratch[k];
        if (scratch[k + 3] > nmax[k]) nmax[k] = scratch[k + 3];
      }
    }
    if (depth > maxDepth) maxDepth = depth;

    if (count <= LEAF || depth >= DEPTH_LIMIT) {
      const id = nodes.length / 13;
      nodes.push(nmin[0], nmin[1], nmin[2], nmax[0], nmax[1], nmax[2], start, count, 0, -1, -1, 0, 0);
      nLeaves++;
      return id;
    }

    const ex = nmax[0] - nmin[0], ey = nmax[1] - nmin[1], ez = nmax[2] - nmin[2];
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const slice = Array.from(triOrder.subarray(start, start + count));
    slice.sort((p, q) => centroids[p * 3 + axis] - centroids[q * 3 + axis]);
    for (let i = 0; i < slice.length; i++) triOrder[start + i] = slice[i];
    const half = count >> 1;

    const id = nodes.length / 13;
    nodes.push(nmin[0], nmin[1], nmin[2], nmax[0], nmax[1], nmax[2], start, 0, axis, -1, -1, 0, 0);
    const l = buildNode(start, half, depth + 1);
    const r = buildNode(start + half, count - half, depth + 1);
    nodes[id * 13 + 9] = l;
    nodes[id * 13 + 10] = r;
    return id;
  }

  buildNode(0, nTri, 0);
  const bvh = new Float32Array(nodes);
  const nNodes = bvh.length / 13;
  console.log(`[BAKE] BVH nodes: ${nNodes} (leaves: ${nLeaves}), max depth: ${maxDepth}`);

  // Write collision.bin
  {
    const pos = new Float32Array(positions);
    const idx = new Uint32Array(indices);
    const order = new Uint32Array(triOrder);
    const mtl = new Uint16Array(nTri);
    const nameList = [...new Set(matOfTri)].sort();
    const mtlLookup = new Map(nameList.map((n, i) => [n, i]));
    for (let t = 0; t < nTri; t++) mtl[t] = mtlLookup.get(matOfTri[t]);

    const blob = [];
    const HEAD_FLOATS = 12;
    const head = new Float32Array(HEAD_FLOATS);
    head.set([pos.length / 3, nTri, nNodes, nameList.length], 0);
    head.set(bmin, 4);
    head.set(bmax, 7);
    blob.push(Buffer.from(head.buffer));
    blob.push(Buffer.from(pos.buffer));
    blob.push(Buffer.from(idx.buffer));
    blob.push(Buffer.from(order.buffer));
    blob.push(Buffer.from(mtl.buffer));
    if (mtl.byteLength % 4 !== 0) {
      blob.push(Buffer.alloc(4 - (mtl.byteLength % 4)));
    }
    blob.push(Buffer.from(bvh.buffer));
    const nameBytes = Buffer.from(JSON.stringify(nameList), 'utf8');
    const sizeBuf = new Uint32Array([nameBytes.length]);
    blob.push(Buffer.from(sizeBuf.buffer));
    blob.push(nameBytes);
    const out = Buffer.concat(blob);
    writeFileSync(resolve(outDir, 'collision.bin'), out);
    console.log(`[BAKE] collision.bin written: ${(out.length / 1048576).toFixed(2)} MB`);
  }

  // Copy visual mesh
  copyFileSync(srcPath, resolve(outDir, glbTargetName));
  console.log(`[BAKE] Copied visual GLB to ${outDir}/${glbTargetName}`);

  // Find walkable candidate positions (floor triangles with upward normal)
  const floorPoints = [];
  for (let t = 0; t < nTri; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx2 = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx2 - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-5 && (ny / len) > 0.85) { // Upward facing surface
      floorPoints.push({
        x: +((ax + bx + cx2) / 3).toFixed(2),
        y: +((ay + by + cy) / 3).toFixed(2) + 0.1,
        z: +((az + bz + cz) / 3).toFixed(2)
      });
    }
  }

  // Filter distinct spawns
  const spawns = [];
  floorPoints.sort((p1, p2) => Math.hypot(p1.x, p1.z) - Math.hypot(p2.x, p2.z));
  for (const fp of floorPoints) {
    if (spawns.length >= 16) break;
    if (spawns.every(s => Math.hypot(s[0] - fp.x, s[2] - fp.z) > 4.5)) {
      spawns.push([fp.x, fp.y, fp.z]);
    }
  }
  if (spawns.length === 0) {
    spawns.push([0, bmin[1] + 1.0, 0]);
  }

  // Team Spawns
  const ctSpawns = spawns.filter(s => s[2] > 0);
  const tSpawns = spawns.filter(s => s[2] <= 0);

  const kothCenter = spawns[0] ? { x: spawns[0][0], y: spawns[0][1], z: spawns[0][2], radius: 5.5 } : { x: 0, y: 0, z: 0, radius: 5.0 };

  const mapJson = {
    source: glbTargetName,
    name: mapName,
    mode: mapMode,
    unit: unit,
    offset: [-cx, 0, -cz],
    cx: cx,
    cz: cz,
    scale: unit,
    tris: nTri,
    verts: vcount,
    bounds: {
      min: bmin.map(v => +v.toFixed(2)),
      max: bmax.map(v => +v.toFixed(2))
    },
    spawns: spawns,
    ctSpawns: ctSpawns.length >= 4 ? ctSpawns : spawns.slice(0, 4),
    tSpawns: tSpawns.length >= 4 ? tSpawns : spawns.slice(Math.min(4, spawns.length - 1)),
    koth: kothCenter
  };

  writeFileSync(resolve(outDir, 'map.json'), JSON.stringify(mapJson, null, 2));
  console.log(`[BAKE] map.json written with ${spawns.length} authentic spawns.`);
}

// Execute bakes for Lockout and Rust if run directly
if (process.argv[1] && process.argv[1].endsWith('build_map_bvh.mjs')) {
  buildMap({
    srcPath: resolve(ROOT, '../Maps/halo_onlinelockout.glb'),
    outDir: resolve(ROOT, 'assets/map_lockout'),
    unit: 0.22,
    glbTargetName: 'lockout.glb',
    mapName: 'Halo Lockout',
    mapMode: 'halo'
  });

  buildMap({
    srcPath: resolve(ROOT, '../Maps/rust.glb'),
    outDir: resolve(ROOT, 'assets/map_rust'),
    unit: 0.25,
    glbTargetName: 'rust.glb',
    mapName: 'Call of Duty Rust',
    mapMode: 'halo'
  });
}
