#!/usr/bin/env node
// Read-only GLB inspector. Prints scene graph, skeletons, animation names, and mesh stats.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const COMP = { 5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f' };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGLB(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = null;
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

function accInfo(json, bin, i) {
  const a = json.accessors[i];
  return {
    count: a.count,
    type: a.type,
    comp: COMP[a.componentType],
    n: NCOMP[a.type],
    min: a.min,
    max: a.max,
  };
}

function triCount(mesh) {
  let tris = 0;
  for (const p of mesh.primitives) {
    if (p.mode === undefined || p.mode === 4) {
      tris += Math.floor((p.indices !== undefined ? json0.accessors[p.indices].count : 0) / 3);
    }
  }
  return tris;
}

let json0 = null;

function report(path) {
  const { json, bin } = readGLB(path);
  json0 = json;
  const out = { file: basename(path) };
  out.generator = json.asset?.generator ?? '?';
  out.mb = +(bin.length / 1048576).toFixed(2);
  out.counts = {
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    materials: json.materials?.length ?? 0,
    textures: json.textures?.length ?? 0,
    images: json.images?.length ?? 0,
    animations: json.animations?.length ?? 0,
    skins: json.skins?.length ?? 0,
    accessors: json.accessors?.length ?? 0,
  };
  out.extensionsUsed = json.extensionsUsed ?? [];

  // scene roots + node names
  const scn = json.scenes?.[json.scene ?? 0];
  out.sceneRoots = (scn?.nodes ?? []).map((n) => json.nodes[n].name || `#${n}`);

  // meshes
  out.meshes = (json.meshes ?? []).map((m, i) => {
    let t = 0;
    const mats = new Set();
    for (const p of m.primitives) {
      const acc = p.indices !== undefined ? json.accessors[p.indices] : json.accessors[p.attributes.POSITION];
      t += Math.floor(acc.count / 3);
      if (p.material !== undefined) mats.add(p.material);
    }
    return { i, name: m.name, tris: t, mats: [...mats] };
  }).sort((a, b) => b.tris - a.tris);

  // world bounds of all POSITION accessors actually referenced
  let gmin = [Infinity, Infinity, Infinity];
  let gmax = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes ?? []) {
    for (const p of m.primitives) {
      const a = json.accessors[p.attributes.POSITION];
      if (!a?.min) continue;
      for (let k = 0; k < 3; k++) {
        gmin[k] = Math.min(gmin[k], a.min[k]);
        gmax[k] = Math.max(gmax[k], a.max[k]);
      }
    }
  }
  out.rawBounds = gmin[0] === Infinity ? null : { min: gmin.map((v) => +v.toFixed(2)), max: gmax.map((v) => +v.toFixed(2)) };

  // node transforms (to know if baked scale/rot)
  out.nodeTransforms = (json.nodes ?? [])
    .filter((n) => n.matrix || n.scale || n.rotation || n.translation)
    .slice(0, 20)
    .map((n) => ({
      name: n.name,
      t: n.translation?.map((v) => +v.toFixed(3)),
      r: n.rotation?.map((v) => +v.toFixed(3)),
      s: n.scale?.map((v) => +v.toFixed(3)),
      m: n.matrix ? 'yes' : undefined,
    }));

  // skeleton
  out.skins = (json.skins ?? []).map((s) => ({
    name: s.name,
    joints: s.joints?.length ?? 0,
    hasSkeleton: !!s.skeleton,
    sampleJoints: (s.joints ?? []).slice(0, 12).map((j) => json.nodes[j].name),
  }));

  // bone names (all nodes that look like bones)
  if (out.counts.skins) {
    const sk = json.skins[0];
    out.boneNames = (sk.joints ?? []).map((j) => json.nodes[j].name);
  }

  // animations
  out.animNames = (json.animations ?? []).map((a) => a.name);

  return out;
}

const targets = process.argv.slice(2);
const results = [];
for (const t of targets) {
  try {
    results.push(report(t));
  } catch (e) {
    results.push({ file: t, error: String(e.message) });
  }
}
console.log(JSON.stringify(results, null, 1));
