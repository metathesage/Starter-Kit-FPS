#!/usr/bin/env node
/**
 * Offline map bake for Counter-Strike map: cs_blackhawk_down.glb
 * -> collision.bin (BVH) + nav.bin (walkable grid) + map.json (metadata, spawns, sites).
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, '../Maps/cs_blackhawk_down.glb');
const OUT = resolve(ROOT, 'assets/map_cs');

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

/* ------------------------------------------------------------------ config */
const UNIT = 1.0;          // 1 source unit = 1 metre (checked from floor heights)
const NAV_CELL = 0.5;      // nav grid resolution, metres
const STEP_UP = 0.65;      // max climbable ledge, metres
const HEADROOM = 1.85;     // required clearance above a walkable surface
const AGENT_R = 0.35;      // nav agent radius

mkdirSync(OUT, { recursive: true });
console.log(`[bake-cs] source ${SRC}`);
console.log(`[bake-cs] output dir: ${OUT}`);

const { json, bin } = readGLB(SRC);
const world = new Array(json.nodes.length);
const visit = (i, p) => {
  world[i] = p ? mul(p, nodeMatrix(json.nodes[i])) : nodeMatrix(json.nodes[i]);
  for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
};
for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

// Sketchfab root node 0 already includes the -90 deg X rotation matrix
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
      positions.push(p[0] * UNIT, p[1] * UNIT, p[2] * UNIT);
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

// Center XZ around (0, 0)
const cx = (bmin[0] + bmax[0]) / 2, cz = (bmin[2] + bmax[2]) / 2;
for (let i = 0; i < positions.length; i += 3) {
  positions[i] -= cx;
  positions[i + 2] -= cz;
}
bmin[0] -= cx; bmax[0] -= cx;
bmin[2] -= cz; bmax[2] -= cz;

const nTri = indices.length / 3;
console.log(`[bake-cs] ${vcount} verts, ${nTri} tris`);
console.log(`[bake-cs] bounds m: x[${bmin[0].toFixed(1)},${bmax[0].toFixed(1)}] y[${bmin[1].toFixed(1)},${bmax[1].toFixed(1)}] z[${bmin[2].toFixed(1)},${bmax[2].toFixed(1)}]`);

/* ------------------------------------------------------------------- BVH */
const centroids = new Float32Array(nTri * 3);
for (let t = 0; t < nTri; t++) {
  const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
  for (let k = 0; k < 3; k++) {
    centroids[t * 3 + k] = (positions[a * 3 + k] + positions[b * 3 + k] + positions[c * 3 + k]) / 3;
  }
}

const triOrder = new Uint32Array(nTri);
for (let t = 0; t < nTri; t++) triOrder[t] = t;

const nodes = [];
const LEAF = 8;
const DEPTH_LIMIT = 40;

function triBounds(t, out) {
  const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
  for (let k = 0; k < 3; k++) {
    const v0 = positions[a + k], v1 = positions[b + k], v2 = positions[c + k];
    out[k] = Math.min(v0, v1, v2);
    out[k + 3] = Math.max(v0, v1, v2);
  }
  return out;
}

const scratch = new Float32Array(6);
let maxDepth = 0;
let nLeaves = 0;

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
console.log(`[bake-cs] bvh nodes ${nNodes} (leaves ${nLeaves}), depth ${maxDepth}`);

/* -------------------------------------------------------------- write BVH */
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
  blob.push(Buffer.from(bvh.buffer));
  const nameBytes = Buffer.from(JSON.stringify(nameList), 'utf8');
  const sizeBuf = new Uint32Array([nameBytes.length]);
  blob.push(Buffer.from(sizeBuf.buffer));
  blob.push(nameBytes);
  const out = Buffer.concat(blob);
  writeFileSync(resolve(OUT, 'collision.bin'), out);
  console.log(`[bake-cs] collision.bin ${(out.length / 1048576).toFixed(2)} MB`);
}

/* ------------------------------------------------------------- nav grid */
const ox = bmin[0], oz = bmin[2];
const gw = Math.max(1, Math.ceil((bmax[0] - bmin[0]) / NAV_CELL) + 1);
const gd = Math.max(1, Math.ceil((bmax[2] - bmin[2]) / NAV_CELL) + 1);
const cellArea = NAV_CELL * NAV_CELL;

const surfaces = new Map();
const key = (gx, gz) => gz * gw + gx;

function addSurface(gx, gz, y, ny, area) {
  const k = key(gx, gz);
  let arr = surfaces.get(k);
  if (!arr) surfaces.set(k, (arr = []));
  arr.push({ y, ny, area });
}

for (let t = 0; t < nTri; t++) {
  const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
  const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
  const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
  const cx2 = positions[c], cy = positions[c + 1], cz = positions[c + 2];
  const e1 = [bx - ax, by - ay, bz - az], e2 = [cx2 - ax, cy - ay, cz - az];
  const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const L = Math.hypot(nrm[0], nrm[1], nrm[2]);
  if (L < 1e-10) continue;
  const ny = nrm[1] / L, area = L / 2;
  if (Math.abs(ny) < 0.55) continue;
  const minX = Math.min(ax, bx, cx2), maxX = Math.max(ax, bx, cx2);
  const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);
  const hx = ((by - ay) * (cz - az) - (cy - ay) * (bz - az)) / ((bx - ax) * (cz - az) - (bz - az) * (cx2 - ax));
  const hz = ((cy - ay) * (bx - ax) - (by - ay) * (cx2 - ax)) / ((bx - ax) * (cz - az) - (bz - az) * (cx2 - ax));
  const gx0 = Math.max(0, Math.floor((minX - ox) / NAV_CELL));
  const gx1 = Math.min(gw - 1, Math.floor((maxX - ox) / NAV_CELL));
  const gz0 = Math.max(0, Math.floor((minZ - oz) / NAV_CELL));
  const gz1 = Math.min(gd - 1, Math.floor((maxZ - oz) / NAV_CELL));
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
    if ((gx + 1) * NAV_CELL + ox <= minX || gx * NAV_CELL + ox >= maxX) continue;
    if ((gz + 1) * NAV_CELL + oz <= minZ || gz * NAV_CELL + oz >= maxZ) continue;
    const px = gx * NAV_CELL + ox, pz = gz * NAV_CELL + oz;
    addSurface(gx, gz, ay + hx * (px - ax) + hz * (pz - az), ny, area / ((gx1 - gx0 + 1) * (gz1 - gz0 + 1)));
  }
}

const height = new Float32Array(gw * gd).fill(NaN);
const ceilOf = new Float32Array(gw * gd).fill(Infinity);
for (const [k, arr] of surfaces) {
  let chosen = -Infinity;
  for (const s of arr) {
    if (s.ny <= 0) continue;
    if (s.area < cellArea * 0.15) continue;
    // For ground/street combat, prefer playable floor tiers between -5 and +8m
    if (s.y > chosen && s.y <= 12) { chosen = s.y; }
  }
  if (chosen === -Infinity) continue;
  const ceils = arr.filter((s) => s.ny < 0 && s.area >= cellArea * 0.15).map((s) => s.y).sort((a, b) => a - b);
  const c = ceils.find((v) => v > chosen + 0.1);
  height[k] = chosen;
  ceilOf[k] = c === undefined ? Infinity : c;
}

const walk = new Uint8Array(gw * gd);
let nWalk = 0;
for (let k = 0; k < gw * gd; k++) {
  if (!Number.isNaN(height[k]) && ceilOf[k] - height[k] >= HEADROOM && height[k] < 8) {
    walk[k] = 1;
    nWalk++;
  }
}
console.log(`[bake-cs] nav grid ${gw}x${gd} walkable: ${nWalk} cells (${(nWalk * cellArea).toFixed(0)} m2)`);

const cellToWorld = (gx, gz) => [gx * NAV_CELL + ox + NAV_CELL / 2, gz * NAV_CELL + oz + NAV_CELL / 2];

// Identify connected walkable islands
const comp = new Int32Array(gw * gd).fill(-1);
const comps = [];
for (let s = 0; s < gw * gd; s++) {
  if (walk[s] === 0 || comp[s] !== -1) continue;
  const id = comps.length;
  const q = [s]; comp[s] = id;
  let n = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  while (q.length) {
    const c = q.pop(); n++;
    const cx = c % gw, cz = (c / gw) | 0;
    if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
    if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= gw || nz >= gd) continue;
      const nn = key(nx, nz);
      if (comp[nn] !== -1 || walk[nn] === 0) continue;
      if (Math.abs(height[nn] - height[c]) > STEP_UP) continue;
      comp[nn] = id; q.push(nn);
    }
  }
  comps.push({ id, cells: n, x0, x1, z0, z1 });
}
comps.sort((a, b) => b.cells - a.cells);
const mainComp = comps[0];
console.log(`[bake-cs] largest walkable sector has ${mainComp.cells} cells`);

// Filter walk array to the main connected street sector
for (let k = 0; k < gw * gd; k++) {
  if (comp[k] !== mainComp.id) walk[k] = 0;
}

/* ------------------------------------------------ CS Spawns & Sites */
// Central Urban Street Core: |X| < 35, Y between -3.5m and 0m
// CT Base: North urban street (Z between 28 and 42)
// T Base: South urban street (Z between -42 and -28)
// Bombsite A: West Courtyard (X around -18, Z around 0)
// Bombsite B: East Market (X around +18, Z around 0)

const ctSpawns = [];
const tSpawns = [];

const urbanCells = [];
for (let gz = 0; gz < gd; gz++) {
  for (let gx = 0; gx < gw; gx++) {
    const k = key(gx, gz);
    if (!walk[k]) continue;
    const [wx, wz] = cellToWorld(gx, gz);
    const y = height[k];
    if (Math.abs(wx) < 32 && y > -3.5 && y < 0.5) {
      urbanCells.push({ wx, wz, y });
    }
  }
}

// Filter CT Candidates (North Street)
const ctCands = urbanCells.filter(c => c.wz >= 26 && c.wz <= 40);
ctCands.sort((a, b) => b.wz - a.wz);
for (const c of ctCands) {
  if (ctSpawns.length >= 8) break;
  if (ctSpawns.every(s => Math.hypot(s[0] - c.wx, s[2] - c.wz) > 3.2)) {
    ctSpawns.push([+c.wx.toFixed(2), +c.y.toFixed(2) + 0.05, +c.wz.toFixed(2)]);
  }
}

// Filter T Candidates (South Street)
const tCands = urbanCells.filter(c => c.wz <= -26 && c.wz >= -42);
tCands.sort((a, b) => a.wz - b.wz);
for (const c of tCands) {
  if (tSpawns.length >= 8) break;
  if (tSpawns.every(s => Math.hypot(s[0] - c.wx, s[2] - c.wz) > 3.2)) {
    tSpawns.push([+c.wx.toFixed(2), +c.y.toFixed(2) + 0.05, +c.wz.toFixed(2)]);
  }
}

// Fallback in case spacing was too tight
if (ctSpawns.length === 0) ctSpawns.push([0, -2.25, 32]);
if (tSpawns.length === 0) tSpawns.push([0, -2.25, -34]);

// Find Bombsites near central junction Z in [-8, 8]
const midA = urbanCells.filter(c => c.wx < -12 && Math.abs(c.wz) < 12)[0] || { wx: -18.5, wz: 0.5, y: -2.25 };
const midB = urbanCells.filter(c => c.wx > 12 && Math.abs(c.wz) < 12)[0] || { wx: 18.5, wz: -1.5, y: -2.25 };

const bombsites = {
  A: { name: 'Bombsite A (Courtyard)', x: +midA.wx.toFixed(2), y: +midA.y.toFixed(2), z: +midA.wz.toFixed(2), radius: 6.0 },
  B: { name: 'Bombsite B (Market)', x: +midB.wx.toFixed(2), y: +midB.y.toFixed(2), z: +midB.wz.toFixed(2), radius: 6.0 }
};

console.log(`[bake-cs] CT Spawns: ${ctSpawns.length}, T Spawns: ${tSpawns.length}`);
console.log(`[bake-cs] Sample CT spawn:`, ctSpawns[0]);
console.log(`[bake-cs] Sample T spawn:`, tSpawns[0]);
console.log(`[bake-cs] Bombsite A: (${bombsites.A.x}, ${bombsites.A.y}, ${bombsites.A.z})`);
console.log(`[bake-cs] Bombsite B: (${bombsites.B.x}, ${bombsites.B.y}, ${bombsites.B.z})`);

/* ------------------------------------------------ write nav.bin */
{
  const parts = [];
  const head = new Float32Array(12);
  head.set([gw, gd, NAV_CELL, ox, oz, STEP_UP, HEADROOM, AGENT_R, bmin[1], bmax[1], 0, 0], 0);
  parts.push(Buffer.from(head.buffer));
  parts.push(Buffer.from(height.buffer));
  parts.push(Buffer.from(walk.buffer));
  parts.push(Buffer.from(ceilOf.buffer));
  let out = Buffer.concat(parts);
  if (out.length % 4 !== 0) {
    out = Buffer.concat([out, Buffer.alloc(4 - (out.length % 4))]);
  }
  writeFileSync(resolve(OUT, 'nav.bin'), out);
  console.log(`[bake-cs] nav.bin ${(out.length / 1048576).toFixed(2)} MB`);
}

// Spawns array combining CT and T for generic spawn fallback
const combinedSpawns = [...ctSpawns, ...tSpawns];

writeFileSync(resolve(OUT, 'map.json'), JSON.stringify({
  source: 'cs_blackhawk_down.glb',
  name: 'Black Hawk Down',
  mode: 'counter_strike',
  unit: UNIT,
  offset: [-cx, 0, -cz],
  tris: nTri,
  verts: vcount,
  bounds: { min: bmin.map(v => +v.toFixed(2)), max: bmax.map(v => +v.toFixed(2)) },
  nav: { grid: [gw, gd], cell: NAV_CELL, origin: [ox, oz], walkable: mainComp.cells },
  ctSpawns,
  tSpawns,
  spawns: combinedSpawns,
  bombsites,
  koth: { x: +midA.wx.toFixed(2), y: +midA.y.toFixed(2), z: +midA.wz.toFixed(2), radius: 6.0 }
}, null, 2));

console.log('[bake-cs] DONE baking CS map collision and nav assets!');
