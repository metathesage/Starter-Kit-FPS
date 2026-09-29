// Scanned "angel" operator: a SAM 3D mesh skinned at load time and driven by the procedural rig's joint values.
// The classic procedural body stays as the animation driver (and IK solver); this mesh replaces its visible parts.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { toonGradient, outlineSkinned } from './toon.js';

const S = 1.78;                       // mesh height in rig units (same as the procedural body)
const V = (x, y) => [x, y];
// Joint landmarks in native mesh space (y -0.5..0.5, character-left = +x, front = +z)
const J = {
  hips: [0, 0.02], spine: [0, 0.09], chest: [0, 0.19], head: [0, 0.31],
  sh: [0.093, 0.265], el: [0.163, 0.15], wr: [0.2, 0.04], hand: [0.212, 0.0],
  hip: [0.066, 0.0], kn: [0.07, -0.21], an: [0.075, -0.44], toe: [0.075, -0.5],
  tail0: [0.128, 0.44], tail1: [0.22, 0.22], tail2: [0.268, 0.0],
  wing: [0.1, 0.285], wingTip: [0.29, 0.33],
};

// Bone table: name, parent, joint, and the skin segments that belong to it (a->b, radius scale)
const seg = (a, b, r = 1) => ({ a, b, r });
const mir = (p) => [-p[0], p[1]];
function table() {
  const B = [];
  const add = (name, parent, joint, segs) => B.push({ name, parent, joint, segs });
  add('hips', null, J.hips, [seg([0, -0.005], [0, 0.06], 1.6)]);
  add('spine', 'hips', J.spine, [seg([0, 0.06], [0, 0.17], 1.3)]);
  add('chest', 'spine', J.chest, [seg([0, 0.17], [0, 0.29], 1.4)]);
  add('head', 'chest', J.head, [seg([0, 0.3], [0, 0.5], 1.6)]);
  for (const s of [1, -1]) {
    const m = (p) => (s > 0 ? p : mir(p)), n = s > 0 ? 'L' : 'R';
    add('sh' + n, 'chest', m(J.sh), [seg(m(J.sh), m(J.el), 0.9)]);
    add('el' + n, 'sh' + n, m(J.el), [seg(m(J.el), m(J.wr), 0.9), seg(m(J.wr), m(J.hand), 0.9)]);
    add('th' + n, 'hips', m(J.hip), [seg(m(J.hip), m(J.kn), 1.1)]);
    add('sk' + n, 'th' + n, m(J.kn), [seg(m(J.kn), m(J.an), 1), seg(m(J.an), m(J.toe), 1)]);
    add('ta' + n, 'head', m(J.tail0), [seg(m(J.tail0), m(J.tail1), 1.3)]);
    add('tb' + n, 'ta' + n, m(J.tail1), [seg(m(J.tail1), m(J.tail2), 1.3)]);
    add('wg' + n, 'chest', m(J.wing), [seg(m(J.wing), m(J.wingTip), 1.6)]);
  }
  return B;
}
export const BONES = table();

const ptSeg = (px, py, pz, a, b) => {
  const abx = b[0] - a[0], aby = b[1] - a[1], apx = px - a[0], apy = py - a[1];
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby || 1)));
  const dx = px - (a[0] + abx * t), dy = py - (a[1] + aby * t);
  return Math.sqrt(dx * dx + dy * dy + pz * pz * 0.25);   // depth counts half: front/back of a limb belong to it
};

let cache = null;   // { geo, img, tex }
export const angelReady = () => !!cache;

export async function loadAngel(url = 'models/operator/angel.glb') {
  if (cache) return cache;
  const loader = new GLTFLoader();
  let g;
  try { g = await loader.loadAsync(url); }
  catch (e) {
    // hosts that only serve text/media types (e.g. the artifact preview): fall back to a base64 copy
    const r = await fetch(url.replace(/\.glb$/, '.b64.txt')); if (!r.ok) throw e;
    const bin = atob((await r.text()).trim()), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    g = await new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej));
  }
  let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const src = mesh.geometry, P = src.attributes.position, n = P.count;
  const geo = new THREE.BufferGeometry();
  // bake: flip to rig frame (front = -z, character-left = -x), scale, feet on the ground
  const pos = new Float32Array(n * 3), idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), tmp = new Float32Array(BONES.length);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    pos[i * 3] = -x * S; pos[i * 3 + 1] = (y + 0.5) * S; pos[i * 3 + 2] = -z * S;
    // weights, in mesh space, symmetric on |x| via the mirrored bone segments
    for (let b = 0; b < BONES.length; b++) {
      let best = 9;
      for (const sg of BONES[b].segs) { const d = ptSeg(x, y, z, sg.a, sg.b) / sg.r; if (d < best) best = d; }
      tmp[b] = 1 / Math.pow(best * best + 0.0006, 2);
    }
    // top 4
    let top = [];
    for (let b = 0; b < BONES.length; b++) top.push(b);
    top.sort((a, b) => tmp[b] - tmp[a]); top = top.slice(0, 4);
    let sum = 0; for (const b of top) sum += tmp[b];
    for (let k = 0; k < 4; k++) { idx[i * 4 + k] = top[k]; wt[i * 4 + k] = tmp[top[k]] / sum; }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', src.attributes.uv);
  if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone());
  geo.setIndex(src.index);
  // rewrite normals into the rig frame
  const nm = geo.attributes.normal; if (nm) for (let i = 0; i < nm.count; i++) nm.setXYZ(i, -nm.getX(i), nm.getY(i), -nm.getZ(i));
  else geo.computeVertexNormals();
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6; geo.userData.shared = true;
  cache = { geo, img: mesh.material.map.image, tex: new Map() };
  return cache;
}

// ---- per-hair-colour texture (recolours the pink hair, keeps armour/skin) ----
function hairTexture(hex) {
  const key = hex >>> 0;
  if (cache.tex.has(key)) return cache.tex.get(key);
  const img = cache.img, W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, W, H), d = id.data;
  const hc = new THREE.Color(hex), hr = hc.r * 255, hg = hc.g * 255, hb = hc.b * 255;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
    if (sat < 0.07 || mx < 0.22) continue;
    let h = 0; if (mx > mn) { if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; }
    if (!(h >= 290 || h < 10)) continue;
    const a = Math.min(1, (sat - 0.07) / 0.14), lum = (0.3 * r + 0.55 * g + 0.15 * b) / 0.62, k = 0.42 + 0.72 * Math.min(1.5, lum + 0.2);
    d[i] += (Math.min(255, hr * k) - d[i]) * a; d[i + 1] += (Math.min(255, hg * k) - d[i + 1]) * a; d[i + 2] += (Math.min(255, hb * k) - d[i + 2]) * a;
  }
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;
  cache.tex.set(key, t); return t;
}

const D = new THREE.Vector3(0, -1, 0);
const W = (p) => new THREE.Vector3(-p[0] * S, (p[1] + 0.5) * S, 0);   // joint in rig frame

// Attach the skinned angel to a procedural rig. Hides the classic body, keeps halo + weapon + joints.
export function attachAngel(rig, { hair = 0xff86c2, tint = 0x4aa0ff } = {}) {
  if (!cache) return false;
  const bones = {}, list = [];
  for (const b of BONES) {
    const bone = new THREE.Bone(); bone.name = b.name; bone.userData.j = W(b.joint);
    const pj = b.parent ? bones[b.parent].userData.j : new THREE.Vector3();
    bone.position.copy(bone.userData.j).sub(pj);
    if (b.parent) bones[b.parent].add(bone);
    bones[b.name] = bone; list.push(bone);
  }
  const mat = new THREE.MeshToonMaterial({ map: hairTexture(hair), gradientMap: toonGradient(), side: THREE.DoubleSide, emissive: new THREE.Color(0x000000) });
  mat.emissiveMap = mat.map; mat.emissive.setScalar(0.42);
  mat.color.set(0xffffff).lerp(new THREE.Color(tint), 0.3);
  const mesh = new THREE.SkinnedMesh(cache.geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
  mesh.add(bones.hips); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list), new THREE.Matrix4());
  rig.model.add(mesh);
  const ink = outlineSkinned(mesh);
  // hide classic body meshes (weapon isn't attached yet); keep the halo
  rig.model.traverse((o) => { if (o.isMesh && o !== mesh && !o.userData.outline) { let p = o, keep = false; while (p) { if (p === rig.halo) keep = true; p = p.parent; } if (!keep) o.visible = false; } });
  // arm rest offsets: rotate the classic straight-down arm onto the scanned A-pose arm
  const rest = {};
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1, a = W([J.sh[0] * sg, J.sh[1]]), b = W([J.wr[0] * sg, J.wr[1]]);
    rest[s] = new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), D);
    bones['sh' + s].scale.setScalar(1.14);
  }
  rig.haloY = 0.335; rig.halo.scale.setScalar(0.78); rig.crown.position.y = 0.27;
  rig.sam = { mesh, ink, bones, mat, rest, hipsY: bones.hips.position.y, base: 0.42 };
  return true;
}

const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qi = new THREE.Quaternion();
const RESTX = 0.15;
// Copy the procedural rig's animated joints onto the skinned skeleton. Called at the end of animateRig.
export function syncAngel(rig, s) {
  const S_ = rig.sam, B = S_.bones;
  B.hips.position.y = S_.hipsY + (rig.hips.position.y - 0.96) * 0.92;
  B.hips.rotation.copy(rig.hips.rotation); B.spine.rotation.copy(rig.spine.rotation); B.chest.rotation.copy(rig.chest.rotation);
  B.chest.scale.y = rig.chest.scale.y; B.head.rotation.copy(rig.head.rotation);
  B.thL.rotation.copy(rig.legL.rotation); B.skL.rotation.copy(rig.kneeL.rotation);
  B.thR.rotation.copy(rig.legR.rotation); B.skR.rotation.copy(rig.kneeR.rotation);
  for (const [n, arm, elb] of [['L', rig.aL.arm, rig.aL.elbow], ['R', rig.aR.arm, rig.aR.elbow]]) {
    const qr = S_.rest[n]; qi.copy(qr).invert();
    B['sh' + n].quaternion.copy(arm.quaternion).multiply(qr);
    B['el' + n].quaternion.copy(qi).multiply(elb.quaternion).multiply(qr);
  }
  rig.tails.forEach((t, i) => {
    const n = i === 0 ? 'L' : 'R';   // tails[0] is sd=-1
    const sd = t.s;
    B['ta' + n].rotation.set((t.t1.rotation.x - 0.15) * 0.55, 0, (t.t1.rotation.z + 0.5 * sd) * 0.6);
    B['tb' + n].rotation.set((t.t2.rotation.x + t.t3.rotation.x * 0.7) * 0.6, 0, 0);
  });
  const w = rig.wings; if (w) { const k = (w.L.rotation.z - 0.24); B.wgL.rotation.set(w.L.rotation.x, 0, k * 0.8); B.wgR.rotation.set(w.R.rotation.x, 0, -k * 0.8); }
  // hit flash / boost glow ride on the classic body material; mirror them here
  const e = rig.mats.body.emissive; S_.mat.emissive.setRGB(S_.base + e.r, S_.base + e.g, S_.base + e.b);
  void s; void q1; void q2; void RESTX;
}

export function angelCamo(rig, k) {
  const m = rig.sam.mat; const on = k > 0;
  rig.sam.ink.visible = !on; m.transparent = on; m.opacity = on ? (k >= 1 ? 0.07 : 0.4) : 1; m.depthWrite = !on; m.needsUpdate = true;
}
