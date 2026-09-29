#!/usr/bin/env node
/**
 * Offline map bake: Haven GLB -> collision BVH + nav grid + spawn/KOTH/cover data.
 *
 * Source maps are Z-up Sketchfab exports with a 180-degree root yaw. We normalise to
 * Y-up metres so every downstream system (collision, nav, spawns) works in one space.
 *
 * Outputs into assets/map/:
 *   collision.bin   BVH over triangle soup (Float32 pos + Uint32 idx + nodes)
 *   nav.bin         walkable grid: height, flags, links
 *   map.json        bounds, spawns, KOTH site, cover points, materials
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/* ------------------------------------------------------------------ glb io */

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

const SRC = process.argv[2] ?? resolve(ROOT, '../Maps/halo_4multiplayerdefaulthaven.glb');
const OUT = resolve(ROOT, 'assets/map');
const UNIT = 0.1;          // 1 source unit -> 0.1 m  (see DESIGN.md scale derivation)
const NAV_CELL = 0.5;      // nav grid resolution, metres
const STEP_UP = 0.62;      // max climbable ledge, metres
const HEADROOM = 1.9;      // required clearance above a walkable surface
const AGENT_R = 0.35;      // nav agent radius

mkdirSync(OUT, { recursive: true });
console.log(`[bake] source ${SRC}`);
console.log(`[bake] unit scale ${UNIT} (1 unit = ${UNIT * 100} cm)`);

/* ------------------------------------------------- load + normalise geometry */

const { json, bin } = readGLB(SRC);
const world = new Array(json.nodes.length);
const visit = (i, p) => {
  world[i] = p ? mul(p, nodeMatrix(json.nodes[i])) : nodeMatrix(json.nodes[i]);
  for (const c of json.nodes[i].children ?? []) visit(c, world[i]);
};
for (const r of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(r, null);

// Normalise: Z-up -> Y-up, then scale, then centre XZ on the origin.
// (x, y, z)_src -> (x, z, -y)  = -90 deg about X.
const R = new Float64Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);

const positions = [];   // flat xyz, metres
const indices = [];
const matOfTri = [];
let vcount = 0;
const bmin = [Infinity, Infinity, Infinity];
const bmax = [-Infinity, -Infinity, -Infinity];

const triMat = new Map();
json.materials?.forEach((m, i) => triMat.set(m.name ?? `mat${i}`, i));

json.nodes.forEach((node, ni) => {
  if (node.mesh === undefined) return;
  const M = mul(world[ni], R);
  const mesh = json.meshes[node.mesh];
  for (const prim of mesh.primitives) {
    if (prim.mode !== undefined && prim.mode !== 4) continue;   // triangles only
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

// Re-centre XZ so the arena is centred on the origin.
const cx = (bmin[0] + bmax[0]) / 2, cz = (bmin[2] + bmax[2]) / 2;
for (let i = 0; i < positions.length; i += 3) {
  positions[i] -= cx;
  positions[i + 2] -= cz;
}
bmin[0] -= cx; bmax[0] -= cx;
bmin[2] -= cz; bmax[2] -= cz;

const nTri = indices.length / 3;
console.log(`[bake] ${vcount} verts, ${nTri} tris`);
console.log(`[bake] bounds m: x[${bmin[0].toFixed(1)},${bmax[0].toFixed(1)}] y[${bmin[1].toFixed(1)},${bmax[1].toFixed(1)}] z[${bmin[2].toFixed(1)},${bmax[2].toFixed(1)}]`);

/* ------------------------------------------------------------------- bvh */

// Median-split BVH over triangles. Serialised as: per node {bmin,bmax,leftOrStart,count}.
const bvhStart = 0;
const centroids = new Float32Array(nTri * 3);
for (let t = 0; t < nTri; t++) {
  const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
  for (let k = 0; k < 3; k++) {
    centroids[t * 3 + k] = (positions[a * 3 + k] + positions[b * 3 + k] + positions[c * 3 + k]) / 3;
  }
}

const triOrder = new Uint32Array(nTri);
for (let t = 0; t < nTri; t++) triOrder[t] = t;

const nodes = [];   // 13 floats: bmin3, bmax3, start, count, axis, childL, childR, pad
const stack = [{ start: 0, count: nTri, depth: 0 }];
const LEAF = 8;
const DEPTH_LIMIT = 40;   // median split on a bad centroid spread can run away

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

// Build recursively so a parent is always written AFTER both children exist and
// the real child indices are known. A LIFO stack cannot guarantee that.
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

  // Split on the widest centroid axis at the median.
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
console.log(`[bake] bvh nodes ${nNodes} (leaves ${nLeaves}), leaf size ${LEAF}, depth ${maxDepth}, avg tris/leaf ${(nTri / Math.max(1, nLeaves)).toFixed(1)}`);

/* -------------------------------------------------------------- write bvh */

{
  const pos = new Float32Array(positions);
  const idx = new Uint32Array(indices);
  const order = new Uint32Array(triOrder);
  const mtl = new Uint16Array(nTri);
  const nameList = [...new Set(matOfTri)].sort();
  const mtlLookup = new Map(nameList.map((n, i) => [n, i]));
  for (let t = 0; t < nTri; t++) mtl[t] = mtlLookup.get(matOfTri[t]);

  const blob = [];
  // Header is exactly 12 floats (48 bytes): counts[4] + bmin[3] + bmax[3] + pad[2].
  // The reader in src/world/collision.js must skip 48 bytes to match.
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
  console.log(`[bake] collision.bin ${(out.length / 1048576).toFixed(2)} MB`);
}

/* ------------------------------------------------------------- nav grid */

// Rasterise triangle surfaces into a horizontal grid, keeping every surface
// height per cell (the map is multi-tier, so a single height is not enough).
const ox = bmin[0], oz = bmin[2];
const gw = Math.max(1, Math.ceil((bmax[0] - bmin[0]) / NAV_CELL) + 1);
const gd = Math.max(1, Math.ceil((bmax[2] - bmin[2]) / NAV_CELL) + 1);
const cellArea = NAV_CELL * NAV_CELL;

const surfaces = new Map();   // cellKey -> [{y, nx, ny, area}]
const key = (gx, gz) => gz * gw + gx;

function addSurface(gx, gz, y, ny, area) {
  const k = key(gx, gz);
  let arr = surfaces.get(k);
  if (!arr) surfaces.set(k, (arr = []));
  arr.push({ y, ny, area });
}

// Bucket triangles by their XZ bbox so each triangle is only visited nearby.
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
  if (Math.abs(ny) < 0.55) continue;                     // too steep to stand on / walk under
  const minX = Math.min(ax, bx, cx2), maxX = Math.max(ax, bx, cx2);
  const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);
  // Exact plane fit y = h00 + hx*dx + hz*dz. A u/v blend of corner heights is
  // only valid if the "down" axis is the triangle's local v axis; the terrain
  // has triangles up to 50 m across where that overshoots by metres.
  const hx = ((by - ay) * (cz - az) - (cy - ay) * (bz - az)) / ((bx - ax) * (cz - az) - (bz - az) * (cx2 - ax));
  const hz = ((cy - ay) * (bx - ax) - (by - ay) * (cx2 - ax)) / ((bx - ax) * (cz - az) - (bz - az) * (cx2 - ax));
  const gx0 = Math.max(0, Math.floor((minX - ox) / NAV_CELL));
  const gx1 = Math.min(gw - 1, Math.floor((maxX - ox) / NAV_CELL));
  const gz0 = Math.max(0, Math.floor((minZ - oz) / NAV_CELL));
  const gz1 = Math.min(gd - 1, Math.floor((maxZ - oz) / NAV_CELL));
  const bw = Math.max(maxX - minX, 1e-3), bd = Math.max(maxZ - minZ, 1e-3);
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
    // only cells the triangle's bbox actually covers
    if ((gx + 1) * NAV_CELL + ox <= minX || gx * NAV_CELL + ox >= maxX) continue;
    if ((gz + 1) * NAV_CELL + oz <= minZ || gz * NAV_CELL + oz >= maxZ) continue;
    const px = gx * NAV_CELL + ox, pz = gz * NAV_CELL + oz;
    addSurface(gx, gz, ay + hx * (px - ax) + hz * (pz - az), ny, area / ((gx1 - gx0 + 1) * (gz1 - gz0 + 1)));
  }
}

// Pick, per cell, the walkable surface.
//
// The rule must match what the collision mesh does to a player standing there:
// the TOPMOST floor surface with headroom above it. Two guards keep this honest:
//  * a surface only counts if the triangle genuinely covers the cell (a big
//    terrain triangle clipped to a corner of the cell must not decide it), and
//  * small/steep fragments — wall shoulders, roof overhangs — cannot win.
const height = new Float32Array(gw * gd).fill(NaN);
const ceilOf = new Float32Array(gw * gd).fill(Infinity);
const hasCeil = new Uint8Array(gw * gd);
const support = new Float32Array(gw * gd);   // area of floor surface per cell
for (const [k, arr] of surfaces) {
  // Strongest upward-facing fragment in this cell wins.
  let chosen = -Infinity, chosenArea = 0;
  for (const s of arr) {
    if (s.ny <= 0) continue;
    if (s.area < cellArea * 0.20) continue;   // sliver: a ledge edge, not a floor
    if (s.y > chosen) { chosen = s.y; chosenArea = s.area; }
  }
  if (chosen === -Infinity) continue;

  const total = arr.reduce((s, x) => s + Math.max(0, x.area), 0);
  if (total < cellArea * 0.25) continue;       // too little coverage to trust

  const ceils = arr.filter((s) => s.ny < 0 && s.area >= cellArea * 0.2).map((s) => s.y).sort((a, b) => a - b);
  const c = ceils.find((v) => v > chosen + 0.05);

  height[k] = chosen;
  ceilOf[k] = c === undefined ? Infinity : c;
  hasCeil[k] = c === undefined ? 0 : 1;
  support[k] = chosenArea;
}

const walk = new Uint8Array(gw * gd);
let nWalk = 0;
for (let k = 0; k < gw * gd; k++) {
  if (!Number.isNaN(height[k]) && ceilOf[k] - height[k] >= HEADROOM) { walk[k] = 1; nWalk++; }
}
console.log(`[bake] nav grid ${gw}x${gd} (${NAV_CELL}m)  walkable ${nWalk} cells (${(nWalk * cellArea).toFixed(0)} m2)`);

const cellToWorld = (gx, gz) => [gx * NAV_CELL + ox + NAV_CELL / 2, gz * NAV_CELL + oz + NAV_CELL / 2];
const worldToCell = (x, z) => [Math.round((x - ox) / NAV_CELL - 0.5), Math.round((z - oz) / NAV_CELL - 0.5)];

/* ------------------------------------------------ arena envelope + koth */

// The model is a Halo map sitting on a large sloped terrain skirt at the same
// floor height, so "walkable" alone covers the whole bounding box and every open
// plate ties. The real arena is the built-up region. Detect it by *structure*:
// a cell is "built" when the ground around it is not a smooth open plane —
// there is a step, a wall, a different floor tier, or overhead geometry.
const built = new Uint8Array(gw * gd);
for (let z = 0; z < gd; z++) for (let x = 0; x < gw; x++) {
  const k = key(x, z);
  if (!walk[k]) continue;
  const h0 = height[k];
  let isBuilt = 0;
  // overhead geometry
  if (hasCeil[k]) isBuilt = 1;
  if (!isBuilt) {
    for (let dz = -3; dz <= 3 && !isBuilt; dz++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= gw || nz >= gd) continue;
      const nk = key(nx, nz);
      if (!walk[nk]) { isBuilt = 1; break; }                       // a wall / drop right there
      if (Math.abs(height[nk] - h0) > STEP_UP + 0.1) { isBuilt = 1; break; }  // a ledge
    }
  }
  built[k] = isBuilt;
}

const comp = new Int32Array(gw * gd).fill(-1);
const comps = [];
for (let s = 0; s < gw * gd; s++) {
  if (built[s] === 0 || comp[s] !== -1) continue;
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
      if (comp[nn] !== -1 || built[nn] === 0) continue;
      comp[nn] = id; q.push(nn);
    }
  }
  comps.push({ id, cells: n, x0, x1, z0, z1 });
}
comps.sort((a, b) => b.cells - a.cells);
const mainComp = comps[0];
console.log(`[bake] built structure: ${comps.length} islands, main = ${mainComp.cells} cells, span x[${mainComp.x0},${mainComp.x1}] z[${mainComp.z0},${mainComp.z1}]`);

// Allow a margin so players can use the flanking ground the structures sit on,
// but not run off across the whole terrain skirt.
const MARGIN = 10;   // cells = 5 m
const arena = new Uint8Array(gw * gd);
let nArena = 0;
for (let z = 0; z < gd; z++) for (let x = 0; x < gw; x++) {
  if (!walk[key(x, z)]) continue;
  if (comp[key(x, z)] === mainComp.id) { arena[key(x, z)] = 1; nArena++; continue; }
  const near = x >= mainComp.x0 - MARGIN && x <= mainComp.x1 + MARGIN &&
    z >= mainComp.z0 - MARGIN && z <= mainComp.z1 + MARGIN;
  if (near) { arena[key(x, z)] = 1; nArena++; }
}
console.log(`[bake] arena envelope ${nArena} cells (${(nArena * cellArea).toFixed(0)} m2)`);

// Nav uses the arena envelope, not the raw terrain.
walk.set(arena);

const arenaCx = (mainComp.x0 + mainComp.x1) / 2;
const arenaCz = (mainComp.z0 + mainComp.z1) / 2;
console.log(`[bake] arena centre x=${(arenaCx * NAV_CELL + ox).toFixed(1)} z=${(arenaCz * NAV_CELL + oz).toFixed(1)}`);

// KOTH = most open plate inside the arena, biased toward the arena's spine so the
// zone is contested rather than tucked in a corner, and required to be FLAT.
// A sloped objective reads as a bug to players and makes cover unpredictable.
function findKoth() {
  const R = 12;   // 6 m radius
  const cellsIn = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz <= R * R) cellsIn.push([dx, dz]);
  }
  // flatness probe ring, at 1.5 m
  const flatRing = [];
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    flatRing.push([Math.cos(t) * 3, Math.sin(t) * 3]);
  }

  let best = null;
  for (let gz = 0; gz < gd; gz++) for (let gx = 0; gx < gw; gx++) {
    if (!walk[key(gx, gz)]) continue;
    let n = 0;
    for (const [dx, dz] of cellsIn) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || z < 0 || x >= gw || z >= gd) continue;
      if (walk[key(x, z)]) n++;
    }
    if (n < cellsIn.length * 0.9) continue;             // require a genuinely open disc

    // Reject slopes: the surface must be near-level all around the zone.
    const h0 = height[key(gx, gz)];
    let flat = true;
    for (const [dx, dz] of flatRing) {
      const x = gx + Math.round(dx / NAV_CELL), z = gz + Math.round(dz / NAV_CELL);
      if (x < 0 || z < 0 || x >= gw || z >= gd) { flat = false; break; }
      const hk = key(x, z);
      if (!walk[hk] || Math.abs(height[hk] - h0) > 0.12) { flat = false; break; }
    }
    if (!flat) continue;

    const central = 1 - Math.min(1, Math.hypot(gx - arenaCx, gz - arenaCz) / (mainComp.z1 - mainComp.z0));
    const score = n * (0.55 + 0.45 * central);
    if (!best || score > best.score) {
      const [wx, wz] = cellToWorld(gx, gz);
      best = { score, n, x: wx, z: wz, y: h0, radius: R * NAV_CELL };
    }
  }
  return best;
}
const koth = findKoth();
if (!koth) throw new Error('no flat open KOTH plate found inside the arena envelope');
console.log(`[bake] KOTH site x=${koth.x.toFixed(1)} z=${koth.z.toFixed(1)} y=${koth.y.toFixed(2)} r=${koth.radius.toFixed(1)}m (${koth.n} cells, flat)`);

// Cover points: walkable cells adjacent to something solid, on a flat-ish area.
const cover = [];
for (let gz = 1; gz < gd - 1; gz++) for (let gx = 1; gx < gw - 1; gx++) {
  const k = key(gx, gz);
  if (!walk[k]) continue;
  let walls = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nk = key(gx + dx, gz + dz);
    // a neighbour is "blocking" if it is not walkable, or it is much lower/higher
    if (nk < 0 || nk >= walk.length || !walk[nk]) walls++;
    else if (Math.abs(height[nk] - height[k]) > STEP_UP + 0.05) walls++;
  }
  if (walls >= 1) {
    const [wx, wz] = cellToWorld(gx, gz);
    cover.push([+wx.toFixed(2), +height[k].toFixed(2), +wz.toFixed(2)]);
  }
}
console.log(`[bake] cover points ${cover.length}`);

// Spawns: spread inside the ARENA ENVELOPE, away from the KOTH point, on
// standable ground. Using the raw terrain grid here would put spawns out on
// the outer apron where there are no walls and the body simply rolls away.
const spawns = [];
{
  const cands = [];
  for (let gz = 1; gz < gd - 1; gz++) for (let gx = 1; gx < gw - 1; gx++) {
    const k = key(gx, gz);
    if (!walk[k]) continue;
    const [wx, wz] = cellToWorld(gx, gz);
    const dK = Math.hypot(wx - koth.x, wz - koth.z);
    if (dK < 14) continue;                      // not on top of the objective
    if (dK > 90) continue;                      // must be reachable, not on a far ledge
    // Require some cover nearby so spawns are not in the open.
    let walls = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = key(gx + dx, gz + dz);
      if (nk < 0 || nk >= walk.length || !walk[nk]) walls++;
    }
    if (walls === 0) continue;
    cands.push({ wx, wz, y: height[k], dK, walls });
  }
  cands.sort((a, b) => b.dK - a.dK);
  const want = 16;
  for (const c of cands) {
    if (spawns.length >= want) break;
    if (spawns.every((s) => Math.hypot(s[0] - c.wx, s[2] - c.wz) > 9)) {
      spawns.push([+c.wx.toFixed(2), +c.y.toFixed(2), +c.wz.toFixed(2)]);
    }
  }
  console.log(`[bake] spawn points ${spawns.length} (inside arena envelope)`);
}

/* ---------------------------------------------------------------- write nav */

{
  const parts = [];
  // 12 floats (48 bytes): gw gd cell ox oz stepUp headroom agentR yMin yMax pad pad
  const head = new Float32Array(12);
  head.set([gw, gd, NAV_CELL, ox, oz, STEP_UP, HEADROOM, AGENT_R, bmin[1], bmax[1], 0, 0], 0);
  parts.push(Buffer.from(head.buffer));
  parts.push(Buffer.from(height.buffer));
  parts.push(Buffer.from(walk.buffer));
  parts.push(Buffer.from(ceilOf.buffer));
  // The reader slices Float32Arrays out of this buffer directly, so the
  // ceilOf block must start on a 4-byte boundary. `walk` is one byte per cell
  // and gw*gd is often odd, which would otherwise misalign every float.
  let out = Buffer.concat(parts);
  if (out.length % 4 !== 0) {
    out = Buffer.concat([out, Buffer.alloc(4 - (out.length % 4))]);
  }
  writeFileSync(resolve(OUT, 'nav.bin'), out);
  console.log(`[bake] nav.bin ${(out.length / 1048576).toFixed(2)} MB`);
}

writeFileSync(resolve(OUT, 'map.json'), JSON.stringify({
  source: SRC.split(/[\\/]/).pop(),
  unit: UNIT,
  tris: nTri,
  verts: vcount,
  bounds: { min: bmin.map((v) => +v.toFixed(2)), max: bmax.map((v) => +v.toFixed(2)) },
  nav: { grid: [gw, gd], cell: NAV_CELL, origin: [ox, oz], walkable: nWalk },
  koth: { x: +koth.x.toFixed(2), y: +koth.y.toFixed(2), z: +koth.z.toFixed(2), radius: koth.radius },
  spawns,
  cover,
}, null, 1));

console.log('[bake] done');
